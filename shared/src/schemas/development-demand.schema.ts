import { z } from 'zod';
import {
  DemandSignalSourceChannel,
  DevelopmentOpportunityStatus,
  PublicInvestmentStatus,
  DemandEvidenceType,
  DemandPriorityBand
} from '../types/development-demand';
import { DEVELOPMENT_DEMAND_SECTORS } from '../constants/demand-taxonomy';

// ============================================================================
// PRIMITIVES & VALUE CONSTRAINTS
// ============================================================================

export const DemandConfidenceSchema = z
  .number()
  .min(0, 'Confidence cannot be less than 0')
  .max(1, 'Confidence cannot exceed 1');

export const DemandProvenanceSchema = z.object({
  is_demo: z.boolean(),
  source: z.string().min(1, 'Source identifier is required'),
  measurement_context: z.string().optional(),
  confidence: DemandConfidenceSchema.optional()
});

export const UntrustedNarrativeSchema = z.object({
  content: z.string().min(1, 'Content must not be empty').max(5000),
  trust: z.literal('untrusted_user_content')
});

// ============================================================================
// DETERMINISTIC METRIC CONSTRAINTS
// ============================================================================

export const DeterministicDemandMetricsSchema = z.object({
  demand_volume_score: z
    .number()
    .min(0, 'Demand volume score min is 0')
    .max(25, 'Demand volume score max is 25'),
  recurrence_score: z
    .number()
    .min(0, 'Recurrence score min is 0')
    .max(20, 'Recurrence score max is 20'),
  geographic_concentration_score: z
    .number()
    .min(0, 'Geographic concentration score min is 0')
    .max(15, 'Geographic concentration score max is 15'),
  population_exposure_score: z
    .number()
    .min(0, 'Population exposure score min is 0')
    .max(15, 'Population exposure score max is 15'),
  infrastructure_deficit_score: z
    .number()
    .min(0, 'Infrastructure deficit score min is 0')
    .max(15, 'Infrastructure deficit score max is 15'),
  investment_gap_score: z
    .number()
    .min(0, 'Investment gap score min is 0')
    .max(10, 'Investment gap score max is 10'),
  composite_demand_index: z
    .number()
    .min(0, 'Composite demand index min is 0')
    .max(100, 'Composite demand index max is 100')
});

export const MetricComponentDetailSchema = z.object({
  metric: z.string().min(1),
  score: z.number().min(0),
  max_score: z.number().positive(),
  raw_inputs: z.record(z.unknown()),
  formula: z.string().min(1),
  explanation: z.string().min(1),
  data_available: z.boolean(),
  provenance: DemandProvenanceSchema
});

export const DetailedDemandMetricsResultSchema = z.object({
  metrics: DeterministicDemandMetricsSchema,
  priority_band: z.nativeEnum(DemandPriorityBand),
  components: z.object({
    demand_volume: MetricComponentDetailSchema,
    recurrence: MetricComponentDetailSchema,
    geographic_concentration: MetricComponentDetailSchema,
    population_exposure: MetricComponentDetailSchema,
    infrastructure_deficit: MetricComponentDetailSchema,
    investment_gap: MetricComponentDetailSchema
  }),
  calculated_at: z.string().datetime(),
  is_demo: z.boolean()
});

// ============================================================================
// MULTILINGUAL DEMAND SIGNAL SCHEMA
// ============================================================================

export const NormalizedDemandSignalSchema = z.object({
  id: z.string().min(1, 'Signal ID is required'),
  source_channel: z.nativeEnum(DemandSignalSourceChannel),
  original_language: z.string().min(1, 'Original language code is required'),
  original_text: z.string().min(1, 'Original text is required').max(10000),
  normalized_language: z.literal('en'),
  normalized_text: z.string().min(1, 'Normalized text is required').max(5000),
  normalization_confidence: DemandConfidenceSchema,
  detected_category: z.string().min(1, 'Detected category is required'),
  detected_urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  ward_id: z.string().min(1, 'Ward ID is required'),
  locality_name: z.string().max(200).optional(),
  embedding: z.array(z.number()).length(1536).optional(),
  is_demo: z.boolean(),
  submitted_at: z.string().datetime({ message: 'Must be valid ISO timestamp' }),
  ingested_at: z.string().datetime({ message: 'Must be valid ISO timestamp' })
});

export const DemandSignalSchema = NormalizedDemandSignalSchema;

// ============================================================================
// DEMAND CLUSTER & DEMAND SCHEMAS
// ============================================================================

export const DemandClusterSchema = z.object({
  id: z.string().min(1, 'Cluster ID is required'),
  title: z.string().min(1).max(300),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  ward_ids: z.array(z.string()).min(1, 'At least one ward is required'),
  locality_names: z.array(z.string()).optional(),
  centroid: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180)
    })
    .optional(),
  signal_count: z.number().int().nonnegative(),
  first_signal_at: z.string().datetime(),
  last_signal_at: z.string().datetime(),
  duration_days: z.number().nonnegative(),
  is_demo: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional()
});

export const DevelopmentDemandSchema = z.object({
  id: z.string().min(1, 'Demand ID is required'),
  title: z.string().min(1).max(300),
  category: z.string().min(1),
  ward_id: z.string().min(1),
  locality_name: z.string().max(200).optional(),
  demand_cluster_id: z.string().min(1),
  status: z.nativeEnum(DevelopmentOpportunityStatus),
  signal_count: z.number().int().nonnegative(),
  first_reported_at: z.string().datetime(),
  last_reported_at: z.string().datetime(),
  is_demo: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional()
});

// ============================================================================
// CONTEXTUAL INDICATORS & PUBLIC INVESTMENT SCHEMAS
// ============================================================================

export const DevelopmentIndicatorSchema = z.object({
  id: z.string().min(1, 'Indicator ID is required'),
  ward_id: z.string().min(1),
  indicator_type: z.string().min(1),
  type: z.string().optional(),
  name: z.string().min(1).max(200),
  value: z.number(),
  unit: z.string().min(1).max(50),
  measurement_date: z.string().datetime(),
  date: z.string().datetime().optional(),
  source: z.string().min(1).max(200),
  confidence: DemandConfidenceSchema,
  provenance: DemandProvenanceSchema,
  is_demo: z.boolean().optional()
});

export const PublicInvestmentRecordSchema = z.object({
  id: z.string().min(1, 'Investment record ID is required'),
  plan_name: z.string().min(1).max(300),
  project_id: z.string().min(1).max(100),
  category: z.string().min(1),
  ward_ids: z.array(z.string()).min(1),
  status: z.nativeEnum(PublicInvestmentStatus),
  documented_budget: z.number().nonnegative(),
  currency: z.literal('INR'),
  announcement_date: z.string().datetime(),
  date: z.string().datetime().optional(),
  announcement: z.string().optional(),
  source_agency: z.string().min(1).max(200),
  source_url: z.string().url().max(1000),
  provenance: DemandProvenanceSchema,
  is_demo: z.boolean().optional()
});

// ============================================================================
// OPPORTUNITY, EVIDENCE & ANALYSIS RUN SCHEMAS
// ============================================================================

export const DevelopmentOpportunitySchema = z.object({
  id: z.string().min(1, 'Opportunity ID is required'),
  title: z.string().min(1).max(300),
  category: z.string().min(1),
  ward_id: z.string().min(1),
  demand_cluster_id: z.string().min(1),
  priority_band: z.nativeEnum(DemandPriorityBand),
  metrics: DeterministicDemandMetricsSchema,
  narrative_justification: z.string().min(1).max(2000),
  uncertainty_notes: z.array(z.string()),
  status: z.nativeEnum(DevelopmentOpportunityStatus),
  is_demo: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().optional()
});

export const DemandEvidenceSchema = z.object({
  id: z.string().min(1, 'Evidence ID is required'),
  opportunity_id: z.string().min(1),
  evidence_type: z.nativeEnum(DemandEvidenceType),
  reference_id: z.string().min(1),
  weight: DemandConfidenceSchema,
  summary: z.string().min(1).max(1000),
  is_demo: z.boolean(),
  created_at: z.string().datetime()
});

export const DemandAnalysisRunSchema = z.object({
  id: z.string().min(1, 'Analysis run ID is required'),
  executed_at: z.string().datetime(),
  model_name: z.string().min(1),
  prompt_version: z.string().min(1),
  signal_count_analyzed: z.number().int().nonnegative(),
  cluster_count_formed: z.number().int().nonnegative(),
  opportunity_count_surfaced: z.number().int().nonnegative(),
  parameters: z.record(z.unknown()),
  run_hash: z.string().min(1),
  is_demo: z.boolean()
});

// ============================================================================
// GOVERNANCE AI ANALYSIS RESPONSE SCHEMA
// ============================================================================

export const DevelopmentDemandAnalysisResponseSchema = z.object({
  opportunity_id: z.string().min(1),
  category: z.string().min(1),
  ward_id: z.string().min(1),
  observed_facts: z.object({
    total_signals: z.number().int().nonnegative(),
    first_detected: z.string().datetime(),
    last_detected: z.string().datetime(),
    intake_channels: z.array(z.nativeEnum(DemandSignalSourceChannel)),
    sample_narratives: z.array(UntrustedNarrativeSchema)
  }),
  metrics: DeterministicDemandMetricsSchema,
  evidence_citations: z.object({
    signal_ids: z.array(z.string()),
    indicator_sources: z.array(z.string()),
    investment_references: z.array(z.string())
  }),
  advisory_interpretation: z.object({
    summary: z.string().min(1),
    need_justification: z.string().min(1),
    tradeoffs_and_considerations: z.array(z.string())
  }),
  uncertainty: z.object({
    confidence: DemandConfidenceSchema,
    limitations: z.array(z.string())
  })
});

// ============================================================================
// API REQUEST & QUERY SCHEMAS
// ============================================================================

export const DevelopmentDemandAnalyzeRequestSchema = z.object({
  opportunity_id: z.string().optional(),
  cluster_id: z.string().optional(),
  category: z.string().optional(),
  ward_id: z.string().optional()
});

export const DevelopmentDemandQuerySchema = z.object({
  ward_id: z.string().optional(),
  category: z.string().optional(),
  status: z.nativeEnum(DevelopmentOpportunityStatus).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional()
});
