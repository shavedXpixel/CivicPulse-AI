import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// GET /api/v1/auth/me (authenticated user profile & preferences)
router.get('/me', authMiddleware, AuthController.getMe);

// POST /api/v1/auth/switch-demo-persona (demo persona switcher, disabled when DEMO_MODE=false)
router.post('/switch-demo-persona', AuthController.switchDemoPersona);

export { router as authRouter };
