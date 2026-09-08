import { IAIProvider, SignalAnalysisInput } from './ai.interface';
import { SignalAnalysisOutput, SignalAnalysisOutputSchema, AppError } from '@civicpulse/shared';
import { env } from '../../config/env';
import {
  SYSTEM_INSTRUCTION_SIGNAL_UNDERSTANDING,
  buildSignalUnderstandingPrompt,
  PROMPT_VERSION_SIGNAL_UNDERSTANDING
} from '../../infrastructure/ai/prompts/signal_understanding_v1';

export class GeminiAIProvider implements IAIProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = env.GEMINI_API_KEY || '';
    this.model = env.AI_MODEL_GENERAL || 'gemini-3.6-flash';
  }

  async analyzeSignal(input: SignalAnalysisInput): Promise<SignalAnalysisOutput> {
    // 1. Production Credential Check
    if (!this.apiKey) {
      throw new AppError({
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
        message: 'GEMINI_API_KEY is not configured in production mode. Set GEMINI_API_KEY or activate DEMO_MODE.'
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
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

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Gemini API HTTP ${res.status}: ${errorText.substring(0, 300)}`);
        }

        const data: any = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          throw new Error('Gemini response did not contain candidates or content text.');
        }

        const parsedJson = JSON.parse(rawText);
        const validated = SignalAnalysisOutputSchema.safeParse(parsedJson);

        if (!validated.success) {
          throw new Error(`Schema validation failed on Gemini output: ${validated.error.message}`);
        }

        return validated.data;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          // Exponential backoff: 500ms, 1000ms
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }

    throw new AppError({
      statusCode: 502,
      code: 'AI_PROVIDER_ERROR',
      message: `Failed to analyze signal with Gemini after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`
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

    const embeddingModel = env.AI_EMBEDDING_MODEL || 'text-embedding-004';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${this.apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${embeddingModel}`,
        content: { parts: [{ text }] }
      })
    });

    if (!res.ok) {
      throw new AppError({
        statusCode: 502,
        code: 'AI_PROVIDER_ERROR',
        message: `Gemini Embedding API returned HTTP ${res.status}`
      });
    }

    const data: any = await res.json();
    const values: number[] = data?.embedding?.values;
    if (!values || !Array.isArray(values)) {
      throw new AppError({
        statusCode: 502,
        code: 'AI_PROVIDER_ERROR',
        message: 'Invalid embedding vector returned from Gemini API'
      });
    }

    return values;
  }

  async summarizeCluster(input: import('./ai.interface').ClusterSummaryInput): Promise<string> {
    const cat = input.category.replace('_', ' ');
    const durationText = input.duration_days ? ` over ${input.duration_days} days` : '';
    return `A concentrated ${cat} disruption is affecting ${input.location}, with ${input.signal_count} related reports${durationText}.`;
  }

  public getModelName(): string {
    return this.model;
  }

  public getPromptVersion(): string {
    return PROMPT_VERSION_SIGNAL_UNDERSTANDING;
  }
}

