export const ERROR_CODES = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  ASSIGNMENT_NOT_ALLOWED: 'ASSIGNMENT_NOT_ALLOWED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  AI_VALIDATION_FAILED: 'AI_VALIDATION_FAILED',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

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
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

