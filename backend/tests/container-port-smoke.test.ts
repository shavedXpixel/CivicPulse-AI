import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

describe('Phase 15 Container Port & Deployment Contract Smoke Tests', () => {
  const rootDir = path.resolve(__dirname, '../../');
  const backendDockerfile = path.join(rootDir, 'backend', 'Dockerfile');
  const frontendDockerfile = path.join(rootDir, 'frontend', 'Dockerfile');
  const cloudbuildYaml = path.join(rootDir, 'cloudbuild.yaml');

  describe('1. Dockerfile & Cloud Build Invariants', () => {
    it('verifies backend/Dockerfile configures PORT 8080 and correct entrypoint', () => {
      const content = fs.readFileSync(backendDockerfile, 'utf-8');
      expect(content).toContain('ENV PORT=8080');
      expect(content).toContain('EXPOSE 8080');
      expect(content).toContain('CMD ["node", "dist/index.js"]');
    });

    it('verifies frontend/Dockerfile configures PORT 8080 and standalone entrypoint', () => {
      const content = fs.readFileSync(frontendDockerfile, 'utf-8');
      expect(content).toContain('ENV PORT=8080');
      expect(content).toContain('ENV HOSTNAME="0.0.0.0"');
      expect(content).toContain('EXPOSE 8080');
      expect(content).toContain('CMD ["node", "server.js"]');
    });

    it('verifies cloudbuild.yaml enforces canonical ports, service account, and secrets', () => {
      const content = fs.readFileSync(cloudbuildYaml, 'utf-8');
      // Backend checks
      expect(content).toContain('--port=8080');
      expect(content).toContain('--service-account=civicpulse-backend-sa@$PROJECT_ID.iam.gserviceaccount.com');
      expect(content).toContain('--set-secrets=GEMINI_API_KEY=civicpulse-gemini-api-key:latest');
      expect(content).toContain('CORS_ALLOWED_ORIGINS=$_FRONTEND_URL');

      // Frontend checks
      expect(content).toContain('PORT=8080');
    });
  });

  describe('2. Backend Production Entrypoint Smoke Test', () => {
    it('starts backend on configured PORT and responds 200 to health check', async () => {
      const testPort = 8091;
      let backendProcess: ChildProcess | null = null;

      try {
        backendProcess = spawn(
          process.execPath || 'node',
          [path.join(rootDir, 'backend', 'dist', 'index.js')],
          {
            cwd: path.join(rootDir, 'backend'),
            env: {
              ...process.env,
              PORT: String(testPort),
              NODE_ENV: 'production',
              DEMO_MODE: 'true',
              PROVIDER_MODE: 'mock'
            },
            stdio: 'pipe'
          }
        );

        let errLogs = '';
        let outLogs = '';
        backendProcess.on('error', (err) => { errLogs += `Spawn error: ${err.message}`; });
        backendProcess.stderr?.on('data', (d) => { errLogs += d.toString(); });
        backendProcess.stdout?.on('data', (d) => { outLogs += d.toString(); });

        // Wait for server to be responsive
        let healthy = false;
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 300));
          try {
            const res = await fetch(`http://127.0.0.1:${testPort}/api/v1/health`);
            if (res.status === 200) {
              const body = await res.json();
              expect(body.data.status).toBe('ok');
              healthy = true;
              break;
            }
          } catch {
            // Still starting
          }
        }

        if (!healthy) {
          console.error('[ContainerSmoke] Backend failed to become healthy. Out:', outLogs, 'Err:', errLogs);
        }

        expect(healthy).toBe(true);
      } finally {
        if (backendProcess) {
          backendProcess.kill();
        }
      }
    }, 15000);
  });

  describe('3. Frontend Next.js Standalone Entrypoint Smoke Test', () => {
    it('starts standalone frontend on configured PORT and responds 200 to /login', async () => {
      const testPort = 8092;
      const standaloneDir = path.join(rootDir, 'frontend', '.next', 'standalone', 'frontend');
      const serverScript = path.join(standaloneDir, 'server.js');

      // Check if standalone build exists
      if (!fs.existsSync(serverScript)) {
        console.warn('Standalone server.js not found, skipping runtime test');
        return;
      }

      let frontendProcess: ChildProcess | null = null;

      try {
        frontendProcess = spawn('node', [serverScript], {
          cwd: standaloneDir,
          env: {
            ...process.env,
            PORT: String(testPort),
            HOSTNAME: '127.0.0.1',
            NODE_ENV: 'production'
          },
          stdio: 'pipe'
        });

        let responsive = false;
        for (let i = 0; i < 25; i++) {
          await new Promise((r) => setTimeout(r, 400));
          try {
            const res = await fetch(`http://127.0.0.1:${testPort}/login`);
            if (res.status === 200) {
              const text = await res.text();
              expect(text).toContain('CivicPulse AI');
              responsive = true;
              break;
            }
          } catch {
            // Still starting
          }
        }

        expect(responsive).toBe(true);
      } finally {
        if (frontendProcess) {
          frontendProcess.kill();
        }
      }
    }, 20000);
  });
});
