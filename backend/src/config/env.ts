import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load root or local .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  PROVIDER_MODE: z.enum(['cloud', 'mock']).default('mock'),
  DEMO_MODE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),
  LOG_LEVEL: z.string().default('info'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_PRIMARY_MODEL: z.string().optional(),
  GEMINI_FALLBACK_MODEL: z.string().optional().default('gemini-3.5-flash'),
  AI_MODEL_GENERAL: z.string().default('gemini-3.6-flash'),
  AI_MODEL_EMBEDDING: z.string().default('gemini-embedding-001'),
  AI_EMBEDDING_MODEL: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional().default(''),
  FIREBASE_WEB_API_KEY: z.string().optional().default(''),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().default(''),
  CORS_ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000,http://127.0.0.1:3000'),

  // Phase 15B — Non-Google Target Architecture & Auth Configuration
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_SECRET_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional().default(''),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(''),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(''),
  AUTH_PROVIDER: z.enum(['supabase', 'firebase', 'mock']).default('firebase'),
  DATABASE_URL: z.string().optional().default(''),
  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET_NAME: z.string().optional().default('civicpulse-media'),
  OPENAI_API_KEY: z.string().optional().default(''),
  AI_PROVIDER: z.enum(['gemini', 'openai', 'anthropic', 'mock']).default('gemini'),
  AI_MODEL_SIGNAL_UNDERSTANDING: z.string().optional().default('gpt-4o-mini'),
  AI_MODEL_SIGNAL_FALLBACK: z.string().optional().default('gpt-4o'),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  AI_MODEL_VERIFICATION: z.string().optional().default('gpt-4o'),
  AI_MODEL_GOVERNANCE: z.string().optional().default('gpt-4o'),
  AI_MODEL_SIMULATION: z.string().optional().default('gpt-4o-mini')
});

const parsed = EnvSchema.parse(process.env);

export const env = {
  ...parsed,
  SUPABASE_URL: parsed.SUPABASE_URL || parsed.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_SECRET_KEY: parsed.SUPABASE_SECRET_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.SUPABASE_SECRET_KEY || '',
  NEXT_PUBLIC_SUPABASE_URL: parsed.NEXT_PUBLIC_SUPABASE_URL || parsed.SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY || parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  AUTH_PROVIDER: parsed.AUTH_PROVIDER || 'firebase',
  GEMINI_PRIMARY_MODEL: parsed.GEMINI_PRIMARY_MODEL || parsed.AI_MODEL_GENERAL || 'gemini-3.6-flash',
  GEMINI_FALLBACK_MODEL: parsed.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash',
  AI_EMBEDDING_MODEL: parsed.AI_EMBEDDING_MODEL || parsed.AI_MODEL_EMBEDDING || 'text-embedding-004',
  CORS_ALLOWED_ORIGINS: (parsed.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
};

export interface RealModeValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates whether the environment has the necessary configuration for REAL_MODE.
 * Cleanly supports both local development and Cloud Run / ADC environments.
 */
export function validateRealModeConfig(targetEnv?: Partial<typeof env>): RealModeValidationResult {
  const target = targetEnv || env;
  const errors: string[] = [];

  if (target.DEMO_MODE === false) {
    if (!target.FIREBASE_PROJECT_ID || target.FIREBASE_PROJECT_ID.trim() === '') {
      errors.push('FIREBASE_PROJECT_ID is required when DEMO_MODE=false');
    }

    if (target.PROVIDER_MODE === 'cloud') {
      if (!target.GEMINI_API_KEY || target.GEMINI_API_KEY.trim() === '') {
        errors.push('GEMINI_API_KEY is required when PROVIDER_MODE=cloud and DEMO_MODE=false');
      }
    }

    if (target.GOOGLE_APPLICATION_CREDENTIALS && target.GOOGLE_APPLICATION_CREDENTIALS.trim() !== '') {
      const fs = require('fs');
      const p = target.GOOGLE_APPLICATION_CREDENTIALS;
      let resolved = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
      if (!fs.existsSync(resolved) && !path.isAbsolute(p)) {
        const parentResolved = path.resolve(process.cwd(), '..', p);
        if (fs.existsSync(parentResolved)) {
          resolved = parentResolved;
        }
      }
      if (!fs.existsSync(resolved)) {
        errors.push(`GOOGLE_APPLICATION_CREDENTIALS file not found at: ${target.GOOGLE_APPLICATION_CREDENTIALS}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Throws a descriptive error if REAL_MODE configuration is invalid.
 */
export function assertRealModeConfig(targetEnv?: Partial<typeof env>): void {
  const result = validateRealModeConfig(targetEnv);
  if (!result.valid) {
    throw new Error(
      `[CivicPulse Configuration Error] REAL_MODE is active (DEMO_MODE=false) but configuration is incomplete:\n` +
      result.errors.map((e) => `  - ${e}`).join('\n')
    );
  }
}

/**
 * Phase 15B Scaffolding: Validates whether target non-Google cloud credentials are configured.
 */
export function validateNonGoogleConfig(targetEnv?: Partial<typeof env>): RealModeValidationResult {
  const target = targetEnv || env;
  const errors: string[] = [];

  if (target.DEMO_MODE === false && target.PROVIDER_MODE === 'cloud') {
    if (!target.SUPABASE_URL || target.SUPABASE_URL.trim() === '') {
      errors.push('SUPABASE_URL is required in non-Google cloud production mode.');
    }
    if (!target.DATABASE_URL || target.DATABASE_URL.trim() === '') {
      errors.push('DATABASE_URL is required in non-Google cloud production mode.');
    }
    if (!target.OPENAI_API_KEY || target.OPENAI_API_KEY.trim() === '') {
      errors.push('OPENAI_API_KEY is required in non-Google cloud production mode.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Phase 15B.4: Validates Supabase authentication configuration.
 */
export function validateSupabaseAuthConfig(targetEnv?: Partial<typeof env>): RealModeValidationResult {
  const target = targetEnv || env;
  const errors: string[] = [];

  if (target.AUTH_PROVIDER === 'supabase') {
    if (!target.SUPABASE_URL || target.SUPABASE_URL.trim() === '') {
      errors.push('SUPABASE_URL is required when AUTH_PROVIDER=supabase.');
    }
    if (!target.SUPABASE_SECRET_KEY || target.SUPABASE_SECRET_KEY.trim() === '') {
      errors.push('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is required when AUTH_PROVIDER=supabase.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}


