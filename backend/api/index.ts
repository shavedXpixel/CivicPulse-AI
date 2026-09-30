import { createApp } from '../src/app';
import { env, assertRealModeConfig } from '../src/config/env';
import type { IncomingMessage, ServerResponse } from 'http';

let app: any = null;
let initError: Error | null = null;

try {
  if (!env.DEMO_MODE) {
    assertRealModeConfig();
  }
  app = createApp();
} catch (err: any) {
  initError = err instanceof Error ? err : new Error(String(err));
  console.error('[CivicPulse Vercel Cold-Start Error]', initError);
}

// Serverless entrypoint handler compatible with Vercel and Express
function handler(req: IncomingMessage, res: ServerResponse): void {
  if (initError) {
    console.error(`[CivicPulse Handler Error on ${req.url}]:`, initError.message);
    const isHealthCheck = req.url === '/health' || req.url === '/api/v1/health';
    const statusCode = isHealthCheck ? 200 : 500;

    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        status: isHealthCheck ? 'ok' : 'error',
        warning: isHealthCheck ? 'Service running in degraded mode due to configuration error' : undefined,
        error: initError.message
      })
    );
    return;
  }

  return app(req, res);
}

export default handler;

// Ensure CommonJS compatibility for Vercel serverless loader
if (typeof module !== 'undefined' && module.exports) {
  module.exports = handler;
  module.exports.default = handler;
}


