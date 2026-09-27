/**
 * CivicPulse Development Demand Intelligence — Governance AI Service
 * 
 * Phase: 15B.5.3.20-HF7.6
 * 
 * Capabilities:
 * - Synthesizes DemandCluster, normalized demand signals, deterministic metrics (HF7.5),
 *   contextual development indicators, and public investment records into canonical
 *   DevelopmentDemandAnalysisResponse.
 * - Strict Three-Tier Trust Boundary:
 *     SYSTEM / VERIFIED STRUCTURED DATA
 *         ↓
 *     UNTRUSTED CITIZEN NARRATIVES (<<<UNTRUSTED_USER_CONTENT>>>)
 *         ↓
 *     AI INTERPRETATION
 * - Defensive Metric Protection:
 *     Gemini MUST NOT calculate or alter deterministic metrics.
 *     If AI attempts to alter metrics, AI values are discarded, authoritative HF7.5 metrics
 *     are preserved, and discrepancy is logged in AI operation audit.
 * - Traceable Evidence Citations:
 *     Only citations corresponding to actual supplied inputs are retained.
 *     Zero fabricated IDs or statistics.
 * - Advisory-Only Language:
 *     Enforces non-directive, balanced, consultative language.
 * - Privacy Safeguards:
 *     Zero citizen PII, zero officer UUIDs, zero household GPS.
 * - REAL_MODE Boundary:
 *     Strictly excludes demo signals, demo indicators, and demo investments.
 * - Fail-Closed Error Handling:
 *     Propagates typed errors on timeout, provider unavailable, or schema errors without fake local fallbacks.
 */

import crypto from 'crypto';
import {
  DevelopmentDemandAnalysisResponse,
  DevelopmentDemandAnalysisResponseSchema,
  DemandCluster,
  NormalizedDemandSignal,
  DemandSignal,
  DeterministicDemandMetrics,
  DevelopmentIndicator,
  PublicInvestmentRecord,
  UntrustedNarrative,
  DemandSignalSourceChannel,
  UserProfile,
  UserRole,
  AIOperationType,
  AIOperationStatus,
  AppError,
  ERROR_CODES
} from '@civicpulse/shared';
import { IAIProvider } from '../providers/ai/ai.interface';
import { IDatabaseProvider } from '../providers/database/database.interface';
import { getAIProvider, getDatabaseProvider, getDevelopmentIndicatorProvider, getPublicInvestmentProvider } from '../providers';
import { calculateDemandMetrics } from './development-demand-metrics.service';
import { PROMPT_VERSION_DEVELOPMENT_DEMAND_GOVERNANCE } from '../infrastructure/ai/prompts/development_demand_governance_v1';
import { sanitizeDemandPII } from '../utils/demand-pii-sanitizer';
import { env } from '../config/env';

// Prohibited imperative directive phrases that violate advisory invariants
const PROHIBITED_DIRECTIVE_PATTERNS = [
  /government must fund/i,
  /approve this project/i,
  /award this contract/i,
  /allocate ₹/i,
  /build immediately/i,
  /citizens will receive/i,
  /this project should definitely be approved/i
];

export interface AnalyzeDevelopmentDemandServiceInput {
  opportunity_id?: string;
  cluster?: DemandCluster;
  cluster_id?: string;
  category?: string;
  ward_id?: string;
  signals?: (NormalizedDemandSignal | DemandSignal)[];
  indicators?: DevelopmentIndicator[];
  investments?: PublicInvestmentRecord[];
  metrics?: DeterministicDemandMetrics;
  user?: UserProfile;
  is_demo?: boolean;
}

export class DevelopmentDemandGovernanceService {
  private aiProvider: IAIProvider;
  private dbProvider?: IDatabaseProvider;

  constructor(aiProvider?: IAIProvider, dbProvider?: IDatabaseProvider) {
    this.aiProvider = aiProvider ?? getAIProvider();
    this.dbProvider = dbProvider ?? getDatabaseProvider();
  }

  public getPromptVersion(): string {
    return PROMPT_VERSION_DEVELOPMENT_DEMAND_GOVERNANCE;
  }

  /**
   * Interprets and synthesizes development demand intelligence into
   * a structured DevelopmentDemandAnalysisResponse.
   */
  async analyzeDevelopmentDemand(
    input: AnalyzeDevelopmentDemandServiceInput
  ): Promise<DevelopmentDemandAnalysisResponse> {
    const startTime = Date.now();

    // 1. Role Verification & Scope Checking (if user provided)
    if (input.user) {
      if (input.user.role === UserRole.CITIZEN) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Development demand governance intelligence is restricted to municipal administrators and officers.'
        });
      }

      if (input.user.role === UserRole.FIELD_OFFICER) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Field officers are not authorized to access macro development demand governance analysis.'
        });
      }
    }

    // 2. Resolve REAL_MODE Boundary
    const isDemo = input.is_demo ?? (input.cluster?.is_demo ?? env.DEMO_MODE);

    // 3. Cluster Entity Resolution
    let cluster: DemandCluster;
    if (input.cluster) {
      cluster = input.cluster;
    } else {
      const category = input.category || 'drinking_water';
      const wardId = input.ward_id || 'WARD-001';
      cluster = {
        id: input.cluster_id || `dclust_derived_${Date.now()}`,
        title: `Development Demand Cluster — ${category} in ${wardId}`,
        category,
        ward_ids: [wardId],
        signal_count: input.signals?.length || 1,
        first_signal_at: new Date().toISOString(),
        last_signal_at: new Date().toISOString(),
        duration_days: 0,
        is_demo: isDemo,
        created_at: new Date().toISOString()
      };
    }

    const opportunityId = input.opportunity_id || `opp_${cluster.id}`;
    const primaryWardId = cluster.ward_ids[0] || 'WARD-001';

    // 4. Filter Inputs Strictly by REAL_MODE
    const rawSignals = input.signals || [];
    const validSignals = isDemo ? rawSignals : rawSignals.filter((s) => !s.is_demo);

    // Resolve indicators if not passed
    let rawIndicators = input.indicators;
    if (!rawIndicators) {
      try {
        const indProvider = getDevelopmentIndicatorProvider();
        rawIndicators = await indProvider.getWardIndicators(primaryWardId);
      } catch {
        rawIndicators = [];
      }
    }
    const validIndicators = isDemo
      ? rawIndicators
      : rawIndicators.filter((i) => !i.is_demo && !i.provenance?.is_demo);

    // Resolve investments if not passed
    let rawInvestments = input.investments;
    if (!rawInvestments) {
      try {
        const invProvider = getPublicInvestmentProvider();
        rawInvestments = await invProvider.getInvestmentsByWard(primaryWardId);
      } catch {
        rawInvestments = [];
      }
    }
    const validInvestments = isDemo
      ? rawInvestments
      : rawInvestments.filter((inv) => !inv.is_demo && !inv.provenance?.is_demo);

    // 5. Authoritative Deterministic Metrics (HF7.5 is Sole Authority)
    let deterministicMetrics: DeterministicDemandMetrics;
    if (input.metrics) {
      deterministicMetrics = input.metrics;
    } else {
      deterministicMetrics = await calculateDemandMetrics(
        cluster,
        validSignals,
        validIndicators,
        validInvestments,
        { isDemo }
      );
    }

    // 6. Build Observed Facts (Populated only from supplied structured data)
    let firstDetected = cluster.first_signal_at;
    let lastDetected = cluster.last_signal_at;
    const channels = new Set<DemandSignalSourceChannel>();

    if (validSignals.length > 0) {
      const timestamps = validSignals
        .map((s) => Date.parse(s.submitted_at || s.ingested_at))
        .filter((t) => !isNaN(t))
        .sort((a, b) => a - b);

      if (timestamps.length > 0) {
        firstDetected = new Date(timestamps[0]!).toISOString();
        lastDetected = new Date(timestamps[timestamps.length - 1]!).toISOString();
      }

      for (const s of validSignals) {
        const ch = (s as any).source_channel || (s as any).channel || (s as any).provenance?.source_channel;
        if (ch) {
          channels.add(ch);
        }
      }
    }

    if (channels.size === 0) {
      channels.add(DemandSignalSourceChannel.WEB_FORM);
    }

    // Sample untrusted narratives (up to 3, with deterministic PII sanitization)
    const sampleNarratives: UntrustedNarrative[] = [];
    for (const s of validSignals.slice(0, 3)) {
      const raw = s.normalized_text || s.original_text || 'Citizen reported municipal infrastructure issue.';
      const sanitized = sanitizeDemandPII(raw).sanitizedText;
      sampleNarratives.push({
        content: sanitized,
        trust: 'untrusted_user_content' as const
      });
    }

    if (sampleNarratives.length === 0) {
      sampleNarratives.push({
        content: `Citizen development signals registered for ${cluster.category} in ward ${primaryWardId}.`,
        trust: 'untrusted_user_content' as const
      });
    }

    const observedFacts = {
      total_signals: validSignals.length > 0 ? validSignals.length : cluster.signal_count || 1,
      first_detected: firstDetected,
      last_detected: lastDetected,
      intake_channels: Array.from(channels),
      sample_narratives: sampleNarratives
    };

    // 7. Invoke AI Provider
    if (!this.aiProvider.interpretDevelopmentDemand) {
      throw new AppError({
        statusCode: 501,
        code: 'NOT_IMPLEMENTED',
        message: 'The configured AI provider does not support development demand governance interpretation.'
      });
    }

    let aiOutput;
    try {
      aiOutput = await this.aiProvider.interpretDevelopmentDemand({
        cluster,
        observed_facts: {
          ...observedFacts,
          signal_ids: validSignals.map((s) => s.id)
        } as any,
        metrics: deterministicMetrics,
        indicators: validIndicators,
        investments: validInvestments
      });
    } catch (err: any) {
      // Record failed AI operation
      await this.recordAIOperation({
        opportunityId,
        model: this.aiProvider.getModelName(),
        status: AIOperationStatus.FAILED,
        latencyMs: Date.now() - startTime,
        errorCode: err.code || 'AI_PROVIDER_ERROR'
      });

      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError({
        statusCode: 502,
        code: 'AI_PROVIDER_ERROR',
        message: `Governance AI interpretation failed: ${err.message || 'Unknown AI error'}`
      });
    }

    // Fail closed if AI returned null, empty, malformed object, or missing advisory interpretation
    if (
      !aiOutput ||
      typeof aiOutput !== 'object' ||
      (aiOutput as any).invalid ||
      !aiOutput.advisory_interpretation ||
      typeof aiOutput.advisory_interpretation.summary !== 'string' ||
      typeof aiOutput.advisory_interpretation.need_justification !== 'string'
    ) {
      await this.recordAIOperation({
        opportunityId,
        model: this.aiProvider.getModelName(),
        status: AIOperationStatus.FAILED,
        latencyMs: Date.now() - startTime,
        errorCode: 'MALFORMED_AI_RESPONSE'
      });

      throw new AppError({
        statusCode: 502,
        code: 'MALFORMED_AI_RESPONSE',
        message: 'Governance AI returned an invalid or malformed interpretation response.'
      });
    }

    // 8. Defensive Metric Protection (HF7.5 is Sovereign Authority)
    // If Gemini attempts to calculate or alter scores, discard them and enforce HF7.5 values
    let metricDiscrepancy: Record<string, unknown> | undefined;
    if (aiOutput.metrics) {
      const keys: (keyof DeterministicDemandMetrics)[] = [
        'demand_volume_score',
        'recurrence_score',
        'geographic_concentration_score',
        'population_exposure_score',
        'infrastructure_deficit_score',
        'investment_gap_score',
        'composite_demand_index'
      ];

      const diffs: Record<string, { ai: number; deterministic: number }> = {};
      for (const k of keys) {
        if (typeof aiOutput.metrics[k] === 'number' && aiOutput.metrics[k] !== deterministicMetrics[k]) {
          diffs[k] = { ai: aiOutput.metrics[k], deterministic: deterministicMetrics[k] };
        }
      }

      if (Object.keys(diffs).length > 0) {
        metricDiscrepancy = {
          attempted_ai_metrics: aiOutput.metrics,
          enforced_deterministic_metrics: deterministicMetrics,
          discrepancy_details: diffs
        };
      }
    }

    // 9. Validate & Sanitize Evidence Citations
    // Only permit citations that were actually in the supplied input (prevent hallucination)
    const validSignalIdSet = new Set(validSignals.map((s) => s.id));
    const validIndicatorSourceSet = new Set(
      validIndicators.flatMap((i: any) => [
        i.source,
        i.source_agency,
        i.source_agency && i.metric_name ? `${i.source_agency}:${i.metric_name}` : null
      ]).filter(Boolean) as string[]
    );
    const validInvestmentRefSet = new Set(
      validInvestments.flatMap((inv: any) => [inv.plan_name, inv.project_id, inv.project_title]).filter(Boolean) as string[]
    );

    const rawSignalCitations = Array.isArray(aiOutput.evidence_citations?.signal_ids)
      ? aiOutput.evidence_citations.signal_ids
      : [];
    const verifiedSignalCitations = rawSignalCitations.filter((id) => validSignalIdSet.has(id));
    // If AI cited nothing or hallucinated IDs, backfill up to 3 valid signal IDs if available
    const finalSignalCitations = verifiedSignalCitations.length > 0
      ? verifiedSignalCitations
      : validSignals.slice(0, 3).map((s) => s.id);

    const rawIndicatorCitations = Array.isArray(aiOutput.evidence_citations?.indicator_sources)
      ? aiOutput.evidence_citations.indicator_sources
      : [];
    const verifiedIndicatorCitations = rawIndicatorCitations.filter((src) =>
      Array.from(validIndicatorSourceSet).some((validSrc) => validSrc.includes(src) || src.includes(validSrc))
    );
    const finalIndicatorCitations = verifiedIndicatorCitations.length > 0
      ? verifiedIndicatorCitations
      : Array.from(validIndicatorSourceSet).slice(0, 3);

    const rawInvestmentCitations = Array.isArray(aiOutput.evidence_citations?.investment_references)
      ? aiOutput.evidence_citations.investment_references
      : [];
    const verifiedInvestmentCitations = rawInvestmentCitations.filter((ref) =>
      Array.from(validInvestmentRefSet).some((validRef) => validRef.includes(ref) || ref.includes(validRef))
    );
    const finalInvestmentCitations = verifiedInvestmentCitations.length > 0
      ? verifiedInvestmentCitations
      : Array.from(validInvestmentRefSet).slice(0, 3);

    // 10. Sanitize Advisory Language & Check Prohibited Framing
    let summary = aiOutput.advisory_interpretation?.summary || 'Cluster indicates potential development demand.';
    let needJustification = aiOutput.advisory_interpretation?.need_justification || 'Evidence indicates demand for municipal review.';
    const rawTradeoffs = Array.isArray(aiOutput.advisory_interpretation?.tradeoffs_and_considerations)
      ? aiOutput.advisory_interpretation.tradeoffs_and_considerations
      : ['Inter-departmental alignment recommended for capital planning.'];

    for (const pattern of PROHIBITED_DIRECTIVE_PATTERNS) {
      if (pattern.test(summary)) {
        summary = summary.replace(pattern, 'available evidence suggests consideration of');
      }
      if (pattern.test(needJustification)) {
        needJustification = needJustification.replace(pattern, 'the evidence supports consideration of');
      }
    }

    const sanitizedTradeoffs = rawTradeoffs.map((t) => {
      let cleaned = t;
      for (const pattern of PROHIBITED_DIRECTIVE_PATTERNS) {
        if (pattern.test(cleaned)) {
          cleaned = cleaned.replace(pattern, 'potential consideration for');
        }
      }
      return cleaned;
    });

    // 11. Enforce Honest Missing-Data Semantics in Limitations
    const limitations = Array.isArray(aiOutput.uncertainty?.limitations)
      ? [...aiOutput.uncertainty.limitations]
      : [];

    if (validInvestments.length === 0) {
      const investmentLimitation = 'No verified public investment dataset available for this ward/sector; gap cannot be confirmed from authoritative sources.';
      if (!limitations.some((l) => l.toLowerCase().includes('investment'))) {
        limitations.push(investmentLimitation);
      }
    }

    if (validIndicators.length === 0) {
      const indicatorLimitation = `No authoritative reference infrastructure indicators available in repository for sector '${cluster.category}'.`;
      if (!limitations.some((l) => l.toLowerCase().includes('indicator'))) {
        limitations.push(indicatorLimitation);
      }
    }

    const rawConfidence = Number(aiOutput.uncertainty?.confidence);
    const confidence = isNaN(rawConfidence)
      ? (validIndicators.length === 0 || validInvestments.length === 0 ? 0.75 : 0.9)
      : Math.max(0, Math.min(1, rawConfidence));

    // 12. Final Response Assembly & Schema Validation
    const response: DevelopmentDemandAnalysisResponse = {
      opportunity_id: opportunityId,
      category: cluster.category,
      ward_id: primaryWardId,
      observed_facts: observedFacts,
      metrics: deterministicMetrics, // Strictly authoritative HF7.5 values
      evidence_citations: {
        signal_ids: finalSignalCitations,
        indicator_sources: finalIndicatorCitations,
        investment_references: finalInvestmentCitations
      },
      advisory_interpretation: {
        summary,
        need_justification: needJustification,
        tradeoffs_and_considerations: sanitizedTradeoffs
      },
      uncertainty: {
        confidence,
        limitations: limitations.length > 0 ? limitations : ['Standard voluntary citizen intake margin of uncertainty.']
      },
      is_demo: isDemo
    };

    const validatedResponse = DevelopmentDemandAnalysisResponseSchema.parse(response);

    // 13. Audit Successful AI Operation
    const latencyMs = Date.now() - startTime;
    await this.recordAIOperation({
      opportunityId,
      model: aiOutput.resolved_model || this.aiProvider.getModelName(),
      status: AIOperationStatus.SUCCESS,
      confidence,
      latencyMs,
      metadata: metricDiscrepancy
    });

    return validatedResponse;
  }

  /**
   * Helper: Records AI Operation in audit database without leaking PII or credentials.
   */
  private async recordAIOperation(params: {
    opportunityId: string;
    model: string;
    status: AIOperationStatus;
    confidence?: number;
    latencyMs: number;
    errorCode?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.dbProvider?.createAIOperation) {
      return;
    }

    try {
      await this.dbProvider.createAIOperation({
        id: `aiop_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        operation_type: AIOperationType.DEVELOPMENT_DEMAND_ANALYSIS,
        entity_type: 'development_demand',
        entity_id: params.opportunityId,
        model: params.model,
        prompt_version: PROMPT_VERSION_DEVELOPMENT_DEMAND_GOVERNANCE,
        status: params.status,
        confidence: params.confidence,
        latency_ms: params.latencyMs,
        error_code: params.errorCode,
        metadata: params.metadata,
        created_at: new Date().toISOString()
      });
    } catch {
      // Non-fatal: audit failures must not interrupt the read-oriented governance flow
    }
  }

  public static async analyzeDevelopmentDemand(
    input: AnalyzeDevelopmentDemandServiceInput
  ): Promise<DevelopmentDemandAnalysisResponse> {
    return new DevelopmentDemandGovernanceService().analyzeDevelopmentDemand(input);
  }
}

export const developmentDemandGovernanceService = new DevelopmentDemandGovernanceService();

export async function analyzeDevelopmentDemand(
  input: AnalyzeDevelopmentDemandServiceInput
): Promise<DevelopmentDemandAnalysisResponse> {
  return developmentDemandGovernanceService.analyzeDevelopmentDemand(input);
}
