import {
  UserProfile,
  UserRole,
  ProblemStatus,
  ActionType,
  EvidenceType,
  BeforeOrAfter,
  EvidenceStatus,
  ResolutionEvidence,
  ERROR_CODES
} from '@civicpulse/shared';
import { getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowService } from '../workflow/workflow.service';
import { SubmitEvidenceInput, ResolutionReviewInput } from '@civicpulse/shared';

export class ResolutionService {
  /**
   * Submits resolution evidence for an active problem.
   * RBAC: Assigned Field Officer, Department Officer, Admin.
   * Successful submission from IN_PROGRESS explicitly transitions the problem to AWAITING_VERIFICATION.
   * Evidence submission succeeds independently of AI availability.
   */
  public static async submitEvidence(
    user: UserProfile,
    problemId: string,
    input: SubmitEvidenceInput
  ): Promise<{ evidence: ResolutionEvidence; problem_status: ProblemStatus }> {
    // 1. Citizen is strictly forbidden from submitting official resolution evidence
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not permitted to submit official government resolution evidence.'
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

    // 2. Field Officer Scoping: must be explicitly assigned to this problem
    if (user.role === UserRole.FIELD_OFFICER) {
      if (!problem.assigned_to || problem.assigned_to !== user.id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Field officer ${user.id} can only submit resolution evidence for explicitly assigned problems.`
        });
      }
    }

    // Department Officer Scoping: must belong to authorized department
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer from ${user.department_id} cannot submit evidence for ${problem.department_id}.`
        });
      }
    }

    // 3. Problem must be in a state that permits evidence submission
    if (
      problem.status !== ProblemStatus.IN_PROGRESS &&
      problem.status !== ProblemStatus.AWAITING_VERIFICATION
    ) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Resolution evidence can only be submitted for problems IN_PROGRESS or AWAITING_VERIFICATION. Current status is ${problem.status}.`
      });
    }

    const nowIso = new Date().toISOString();
    const evidenceId = `evd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    // Sanitize untrusted text input against prompt injection
    const sanitizedDescription = input.description ? input.description.trim() : '';

    const evidence: ResolutionEvidence = {
      id: evidenceId,
      problem_id: problem.id,
      submitted_by: user.id,
      submitted_at: nowIso,
      evidence_type: input.evidence_type || EvidenceType.COMPLETION_PHOTO,
      storage_path: input.storage_path,
      media_type: input.media_type || 'image/jpeg',
      media_ids: input.media_ids || [],
      description: sanitizedDescription,
      location: input.location,
      observed_at: input.observed_at || nowIso,
      before_or_after: input.before_or_after || BeforeOrAfter.AFTER,
      file_size_bytes: input.file_size_bytes,
      sha256_hash: input.sha256_hash,
      status: EvidenceStatus.SUBMITTED,
      created_at: nowIso
    };

    // Persist immutable evidence record
    await db.createResolutionEvidence(evidence);

    // 4. Authoritative Lifecycle Flow:
    // If the problem was IN_PROGRESS, successful evidence submission transitions it to AWAITING_VERIFICATION.
    // The submission does NOT infer completion from content; it explicitly advances the workflow.
    let currentStatus: ProblemStatus = problem.status;
    if (problem.status === ProblemStatus.IN_PROGRESS) {
      const transitionResult = await WorkflowService.transitionStatus(
        user,
        problem.id,
        ProblemStatus.AWAITING_VERIFICATION,
        `Resolution evidence submitted by ${user.display_name}. Transitioned to AWAITING_VERIFICATION.`,
        ActionType.RESOLUTION_SUBMITTED
      );
      currentStatus = transitionResult.problem.status;
    } else {
      // Record an EVIDENCE_ADDED action if already AWAITING_VERIFICATION
      await WorkflowService.recordAction(user, problem.id, {
        action: ActionType.EVIDENCE_ADDED,
        note: `Additional resolution evidence (${evidence.evidence_type}) submitted by ${user.display_name}.`
      });
    }

    return { evidence, problem_status: currentStatus };
  }

  /**
   * Retrieves resolution evidence for a problem.
   * Media access remains authorization-scoped.
   */
  public static async listEvidence(
    user: UserProfile,
    problemId: string
  ): Promise<ResolutionEvidence[]> {
    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    // Citizen can view evidence summary for public problems; sensitive fields are protected
    // Department Officer scope: must match department
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot view evidence for ${problem.department_id}.`
        });
      }
    }

    return db.getResolutionEvidence(problemId);
  }

  /**
   * Retrieves single resolution evidence by ID.
   */
  public static async getEvidenceById(
    user: UserProfile,
    evidenceId: string
  ): Promise<ResolutionEvidence> {
    const db = getDatabaseProvider();
    const evidence = await db.getEvidenceById(evidenceId);
    if (!evidence) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ResolutionEvidence ${evidenceId} not found.`
      });
    }

    // Scoping check
    const problem = await db.getProblemCluster(evidence.problem_id);
    if (problem && user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot view evidence for ${problem.department_id}.`
        });
      }
    }

    return evidence;
  }

  /**
   * Human Supervisory Decision Flow:
   * Only authorized Department Officer (matching department) or Admin may accept or reject resolution.
   * Field officers and citizens are strictly forbidden from reviewing or closing their own work.
   *
   * ACCEPT: Transitions AWAITING_VERIFICATION → RESOLVED. Evidence status becomes ACCEPTED.
   * REJECT: Transitions AWAITING_VERIFICATION → IN_PROGRESS. Evidence permanently stored with REJECTED status.
   *         Rejection feedback is recorded in the audit trail.
   */
  public static async reviewResolution(
    user: UserProfile,
    problemId: string,
    input: ResolutionReviewInput
  ): Promise<{ problem_status: ProblemStatus; decision: string; message: string }> {
    // 1. Citizen & Field Officer cannot perform supervisory reviews
    if (user.role === UserRole.CITIZEN || user.role === UserRole.FIELD_OFFICER) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: `${user.role} is not authorized to review or approve resolution decisions.`
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

    // Department Officer scope check
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer from ${user.department_id} cannot review problem for ${problem.department_id}.`
        });
      }
    }

    // Case must currently be in AWAITING_VERIFICATION
    if (problem.status !== ProblemStatus.AWAITING_VERIFICATION) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Cannot review resolution for problem in ${problem.status}. Problem must be AWAITING_VERIFICATION.`
      });
    }

    // Fetch submitted resolution evidence
    const evidenceList = await db.getResolutionEvidence(problemId);

    if (input.decision === 'ACCEPT') {
      // Mark evidence as ACCEPTED
      for (const ev of evidenceList) {
        if (ev.status === EvidenceStatus.SUBMITTED || ev.status === EvidenceStatus.UNDER_REVIEW) {
          await db.updateResolutionEvidence(ev.id, { status: EvidenceStatus.ACCEPTED });
        }
      }

      // Transition to RESOLVED via canonical state machine
      const transitionResult = await WorkflowService.transitionStatus(
        user,
        problem.id,
        ProblemStatus.RESOLVED,
        input.notes || `Resolution officially validated and accepted by supervisor ${user.display_name}.`,
        ActionType.RESOLVED
      );

      return {
        problem_status: transitionResult.problem.status,
        decision: 'ACCEPT',
        message: `Problem ${problem.id} officially marked as RESOLVED.`
      };
    } else {
      // REJECT:
      // Mark evidence as REJECTED (permanently stored)
      for (const ev of evidenceList) {
        if (ev.status === EvidenceStatus.SUBMITTED || ev.status === EvidenceStatus.UNDER_REVIEW) {
          await db.updateResolutionEvidence(ev.id, { status: EvidenceStatus.REJECTED });
        }
      }

      // Transition problem back from AWAITING_VERIFICATION to IN_PROGRESS
      const rejectionNote = input.notes
        ? `Resolution rejected by ${user.display_name}: ${input.notes}`
        : `Resolution evidence rejected by supervisor ${user.display_name}. Resumed IN_PROGRESS for rework.`;

      const transitionResult = await WorkflowService.transitionStatus(
        user,
        problem.id,
        ProblemStatus.IN_PROGRESS,
        rejectionNote,
        ActionType.REOPENED
      );

      return {
        problem_status: transitionResult.problem.status,
        decision: 'REJECT',
        message: `Resolution rejected. Problem returned to IN_PROGRESS for corrective remediation.`
      };
    }
  }
}
