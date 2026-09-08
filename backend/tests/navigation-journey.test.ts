import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider, MockGovernanceAIProvider, MockSimulationAIProvider } from '../src/providers';
import { InterventionType } from '@civicpulse/shared';

describe('Demo Navigation & Role Journey Access Verification', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    ProviderContainer.setGovernanceProvider(new MockGovernanceAIProvider());
    ProviderContainer.setSimulationProvider(new MockSimulationAIProvider());
    app = createApp();
  });

  describe('1. Citizen Journey Access & Protection', () => {
    it('allows citizen to access personal reports (/api/v1/signals/me)', async () => {
      const res = await request(app)
        .get('/api/v1/signals/me')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('strictly forbids citizen from accessing Governance AI (/api/v1/governance/query)', async () => {
      const res = await request(app)
        .post('/api/v1/governance/query')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({ question: 'What are the top public problems?' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('strictly forbids citizen from running Intervention Simulations', async () => {
      const res = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          problem_id: 'PRB-2026-0819',
          scenario_name: 'Unauthorized Simulation',
          intervention_type: InterventionType.CAPACITY_BOOST,
          additional_budget_inr: 100000,
          extra_crews: 1,
          population_relief_rate: 0.5,
          response_time_reduction_hours: 0,
          include_facility_mitigation: false,
          include_permanent_renewal: false
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Government Command Center Journey Access', () => {
    it('allows government admin to fetch dashboard summary', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.active_problems).toBeGreaterThan(0);
    });

    it('allows government official to view problem list', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('retrieves canonical Golden Demo Problem PRB-2026-0819 with Impact Score 92', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819/details')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('PRB-2026-0819');
      expect(res.body.data.ward_id).toBe('WARD-018');
      expect(res.body.data.impact_score).toBe(92);
      expect(res.body.data.department_id).toBe('WATCO');
    });

    it('allows authorized government official to query Governance AI', async () => {
      const res = await request(app)
        .post('/api/v1/governance/query')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({ question: 'What are the top public problems in Ward 18?' });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.sources)).toBe(true);
      expect(res.body.data.sources.length).toBeGreaterThan(0);
    });

    it('allows authorized government official to simulate intervention on PRB-2026-0819', async () => {
      const res = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          problem_id: 'PRB-2026-0819',
          scenario_name: 'Rapid Repair',
          intervention_type: InterventionType.CAPACITY_BOOST,
          additional_budget_inr: 420000,
          extra_crews: 2,
          population_relief_rate: 0.95,
          response_time_reduction_hours: 0,
          include_facility_mitigation: true,
          include_permanent_renewal: false
        });

      expect(res.status).toBe(200);
      expect(res.body.data.projected.impact_score).toBeLessThan(92);
    });
  });

  describe('3. Field Officer Queue Access', () => {
    it('allows field officer to access assigned queue', async () => {
      const res = await request(app)
        .get('/api/v1/assignments?assigned_to=me')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      // Rajesh K has PRB-2026-0819 assigned in golden fixtures
      const hasGolden = res.body.data.some((a: any) => a.problem_id === 'PRB-2026-0819');
      expect(hasGolden).toBe(true);
    });
  });
});
