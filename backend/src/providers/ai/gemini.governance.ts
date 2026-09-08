import {
  IGovernanceAIProvider,
  GovernanceAIInput
} from './governance.interface';
import {
  GovernanceQueryResponse,
  GovernanceQueryResponseSchema,
  AppError
} from '@civicpulse/shared';
import { env } from '../../config/env';
import {
  SYSTEM_INSTRUCTION_GOVERNANCE_INTELLIGENCE,
  buildGovernancePrompt,
  PROMPT_VERSION_GOVERNANCE_INTELLIGENCE
} from '../../infrastructure/ai/prompts/governance_intelligence_v1';

export class GeminiGovernanceAIProvider implements IGovernanceAIProvider {
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
    return PROMPT_VERSION_GOVERNANCE_INTELLIGENCE;
  }

  async answerGovernanceQuestion(input: GovernanceAIInput): Promise<GovernanceQueryResponse> {
    if (!this.apiKey) {
      throw new AppError({
        statusCode: 500,
        code: 'CONFIGURATION_ERROR',
        message: 'GEMINI_API_KEY is not configured in production mode for Governance AI.'
      });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const serializedData = JSON.stringify(input.retrieved_data, null, 2);

    const userPrompt = buildGovernancePrompt(
      input.question,
      input.intent,
      input.user.role,
      input.user.department_id,
      serializedData
    );

    const requestPayload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION_GOVERNANCE_INTELLIGENCE }]
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (status ${response.status}): ${errorText}`);
      }

      const rawJson: any = await response.json();
      const candidateText = rawJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error('Gemini Governance API returned empty candidate response text.');
      }

      const parsed = JSON.parse(candidateText);

      // Inject system metadata if missing
      parsed.generated_at = parsed.generated_at || new Date().toISOString();
      parsed.model = this.getModelName();
      parsed.prompt_version = this.getPromptVersion();
      if (!parsed.evidence_labels || parsed.evidence_labels.length === 0) {
        parsed.evidence_labels = input.evidence_labels;
      }

      const validated = GovernanceQueryResponseSchema.parse(parsed);
      return validated as GovernanceQueryResponse;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new AppError({
          statusCode: 504,
          code: 'GATEWAY_TIMEOUT',
          message: 'Gemini Governance AI request timed out after 10000ms.'
        });
      }
      throw new AppError({
        statusCode: 502,
        code: 'AI_PROVIDER_ERROR',
        message: `Gemini Governance API failed: ${err.message}`
      });
    }
  }
}
