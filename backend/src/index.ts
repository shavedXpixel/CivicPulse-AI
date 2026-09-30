import { createApp } from './app';
import { env, assertRealModeConfig } from './config/env';

// Validate real-mode requirements if DEMO_MODE is disabled
if (!env.DEMO_MODE) {
  assertRealModeConfig();
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[CivicPulse Backend] API Server running on port ${env.PORT}`);
  console.log(`[CivicPulse Backend] Health check: http://localhost:${env.PORT}/api/v1/health`);
  console.log(`[CivicPulse Backend] Readiness check: http://localhost:${env.PORT}/api/v1/ready`);
  console.log(`[CivicPulse Backend] Mode: ${env.NODE_ENV} | Provider Mode: ${env.PROVIDER_MODE} | Demo Mode: ${env.DEMO_MODE}`);
});

// AUD-DEP-02: Graceful shutdown handling
let isShuttingDown = false;
function gracefulShutdown(signal: string): void {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[CivicPulse Backend] Received ${signal}. Initiating graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error('[CivicPulse Backend] Error during server close:', err);
      process.exit(1);
    }
    console.log('[CivicPulse Backend] HTTP server closed gracefully.');
    process.exit(0);
  });

  // Force close after 10s if connections remain open
  setTimeout(() => {
    console.error('[CivicPulse Backend] Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
