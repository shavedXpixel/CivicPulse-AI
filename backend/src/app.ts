import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { errorHandler, AppError } from './middleware/error.middleware';
import { ERROR_CODES } from '@civicpulse/shared';

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
