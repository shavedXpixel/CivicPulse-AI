export enum EvidenceStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  INSUFFICIENT = 'INSUFFICIENT'
}

export interface ResolutionEvidence {
  id: string;
  problem_id: string;
  submitted_by: string;
  storage_path: string;
  media_type: string;
  description?: string;
  observed_at?: string;
  submitted_at: string;
  verification_id?: string;
  status: EvidenceStatus;
  created_at: string;
}

export enum VerificationStatus {
  LIKELY_RESOLVED = 'LIKELY_RESOLVED',
  UNCERTAIN = 'UNCERTAIN',
  LIKELY_NOT_RESOLVED = 'LIKELY_NOT_RESOLVED',
  INSUFFICIENT_EVIDENCE = 'INSUFFICIENT_EVIDENCE'
}

export interface VerificationResult {
  id: string;
  problem_id: string;
  evidence_id: string;
  status: VerificationStatus;
  confidence: number;
  observations: string[];
  limitations: string[];
  model?: string;
  prompt_version?: string;
  review_required: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}
