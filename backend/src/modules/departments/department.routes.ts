import { Router } from 'express';
import { DepartmentController } from './department.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

// Apply auth middleware to department routes
router.use(authMiddleware);

// GET /api/v1/departments -> department metadata/directory
router.get('/', DepartmentController.listDepartments);

// GET /api/v1/departments/:id -> department metadata
router.get('/:id', DepartmentController.getDepartment);

// GET /api/v1/departments/:id/workload -> workload metrics for that department
router.get('/:id/workload', DepartmentController.getWorkload);

// GET /api/v1/departments/:id/officers -> eligible officers for assignment
router.get('/:id/officers', DepartmentController.getDepartmentOfficers);

export { router as departmentRouter };
