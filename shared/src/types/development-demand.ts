/**
 * CivicPulse Development Demand Intelligence — Core Domain Types & Contracts
 * 
 * Strict Production Invariants:
 * 1. Non-political & non-electoral: Zero partisan preference or campaign targeting.
 * 2. Advisory-only: Incapable of autonomous fund allocation or policy approval.
 * 3. Deterministic scoring: All metric dimensions are transparently computed and separately exposed.
 * 4. Authoritative provenance: Persistent and transport entities carry explicit `is_demo` flags.
 * 5. Privacy: Zero citizen PII (no citizen email, phone, auth_user_id, legacy Firebase UID, or residential coordinates).
 */

// ============================================================================
// ENUMS & LIFECYCLE STATES
// ============================================================================

export enum DemandSignalSourceChannel {
  WEB_FORM = 'WEB_FORM',
  VOICE_TRANSCRIPT = 'VOICE_TRANSCRIPT',
  WHATSAPP_MESSAGING = 'WHATSAPP_MESSAGING',
  SMS = 'SMS',
  CIVIC_SIGNAL = 'CIVIC_SIGNAL'
}

export enum DevelopmentOpportunityStatus {
  SURFACED = 'SURFACED',
  IN_REVIEW = 'IN_REVIEW',
  ARCHIVED = 'ARCHIVED'
}

export enum PublicInvestmentStatus {
  PROPOSED = 'PROPOSED',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum DemandEvidenceType {
  DEMAND_SIGNAL = 'DEMAND_SIGNAL',
  INDICATOR = 'INDICATOR',
  INVESTMENT_RECORD = 'INVESTMENT_RECORD'
}

export enum DemandPriorityBand {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// ============================================================================
// PROVENANCE & TRUST CONTRACTS
// ============================================================================

export interface DemandProvenance {
  is_demo: boolean;
  source: string;
  measurement_context?: string;
  confidence?: number;
}

export interface UntrustedNarrative {
  content: string;
  trust: 'untrusted_user_content';
}

// ============================================================================
// DETERMINISTIC METRIC CONTRACTS
// ============================================================================

/**
 * Deterministic Demand Metrics
 * All dimensions are computed deterministically and exposed separately.
 * The Composite Demand Index is an explainable sum on a scale of 0 to 100.
 */
export interface DeterministicDemandMetrics {
  demand_volume_score: number;            // 0–25
  recurrence_score: number;               // 0–20
  geographic_concentration_score: number; // 0–15
  population_exposure_score: number;      // 0–15
  infrastructure_deficit_score: number;   // 0–15
  investment_gap_score: number;           // 0–10
  composite_demand_index: number;         // 0–100
}

// ============================================================================
// MULTILINGUAL SIGNAL CONTRACT
// ============================================================================

export interface NormalizedDemandSignal {
  id: string;
  source_channel: DemandSignalSourceChannel;
  original_language: 'en' | 'or' | 'hi' | 'mixed' | string;
  original_text: string;
  normalized_language: 'en';
  normalized_text: string;
  normalization_confidence: number; // 0.00 to 1.00
  detected_category: string;
  detected_urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  ward_id: string;
  locality_name?: string;
  is_demo: boolean;
  submitted_at: string;
  ingested_at: string;
}

export interface DemandSignal extends NormalizedDemandSignal {
  embedding?: number[]; // 1536-dimensional embedding via gemini-embedding-001
}

// ============================================================================
// DEMAND CLUSTER & AGGREGATE
// ============================================================================

export interface DemandCluster {
  id: string;
  title: string;
  category: string;
  subcategory?: string;
  ward_ids: string[];
  locality_names?: string[];
  centroid?: { lat: number; lng: number };
  signal_count: number;
  first_signal_at: string;
  last_signal_at: string;
  duration_days: number;
  is_demo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DevelopmentDemand {
  id: string;
  title: string;
  category: string;
  ward_id: string;
  locality_name?: string;
  demand_cluster_id: string;
  status: DevelopmentOpportunityStatus;
  signal_count: number;
  first_reported_at: string;
  last_reported_at: string;
  is_demo: boolean;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// CONTEXTUAL INDICATORS & PUBLIC INVESTMENT CONTRACTS
// ============================================================================

export interface DevelopmentIndicator {
  id: string;
  ward_id: string;
  indicator_type: string;
  name: string;
  value: number;
  unit: string;
  measurement_date: string;
  source: string;
  confidence: number; // 0.00 to 1.00
  provenance: DemandProvenance;
}

export interface PublicInvestmentRecord {
  id: string;
  plan_name: string;
  project_id: string;
  category: string;
  ward_ids: string[];
  status: PublicInvestmentStatus;
  documented_budget: number;
  currency: 'INR';
  announcement_date: string;
  source_agency: string;
  source_url: string;
  provenance: DemandProvenance;
}

// ============================================================================
// OPPORTUNITY, EVIDENCE & ANALYSIS RUN CONTRACTS
// ============================================================================

export interface DevelopmentOpportunity {
  id: string;
  title: string;
  category: string;
  ward_id: string;
  demand_cluster_id: string;
  priority_band: DemandPriorityBand;
  metrics: DeterministicDemandMetrics;
  narrative_justification: string;
  uncertainty_notes: string[];
  status: DevelopmentOpportunityStatus;
  is_demo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DemandEvidence {
  id: string;
  opportunity_id: string;
  evidence_type: DemandEvidenceType;
  reference_id: string;
  weight: number; // 0.00 to 1.00
  summary: string;
  is_demo: boolean;
  created_at: string;
}

export interface DemandAnalysisRun {
  id: string;
  executed_at: string;
  model_name: string;
  prompt_version: string;
  signal_count_analyzed: number;
  cluster_count_formed: number;
  opportunity_count_surfaced: number;
  parameters: Record<string, unknown>;
  run_hash: string;
  is_demo: boolean;
}

// ============================================================================
// GOVERNANCE AI CONTRACT
// ============================================================================

export interface DevelopmentDemandAnalysisResponse {
  opportunity_id: string;
  category: string;
  ward_id: string;
  observed_facts: {
    total_signals: number;
    first_detected: string;
    last_detected: string;
    intake_channels: DemandSignalSourceChannel[];
    sample_narratives: UntrustedNarrative[];
  };
  metrics: DeterministicDemandMetrics;
  evidence_citations: {
    signal_ids: string[];
    indicator_sources: string[];
    investment_references: string[];
  };
  advisory_interpretation: {
    summary: string;
    need_justification: string;
    tradeoffs_and_considerations: string[];
  };
  uncertainty: {
    confidence: number; // 0.00 to 1.00
    limitations: string[];
  };
}

// ============================================================================
// PROVIDER INTERFACES
// ============================================================================

export interface IDevelopmentIndicatorProvider {
  getWardIndicators(wardId: string): Promise<DevelopmentIndicator[]>;
  getIndicatorBySector(category: string, wardId: string): Promise<DevelopmentIndicator[]>;
  listAvailableIndicators(): Promise<{ id: string; name: string; unit: string; source: string }[]>;
}

export interface IPublicInvestmentProvider {
  getInvestmentsByWard(wardId: string): Promise<PublicInvestmentRecord[]>;
  getInvestmentsByCategory(category: string): Promise<PublicInvestmentRecord[]>;
}

// ============================================================================
// API CONTRACTS (READ-ORIENTED)
// ============================================================================

export interface DevelopmentDemandOverviewResponse {
  total_active_demands: number;
  total_demand_signals: number;
  top_sectors: { category: string; count: number; composite_index_avg: number }[];
  ward_demand_summary: { ward_id: string; demand_count: number; top_category: string }[];
  is_demo: boolean;
  generated_at: string;
}

export interface DevelopmentDemandClustersResponse {
  clusters: DemandCluster[];
  total_count: number;
  is_demo: boolean;
}

export interface DevelopmentDemandClusterDetailResponse {
  cluster: DemandCluster;
  signals: NormalizedDemandSignal[];
  opportunities: DevelopmentOpportunity[];
  is_demo: boolean;
}

export interface DevelopmentDemandMapFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
  properties: {
    entity_id: string;
    entity_type: 'WARD_HEAT' | 'DEMAND_CLUSTER' | 'OPPORTUNITY';
    category?: string;
    demand_intensity: number;
    ward_id: string;
    signal_count?: number;
    is_demo: boolean;
  };
}

export interface DevelopmentDemandMapResponse {
  type: 'FeatureCollection';
  features: DevelopmentDemandMapFeature[];
  metadata: {
    total_features: number;
    is_demo: boolean;
    generated_at: string;
  };
}

export interface DevelopmentDemandOpportunitiesResponse {
  opportunities: DevelopmentOpportunity[];
  total_count: number;
  is_demo: boolean;
}

export interface DevelopmentDemandOpportunityDetailResponse {
  opportunity: DevelopmentOpportunity;
  cluster: DemandCluster;
  evidence: DemandEvidence[];
  indicators: DevelopmentIndicator[];
  investments: PublicInvestmentRecord[];
  analysis?: DevelopmentDemandAnalysisResponse;
  is_demo: boolean;
}

export interface DevelopmentDemandIndicatorsResponse {
  ward_id: string;
  indicators: DevelopmentIndicator[];
  is_demo: boolean;
}

export interface DevelopmentDemandInvestmentContextResponse {
  investments: PublicInvestmentRecord[];
  total_budget: number;
  is_demo: boolean;
}

export interface DevelopmentDemandAnalyzeRequest {
  opportunity_id?: string;
  cluster_id?: string;
  category?: string;
  ward_id?: string;
}

export interface DevelopmentDemandAnalyzeResponse {
  analysis: DevelopmentDemandAnalysisResponse;
  is_demo: boolean;
  model: string;
  prompt_version: string;
  generated_at: string;
}
