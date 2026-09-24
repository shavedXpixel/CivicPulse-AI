import { Request, Response, NextFunction } from 'express';
import { GovernanceQueryInputSchema, DevelopmentDemandAnalyzeRequestSchema } from '@civicpulse/shared';
import { GovernanceService } from './governance.service';
import {
  DevelopmentDemandGovernanceService,
  clusterDemandSignals,
  calculateDemandMetrics
} from '../../services';

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

  /**
   * POST /api/v1/governance/development-demand/analyze
   * HF7.6: Advisory-only interpretation of development demand cluster and metrics.
   */
  public static async analyzeDevelopmentDemand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const validated = DevelopmentDemandAnalyzeRequestSchema.parse(req.body);

      let cluster = (validated as any).cluster;
      let metrics = (validated as any).metrics;
      const signals = (validated as any).signals || [];
      const indicators = (validated as any).indicators || [];
      const investments = (validated as any).investments || [];

      if (!cluster && signals.length > 0) {
        const clusters = await clusterDemandSignals(signals, { includeDemo: false });
        cluster = clusters[0];
      }

      if (!cluster) {
        res.status(400).json({ error: 'No demand cluster or signals provided for analysis' });
        return;
      }

      if (!metrics) {
        metrics = await calculateDemandMetrics(
          cluster,
          signals,
          indicators,
          investments
        );
      }

      const result = await DevelopmentDemandGovernanceService.analyzeDevelopmentDemand({
        cluster,
        signals,
        indicators,
        investments,
        metrics,
        user,
        is_demo: false
      });

      res.status(200).json({
        ...result,
        data: result,
        analysis: result
      });
    } catch (err) {
      next(err);
    }
  }
}
