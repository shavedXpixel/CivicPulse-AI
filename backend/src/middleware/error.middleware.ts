import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES, AppError, AppErrorOptions } from '@civicpulse/shared';
import { ZodError } from 'zod';

export { AppError, AppErrorOptions };


export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId,
        ...(err.details ? { details: err.details } : {})
      }
    });
    return;
  }

  if (err instanceof ZodError || err.name === 'ZodError') {
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

  // Fallback internal error (do not leak stack traces to client)
  console.error(`[${requestId}] Internal Server Error:`, err);
  res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected internal error occurred.',
      requestId
    }
  });
}
