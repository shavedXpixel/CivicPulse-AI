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
  AI_MODEL_GENERAL: z.string().default('gemini-3.5-flash'),
  AI_MODEL_EMBEDDING: z.string().default('gemini-embedding-001'),
  AI_EMBEDDING_MODEL: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional().default(''),
  FIREBASE_WEB_API_KEY: z.string().optional().default(''),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().default('')
});

const parsed = EnvSchema.parse(process.env);

export const env = {
  ...parsed,
  AI_EMBEDDING_MODEL: parsed.AI_EMBEDDING_MODEL || parsed.AI_MODEL_EMBEDDING || 'text-embedding-004'
};

export interface RealModeValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates whether the environment has the necessary configuration for REAL_MODE.
 */
export function validateRealModeConfig(targetEnv?: Partial<typeof env>): RealModeValidationResult {
  const target = targetEnv || env;
  const errors: string[] = [];

  if (target.DEMO_MODE === false) {
    if (!target.FIREBASE_PROJECT_ID || target.FIREBASE_PROJECT_ID.trim() === '') {
      errors.push('FIREBASE_PROJECT_ID is required when DEMO_MODE=false');
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

