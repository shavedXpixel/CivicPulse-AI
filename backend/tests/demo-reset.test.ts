import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ProviderContainer,
  MockDatabaseProvider,
  getDatabaseProvider,
  FirestoreDatabaseProvider
} from '../src/providers';
import { env } from '../src/config/env';
import { ProblemStatus, AssignmentPriority, AssignmentStatus } from '@civicpulse/shared';

describe('Safe Presentation Reset Mechanism (DEMO_MODE Only)', () => {
  let app: ReturnType<typeof createApp>;
  let mockDb: MockDatabaseProvider;
  const originalDemoMode = env.DEMO_MODE;

  beforeEach(() => {
    (env as any).DEMO_MODE = true;
    mockDb = new MockDatabaseProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    app = createApp();
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.resetAllProviders();
  });

  describe('1. Security & RBAC Enforcement on /api/v1/admin/reset-demo', () => {
    it('strictly blocks unauthenticated requests with HTTP 401 Unauthorized', async () => {
      const res = await request(app).post('/api/v1/admin/reset-demo');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('strictly blocks Citizen users with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reset-demo')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('privileges');
    });

    it('strictly blocks Field Officer users with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reset-demo')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows authenticated Admin to invoke reset-demo', async () => {
      const res = await request(app)
        .post('/api/v1/admin/reset-demo')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESET_SUCCESS');
      expect(res.body.data.is_demo_only).toBe(true);
      expect(res.body.data.canonical_problem.id).toBe('PRB-2026-0819');
    });
  });

  describe('2. Canonical Golden Demo State Restoration & Idempotency', () => {
    it('restores PRB-2026-0819 back to canonical baseline after mutations', async () => {
      const db = getDatabaseProvider();

      // Step A: Mutate problem state during demo presentation
      await db.updateProblemCluster('PRB-2026-0819', {
        status: ProblemStatus.RESOLVED,
        impact_score: 12,
        title: 'Mutated Demo Title',
        notes: 'Officer field notes added during demo'
      } as any);

      // Verify problem was mutated
      const mutatedProb = await db.getProblemCluster('PRB-2026-0819');
      expect(mutatedProb?.status).toBe(ProblemStatus.RESOLVED);
      expect(mutatedProb?.impact_score).toBe(12);

      // Step B: Call reset endpoint as Admin
      const resetRes = await request(app)
        .post('/api/v1/admin/reset-demo')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.data.status).toBe('RESET_SUCCESS');

      // Step C: Verify canonical Golden Demo state is 100% restored
      const restoredProb = await db.getProblemCluster('PRB-2026-0819');
      expect(restoredProb).toBeDefined();
      expect(restoredProb!.id).toBe('PRB-2026-0819');
      expect(restoredProb!.title).toBe('Water Supply Disruption — Nayapalli Ward 18');
      expect(restoredProb!.ward_id).toBe('WARD-018');
      expect(restoredProb!.department_id).toBe('WATCO');
      expect(restoredProb!.status).toBe(ProblemStatus.IN_PROGRESS);
      expect(restoredProb!.impact_score).toBe(92);
      expect(restoredProb!.estimated_population).toBe(18400);

      // Verify 7 exact impact factor components: 24 + 18 + 14 + 14 + 9 + 8 + 5 = 92
      expect(restoredProb!.severity_score).toBe(24);
      expect(restoredProb!.population_score).toBe(18);
      expect(restoredProb!.duration_score).toBe(14);
      expect(restoredProb!.concentration_score).toBe(14);
      expect(restoredProb!.critical_exposure_score).toBe(9);
      expect(restoredProb!.recurrence_score).toBe(8);
      expect(restoredProb!.evidence_score).toBe(5);

      // Verify canonical WATCO assignment is restored
      const assignments = await db.getAssignments('PRB-2026-0819');
      expect(assignments.length).toBeGreaterThanOrEqual(1);
      const watcoAsgn = assignments.find((a) => a.department_id === 'WATCO');
      expect(watcoAsgn).toBeDefined();
      expect(watcoAsgn!.assigned_to).toBe('usr_officer_01');
      expect(watcoAsgn!.priority).toBe(AssignmentPriority.CRITICAL);
      expect(watcoAsgn!.status).toBe(AssignmentStatus.ASSIGNED);

      // Verify audit actions and evidence records restored
      const actions = await db.getActions('PRB-2026-0819');
      expect(actions.length).toBe(4);

      const evidence = await db.getResolutionEvidence('PRB-2026-0819');
      expect(evidence.length).toBe(2);
    });

    it('is strictly idempotent when invoked multiple times in succession', async () => {
      const db = getDatabaseProvider();

      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/api/v1/admin/reset-demo')
          .set('Authorization', 'Bearer demo-token-admin');

        expect(res.status).toBe(200);
        const prob = await db.getProblemCluster('PRB-2026-0819');
        expect(prob?.impact_score).toBe(92);
        expect(prob?.status).toBe(ProblemStatus.IN_PROGRESS);
        expect(prob?.ward_id).toBe('WARD-018');
      }
    });
  });

  describe('3. Strict REAL_MODE & Firestore Protection', () => {
    it('strictly blocks reset endpoint when DEMO_MODE=false', async () => {
      (env as any).DEMO_MODE = false;

      const res = await request(app)
        .post('/api/v1/admin/reset-demo')
        .set('Authorization', 'Bearer demo-token-admin');

      expect([401, 403, 404]).toContain(res.status);
    });

    it('ProviderContainer.resetToGoldenDemo throws error and refuses execution when DEMO_MODE=false', () => {
      (env as any).DEMO_MODE = false;

      expect(() => {
        ProviderContainer.resetToGoldenDemo();
      }).toThrowError(/Demo reset is strictly disabled when DEMO_MODE is false/);
    });

    it('guarantees FirestoreDatabaseProvider is never touched or mutated during demo reset', () => {
      // Mock a Firestore provider to verify no method is ever called
      const firestoreMock = {
        getProblemCluster: vi.fn(),
        updateProblemCluster: vi.fn(),
        createProblemCluster: vi.fn(),
        getSignals: vi.fn()
      } as unknown as FirestoreDatabaseProvider;

      ProviderContainer.setDatabaseProvider(firestoreMock);

      (env as any).DEMO_MODE = false;

      expect(() => {
        ProviderContainer.resetToGoldenDemo();
      }).toThrow();

      // Assert zero calls to any Firestore provider method
      expect(firestoreMock.updateProblemCluster).not.toHaveBeenCalled();
      expect(firestoreMock.createProblemCluster).not.toHaveBeenCalled();
    });
  });
});
