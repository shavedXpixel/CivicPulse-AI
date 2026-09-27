import {
  UserProfile,
  UserRole,
  ProblemStatus,
  ActionType,
  EvidenceType,
  BeforeOrAfter,
  EvidenceStatus,
  ResolutionEvidence,
  ProblemAction,
  AssignmentStatus,
  ERROR_CODES,
  MAX_MEDIA_FILE_SIZE_BYTES,
  RegisterMediaInput,
  RegisterMediaResponse,
  ProblemCluster,
  Assignment,
  SignalMediaItem
} from '@civicpulse/shared';
import { getDatabaseProvider, getStorageProvider } from '../../providers';
import { IDatabaseProvider } from '../../providers/database/database.interface';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowService } from '../workflow/workflow.service';
import { SubmitEvidenceInput, ResolutionReviewInput } from '@civicpulse/shared';
import { env } from '../../config/env';

export class ResolutionService {
  private static async isFieldOfficerAssigned(
    db: IDatabaseProvider,
    user: UserProfile,
    problem: ProblemCluster
  ): Promise<boolean> {
    const userIds = new Set<string>();
    if (user.id) userIds.add(user.id);
    if ((user as any).legacy_firebase_uid) userIds.add((user as any).legacy_firebase_uid);
    if ((user as any).auth_user_id) userIds.add((user as any).auth_user_id);

    if (user.id && (!((user as any).legacy_firebase_uid) || !((user as any).auth_user_id))) {
      try {
        const u = await db.getUser(user.id);
        if (u) {
          if (u.id) userIds.add(u.id);
          if ((u as any).legacy_firebase_uid) userIds.add((u as any).legacy_firebase_uid);
          if ((u as any).auth_user_id) userIds.add((u as any).auth_user_id);
        }
      } catch {
        // Fallback to in-memory identifiers
      }
    }

    if (problem.assigned_to && userIds.has(problem.assigned_to)) {
      return true;
    }

    const assignments = await db.getAssignments(problem.id);
    return assignments.some(
      (a: Assignment) => !!a.assigned_to && userIds.has(a.assigned_to) && a.status !== AssignmentStatus.CANCELLED
    );
  }
  /**
   * Registers resolution evidence media and returns a secure presigned upload URL.
   * RBAC: Assigned Field Officer, Department Officer (matching dept), or Admin. Citizens receive 403.
   */
  public static async registerEvidenceMedia(
    user: UserProfile,
    problemId: string,
    input: RegisterMediaInput
  ): Promise<RegisterMediaResponse> {
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not permitted to register resolution evidence media.'
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

    // Field Officer Scoping: must be explicitly assigned
    if (user.role === UserRole.FIELD_OFFICER) {
      const isAssigned = await ResolutionService.isFieldOfficerAssigned(db, user, problem);
      if (!isAssigned) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Field officer ${user.id} can only upload resolution evidence for explicitly assigned problems.`
        });
      }
    }

    // Department Officer Scoping: must belong to authorized department
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer from ${user.department_id} cannot upload evidence for ${problem.department_id}.`
        });
      }
    }

    if (input.file_size_bytes > MAX_MEDIA_FILE_SIZE_BYTES) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: `File size exceeds canonical limit of ${MAX_MEDIA_FILE_SIZE_BYTES} bytes (10MB).`
      });
    }

    const evidenceMediaId = `evd_med_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const storage = getStorageProvider();
    const uploadResult = await storage.getSignedUploadUrl(
      input.file_name,
      input.mime_type,
      input.file_size_bytes,
      {
        problemId: problem.id,
        evidenceId: evidenceMediaId
      }
    );

    let linkedSignalId: string | null = null;
    try {
      const members = await db.getProblemClusterMembers(problem.id);
      if (members && members.length > 0) {
        linkedSignalId = members[0].signal_id;
      }
    } catch {
      // Ignore
    }

    const now = new Date().toISOString();
    const mediaItem: SignalMediaItem = {
      id: evidenceMediaId,
      signal_id: linkedSignalId || (null as any),
      storage_path: uploadResult.storagePath,
      media_type: 'IMAGE',
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      uploaded_by: user.id,
      created_at: now,
      analysis_status: 'NOT_ANALYZED'
    };

    await db.createSignalMedia(mediaItem);

    return {
      media_id: evidenceMediaId,
      upload_url: uploadResult.uploadUrl,
      storage_path: uploadResult.storagePath,
      expires_at: uploadResult.expiresAt
    };
  }

  /**
   * Completes and confirms presigned media upload for problem evidence.
   */
  public static async completeEvidenceMedia(
    user: UserProfile,
    problemId: string,
    mediaId: string
  ): Promise<{ problem_id: string; media_id: string; status: string }> {
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not permitted to complete resolution evidence media.'
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

    if (user.role === UserRole.FIELD_OFFICER) {
      const isAssigned = await ResolutionService.isFieldOfficerAssigned(db, user, problem);
      if (!isAssigned) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Field officer ${user.id} can only complete resolution evidence for explicitly assigned problems.`
        });
      }
    }

    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer from ${user.department_id} cannot complete evidence for ${problem.department_id}.`
        });
      }
    }

    return {
      problem_id: problemId,
      media_id: mediaId,
      status: 'ATTACHED'
    };
  }

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
      const isAssigned = await ResolutionService.isFieldOfficerAssigned(db, user, problem);
      if (!isAssigned) {
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

    // Storage object verification (Requirement 8):
    // Do not allow evidence to claim that an image exists unless upload actually succeeded.
    if (input.evidence_type === EvidenceType.COMPLETION_PHOTO && !input.storage_path) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'A valid uploaded photo is required for Completion Photo evidence.'
      });
    }

    const isProductionRuntime =
      !env.DEMO_MODE &&
      env.STORAGE_PROVIDER === 'r2' &&
      env.DATABASE_PROVIDER !== 'mock';

    if (input.storage_path && isProductionRuntime) {
      const storage = getStorageProvider();
      if (storage.objectExists) {
        const exists = await storage.objectExists(input.storage_path);
        if (!exists) {
          throw new AppError({
            statusCode: 400,
            code: ERROR_CODES.VALIDATION_ERROR,
            message: `Resolution evidence media object not found in storage at "${input.storage_path}". The image must be successfully uploaded before submitting evidence.`
          });
        }
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

    // Authoritative Evidence Provenance Enforcement (Server-Side Trust Boundary):
    // 1. Production baseline defaults to false (or problem.is_demo / DEMO_MODE).
    // 2. Ordinary FIELD_OFFICER cannot arbitrarily spoof provenance (403 if attempting unauthorized override).
    // 3. Authorized ADMIN or SYSTEM_ADMIN can explicitly declare synthetic/test evidence (is_demo: true).
    // 4. Description text (e.g. "[SYNTHETIC...]") is never used to derive provenance.
    const baselineIsDemo = Boolean(problem.is_demo || env.DEMO_MODE);
    let finalIsDemo = baselineIsDemo;

    if (input.is_demo !== undefined) {
      const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SYSTEM_ADMIN;
      if (!isAdmin && input.is_demo !== baselineIsDemo) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Only administrators are authorized to explicitly specify or override evidence demo/synthetic provenance.'
        });
      }
      finalIsDemo = input.is_demo;
    }

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
      is_demo: finalIsDemo,
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

    const rawList = await db.getResolutionEvidence(problemId);
    if (user.role === UserRole.CITIZEN) {
      return rawList.map((ev) => ({
        ...ev,
        submitted_by: 'Municipal Officer',
        sha256_hash: undefined
      }));
    }
    return rawList;
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

    if (user.role === UserRole.CITIZEN) {
      return {
        ...evidence,
        submitted_by: 'Municipal Officer',
        sha256_hash: undefined
      };
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

    // Four-Eyes Control: Supervisor cannot review work they were assigned to or evidence they submitted
    const isAssignedToCaller = Boolean(problem.assigned_to && problem.assigned_to === user.id);
    const submittedEvidenceByCaller = evidenceList.some((ev) => ev.submitted_by === user.id);
    if (isAssignedToCaller || submittedEvidenceByCaller) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Self-approval is strictly forbidden. A different authorized supervisor must review and approve this resolution.'
      });
    }

    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const actionType = input.decision === 'ACCEPT' ? ActionType.RESOLVED : ActionType.REOPENED;
    const targetStatus = input.decision === 'ACCEPT' ? ProblemStatus.RESOLVED : ProblemStatus.IN_PROGRESS;
    const note = input.decision === 'ACCEPT'
      ? (input.notes || `Resolution officially validated and accepted by supervisor ${user.display_name}.`)
      : (input.notes
          ? `Resolution rejected by ${user.display_name}: ${input.notes}`
          : `Resolution evidence rejected by supervisor ${user.display_name}. Resumed IN_PROGRESS for rework.`);

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
      note,
      created_at: now
    };

    const evidenceIds = evidenceList.map((ev) => ev.id);
    const result = await db.atomicReviewResolution(problem.id, input.decision, action, evidenceIds, input.notes);

    return {
      problem_status: result.problem.status,
      decision: input.decision,
      message: input.decision === 'ACCEPT'
        ? `Problem ${problem.id} officially marked as RESOLVED.`
        : `Resolution rejected. Problem returned to IN_PROGRESS for corrective remediation.`
    };
  }
}
