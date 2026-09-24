import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { UserRole } from '@civicpulse/shared';
import { GovernanceController } from './governance.controller';

export const governanceRouter = Router();

// Governance AI endpoints are protected by authentication & RBAC middleware
governanceRouter.use(authMiddleware);

governanceRouter.post('/query', GovernanceController.query);
governanceRouter.get('/brief', GovernanceController.getBrief);

// HF7.6: Development Demand Intelligence Governance AI Endpoint
governanceRouter.post(
  '/development-demand/analyze',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  GovernanceController.analyzeDevelopmentDemand
);
