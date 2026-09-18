import { Request, Response, NextFunction } from 'express';

export interface StructuredLog {
  timestamp: string;
  request_id: string;
  user_id?: string;
  role?: string;
  method: string;
  route: string;
  operation?: string;
  duration_ms: number;
  status_code: number;
  outcome: 'SUCCESS' | 'CLIENT_ERROR' | 'SERVER_ERROR';
  error_code?: string;
  signal_id?: string;
  problem_id?: string;
}

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'token',
  'password',
  'secret',
  'apikey',
  'api_key',
  'credential',
  'credentials',
  'private_key',
  'client_secret',
  'access_token',
  'id_token',
  'refresh_token',
  'phone',
  'phone_number',
  'email'
]);

export function sanitizeObject(obj: any, depth = 0): any {
  if (!obj || depth > 4) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitizeObject(value, depth + 1);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function structuredLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-ID', requestId);
  req.headers['x-request-id'] = requestId;

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const outcome =
      statusCode >= 500
        ? 'SERVER_ERROR'
        : statusCode >= 400
        ? 'CLIENT_ERROR'
        : 'SUCCESS';

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      request_id: requestId,
      user_id: req.user?.id,
      role: req.user?.role,
      method: req.method,
      route: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
      operation: `${req.method} ${req.baseUrl || ''}${req.path}`,
      duration_ms: durationMs,
      status_code: statusCode,
      outcome,
      error_code:
        (res as any).errorCode ||
        (statusCode >= 400 ? `HTTP_${statusCode}` : undefined),
      signal_id:
        req.params?.signalId ||
        (req.params?.id && req.path.includes('/signals') ? req.params.id : undefined) ||
        (req.body?.signal_id || undefined),
      problem_id:
        req.params?.problemId ||
        (req.params?.id && (req.path.includes('/problems') || req.baseUrl.includes('/problems')) ? req.params.id : undefined) ||
        (req.body?.problem_id || undefined)
    };

    const finalLog: Record<string, any> = {};
    for (const [k, v] of Object.entries(logEntry)) {
      if (v !== undefined) {
        finalLog[k] = v;
      }
    }

    if (process.env.NODE_ENV !== 'test' || process.env.LOG_TESTS === 'true') {
      console.log(JSON.stringify(finalLog));
    }
  });

  next();
}
