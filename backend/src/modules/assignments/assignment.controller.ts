import { Request, Response, NextFunction } from 'express';
import { getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserRole, Assignment } from '@civicpulse/shared';
import { SLAService } from '../workflow/sla.service';

export interface HydratedAssignment extends Assignment {
  problem?: import('@civicpulse/shared').ProblemCluster;
}

export class AssignmentController {
  public static async listAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Authentication required.'
          })
        );
      }

      // 1. Citizen is strictly forbidden from viewing government assignments
      if (user.role === UserRole.CITIZEN) {
        return next(
          new AppError({
            statusCode: 403,
            code: ERROR_CODES.FORBIDDEN,
            message: 'Citizens are not authorized to view government assignments.'
          })
        );
      }

      const db = getDatabaseProvider();
      const filter: { department_id?: string; assigned_to?: string; status?: string } = {};

      // 2. Server-side scoping
      if (user.role === UserRole.FIELD_OFFICER) {
        // Field officer only ever sees assignments explicitly assigned to them
        filter.assigned_to = user.id;
      } else if (user.role === UserRole.DEPARTMENT_OFFICER) {
        // Department officer scoped to their department
        filter.department_id = user.department_id;
        if (req.query.assigned_to && req.query.assigned_to !== 'me') {
          filter.assigned_to = req.query.assigned_to as string;
        }
      } else if (user.role === UserRole.ADMIN || user.role === UserRole.SYSTEM_ADMIN) {
        if (req.query.assigned_to === 'me') {
          filter.assigned_to = user.id;
        } else if (req.query.assigned_to) {
          filter.assigned_to = req.query.assigned_to as string;
        }
        if (req.query.department_id) {
          filter.department_id = req.query.department_id as string;
        }
      }

      if (req.query.status) {
        filter.status = req.query.status as string;
      }

      const assignments = await db.listAssignments(filter);

      // Hydrate each assignment with live problem details and SLA metrics
      const hydrated: HydratedAssignment[] = await Promise.all(
        assignments.map(async (asgn) => {
          const problem = await db.getProblemCluster(asgn.problem_id);
          if (problem) {
            const slaState = SLAService.computeSLAState(problem);
            return {
              ...asgn,
              sla_state: slaState,
              problem: {
                ...problem,
                sla_state: slaState
              }
            };
          }
          return asgn;
        })
      );

      res.status(200).json({
        data: hydrated
      });
    } catch (err) {
      next(err);
    }
  }
}
