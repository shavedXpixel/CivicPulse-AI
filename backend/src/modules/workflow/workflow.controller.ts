import { Request, Response, NextFunction } from 'express';
import { WorkflowService } from './workflow.service';
import { AppError } from '../../middleware/error.middleware';
import {
  ERROR_CODES,
  AssignProblemSchema,
  ProblemActionInputSchema,
  UpdateProblemStatusSchema
} from '@civicpulse/shared';

export class WorkflowController {
  public static async assignProblem(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const parsed = AssignProblemSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: parsed.error.issues[0]?.message || 'Validation error for problem assignment.'
          })
        );
      }

      const problemId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const result = await WorkflowService.assignProblem(req.user, problemId, parsed.data);

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const problemId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const assignments = await WorkflowService.getProblemAssignments(req.user, problemId);

      res.status(200).json({
        data: assignments
      });
    } catch (err) {
      next(err);
    }
  }

  public static async recordAction(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const parsed = ProblemActionInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: parsed.error.issues[0]?.message || 'Validation error for problem action.'
          })
        );
      }

      const problemId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const result = await WorkflowService.recordAction(req.user, problemId, parsed.data);

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  public static async getActions(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const problemId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const actions = await WorkflowService.getProblemActions(req.user, problemId);

      res.status(200).json({
        data: actions
      });
    } catch (err) {
      next(err);
    }
  }

  public static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
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

      const parsed = UpdateProblemStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: parsed.error.issues[0]?.message || 'Validation error for problem status update.'
          })
        );
      }

      const problemId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const result = await WorkflowService.transitionStatus(
        req.user,
        problemId,
        parsed.data.status,
        parsed.data.note
      );

      res.status(200).json({
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}
