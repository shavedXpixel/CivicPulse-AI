import {
  IAIProvider,
  SignalAnalysisInput,
  SignalAnalysisResult,
  ClusterSummaryInput,
  DemandNormalizationInput,
  DemandNormalizationAIOutput
} from './ai.interface';
import {
  SignalAnalysisOutput,
  SignalAnalysisOutputSchema,
  AppError,
  DEVELOPMENT_DEMAND_SECTORS
} from '@civicpulse/shared';
import { env } from '../../config/env';
import {
  SYSTEM_INSTRUCTION_SIGNAL_UNDERSTANDING,
  buildSignalUnderstandingPrompt,
  PROMPT_VERSION_SIGNAL_UNDERSTANDING
} from '../../infrastructure/ai/prompts/signal_understanding_v1';
import {
  SYSTEM_INSTRUCTION_DEVELOPMENT_DEMAND_NORMALIZATION,
  buildDemandNormalizationPrompt,
  PROMPT_VERSION_DEVELOPMENT_DEMAND_NORMALIZATION
} from '../../infrastructure/ai/prompts/development_demand_normalization_v1';

export interface GeminiAIProviderConfig {
  apiKey?: string;
  primaryModel?: string;
  fallbackModel?: string;
  embeddingModel?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

/**
 * Determines whether an error or HTTP status code represents a transient provider failure.
 * Transient errors include:
 * - 503 Service Unavailable (e.g., "This model is currently experiencing high demand")
 * - 429 Too Many Requests (Rate limit / Quota exhaustion)
 * - 408 Request Timeout
 * - 500 / 502 / 504 Gateway & Server transient issues
 * - Fetch timeouts, AbortError, and network drops
 *
 * Non-transient errors (e.g. 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422)
 * MUST NOT be retried and MUST NOT trigger fallback.
 */
export function isTransientError(status?: number, err?: Error): boolean {
  if (status !== undefined && status !== null) {
    if ([503, 429, 408, 500, 502, 504].includes(status)) {
      return true;
    }
    if ([400, 401, 403, 404, 422].includes(status)) {
      return false;
    }
  }

  if (err) {
    const msg = (err.message || '').toLowerCase();
    const name = err.name || '';
    if (
      name === 'AbortError' ||
      msg.includes('timeout') ||
      msg.includes('high demand') ||
      msg.includes('service unavailable') ||
      msg.includes('rate limit') ||
      msg.includes('resource exhausted') ||
      msg.includes('resource_exhausted') ||
      msg.includes('exhausted') ||
      msg.includes('quota') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('fetch failed') ||
      msg.includes('503') ||
      msg.includes('429') ||
      msg.includes('408') ||
      msg.includes('502') ||
      msg.includes('500')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates exponential backoff with proportional jitter.
 * Formula: min(maxDelayMs, baseDelayMs * 2^(attempt - 1)) + jitter
 */
export function calculateBackoffWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const expDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
  const jitter = Math.random() * 0.3 * expDelay;
  return Math.round(expDelay + jitter);
}

export class GeminiAIProvider implements IAIProvider {
  private apiKey: string;
  private primaryModel: string;
  private fallbackModel: string;
  private embeddingModel: string;
  private lastUsedModel?: string;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private timeoutMs: number;

  constructor(config?: GeminiAIProviderConfig) {
    this.apiKey = config?.apiKey ?? env.GEMINI_API_KEY ?? '';
    this.primaryModel =
      config?.primaryModel ??
      env.GEMINI_PRIMARY_MODEL ??
      env.AI_MODEL_GENERAL ??
      'gemini-3.6-flash';
    this.fallbackModel =
      config?.fallbackModel ??
      env.GEMINI_FALLBACK_MODEL ??
      'gemini-3.5-flash';
    this.embeddingModel =
      config?.embeddingModel ??
      env.AI_EMBEDDING_MODEL ??
      env.AI_MODEL_EMBEDDING ??
      'gemini-embedding-001';
    this.maxRetries = config?.maxRetries ?? 3;
    this.baseDelayMs =
      config?.baseDelayMs ?? (process.env.NODE_ENV === 'test' ? 10 : 500);
    this.maxDelayMs = config?.maxDelayMs ?? 5000;
    this.timeoutMs = config?.timeoutMs ?? 30000;
  }

  /**
   * Invokes Gemini generateContent for a specific model with structured output contract.
   */
  private async callGenerateContent(
    modelName: string,
    input: SignalAnalysisInput
  ): Promise<SignalAnalysisOutput> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
    const userPrompt = buildSignalUnderstandingPrompt(input.text, input.location_reference);

    const requestPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION_SIGNAL_UNDERSTANDING }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err: any = new Error(`Gemini API HTTP ${res.status}: ${errorText.substring(0, 300)}`);
        err.status = res.status;
        err.statusCode = res.status;
        err.model = modelName;
        throw err;
      }

      const data: any = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        const err: any = new Error(
          `Gemini response did not contain candidates or content text from model ${modelName}.`
        );
        err.status = 502;
        err.model = modelName;
        throw err;
      }

      const parsedJson = JSON.parse(rawText);
      const validated = SignalAnalysisOutputSchema.safeParse(parsedJson);

      if (!validated.success) {
        const err: any = new Error(
          `Schema validation failed on Gemini output from model ${modelName}: ${validated.error.message}`
        );
        err.status = 502;
        err.model = modelName;
        throw err;
      }

      return validated.data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Analyzes an unstructured civic signal with bounded retry, exponential backoff with jitter,
   * and automatic fallback to a secondary model on transient provider exhaustion.
   */
  async analyzeSignal(input: SignalAnalysisInput): Promise<SignalAnalysisResult> {
    if (!this.apiKey) {
      throw new AppError({
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
        message: 'GEMINI_API_KEY is not configured in production mode. Set GEMINI_API_KEY or activate DEMO_MODE.'
      });
    }

    const modelsToTry = [this.primaryModel];
    if (this.fallbackModel && this.fallbackModel !== this.primaryModel) {
      modelsToTry.push(this.fallbackModel);
    }

    let lastError: Error | null = null;
    let allTransient = true;

    for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
      const currentModel = modelsToTry[mIdx]!;
      const isFallback = mIdx > 0;

      if (isFallback) {
        console.warn(
          `[GeminiAIProvider] Primary model '${this.primaryModel}' exhausted retries on transient errors. Switching to fallback model: '${currentModel}'`
        );
      }

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const result = await this.callGenerateContent(currentModel, input);
          this.lastUsedModel = currentModel;
          return {
            ...result,
            resolved_model: currentModel
          };
        } catch (err: any) {
          lastError = err;
          const status = err.status || err.statusCode;
          const transient = isTransientError(status, err);

          if (!transient) {
            // Non-transient errors (400, 401, 403, 404, 422) MUST NOT trigger unnecessary retry or fallback
            allTransient = false;
            if (err instanceof AppError) {
              throw err;
            }
            throw new AppError({
              statusCode: status || 400,
              code: status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : 'INVALID_REQUEST',
              message: `Gemini non-transient error on model ${currentModel}: ${err.message}`
            });
          }

          // Transient error: retry if attempts remain for this model
          if (attempt < this.maxRetries) {
            const delay = calculateBackoffWithJitter(attempt, this.baseDelayMs, this.maxDelayMs);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
    }

    // Both primary and fallback exhausted their retry attempts
    if (allTransient) {
      throw new AppError({
        statusCode: 503,
        code: 'AI_PROVIDER_UNAVAILABLE',
        message: `Gemini AI provider is unavailable. Both primary (${this.primaryModel}) and fallback (${this.fallbackModel}) models exhausted ${this.maxRetries} attempts due to transient errors: ${lastError?.message || 'High demand'}`
      });
    }

    throw new AppError({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
      message: `Failed to analyze signal with Gemini after retry and fallback attempts: ${lastError?.message || 'Unknown error'}`
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new AppError({
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
        message: 'GEMINI_API_KEY is not configured in production mode for embeddings.'
      });
    }

    const embeddingModel = this.embeddingModel;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${this.apiKey}`;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: `models/${embeddingModel}`,
            content: { parts: [{ text }] },
            outputDimensionality: env.AI_EMBEDDING_DIMENSIONS || 1536
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text();
          const err: any = new Error(`Gemini Embedding API returned HTTP ${res.status}: ${errorText.substring(0, 300)}`);
          err.status = res.status;
          throw err;
        }

        const data: any = await res.json();
        const values: number[] = data?.embedding?.values;
        if (!values || !Array.isArray(values)) {
          const err: any = new Error('Invalid embedding vector returned from Gemini API');
          err.status = 502;
          throw err;
        }

        return values;
      } catch (err: any) {
        lastError = err;
        const status = err.status || err.statusCode;
        if (!isTransientError(status, err)) {
          throw new AppError({
            statusCode: status || 502,
            code: 'AI_PROVIDER_ERROR',
            message: `Gemini Embedding API non-transient error: ${err.message}`
          });
        }
        if (attempt < this.maxRetries) {
          const delay = calculateBackoffWithJitter(attempt, this.baseDelayMs, this.maxDelayMs);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new AppError({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
      message: `Gemini Embedding API failed after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
    });
  }

  async summarizeCluster(input: ClusterSummaryInput): Promise<string> {
    const cat = input.category.replace('_', ' ');
    const durationText = input.duration_days ? ` over ${input.duration_days} days` : '';
    return `A concentrated ${cat} disruption is affecting ${input.location}, with ${input.signal_count} related reports${durationText}.`;
  }

  /**
   * Invokes Gemini generateContent for demand normalization with structured JSON schema.
   */
  private async callGenerateDemandNormalization(
    modelName: string,
    input: DemandNormalizationInput
  ): Promise<DemandNormalizationAIOutput> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
    const userPrompt = buildDemandNormalizationPrompt(input.text, {
      ward_id: input.ward_id,
      locality_name: input.locality_name
    });

    const requestPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION_DEVELOPMENT_DEMAND_NORMALIZATION }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err: any = new Error(`Gemini Demand API HTTP ${res.status}: ${errorText.substring(0, 300)}`);
        err.status = res.status;
        err.statusCode = res.status;
        err.model = modelName;
        throw err;
      }

      const data: any = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        const err: any = new Error(
          `Gemini demand normalization response did not contain candidates or content text from model ${modelName}.`
        );
        err.status = 502;
        err.model = modelName;
        throw err;
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (jsonErr: any) {
        const err: any = new Error(
          `Malformed JSON returned by Gemini demand normalization from model ${modelName}: ${jsonErr.message}`
        );
        err.status = 502;
        err.model = modelName;
        throw err;
      }

      // Validate taxonomy category against canonical HF7.1 taxonomy
      if (!parsedJson.detected_category || !DEVELOPMENT_DEMAND_SECTORS.includes(parsedJson.detected_category as any)) {
        const err: any = new Error(
          `Invalid or non-canonical taxonomy category '${parsedJson.detected_category}' returned by Gemini from model ${modelName}. Must be one of canonical HF7.1 taxonomy sectors.`
        );
        err.status = 502;
        err.model = modelName;
        throw err;
      }

      // Validate urgency
      if (!['LOW', 'MEDIUM', 'HIGH'].includes(parsedJson.detected_urgency)) {
        const err: any = new Error(
          `Invalid urgency '${parsedJson.detected_urgency}' returned by Gemini. Must be LOW, MEDIUM, or HIGH.`
        );
        err.status = 502;
        err.model = modelName;
        throw err;
      }

      // Validate confidence
      const confidence = Number(parsedJson.normalization_confidence);
      if (isNaN(confidence) || confidence < 0 || confidence > 1) {
        const err: any = new Error(
          `Invalid normalization confidence '${parsedJson.normalization_confidence}' returned by Gemini. Must be between 0.0 and 1.0.`
        );
        err.status = 502;
        err.model = modelName;
        throw err;
      }

      // Validate normalized_text
      if (!parsedJson.normalized_text || typeof parsedJson.normalized_text !== 'string') {
        const err: any = new Error(`Missing or invalid normalized_text in Gemini demand normalization output.`);
        err.status = 502;
        err.model = modelName;
        throw err;
      }

      return {
        detected_language: parsedJson.detected_language || 'en',
        normalized_text: parsedJson.normalized_text,
        detected_category: parsedJson.detected_category,
        detected_urgency: parsedJson.detected_urgency,
        extracted_locality: parsedJson.extracted_locality || undefined,
        extracted_ward: parsedJson.extracted_ward || undefined,
        normalization_confidence: confidence,
        reasoning: parsedJson.reasoning || 'Categorized via canonical municipal development taxonomy.',
        resolved_model: modelName
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Normalizes a multilingual development demand signal using Gemini with bounded retry,
   * exponential backoff with jitter, and automatic fallback.
   */
  async normalizeDemand(input: DemandNormalizationInput): Promise<DemandNormalizationAIOutput> {
    if (!this.apiKey) {
      throw new AppError({
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
        message: 'GEMINI_API_KEY is not configured in production mode for demand normalization.'
      });
    }

    const modelsToTry = [this.primaryModel];
    if (this.fallbackModel && this.fallbackModel !== this.primaryModel) {
      modelsToTry.push(this.fallbackModel);
    }

    let lastError: Error | null = null;
    let allTransient = true;

    for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
      const currentModel = modelsToTry[mIdx]!;
      const isFallback = mIdx > 0;

      if (isFallback) {
        console.warn(
          `[GeminiAIProvider] Primary model '${this.primaryModel}' exhausted retries on transient errors during demand normalization. Switching to fallback model: '${currentModel}'`
        );
      }

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const result = await this.callGenerateDemandNormalization(currentModel, input);
          this.lastUsedModel = currentModel;
          return {
            ...result,
            resolved_model: currentModel
          };
        } catch (err: any) {
          lastError = err;
          const status = err.status || err.statusCode;
          const transient = isTransientError(status, err);

          if (!transient) {
            allTransient = false;
            if (err instanceof AppError) {
              throw err;
            }
            throw new AppError({
              statusCode: status || 502,
              code: 'AI_PROVIDER_ERROR',
              message: `Gemini demand normalization error on model ${currentModel}: ${err.message}`
            });
          }

          if (attempt < this.maxRetries) {
            const delay = calculateBackoffWithJitter(attempt, this.baseDelayMs, this.maxDelayMs);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
    }

    if (allTransient) {
      throw new AppError({
        statusCode: 503,
        code: 'AI_PROVIDER_UNAVAILABLE',
        message: `Gemini AI provider is unavailable for demand normalization. Both primary (${this.primaryModel}) and fallback (${this.fallbackModel}) models exhausted ${this.maxRetries} attempts due to transient errors: ${lastError?.message || 'High demand'}`
      });
    }

    throw new AppError({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
      message: `Failed to normalize demand with Gemini after retry and fallback attempts: ${lastError?.message || 'Unknown error'}`
    });
  }

  public getModelName(): string {
    return this.lastUsedModel || this.primaryModel;
  }

  public getPrimaryModel(): string {
    return this.primaryModel;
  }

  public getFallbackModel(): string {
    return this.fallbackModel;
  }

  public getLastUsedModel(): string | undefined {
    return this.lastUsedModel;
  }

  public getPromptVersion(): string {
    return PROMPT_VERSION_SIGNAL_UNDERSTANDING;
  }

  public getDemandPromptVersion(): string {
    return PROMPT_VERSION_DEVELOPMENT_DEMAND_NORMALIZATION;
  }
}
