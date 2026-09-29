import {
  UserProfile,
  UserRole,
  Signal,
  SignalProcessingStatus,
  SignalSeverity,
  SignalAIAnalysis,
  AIOperationRecord,
  AIOperationType,
  AIOperationStatus,
  ERROR_CODES
} from '@civicpulse/shared';
import { SignalRepository } from './signal.repository';
import { SignalService } from './signal.service';
import { getAIProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';

export class SignalAIService {
  constructor(
    private repo: SignalRepository = new SignalRepository(),
    private signalService: SignalService = new SignalService()
  ) {}

  /**
   * Explicit Phase 3 AI analysis pipeline.
   * Invoked via POST /api/v1/signals/:id/analyze
   */
  async analyzeSignal(
    user: UserProfile,
    signalId: string
  ): Promise<{ signal: Signal; analysis: SignalAIAnalysis; operation: AIOperationRecord }> {
    // 1. Authorization Scope: Citizen can only analyze own signals; departmental scope enforced
    const signal = await this.signalService.getSignal(user, signalId);

    // 2. Mark signal as PROCESSING
    await this.repo.update(signalId, {
      processing_status: SignalProcessingStatus.PROCESSING
    });

    const aiProvider = getAIProvider();
    const startTime = Date.now();
    const operationId = `ai_op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      // 3. Invoke AI Provider
      const analysisOutput = await aiProvider.analyzeSignal({
        text: signal.original_text || '',
        location_reference: signal.location_reference,
        media_items: []
      });


      const latencyMs = Date.now() - startTime;

      // Canonical language normalization: normalize any Gemini response "od" to canonical "or"
      const rawLanguage = (analysisOutput.detected_language || '').trim().toLowerCase();
      const canonicalLanguage = rawLanguage === 'od' ? 'or' : (analysisOutput.detected_language || 'en');

      const analysis: SignalAIAnalysis = {
        detected_language: canonicalLanguage,
        normalized_summary: analysisOutput.normalized_summary,
        category: analysisOutput.category,
        subcategory: analysisOutput.subcategory || null,
        severity: analysisOutput.severity,
        urgency: analysisOutput.urgency,
        affected_scope: analysisOutput.affected_scope || null,
        duration_days: analysisOutput.duration_days ?? null,
        location_reference: analysisOutput.location_reference || null,
        recommended_department: analysisOutput.recommended_department || null,
        entities: analysisOutput.entities || [],
        critical_facility: analysisOutput.critical_facility || null,
        confidence: analysisOutput.confidence,
        explanation: analysisOutput.explanation,
        image_findings: analysisOutput.image_findings || []
      };

      // 4. Update Signal:
      // CRITICAL: Store AI recommendation in advisory `recommended_department` ONLY.
      // Do NOT overwrite authoritative `department_id` (Phase 5).
      // CRITICAL: original_text is preserved exactly and NEVER modified during analysis or re-analysis.
      const updatedSignal = await this.repo.update(signalId, {
        normalized_text: analysis.normalized_summary,
        language: analysis.detected_language,
        category: analysis.category,
        subcategory: analysis.subcategory || undefined,
        severity: analysis.severity as SignalSeverity,
        duration_days: analysis.duration_days ?? undefined,
        critical_facility: analysis.critical_facility || undefined,
        recommended_department: analysis.recommended_department || undefined,
        ai_confidence: analysis.confidence,
        processing_status: SignalProcessingStatus.COMPLETED,
        ai_analysis: analysis
      });

      // 5. Persist AI Operation Audit Record
      const actualModel = (analysisOutput as any).resolved_model || aiProvider.getModelName();
      const opRecord: AIOperationRecord = {
        id: operationId,
        operation_type: AIOperationType.SIGNAL_UNDERSTANDING,
        entity_type: 'signal',
        entity_id: signalId,
        model: actualModel,
        prompt_version: aiProvider.getPromptVersion(),
        status: AIOperationStatus.SUCCESS,
        confidence: analysis.confidence,
        latency_ms: latencyMs,
        created_at: new Date().toISOString()
      };

      await this.repo.createAIOperation(opRecord);

      return {
        signal: updatedSignal,
        analysis,
        operation: opRecord
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const errorCode = err.code || 'AI_PROCESSING_ERROR';

      // Safe FAILED state update on signal
      await this.repo.update(signalId, {
        processing_status: SignalProcessingStatus.FAILED
      });

      // Audit failed AI operation
      const failedOpRecord: AIOperationRecord = {
        id: operationId,
        operation_type: AIOperationType.SIGNAL_UNDERSTANDING,
        entity_type: 'signal',
        entity_id: signalId,
        model: (err as any).model || aiProvider.getModelName(),
        prompt_version: aiProvider.getPromptVersion(),
        status: AIOperationStatus.FAILED,
        error_code: errorCode,
        latency_ms: latencyMs,
        created_at: new Date().toISOString()
      };

      await this.repo.createAIOperation(failedOpRecord);

      // Re-throw with consistent AppError
      if (err instanceof AppError) {
        throw err;
      }

      throw new AppError({
        statusCode: 502,
        code: 'AI_PROCESSING_FAILED',
        message: `Signal AI analysis failed: ${err.message || 'Unknown error'}`
      });
    }
  }

  /**
   * Retrieve AI operations and analysis state for a signal.
   * Invoked via GET /api/v1/signals/:id/ai
   */
  async getSignalAI(
    user: UserProfile,
    signalId: string
  ): Promise<{ signal: Signal; operations: AIOperationRecord[] }> {
    const signal = await this.signalService.getSignal(user, signalId);
    const operations = await this.repo.getAIOperations(signalId);

    return {
      signal,
      operations
    };
  }
}
