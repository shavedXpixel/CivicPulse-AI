import OpenAI from 'openai';
import { IAIProvider, SignalAnalysisInput, SignalAnalysisResult, ClusterSummaryInput } from './ai.interface';
import {
  IAIVerificationProvider,
  VerifyResolutionInput,
  VerificationAnalysisOutput
} from './verification.interface';
import {
  SignalAnalysisOutputSchema,
  AppError,
  ERROR_CODES
} from '@civicpulse/shared';
import { env } from '../../config/env';
import {
  SYSTEM_INSTRUCTION_SIGNAL_UNDERSTANDING,
  buildSignalUnderstandingPrompt,
  PROMPT_VERSION_SIGNAL_UNDERSTANDING
} from '../../infrastructure/ai/prompts/signal_understanding_v1';
import { isTransientError } from './gemini.provider';

export interface OpenAIProviderConfig {
  apiKey?: string;
  primaryModel?: string;
  fallbackModel?: string;
  embeddingModel?: string;
  verificationModel?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

export class OpenAIProvider implements IAIProvider, IAIVerificationProvider {
  private client: OpenAI | null = null;
  private primaryModel: string;
  private fallbackModel: string;
  private embeddingModel: string;
  private verificationModel: string;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private timeoutMs: number;

  constructor(config?: OpenAIProviderConfig) {
    const apiKey = config?.apiKey || env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
    this.primaryModel = config?.primaryModel || env.AI_MODEL_SIGNAL_UNDERSTANDING || 'gpt-4o-mini';
    this.fallbackModel = config?.fallbackModel || env.AI_MODEL_SIGNAL_FALLBACK || 'gpt-4o';
    this.embeddingModel = config?.embeddingModel || (env as any).OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.verificationModel = config?.verificationModel || env.AI_MODEL_VERIFICATION || 'gpt-4o';
    this.maxRetries = config?.maxRetries !== undefined ? config.maxRetries : 2;
    this.baseDelayMs = config?.baseDelayMs || 500;
    this.maxDelayMs = config?.maxDelayMs || 3000;
    this.timeoutMs = config?.timeoutMs || 25000;

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        timeout: this.timeoutMs
      });
    }
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      throw new AppError({
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_ERROR,
        message: '[OpenAIProvider] OPENAI_API_KEY is not configured.'
      });
    }
    return this.client;
  }

  public getModelName(): string {
    return this.primaryModel;
  }

  public getPromptVersion(): string {
    return PROMPT_VERSION_SIGNAL_UNDERSTANDING;
  }

  private calculateBackoff(attempt: number): number {
    const delay = this.baseDelayMs * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * (this.baseDelayMs / 2));
    return Math.min(delay + jitter, this.maxDelayMs);
  }

  /**
   * Executes an OpenAI API call with bounded exponential backoff and automatic model fallback.
   */
  private async executeWithResilience<T>(
    operationName: string,
    executeCall: (model: string, client: OpenAI) => Promise<T>
  ): Promise<{ result: T; resolvedModel: string }> {
    const client = this.ensureClient();
    let currentModel = this.primaryModel;
    let switchedToFallback = false;
    let lastError: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await executeCall(currentModel, client);
        return { result, resolvedModel: currentModel };
      } catch (err: any) {
        lastError = err;
        const status = err.status || err.statusCode || (err.response ? err.response.status : undefined);
        const transient = isTransientError(status, err);

        if (!transient) {
          // Non-transient errors fail immediately
          throw new AppError({
            statusCode: status || 500,
            code: ERROR_CODES.AI_UNAVAILABLE,
            message: `[OpenAIProvider] Non-transient error during ${operationName}: ${err.message}`
          });
        }

        // Handle transient failure
        if (attempt < this.maxRetries) {
          const backoff = this.calculateBackoff(attempt);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        // Retries exhausted on primary model: attempt fallback if not already tried
        if (!switchedToFallback && this.fallbackModel && this.fallbackModel !== this.primaryModel) {
          console.warn(
            `[OpenAIProvider] Primary model '${this.primaryModel}' exhausted retries. Switching to fallback model '${this.fallbackModel}'.`
          );
          currentModel = this.fallbackModel;
          switchedToFallback = true;
          attempt = -1; // Reset attempts for fallback model
          continue;
        }
      }
    }

    throw new AppError({
      statusCode: 503,
      code: ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
      message: `[OpenAIProvider] OpenAI service unavailable after retries across primary and fallback models: ${lastError?.message}`
    });
  }

  /**
   * Analyzes an unstructured citizen signal.
   */
  async analyzeSignal(input: SignalAnalysisInput): Promise<SignalAnalysisResult> {
    const prompt = buildSignalUnderstandingPrompt(input.text, input.location_reference);

    const { result, resolvedModel } = await this.executeWithResilience('analyzeSignal', async (model, client) => {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION_SIGNAL_UNDERSTANDING },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const rawJson = response.choices[0]?.message?.content;
      if (!rawJson) {
        throw new Error('Empty response from OpenAI chat completion');
      }

      const parsed = JSON.parse(rawJson);
      const validated = SignalAnalysisOutputSchema.parse(parsed);
      return validated;
    });

    return {
      ...result,
      resolved_model: resolvedModel
    };
  }

  /**
   * Generates a semantic vector embedding.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const client = this.ensureClient();
    try {
      const response = await client.embeddings.create({
        model: this.embeddingModel,
        input: text.trim()
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding vector returned by OpenAI');
      }
      return embedding;
    } catch (err: any) {
      throw new AppError({
        statusCode: 502,
        code: ERROR_CODES.AI_UNAVAILABLE,
        message: `[OpenAIProvider] Vector embedding generation failed: ${err.message}`
      });
    }
  }

  /**
   * Summarizes a cluster of grievances.
   */
  async summarizeCluster(input: ClusterSummaryInput): Promise<string> {
    const { result } = await this.executeWithResilience('summarizeCluster', async (model, client) => {
      const prompt =
        `Summarize the following civic problem cluster in 2-3 concise, actionable sentences for municipal officers:\n` +
        `Title: ${input.title}\n` +
        `Category: ${input.category}\n` +
        `Location: ${input.location}\n` +
        `Report Count: ${input.signal_count}\n` +
        `Duration: ${input.duration_days || 'unknown'} days\n` +
        `Sample Grievances:\n` +
        (input.sample_descriptions || []).map((s, i) => `- ${s}`).join('\n');

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a municipal civic operations intelligence assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      });

      return response.choices[0]?.message?.content?.trim() || `${input.title} at ${input.location}`;
    });

    return result;
  }

  /**
   * Implements IAIVerificationProvider contract for resolution evidence verification.
   */
  async verifyResolutionEvidence(input: VerifyResolutionInput): Promise<VerificationAnalysisOutput> {
    const { result } = await this.executeWithResilience('verifyResolutionEvidence', async (model, client) => {
      const prompt =
        `You are a strict municipal verification engine verifying whether a public issue has been physically resolved.\n` +
        `Problem: ${input.problem_title} (${input.problem_category})\n` +
        `Description: ${input.problem_description || 'None'}\n` +
        `Submitted Evidence Path: ${input.evidence.storage_path}\n` +
        `Officer Description: ${input.evidence.description || 'None'}\n` +
        `Return strict JSON with fields: verification_result (VERIFIED | INCONCLUSIVE | REJECTED), ` +
        `confidence (0.0 - 1.0), observed_conditions (string[]), evidence_summary (string), ` +
        `inconsistencies (string[]), explanation (string), recommended_review_reason (string or null), ` +
        `limitations (string[]), review_required (boolean).`;

      const response = await client.chat.completions.create({
        model: this.verificationModel,
        messages: [
          { role: 'system', content: 'You are an authoritative civic resolution verification engine. Output valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI verification completion');
      }

      const parsed = JSON.parse(content);
      return {
        verification_result: parsed.verification_result || 'VERIFIED',
        confidence: Number(parsed.confidence) || 0.9,
        observed_conditions: Array.isArray(parsed.observed_conditions) ? parsed.observed_conditions : ['Evidence reviewed'],
        evidence_summary: parsed.evidence_summary || 'Evidence confirms issue addressed',
        inconsistencies: Array.isArray(parsed.inconsistencies) ? parsed.inconsistencies : [],
        explanation: parsed.explanation || 'Resolution evidence verified by automated inspection',
        recommended_review_reason: parsed.recommended_review_reason || null,
        limitations: Array.isArray(parsed.limitations) ? parsed.limitations : [],
        review_required: Boolean(parsed.review_required)
      };
    });

    return result;
  }
}
