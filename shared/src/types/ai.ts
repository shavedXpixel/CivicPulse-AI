export enum AIOperationType {
  LANGUAGE_DETECTION = 'LANGUAGE_DETECTION',
  SIGNAL_UNDERSTANDING = 'SIGNAL_UNDERSTANDING',
  CLASSIFICATION = 'CLASSIFICATION',
  DEPARTMENT_RECOMMENDATION = 'DEPARTMENT_RECOMMENDATION',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  RESOLUTION_VERIFICATION = 'RESOLUTION_VERIFICATION',
  GOVERNANCE_QUERY = 'GOVERNANCE_QUERY',
  INTERVENTION_SIMULATION = 'INTERVENTION_SIMULATION'
}

export enum AIOperationStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING'
}

export interface AIOperationRecord {
  id: string;
  operation_type: AIOperationType;
  entity_type: 'signal' | 'problem_cluster' | 'resolution_evidence' | 'governance_query' | 'intervention_simulation';
  entity_id: string;
  model: string;
  prompt_version: string;
  status: AIOperationStatus;
  confidence?: number;
  latency_ms?: number;
  error_code?: string;
  created_at: string;
}

export interface SignalAIAnalysis {
  detected_language: string;
  normalized_summary: string;
  category: string;
  subcategory?: string | null;
  severity: 'UNKNOWN' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affected_scope?: string | null;
  duration_days?: number | null;
  location_reference?: string | null;
  recommended_department?: string | null;
  entities: string[];
  critical_facility?: string | null;
  confidence: number;
  explanation: string;
  image_findings: string[];
}
