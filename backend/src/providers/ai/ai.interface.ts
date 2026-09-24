import { SignalAnalysisOutput } from '@civicpulse/shared';

export interface SignalAnalysisInput {
  text: string;
  location_reference?: string;
  media_items?: { storage_path: string; mime_type: string }[];
}

export interface ClusterSummaryInput {
  title: string;
  category: string;
  location: string;
  signal_count: number;
  duration_days?: number;
  sample_descriptions?: string[];
}

export interface SignalAnalysisResult extends SignalAnalysisOutput {
  resolved_model?: string;
}

export interface DemandNormalizationInput {
  text: string;
  ward_id?: string;
  locality_name?: string;
}

export interface DemandNormalizationAIOutput {
  detected_language: 'en' | 'or' | 'hi' | 'mixed' | string;
  normalized_text: string;
  detected_category: string;
  detected_urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  extracted_locality?: string | null;
  extracted_ward?: string | null;
  normalization_confidence: number;
  reasoning: string;
  resolved_model?: string;
}

export interface DevelopmentDemandGovernanceInput {
  cluster: any;
  observed_facts: {
    total_signals: number;
    first_detected: string;
    last_detected: string;
    intake_channels: any[];
    sample_narratives: any[];
  };
  metrics: any;
  indicators: any[];
  investments: any[];
}

export interface DevelopmentDemandGovernanceAIOutput {
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
    confidence: number;
    limitations: string[];
  };
  metrics?: any;
  resolved_model?: string;
}

export interface IAIProvider {
  /**
   * Analyzes an unstructured citizen signal and returns structured, schema-validated intelligence.
   */
  analyzeSignal(input: SignalAnalysisInput): Promise<SignalAnalysisResult>;
  generateEmbedding(text: string): Promise<number[]>;
  summarizeCluster(input: ClusterSummaryInput): Promise<string>;
  normalizeDemand?(input: DemandNormalizationInput): Promise<DemandNormalizationAIOutput>;
  interpretDevelopmentDemand?(input: DevelopmentDemandGovernanceInput): Promise<DevelopmentDemandGovernanceAIOutput>;
  getModelName(): string;
  getPromptVersion(): string;
}


