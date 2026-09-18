import { Request, Response, NextFunction } from 'express';
import { problemService } from './problem.service';
import {
  ProblemFilterSchema,
  CreateProblemClusterSchema,
  ClusterSignalSchema
} from '@civicpulse/shared';
import { AppError } from '../../middleware/error.middleware';

export class ProblemController {
  public static async listProblems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const parsed = ProblemFilterSchema.safeParse(req.query);
      if (!parsed.success) {
        throw new AppError({
          statusCode: 400,
          code: 'VALIDATION_ERROR',
          message: `Invalid query parameters: ${parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        });
      }
      const query = parsed.data;

      const result = await problemService.listProblems(user, query);

      res.status(200).json({
        data: result.data,
        pagination: {
          limit: query.limit || 20,
          next_cursor: result.nextCursor
        }
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getProblem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const problem = await problemService.getProblem(user, id);

      res.status(200).json({
        data: problem
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getProblemDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const details = await problemService.getProblemDetails(user, id);

      res.status(200).json({
        data: details
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getProblemSignals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      const signals = await problemService.getProblemSignals(user, id);

      res.status(200).json({
        data: signals
      });
    } catch (err) {
      next(err);
    }
  }

  public static async createProblem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const parsed = CreateProblemClusterSchema.safeParse(req.body);

      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        return next(
          new AppError({
            statusCode: 400,
            code: 'INVALID_REQUEST',
            message
          })
        );
      }

      const problem = await problemService.createProblem(user, parsed.data);

      res.status(201).json({
        data: problem
      });
    } catch (err) {
      next(err);
    }
  }

  public static async recalculateImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;

      // SECURITY: Client-supplied factor scores in req.body are strictly ignored.
      // Factors are derived entirely server-side from stored database records.
      const problem = await problemService.recalculateImpact(user, id);

      res.status(200).json({
        data: problem
      });
    } catch (err) {
      next(err);
    }
  }

  public static async clusterSignal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const parsed = ClusterSignalSchema.safeParse(req.body);

      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join(', ');
        return next(
          new AppError({
            statusCode: 400,
            code: 'INVALID_REQUEST',
            message
          })
        );
      }

      const result = await problemService.clusterSignal(user, id, parsed.data.signal_id);

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
