import { Request, Response, NextFunction } from 'express';
import { DashboardService } from './dashboard.service';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserRole } from '@civicpulse/shared';

export class DashboardController {
  public static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Authentication required.'
          })
        );
      }

      if (req.user.role === UserRole.CITIZEN) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: 'Citizens are not authorized to view the operational government dashboard.'
          })
        );
      }

      const summary = await DashboardService.getSummary(req.user);
      res.status(200).json({
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getPriorityProblems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Authentication required.'
          })
        );
      }

      if (req.user.role === UserRole.CITIZEN) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: 'Citizens are not authorized to access internal priority queues.'
          })
        );
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const problems = await DashboardService.getPriorityProblems(req.user, limit);

      res.status(200).json({
        data: problems
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getMapData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Authentication required.'
          })
        );
      }

      const mapProblems = await DashboardService.getMapData(req.user);
      res.status(200).json({
        data: mapProblems
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getSlaRisk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Authentication required.'
          })
        );
      }

      if (req.user.role === UserRole.CITIZEN) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: 'Citizens are not authorized to access internal SLA risk queues.'
          })
        );
      }

      const riskProblems = await DashboardService.getSlaRiskProblems(req.user);
      res.status(200).json({
        data: riskProblems
      });
    } catch (err) {
      next(err);
    }
  }
}
