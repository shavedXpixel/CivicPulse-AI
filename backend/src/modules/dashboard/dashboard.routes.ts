import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { UserRole } from '@civicpulse/shared';

const router = Router();

// Apply auth middleware to dashboard routes
router.use(authMiddleware);

// GET /api/v1/dashboard/map (Authorized for all authenticated roles with server-side RBAC scoping)
router.get(
  '/map',
  requireRole(UserRole.CITIZEN, UserRole.FIELD_OFFICER, UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN),
  DashboardController.getMapData
);

// Government personnel only (Field Officer, Department Officer, Admin, System Admin)
router.use(
  requireRole(UserRole.FIELD_OFFICER, UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN)
);

// GET /api/v1/dashboard/summary
router.get('/summary', DashboardController.getSummary);

// GET /api/v1/dashboard/problems
router.get('/problems', DashboardController.getPriorityProblems);

// GET /api/v1/dashboard/sla-risk
router.get('/sla-risk', DashboardController.getSlaRisk);

export { router as dashboardRouter };
