import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { UserRole, ERROR_CODES } from '@civicpulse/shared';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';
import { AdminController } from './admin.controller';

const router = Router();

/**
 * Strict presentation safety guard:
 * Unconditionally blocks demo reset requests when DEMO_MODE is false, protecting REAL_MODE and Firestore.
 */
const demoOnlyGuard = (_req: Request, _res: Response, next: NextFunction) => {
  if (!env.DEMO_MODE) {
    return next(
      new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Demo reset is strictly disabled when DEMO_MODE is false (REAL_MODE active). Firestore data is protected.'
      })
    );
  }
  next();
};

// POST /api/v1/admin/reset-demo
// Order of defense:
// 1. Verify DEMO_MODE is active (REAL_MODE cannot invoke)
// 2. Verify authentication
// 3. Verify ADMIN authorization
router.post('/reset-demo', demoOnlyGuard, authMiddleware, requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN), AdminController.resetDemo);

// POST /api/v1/admin/departments
router.post('/departments', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN), AdminController.createDepartment);

// POST /api/v1/admin/users/government
router.post('/users/government', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN), AdminController.createGovernmentUser);

// GET /api/v1/admin/users
router.get('/users', authMiddleware, requireRole(UserRole.ADMIN, UserRole.SYSTEM_ADMIN), AdminController.listUsers);

export { router as adminRouter };
