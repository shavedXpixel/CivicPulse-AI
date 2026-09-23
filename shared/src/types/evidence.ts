export enum VerificationResultStatus {
  VERIFIED = 'VERIFIED',
  INCONCLUSIVE = 'INCONCLUSIVE',
  REJECTED = 'REJECTED'
}

// Backward-compatible alias
export const VerificationStatus = VerificationResultStatus;
export type VerificationStatus = VerificationResultStatus;

export enum EvidenceType {
  COMPLETION_PHOTO = 'COMPLETION_PHOTO',
  FIELD_NOTE = 'FIELD_NOTE',
  WORK_LOG = 'WORK_LOG',
  DOCUMENT = 'DOCUMENT',
  WORK_ORDER = 'WORK_ORDER',
  TELEMETRY_LOG = 'TELEMETRY_LOG',
  SUPERVISOR_SIGN_OFF = 'SUPERVISOR_SIGN_OFF'
}

export enum BeforeOrAfter {
  BEFORE = 'BEFORE',
  AFTER = 'AFTER'
}

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
  submitted_at: string;
  evidence_type: EvidenceType;
  storage_path: string;
  media_type?: string;
  media_ids?: string[];
  file_size_bytes?: number;
  sha256_hash?: string;
  description?: string;
  location?: { lat: number; lng: number; reference?: string };
  observed_at?: string;
  before_or_after?: BeforeOrAfter;
  verification_id?: string;
  status: EvidenceStatus;
  is_demo?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BeforeAfterComparison {
  improved: boolean;
  summary: string;
  changes_observed: string[];
  limitations: string[];
}

export enum VerificationFailureReason {
  TIMEOUT = 'TIMEOUT',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SCHEMA_VALIDATION = 'SCHEMA_VALIDATION',
  UNKNOWN = 'UNKNOWN'
}

export type VerificationFailureReasonType =
  | 'TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'SCHEMA_VALIDATION'
  | 'UNKNOWN';

export interface VerificationResult {
  id: string;
  problem_id: string;
  evidence_id: string;
  verification_result: VerificationResultStatus;
  failure_reason?: VerificationFailureReason | VerificationFailureReasonType | null;
  confidence: number;
  observed_conditions: string[];
  evidence_summary: string;
  before_after_comparison?: BeforeAfterComparison;
  inconsistencies: string[];
  explanation: string;
  recommended_review_reason?: string | null;
  limitations: string[];
  review_required: boolean;
  model?: string;
  prompt_version?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

