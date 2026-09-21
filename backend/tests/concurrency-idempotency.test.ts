import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider, getDatabaseProvider } from '../src/providers';
import {
  ProblemStatus,
  AssignmentPriority,
  AssignmentStatus,
  ActionType,
  SignalStatus,
  SignalSeverity,
  SignalSourceType,
  SignalProcessingStatus,
  EvidenceType,
  EvidenceStatus,
  BeforeOrAfter,
  ProblemCluster,
  ProblemClusterMember,
  ClusterRelationshipType,
  ImpactLevel,
  AppError,
  ERROR_CODES,
  UserRole,
  UserProfile,
  Assignment,
  ProblemAction
} from '@civicpulse/shared';
import { PostgresDatabaseProvider } from '../src/providers/database/postgres.provider';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';
import { WorkflowService } from '../src/modules/workflow/workflow.service';

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

  describe('3. Phase 15B.5.3.18-HF3 — Atomic Cluster Creation & Membership Transaction Invariants', () => {
    let mockPool: any;
    let mockClient: any;
    let provider: PostgresDatabaseProvider;
    let executedClientQueries: Array<{ sql: string; params?: any[] }>;
    let executedPoolQueries: Array<{ sql: string; params?: any[] }>;

    const SAMPLE_SIGNAL_ID = 'sig_atomic_pg_123';
    const SAMPLE_PROBLEM_ID = 'PRB-2026-9999';

    const sampleProblem: ProblemCluster = {
      id: SAMPLE_PROBLEM_ID,
      title: 'Water pipe rupture on Lewis Road',
      description: 'Clean drinking water main leaking onto pavement',
      category: 'water_supply',
      ward_id: 'WARD-019',
      status: ProblemStatus.TRIAGED,
      signal_count: 1,
      impact_score: 49,
      impact_level: ImpactLevel.MEDIUM,
      first_detected_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const sampleMember: ProblemClusterMember = {
      id: `mem_${SAMPLE_PROBLEM_ID}_${SAMPLE_SIGNAL_ID}`,
      problem_id: SAMPLE_PROBLEM_ID,
      signal_id: SAMPLE_SIGNAL_ID,
      relationship: ClusterRelationshipType.DUPLICATE,
      similarity: 1.0,
      reason: 'Initial seed signal establishing problem cluster.',
      created_at: new Date().toISOString()
    };

    beforeEach(() => {
      executedClientQueries = [];
      executedPoolQueries = [];

      mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          executedClientQueries.push({ sql, params });
          if (sql.includes('SELECT id FROM signals WHERE id = $1 FOR UPDATE')) {
            if (params && params[0] === 'sig_non_existent') {
              return { rows: [] };
            }
            return { rows: [{ id: params ? params[0] : SAMPLE_SIGNAL_ID }] };
          }
          return { rows: [] };
        }),
        release: vi.fn()
      };

      mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          executedPoolQueries.push({ sql, params });
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn().mockResolvedValue(undefined)
      };

      provider = new PostgresDatabaseProvider({ pool: mockPool as any });
    });

    // SCENARIO A & B: Cluster creation creates cluster_members, links signals.problem_cluster_id,
    // and sets status = ATTACHED_TO_PROBLEM
    it('Scenario A & B: Successfully creates cluster, inserts member, and links signal to problem', async () => {
      const result = await provider.atomicCreateClusterFromSignal(
        sampleProblem,
        sampleMember,
        SAMPLE_SIGNAL_ID
      );

      expect(result.problem.id).toBe(SAMPLE_PROBLEM_ID);
      expect(result.member.signal_id).toBe(SAMPLE_SIGNAL_ID);

      // Verify BEGIN was executed on client
      expect(executedClientQueries[0].sql).toBe('BEGIN');

      // Verify row lock on signal
      expect(executedClientQueries[1].sql).toContain('SELECT id FROM signals WHERE id = $1 FOR UPDATE');
      expect(executedClientQueries[1].params).toEqual([SAMPLE_SIGNAL_ID]);

      // Scenario A: Verify cluster_members insert was executed on client
      const memberQuery = executedClientQueries.find(q => q.sql.includes('INSERT INTO cluster_members'));
      expect(memberQuery).toBeDefined();
      expect(memberQuery?.params).toContain(SAMPLE_PROBLEM_ID);
      expect(memberQuery?.params).toContain(SAMPLE_SIGNAL_ID);

      // Scenario B: Verify signals update sets ATTACHED_TO_PROBLEM and problem_cluster_id
      const updateSignalQuery = executedClientQueries.find(q => q.sql.includes('UPDATE signals SET'));
      expect(updateSignalQuery).toBeDefined();
      expect(updateSignalQuery?.sql).toContain('status = $1');
      expect(updateSignalQuery?.sql).toContain('problem_cluster_id = $2');
      expect(updateSignalQuery?.sql).not.toContain('NORMALIZED');
      expect(updateSignalQuery?.params).toEqual([
        SignalStatus.ATTACHED_TO_PROBLEM,
        SAMPLE_PROBLEM_ID,
        SAMPLE_SIGNAL_ID
      ]);

      // Verify COMMIT was executed
      const lastQuery = executedClientQueries[executedClientQueries.length - 1];
      expect(lastQuery.sql).toBe('COMMIT');

      // Client released in finally
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    // SCENARIO C: Membership failure rolls back the cluster
    it('Scenario C: Simulated membership failure rolls back the cluster creation', async () => {
      mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
        executedClientQueries.push({ sql, params });
        if (sql.includes('SELECT id FROM signals WHERE id = $1 FOR UPDATE')) {
          return { rows: [{ id: SAMPLE_SIGNAL_ID }] };
        }
        if (sql.includes('INSERT INTO cluster_members')) {
          throw new Error('FK constraint violation: simulated cluster_members failure');
        }
        return { rows: [] };
      });

      await expect(
        provider.atomicCreateClusterFromSignal(sampleProblem, sampleMember, SAMPLE_SIGNAL_ID)
      ).rejects.toThrow('FK constraint violation: simulated cluster_members failure');

      // Verify ROLLBACK was executed
      const rollbackQuery = executedClientQueries.find(q => q.sql === 'ROLLBACK');
      expect(rollbackQuery).toBeDefined();

      // Verify COMMIT was NEVER executed
      const commitQuery = executedClientQueries.find(q => q.sql === 'COMMIT');
      expect(commitQuery).toBeUndefined();

      // Client released
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    // SCENARIO D: Signal-link failure rolls back cluster + membership
    it('Scenario D: Simulated signal-link update failure rolls back cluster + membership', async () => {
      mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
        executedClientQueries.push({ sql, params });
        if (sql.includes('SELECT id FROM signals WHERE id = $1 FOR UPDATE')) {
          return { rows: [{ id: SAMPLE_SIGNAL_ID }] };
        }
        if (sql.includes('UPDATE signals SET')) {
          throw new Error('Deadlock detected: simulated signal-link failure');
        }
        return { rows: [] };
      });

      await expect(
        provider.atomicCreateClusterFromSignal(sampleProblem, sampleMember, SAMPLE_SIGNAL_ID)
      ).rejects.toThrow('Deadlock detected: simulated signal-link failure');

      // Verify ROLLBACK was executed
      const rollbackQuery = executedClientQueries.find(q => q.sql === 'ROLLBACK');
      expect(rollbackQuery).toBeDefined();

      // Verify COMMIT was NEVER executed
      const commitQuery = executedClientQueries.find(q => q.sql === 'COMMIT');
      expect(commitQuery).toBeUndefined();

      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    // SCENARIO E: Entire atomic operation uses one transaction client and zero interleaved pool queries
    it('Scenario E: Enforces exactly ONE client connection with ZERO interleaved pool.query calls', async () => {
      await provider.atomicCreateClusterFromSignal(sampleProblem, sampleMember, SAMPLE_SIGNAL_ID);

      // 1. mockPool.query MUST NEVER be called inside the atomic operation
      expect(executedPoolQueries).toHaveLength(0);
      expect(mockPool.query).not.toHaveBeenCalled();

      // 2. mockPool.connect called exactly once to acquire the single transaction client
      expect(mockPool.connect).toHaveBeenCalledTimes(1);

      // 3. All operations (BEGIN, SELECT FOR UPDATE, INSERT cluster, INSERT member, UPDATE signal, COMMIT)
      // executed strictly on mockClient.query
      expect(executedClientQueries.length).toBe(6);
      expect(executedClientQueries[0].sql).toBe('BEGIN');
      expect(executedClientQueries[1].sql).toContain('SELECT id FROM signals');
      expect(executedClientQueries[2].sql).toContain('INSERT INTO problem_clusters');
      expect(executedClientQueries[3].sql).toContain('INSERT INTO cluster_members');
      expect(executedClientQueries[4].sql).toContain('UPDATE signals SET');
      expect(executedClientQueries[5].sql).toBe('COMMIT');

      // 4. Connection released cleanly
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    // SCENARIO F: Concurrent cluster creation remains safe / checks signal existence
    it('Scenario F: Concurrent cluster creation safely aborts if signal does not exist', async () => {
      await expect(
        provider.atomicCreateClusterFromSignal(sampleProblem, sampleMember, 'sig_non_existent')
      ).rejects.toMatchObject({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: expect.stringContaining('Signal sig_non_existent not found')
      });

      // Verify rollback on abort
      const rollbackQuery = executedClientQueries.find(q => q.sql === 'ROLLBACK');
      expect(rollbackQuery).toBeDefined();

      // Neither problem nor member was attempted to be inserted
      expect(executedClientQueries.some(q => q.sql.includes('INSERT INTO problem_clusters'))).toBe(false);
      expect(executedClientQueries.some(q => q.sql.includes('INSERT INTO cluster_members'))).toBe(false);
    });

    // SCENARIO G: Production-shape reproduction using sig_1789895984486_kn7y7e and PRB-2026-8299
    it('Scenario G: Proves production-shape signal sig_1789895984486_kn7y7e and PRB-2026-8299 commit atomically together', async () => {
      const PROD_SIGNAL_ID = 'sig_1789895984486_kn7y7e';
      const PROD_CLUSTER_ID = 'PRB-2026-8299';

      const prodProblemFixture: ProblemCluster = {
        id: PROD_CLUSTER_ID,
        title: 'A major drinking water pipeline rupture on GGP Colony Main Road is flooding nearby storefronts and disrupting potable water supply to surrounding households.',
        description: 'A major drinking water pipeline rupture on GGP Colony Main Road is flooding nearby storefronts and disrupting potable water supply to surrounding households.',
        category: 'water_supply',
        department_id: 'WATCO',
        ward_id: 'WARD-019',
        location: { lat: 20.293, lng: 85.865 },
        status: ProblemStatus.TRIAGED,
        signal_count: 1,
        estimated_population: 14071,
        impact_score: 49.00,
        impact_level: ImpactLevel.MEDIUM,
        severity_score: 12.00,
        population_score: 14.00,
        duration_score: 5.00,
        concentration_score: 3.00,
        critical_exposure_score: 8.00,
        recurrence_score: 5.00,
        evidence_score: 2.00,
        first_detected_at: '2026-09-20T09:19:44.486Z',
        last_updated_at: '2026-09-20T10:29:32.616Z',
        created_at: '2026-09-20T10:29:32.616Z',
        updated_at: '2026-09-20T10:29:32.616Z'
      };

      const prodMemberFixture: ProblemClusterMember = {
        id: `mem_${PROD_CLUSTER_ID}_${PROD_SIGNAL_ID}`,
        problem_id: PROD_CLUSTER_ID,
        signal_id: PROD_SIGNAL_ID,
        relationship: ClusterRelationshipType.DUPLICATE,
        similarity: 1.0,
        reason: 'Initial seed signal establishing problem cluster.',
        created_at: '2026-09-20T10:29:32.616Z'
      };

      mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
        executedClientQueries.push({ sql, params });
        if (sql.includes('SELECT id FROM signals WHERE id = $1 FOR UPDATE')) {
          return { rows: [{ id: PROD_SIGNAL_ID }] };
        }
        return { rows: [] };
      });

      const result = await provider.atomicCreateClusterFromSignal(
        prodProblemFixture,
        prodMemberFixture,
        PROD_SIGNAL_ID
      );

      // Verify returned objects
      expect(result.problem.id).toBe(PROD_CLUSTER_ID);
      expect(result.member.signal_id).toBe(PROD_SIGNAL_ID);

      // Verify zero calls to pool.query (proves no connection leak/interleaving)
      expect(mockPool.query).not.toHaveBeenCalled();

      // Verify exact query sequence on transaction client
      expect(executedClientQueries[0].sql).toBe('BEGIN');
      expect(executedClientQueries[1].params).toEqual([PROD_SIGNAL_ID]);
      expect(executedClientQueries[2].sql).toContain('INSERT INTO problem_clusters');
      expect(executedClientQueries[2].params).toContain(PROD_CLUSTER_ID);
      expect(executedClientQueries[3].sql).toContain('INSERT INTO cluster_members');
      expect(executedClientQueries[3].params).toContain(PROD_CLUSTER_ID);
      expect(executedClientQueries[3].params).toContain(PROD_SIGNAL_ID);
      expect(executedClientQueries[4].sql).toContain('UPDATE signals SET status = $1, problem_cluster_id = $2');
      expect(executedClientQueries[4].params).toEqual([
        SignalStatus.ATTACHED_TO_PROBLEM,
        PROD_CLUSTER_ID,
        PROD_SIGNAL_ID
      ]);
      expect(executedClientQueries[5].sql).toBe('COMMIT');
    });

    // SCENARIO H: updateSignal correctly persists problem_cluster_id
    it('Scenario H: updateSignal correctly persists problem_cluster_id to database', async () => {
      mockPool.query.mockImplementation(async (sql: string, params?: any[]) => {
        executedPoolQueries.push({ sql, params });
        if (sql.includes('UPDATE signals SET')) {
          return { rows: [{ id: SAMPLE_SIGNAL_ID }] };
        }
        if (sql.includes('SELECT s.*')) {
          return {
            rows: [{
              id: SAMPLE_SIGNAL_ID,
              citizen_id: '10000000-0000-4000-8000-000000000004',
              status: 'ATTACHED_TO_PROBLEM',
              problem_cluster_id: SAMPLE_PROBLEM_ID,
              processing_status: 'COMPLETED',
              created_at: new Date(),
              updated_at: new Date()
            }]
          };
        }
        return { rows: [] };
      });

      const updated = await provider.updateSignal(SAMPLE_SIGNAL_ID, {
        status: SignalStatus.ATTACHED_TO_PROBLEM,
        problem_cluster_id: SAMPLE_PROBLEM_ID
      });

      const updateQuery = executedPoolQueries.find(q => q.sql.includes('UPDATE signals SET'));
      expect(updateQuery).toBeDefined();
      expect(updateQuery?.sql).toContain('problem_cluster_id = $');
      expect(updateQuery?.params).toContain(SAMPLE_PROBLEM_ID);
      expect(updated.problem_cluster_id).toBe(SAMPLE_PROBLEM_ID);
      expect(updated.status).toBe(SignalStatus.ATTACHED_TO_PROBLEM);
    });
  });

  describe('4. Phase 15B.5.3.18-HF4 Atomic Assignment Transaction & Schema Integrity', () => {
    const PROD_PROBLEM_ID = 'PRB-2026-8299';
    const PROD_DEPT_ID = 'WATCO';
    const DEPT_OFFICER_ID = '10000000-0000-4000-8000-000000000002';
    const DEPT_OFFICER_LEGACY_UID = 'usr_watco_officer';
    const FIELD_OFFICER_ID = '10000000-0000-4000-8000-000000000003';
    const FIELD_OFFICER_LEGACY_UID = 'usr_watco_field';

    const sampleProblemClusterRow = {
      id: PROD_PROBLEM_ID,
      title: 'Water supply rupture on GGP Colony Main Road',
      description: 'Major drinking water pipeline rupture',
      category: 'water_supply',
      department_id: PROD_DEPT_ID,
      ward_id: 'WARD-019',
      location: JSON.stringify({ lat: 20.293, lng: 85.865 }),
      status: ProblemStatus.TRIAGED,
      signal_count: 1,
      estimated_population: 14071,
      impact_score: 49.00,
      impact_level: ImpactLevel.MEDIUM,
      severity_score: 12.00,
      population_score: 14.00,
      duration_score: 5.00,
      concentration_score: 3.00,
      critical_exposure_score: 8.00,
      recurrence_score: 5.00,
      evidence_score: 2.00,
      first_detected_at: '2026-09-20T09:19:44.486Z',
      last_updated_at: '2026-09-20T10:29:32.616Z',
      created_at: new Date('2026-09-20T10:29:32.616Z'),
      updated_at: new Date('2026-09-20T10:29:32.616Z')
    };

    const sampleAssignment: Assignment = {
      id: 'asgn_hf4_test_1',
      problem_id: PROD_PROBLEM_ID,
      department_id: PROD_DEPT_ID,
      assigned_to: FIELD_OFFICER_ID,
      assigned_by: DEPT_OFFICER_ID,
      priority: AssignmentPriority.HIGH,
      status: AssignmentStatus.ASSIGNED,
      assigned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const sampleAction: ProblemAction = {
      id: 'act_hf4_test_1',
      problem_id: PROD_PROBLEM_ID,
      actor_id: DEPT_OFFICER_ID,
      actor_role: UserRole.DEPARTMENT_OFFICER,
      action_type: ActionType.ASSIGNED,
      previous_state: ProblemStatus.TRIAGED,
      new_state: ProblemStatus.ASSIGNED,
      target_department_id: PROD_DEPT_ID,
      target_officer_id: FIELD_OFFICER_ID,
      created_at: new Date().toISOString()
    };

    let mockClient: any;
    let mockPool: any;
    let provider: PostgresDatabaseProvider;
    let executedClientQueries: Array<{ sql: string; params?: any[] }>;
    let executedPoolQueries: Array<{ sql: string; params?: any[] }>;

    beforeEach(() => {
      executedClientQueries = [];
      executedPoolQueries = [];

      mockClient = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          executedClientQueries.push({ sql, params });

          // Problem cluster SELECT FOR UPDATE
          if (sql.includes('SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE')) {
            if (params && params[0] === 'PRB-NONEXISTENT') {
              return { rows: [] };
            }
            return { rows: [{ ...sampleProblemClusterRow }] };
          }

          // Problem cluster UPDATE RETURNING *
          if (sql.includes('UPDATE problem_clusters SET status = $1')) {
            return {
              rows: [{
                ...sampleProblemClusterRow,
                status: params ? params[0] : ProblemStatus.ASSIGNED,
                department_id: params && params[1] ? params[1] : PROD_DEPT_ID,
                updated_at: new Date()
              }]
            };
          }

          // User lookups (SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id = $1)
          if (sql.includes('SELECT id FROM users WHERE id::text = $1')) {
            const input = params ? params[0] : null;
            if (input === DEPT_OFFICER_ID || input === DEPT_OFFICER_LEGACY_UID || input === 'sub_dept_officer_420') {
              return { rows: [{ id: DEPT_OFFICER_ID }] };
            }
            if (input === FIELD_OFFICER_ID || input === FIELD_OFFICER_LEGACY_UID || input === 'sub_field_officer_240') {
              return { rows: [{ id: FIELD_OFFICER_ID }] };
            }
            if (input === 'usr_unresolvable_ghost') {
              return { rows: [] };
            }
            if (input && /^[0-9a-fA-F-]{36}$/.test(input)) {
              return { rows: [{ id: input }] };
            }
            return { rows: [] };
          }

          // INSERT INTO assignments
          if (sql.includes('INSERT INTO assignments')) {
            return {
              rows: [{
                id: params ? params[0] : 'asgn_test',
                problem_id: params ? params[1] : PROD_PROBLEM_ID,
                department_id: params ? params[2] : PROD_DEPT_ID,
                assigned_to: params ? params[4] : FIELD_OFFICER_ID,
                assigned_by: params ? params[5] : DEPT_OFFICER_ID,
                priority: params ? params[6] : 'HIGH',
                status: params ? params[7] : 'ASSIGNED'
              }]
            };
          }

          // INSERT INTO problem_actions
          if (sql.includes('INSERT INTO problem_actions')) {
            return {
              rows: [{
                id: params ? params[0] : 'act_test',
                problem_id: params ? params[1] : PROD_PROBLEM_ID,
                actor_type: params ? params[2] : 'USER',
                actor_user_id: params ? params[3] : DEPT_OFFICER_ID,
                action_type: params ? params[6] : 'ASSIGNED'
              }]
            };
          }

          return { rows: [] };
        }),
        release: vi.fn()
      };

      mockPool = {
        query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
          executedPoolQueries.push({ sql, params });
          return { rows: [] };
        }),
        connect: vi.fn().mockResolvedValue(mockClient),
        end: vi.fn().mockResolvedValue(undefined)
      };

      provider = new PostgresDatabaseProvider({ pool: mockPool as any });
    });

    // SCENARIO A: Successful assignment
    it('Scenario A: Successful assignment transitions status to ASSIGNED, creates assignment, and creates problem_action', async () => {
      const result = await provider.atomicAssignProblem(
        PROD_PROBLEM_ID,
        sampleAssignment,
        ProblemStatus.ASSIGNED,
        sampleAction,
        ProblemStatus.TRIAGED
      );

      expect(result.problem.id).toBe(PROD_PROBLEM_ID);
      expect(result.problem.status).toBe(ProblemStatus.ASSIGNED);
      expect(result.assignment.id).toBe(sampleAssignment.id);
      expect(result.action.id).toBe(sampleAction.id);
      expect(result.action.action_type).toBe(ActionType.ASSIGNED);

      const commitQuery = executedClientQueries.find(q => q.sql === 'COMMIT');
      expect(commitQuery).toBeDefined();
    });

    // SCENARIO B: assigned_by = authenticated public.users.id
    it('Scenario B: assigned_by strictly resolves to authoritative public.users.id and cannot be null, auth_user_id, or legacy_uid', async () => {
      // B.1: Valid UUID assigned_by resolves to public.users.id
      await provider.createAssignment({
        ...sampleAssignment,
        id: 'asgn_b1',
        assigned_by: DEPT_OFFICER_ID
      }, mockClient);

      const insertB1 = executedClientQueries.find(q => q.sql.includes('INSERT INTO assignments') && q.params?.[0] === 'asgn_b1');
      expect(insertB1).toBeDefined();
      expect(insertB1?.params?.[5]).toBe(DEPT_OFFICER_ID);

      // B.2: Legacy UID assigned_by resolves to public.users.id
      await provider.createAssignment({
        ...sampleAssignment,
        id: 'asgn_b2',
        assigned_by: DEPT_OFFICER_LEGACY_UID
      }, mockClient);

      const insertB2 = executedClientQueries.find(q => q.sql.includes('INSERT INTO assignments') && q.params?.[0] === 'asgn_b2');
      expect(insertB2).toBeDefined();
      expect(insertB2?.params?.[5]).toBe(DEPT_OFFICER_ID);
      expect(insertB2?.params?.[5]).not.toBe(DEPT_OFFICER_LEGACY_UID);

      // B.3: Auth User ID assigned_by resolves to public.users.id
      await provider.createAssignment({
        ...sampleAssignment,
        id: 'asgn_b3',
        assigned_by: 'sub_dept_officer_420'
      }, mockClient);

      const insertB3 = executedClientQueries.find(q => q.sql.includes('INSERT INTO assignments') && q.params?.[0] === 'asgn_b3');
      expect(insertB3).toBeDefined();
      expect(insertB3?.params?.[5]).toBe(DEPT_OFFICER_ID);
      expect(insertB3?.params?.[5]).not.toBe('sub_dept_officer_420');

      // B.4: Unresolvable assigned_by throws 400 validation error (cannot be null / ghost)
      await expect(
        provider.createAssignment({
          ...sampleAssignment,
          id: 'asgn_b4',
          assigned_by: 'usr_unresolvable_ghost'
        }, mockClient)
      ).rejects.toMatchObject({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    });

    // SCENARIO C: Assignment uses transaction client
    it('Scenario C: Assignment INSERT and user lookups execute on the supplied transaction client', async () => {
      await provider.atomicAssignProblem(
        PROD_PROBLEM_ID,
        sampleAssignment,
        ProblemStatus.ASSIGNED,
        sampleAction,
        ProblemStatus.TRIAGED
      );

      // Verify assignment query is in executedClientQueries
      const assignmentInsert = executedClientQueries.find(q => q.sql.includes('INSERT INTO assignments'));
      expect(assignmentInsert).toBeDefined();

      // Verify user lookup query is in executedClientQueries
      const userLookup = executedClientQueries.find(q => q.sql.includes('SELECT id FROM users WHERE id::text = $1'));
      expect(userLookup).toBeDefined();

      // Zero pool.query calls
      expect(executedPoolQueries.filter(q => q.sql.includes('INSERT INTO assignments'))).toHaveLength(0);
    });

    // SCENARIO D: Action uses transaction client
    it('Scenario D: ProblemAction INSERT and actor lookup execute on the supplied transaction client', async () => {
      await provider.atomicAssignProblem(
        PROD_PROBLEM_ID,
        sampleAssignment,
        ProblemStatus.ASSIGNED,
        sampleAction,
        ProblemStatus.TRIAGED
      );

      // Verify action query is in executedClientQueries
      const actionInsert = executedClientQueries.find(q => q.sql.includes('INSERT INTO problem_actions'));
      expect(actionInsert).toBeDefined();

      // Zero pool.query calls
      expect(executedPoolQueries.filter(q => q.sql.includes('INSERT INTO problem_actions'))).toHaveLength(0);
    });

    // SCENARIO E: Assignment failure rolls back everything
    it('Scenario E: Assignment failure rolls back the entire transaction', async () => {
      mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
        executedClientQueries.push({ sql, params });
        if (sql.includes('SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE')) {
          return { rows: [{ ...sampleProblemClusterRow }] };
        }
        if (sql.includes('UPDATE problem_clusters SET status = $1')) {
          return { rows: [{ ...sampleProblemClusterRow, status: ProblemStatus.ASSIGNED }] };
        }
        if (sql.includes('INSERT INTO assignments')) {
          throw new Error('Simulated assignment insert failure');
        }
        return { rows: [] };
      });

      await expect(
        provider.atomicAssignProblem(
          PROD_PROBLEM_ID,
          sampleAssignment,
          ProblemStatus.ASSIGNED,
          sampleAction,
          ProblemStatus.TRIAGED
        )
      ).rejects.toThrow('Simulated assignment insert failure');

      // Verify ROLLBACK was executed and COMMIT was NOT
      expect(executedClientQueries.some(q => q.sql === 'ROLLBACK')).toBe(true);
      expect(executedClientQueries.some(q => q.sql === 'COMMIT')).toBe(false);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    // SCENARIO F: Action failure rolls back everything
    it('Scenario F: Action failure rolls back the entire transaction', async () => {
      mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
        executedClientQueries.push({ sql, params });
        if (sql.includes('SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE')) {
          return { rows: [{ ...sampleProblemClusterRow }] };
        }
        if (sql.includes('UPDATE problem_clusters SET status = $1')) {
          return { rows: [{ ...sampleProblemClusterRow, status: ProblemStatus.ASSIGNED }] };
        }
        if (sql.includes('INSERT INTO assignments')) {
          return { rows: [{ id: sampleAssignment.id }] };
        }
        if (sql.includes('INSERT INTO problem_actions')) {
          throw new Error('Simulated action insert failure');
        }
        return { rows: [] };
      });

      await expect(
        provider.atomicAssignProblem(
          PROD_PROBLEM_ID,
          sampleAssignment,
          ProblemStatus.ASSIGNED,
          sampleAction,
          ProblemStatus.TRIAGED
        )
      ).rejects.toThrow('Simulated action insert failure');

      expect(executedClientQueries.some(q => q.sql === 'ROLLBACK')).toBe(true);
      expect(executedClientQueries.some(q => q.sql === 'COMMIT')).toBe(false);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    // SCENARIO G: Status update failure rolls back everything
    it('Scenario G: Status update failure rolls back the entire transaction without inserting assignment or action', async () => {
      mockClient.query.mockImplementation(async (sql: string, params?: any[]) => {
        executedClientQueries.push({ sql, params });
        if (sql.includes('SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE')) {
          return { rows: [{ ...sampleProblemClusterRow }] };
        }
        if (sql.includes('UPDATE problem_clusters SET status = $1')) {
          throw new Error('Simulated problem update failure');
        }
        return { rows: [] };
      });

      await expect(
        provider.atomicAssignProblem(
          PROD_PROBLEM_ID,
          sampleAssignment,
          ProblemStatus.ASSIGNED,
          sampleAction,
          ProblemStatus.TRIAGED
        )
      ).rejects.toThrow('Simulated problem update failure');

      expect(executedClientQueries.some(q => q.sql === 'ROLLBACK')).toBe(true);
      expect(executedClientQueries.some(q => q.sql === 'COMMIT')).toBe(false);
      expect(executedClientQueries.some(q => q.sql.includes('INSERT INTO assignments'))).toBe(false);
      expect(executedClientQueries.some(q => q.sql.includes('INSERT INTO problem_actions'))).toBe(false);
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    // SCENARIO H: Exactly one PoolClient, zero pool.query calls
    it('Scenario H: Enforces exactly ONE client checkout with ZERO interleaved pool.query calls', async () => {
      await provider.atomicAssignProblem(
        PROD_PROBLEM_ID,
        sampleAssignment,
        ProblemStatus.ASSIGNED,
        sampleAction,
        ProblemStatus.TRIAGED
      );

      // Exactly 1 checkout
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      // Zero pool.query calls
      expect(mockPool.query).not.toHaveBeenCalled();
      expect(executedPoolQueries).toHaveLength(0);

      // All transactional statements happened strictly on the single client
      const statements = executedClientQueries.map(q => q.sql.trim().split(' ')[0].toUpperCase());
      expect(statements[0]).toBe('BEGIN');
      expect(statements[statements.length - 1]).toBe('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    // SCENARIO I: Authorization rejects cross-department/field-officer/citizen callers
    it('Scenario I: WorkflowService.assignProblem strictly enforces RBAC authorization', async () => {
      const mockDb = new MockDatabaseProvider();
      await mockDb.createProblemCluster({
        id: PROD_PROBLEM_ID,
        title: 'Water supply rupture',
        description: 'Clean drinking water main leaking onto pavement',
        category: 'water_supply',
        department_id: PROD_DEPT_ID,
        ward_id: 'WARD-019',
        status: ProblemStatus.TRIAGED,
        signal_count: 1,
        impact_score: 49,
        impact_level: ImpactLevel.MEDIUM,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      ProviderContainer.setDatabaseProvider(mockDb);

      const citizenUser: UserProfile = {
        id: 'usr_citizen_test',
        email: 'citizen@test.com',
        display_name: 'Citizen Test',
        role: UserRole.CITIZEN,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const fieldOfficerUser: UserProfile = {
        id: FIELD_OFFICER_ID,
        email: 'field@example.com',
        display_name: 'Field Officer Priyanshu',
        role: UserRole.FIELD_OFFICER,
        department_id: PROD_DEPT_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const crossDeptOfficer: UserProfile = {
        id: 'usr_drainage_officer',
        email: 'drainage@test.com',
        display_name: 'Drainage Dept Officer',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'DRAINAGE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const validDeptOfficer: UserProfile = {
        id: DEPT_OFFICER_ID,
        email: 'officer@example.com',
        display_name: 'WATCO Dept Officer',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: PROD_DEPT_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const assignInput = {
        department_id: PROD_DEPT_ID,
        assigned_to: FIELD_OFFICER_ID,
        priority: AssignmentPriority.HIGH
      };

      // I.1: Citizen rejected
      await expect(
        WorkflowService.assignProblem(citizenUser, PROD_PROBLEM_ID, assignInput)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      });

      // I.2: Field Officer rejected
      await expect(
        WorkflowService.assignProblem(fieldOfficerUser, PROD_PROBLEM_ID, assignInput)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      });

      // I.3: Cross-department Officer rejected
      await expect(
        WorkflowService.assignProblem(crossDeptOfficer, PROD_PROBLEM_ID, assignInput)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      });

      // I.4: Authorized Department Officer succeeds
      const successResult = await WorkflowService.assignProblem(validDeptOfficer, PROD_PROBLEM_ID, assignInput);
      expect(successResult.problem.status).toBe(ProblemStatus.ASSIGNED);
      expect(successResult.assignment.department_id).toBe(PROD_DEPT_ID);
      expect(successResult.assignment.assigned_to).toBe(FIELD_OFFICER_ID);
      expect(successResult.assignment.assigned_by).toBe(DEPT_OFFICER_ID);
    });

    // SCENARIO J: Production-shape fixture using PRB-2026-8299, WATCO, officer@example.com, field@example.com
    it('Scenario J: Pure mock production-shape fixture reproduces PRB-2026-8299 assignment cleanly', async () => {
      const prodProblemId = 'PRB-2026-8299';
      const prodDeptId = 'WATCO';
      const deptOfficerEmail = 'officer@example.com';
      const deptOfficerUuid = '10000000-0000-4000-8000-000000000002';
      const fieldOfficerEmail = 'field@example.com';
      const fieldOfficerUuid = '10000000-0000-4000-8000-000000000003';

      const prodAssignment: Assignment = {
        id: `asgn_${Date.now()}_prod`,
        problem_id: prodProblemId,
        department_id: prodDeptId,
        assigned_to: fieldOfficerUuid,
        assigned_by: deptOfficerUuid,
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.ASSIGNED,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const prodAction: ProblemAction = {
        id: `act_${Date.now()}_prod`,
        problem_id: prodProblemId,
        actor_id: deptOfficerUuid,
        actor_role: UserRole.DEPARTMENT_OFFICER,
        action_type: ActionType.ASSIGNED,
        previous_state: ProblemStatus.TRIAGED,
        new_state: ProblemStatus.ASSIGNED,
        target_department_id: prodDeptId,
        target_officer_id: fieldOfficerUuid,
        note: `Problem assigned to ${prodDeptId} (Officer: ${fieldOfficerEmail}).`,
        created_at: new Date().toISOString()
      };

      const result = await provider.atomicAssignProblem(
        prodProblemId,
        prodAssignment,
        ProblemStatus.ASSIGNED,
        prodAction,
        ProblemStatus.TRIAGED
      );

      // Verify problem transition
      expect(result.problem.id).toBe(prodProblemId);
      expect(result.problem.status).toBe(ProblemStatus.ASSIGNED);
      expect(result.problem.department_id).toBe(prodDeptId);

      // Verify assignment attributes
      expect(result.assignment.assigned_by).toBe(deptOfficerUuid);
      expect(result.assignment.assigned_to).toBe(fieldOfficerUuid);
      expect(result.assignment.department_id).toBe(prodDeptId);

      // Verify action attributes
      expect(result.action.actor_id).toBe(deptOfficerUuid);
      expect(result.action.action_type).toBe(ActionType.ASSIGNED);
      expect(result.action.new_state).toBe(ProblemStatus.ASSIGNED);

      // Verify database queries
      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockPool.connect).toHaveBeenCalledTimes(1);
      expect(executedClientQueries[0].sql).toBe('BEGIN');
      expect(executedClientQueries[executedClientQueries.length - 1].sql).toBe('COMMIT');
      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});
