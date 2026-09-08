import {
  ResolutionEvidence,
  VerificationResultStatus,
  BeforeAfterComparison
} from '@civicpulse/shared';

export interface VerifyResolutionInput {
  problem_id: string;
  problem_title: string;
  problem_category: string;
  problem_description?: string;
  evidence: ResolutionEvidence;
  before_evidence?: ResolutionEvidence[];
}

export interface VerificationAnalysisOutput {
  verification_result: VerificationResultStatus;
  confidence: number;
  observed_conditions: string[];
  evidence_summary: string;
  before_after_comparison?: BeforeAfterComparison;
  inconsistencies: string[];
  explanation: string;
  recommended_review_reason?: string | null;
  limitations: string[];
  review_required: boolean;
}

export interface IAIVerificationProvider {
  verifyResolutionEvidence(input: VerifyResolutionInput): Promise<VerificationAnalysisOutput>;
  getModelName(): string;
  getPromptVersion(): string;
}
