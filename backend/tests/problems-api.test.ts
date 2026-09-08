import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider } from '../src/providers';
import { SignalStatus, ProblemStatus } from '@civicpulse/shared';

describe('Problem Clusters & Impact Intelligence API (Phase 4)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    // Reset database to clean seeded state before each test
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    app = createApp();
  });

  describe('GET /api/v1/problems (Ranked Incident List)', () => {
    it('returns ranked problem clusters ordered by impact_score DESC', async () => {
      const res = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      // Verify descending impact score ordering
      const scores = res.body.data.map((p: any) => p.impact_score);
      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
      }

      // Golden Demo cluster PRB-2026-0819 should be ranked first with score 92
      const topProblem = res.body.data[0];
      expect(topProblem.id).toBe('PRB-2026-0819');
      expect(topProblem.impact_score).toBe(92);
      expect(topProblem.impact_level).toBe('CRITICAL');
      expect(topProblem.status).toBe(ProblemStatus.IN_PROGRESS);
      expect(topProblem.is_demo).toBe(true);
      expect(topProblem.signal_count).toBe(327); // Synthetic aggregate demo count
      expect(topProblem.supporting_media_count).toBe(42);
    });

    it('allows filtering by category and ward', async () => {
      const res = await request(app)
        .get('/api/v1/problems?category=water_supply&ward_id=WARD-018')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe('PRB-2026-0819');
    });
  });

  describe('GET /api/v1/problems/:id & :id/details', () => {
    it('returns Golden Demo cluster with the exact 7-factor breakdown inputs', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      const prob = res.body.data;
      expect(prob.id).toBe('PRB-2026-0819');
      expect(prob.severity_score).toBe(24);
      expect(prob.population_score).toBe(18);
      expect(prob.duration_score).toBe(14);
      expect(prob.concentration_score).toBe(14);
      expect(prob.critical_exposure_score).toBe(9);
      expect(prob.recurrence_score).toBe(8);
      expect(prob.evidence_score).toBe(5);
      expect(prob.impact_score).toBe(92);
      expect(prob.impact_level).toBe('CRITICAL');
      expect(prob.is_demo).toBe(true);
    });

    it('returns extended details including members, timeline, and impact explanation', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819/details')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      const detail = res.body.data;
      expect(detail.id).toBe('PRB-2026-0819');
      expect(detail.members).toBeDefined();
      expect(detail.members.length).toBe(3); // Representative member records
      expect(detail.timeline).toBeDefined();
      expect(detail.timeline.length).toBeGreaterThanOrEqual(2);
      expect(detail.impact_explanation).toContain('92/100');
    });

    it('returns 404 for non-existent problem ID', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-NON-EXISTENT')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/problems/:id/signals', () => {
    it('returns representative member signals with similarity and relationship types', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819/signals')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBe(3);

      const signalIds = res.body.data.map((m: any) => m.signal_id);
      expect(signalIds).toContain('sig_1001');
      expect(signalIds).toContain('sig_1003');
      expect(signalIds).toContain('sig_1004');

      // Check relationship metadata
      const mem1 = res.body.data.find((m: any) => m.signal_id === 'sig_1001');
      expect(mem1.relationship).toBe('DUPLICATE');
      expect(mem1.similarity).toBeGreaterThanOrEqual(0.85);

      const mem4 = res.body.data.find((m: any) => m.signal_id === 'sig_1004');
      expect(mem4.relationship).toBe('RELATED');
      expect(mem4.signal.critical_facility).toBe('DAV Public School');
    });
  });

  describe('Problem Cluster Creation & Citizen RBAC Guard', () => {
    it('CRITICAL: strictly rejects ordinary citizen attempting to create ProblemCluster with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', 'Bearer demo-token-citizen') // UserRole.CITIZEN
        .send({
          title: 'Unauthorized Citizen Cluster',
          category: 'water_supply',
          ward_id: 'WARD-018'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows Admin or Department Officer to create an official ProblemCluster', async () => {
      const res = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', 'Bearer demo-token-admin') // UserRole.ADMIN
        .send({
          title: 'Official Officer Problem Cluster',
          description: 'Verified drainage overflow threatening commercial sector.',
          category: 'drainage',
          ward_id: 'WARD-012'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toMatch(/^PRB-2026-/);
      expect(res.body.data.status).toBe(ProblemStatus.TRIAGED);
      expect(res.body.data.impact_score).toBeGreaterThan(0);
    });
  });

  describe('Impact Recalculation Security & Server Derivation', () => {
    it('CRITICAL: recalculates impact strictly from database records, ignoring client factor overrides in body', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/recalculate-impact')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          // Tampered values passed in client body — MUST BE COMPLETELY IGNORED BY SERVER
          severity_score: 2,
          population_score: 2,
          impact_score: 10,
          impact_level: 'LOW'
        });

      expect(res.status).toBe(200);
      const updated = res.body.data;
      // Server derived from authoritative database record: score remains 92 CRITICAL!
      expect(updated.impact_score).toBe(92);
      expect(updated.impact_level).toBe('CRITICAL');
      expect(updated.severity_score).toBe(24);
      expect(updated.population_score).toBe(18);
    });

    it('rejects ordinary citizen calling recalculate-impact with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/recalculate-impact')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Original Signal Preservation on Cluster Attachment', () => {
    it('attaches signal to cluster without mutating original citizen text, citizen_id, or timestamps', async () => {
      // 1. Create a fresh citizen signal
      const createRes = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Untampered citizen complaint text about water valve on VIP Road',
          category: 'water_supply',
          ward_id: 'WARD-018',
          location: { lat: 20.2962, lng: 85.8247 },
          location_reference: 'Near VIP Road Crossing'
        });

      expect(createRes.status).toBe(201);
      const originalSignal = createRes.body.data;
      const originalId = originalSignal.id;
      const originalText = originalSignal.original_text;
      const originalCitizenId = originalSignal.citizen_id;
      const originalCreatedAt = originalSignal.created_at;
      const originalSubmittedAt = originalSignal.submitted_at;
      const originalLocation = originalSignal.location;

      // 2. Cluster this signal into PRB-2026-0819 via officer endpoint
      const clusterRes = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/cluster-signal')
        .set('Authorization', 'Bearer demo-token-officer')
        .send({
          signal_id: originalId
        });

      expect(clusterRes.status).toBe(200);
      expect(clusterRes.body.data.member).toBeDefined();
      expect(clusterRes.body.data.member.signal_id).toBe(originalId);
      expect(clusterRes.body.data.member.problem_id).toBe('PRB-2026-0819');

      // 3. Fetch the signal and verify 100% preservation of original citizen data
      const fetchRes = await request(app)
        .get(`/api/v1/signals/${originalId}`)
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(fetchRes.status).toBe(200);
      const updatedSignal = fetchRes.body.data;

      // Only status and cluster reference changed
      expect(updatedSignal.status).toBe(SignalStatus.ATTACHED_TO_PROBLEM);
      expect(updatedSignal.problem_cluster_id).toBe('PRB-2026-0819');

      // All original citizen inputs are UNTOUCHED
      expect(updatedSignal.original_text).toBe(originalText);
      expect(updatedSignal.citizen_id).toBe(originalCitizenId);
      expect(updatedSignal.created_at).toBe(originalCreatedAt);
      expect(updatedSignal.submitted_at).toBe(originalSubmittedAt);
      expect(updatedSignal.location.lat).toBe(originalLocation.lat);
      expect(updatedSignal.location.lng).toBe(originalLocation.lng);
    });
  });
});
