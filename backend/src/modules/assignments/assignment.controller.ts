import { Request, Response, NextFunction } from 'express';
import { getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserRole, Assignment, AssignmentStatus, ProblemStatus } from '@civicpulse/shared';
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
        if (req.query.assigned_to && req.query.assigned_to !== 'me' && req.query.assigned_to !== user.id) {
          return next(
            new AppError({
              statusCode: 403,
              code: ERROR_CODES.FORBIDDEN,
              message: "Field officer cannot retrieve another officer's assignments."
            })
          );
        }
        // Field officer only ever sees assignments explicitly assigned to them
        filter.assigned_to = user.id;
      } else if (user.role === UserRole.DEPARTMENT_OFFICER) {
        if (req.query.department_id && req.query.department_id !== user.department_id) {
          return next(
            new AppError({
              statusCode: 403,
              code: ERROR_CODES.FORBIDDEN,
              message: "Department officer cannot retrieve another department's assignments."
            })
          );
        }
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

      // For Field Officers, the queue represents active assigned work orders.
      // Enforce:
      // 1. Only active assignments (ASSIGNED or ACCEPTED), unless a specific status is explicitly requested in query
      // 2. The underlying problem must currently be assigned to this field officer (not reassigned or unassigned)
      // 3. The underlying problem must be in an active operational state (not CLOSED or RESOLVED)
      // 4. Strict deduplication by problem_id: At most ONE active assignment per problem is returned
      let activeList = hydrated;

      if (user.role === UserRole.FIELD_OFFICER && !req.query.status) {
        const userIds = new Set<string>();
        if (user.id) userIds.add(user.id);
        if ((user as any).legacy_firebase_uid) userIds.add((user as any).legacy_firebase_uid);
        if ((user as any).auth_user_id) userIds.add((user as any).auth_user_id);

        activeList = activeList.filter((asgn) => {
          // Must have active assignment status
          if (asgn.status !== AssignmentStatus.ASSIGNED && asgn.status !== AssignmentStatus.ACCEPTED) {
            return false;
          }

          // If hydrated problem exists, verify current ownership and active status
          if (asgn.problem) {
            // If problem is no longer assigned to this officer, this assignment is historical
            if (!asgn.problem.assigned_to || !userIds.has(asgn.problem.assigned_to)) {
              return false;
            }

            // Only operational active states (ASSIGNED, IN_PROGRESS, AWAITING_VERIFICATION) appear as active work orders.
            // CLOSED, RESOLVED, NEW, and REOPENED (awaiting re-triage) are not active field work orders.
            const activeOperationalStates = [
              ProblemStatus.ASSIGNED,
              ProblemStatus.IN_PROGRESS,
              ProblemStatus.AWAITING_VERIFICATION
            ];
            if (!activeOperationalStates.includes(asgn.problem.status)) {
              return false;
            }
          }
          return true;
        });
      }

      // Deduplicate by problem_id: ensure at most ONE active assignment per problem is returned
      const deduplicatedMap = new Map<string, HydratedAssignment>();
      for (const asgn of activeList) {
        const pid = asgn.problem_id;
        if (!pid) continue;
        if (!deduplicatedMap.has(pid)) {
          deduplicatedMap.set(pid, asgn);
        } else {
          // Keep the newer active record
          const existing = deduplicatedMap.get(pid)!;
          const existingTime = new Date(existing.created_at).getTime();
          const asgnTime = new Date(asgn.created_at).getTime();
          if (asgnTime > existingTime) {
            deduplicatedMap.set(pid, asgn);
          }
        }
      }

      const finalAssignments = Array.from(deduplicatedMap.values());

      res.status(200).json({
        data: finalAssignments
      });
    } catch (err) {
      next(err);
    }
  }
}
