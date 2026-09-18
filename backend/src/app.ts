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

import { structuredLogger } from './middleware/logger.middleware';
import { getDatabaseProvider } from './providers';
import { env } from './config/env';

export function createApp(): Express {
  const app = express();

  // AUD-SEC-04: Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none';");
    next();
  });

  // AUD-CORS-01: Explicit CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, tests, server-to-server)
        if (!origin) return callback(null, true);
        // AUD-CORS-01: Explicit origin match only — no wildcard CORS with credentials
        if (env.CORS_ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID', 'X-Demo-Mode']
    })
  );

  app.use(express.json({ limit: '10mb' }));

  // AUD-OBS-01: Centralized structured logging & Request ID
  app.use(structuredLogger);

  // Health endpoint (liveness probe)
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.status(200).json({
      data: {
        status: 'ok',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    });
  });

  // AUD-DEP-01: Readiness endpoint checking operational database connectivity
  app.get('/api/v1/ready', async (_req: Request, res: Response) => {
    try {
      const db = getDatabaseProvider();
      const readyCheck = await db.checkReadiness();
      if (readyCheck.ready) {
        res.status(200).json({
          status: 'ready',
          database: 'connected',
          latency_ms: readyCheck.latencyMs,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          database: 'unavailable',
          timestamp: new Date().toISOString()
        });
      }
    } catch {
      // Do not expose internal infrastructure details in error responses
      res.status(503).json({
        status: 'not_ready',
        database: 'error',
        timestamp: new Date().toISOString()
      });
    }
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
