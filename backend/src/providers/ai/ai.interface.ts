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

export interface IAIProvider {
  /**
   * Analyzes an unstructured citizen signal and returns structured, schema-validated intelligence.
   */
  analyzeSignal(input: SignalAnalysisInput): Promise<SignalAnalysisOutput>;
  generateEmbedding(text: string): Promise<number[]>;
  summarizeCluster(input: ClusterSummaryInput): Promise<string>;
  getModelName(): string;
  getPromptVersion(): string;
}


