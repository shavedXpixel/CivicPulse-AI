/**
 * CivicPulse Development Demand Intelligence — Multilingual Demand Normalization Service
 * 
 * Phase: 15B.5.3.20-HF7.2
 * 
 * Capabilities:
 * - Deterministic PII sanitization (phones, emails, citizen names, house/plot numbers)
 * - Multilingual normalization into canonical English (en, or, hi, code-mixed)
 * - Canonical 14-sector municipal development taxonomy classification
 * - Urgency classification (LOW / MEDIUM / HIGH)
 * - Strict coarse-only geographic context (no exact coordinates transmitted to AI)
 * - Untrusted citizen narrative boundary enforcement
 * - Fail-closed error handling (no synthetic fallbacks on failure)
 * - Prompt versioning: development_demand_normalization_v1
 */

import {
  NormalizedDemandSignal,
  DemandSignalSourceChannel,
  DEVELOPMENT_DEMAND_SECTORS,
  AppError
} from '@civicpulse/shared';
import { NormalizedDemandSignalSchema } from '@civicpulse/shared';
import { getAIProvider } from '../providers';
import { IAIProvider } from '../providers/ai/ai.interface';
import { sanitizeDemandPII, DemandSanitizationResult } from '../utils/demand-pii-sanitizer';
import { PROMPT_VERSION_DEVELOPMENT_DEMAND_NORMALIZATION } from '../infrastructure/ai/prompts/development_demand_normalization_v1';

export interface NormalizeDemandSignalInput {
  id?: string;
  source_channel?: DemandSignalSourceChannel;
  raw_text: string;
  ward_id?: string;
  locality_name?: string;
  is_demo?: boolean;
  submitted_at?: string;
}

export class DevelopmentDemandNormalizationService {
  private aiProvider: IAIProvider;

  constructor(aiProvider?: IAIProvider) {
    this.aiProvider = aiProvider ?? getAIProvider();
  }

  public getPromptVersion(): string {
    return PROMPT_VERSION_DEVELOPMENT_DEMAND_NORMALIZATION;
  }

  /**
   * Normalizes an incoming raw civic development demand signal into the canonical
   * NormalizedDemandSignal contract.
   *
   * Invariants:
   * 1. PII is deterministically redacted before invoking the AI provider.
   * 2. Only coarse geography (ward_id, locality_name) is provided to AI.
   * 3. Untrusted narrative cannot control `is_demo` or override system taxonomy.
   * 4. Fails closed with typed errors if AI fails, times out, or returns invalid category.
   * 5. Does not mutate database (normalization capability layer only).
   */
  async normalizeDemandSignal(input: NormalizeDemandSignalInput): Promise<NormalizedDemandSignal> {
    if (!input || !input.raw_text || typeof input.raw_text !== 'string' || input.raw_text.trim().length === 0) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_INPUT',
        message: 'raw_text is required and must not be empty.'
      });
    }

    // 1. Enforce is_demo semantics: default to false unless explicitly set to true
    const isDemo = input.is_demo === true;

    // 2. Deterministic PII Sanitization
    const piiResult: DemandSanitizationResult = sanitizeDemandPII(input.raw_text);
    const sanitizedText = piiResult.sanitizedText.trim();
    const meaningfulText = sanitizedText
      .replace(/\[REDACTED_(?:PHONE|EMAIL|PERSONAL_NAME|RESIDENCE|RESIDENTIAL_IDENTIFIER)\]/g, '')
      .trim();

    if (!meaningfulText) {
      throw new AppError({
        statusCode: 400,
        code: 'EMPTY_DEMAND_SIGNAL',
        message: 'Demand signal text contains only redacted personal identifiers with no civic demand content.'
      });
    }

    // 3. Prepare Coarse Geographic Context (No exact residential coordinates)
    const coarseGeo = {
      ward_id: input.ward_id,
      locality_name: input.locality_name
    };

    // 4. Invoke AI Provider
    if (!this.aiProvider.normalizeDemand) {
      throw new AppError({
        statusCode: 501,
        code: 'NOT_IMPLEMENTED',
        message: 'The configured AI provider does not support development demand normalization.'
      });
    }

    let aiOutput;
    try {
      aiOutput = await this.aiProvider.normalizeDemand({
        text: sanitizedText,
        ward_id: coarseGeo.ward_id,
        locality_name: coarseGeo.locality_name
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError({
        statusCode: 502,
        code: 'AI_PROVIDER_ERROR',
        message: `Demand normalization provider failed: ${err.message || 'Unknown provider error'}`
      });
    }

    // 5. Fail-Closed Validation of AI Output
    if (!aiOutput || typeof aiOutput !== 'object') {
      throw new AppError({
        statusCode: 502,
        code: 'MALFORMED_AI_OUTPUT',
        message: 'AI provider returned empty or non-object demand normalization output.'
      });
    }

    // Validate taxonomy category
    if (!aiOutput.detected_category || !DEVELOPMENT_DEMAND_SECTORS.includes(aiOutput.detected_category as any)) {
      throw new AppError({
        statusCode: 502,
        code: 'INVALID_TAXONOMY_CATEGORY',
        message: `Invalid or non-canonical taxonomy category '${aiOutput.detected_category}' returned by AI provider.`
      });
    }

    // Validate urgency
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(aiOutput.detected_urgency)) {
      throw new AppError({
        statusCode: 502,
        code: 'INVALID_DEMAND_URGENCY',
        message: `Invalid demand urgency '${aiOutput.detected_urgency}' returned by AI provider.`
      });
    }

    // Validate confidence
    const confidence = Number(aiOutput.normalization_confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      throw new AppError({
        statusCode: 502,
        code: 'INVALID_CONFIDENCE_VALUE',
        message: `Invalid normalization confidence '${aiOutput.normalization_confidence}' returned by AI provider. Must be within [0.0, 1.0].`
      });
    }

    if (!aiOutput.normalized_text || typeof aiOutput.normalized_text !== 'string' || !aiOutput.normalized_text.trim()) {
      throw new AppError({
        statusCode: 502,
        code: 'MALFORMED_AI_OUTPUT',
        message: 'AI provider returned empty normalized_text.'
      });
    }

    // 6. Assemble Canonical NormalizedDemandSignal
    const now = new Date().toISOString();
    const signalId = input.id || `dem_sig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sourceChannel = input.source_channel || DemandSignalSourceChannel.WEB_FORM;

    // Coarse ward extraction: explicit input takes priority, then AI extraction, fallback to 'WARD-UNKNOWN'
    const wardId = input.ward_id || aiOutput.extracted_ward || 'WARD-UNKNOWN';
    const localityName = input.locality_name || aiOutput.extracted_locality || undefined;

    const normalizedSignal: NormalizedDemandSignal = {
      id: signalId,
      source_channel: sourceChannel,
      original_language: aiOutput.detected_language || 'en',
      original_text: input.raw_text, // Preserved in raw form for source provenance
      normalized_language: 'en',
      normalized_text: aiOutput.normalized_text.trim(),
      normalization_confidence: Number(confidence.toFixed(2)),
      detected_category: aiOutput.detected_category,
      detected_urgency: aiOutput.detected_urgency,
      ward_id: wardId,
      locality_name: localityName,
      is_demo: isDemo,
      submitted_at: input.submitted_at || now,
      ingested_at: now
    };

    // 7. Validate through Canonical Shared Zod Schema
    const validated = NormalizedDemandSignalSchema.parse(normalizedSignal);
    return validated;
  }
}

export const developmentDemandNormalizationService = new DevelopmentDemandNormalizationService();

export async function normalizeDemandSignal(
  input: NormalizeDemandSignalInput,
  aiProvider?: IAIProvider
): Promise<NormalizedDemandSignal> {
  const service = aiProvider
    ? new DevelopmentDemandNormalizationService(aiProvider)
    : developmentDemandNormalizationService;
  return service.normalizeDemandSignal(input);
}
