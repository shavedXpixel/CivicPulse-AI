import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { ProviderContainer, getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserRole } from '@civicpulse/shared';

export class AdminController {
  /**
   * POST /api/v1/admin/reset-demo
   * DEMO-ONLY: Restores the in-memory MockDatabaseProvider state to canonical Golden Demo.
   * Strictly disabled in REAL_MODE.
   */
  public static async resetDemo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 1. Strictly disabled when DEMO_MODE is false (protects REAL_MODE & Firestore)
      if (!env.DEMO_MODE) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: 'Demo reset is strictly disabled when DEMO_MODE is false (REAL_MODE active). Firestore data is protected.'
          })
        );
      }

      // 2. RBAC: Strictly restricted to municipal administrators
      if (req.user?.role !== UserRole.ADMIN) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: 'Access denied. Only municipal administrators can reset the demo state.'
          })
        );
      }

      // 3. Reset in-memory demo database
      ProviderContainer.resetToGoldenDemo();

      // 4. Retrieve canonical Golden Demo problem to verify state
      const db = getDatabaseProvider();
      const canonicalProblem = await db.getProblemCluster('PRB-2026-0819');

      res.status(200).json({
        data: {
          status: 'RESET_SUCCESS',
          message: 'Golden Demo state restored to canonical baseline.',
          canonical_problem: canonicalProblem
            ? {
                id: canonicalProblem.id,
                title: canonicalProblem.title,
                ward_id: canonicalProblem.ward_id,
                impact_score: canonicalProblem.impact_score,
                department_id: canonicalProblem.department_id,
                status: canonicalProblem.status
              }
            : null,
          is_demo_only: true,
          reset_at: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
