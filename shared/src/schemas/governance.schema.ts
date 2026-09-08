import { z } from 'zod';
import {
  GovernanceQueryIntent,
  GovernanceSourceType
} from '../types/governance';

export const GovernanceQueryInputSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty').max(1000, 'Question too long'),
  context: z
    .object({
      ward_id: z.string().optional(),
      department_id: z.string().optional(),
      time_range: z.string().optional()
    })
    .optional()
});

export type GovernanceQueryInput = z.infer<typeof GovernanceQueryInputSchema>;

export const GovernanceSourceCitationSchema = z.object({
  source_type: z.nativeEnum(GovernanceSourceType),
  entity_id: z.string(),
  label: z.string(),
  url: z.string().optional()
});

export const GovernanceFactSchema = z.object({
  statement: z.string(),
  source_type: z.enum(['DATABASE_METRIC', 'CALCULATED_INSIGHT', 'VERIFIED_RECORD']),
  entity_id: z.string().optional()
});

export const GovernanceMetricSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional()
});

export const GovernanceQueryResponseSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1),
  confidence_level: z.enum(['HIGH', 'MODERATE', 'LOW']),
  intent: z.nativeEnum(GovernanceQueryIntent),
  evidence_labels: z.array(z.string()).default([]),
  insights: z.array(z.string()).default([]),
  metrics: z.array(GovernanceMetricSchema).default([]),
  facts: z.array(GovernanceFactSchema).default([]),
  sources: z.array(GovernanceSourceCitationSchema).default([]),
  supporting_problems: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  is_demo: z.boolean().optional(),
  generated_at: z.string(),
  model: z.string(),
  prompt_version: z.string()
});

export type GovernanceQueryResponseOutput = z.infer<typeof GovernanceQueryResponseSchema>;
