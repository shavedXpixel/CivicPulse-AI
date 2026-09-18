import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES, AppError, AppErrorOptions } from '@civicpulse/shared';
import { ZodError } from 'zod';

export { AppError, AppErrorOptions };


import { sanitizeObject } from './logger.middleware';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId =
    (res.getHeader('X-Request-ID') as string) ||
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}`;

  if (err instanceof AppError) {
    (res as any).errorCode = err.code;
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details ? { details: sanitizeObject(err.details) } : {})
      }
    });
    return;
  }

  if (err instanceof ZodError || err.name === 'ZodError') {
    (res as any).errorCode = ERROR_CODES.VALIDATION_ERROR;
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid request payload',
        requestId,
        details: { issues: (err as any).errors || (err as any).issues }
      }
    });
    return;
  }

  // Fallback internal error (do not leak stack traces or internal filesystem paths to client)
  (res as any).errorCode = ERROR_CODES.INTERNAL_ERROR;
  if (process.env.NODE_ENV !== 'test') {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      request_id: requestId,
      error_code: ERROR_CODES.INTERNAL_ERROR,
      error_name: err.name,
      error_message: err.message
    }));
  }

  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected internal error occurred.',
      requestId
    }
  });
}
