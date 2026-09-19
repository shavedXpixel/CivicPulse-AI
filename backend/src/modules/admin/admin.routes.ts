import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { UserRole } from '@civicpulse/shared';
import { env } from '../../config/env';
import { AdminController } from './admin.controller';

const router = Router();

// POST /api/v1/admin/reset-demo
// Mounted ONLY in isolated test/dev runtime when DEMO_MODE is true.
// In production runtime (DEMO_MODE=false), this route does not exist -> 404.
if (env.DEMO_MODE) {
  router.post('/reset-demo', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN), AdminController.resetDemo);
}

// POST /api/v1/admin/departments
router.post('/departments', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN), AdminController.createDepartment);

// POST /api/v1/admin/users/government
router.post('/users/government', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN), AdminController.createGovernmentUser);

// GET /api/v1/admin/users
router.get('/users', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN), AdminController.listUsers);

export { router as adminRouter };
