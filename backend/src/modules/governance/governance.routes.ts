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

// HF7.7: Development Demand Intelligence Workspace Endpoints
governanceRouter.get(
  '/development-demand/overview',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  GovernanceController.getDevelopmentDemandOverview
);

governanceRouter.get(
  '/development-demand/clusters',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  GovernanceController.listDevelopmentDemandClusters
);

governanceRouter.get(
  '/development-demand/clusters/:id',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  GovernanceController.getDevelopmentDemandClusterById
);

governanceRouter.get(
  '/development-demand/map',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  GovernanceController.getDevelopmentDemandMap
);

governanceRouter.get(
  '/development-demand/indicators',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  GovernanceController.getDevelopmentDemandIndicators
);

governanceRouter.get(
  '/development-demand/investment-context',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  GovernanceController.getDevelopmentDemandInvestmentContext
);

// HF7.6: Development Demand Intelligence Governance AI Endpoint
governanceRouter.post(
  '/development-demand/analyze',
  requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER),
  GovernanceController.analyzeDevelopmentDemand
);
