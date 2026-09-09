import { Router } from 'express';
import { SignalController } from './signal.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { UserRole } from '@civicpulse/shared';

const router = Router();

// Apply authentication to all signal routes
router.use(authMiddleware);

// Citizen & Officer signal submission
router.post(
  '/',
  requireRole(UserRole.CITIZEN, UserRole.FIELD_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN),
  SignalController.createSignal
);

// List signals (with server-side role & citizen scoping)
router.get('/', SignalController.listSignals);

// Citizen personal reports list
router.get(
  '/me',
  requireRole(UserRole.CITIZEN, UserRole.ADMIN, UserRole.SYSTEM_ADMIN),
  SignalController.getMySignals
);

// Retrieve single signal (with server-side ownership/role scoping)
router.get('/:id', SignalController.getSignal);

// Media registration (returns signed upload URL)
router.post(
  '/:id/media',
  requireRole(UserRole.CITIZEN, UserRole.FIELD_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN),
  SignalController.registerMedia
);

// Media attachment completion
router.post(
  '/:id/media/:mediaId/complete',
  requireRole(UserRole.CITIZEN, UserRole.FIELD_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN),
  SignalController.completeMedia
);

// Get media items for a signal
router.get('/:id/media', SignalController.getSignalMedia);

// Explicit Phase 3 AI Analysis operation
router.post(
  '/:id/analyze',
  requireRole(UserRole.CITIZEN, UserRole.FIELD_OFFICER, UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN),
  SignalController.analyzeSignal
);

// Get AI Operations and analysis state for a signal
router.get('/:id/ai', SignalController.getSignalAI);

// Explicit Phase 4 Clustering operation
router.post(
  '/:id/cluster',
  requireRole(UserRole.CITIZEN, UserRole.ADMIN, UserRole.SYSTEM_ADMIN, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_OFFICER),
  SignalController.clusterSignal
);

export { router as signalRouter };

