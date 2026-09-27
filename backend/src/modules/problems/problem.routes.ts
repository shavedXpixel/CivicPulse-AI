import { Router } from 'express';
import { ProblemController } from './problem.controller';
import { WorkflowController } from '../workflow/workflow.controller';
import { ResolutionController } from '../resolutions/resolution.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware';
import { UserRole } from '@civicpulse/shared';

const router = Router();

// Apply authentication to all problem routes
router.use(authMiddleware);

// List problem clusters (ordered by impact_score DESC by default)
router.get('/', ProblemController.listProblems);

// Retrieve single problem cluster
router.get('/:id', ProblemController.getProblem);

// Extended problem cluster details with members, timeline, and impact breakdown
router.get('/:id/details', ProblemController.getProblemDetails);

// Retrieve member signals for a problem cluster (Government Officers and Admins only)
// CRITICAL PRIVACY GUARDRAIL: Ordinary citizens are strictly forbidden from querying raw member signals (403)
router.get(
  '/:id/signals',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  ProblemController.getProblemSignals
);

// Official Problem Cluster Creation
// CRITICAL GUARDRAIL: Ordinary citizens are strictly forbidden from creating official government ProblemClusters (403)
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  ProblemController.createProblem
);

// Secure Impact Recalculation (derives strictly from stored records, no client factor overrides)
router.post(
  '/:id/recalculate-impact',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  ProblemController.recalculateImpact
);

// Explicit Signal Clustering into a Problem Cluster
router.post(
  '/:id/cluster-signal',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  ProblemController.clusterSignal
);

// ==========================================
// PHASE 5: Workflow & Operations Endpoints
// ==========================================

// Official Department & Officer Assignment (Department Officer, Admin, System Admin)
router.post(
  '/:id/assign',
  idempotencyMiddleware(),
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  WorkflowController.assignProblem
);

// Problem-specific Assignment History (Officers and Admins only)
router.get(
  '/:id/assignments',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  WorkflowController.getAssignments
);

// Authorized Officer Action Logging (Field Officer, Department Officer, Admin, System Admin)
router.post(
  '/:id/actions',
  idempotencyMiddleware(),
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  WorkflowController.recordAction
);

// Internal Problem Audit History / Action Timeline (Officers and Admins only)
router.get(
  '/:id/actions',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  WorkflowController.getActions
);
router.get(
  '/:id/timeline',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  WorkflowController.getActions
);

// Problem Status / Lifecycle Transitions
router.patch(
  '/:id/status',
  idempotencyMiddleware(),
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  WorkflowController.updateStatus
);

// ==========================================
// PHASE 6: Resolution Evidence & AI Verification Endpoints
// ==========================================

// Request Presigned R2 Upload URL for Problem Resolution Evidence Media
// CRITICAL GUARDRAIL: Citizens receive 403 Forbidden. Only authorized officers and admins may upload.
router.post(
  '/:id/media',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  ResolutionController.registerEvidenceMedia
);

// Complete Presigned R2 Upload for Problem Resolution Evidence Media
router.post(
  '/:id/media/:mediaId/complete',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  ResolutionController.completeEvidenceMedia
);

// Submit Resolution Evidence (Assigned Field Officer, Department Officer, Admin)
// CRITICAL GUARDRAIL: Citizens receive 403 Forbidden.
router.post(
  '/:id/evidence',
  idempotencyMiddleware(),
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  ResolutionController.submitEvidence
);
router.post(
  '/:id/resolution-evidence',
  idempotencyMiddleware(),
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  ResolutionController.submitEvidence
);

// List Resolution Evidence for Problem Cluster
router.get('/:id/evidence', ResolutionController.listEvidence);
router.get('/:id/resolution-evidence', ResolutionController.listEvidence);

// Trigger or Recalculate AI Advisory Verification
router.post(
  '/:id/verify',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  ResolutionController.verifyProblem
);

// Get Latest Verification Result for Problem Cluster
router.get('/:id/verification', ResolutionController.getVerification);

// Get Verification History for Problem Cluster
router.get('/:id/verification-history', ResolutionController.getVerificationHistory);

// Authoritative Human Supervisory Review (Accept or Reject Resolution)
// CRITICAL GUARDRAIL: Only Department Officer or Admin may accept/reject. Field Officer receives 403.
router.post(
  '/:id/review-resolution',
  idempotencyMiddleware(),
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  ResolutionController.reviewResolution
);

export { router as problemRouter };

