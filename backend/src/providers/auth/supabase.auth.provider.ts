import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader, JWTVerifyGetKey } from 'jose';
import { IAuthProvider, AuthTokenPayload } from './auth.interface';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserProfile } from '@civicpulse/shared';

export interface SupabaseAuthProviderOptions {
  supabaseUrl?: string;
  jwtSecret?: string;
  jwksUri?: string;
}

export class SupabaseAuthProvider implements IAuthProvider {
  private jwks: JWTVerifyGetKey | null = null;
  private readonly supabaseUrl: string;
  private readonly expectedIssuer: string;
  private readonly expectedAudience = 'authenticated';
  private readonly testSecret: Uint8Array | null = null;

  constructor(options?: SupabaseAuthProviderOptions) {
    const rawUrl = options?.supabaseUrl || env.SUPABASE_URL || 'https://sihttdjkubjuizwdjmrj.supabase.co';
    this.supabaseUrl = rawUrl.replace(/\/$/, '');
    this.expectedIssuer = `${this.supabaseUrl}/auth/v1`;

    const jwksUri = options?.jwksUri || `${this.expectedIssuer}/.well-known/jwks.json`;

    try {
      this.jwks = createRemoteJWKSet(new URL(jwksUri), {
        cacheMaxAge: 10 * 60 * 1000, // 10 minutes cache
        cooldownDuration: 30 * 1000   // 30 seconds cooldown
      });
    } catch {
      this.jwks = null;
    }

    // In isolated test environments only, allow symmetric secret key verification for mocks
    const secret = options?.jwtSecret || env.SUPABASE_JWT_SECRET;
    if (process.env.NODE_ENV === 'test' && secret && secret.trim() !== '') {
      this.testSecret = new TextEncoder().encode(secret);
    }
  }

  /**
   * Securely verifies a Supabase JWT access token.
   * In REAL_MODE, strictly requires ES256 asymmetric signing verified via project JWKS.
   * Dynamic algorithm trust is forbidden in production.
   */
  public async verifyToken(token: string): Promise<AuthTokenPayload> {
    if (!token || typeof token !== 'string') {
      throw new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication failed: Missing or invalid token format.'
      });
    }

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

    let header;
    try {
      header = decodeProtectedHeader(cleanToken);
    } catch (err: any) {
      throw new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: `Authentication failed: Malformed JWT header (${err.message}).`
      });
    }

    const isTestEnv = process.env.NODE_ENV === 'test';

    // REAL_MODE Production Security Rule:
    // Strictly require ES256 algorithm. Fail closed for all other algorithms.
    if (!isTestEnv) {
      if (header.alg !== 'ES256') {
        throw new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          message: `Authentication failed: Untrusted token algorithm '${header.alg}'. Production requires ES256.`
        });
      }
    } else {
      // In NODE_ENV=test only, allow HS256 for test helpers if explicitly configured
      if (header.alg !== 'ES256' && header.alg !== 'HS256') {
        throw new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          message: `Authentication failed: Unsupported algorithm '${header.alg}'.`
        });
      }
    }

    try {
      let verifiedPayload: any;

      if (header.alg === 'ES256') {
        if (!this.jwks) {
          throw new Error('JWKS client is not initialized.');
        }

        const { payload } = await jwtVerify(cleanToken, this.jwks, {
          issuer: this.expectedIssuer,
          audience: this.expectedAudience,
          algorithms: ['ES256']
        });
        verifiedPayload = payload;
      } else if (isTestEnv && header.alg === 'HS256' && this.testSecret) {
        // Isolated test mock pathway
        const { payload } = await jwtVerify(cleanToken, this.testSecret, {
          issuer: this.expectedIssuer,
          audience: this.expectedAudience,
          algorithms: ['HS256']
        });
        verifiedPayload = payload;
      } else {
        throw new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          message: `Authentication failed: Algorithm '${header.alg}' cannot be verified.`
        });
      }

      if (!verifiedPayload.sub || typeof verifiedPayload.sub !== 'string') {
        throw new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Authentication failed: Token missing valid subject (sub) claim.'
        });
      }

      return {
        uid: verifiedPayload.sub,
        email: verifiedPayload.email,
        role: verifiedPayload.role,
        aud: verifiedPayload.aud,
        iss: verifiedPayload.iss,
        app_metadata: verifiedPayload.app_metadata,
        user_metadata: verifiedPayload.user_metadata
      };
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }

      // Normalize JOSE errors
      const msg = err.message || 'Token verification failed';
      throw new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: `Authentication failed: ${msg}.`
      });
    }
  }

  public async getUserById(_uid: string): Promise<UserProfile | null> {
    // Authoritative profile retrieval is handled via public.users in database provider
    return null;
  }
}
