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
  facts: GovernanceFact[];
  metrics: GovernanceMetric[];
  supporting_problems: string[];
  recommendations: string[];
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
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
