import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import {
  ProviderContainer,
  getAuthProvider,
  getDatabaseProvider,
  getStorageProvider,
  getAIProvider,
  getVerificationProvider,
  SupabaseAuthProvider,
  FirebaseAuthProvider,
  PostgresDatabaseProvider,
  FirestoreDatabaseProvider,
  R2StorageProvider,
  GCSStorageProvider,
  LocalStorageProvider,
  OpenAIProvider,
  GeminiAIProvider,
  GeminiVerificationProvider,
  MockDatabaseProvider,
  MockAIProvider,
  MockVerificationProvider
} from '../src/providers';
import {
  env,
  validateRealModeConfig,
  assertRealModeConfig
} from '../src/config/env';
import { createApp } from '../src/app';

describe('Phase 15B.5.2 — Deployment Implementation & Provider Selection Suite', () => {
  const originalEnv = {
    DEMO_MODE: env.DEMO_MODE,
    AUTH_PROVIDER: env.AUTH_PROVIDER,
    DATABASE_PROVIDER: env.DATABASE_PROVIDER,
    STORAGE_PROVIDER: env.STORAGE_PROVIDER,
    AI_PROVIDER: env.AI_PROVIDER,
    PROVIDER_MODE: env.PROVIDER_MODE,
    CORS_ALLOWED_ORIGINS: [...env.CORS_ALLOWED_ORIGINS]
  };

  beforeEach(() => {
    ProviderContainer.resetAllProviders();
  });

  afterEach(() => {
    Object.assign(env, originalEnv);
    ProviderContainer.resetAllProviders();
  });

  describe('1. Explicit Provider Wiring (Blocker B2)', () => {
    it('selects target production providers when explicitly configured in REAL_MODE', () => {
      (env as any).DEMO_MODE = false;
      (env as any).AUTH_PROVIDER = 'supabase';
      (env as any).DATABASE_PROVIDER = 'postgres';
      (env as any).STORAGE_PROVIDER = 'r2';
      (env as any).AI_PROVIDER = 'openai';

      expect(getAuthProvider()).toBeInstanceOf(SupabaseAuthProvider);
      expect(getDatabaseProvider()).toBeInstanceOf(PostgresDatabaseProvider);
      expect(getStorageProvider()).toBeInstanceOf(R2StorageProvider);
      expect(getAIProvider()).toBeInstanceOf(OpenAIProvider);
      expect(getVerificationProvider()).toBeInstanceOf(OpenAIProvider);
    });

    it('selects rollback Google Cloud providers when explicitly configured in REAL_MODE', () => {
      (env as any).DEMO_MODE = false;
      (env as any).AUTH_PROVIDER = 'firebase';
      (env as any).DATABASE_PROVIDER = 'firestore';
      (env as any).STORAGE_PROVIDER = 'gcs';
      (env as any).AI_PROVIDER = 'gemini';

      expect(getAuthProvider()).toBeInstanceOf(FirebaseAuthProvider);
      expect(getDatabaseProvider()).toBeInstanceOf(FirestoreDatabaseProvider);
      expect(getStorageProvider()).toBeInstanceOf(GCSStorageProvider);
      expect(getAIProvider()).toBeInstanceOf(GeminiAIProvider);
      expect(getVerificationProvider()).toBeInstanceOf(GeminiVerificationProvider);
    });

    it('returns Mock providers when DEMO_MODE=true regardless of provider flags', () => {
      (env as any).DEMO_MODE = true;
      (env as any).DATABASE_PROVIDER = 'postgres';
      (env as any).AI_PROVIDER = 'openai';

      expect(getDatabaseProvider()).toBeInstanceOf(MockDatabaseProvider);
      expect(getAIProvider()).toBeInstanceOf(MockAIProvider);
      expect(getVerificationProvider()).toBeInstanceOf(MockVerificationProvider);
      expect(getStorageProvider()).toBeInstanceOf(LocalStorageProvider);
    });

    it('fails closed and throws AppError when DATABASE_PROVIDER=mock in REAL_MODE (DEMO_MODE=false)', () => {
      (env as any).DEMO_MODE = false;
      (env as any).DATABASE_PROVIDER = 'mock';

      expect(() => getDatabaseProvider()).toThrow(/Unsupported DATABASE_PROVIDER in REAL_MODE.*Mock database is strictly prohibited/);
    });

    it('fails closed and throws AppError when STORAGE_PROVIDER=local or mock in REAL_MODE (DEMO_MODE=false)', () => {
      (env as any).DEMO_MODE = false;
      (env as any).STORAGE_PROVIDER = 'local';
      expect(() => getStorageProvider()).toThrow(/Unsupported STORAGE_PROVIDER in REAL_MODE.*Local\/mock storage is strictly prohibited/);

      ProviderContainer.resetAllProviders();
      (env as any).STORAGE_PROVIDER = 'mock';
      expect(() => getStorageProvider()).toThrow(/Unsupported STORAGE_PROVIDER in REAL_MODE.*Local\/mock storage is strictly prohibited/);
    });

    it('fails closed and throws AppError when AI_PROVIDER=mock in REAL_MODE (DEMO_MODE=false)', () => {
      (env as any).DEMO_MODE = false;
      (env as any).AI_PROVIDER = 'mock';

      expect(() => getAIProvider()).toThrow(/Unsupported AI_PROVIDER in REAL_MODE.*Mock AI is strictly prohibited/);
      expect(() => getVerificationProvider()).toThrow(/Unsupported AI_PROVIDER for verification in REAL_MODE.*Mock verification is strictly prohibited/);
    });

    it('fails closed and throws AppError on unsupported DATABASE_PROVIDER in REAL_MODE', () => {
      (env as any).DEMO_MODE = false;
      (env as any).DATABASE_PROVIDER = 'unsupported_db';

      expect(() => getDatabaseProvider()).toThrow(/Unsupported DATABASE_PROVIDER/);
    });

    it('fails closed and throws AppError on unsupported STORAGE_PROVIDER in REAL_MODE', () => {
      (env as any).DEMO_MODE = false;
      (env as any).STORAGE_PROVIDER = 'unsupported_storage';

      expect(() => getStorageProvider()).toThrow(/Unsupported STORAGE_PROVIDER/);
    });

    it('fails closed and throws AppError on unsupported AI_PROVIDER in REAL_MODE', () => {
      (env as any).DEMO_MODE = false;
      (env as any).AI_PROVIDER = 'unsupported_ai';

      expect(() => getAIProvider()).toThrow(/Unsupported AI_PROVIDER/);
      expect(() => getVerificationProvider()).toThrow(/Unsupported AI_PROVIDER for verification/);
    });

    it('fails closed and throws AppError on unsupported AUTH_PROVIDER', () => {
      (env as any).AUTH_PROVIDER = 'unsupported_auth';

      expect(() => getAuthProvider()).toThrow(/Unsupported AUTH_PROVIDER/);
    });
  });

  describe('2. REAL_MODE Startup Validation (Blocker B3)', () => {
    const validTargetConfig = {
      DEMO_MODE: false,
      PROVIDER_MODE: 'cloud' as const,
      AUTH_PROVIDER: 'supabase' as const,
      DATABASE_PROVIDER: 'postgres' as const,
      STORAGE_PROVIDER: 'r2' as const,
      AI_PROVIDER: 'openai' as const,
      SUPABASE_URL: 'https://sihttdjkubjuizwdjmrj.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test_key',
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/postgres',
      OPENAI_API_KEY: 'sk-test-openai-key',
      R2_ACCOUNT_ID: 'test-r2-account-id',
      R2_ACCESS_KEY_ID: 'test-r2-access-key',
      R2_SECRET_ACCESS_KEY: 'test-r2-secret-key',
      CORS_ALLOWED_ORIGINS: ['https://civicpulse.vercel.app']
    };

    it('passes validation when all target production requirements are provided', () => {
      const result = validateRealModeConfig(validTargetConfig as any);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(() => assertRealModeConfig(validTargetConfig as any)).not.toThrow();
    });

    it('does NOT require Firebase or Gemini credentials in target production path', () => {
      const configWithoutGoogle = {
        ...validTargetConfig,
        FIREBASE_PROJECT_ID: '',
        FIREBASE_WEB_API_KEY: '',
        GEMINI_API_KEY: '',
        GOOGLE_APPLICATION_CREDENTIALS: ''
      };

      const result = validateRealModeConfig(configWithoutGoogle as any);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails closed when required credentials are missing individually', () => {
      const requiredFields = [
        { field: 'SUPABASE_URL', expectedError: 'SUPABASE_URL is required when AUTH_PROVIDER=supabase' },
        { field: 'SUPABASE_SECRET_KEY', expectedError: 'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required when AUTH_PROVIDER=supabase' },
        { field: 'DATABASE_URL', expectedError: 'DATABASE_URL is required when DATABASE_PROVIDER=postgres' },
        { field: 'OPENAI_API_KEY', expectedError: 'OPENAI_API_KEY is required when AI_PROVIDER=openai' },
        { field: 'R2_ACCOUNT_ID', expectedError: 'R2_ACCOUNT_ID is required when STORAGE_PROVIDER=r2' },
        { field: 'R2_ACCESS_KEY_ID', expectedError: 'R2_ACCESS_KEY_ID is required when STORAGE_PROVIDER=r2' },
        { field: 'R2_SECRET_ACCESS_KEY', expectedError: 'R2_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=r2' }
      ];

      for (const { field, expectedError } of requiredFields) {
        const config = { ...validTargetConfig, [field]: '' };
        const result = validateRealModeConfig(config as any);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(expectedError);
      }
    });

    it('fails closed when provider flags are mismatched or partially configured', () => {
      const mismatchedConfig = {
        ...validTargetConfig,
        DATABASE_PROVIDER: 'firestore' as const
      };

      const result = validateRealModeConfig(mismatchedConfig as any);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("DATABASE_PROVIDER must be 'postgres'"))).toBe(true);
    });

    it('rejects wildcard CORS with credentials in REAL_MODE', () => {
      const wildcardConfig = {
        ...validTargetConfig,
        CORS_ALLOWED_ORIGINS: ['*']
      };

      const result = validateRealModeConfig(wildcardConfig as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Wildcard CORS (*) is strictly prohibited in REAL_MODE with credentials');
    });

    it('never prints secret credential values in assertRealModeConfig error message', () => {
      const invalidConfig = {
        ...validTargetConfig,
        DATABASE_URL: '',
        OPENAI_API_KEY: ''
      };

      let thrownMessage = '';
      try {
        assertRealModeConfig(invalidConfig as any);
      } catch (err: any) {
        thrownMessage = err.message;
      }

      expect(thrownMessage).toContain('DATABASE_URL is required');
      expect(thrownMessage).toContain('OPENAI_API_KEY is required');
      // Ensure existing secrets are never leaked into the message
      expect(thrownMessage).not.toContain(validTargetConfig.SUPABASE_SECRET_KEY);
      expect(thrownMessage).not.toContain(validTargetConfig.R2_SECRET_ACCESS_KEY);
    });

    it('preserves rollback Firebase validation when AUTH_PROVIDER is firebase', () => {
      const rollbackConfig = {
        DEMO_MODE: false,
        AUTH_PROVIDER: 'firebase' as const,
        DATABASE_PROVIDER: 'firestore' as const,
        STORAGE_PROVIDER: 'local' as const,
        AI_PROVIDER: 'gemini' as const,
        FIREBASE_PROJECT_ID: ''
      };

      const result = validateRealModeConfig(rollbackConfig as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('FIREBASE_PROJECT_ID is required when DEMO_MODE=false');
    });
  });

  describe('3. CORS and Observability Endpoints (Blocker B5, Health/Readiness)', () => {
    it('GET /api/v1/health responds 200 with ok status and without leaking secrets', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.version).toBe('1.0.0');
      expect(res.body.data.timestamp).toBeDefined();

      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('secret');
      expect(bodyStr).not.toContain('postgres');
      expect(bodyStr).not.toContain('database');
    });

    it('GET /api/v1/ready responds without leaking credentials or internal infrastructure', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/ready');

      expect([200, 503]).toContain(res.status);
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('password');
      expect(bodyStr).not.toContain('DATABASE_URL');
      expect(bodyStr).not.toContain('pooler');
    });

    it('CORS allows requests from explicitly configured origins', async () => {
      (env as any).CORS_ALLOWED_ORIGINS = ['https://civicpulse.vercel.app'];
      const app = createApp();

      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://civicpulse.vercel.app');

      expect(res.headers['access-control-allow-origin']).toBe('https://civicpulse.vercel.app');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('CORS blocks requests from unauthorized origins', async () => {
      (env as any).CORS_ALLOWED_ORIGINS = ['https://civicpulse.vercel.app'];
      const app = createApp();

      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-site.example.com');

      // Unauthorized origin does not receive Access-Control-Allow-Origin
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
