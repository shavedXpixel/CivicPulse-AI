import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '@civicpulse/shared';
import { ZodError } from 'zod';

export interface AppErrorOptions {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor({ statusCode, code, message, details }: AppErrorOptions) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

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

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid request payload',
        requestId,
        details: { issues: err.errors }
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
