export enum SignalSourceType {
  CITIZEN = 'CITIZEN',
  FIELD_OFFICER = 'FIELD_OFFICER',
  IMPORTED_GRIEVANCE = 'IMPORTED_GRIEVANCE',
  SURVEY = 'SURVEY',
  SYSTEM = 'SYSTEM',
  OTHER = 'OTHER'
}

export enum SignalSeverity {
  UNKNOWN = 'UNKNOWN',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum SignalStatus {
  ACTIVE = 'ACTIVE',
  PROCESSED = 'PROCESSED',
  ATTACHED_TO_PROBLEM = 'ATTACHED_TO_PROBLEM',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED'
}

export enum SignalProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REQUIRES_REVIEW = 'REQUIRES_REVIEW'
}

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface SignalMediaItem {
  id: string;
  signal_id: string;
  storage_path: string;
  media_type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
  mime_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  created_at: string;
  analysis_status?: 'NOT_ANALYZED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
}

export interface Signal {
  id: string;
  source_type: SignalSourceType;
  source_reference?: string;
  citizen_id?: string;
  original_text?: string;
  normalized_text?: string;
  language?: string;
  category?: string;
  subcategory?: string;
  severity: SignalSeverity;
  duration_days?: number;
  department_id?: string;
  ward_id?: string;
  location?: GeoCoordinates;
  location_reference?: string;
  critical_facility?: string;
  status: SignalStatus;
  problem_cluster_id?: string;
  processing_status: SignalProcessingStatus;
  ai_confidence?: number;
  embedding?: number[];
  created_at: string;
  updated_at: string;
  submitted_at?: string;
}
