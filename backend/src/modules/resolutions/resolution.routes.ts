import { Router } from 'express';
import { ResolutionController } from './resolution.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { UserRole } from '@civicpulse/shared';

const router = Router();

router.use(authMiddleware);

// Get single resolution evidence by ID
router.get(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER, UserRole.CITIZEN),
  ResolutionController.getEvidenceById
);

// Alias: POST /resolution-evidence/:id/verify
router.post(
  '/:id/verify',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  ResolutionController.verifyProblem
);

// Alias: GET /resolution-evidence/:id/verification
router.get(
  '/:id/verification',
  ResolutionController.getVerification
);

export { router as resolutionRouter };
