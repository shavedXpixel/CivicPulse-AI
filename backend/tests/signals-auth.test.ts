import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider } from '../src/providers';

describe('Signal Read Authorization & Scope Enforcement', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    // Reset database to pristine seeded state before each test
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    app = createApp();
  });

  it('rejects unauthenticated requests to /signals with 401', async () => {
    const res = await request(app).get('/api/v1/signals');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows a citizen to create a signal and sets status=ACTIVE and processing_status=PENDING', async () => {
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Burst drinking water line flooding street in Nayapalli',
        ward_id: 'WARD-018',
        location: { lat: 20.2961, lng: 85.8245 }
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toMatch(/^sig_/);
    expect(res.body.data.citizen_id).toBe('usr_citizen_01');
    expect(res.body.data.status).toBe('ACTIVE');
    expect(res.body.data.processing_status).toBe('PENDING');
  });

  it('allows a citizen to retrieve their own signal', async () => {
    const res = await request(app)
      .get('/api/v1/signals/sig_1001')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('sig_1001');
    expect(res.body.data.citizen_id).toBe('usr_citizen_01');
  });

  it('enforces privacy: returns 404 when Citizen A tries to read Citizen B private signal', async () => {
    // sig_isolated_99 belongs to usr_citizen_02
    const res = await request(app)
      .get('/api/v1/signals/sig_isolated_99')
      .set('Authorization', 'Bearer demo-token-citizen'); // demo-token-citizen is usr_citizen_01

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('allows Citizen B to read their own private signal', async () => {
    const res = await request(app)
      .get('/api/v1/signals/sig_isolated_99')
      .set('Authorization', 'Bearer demo-token-citizen-2'); // usr_citizen_02

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('sig_isolated_99');
  });

  it('prevents cross-user data scraping: automatically scopes citizen list to own signals', async () => {
    // Even if Citizen A passes ?citizen_id=usr_citizen_02, the server strictly overrides to Citizen A
    const res = await request(app)
      .get('/api/v1/signals?citizen_id=usr_citizen_02')
      .set('Authorization', 'Bearer demo-token-citizen');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Every returned signal must belong to usr_citizen_01
    for (const sig of res.body.data) {
      expect(sig.citizen_id).toBe('usr_citizen_01');
      expect(sig.citizen_id).not.toBe('usr_citizen_02');
    }
  });

  it('allows admin to query signals across citizens', async () => {
    const res = await request(app)
      .get('/api/v1/signals?citizen_id=usr_citizen_02')
      .set('Authorization', 'Bearer demo-token-admin');

    expect(res.status).toBe(200);
    expect(res.body.data.some((s: any) => s.id === 'sig_isolated_99')).toBe(true);
  });
});
