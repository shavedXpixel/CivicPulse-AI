import { Request, Response, NextFunction } from 'express';
import { GovernanceQueryInputSchema } from '@civicpulse/shared';
import { GovernanceService } from './governance.service';

export class GovernanceController {
  /**
   * POST /api/v1/governance/query
   * Executes a grounded governance intelligence natural language query.
   */
  public static async query(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const validatedInput = GovernanceQueryInputSchema.parse(req.body);

      const result = await GovernanceService.executeGovernanceQuery(user, validatedInput);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/governance/brief
   * Retrieves high-level executive intelligence brief.
   */
  public static async getBrief(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const brief = await GovernanceService.getAIBrief(user);
      res.status(200).json({ data: brief });
    } catch (err) {
      next(err);
    }
  }
}
