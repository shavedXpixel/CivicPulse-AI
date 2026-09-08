import { z } from 'zod';
import {
  VerificationResultStatus,
  EvidenceType,
  BeforeOrAfter,
  EvidenceStatus
} from '../types/evidence';

export const SubmitEvidenceSchema = z.object({
  evidence_type: z.nativeEnum(EvidenceType).default(EvidenceType.COMPLETION_PHOTO),
  storage_path: z.string().min(1, 'storage_path is required'),
  media_type: z.string().default('image/jpeg').optional(),
  media_ids: z.array(z.string()).default([]).optional(),
  description: z.string().max(5000).optional(),
  before_or_after: z.nativeEnum(BeforeOrAfter).default(BeforeOrAfter.AFTER).optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      reference: z.string().optional()
    })
    .optional(),
  observed_at: z.string().optional(),
  file_size_bytes: z.number().nonnegative().optional(),
  sha256_hash: z.string().optional()
});

export type SubmitEvidenceInput = z.infer<typeof SubmitEvidenceSchema>;

export const BeforeAfterComparisonSchema = z.object({
  improved: z.boolean(),
  summary: z.string(),
  changes_observed: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([])
});

export const VerificationResultSchema = z.object({
  verification_result: z.nativeEnum(VerificationResultStatus),
  confidence: z.number().min(0).max(1),
  observed_conditions: z.array(z.string()).default([]),
  evidence_summary: z.string().default(''),
  before_after_comparison: BeforeAfterComparisonSchema.optional(),
  inconsistencies: z.array(z.string()).default([]),
  explanation: z.string().default(''),
  recommended_review_reason: z.string().nullable().optional(),
  limitations: z.array(z.string()).default([]),
  review_required: z.boolean().default(true)
});

export type VerificationResultInput = z.infer<typeof VerificationResultSchema>;

export const ResolutionReviewSchema = z.object({
  decision: z.enum(['ACCEPT', 'REJECT']),
  notes: z.string().max(2000).optional(),
  evidence_id: z.string().optional()
});

export type ResolutionReviewInput = z.infer<typeof ResolutionReviewSchema>;
