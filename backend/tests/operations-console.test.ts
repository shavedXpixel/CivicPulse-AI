import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';

describe('Phase 11 Operations Console API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('1. Dashboard Operational KPIs & SLA Risk Sorting', () => {
    it('GET /api/v1/dashboard/summary includes median_resolution_time_hours and KPI counts', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('total_signals');
      expect(res.body.data).toHaveProperty('active_problems');
      expect(res.body.data).toHaveProperty('critical_problems');
      expect(res.body.data).toHaveProperty('resolved_problems');
      expect(res.body.data).toHaveProperty('sla_on_track_count');
      expect(res.body.data).toHaveProperty('sla_at_risk_count');
      expect(res.body.data).toHaveProperty('sla_breached_count');
      expect(res.body.data).toHaveProperty('sla_compliance_rate');
      expect(res.body.data).toHaveProperty('scope_description');
      // median_resolution_time_hours is a number or null
      expect('median_resolution_time_hours' in res.body.data).toBe(true);
    });

    it('GET /api/v1/dashboard/sla-risk sorts BREACHED before AT_RISK and by impact score', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/sla-risk')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const items = res.body.data;
      if (items.length >= 2) {
        for (let i = 0; i < items.length - 1; i++) {
          const curr = items[i];
          const next = items[i + 1];
          const currWeight = curr.sla_state?.status === 'BREACHED' ? 2 : curr.sla_state?.status === 'AT_RISK' ? 1 : 0;
          const nextWeight = next.sla_state?.status === 'BREACHED' ? 2 : next.sla_state?.status === 'AT_RISK' ? 1 : 0;
          expect(currWeight).toBeGreaterThanOrEqual(nextWeight);
          if (currWeight === nextWeight) {
            expect(curr.impact_score).toBeGreaterThanOrEqual(next.impact_score);
          }
        }
      }
    });
  });

  describe('2. Department Officers Directory', () => {
    it('GET /api/v1/departments/:id/officers returns eligible officers for WATCO', async () => {
      const res = await request(app)
        .get('/api/v1/departments/WATCO/officers')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const officer = res.body.data[0];
      expect(officer).toHaveProperty('id');
      expect(officer).toHaveProperty('display_name');
      expect(officer).toHaveProperty('department_id', 'WATCO');
    });

    it('GET /api/v1/departments/:id/officers returns empty list for unknown department', async () => {
      const res = await request(app)
        .get('/api/v1/departments/UNKNOWN_DEPT/officers')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('requires authentication to access department officers', async () => {
      const res = await request(app)
        .get('/api/v1/departments/WATCO/officers');

      expect(res.status).toBe(401);
    });
  });

  describe('3. Assignment & Field Workflows', () => {
    it('logs official action with correct schema { action, note }', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/actions')
        .set('Authorization', 'Bearer demo-token-officer')
        .send({
          action: 'REQUESTED_INFO',
          note: 'Requesting additional technical schematics for pipeline valve.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.action).toHaveProperty('id');
      expect(res.body.data.action.action_type).toBe('REQUESTED_INFO');
    });

    it('rejects invalid action schema with 400', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/actions')
        .set('Authorization', 'Bearer demo-token-officer')
        .send({
          action_type: 'STARTED_WORK' // Invalid property name (must be 'action')
        });

      expect(res.status).toBe(400);
    });

    it('assigns problem with department and eligible officer', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/assign')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          department_id: 'WATCO',
          assigned_to: 'usr_officer_01',
          priority: 'CRITICAL',
          notes: 'High pressure mains maintenance dispatch'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.assignment).toHaveProperty('id');
      expect(res.body.data.assignment.department_id).toBe('WATCO');
      expect(res.body.data.assignment.assigned_to).toBe('usr_officer_01');
    });
  });
});
