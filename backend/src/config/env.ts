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
  AI_MODEL_GENERAL: z.string().default('gemini-2.5-flash'),
  AI_MODEL_EMBEDDING: z.string().default('text-embedding-004')
});

export const env = EnvSchema.parse(process.env);
