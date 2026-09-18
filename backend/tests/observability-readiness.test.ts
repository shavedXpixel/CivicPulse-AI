import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env, validateRealModeConfig } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider } from '../src/providers';
import { sanitizeObject } from '../src/middleware/logger.middleware';

describe('Phase 14 Observability, Readiness & Security Headers', () => {
  let app: any;
  const originalDemoMode = env.DEMO_MODE;

  beforeEach(() => {
    vi.restoreAllMocks();
    (env as any).DEMO_MODE = true;
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    app = createApp();
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    vi.restoreAllMocks();
  });

  describe('1. Health and Readiness Probes (AUD-DEP-01)', () => {
    it('GET /api/v1/health returns 200 OK as lightweight liveness probe', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.version).toBe('1.0.0');
    });

    it('GET /api/v1/ready verifies database connectivity and returns 200 ready', async () => {
      const res = await request(app).get('/api/v1/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('connected');
      expect(res.body.latency_ms).toBeDefined();
    });

    it('GET /api/v1/ready returns 503 without leaking stack traces when database fails', async () => {
      const mockDb = new MockDatabaseProvider();
      vi.spyOn(mockDb, 'checkReadiness').mockRejectedValueOnce(new Error('Firestore socket timeout'));
      ProviderContainer.setDatabaseProvider(mockDb);

      const res = await request(app).get('/api/v1/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not_ready');
      expect(res.body.database).toBe('error');
      // Must not leak internal stack trace
      expect(res.body.stack).toBeUndefined();
      expect(res.body.error).toBeUndefined();
    });
  });

  describe('2. Security Headers & CORS Policy (AUD-SEC-04 & AUD-CORS-01)', () => {
    it('includes modern security headers on all HTTP responses', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('honors configured allowed origins for CORS', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('blocks unconfigured untrusted origins from CORS', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-phishing-site.example.com');

      // Rejected by CORS middleware
      expect(res.status).toBe(500);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('proves CORS_ALLOWED_ORIGINS is the canonical variable and strictly blocks unknown origins', async () => {
      const { env } = await import('../src/config/env');
      expect(Array.isArray(env.CORS_ALLOWED_ORIGINS)).toBe(true);
      expect((env as any).CORS_ORIGINS).toBeUndefined(); // Proves removal of ambiguous alias
      expect(env.CORS_ALLOWED_ORIGINS).toContain('http://localhost:3000');

      // Allowed origin preflight
      const allowedRes = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');
      expect(allowedRes.headers['access-control-allow-origin']).toBe('http://localhost:3000');

      // Untrusted origin preflight
      const deniedRes = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'https://unauthorized-domain.com')
        .set('Access-Control-Request-Method', 'GET');
      expect(deniedRes.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('3. Structured Logging & Secret Redaction (AUD-OBS-01)', () => {
    it('redacts sensitive fields (passwords, tokens, phone numbers) recursively', () => {
      const sensitivePayload = {
        user: {
          id: 'usr_123',
          email: 'officer@watco.gov',
          phone: '+919999999999',
          password: 'SecretPassword123!',
          tokens: {
            access_token: 'raw_jwt_secret',
            id_token: 'raw_id_token'
          }
        },
        metadata: {
          api_key: 'AIzaSyTestApiKey',
          normal_field: 'valid_content'
        }
      };

      const sanitized = sanitizeObject(sensitivePayload);

      expect(sanitized.user.id).toBe('usr_123');
      expect(sanitized.user.email).toBe('[REDACTED]');
      expect(sanitized.user.phone).toBe('[REDACTED]');
      expect(sanitized.user.password).toBe('[REDACTED]');
      expect(sanitized.user.tokens.access_token).toBe('[REDACTED]');
      expect(sanitized.user.tokens.id_token).toBe('[REDACTED]');
      expect(sanitized.metadata.api_key).toBe('[REDACTED]');
      expect(sanitized.metadata.normal_field).toBe('valid_content');
    });
  });

  describe('4. REAL_MODE Startup Configuration Validation (AUD-CONF-01)', () => {
    it('fails validation when DEMO_MODE=false and FIREBASE_PROJECT_ID is missing', () => {
      const result = validateRealModeConfig({
        DEMO_MODE: false,
        FIREBASE_PROJECT_ID: '',
        PROVIDER_MODE: 'mock'
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('FIREBASE_PROJECT_ID is required'))).toBe(true);
    });

    it('fails validation when DEMO_MODE=false, PROVIDER_MODE=cloud, and GEMINI_API_KEY is missing', () => {
      const result = validateRealModeConfig({
        DEMO_MODE: false,
        FIREBASE_PROJECT_ID: 'civicpulse-prod',
        PROVIDER_MODE: 'cloud',
        GEMINI_API_KEY: ''
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('GEMINI_API_KEY is required'))).toBe(true);
    });

    it('passes validation when DEMO_MODE=false in ADC environment without local credentials file', () => {
      const result = validateRealModeConfig({
        DEMO_MODE: false,
        FIREBASE_PROJECT_ID: 'civicpulse-prod',
        PROVIDER_MODE: 'mock',
        GOOGLE_APPLICATION_CREDENTIALS: '' // Legitimate ADC on Cloud Run
      });

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });
});
