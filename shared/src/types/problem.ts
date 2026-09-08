import { GeoCoordinates } from './signal';

export enum ProblemStatus {
  NEW = 'NEW',
  TRIAGED = 'TRIAGED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_VERIFICATION = 'AWAITING_VERIFICATION',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED'
}

export enum ImpactLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ImpactComponents {
  severity_score: number;        // Max 25
  population_score: number;      // Max 20
  duration_score: number;        // Max 15
  concentration_score: number;   // Max 15
  critical_exposure_score: number; // Max 10
  recurrence_score: number;      // Max 10
  evidence_score: number;        // Max 5
}

export type ProvenanceSource = 'REAL' | 'ESTIMATED' | 'SYNTHETIC' | 'UNKNOWN';

export interface DataProvenance {
  geography: ProvenanceSource;
  population: ProvenanceSource;
  facility: ProvenanceSource;
  notes?: string;
}

export interface ProblemCluster extends ImpactComponents {
  id: string;
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  department_id?: string;
  ward_id?: string;
  location?: GeoCoordinates;
  status: ProblemStatus;
  signal_count: number;
  estimated_population?: number;
  duration_days?: number;
  impact_score: number;          // 0 to 100
  impact_level: ImpactLevel;
  impact_explanation?: string;
  confidence?: number;
  centroid_embedding?: number[];
  first_detected_at: string;
  last_updated_at: string;
  created_at: string;
  updated_at: string;
  is_demo?: boolean;
  supporting_media_count?: number;
  assigned_to?: string;
  assigned_at?: string;
  resolved_at?: string;
  closed_at?: string;
  sla_state?: import('./workflow').SLAState;
  data_provenance?: DataProvenance;
}

export enum ClusterRelationshipType {
  DUPLICATE = 'DUPLICATE',
  RELATED = 'RELATED',
  SUPPORTING = 'SUPPORTING'
}

export interface ProblemClusterMember {
  id: string;
  problem_id: string;
  signal_id: string;
  relationship: ClusterRelationshipType;
  similarity: number;
  reason?: string;
  created_at: string;
  signal?: import('./signal').Signal;
}

export interface ProblemFilterQuery {
  limit?: number;
  cursor?: string;
  status?: ProblemStatus;
  impact_level?: ImpactLevel;
  min_impact?: number;
  max_impact?: number;
  category?: string;
  department_id?: string;
  ward_id?: string;
  sort?: 'impact_desc' | 'impact_asc' | 'updated_desc' | 'created_desc';
  search?: string;
}

export interface ProblemClusterDetail extends ProblemCluster {
  members?: ProblemClusterMember[];
  timeline?: {
    id: string;
    timestamp: string;
    action: string;
    actor: string;
    description: string;
    isCompleted?: boolean;
    isCurrent?: boolean;
  }[];
}

export interface CreateProblemClusterInput {
  title: string;
  description?: string;
  category: string;
  ward_id?: string;
  department_id?: string;
  signal_ids?: string[];
  location?: GeoCoordinates;
}

