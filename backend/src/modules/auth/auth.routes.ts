import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { env } from '../../config/env';

const router = Router();

// GET /api/v1/auth/me (authenticated user profile & preferences)
router.get('/me', authMiddleware, AuthController.getMe);

// POST /api/v1/auth/register-citizen (authoritative citizen self-provisioning)
router.post('/register-citizen', AuthController.registerCitizen);

// POST /api/v1/auth/switch-demo-persona (mount ONLY in isolated test/dev when DEMO_MODE is true)
if (env.DEMO_MODE) {
  router.post('/switch-demo-persona', AuthController.switchDemoPersona);
}

export { router as authRouter };
