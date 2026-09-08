import {
  UserProfile,
  GovernanceQueryIntent,
  GovernanceQueryResponse
} from '@civicpulse/shared';

export interface GovernanceAIInput {
  question: string;
  intent: GovernanceQueryIntent;
  user: UserProfile;
  retrieved_data: Record<string, unknown>;
  evidence_labels: string[];
}

export interface IGovernanceAIProvider {
  answerGovernanceQuestion(input: GovernanceAIInput): Promise<GovernanceQueryResponse>;
  getModelName(): string;
  getPromptVersion(): string;
}
