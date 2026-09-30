import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('Health Endpoint', () => {
  const app = createApp();

  it('GET /health returns 200 OK with minimal safe response without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
    expect(res.body.version).toBeUndefined();
    expect(res.body.env).toBeUndefined();
    expect(res.body.secret).toBeUndefined();
  });

  it('GET /api/v1/health returns 200 OK with status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.version).toBe('1.0.0');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /unknown-route returns 404 with standardized error format', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeDefined();
  });
});
