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
  ERROR_CODES
} from '@civicpulse/shared';
import { getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowStateMachine, CANONICAL_TRANSITIONS } from './workflow.machine';
import { SLAService } from './sla.service';

export interface AssignProblemInput {
  department_id: string;
  assigned_to?: string;
  priority?: AssignmentPriority;
  due_at?: string;
  notes?: string;
}

export interface ProblemActionInput {
  action: ActionType;
  note?: string;
  target_officer_id?: string;
  metadata?: Record<string, unknown>;
  actor_id?: string;
  actor_role?: string;
}

export class WorkflowService {
  /**
   * Authoritatively assigns or reassigns a problem to a department and optional officer.
   * Atomic mutation: updates problem department, assigned officer, status to ASSIGNED,
   * creates an Assignment record, and appends an immutable ProblemAction audit entry.
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

    // 2. Department Officer may only assign within their authorized department
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

    // If department officer, problem must belong to their department OR be NEW/unassigned
    if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      if (problem.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Cannot reassign problem belonging to ${problem.department_id}.`
        });
      }
    }

    // 3. Determine target status & validate transition
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
      // For any other status (e.g. NEW), validate against canonical state machine (rejects invalid)
      WorkflowStateMachine.validateTransition(problem, targetStatus, actionType, user);
    }

    // 4. Calculate deterministic SLA
    const now = new Date();
    const nowIso = now.toISOString();
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

    // 5. Execute atomic assignment mutation with precondition check
    const result = await db.atomicAssignProblem(problem.id, assignment, targetStatus, action, problem.status);

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
    requestedAction?: ActionType
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

    // Validate state machine rules and actor permissions
    WorkflowStateMachine.validateTransition(problem, targetStatus, actionType, user);

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
      problem.status,
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
   * Otherwise records an informational action (e.g. REQUESTED_INFO, ESCALATED).
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

    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    // 2. Enforce scope: Field Officer must be explicitly assigned
    if (user.role === UserRole.FIELD_OFFICER) {
      if (!problem.assigned_to || problem.assigned_to !== user.id) {
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

    // 3. If action triggers a canonical lifecycle transition, route through transitionStatus
    let targetStatus: ProblemStatus | null = null;
    if (input.action === ActionType.TRIAGED && problem.status === ProblemStatus.NEW) {
      targetStatus = ProblemStatus.TRIAGED;
    } else if (
      (input.action === ActionType.STARTED_WORK || input.action === ActionType.ACCEPTED) &&
      problem.status === ProblemStatus.ASSIGNED
    ) {
      targetStatus = ProblemStatus.IN_PROGRESS;
    } else if (
      (input.action === ActionType.VERIFICATION_REQUESTED ||
        input.action === ActionType.RESOLUTION_SUBMITTED) &&
      problem.status === ProblemStatus.IN_PROGRESS
    ) {
      targetStatus = ProblemStatus.AWAITING_VERIFICATION;
    } else if (input.action === ActionType.RESOLVED && problem.status === ProblemStatus.AWAITING_VERIFICATION) {
      targetStatus = ProblemStatus.RESOLVED;
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
        input.action
      );
      return { action: transitionResult.action, problem: transitionResult.problem };
    }

    // 4. Non-transition action: persist immutable ProblemAction record
    const nowIso = new Date().toISOString();
    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const action: ProblemAction = {
      id: actionId,
      problem_id: problem.id,
      actor_id: input.actor_id || user.id,
      actor_role: input.actor_role || user.role,
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
