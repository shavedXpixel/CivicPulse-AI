import {
  UserProfile,
  UserRole,
  ProblemCluster,
  ProblemStatus,
  Assignment,
  AssignmentPriority,
  AssignmentStatus,
  ProblemAction,
  ActionType,
  UserStatus,
  ERROR_CODES
} from '@civicpulse/shared';
import { getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';
import { WorkflowStateMachine, CANONICAL_TRANSITIONS } from './workflow.machine';
import { SLAService } from './sla.service';

export interface AssignProblemInput {
  department_id: string;
  assigned_to?: string;
  priority?: AssignmentPriority;
  due_at?: string;
  notes?: string;
  expected_status?: ProblemStatus;
}

export interface ProblemActionInput {
  action: ActionType;
  note?: string;
  target_officer_id?: string;
  metadata?: Record<string, unknown>;
  actor_id?: string;
  actor_role?: string;
  expected_status?: ProblemStatus;
}

export class WorkflowService {
  /**
   * Authoritatively assigns or reassigns a problem to a department and optional officer.
   * Atomic mutation: updates problem department, assigned officer, status to ASSIGNED,
   * creates an Assignment record, ends prior active assignments, and appends an immutable ProblemAction audit entry.
   */
  public static async assignProblem(
    user: UserProfile,
    problemId: string,
    input: AssignProblemInput
  ): Promise<{ problem: ProblemCluster; assignment: Assignment; action: ProblemAction }> {
    // 1. Citizen and Field Officer cannot assign problems
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not permitted to perform department assignments.'
      });
    }

    if (user.role === UserRole.FIELD_OFFICER) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Field officers cannot assign or reassign problems.'
      });
    }

    // 2. Enforce single authoritative operational department: WATCO
    // CivicPulse AI operates exclusively with WATCO (Water Corporation of Odisha).
    if (input.department_id !== 'WATCO') {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `Department '${input.department_id}' is not supported. CivicPulse operates exclusively with WATCO (Water Corporation of Odisha).`
      });
    }

    // 3. Department Officer may only assign within their authorized department
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (user.department_id && user.department_id !== input.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer from ${user.department_id} cannot assign problems to ${input.department_id}.`
        });
      }
    }

    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    // Concurrency check: If expected_status provided, verify before proceeding
    if (input.expected_status && problem.status !== input.expected_status) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: `Assignment concurrency conflict: expected problem status is ${input.expected_status}, but current status is ${problem.status}.`
      });
    }

    // If department officer, problem must belong to their department OR be unassigned
    if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      if (problem.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Cannot reassign problem belonging to ${problem.department_id}.`
        });
      }
    }

    // 3b. Strict Independent Backend Enforcement for Field Officer Assignment
    if (input.assigned_to) {
      const officer = await db.getUser(input.assigned_to);
      if (!officer) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: `Assigned officer '${input.assigned_to}' not found.`
        });
      }

      // Check role: strictly ONLY FIELD_OFFICER
      if (officer.role !== UserRole.FIELD_OFFICER) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Cannot assign incident to user with role '${officer.role}'. Only FIELD_OFFICER users can be assigned field work.`
        });
      }

      // Check account status: must be active
      if (officer.status && officer.status !== UserStatus.ACTIVE) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Cannot assign incident to officer '${officer.display_name || officer.id}' because their account status is '${officer.status}'.`
        });
      }

      // Check department: must match the target operational department
      const targetDeptId = input.department_id || problem.department_id;
      if (
        officer.department_id &&
        targetDeptId &&
        officer.department_id !== targetDeptId &&
        !(env.DEMO_MODE && officer.id === 'usr_field_drainage' && targetDeptId === 'WATCO')
      ) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Officer '${officer.display_name || officer.id}' belongs to department '${officer.department_id}', but incident department is '${targetDeptId}'.`
        });
      }

      // In CivicPulse, operational department must be WATCO
      if (targetDeptId && targetDeptId !== 'WATCO' && !env.DEMO_MODE) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Department '${targetDeptId}' is not authorized. CivicPulse operational department is WATCO.`
        });
      }

      // Authoritatively use the canonical public.users.id UUID if available
      input.assigned_to = (officer as any).canonical_id || officer.id;
    }

    // 4. Determine target status & validate transition
    let targetStatus = ProblemStatus.ASSIGNED;
    let actionType = ActionType.ASSIGNED;

    if (problem.status === ProblemStatus.TRIAGED) {
      targetStatus = ProblemStatus.ASSIGNED;
      actionType = ActionType.ASSIGNED;
      WorkflowStateMachine.validateTransition(problem, targetStatus, actionType, user);
    } else if (problem.status === ProblemStatus.ASSIGNED) {
      targetStatus = ProblemStatus.ASSIGNED;
      actionType = ActionType.REASSIGNED;
    } else if (problem.status === ProblemStatus.IN_PROGRESS) {
      // Reassigning an officer during active investigation maintains IN_PROGRESS state
      targetStatus = ProblemStatus.IN_PROGRESS;
      actionType = ActionType.REASSIGNED;
    } else {
      // For any other status (e.g. REOPENED, NEW), validate against canonical state machine (rejects invalid jumps)
      WorkflowStateMachine.validateTransition(problem, targetStatus, actionType, user);
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // 5. Idempotency & Duplicate Prevention Guard:
    // Check existing active assignments for this problem
    const existingAssignments = await db.getAssignments(problemId);
    const activeAssignments = existingAssignments.filter(
      (a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.ACCEPTED
    );

    const matchingActiveAssignment = activeAssignments.find((a) => {
      const sameDept = a.department_id === input.department_id;
      const sameOfficer = (a.assigned_to || null) === (input.assigned_to || null);
      return sameDept && sameOfficer;
    });

    if (matchingActiveAssignment) {
      // Problem is already actively assigned to this department & officer.
      // Return existing assignment idempotently without creating a second active record.
      const liveSla = SLAService.computeSLAState(problem);
      return {
        problem: {
          ...problem,
          sla_state: liveSla
        },
        assignment: {
          ...matchingActiveAssignment,
          sla_state: liveSla
        },
        action: {
          id: `act_${Date.now()}_noop`,
          problem_id: problem.id,
          actor_id: user.id,
          actor_role: user.role,
          action_type: actionType,
          previous_state: problem.status,
          new_state: problem.status,
          target_department_id: input.department_id,
          target_officer_id: input.assigned_to,
          note: `Assignment confirmed for ${input.department_id}${
            input.assigned_to ? ` (Officer: ${input.assigned_to})` : ''
          }. Active assignment preserved.`,
          created_at: nowIso
        }
      };
    }

    // Collect superseded active assignments so they are atomically ended/cancelled
    const supersededAssignmentIds = activeAssignments.map((a) => a.id);

    // 6. Calculate deterministic SLA
    const targetHours = SLAService.getTargetHours(problem.impact_level);
    const dueAtIso = input.due_at || new Date(now.getTime() + targetHours * 3600000).toISOString();

    const assignmentId = `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const assignment: Assignment = {
      id: assignmentId,
      problem_id: problem.id,
      department_id: input.department_id,
      previous_department_id: problem.department_id,
      assigned_to: input.assigned_to,
      assigned_by: user.id,
      priority: input.priority || AssignmentPriority.HIGH,
      status: AssignmentStatus.ASSIGNED,
      assigned_at: nowIso,
      due_at: dueAtIso,
      notes: input.notes,
      created_at: nowIso,
      updated_at: nowIso
    };

    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const action: ProblemAction = {
      id: actionId,
      problem_id: problem.id,
      actor_id: user.id,
      actor_role: user.role,
      action_type: actionType,
      previous_state: problem.status,
      new_state: targetStatus,
      target_department_id: input.department_id,
      target_officer_id: input.assigned_to,
      note:
        input.notes ||
        `Problem assigned to ${input.department_id}${
          input.assigned_to ? ` (Officer: ${input.assigned_to})` : ''
        } with ${targetHours}h SLA.`,
      created_at: nowIso
    };

    // 7. Execute atomic assignment mutation with precondition check and superseded IDs
    const result = await db.atomicAssignProblem(
      problem.id,
      assignment,
      targetStatus,
      action,
      problem.status,
      supersededAssignmentIds
    );

    // Compute live SLA on returned problem
    result.problem.sla_state = SLAService.computeSLAState(result.problem);
    result.assignment.sla_state = result.problem.sla_state;

    return result;
  }

  /**
   * Authoritatively transitions problem status adhering to canonical state machine.
   * Validates current persisted state immediately before mutation to prevent stale concurrency.
   * Records exactly one immutable ProblemAction audit entry.
   */
  public static async transitionStatus(
    user: UserProfile,
    problemId: string,
    targetStatus: ProblemStatus,
    note?: string,
    requestedAction?: ActionType,
    expectedStatus?: ProblemStatus
  ): Promise<{ problem: ProblemCluster; action: ProblemAction }> {
    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    // Optimistic Concurrency Precondition Check
    if (expectedStatus && problem.status !== expectedStatus) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: `Stale state transition conflict: expected current state is ${expectedStatus}, but persisted state is ${problem.status}.`
      });
    }

    // Resolve action type for this transition if not explicitly provided
    let actionType = requestedAction;
    if (!actionType) {
      const matchingTransition = CANONICAL_TRANSITIONS.find(
        (t) => t.from === problem.status && t.to === targetStatus
      );
      if (!matchingTransition) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.INVALID_STATE_TRANSITION,
          message: `Invalid state transition from ${problem.status} to ${targetStatus}.`
        });
      }
      actionType = matchingTransition.allowedActions[0];
    }

    // If targetStatus is RESOLVED, retrieve evidence submitters for Four-Eyes check
    let evidenceSubmitterIds: string[] = [];
    if (targetStatus === ProblemStatus.RESOLVED || actionType === ActionType.RESOLVED || actionType === ActionType.RESOLUTION_ACCEPTED) {
      const evidenceList = await db.getResolutionEvidence(problem.id);
      evidenceSubmitterIds = evidenceList.map((e) => e.submitted_by).filter(Boolean) as string[];
    }

    // Validate state machine rules, actor permissions, and Four-Eyes controls
    WorkflowStateMachine.validateTransition(problem, targetStatus, actionType, user, evidenceSubmitterIds);

    const now = new Date();
    const nowIso = now.toISOString();

    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const action: ProblemAction = {
      id: actionId,
      problem_id: problem.id,
      actor_id: user.id,
      actor_role: user.role,
      action_type: actionType,
      previous_state: problem.status,
      new_state: targetStatus,
      target_department_id: problem.department_id,
      target_officer_id: problem.assigned_to,
      note: note || `Status transitioned from ${problem.status} to ${targetStatus}.`,
      created_at: nowIso
    };

    const updates: Partial<ProblemCluster> = {};
    if (targetStatus === ProblemStatus.RESOLVED) {
      updates.resolved_at = nowIso;
    } else if (targetStatus === ProblemStatus.CLOSED) {
      updates.closed_at = nowIso;
    } else if (targetStatus === ProblemStatus.REOPENED) {
      updates.assigned_to = null as any;
      updates.assigned_at = null as any;
    }

    // Recompute SLA state incorporating resolution time and historical breach flag
    const simulatedProblem: ProblemCluster = {
      ...problem,
      ...updates,
      status: targetStatus
    };
    updates.sla_state = SLAService.computeSLAState(simulatedProblem, now.getTime());

    // Execute atomic transition with pre-mutation verification
    const result = await db.atomicTransitionStatus(
      problem.id,
      expectedStatus || problem.status,
      targetStatus,
      action,
      updates
    );

    result.problem.sla_state = updates.sla_state;
    return result;
  }

  /**
   * Records an official authorized officer action on a problem.
   * If the action corresponds to a canonical status transition, invokes transitionStatus.
   * Otherwise records an informational action (e.g. REQUESTED_INFO, ESCALATED, VERIFICATION_REQUESTED).
   */
  public static async recordAction(
    user: UserProfile,
    problemId: string,
    input: ProblemActionInput
  ): Promise<{ action: ProblemAction; problem?: ProblemCluster }> {
    // 1. Citizen is forbidden from recording official actions
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not permitted to record official actions.'
      });
    }

    // 2. Strict Role Permissions: Field Officer is prohibited from supervisory actions
    if (user.role === UserRole.FIELD_OFFICER) {
      const forbiddenForField = [
        ActionType.CLOSED,
        ActionType.REOPENED,
        ActionType.TRIAGED,
        ActionType.ASSIGNED,
        ActionType.REASSIGNED,
        ActionType.RESOLVED,
        ActionType.RESOLUTION_ACCEPTED,
        ActionType.RESOLUTION_REJECTED
      ];
      if (forbiddenForField.includes(input.action)) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Field officers are not authorized to perform action ${input.action}.`
        });
      }
    }

    // Evidence submission must go through the dedicated evidence endpoint
    if (input.action === ActionType.RESOLUTION_SUBMITTED) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Resolution evidence must be submitted through the official evidence submission endpoint (POST /api/v1/problems/:id/evidence).'
      });
    }

    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    // Optimistic Concurrency Precondition Check
    if (input.expected_status && problem.status !== input.expected_status) {
      throw new AppError({
        statusCode: 409,
        code: ERROR_CODES.CONFLICT,
        message: `Stale action conflict: expected problem status is ${input.expected_status}, but persisted status is ${problem.status}.`
      });
    }

    // 3. Enforce scope: Field Officer must be explicitly assigned
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

    // Department Officer scope: problem must belong to department
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot act on problem belonging to ${problem.department_id}.`
        });
      }
    }

    // 4. Map lifecycle transition actions to target states
    let targetStatus: ProblemStatus | null = null;
    if (input.action === ActionType.TRIAGED && (problem.status === ProblemStatus.NEW || problem.status === ProblemStatus.REOPENED)) {
      targetStatus = ProblemStatus.TRIAGED;
    } else if (
      (input.action === ActionType.STARTED_WORK || input.action === ActionType.ACCEPTED) &&
      problem.status === ProblemStatus.ASSIGNED
    ) {
      targetStatus = ProblemStatus.IN_PROGRESS;
    } else if (
      (input.action === ActionType.RESOLVED || input.action === ActionType.RESOLUTION_ACCEPTED) &&
      problem.status === ProblemStatus.AWAITING_VERIFICATION
    ) {
      targetStatus = ProblemStatus.RESOLVED;
    } else if (
      input.action === ActionType.RESOLUTION_REJECTED &&
      problem.status === ProblemStatus.AWAITING_VERIFICATION
    ) {
      targetStatus = ProblemStatus.IN_PROGRESS;
    } else if (input.action === ActionType.CLOSED && problem.status === ProblemStatus.RESOLVED) {
      targetStatus = ProblemStatus.CLOSED;
    } else if (input.action === ActionType.REOPENED && problem.status === ProblemStatus.CLOSED) {
      targetStatus = ProblemStatus.REOPENED;
    }

    if (targetStatus) {
      const transitionResult = await this.transitionStatus(
        user,
        problem.id,
        targetStatus,
        input.note,
        input.action,
        input.expected_status
      );
      return { action: transitionResult.action, problem: transitionResult.problem };
    }

    // If the action is a lifecycle action but the current status doesn't match, validate against state machine
    const lifecycleActions = [
      ActionType.TRIAGED,
      ActionType.STARTED_WORK,
      ActionType.ACCEPTED,
      ActionType.RESOLVED,
      ActionType.RESOLUTION_ACCEPTED,
      ActionType.RESOLUTION_REJECTED,
      ActionType.CLOSED,
      ActionType.REOPENED
    ];
    if (lifecycleActions.includes(input.action)) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Action ${input.action} is not valid for problem in status ${problem.status}.`
      });
    }

    // 5. Non-transition action (e.g. REQUESTED_INFO, ESCALATED, VERIFICATION_REQUESTED, VERIFICATION_COMPLETED): persist immutable ProblemAction record
    const nowIso = new Date().toISOString();
    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const isSystemAttribution = input.actor_id === 'civicpulse_ai_advisory' && input.actor_role === 'SYSTEM';

    const action: ProblemAction = {
      id: actionId,
      problem_id: problem.id,
      actor_id: isSystemAttribution ? 'civicpulse_ai_advisory' : user.id,
      actor_role: isSystemAttribution ? 'SYSTEM' : user.role,
      action_type: input.action,
      previous_state: problem.status,
      new_state: problem.status,
      target_department_id: problem.department_id,
      target_officer_id: input.target_officer_id || problem.assigned_to,
      note: input.note,
      metadata: input.metadata,
      created_at: nowIso
    };

    const savedAction = await db.createAction(action);
    return { action: savedAction, problem };
  }

  /**
   * Retrieves assignments for a problem with server-side authorization scoping.
   */
  public static async getProblemAssignments(
    user: UserProfile,
    problemId: string
  ): Promise<Assignment[]> {
    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    // Scoping check for Field Officer
    if (user.role === UserRole.FIELD_OFFICER) {
      if (problem.assigned_to !== user.id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Field officers may only view assignments for problems assigned to them.'
        });
      }
    }

    // Scoping check for Department Officer
    if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      if (problem.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot view assignments for other department (${problem.department_id}).`
        });
      }
    }

    const assignments = await db.getAssignments(problemId);
    const liveSla = SLAService.computeSLAState(problem);

    return assignments.map((a) => ({
      ...a,
      sla_state: liveSla
    }));
  }

  /**
   * Retrieves audit actions history for a problem with server-side authorization scoping.
   */
  public static async getProblemActions(
    user: UserProfile,
    problemId: string
  ): Promise<ProblemAction[]> {
    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    // Scoping check for Field Officer
    if (user.role === UserRole.FIELD_OFFICER) {
      if (problem.assigned_to !== user.id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Field officers may only view action timelines for problems assigned to them.'
        });
      }
    }

    // Scoping check for Department Officer
    if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      if (problem.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot view action timelines for ${problem.department_id}.`
        });
      }
    }

    return db.getActions(problemId);
  }
}
