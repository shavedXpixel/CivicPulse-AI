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
}
