import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider } from '../src/providers';
import { env } from '../src/config/env';

describe('Demo Persona Switching & Endpoint Protection', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    app = createApp();
  });

  it('allows persona switching in demo mode', async () => {
    const res = await request(app)
      .post('/api/v1/auth/switch-demo-persona')
      .send({ role: 'FIELD_OFFICER' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBe('demo-token-officer');
    expect(res.body.data.user.role).toBe('FIELD_OFFICER');
    expect(res.body.data.user.id).toBe('usr_officer_01');
  });

  it('returns authenticated citizen profile on GET /auth/me', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('usr_citizen_01');
    expect(res.body.data.user.role).toBe('CITIZEN');
    expect(res.body.data.citizen_profile).toBeDefined();
    expect(res.body.data.citizen_profile.preferred_language).toBe('od');
  });

  it('preserves authoritative ADMIN role in DEMO_MODE and does not convert to CITIZEN', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer demo-token-admin');

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('usr_admin_01');
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.user.role).not.toBe('CITIZEN');
  });

  it('strictly blocks switch-demo-persona when DEMO_MODE is false', async () => {
    // Temporarily simulate DEMO_MODE = false
    const originalDemoMode = env.DEMO_MODE;
    (env as any).DEMO_MODE = false;

    try {
      const res = await request(app)
        .post('/api/v1/auth/switch-demo-persona')
        .send({ role: 'ADMIN' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');
    } finally {
      (env as any).DEMO_MODE = originalDemoMode;
    }
  });
});
