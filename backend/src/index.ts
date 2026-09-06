import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[CivicPulse Backend] API Server running on port ${env.PORT}`);
  console.log(`[CivicPulse Backend] Health check: http://localhost:${env.PORT}/api/v1/health`);
  console.log(`[CivicPulse Backend] Mode: ${env.NODE_ENV} | Provider Mode: ${env.PROVIDER_MODE}`);
});
