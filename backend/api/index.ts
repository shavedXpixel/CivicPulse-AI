import { createApp } from '../src/app';
import { env, assertRealModeConfig } from '../src/config/env';

// Validate real-mode requirements if DEMO_MODE is disabled in production
if (!env.DEMO_MODE) {
  assertRealModeConfig();
}

const app = createApp();

export default app;
