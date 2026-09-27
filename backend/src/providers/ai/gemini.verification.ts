import {
  IAIVerificationProvider,
  VerifyResolutionInput,
  VerificationAnalysisOutput
} from './verification.interface';
import {
  VerificationResultStatus,
  VerificationFailureReason,
  VerificationResultSchema,
  AppError
} from '@civicpulse/shared';
import { env } from '../../config/env';
import {
  SYSTEM_INSTRUCTION_RESOLUTION_VERIFICATION,
  buildResolutionVerificationPrompt,
  PROMPT_VERSION_RESOLUTION_VERIFICATION
} from '../../infrastructure/ai/prompts/resolution_verification_v1';

export class GeminiVerificationProvider implements IAIVerificationProvider {
  public static readonly TIMEOUT_MS = 30000; // 30s timeout aligned with standard Gemini SLA
  public static readonly MAX_RETRIES = 3;

  private apiKey: string;
  private model: string;

  constructor(model?: string) {
    this.apiKey = env.GEMINI_API_KEY || '';
    this.model = model || env.GEMINI_MODEL_VERIFICATION || process.env.GEMINI_MODEL_VERIFICATION || 'gemini-3.5-flash-lite';
  }

  public getModelName(): string {
    return this.model;
  }

  public getPromptVersion(): string {
    return PROMPT_VERSION_RESOLUTION_VERIFICATION;
  }

  async verifyResolutionEvidence(input: VerifyResolutionInput): Promise<VerificationAnalysisOutput> {
    if (!this.apiKey) {
      throw new AppError({
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
        message: 'GEMINI_API_KEY is not configured in production mode for verification.'
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const beforeSummary = input.before_evidence
      ? input.before_evidence.map((b) => `[${b.evidence_type}] ${b.description || ''}`).join('\n')
      : undefined;

    const userPrompt = buildResolutionVerificationPrompt(
      input.problem_title,
      input.problem_category,
      input.problem_description,
      input.evidence.evidence_type,
      input.evidence.description,
      beforeSummary
    );

    const requestPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION_RESOLUTION_VERIFICATION }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    let lastError: Error | null = null;
    let failureReason: VerificationFailureReason = VerificationFailureReason.UNKNOWN;
    const maxRetries = GeminiVerificationProvider.MAX_RETRIES;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let isDeterministicFailure = false;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GeminiVerificationProvider.TIMEOUT_MS);

      try {
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
          const status = res.status;
          const errorText = await res.text();
          // Never log raw endpoint with apiKey query parameter
          const sanitizedSnippet = errorText.substring(0, 300).replace(this.apiKey, '[REDACTED]');
          
          if (status === 503 || status >= 500) {
            failureReason = VerificationFailureReason.PROVIDER_UNAVAILABLE;
            throw new Error(`Gemini API HTTP ${status}: ${sanitizedSnippet}`);
          } else {
            // HTTP 4xx (400, 401, 403, 404): deterministic client error, do not retry
            failureReason = VerificationFailureReason.INVALID_RESPONSE;
            isDeterministicFailure = true;
            throw new Error(`Gemini API HTTP ${status}: ${sanitizedSnippet}`);
          }
        }

        let data: any;
        try {
          data = await res.json();
        } catch (jsonErr: any) {
          failureReason = VerificationFailureReason.INVALID_RESPONSE;
          isDeterministicFailure = true;
          throw new Error('Gemini response could not be parsed as valid JSON.');
        }

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          failureReason = VerificationFailureReason.INVALID_RESPONSE;
          isDeterministicFailure = true;
          throw new Error('Gemini response did not contain candidates or content text.');
        }

        let parsedJson: any;
        try {
          parsedJson = JSON.parse(rawText);
        } catch (parseErr: any) {
          failureReason = VerificationFailureReason.INVALID_RESPONSE;
          isDeterministicFailure = true;
          throw new Error(`Candidate text could not be parsed as JSON: ${parseErr.message}`);
        }

        const validated = VerificationResultSchema.safeParse(parsedJson);

        if (!validated.success) {
          failureReason = VerificationFailureReason.SCHEMA_VALIDATION;
          isDeterministicFailure = true;
          throw new Error(`Schema validation failed on Gemini verification output: ${validated.error.message}`);
        }

        // Legitimate model response: failure_reason MUST be undefined even if INCONCLUSIVE
        return {
          ...validated.data,
          failure_reason: undefined
        };
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;

        if (controller.signal.aborted || err?.name === 'AbortError' || (err?.message && err.message.toLowerCase().includes('timeout'))) {
          failureReason = VerificationFailureReason.TIMEOUT;
        } else if (!isDeterministicFailure && failureReason === VerificationFailureReason.UNKNOWN) {
          failureReason = VerificationFailureReason.PROVIDER_UNAVAILABLE;
        }

        // Do not retry deterministic validation or client failures
        if (isDeterministicFailure) {
          break;
        }

        // Bounded exponential backoff with small random jitter for transient errors
        if (attempt < maxRetries) {
          const baseDelay = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms
          const jitter = Math.floor(Math.random() * 100 * attempt); // 0-100ms, 0-200ms
          const delay = Math.min(2000, baseDelay + jitter);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    // Graceful fallback per user requirement:
    // If provider fails, times out, or output is malformed:
    // verification_result = INCONCLUSIVE, failure_reason = structured enum, review_required = true
    return {
      verification_result: VerificationResultStatus.INCONCLUSIVE,
      failure_reason: failureReason,
      confidence: 0.5,
      observed_conditions: ['Automated AI provider verification unavailable; fallback invoked.'],
      evidence_summary: 'AI verification encountered a provider timeout or failure. Falling back to human review.',
      inconsistencies: [`Provider error: ${lastError?.message || 'Unknown provider failure'}`],
      explanation: 'AI verification service was unable to evaluate evidence within SLA. Human supervisor review is required.',
      recommended_review_reason: 'AI service unavailable. Conduct manual verification of submitted evidence.',
      limitations: ['AI analysis was bypassed due to service unavailability.'],
      review_required: true
    };
  }
}
