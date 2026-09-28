import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ProviderContainer,
  MockDatabaseProvider,
  MockAIProvider,
  FirestoreDatabaseProvider
} from '../src/providers';
import {
  SignalStatus,
  SignalProcessingStatus,
  ClusterRelationshipType,
  UserRole,
  UserStatus
} from '@civicpulse/shared';
import { env } from '../src/config/env';

describe('Citizen Report → Government Problem Pipeline (End-to-End Regression)', () => {
  let app: ReturnType<typeof createApp>;
  let mockDb: MockDatabaseProvider;
  let mockAI: MockAIProvider;

  beforeEach(() => {
    mockDb = new MockDatabaseProvider();
    mockAI = new MockAIProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    ProviderContainer.setAIProvider(mockAI);
    (env as any).DEMO_MODE = true;
    app = createApp();
  });

  describe('1. Happy Path: Citizen Submission → Public Problem Publication', () => {
    it('executes full pipeline: persists signal, runs AI analysis, generates embedding, creates ProblemCluster, and calculates impact score', async () => {
      // 1. Citizen submits signal with auto_process: true
      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Open high-voltage electrical cable sparking on roadway near Saheed Nagar market',
          ward_id: 'WARD-004',
          location: { lat: 20.2882, lng: 85.8436 },
          location_reference: 'Saheed Nagar Block B, Near Market Square',
          auto_process: true
        });

      // 2. Verify signal persistence and ownership
      expect(res.status).toBe(201);
      const signal = res.body.data;
      expect(signal.id).toMatch(/^sig_/);
      expect(signal.citizen_id).toBe('usr_citizen_01');
      expect(signal.status).toBe(SignalStatus.ATTACHED_TO_PROBLEM);
      expect(signal.processing_status).toBe(SignalProcessingStatus.COMPLETED);

      // 3. Verify AI analysis succeeded
      expect(signal.ai_analysis).toBeDefined();
      expect(signal.category).toBeDefined();
      expect(signal.normalized_text).toBeDefined();
      expect(signal.severity).toBeDefined();

      // Verify AI Operation was audited
      const aiOps = await mockDb.getAIOperations(signal.id);
      expect(aiOps.length).toBeGreaterThan(0);
      expect(aiOps[0]?.status).toBe('SUCCESS');

      // 4. Verify embedding and ProblemCluster creation
      expect(signal.problem_cluster_id).toMatch(/^PRB-2026-/);
      const clusterResult = res.body.cluster || res.body.data.cluster;
      expect(clusterResult).toBeDefined();
      expect(clusterResult.matched).toBe(true);
      expect(clusterResult.isNewCluster).toBe(true);
      expect(clusterResult.problem).toBeDefined();

      const createdProblem = await mockDb.getProblemCluster(signal.problem_cluster_id);
      expect(createdProblem).not.toBeNull();
      expect(createdProblem?.id).toBe(signal.problem_cluster_id);
      expect(createdProblem?.signal_count).toBe(1);

      // 5. Verify deterministic impact score calculated
      expect(createdProblem?.impact_score).toBeGreaterThan(0);
      expect(createdProblem?.impact_level).toBeDefined();
      expect(createdProblem?.severity_score).toBeDefined();
      expect(createdProblem?.population_score).toBeDefined();

      // 6. Verify cluster membership persisted
      const members = await mockDb.getProblemClusterMembers(createdProblem!.id);
      expect(members.length).toBe(1);
      expect(members[0]?.signal_id).toBe(signal.id);
      expect(members[0]?.problem_id).toBe(createdProblem!.id);
      expect(members[0]?.relationship).toBe(ClusterRelationshipType.DUPLICATE);

      // 7. Verify problem appears in GET /api/v1/problems
      const problemsRes = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(problemsRes.status).toBe(200);
      const foundInDirectory = problemsRes.body.data.some((p: any) => p.id === createdProblem!.id);
      expect(foundInDirectory).toBe(true);

      // 8. Verify problem appears in government priority dashboard queue
      const dashProblemsRes = await request(app)
        .get('/api/v1/dashboard/problems')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(dashProblemsRes.status).toBe(200);
      const foundInDashboard = dashProblemsRes.body.data.some((p: any) => p.id === createdProblem!.id);
      expect(foundInDashboard).toBe(true);
    });

    it('reuses existing cluster when similarity threshold is met and recalculates impact', async () => {
      // 1. Submit first report -> establishes new cluster
      const res1 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Severe drainage overflow submerging street near Old Town temple road',
          ward_id: 'WARD-012',
          location: { lat: 20.2405, lng: 85.8342 },
          location_reference: 'Old Town Rath Road',
          auto_process: true
        });

      expect(res1.status).toBe(201);
      const problemId = res1.body.data.problem_cluster_id;
      expect(problemId).toBeDefined();

      const initialProblem = await mockDb.getProblemCluster(problemId);
      expect(initialProblem?.signal_count).toBe(1);

      // 2. Citizen 2 submits related report at identical location
      const res2 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen-2')
        .send({
          original_text: 'Severe drainage overflow submerging street near Old Town temple road, impassable for vehicles',
          ward_id: 'WARD-012',
          location: { lat: 20.2405, lng: 85.8342 },
          location_reference: 'Old Town Rath Road',
          auto_process: true
        });

      expect(res2.status).toBe(201);
      const clusterResult2 = res2.body.cluster || res2.body.data.cluster;
      expect(clusterResult2).toBeDefined();
      expect(clusterResult2.matched).toBe(true);
      expect(clusterResult2.isNewCluster).toBe(false);
      expect(clusterResult2.problem.id).toBe(problemId);

      // 3. Verify signal_count updated to 2 and impact recalculated
      const updatedProblem = await mockDb.getProblemCluster(problemId);
      expect(updatedProblem?.signal_count).toBe(2);

      // 4. Verify both signals are recorded in cluster_members
      const members = await mockDb.getProblemClusterMembers(problemId);
      expect(members.length).toBe(2);
      expect(members.map((m) => m.signal_id)).toContain(res1.body.data.id);
      expect(members.map((m) => m.signal_id)).toContain(res2.body.data.id);
    });
  });

  describe('2. Authorization & Privacy Scoping', () => {
    it('enforces privacy: Citizen cannot view another citizen private signal', async () => {
      // Citizen 1 creates signal
      const createRes = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Burst drinking water pipe in Nayapalli',
          ward_id: 'WARD-018',
          auto_process: true
        });

      expect(createRes.status).toBe(201);
      const signalId = createRes.body.data.id;

      // Citizen 2 attempts to query Citizen 1's signal directly
      const viewRes = await request(app)
        .get(`/api/v1/signals/${signalId}`)
        .set('Authorization', 'Bearer demo-token-citizen-2');

      // Privacy enforcement: 404 NOT_FOUND returned to prevent enumeration
      expect(viewRes.status).toBe(404);
    });

    it('allows government officers and admins to view the resulting public problem', async () => {
      const createRes = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Fallen electric pole blocking arterial road in Saheed Nagar',
          ward_id: 'WARD-004',
          location: { lat: 20.2882, lng: 85.8436 },
          auto_process: true
        });

      expect(createRes.status).toBe(201);
      const problemId = createRes.body.data.problem_cluster_id;

      // Government officer views problem
      const govRes = await request(app)
        .get(`/api/v1/problems/${problemId}`)
        .set('Authorization', 'Bearer demo-token-officer');

      expect(govRes.status).toBe(200);
      expect(govRes.body.data.id).toBe(problemId);
    });

    it('rejects citizen access to internal government dashboard queue with 403 FORBIDDEN', async () => {
      const dashRes = await request(app)
        .get('/api/v1/dashboard/problems')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(dashRes.status).toBe(403);
      expect(dashRes.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Failure Cases & Resilience (Never Silently Claim Success)', () => {
    it('fails cleanly with 502 AI_PROCESSING_FAILED when AI analysis fails', async () => {
      // Simulate AI Provider failure
      vi.spyOn(mockAI, 'analyzeSignal').mockRejectedValueOnce(new Error('AI Engine rate limit exceeded'));

      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Gas leak reported near restaurant kitchen',
          ward_id: 'WARD-018',
          auto_process: true
        });

      // Must never claim 201 or success
      expect(res.status).toBe(502);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('AI_PROCESSING_FAILED');
    });

    it('handles embedding service failure resiliently by persisting signal and returning degraded 201 status', async () => {
      // Simulate Embedding failure (e.g. Gemini 429 / RESOURCE_EXHAUSTED)
      vi.spyOn(mockAI, 'generateEmbedding').mockRejectedValueOnce(new Error('Vector embedding service unavailable'));

      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Broken water tap flooding sidewalk',
          ward_id: 'WARD-018',
          auto_process: true
        });

      // Must never drop signal, must return 201 with truthful degraded state
      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toMatch(/^sig_/);
      expect(res.body.data.processing_status).toBe('PENDING');
      expect(res.body.cluster).toBeNull();
      expect(res.body.degraded).toBe(true);
      expect(res.body.data.degradation_reason).toBe('EMBEDDING_UNAVAILABLE');
    });

    it('rejects rapid duplicate submissions from the same citizen with 409 CONFLICT', async () => {
      // First submission
      const res1 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Pothole on VIP Road Jayadev Vihar',
          ward_id: 'WARD-018',
          auto_process: true
        });

      expect(res1.status).toBe(201);

      // Duplicate submission within cooldown window
      const res2 = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Pothole on VIP Road Jayadev Vihar',
          ward_id: 'WARD-018',
          auto_process: true
        });

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('CONFLICT');
      expect(res2.body.error.message).toContain('Duplicate report submission detected');
    });

    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const res = await request(app)
        .post('/api/v1/signals')
        .send({
          original_text: 'Anonymous report attempt',
          auto_process: true
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('4. DEMO_MODE & REAL_MODE Preservation', () => {
    it('preserves Golden Demo problem PRB-2026-0819 in DEMO_MODE without corruption', async () => {
      (env as any).DEMO_MODE = true;

      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      const problem = res.body.data;
      expect(problem.id).toBe('PRB-2026-0819');
      expect(problem.impact_score).toBe(92);
      expect(problem.signal_count).toBe(327);
      expect(problem.is_demo).toBe(true);
      expect(problem.ward_id).toBe('WARD-018');
    });

    it('uses FirestoreDatabaseProvider structure for REAL_MODE collections', () => {
      const firestore = new FirestoreDatabaseProvider({} as any);
      expect(firestore).toBeDefined();
      expect(typeof firestore.createSignal).toBe('function');
      expect(typeof firestore.createProblemCluster).toBe('function');
      expect(typeof firestore.addProblemClusterMember).toBe('function');
    });
  });
});
