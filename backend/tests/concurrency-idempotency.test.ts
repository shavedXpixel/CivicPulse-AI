import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider, getDatabaseProvider } from '../src/providers';
import {
  ProblemStatus,
  AssignmentPriority,
  ActionType,
  SignalStatus,
  SignalSeverity,
  SignalSourceType,
  SignalProcessingStatus,
  EvidenceType,
  EvidenceStatus,
  BeforeOrAfter
} from '@civicpulse/shared';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';

describe('Phase 14 Concurrency & Idempotency Hardening', () => {
  let app: any;
  const originalDemoMode = env.DEMO_MODE;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    (env as any).DEMO_MODE = true;
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    app = createApp();

    mockVerifyIdToken = vi.fn();
    vi.spyOn(firebaseAdminModule, 'getFirebaseAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken
    } as any);
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    vi.restoreAllMocks();
  });

  describe('1. Idempotency Key Semantics & Replay Safety (AUD-IDEM-01)', () => {
    it('executes normally and records idempotency record when Idempotency-Key is provided', async () => {
      const idempotencyKey = `idem_key_${Date.now()}_1`;

      const res1 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          original_text: 'Burst water pipe leaking onto VIP Road sidewalk',
          category: 'WATER',
          auto_process: false
        });

      expect(res1.status).toBe(201);
      expect(res1.headers['x-cache-lookup']).toBe('MISS');
      expect(res1.body.data.id).toBeDefined();

      // Second request with exact same Idempotency-Key: MUST return cached 201 with X-Cache-Lookup: HIT
      const res2 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          original_text: 'Burst water pipe leaking onto VIP Road sidewalk',
          category: 'WATER',
          auto_process: false
        });

      expect(res2.status).toBe(201);
      expect(res2.headers['x-cache-lookup']).toBe('HIT');
      expect(res2.body.data.id).toBe(res1.body.data.id);
    });

    it('processes requests without Idempotency-Key normally without caching or blocking', async () => {
      const res1 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'First report without key',
          category: 'WATER'
        });

      expect(res1.status).toBe(201);
      expect(res1.headers['x-cache-lookup']).toBeUndefined();

      const res2 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Second report without key',
          category: 'DRAINAGE'
        });

      expect(res2.status).toBe(201);
      expect(res2.headers['x-cache-lookup']).toBeUndefined();
      expect(res2.body.data.id).not.toBe(res1.body.data.id);
    });

    it('does not allow cross-user replay of same Idempotency-Key', async () => {
      const sharedKey = `shared_idem_key_${Date.now()}`;

      // User 1 (Citizen) creates signal with key
      const res1 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Idempotency-Key', sharedKey)
        .send({
          original_text: 'User 1 signal with key',
          category: 'WATER'
        });

      expect(res1.status).toBe(201);

      // User 2 (Admin) uses exact same key -> should NOT replay User 1 response, should execute fresh
      const res2 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-admin')
        .set('Idempotency-Key', sharedKey)
        .send({
          original_text: 'User 2 signal with same key string',
          category: 'ROADS'
        });

      expect(res2.status).toBe(201);
      expect(res2.headers['x-cache-lookup']).toBe('MISS');
      expect(res2.body.data.id).not.toBe(res1.body.data.id);
    });
  });

  describe('2. Concurrency Preconditions & Atomic Operations (AUD-CONC-01 & AUD-DB-01)', () => {
    it('enforces current-state precondition on assignment transitions', async () => {
      const db = getDatabaseProvider();
      const problem = await db.getProblemCluster('PRB-2026-0819');
      expect(problem).toBeDefined();

      // Set problem to RESOLVED
      await db.updateProblemCluster('PRB-2026-0819', {
        status: ProblemStatus.RESOLVED
      });

      // Attempting to assign a RESOLVED problem without reopening must be rejected with 400
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/assign')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: 'usr_officer_01',
          priority: AssignmentPriority.HIGH
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('atomically creates problem cluster from signal linking member and signal status', async () => {
      const db = getDatabaseProvider();

      // Create raw signal
      const signal = await db.createSignal({
        id: `sig_atomic_test_${Date.now()}`,
        citizen_id: 'usr_citizen_01',
        original_text: 'Atomic clustering test signal',
        source_type: SignalSourceType.CITIZEN,
        status: SignalStatus.ACTIVE,
        severity: SignalSeverity.MEDIUM,
        processing_status: SignalProcessingStatus.PENDING,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const clusterId = `PRB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const newProblem: any = {
        id: clusterId,
        title: 'Atomic Cluster Test',
        description: 'Testing atomic cluster creation transaction',
        category: 'WATER',
        status: ProblemStatus.TRIAGED,
        impact_score: 50,
        signal_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_demo: false
      };

      const newMember: any = {
        id: `mem_${clusterId}_${signal.id}`,
        cluster_id: clusterId,
        signal_id: signal.id,
        relationship: 'PRIMARY',
        confidence: 0.95,
        added_at: new Date().toISOString()
      };

      const result = await db.atomicCreateClusterFromSignal(newProblem, newMember, signal.id);

      expect(result.problem.id).toBe(clusterId);
      expect(result.member.signal_id).toBe(signal.id);

      // Verify signal in DB was updated to ATTACHED_TO_PROBLEM
      const updatedSignal = await db.getSignal(signal.id);
      expect(updatedSignal?.status).toBe(SignalStatus.ATTACHED_TO_PROBLEM);
      expect(updatedSignal?.problem_cluster_id).toBe(clusterId);
    });

    it('atomically reviews resolution transitioning problem status and evidence in single transaction', async () => {
      const db = getDatabaseProvider();

      // Setup problem in AWAITING_VERIFICATION
      await db.updateProblemCluster('PRB-2026-0819', {
        status: ProblemStatus.AWAITING_VERIFICATION,
        assigned_to: 'usr_officer_01',
        department_id: 'WATCO'
      });

      // Add evidence in PENDING_REVIEW
      const evidence = await db.createResolutionEvidence({
        id: `ev_conc_${Date.now()}`,
        problem_id: 'PRB-2026-0819',
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: 'evidence/resolutions/repaired.jpg',
        media_type: 'image/jpeg',
        file_size_bytes: 5000,
        sha256_hash: 'hash123',
        submitted_by: 'usr_officer_01',
        submitted_at: new Date().toISOString(),
        status: EvidenceStatus.SUBMITTED,
        before_or_after: BeforeOrAfter.AFTER,
        created_at: new Date().toISOString()
      });

      // Supervisor accepts resolution
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/review-resolution')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          decision: 'ACCEPT',
          notes: 'Atomic review accepted by supervisor'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.decision).toBe('ACCEPT');
      expect(res.body.data.problem_status).toBe(ProblemStatus.RESOLVED);

      // Verify DB state
      const updatedProblem = await db.getProblemCluster('PRB-2026-0819');
      expect(updatedProblem?.status).toBe(ProblemStatus.RESOLVED);

      const updatedEvidence = await db.getEvidenceById(evidence.id);
      expect(updatedEvidence?.status).toBe('ACCEPTED');
    });
  });
});
