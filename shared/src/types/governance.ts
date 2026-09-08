export enum GovernanceQueryIntent {
  TOP_PROBLEMS = 'TOP_PROBLEMS',
  PROBLEM_DETAILS = 'PROBLEM_DETAILS',
  WHY_RANKED = 'WHY_RANKED',
  WARD_IMPACT = 'WARD_IMPACT',
  DEPARTMENT_PERFORMANCE = 'DEPARTMENT_PERFORMANCE',
  SLA_RISK = 'SLA_RISK',
  TREND_ANALYSIS = 'TREND_ANALYSIS',
  FACILITY_IMPACT = 'FACILITY_IMPACT',
  RESOLUTION_PERFORMANCE = 'RESOLUTION_PERFORMANCE',
  GENERAL_GOVERNANCE_SUMMARY = 'GENERAL_GOVERNANCE_SUMMARY',
  UNSUPPORTED = 'UNSUPPORTED'
}

export enum GovernanceToolName {
  GET_TOP_PROBLEMS = 'getTopProblems',
  GET_PROBLEM_DETAILS = 'getProblemDetails',
  GET_WARD_IMPACT = 'getWardImpact',
  GET_DEPARTMENT_BACKLOG = 'getDepartmentBacklog',
  GET_DEPARTMENT_PERFORMANCE = 'getDepartmentPerformance',
  GET_TREND = 'getTrend',
  GET_SLA_RISK = 'getSlaRisk',
  GET_PROBLEMS_NEAR_FACILITY = 'getProblemsNearFacility',
  GET_PROBLEM_SIGNALS = 'getProblemSignals',
  GET_RESOLUTION_PERFORMANCE = 'getResolutionPerformance',
  GET_PROBLEM_TIMELINE = 'getProblemTimeline'
}

export enum GovernanceSourceType {
  PROBLEM_CLUSTER = 'PROBLEM_CLUSTER',
  DEPARTMENT = 'DEPARTMENT',
  WARD = 'WARD',
  SIGNAL_BATCH = 'SIGNAL_BATCH',
  SLA_RECORD = 'SLA_RECORD',
  EVIDENCE_RECORD = 'EVIDENCE_RECORD',
  DASHBOARD_METRIC = 'DASHBOARD_METRIC'
}

export interface GovernanceSourceCitation {
  source_type: GovernanceSourceType;
  entity_id: string;
  label: string;
  url?: string;
}

export interface GovernanceFact {
  statement: string;
  source_type: 'DATABASE_METRIC' | 'CALCULATED_INSIGHT' | 'VERIFIED_RECORD';
  entity_id?: string;
}

export interface GovernanceMetric {
  label: string;
  value: number | string;
  unit?: string;
}

export interface GovernanceQueryResponse {
  answer: string;
  confidence: number;
  confidence_level: 'HIGH' | 'MODERATE' | 'LOW';
  intent: GovernanceQueryIntent;
  evidence_labels: string[];
  insights: string[];
  metrics: GovernanceMetric[];
  facts: GovernanceFact[];
  sources: GovernanceSourceCitation[];
  supporting_problems: string[];
  recommendations: string[];
  limitations: string[];
  is_demo?: boolean;
  generated_at: string;
  model: string;
  prompt_version: string;
}

export enum InsightType {
  AI_BRIEF = 'AI_BRIEF',
  TREND_EXPLANATION = 'TREND_EXPLANATION',
  PRIORITY_EXPLANATION = 'PRIORITY_EXPLANATION',
  GOVERNANCE_ANSWER = 'GOVERNANCE_ANSWER',
  RECOMMENDATION = 'RECOMMENDATION'
}

export interface AIInsight {
  id: string;
  insight_type: InsightType;
  title: string;
  summary: string;
  scope: Record<string, unknown>;
  supporting_entities: string[];
  supporting_metrics: GovernanceMetric[];
  recommendation?: string;
  confidence?: number;
  generated_at: string;
  model?: string;
  prompt_version?: string;
}

