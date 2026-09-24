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

describe('Phase 15B.5.2 — Deployment Implementation & Gemini Provider Suite', () => {
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

  describe('1. Explicit Provider Wiring (Gemini Target & Legacy Rollback)', () => {
    it('selects target production providers (supabase + postgres + r2 + gemini) when explicitly configured in REAL_MODE', () => {
      (env as any).DEMO_MODE = false;
      (env as any).AUTH_PROVIDER = 'supabase';
      (env as any).DATABASE_PROVIDER = 'postgres';
      (env as any).STORAGE_PROVIDER = 'r2';
      (env as any).AI_PROVIDER = 'gemini';

      expect(getAuthProvider()).toBeInstanceOf(SupabaseAuthProvider);
      expect(getDatabaseProvider()).toBeInstanceOf(PostgresDatabaseProvider);
      expect(getStorageProvider()).toBeInstanceOf(R2StorageProvider);
      expect(getAIProvider()).toBeInstanceOf(GeminiAIProvider);
      expect(getVerificationProvider()).toBeInstanceOf(GeminiVerificationProvider);
    });

    it('selects rollback Google Cloud providers (firebase + firestore + gcs + gemini) when explicitly configured in REAL_MODE', () => {
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

    it('preserves OpenAIProvider when explicitly configured (secondary/standalone provider)', () => {
      (env as any).DEMO_MODE = false;
      (env as any).AUTH_PROVIDER = 'supabase';
      (env as any).DATABASE_PROVIDER = 'postgres';
      (env as any).STORAGE_PROVIDER = 'r2';
      (env as any).AI_PROVIDER = 'openai';

      expect(getAIProvider()).toBeInstanceOf(OpenAIProvider);
      expect(getVerificationProvider()).toBeInstanceOf(OpenAIProvider);
    });

    it('returns PostgresDatabaseProvider in DEMO_MODE when DATABASE_PROVIDER=postgres, but mock AI', () => {
      (env as any).DEMO_MODE = true;
      (env as any).DATABASE_PROVIDER = 'postgres';
      (env as any).AI_PROVIDER = 'gemini';

      expect(getDatabaseProvider()).toBeInstanceOf(PostgresDatabaseProvider);
      expect(getAIProvider()).toBeInstanceOf(MockAIProvider);
      expect(getVerificationProvider()).toBeInstanceOf(MockVerificationProvider);
      expect(getStorageProvider()).toBeInstanceOf(LocalStorageProvider);
    });

    it('returns MockDatabaseProvider in DEMO_MODE when DATABASE_PROVIDER=mock', () => {
      (env as any).DEMO_MODE = true;
      (env as any).DATABASE_PROVIDER = 'mock';

      expect(getDatabaseProvider()).toBeInstanceOf(MockDatabaseProvider);
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

  describe('2. REAL_MODE Startup Validation (Gemini Alignment Tests A-G)', () => {
    const validTargetConfig = {
      DEMO_MODE: false,
      PROVIDER_MODE: 'cloud' as const,
      AUTH_PROVIDER: 'supabase' as const,
      DATABASE_PROVIDER: 'postgres' as const,
      STORAGE_PROVIDER: 'r2' as const,
      AI_PROVIDER: 'gemini' as const,
      SUPABASE_URL: 'https://sihttdjkubjuizwdjmrj.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test_key',
      DATABASE_URL: 'postgresql://postgres:pass@localhost:5432/postgres',
      GEMINI_API_KEY: 'test-gemini-api-key',
      R2_ACCOUNT_ID: 'test-r2-account-id',
      R2_ACCESS_KEY_ID: 'test-r2-access-key',
      R2_SECRET_ACCESS_KEY: 'test-r2-secret-key',
      CORS_ALLOWED_ORIGINS: ['https://civicpulse.vercel.app']
    };

    // Test A: supabase + postgres + r2 + gemini -> PASS
    it('Test A: passes validation for target stack (supabase + postgres + r2 + gemini)', () => {
      const result = validateRealModeConfig(validTargetConfig as any);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(() => assertRealModeConfig(validTargetConfig as any)).not.toThrow();
    });

    // Test B: missing GEMINI_API_KEY -> FAIL
    it('Test B: fails validation when GEMINI_API_KEY is missing from target stack', () => {
      const configMissingGemini = {
        ...validTargetConfig,
        GEMINI_API_KEY: ''
      };
      const result = validateRealModeConfig(configMissingGemini as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('GEMINI_API_KEY is required when AI_PROVIDER=gemini');
    });

    // Test C: missing OPENAI_API_KEY -> MUST NOT invalidate target stack
    it('Test C: missing OPENAI_API_KEY does NOT invalidate target production stack', () => {
      const configWithoutOpenAI = {
        ...validTargetConfig,
        OPENAI_API_KEY: undefined
      };
      const result = validateRealModeConfig(configWithoutOpenAI as any);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // Test D: supabase + postgres + r2 + openai -> invalid for selected target architecture
    it('Test D: marks supabase + postgres + r2 + openai invalid for target production stack', () => {
      const configWithOpenAI = {
        ...validTargetConfig,
        AI_PROVIDER: 'openai' as const
      };
      const result = validateRealModeConfig(configWithOpenAI as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("AI_PROVIDER must be 'gemini' in production target architecture (got 'openai')");
    });

    // Test E: Firebase + Firestore + GCS + Gemini rollback -> PASS
    it('Test E: validates legacy rollback stack (firebase + firestore + gcs + gemini) successfully', () => {
      const validRollbackConfig = {
        DEMO_MODE: false,
        PROVIDER_MODE: 'cloud' as const,
        AUTH_PROVIDER: 'firebase' as const,
        DATABASE_PROVIDER: 'firestore' as const,
        STORAGE_PROVIDER: 'gcs' as const,
        AI_PROVIDER: 'gemini' as const,
        FIREBASE_PROJECT_ID: 'civicpulse-prod',
        GEMINI_API_KEY: 'test-gemini-key',
        CORS_ALLOWED_ORIGINS: ['https://civicpulse.vercel.app']
      };

      const result = validateRealModeConfig(validRollbackConfig as any);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(() => assertRealModeConfig(validRollbackConfig as any)).not.toThrow();
    });

    // Test F: mock/local providers in REAL_MODE -> FAIL
    it('Test F: fails closed when mock or local providers are used in REAL_MODE', () => {
      const mockDbConfig = { ...validTargetConfig, DATABASE_PROVIDER: 'mock' as const };
      expect(validateRealModeConfig(mockDbConfig as any).valid).toBe(false);

      const localStoreConfig = { ...validTargetConfig, STORAGE_PROVIDER: 'local' as const };
      expect(validateRealModeConfig(localStoreConfig as any).valid).toBe(false);

      const mockStoreConfig = { ...validTargetConfig, STORAGE_PROVIDER: 'mock' as const };
      expect(validateRealModeConfig(mockStoreConfig as any).valid).toBe(false);

      const mockAiConfig = { ...validTargetConfig, AI_PROVIDER: 'mock' as const };
      expect(validateRealModeConfig(mockAiConfig as any).valid).toBe(false);

      const mockAuthConfig = { ...validTargetConfig, AUTH_PROVIDER: 'mock' as const };
      expect(validateRealModeConfig(mockAuthConfig as any).valid).toBe(false);
    });

    // Test G: unsupported combinations -> FAIL CLOSED
    it('Test G: fails closed on unsupported or mismatched provider combinations', () => {
      // Mismatched DB with target auth & storage
      const mismatchedDb = { ...validTargetConfig, DATABASE_PROVIDER: 'firestore' as const };
      const resDb = validateRealModeConfig(mismatchedDb as any);
      expect(resDb.valid).toBe(false);
      expect(resDb.errors.some((e) => e.includes("DATABASE_PROVIDER must be 'postgres'"))).toBe(true);

      // Mismatched storage with target auth & db
      const mismatchedStorage = { ...validTargetConfig, STORAGE_PROVIDER: 'gcs' as const };
      const resStorage = validateRealModeConfig(mismatchedStorage as any);
      expect(resStorage.valid).toBe(false);
      expect(resStorage.errors.some((e) => e.includes("STORAGE_PROVIDER must be 'r2'"))).toBe(true);

      // Completely unsupported provider combination
      const unsupportedComb = {
        DEMO_MODE: false,
        AUTH_PROVIDER: 'unsupported_auth' as any,
        DATABASE_PROVIDER: 'unsupported_db' as any,
        STORAGE_PROVIDER: 'unsupported_storage' as any,
        AI_PROVIDER: 'gemini' as const
      };
      const resUnsupported = validateRealModeConfig(unsupportedComb as any);
      expect(resUnsupported.valid).toBe(false);
      expect(resUnsupported.errors.some((e) => e.includes('Unsupported provider combination'))).toBe(true);
    });

    it('fails closed when any required target credentials are missing individually', () => {
      const requiredFields = [
        { field: 'SUPABASE_URL', expectedError: 'SUPABASE_URL is required when AUTH_PROVIDER=supabase' },
        { field: 'SUPABASE_SECRET_KEY', expectedError: 'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required when AUTH_PROVIDER=supabase' },
        { field: 'DATABASE_URL', expectedError: 'DATABASE_URL is required when DATABASE_PROVIDER=postgres' },
        { field: 'GEMINI_API_KEY', expectedError: 'GEMINI_API_KEY is required when AI_PROVIDER=gemini' },
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

    it('does NOT require Firebase or OpenAI credentials in target production path', () => {
      const configWithoutLegacy = {
        ...validTargetConfig,
        FIREBASE_PROJECT_ID: '',
        FIREBASE_WEB_API_KEY: '',
        OPENAI_API_KEY: '',
        GOOGLE_APPLICATION_CREDENTIALS: ''
      };

      const result = validateRealModeConfig(configWithoutLegacy as any);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
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
        GEMINI_API_KEY: ''
      };

      let thrownMessage = '';
      try {
        assertRealModeConfig(invalidConfig as any);
      } catch (err: any) {
        thrownMessage = err.message;
      }

      expect(thrownMessage).toContain('DATABASE_URL is required');
      expect(thrownMessage).toContain('GEMINI_API_KEY is required');
      // Ensure existing secrets are never leaked into the message
      expect(thrownMessage).not.toContain(validTargetConfig.SUPABASE_SECRET_KEY);
      expect(thrownMessage).not.toContain(validTargetConfig.R2_SECRET_ACCESS_KEY);
    });
  });

  describe('3. CORS and Observability Endpoints (Health/Readiness)', () => {
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
