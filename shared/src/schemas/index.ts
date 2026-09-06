import { z } from 'zod';
import { UserRole } from '../types/auth';
import { SignalSeverity, SignalSourceType } from '../types/signal';
import { ProblemStatus, ImpactLevel, ClusterRelationshipType } from '../types/problem';
import { ActionType, AssignmentPriority } from '../types/workflow';
import { VerificationStatus } from '../types/evidence';

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const CreateSignalSchema = z.object({
  original_text: z.string().min(3).max(5000),
  category: z.string().optional().nullable(),
  location: CoordinatesSchema.optional().nullable(),
  ward_id: z.string().optional().nullable(),
  media_ids: z.array(z.string()).optional().default([])
});

export const SignalAnalysisOutputSchema = z.object({
  category: z.string(),
  subcategory: z.string().optional().nullable(),
  normalized_summary: z.string().min(1),
  language: z.string().default('en'),
  severity: z.enum(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  duration_days: z.number().nonnegative().optional().nullable(),
  location_reference: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  entities: z.array(z.string()).optional().default([]),
  critical_facility: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1).default(0.8)
});

export const CreateAssignmentSchema = z.object({
  department_id: z.string().min(1),
  assigned_to: z.string().optional(),
  priority: z.nativeEnum(AssignmentPriority).default(AssignmentPriority.HIGH),
  due_at: z.string().optional()
});

export const ProblemActionSchema = z.object({
  action: z.nativeEnum(ActionType),
  note: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional()
});

export const ResolutionEvidenceSchema = z.object({
  storage_path: z.string().min(1),
  media_type: z.string().default('image/jpeg'),
  description: z.string().max(5000).optional(),
  observed_at: z.string().optional()
});

export const VerificationResultSchema = z.object({
  status: z.nativeEnum(VerificationStatus),
  confidence: z.number().min(0).max(1),
  observations: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  review_required: z.boolean().default(true)
});

export const GovernanceQuerySchema = z.object({
  question: z.string().min(3).max(2000),
  scope: z.object({
    ward_id: z.string().optional().nullable(),
    department_id: z.string().optional().nullable(),
    date_from: z.string().optional().nullable(),
    date_to: z.string().optional().nullable()
  }).optional()
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  ward_id: z.string().optional(),
  department_id: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional()
});
