import { z } from 'zod';
import { UserRole } from '../types/auth';
import { SignalSeverity, SignalSourceType } from '../types/signal';
import { ProblemStatus, ImpactLevel, ClusterRelationshipType } from '../types/problem';
import { ActionType, AssignmentPriority } from '../types/workflow';
import { VerificationStatus } from '../types/evidence';

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  lng: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180')
});

export const LocationSourceSchema = z.enum(['GPS', 'MANUAL']);

export const CreateSignalSchema = z.object({
  original_text: z.string().min(3, 'Description must be at least 3 characters').max(5000, 'Description cannot exceed 5000 characters'),
  category: z.string().optional().nullable(),
  location: CoordinatesSchema.optional().nullable(),
  location_source: LocationSourceSchema.optional().nullable(),
  location_accuracy_m: z.number().nonnegative('Accuracy must be non-negative').optional().nullable(),
  ward_id: z.string().optional().nullable(),
  location_reference: z.string().max(500).optional().nullable(),
  media_ids: z.array(z.string()).optional().default([]),
  auto_process: z.boolean().optional().default(false)
});

export const MAX_MEDIA_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB canonical limit
export const ALLOWED_MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const RegisterMediaSchema = z.object({
  file_name: z.string().min(1, 'File name is required').max(255),
  mime_type: z.string().refine(
    (type) => ALLOWED_MEDIA_MIME_TYPES.includes(type as (typeof ALLOWED_MEDIA_MIME_TYPES)[number]),
    { message: 'Unsupported file type. Only JPEG, PNG, and WEBP images are allowed.' }
  ),
  file_size_bytes: z
    .number()
    .positive('File size must be positive')
    .max(MAX_MEDIA_FILE_SIZE_BYTES, 'File size exceeds maximum allowed limit of 10 MB')
});

export const SignalAnalysisOutputSchema = z.object({
  // Compatible with canonical "or" (Odia), "hi" (Hindi), "en" (English), and raw provider responses
  detected_language: z.string().default('en'),
  normalized_summary: z.string().min(1, 'Summary must not be empty').max(1000),
  category: z.string().min(1),
  subcategory: z.string().optional().nullable(),
  severity: z.enum(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  affected_scope: z.string().optional().nullable(),
  duration_days: z.number().nonnegative().optional().nullable(),
  location_reference: z.string().optional().nullable(),
  recommended_department: z.string().optional().nullable(),
  entities: z.array(z.string()).optional().default([]),
  critical_facility: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1).default(0.85),
  explanation: z.string().min(1, 'Explanation is required for transparency').default('Assessment derived from citizen description and report context.'),
  image_findings: z.array(z.string()).optional().default([]),
  resolved_model: z.string().optional()
});

export type SignalAnalysisOutput = z.infer<typeof SignalAnalysisOutputSchema>;

export const AssignProblemSchema = z.object({
  department_id: z.string().min(1, 'department_id is required'),
  assigned_to: z.string().optional(),
  priority: z.nativeEnum(AssignmentPriority).default(AssignmentPriority.HIGH),
  due_at: z.string().optional(),
  notes: z.string().max(1000).optional(),
  expected_status: z.nativeEnum(ProblemStatus).optional()
});
export const CreateAssignmentSchema = AssignProblemSchema;

export const UpdateProblemStatusSchema = z.object({
  status: z.nativeEnum(ProblemStatus),
  note: z.string().max(2000).optional(),
  expected_status: z.nativeEnum(ProblemStatus).optional()
});

export const ProblemActionInputSchema = z.object({
  action: z.nativeEnum(ActionType),
  note: z.string().max(5000).optional(),
  target_officer_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  expected_status: z.nativeEnum(ProblemStatus).optional()
});
export const ProblemActionSchema = ProblemActionInputSchema;

export * from './evidence.schema';
import { SubmitEvidenceSchema } from './evidence.schema';
export const ResolutionEvidenceSchema = SubmitEvidenceSchema;

export * from './governance.schema';
import { GovernanceQueryInputSchema } from './governance.schema';
export const GovernanceQuerySchema = GovernanceQueryInputSchema;

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  ward_id: z.string().optional(),
  department_id: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional()
});

export const ProblemFilterSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.nativeEnum(ProblemStatus).optional(),
  impact_level: z.nativeEnum(ImpactLevel).optional(),
  min_impact: z.coerce.number().min(0).max(100).optional(),
  max_impact: z.coerce.number().min(0).max(100).optional(),
  category: z.string().optional(),
  department_id: z.string().optional(),
  ward_id: z.string().optional(),
  sort: z.enum(['impact_desc', 'impact_asc', 'updated_desc', 'created_desc']).default('impact_desc'),
  search: z.string().optional()
});

// Security requirement: Server derives all 7 factors from stored records. Client cannot pass factor scores.
export const RecalculateImpactSchema = z.object({}).passthrough();

export const CreateProblemClusterSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(300),
  description: z.string().max(5000).optional(),
  category: z.string().min(1, 'Category is required'),
  ward_id: z.string().optional(),
  department_id: z.string().optional(),
  signal_ids: z.array(z.string()).default([]),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).optional()
});

export const ClusterSignalSchema = z.object({
  signal_id: z.string().min(1, 'signal_id is required')
});

export const ProvenanceSourceSchema = z.enum(['REAL', 'ESTIMATED', 'SYNTHETIC', 'UNKNOWN']);

export const DataProvenanceSchema = z.object({
  geography: ProvenanceSourceSchema.default('UNKNOWN'),
  population: ProvenanceSourceSchema.default('UNKNOWN'),
  facility: ProvenanceSourceSchema.default('UNKNOWN'),
  notes: z.string().optional()
});

export * from './evidence.schema';
export * from './governance.schema';
export * from './simulation.schema';
export * from './development-demand.schema';

