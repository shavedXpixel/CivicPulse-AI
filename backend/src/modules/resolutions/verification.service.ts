import {
  UserProfile,
  UserRole,
  ProblemStatus,
  ActionType,
  BeforeOrAfter,
  EvidenceStatus,
  VerificationResult,
  VerificationResultStatus,
  AIOperationRecord,
  AIOperationType,
  AIOperationStatus,
  ERROR_CODES
} from '@civicpulse/shared';
import { getDatabaseProvider, getVerificationProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { WorkflowService } from '../workflow/workflow.service';

export class VerificationService {
  /**
   * Evaluates submitted resolution evidence using AI advisory verification.
   * RBAC: Assigned Field Officer, Department Officer, Admin. Citizen blocked.
   *
   * CRITICAL INVARIANT:
   * AI verification is an advisory evidence analysis layer.
   * It evaluates submitted proof and returns structured assessments (VERIFIED, INCONCLUSIVE, REJECTED).
   * It NEVER directly updates the canonical problem status to RESOLVED or CLOSED.
   * The problem strictly remains in AWAITING_VERIFICATION pending human review.
   */
  public static async verifyProblemEvidence(
    user: UserProfile,
    problemId: string,
    evidenceId?: string,
    forceReverify: boolean = false
  ): Promise<VerificationResult> {
    // 1. Citizen is strictly forbidden
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not permitted to trigger official resolution verification.'
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

    // 2. Field Officer Scoping: must be assigned
    if (user.role === UserRole.FIELD_OFFICER) {
      if (!problem.assigned_to || problem.assigned_to !== user.id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Field officer ${user.id} can only trigger verification for explicitly assigned problems.`
        });
      }
    }

    // Department Officer Scoping: must match department
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot trigger verification for ${problem.department_id}.`
        });
      }
    }

    // 3. Find the resolution evidence to verify
    const evidenceList = await db.getResolutionEvidence(problemId);
    let targetEvidence = evidenceId
      ? evidenceList.find((e) => e.id === evidenceId)
      : evidenceList.find((e) => e.before_or_after === BeforeOrAfter.AFTER || e.status === EvidenceStatus.SUBMITTED);

    // If still not found, take the most recent evidence
    if (!targetEvidence && evidenceList.length > 0) {
      targetEvidence = evidenceList[evidenceList.length - 1];
    }

    if (!targetEvidence) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.NOT_FOUND,
        message: 'No resolution evidence submitted for this problem to verify.'
      });
    }

    // 4. Idempotency Check:
    // If evidence has already been evaluated by AI advisory verification and forceReverify is false,
    // return the existing verification result. This prevents redundant Gemini provider calls, token costs,
    // and duplicate audit timeline clutter.
    if (targetEvidence.verification_id && !forceReverify) {
      const existing = await db.getLatestVerification(targetEvidence.id);
      if (existing) {
        return existing;
      }
    }

    // If forceReverify was requested on already verified evidence, record that verification was explicitly re-requested by the officer
    if (forceReverify && targetEvidence.verification_id) {
      await WorkflowService.recordAction(user, problem.id, {
        action: ActionType.VERIFICATION_REQUESTED,
        note: `Advisory re-verification explicitly requested by ${user.display_name} (${user.role}).`
      });
    }

    // Collect any pre-existing "before" evidence
    const beforeEvidence = evidenceList.filter((e) => e.before_or_after === BeforeOrAfter.BEFORE);

    const provider = getVerificationProvider();
    const startTime = Date.now();
    let opStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let rawOutput: any;

    try {
      rawOutput = await provider.verifyResolutionEvidence({
        problem_id: problem.id,
        problem_title: problem.title,
        problem_category: problem.category,
        problem_description: problem.description,
        evidence: targetEvidence,
        before_evidence: beforeEvidence
      });
    } catch (err: any) {
      // Safe fallback on provider error or timeout
      opStatus = 'FAILED';
      rawOutput = {
        verification_result: VerificationResultStatus.INCONCLUSIVE,
        confidence: 0.5,
        observed_conditions: ['Automated verification service unavailable.'],
        evidence_summary: 'AI verification provider encountered an error. Safely degraded to human supervisory review.',
        inconsistencies: [err.message || 'Provider failure'],
        explanation: 'AI verification could not complete. Case remains awaiting verification for manual inspection.',
        recommended_review_reason: 'AI service unavailable; manual verification required.',
        limitations: ['Verification provider failure'],
        review_required: true
      };
    }

    const latencyMs = Date.now() - startTime;

    // Deterministic threshold enforcement:
    // If confidence < 0.65, force INCONCLUSIVE
    let finalResult = rawOutput.verification_result as VerificationResultStatus;
    if (rawOutput.confidence < 0.65 && finalResult === VerificationResultStatus.VERIFIED) {
      finalResult = VerificationResultStatus.INCONCLUSIVE;
    }

    const nowIso = new Date().toISOString();
    const verificationId = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const verificationRecord: VerificationResult = {
      id: verificationId,
      problem_id: problem.id,
      evidence_id: targetEvidence.id,
      verification_result: finalResult,
      confidence: Number(rawOutput.confidence.toFixed(2)),
      observed_conditions: rawOutput.observed_conditions || [],
      evidence_summary: rawOutput.evidence_summary || '',
      before_after_comparison: rawOutput.before_after_comparison,
      inconsistencies: rawOutput.inconsistencies || [],
      explanation: rawOutput.explanation || '',
      recommended_review_reason: rawOutput.recommended_review_reason || null,
      limitations: rawOutput.limitations || [],
      review_required: true, // Always require human review for municipal closure
      model: provider.getModelName(),
      prompt_version: provider.getPromptVersion(),
      created_at: nowIso
    };

    // Persist verification result
    await db.createVerificationResult(verificationRecord);

    // Update evidence with verification link & status
    await db.updateResolutionEvidence(targetEvidence.id, {
      verification_id: verificationId,
      status: EvidenceStatus.UNDER_REVIEW
    });

    // Record AI operation metadata
    const aiOp: AIOperationRecord = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      operation_type: AIOperationType.RESOLUTION_VERIFICATION,
      entity_type: 'problem_cluster',
      entity_id: problem.id,
      model: provider.getModelName(),
      prompt_version: provider.getPromptVersion(),
      status: opStatus === 'SUCCESS' ? AIOperationStatus.SUCCESS : AIOperationStatus.FAILED,
      confidence: verificationRecord.confidence,
      latency_ms: latencyMs,
      created_at: nowIso
    };
    await db.createAIOperation(aiOp);

    // Record immutable audit action in timeline
    // NOTICE: AI verification DOES NOT change problem.status to RESOLVED. Problem remains in AWAITING_VERIFICATION.
    // Attribution is authoritatively 'SYSTEM' (civicpulse_ai_advisory) because the AI evaluates the evidence,
    // not the submitting field officer (who is barred by self-approval) nor the requesting supervisor.
    await WorkflowService.recordAction(user, problem.id, {
      action: ActionType.VERIFICATION_COMPLETED,
      actor_id: 'civicpulse_ai_advisory',
      actor_role: 'SYSTEM',
      note: `AI advisory verification completed: [${verificationRecord.verification_result}] with ${(verificationRecord.confidence * 100).toFixed(0)}% confidence. Review required by supervisor before official resolution.`,
      metadata: {
        verification_id: verificationRecord.id,
        evidence_id: targetEvidence.id,
        triggered_by: user.id,
        triggered_by_role: user.role,
        model: verificationRecord.model,
        confidence: verificationRecord.confidence,
        result: verificationRecord.verification_result
      }
    });

    return verificationRecord;
  }

  /**
   * Retrieves verification history for a problem cluster.
   */
  public static async getVerificationHistory(
    user: UserProfile,
    problemId: string
  ): Promise<VerificationResult[]> {
    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${problemId} not found.`
      });
    }

    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot view verification for ${problem.department_id}.`
        });
      }
    }

    return db.getVerificationHistory(problemId);
  }

  /**
   * Retrieves latest verification result for a problem cluster.
   */
  public static async getLatestVerification(
    user: UserProfile,
    problemId: string
  ): Promise<VerificationResult | null> {
    const history = await this.getVerificationHistory(user, problemId);
    return history.length > 0 ? history[history.length - 1]! : null;
  }
}
