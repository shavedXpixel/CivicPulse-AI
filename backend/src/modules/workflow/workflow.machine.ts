import { ProblemStatus, UserRole, ActionType, UserProfile, ProblemCluster, ERROR_CODES } from '@civicpulse/shared';
import { AppError } from '../../middleware/error.middleware';

export interface TransitionRule {
  from: ProblemStatus;
  to: ProblemStatus;
  allowedRoles: UserRole[];
  allowedActions: ActionType[];
  requiresAssignedOfficer?: boolean;
}

export const CANONICAL_TRANSITIONS: TransitionRule[] = [
  {
    from: ProblemStatus.NEW,
    to: ProblemStatus.TRIAGED,
    allowedRoles: [UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.TRIAGED]
  },
  {
    from: ProblemStatus.TRIAGED,
    to: ProblemStatus.ASSIGNED,
    allowedRoles: [UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.ASSIGNED, ActionType.REASSIGNED]
  },
  {
    from: ProblemStatus.ASSIGNED,
    to: ProblemStatus.IN_PROGRESS,
    allowedRoles: [UserRole.FIELD_OFFICER, UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.STARTED_WORK, ActionType.ACCEPTED],
    requiresAssignedOfficer: true
  },
  {
    from: ProblemStatus.IN_PROGRESS,
    to: ProblemStatus.AWAITING_VERIFICATION,
    allowedRoles: [UserRole.FIELD_OFFICER, UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.VERIFICATION_REQUESTED, ActionType.RESOLUTION_SUBMITTED],
    requiresAssignedOfficer: true
  },
  {
    from: ProblemStatus.AWAITING_VERIFICATION,
    to: ProblemStatus.RESOLVED,
    allowedRoles: [UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.RESOLVED, ActionType.RESOLUTION_ACCEPTED]
  },
  {
    from: ProblemStatus.AWAITING_VERIFICATION,
    to: ProblemStatus.IN_PROGRESS,
    allowedRoles: [UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.RESOLUTION_REJECTED, ActionType.REOPENED, ActionType.STARTED_WORK]
  },
  {
    from: ProblemStatus.RESOLVED,
    to: ProblemStatus.CLOSED,
    allowedRoles: [UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.CLOSED]
  },
  {
    from: ProblemStatus.CLOSED,
    to: ProblemStatus.REOPENED,
    allowedRoles: [UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.REOPENED]
  },
  {
    from: ProblemStatus.REOPENED,
    to: ProblemStatus.TRIAGED,
    allowedRoles: [UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN],
    allowedActions: [ActionType.TRIAGED]
  }
];

export class WorkflowStateMachine {
  /**
   * Validates whether a lifecycle transition from problem.status to targetStatus is valid,
   * permitted for the actor's role, and authorized for the specific user context.
   */
  public static validateTransition(
    problem: ProblemCluster,
    targetStatus: ProblemStatus,
    action: ActionType,
    user: UserProfile,
    evidenceSubmitterIds?: string[]
  ): TransitionRule {
    // 1. Citizen is strictly forbidden from government lifecycle operations
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not permitted to execute government workflow transitions.'
      });
    }

    // 2. Find rule matching source and destination
    const rule = CANONICAL_TRANSITIONS.find(
      (t) => t.from === problem.status && t.to === targetStatus
    );

    if (!rule) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Invalid state transition from ${problem.status} to ${targetStatus}. Allowed transitions are strictly defined by canonical lifecycle.`
      });
    }

    // 3. Verify action is allowed for this transition
    if (!rule.allowedActions.includes(action)) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Action ${action} is not valid for transitioning from ${problem.status} to ${targetStatus}. Allowed actions: ${rule.allowedActions.join(', ')}.`
      });
    }

    // 4. Verify role is authorized for this transition
    if (!rule.allowedRoles.includes(user.role)) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: `Role ${user.role} is not authorized to transition problem from ${problem.status} to ${targetStatus}.`
      });
    }

    // 5. Scoping rule for FIELD_OFFICER:
    // "may view operational problems only when assigned_to === user.id"
    // "may act only on explicitly assigned problems"
    // "must not gain access merely because a problem belongs to their department"
    if (user.role === UserRole.FIELD_OFFICER) {
      const userIds = new Set<string>();
      if (user.id) userIds.add(user.id);
      if ((user as any).legacy_firebase_uid) userIds.add((user as any).legacy_firebase_uid);
      if ((user as any).auth_user_id) userIds.add((user as any).auth_user_id);

      if (!problem.assigned_to || !userIds.has(problem.assigned_to)) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Field officer ${user.id} can only act on explicitly assigned problems (assigned_to === user.id).`
        });
      }
    }

    // 6. Scoping rule for DEPARTMENT_OFFICER:
    // Must belong to authorized department scope (WATCO)
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer from ${user.department_id} cannot modify problem assigned to ${problem.department_id}.`
        });
      }
    }

    // 7. Four-Eyes Control: An actor cannot approve/resolve work if assigned or if they submitted resolution evidence
    if (targetStatus === ProblemStatus.RESOLVED || action === ActionType.RESOLVED || action === ActionType.RESOLUTION_ACCEPTED) {
      const userIds = new Set<string>();
      if (user.id) userIds.add(user.id);
      if ((user as any).legacy_firebase_uid) userIds.add((user as any).legacy_firebase_uid);
      if ((user as any).auth_user_id) userIds.add((user as any).auth_user_id);

      if (problem.assigned_to && userIds.has(problem.assigned_to)) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Self-approval is strictly forbidden. Assigned officer cannot approve resolution.'
        });
      }

      if (evidenceSubmitterIds && evidenceSubmitterIds.some((submitterId) => userIds.has(submitterId))) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Self-approval is strictly forbidden. Evidence submitter cannot approve resolution.'
        });
      }
    }

    return rule;
  }

  /**
   * Helper to check if a transition is valid without throwing
   */
  public static isValidTransition(from: ProblemStatus, to: ProblemStatus): boolean {
    return CANONICAL_TRANSITIONS.some((t) => t.from === from && t.to === to);
  }
}
