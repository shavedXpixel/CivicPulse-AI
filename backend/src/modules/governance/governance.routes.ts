import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { GovernanceController } from './governance.controller';

export const governanceRouter = Router();

// Governance AI endpoints are protected by authentication & RBAC middleware
governanceRouter.use(authMiddleware);

governanceRouter.post('/query', GovernanceController.query);
governanceRouter.get('/brief', GovernanceController.getBrief);
