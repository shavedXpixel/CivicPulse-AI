import {
  IAIVerificationProvider,
  VerifyResolutionInput,
  VerificationAnalysisOutput
} from './verification.interface';
import { VerificationResultStatus, VerificationResultSchema, AppError } from '@civicpulse/shared';
import { env } from '../../config/env';
import {
  SYSTEM_INSTRUCTION_RESOLUTION_VERIFICATION,
  buildResolutionVerificationPrompt,
  PROMPT_VERSION_RESOLUTION_VERIFICATION
} from '../../infrastructure/ai/prompts/resolution_verification_v1';

export class GeminiVerificationProvider implements IAIVerificationProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = env.GEMINI_API_KEY || '';
    this.model = env.AI_MODEL_GENERAL || 'gemini-3.6-flash';
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
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

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
        const validated = VerificationResultSchema.safeParse(parsedJson);

        if (!validated.success) {
          throw new Error(`Schema validation failed on Gemini verification output: ${validated.error.message}`);
        }

        return validated.data;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }

    // Graceful fallback per user requirement:
    // If provider fails, times out, or output is malformed:
    // verification_result = INCONCLUSIVE, review_required = true
    return {
      verification_result: VerificationResultStatus.INCONCLUSIVE,
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
