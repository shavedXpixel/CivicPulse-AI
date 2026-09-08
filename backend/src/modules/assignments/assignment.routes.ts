import { Router } from 'express';
import { AssignmentController } from './assignment.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { UserRole } from '@civicpulse/shared';

const router = Router();

// Apply auth middleware to all assignments endpoints
router.use(authMiddleware);

// GET /api/v1/assignments?assigned_to=me
// Restricted to authorized government personas (FIELD_OFFICER, DEPARTMENT_OFFICER, ADMIN, SYSTEM_ADMIN)
router.get(
  '/',
  requireRole(UserRole.FIELD_OFFICER, UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN),
  AssignmentController.listAssignments
);

export { router as assignmentRouter };
