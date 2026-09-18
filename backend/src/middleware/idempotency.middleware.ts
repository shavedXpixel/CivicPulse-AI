import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { ERROR_CODES } from '@civicpulse/shared';

export interface IdempotencyRecord {
  status: 'IN_PROGRESS' | 'COMPLETED';
  statusCode?: number;
  body?: any;
  createdAt: number;
  expiresAt: number;
}

/**
 * Thread-safe / process-level in-memory store for idempotency keys.
 * Keys are strictly scoped by: userId + method + route + idempotencyKey.
 * Cross-user replay is strictly prohibited.
 */
class IdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();
  private readonly LOCK_TIMEOUT_MS = 30 * 1000; // 30s in-progress timeout
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h completion TTL

  /**
   * Atomically claims the idempotency key if available.
   * Returns 'CLAIMED' if successfully locked,
   * 'IN_PROGRESS' if currently locked by an active request,
   * or the cached IdempotencyRecord if already completed.
   */
  public claim(key: string): { status: 'CLAIMED' | 'IN_PROGRESS' | 'COMPLETED'; record?: IdempotencyRecord } {
    const existing = this.records.get(key);
    const now = Date.now();

    if (existing) {
      if (existing.status === 'COMPLETED') {
        if (now < existing.expiresAt) {
          return { status: 'COMPLETED', record: existing };
        }
        // Expired completed record
        this.records.delete(key);
      } else if (existing.status === 'IN_PROGRESS') {
        if (now < existing.createdAt + this.LOCK_TIMEOUT_MS) {
          return { status: 'IN_PROGRESS' };
        }
        // Stale in-progress lock expired, allow re-claim
      }
    }

    const newRecord: IdempotencyRecord = {
      status: 'IN_PROGRESS',
      createdAt: now,
      expiresAt: now + this.CACHE_TTL_MS
    };
    this.records.set(key, newRecord);
    return { status: 'CLAIMED' };
  }

  public complete(key: string, statusCode: number, body: any): void {
    const now = Date.now();
    this.records.set(key, {
      status: 'COMPLETED',
      statusCode,
      body,
      createdAt: now,
      expiresAt: now + this.CACHE_TTL_MS
    });
  }

  public release(key: string): void {
    this.records.delete(key);
  }

  public clear(): void {
    this.records.clear();
  }
}

export const globalIdempotencyStore = new IdempotencyStore();

/**
 * Idempotency middleware for mutation endpoints.
 * Operates when client provides header `Idempotency-Key`.
 * Does NOT generate implicit keys from body hashes (preserves legitimate duplicate reports).
 */
export function idempotencyMiddleware(store: IdempotencyStore = globalIdempotencyStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rawKey = req.headers['idempotency-key'];

    // If no Idempotency-Key supplied, proceed normally without caching
    if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
      return next();
    }

    const key = rawKey.trim();
    if (key.length > 255) {
      return next(
        new AppError({
          statusCode: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Idempotency-Key header exceeds maximum permitted length of 255 characters.'
        })
      );
    }

    // Scoped lock key: userId + method + path + key (prevents cross-user replay)
    const userId = req.user?.id || 'unauthenticated';
    const scopedKey = `${userId}:${req.method}:${req.baseUrl || ''}${req.path}:${key}`;

    const claimResult = store.claim(scopedKey);

    if (claimResult.status === 'IN_PROGRESS') {
      res.status(409).json({
        error: {
          code: 'CONCURRENT_REQUEST_IN_PROGRESS',
          message: 'A request with this Idempotency-Key is currently being processed. Please wait for completion before retrying.'
        }
      });
      return;
    }

    if (claimResult.status === 'COMPLETED' && claimResult.record) {
      res.setHeader('X-Cache-Lookup', 'HIT');
      res.setHeader('X-Idempotency-Key', key);
      res.status(claimResult.record.statusCode || 200).json(claimResult.record.body);
      return;
    }

    // Status is 'CLAIMED': Intercept response to cache on completion
    res.setHeader('X-Cache-Lookup', 'MISS');
    res.setHeader('X-Idempotency-Key', key);

    const originalJson = res.json.bind(res);
    let responseSent = false;

    res.json = function (body: any): Response {
      if (!responseSent) {
        responseSent = true;
        const statusCode = res.statusCode || 200;
        if (statusCode < 500) {
          store.complete(scopedKey, statusCode, body);
        } else {
          // Do not cache internal server errors; release lock to permit client retry
          store.release(scopedKey);
        }
      }
      return originalJson(body);
    };

    res.on('close', () => {
      // If request aborted before sending response, release lock
      if (!responseSent) {
        store.release(scopedKey);
      }
    });

    next();
  };
}
