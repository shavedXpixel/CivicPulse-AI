import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { errorHandler, AppError } from './middleware/error.middleware';
import { ERROR_CODES } from '@civicpulse/shared';
import { authRouter } from './modules/auth/auth.routes';
import { signalRouter } from './modules/signals/signal.routes';
import { storageRouter } from './modules/storage/storage.routes';
import { problemRouter } from './modules/problems/problem.routes';
import { assignmentRouter } from './modules/assignments/assignment.routes';
import { departmentRouter } from './modules/departments/department.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { resolutionRouter } from './modules/resolutions/resolution.routes';
import { governanceRouter } from './modules/governance/governance.routes';
import simulationRouter from './modules/simulation/simulation.routes';
import { adminRouter } from './modules/admin/admin.routes';

export function createApp(): Express {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Request ID generator & logger middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    res.setHeader('X-Request-ID', requestId);
    req.headers['x-request-id'] = requestId;
    next();
  });

  // Health endpoint required for Phase 0
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.status(200).json({
      data: {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    });
  });

  // Domain API Routers
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/signals', signalRouter);
  app.use('/api/v1/storage', storageRouter);
  app.use('/api/v1/problems', problemRouter);
  app.use('/api/v1/assignments', assignmentRouter);
  app.use('/api/v1/departments', departmentRouter);
  app.use('/api/v1/dashboard', dashboardRouter);
  app.use('/api/v1/resolution-evidence', resolutionRouter);
  app.use('/api/v1/governance', governanceRouter);
  app.use('/api/v1/simulations', simulationRouter);
  app.use('/api/v1/simulation', simulationRouter);
  app.use('/api/v1/admin', adminRouter);


  // Catch-all 404 handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Endpoint ${req.method} ${req.path} not found.`
      })
    );
  });

  // Standardized error handler
  app.use(errorHandler);

  return app;
}
