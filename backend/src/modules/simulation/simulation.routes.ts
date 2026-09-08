import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { SimulationController } from './simulation.controller';

const router = Router();

// All simulation endpoints require authentication and role scoping
router.use(authMiddleware);

router.post('/problem', SimulationController.simulateProblem);
router.get('/presets/:problemId', SimulationController.getPresets);
router.post('/budget-allocation', SimulationController.simulateBudgetAllocation);

export default router;
