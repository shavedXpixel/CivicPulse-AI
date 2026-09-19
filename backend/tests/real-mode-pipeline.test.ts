import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider, FirebaseAuthProvider } from '../src/providers';
import { env } from '../src/config/env';
import {
  UserRole,
  SignalStatus,
  SignalProcessingStatus,
  ImpactLevel,
  IMPACT_MAX_SCORES
} from '@civicpulse/shared';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';

describe('Phase 10 Step 4: Real-Mode Signal → Analysis → Clustering → Problem Pipeline', () => {
  let app: ReturnType<typeof createApp>;
  const originalDemoMode = env.DEMO_MODE;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;

  const citizenUid = 'real_citizen_pipeline_01';
  const officerUid = 'real_officer_pipeline_01';

  beforeEach(() => {
    (env as any).AUTH_PROVIDER = 'firebase';
    ProviderContainer.resetAllProviders();
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    ProviderContainer.setAuthProvider(new FirebaseAuthProvider());
    (env as any).DEMO_MODE = false;
    app = createApp();

    mockVerifyIdToken = vi.fn().mockImplementation(async (token: string) => {
      if (token === 'citizen-token') {
        return {
          uid: citizenUid,
          email: 'citizen.pipeline@bhubaneswar.gov.in',
          name: 'Ashok Patnaik'
        };
      }
      if (token === 'officer-token') {
        return {
          uid: officerUid,
          email: 'officer.pipeline@bhubaneswar.gov.in',
          name: 'Officer Triage'
        };
      }
      throw new Error('Invalid token');
    });

    vi.spyOn(firebaseAdminModule, 'getFirebaseAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken
    } as any);
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.resetAllProviders();
    vi.restoreAllMocks();
  });

  it('executes full pipeline: real signal → Gemini analysis → embedding → clustering → problem → impact', async () => {
    const db = ProviderContainer.getDatabaseProvider();

    // Set up officer user role in DB so officer can run clustering operations
    await db.createUser({
      id: officerUid,
      email: 'officer.pipeline@bhubaneswar.gov.in',
      display_name: 'Officer Triage',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: 'bmc_sanitation',
      status: 'ACTIVE' as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Mock AI Provider in REAL_MODE for deterministic pipeline execution
    const mockAnalyzeSignal = vi.fn().mockResolvedValue({
      detected_language: 'en',
      normalized_summary: 'Severe overflowing garbage dump blocking public walkway and residential entrance',
      category: 'solid_waste',
      subcategory: 'illegal_dumping',
      severity: 'HIGH',
      urgency: 'HIGH',
      affected_scope: 'neighborhood',
      duration_days: 2,
      location_reference: 'Near Patia Big Bazaar Lane',
      recommended_department: 'bmc_sanitation',
      entities: ['Patia Lane', 'garbage dump'],
      critical_facility: null,
      confidence: 0.94,
      explanation: 'Uncontrolled waste accumulation presenting sanitation hazards.',
      image_findings: []
    });

    // 10-dimensional mock embedding vector
    const mockEmbedding1 = [0.1, 0.8, 0.4, 0.2, 0.1, 0.05, 0.3, 0.6, 0.2, 0.1];
    const mockGenerateEmbedding = vi.fn().mockResolvedValue(mockEmbedding1);

    ProviderContainer.setAIProvider({
      analyzeSignal: mockAnalyzeSignal,
      generateEmbedding: mockGenerateEmbedding,
      summarizeCluster: vi.fn().mockResolvedValue('Cluster summary'),
      getModelName: () => 'gemini-2.5-flash',
      getPromptVersion: () => 'v1.0.0'
    } as any);

    // =========================================================================
    // Stage 1: Real Citizen Signal Creation
    // =========================================================================
    const createRes = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer citizen-token')
      .send({
        original_text: 'Massive garbage pile accumulating near Patia market, spreading across road',
        location: { lat: 20.3550, lng: 85.8150 },
        location_reference: 'Near Patia Big Bazaar Lane',
        auto_process: false
      });

    expect(createRes.status).toBe(201);
    const signal1 = createRes.body.data;
    expect(signal1.id).toMatch(/^sig_/);
    expect(signal1.citizen_id).toBe(citizenUid);
    expect(signal1.status).toBe(SignalStatus.ACTIVE);
    expect(signal1.processing_status).toBe(SignalProcessingStatus.PENDING);
    // Verified: Signal written to database provider with raw coordinates
    expect(signal1.location.lat).toBe(20.3550);
    expect(signal1.location.lng).toBe(85.8150);

    // =========================================================================
    // Stage 2: Real Gemini AI Analysis
    // =========================================================================
    const analyzeRes = await request(app)
      .post(`/api/v1/signals/${signal1.id}/analyze`)
      .set('Authorization', 'Bearer citizen-token');

    expect(analyzeRes.status).toBe(200);
    expect(mockAnalyzeSignal).toHaveBeenCalledOnce();
    const analyzedSignal = analyzeRes.body.data.signal;
    expect(analyzedSignal.processing_status).toBe(SignalProcessingStatus.COMPLETED);
    expect(analyzedSignal.category).toBe('solid_waste');
    expect(analyzedSignal.severity).toBe('HIGH');
    expect(analyzedSignal.normalized_text).toBe(
      'Severe overflowing garbage dump blocking public walkway and residential entrance'
    );
    expect(analyzedSignal.recommended_department).toBe('bmc_sanitation');

    // Verify AI Operation Record was persisted
    const aiOp = analyzeRes.body.data.operation;
    expect(aiOp).toBeDefined();
    expect(aiOp.entity_id).toBe(signal1.id);
    expect(aiOp.status).toBe('SUCCESS');

    // =========================================================================
    // Stage 3 & 4: Initial Signal Clustering (Promote to new Problem Cluster)
    // =========================================================================
    const clusterRes1 = await request(app)
      .post(`/api/v1/signals/${signal1.id}/cluster`)
      .set('Authorization', 'Bearer officer-token')
      .send({ auto_create: true });

    expect(clusterRes1.status).toBe(200);
    expect(mockGenerateEmbedding).toHaveBeenCalled();
    const clusterData1 = clusterRes1.body.data;
    expect(clusterData1.matched).toBe(true);
    expect(clusterData1.isNewCluster).toBe(true);

    const problem1 = clusterData1.problem;
    expect(problem1).toBeDefined();
    expect(problem1.id).toMatch(/^PRB-2026-/);
    expect(problem1.category).toBe('solid_waste');
    expect(problem1.signal_count).toBe(1);
    expect(problem1.status).toBe('TRIAGED');

    // Verify 7-factor impact was calculated deterministically
    expect(problem1.impact_score).toBeGreaterThan(0);
    expect(problem1.impact_score).toBeLessThanOrEqual(100);
    const expectedSum1 =
      problem1.severity_score +
      problem1.population_score +
      problem1.duration_score +
      problem1.concentration_score +
      problem1.critical_exposure_score +
      problem1.recurrence_score +
      problem1.evidence_score;
    expect(problem1.impact_score).toBe(expectedSum1);

    // Verify Signal 1 was updated to ATTACHED_TO_PROBLEM
    const updatedSignal1 = await db.getSignal(signal1.id);
    expect(updatedSignal1?.status).toBe(SignalStatus.ATTACHED_TO_PROBLEM);
    expect(updatedSignal1?.problem_cluster_id).toBe(problem1.id);

    // Verify Cluster Member was persisted
    const members1 = await db.getProblemClusterMembers(problem1.id);
    expect(members1).toHaveLength(1);
    expect(members1[0]?.signal_id).toBe(signal1.id);
    expect(members1[0]?.problem_id).toBe(problem1.id);

    // Verify Data Provenance: REAL/ESTIMATED when reference datasets are loaded, or UNKNOWN fallback
    expect(problem1.data_provenance).toBeDefined();
    expect(['REAL', 'UNKNOWN']).toContain(problem1.data_provenance.geography);
    expect(['ESTIMATED', 'UNKNOWN']).toContain(problem1.data_provenance.population);
    expect(['REAL', 'UNKNOWN']).toContain(problem1.data_provenance.facility);

    // =========================================================================
    // Stage 5: Second Correlated Signal Clustering into Existing Problem
    // =========================================================================
    const citizenUid2 = 'real_citizen_pipeline_02';
    mockVerifyIdToken.mockImplementation(async (token: string) => {
      if (token === 'citizen-2-token') {
        return {
          uid: citizenUid2,
          email: 'citizen2@bhubaneswar.gov.in',
          name: 'Priya Das'
        };
      }
      if (token === 'officer-token') {
        return {
          uid: officerUid,
          email: 'officer.pipeline@bhubaneswar.gov.in',
          name: 'Officer Triage'
        };
      }
      throw new Error('Invalid token');
    });

    // Create Signal 2 nearby in same neighborhood
    const createRes2 = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer citizen-2-token')
      .send({
        original_text: 'Overflowing trash and solid waste blocking footpath near Patia lane',
        location: { lat: 20.3552, lng: 85.8152 }, // ~25 meters away
        location_reference: 'Patia Market Footpath',
        auto_process: false
      });

    expect(createRes2.status).toBe(201);
    const signal2 = createRes2.body.data;

    // Analyze Signal 2
    mockAnalyzeSignal.mockResolvedValueOnce({
      detected_language: 'en',
      normalized_summary: 'Overflowing garbage blocking footpath in Patia',
      category: 'solid_waste',
      severity: 'HIGH',
      urgency: 'HIGH',
      duration_days: 2,
      recommended_department: 'bmc_sanitation',
      entities: ['Patia Market'],
      critical_facility: null,
      confidence: 0.92,
      explanation: 'Hazardous solid waste overflow.',
      image_findings: []
    });

    await request(app)
      .post(`/api/v1/signals/${signal2.id}/analyze`)
      .set('Authorization', 'Bearer citizen-2-token');

    // Highly similar embedding (cosine similarity ~ 0.98)
    const mockEmbedding2 = [0.12, 0.79, 0.39, 0.21, 0.1, 0.04, 0.31, 0.58, 0.21, 0.09];
    mockGenerateEmbedding.mockResolvedValue(mockEmbedding2);

    // Cluster Signal 2 (should attach to problem1 via spatial + semantic similarity)
    const clusterRes2 = await request(app)
      .post(`/api/v1/signals/${signal2.id}/cluster`)
      .set('Authorization', 'Bearer officer-token')
      .send({ auto_create: false });

    expect(clusterRes2.status).toBe(200);
    const clusterData2 = clusterRes2.body.data;
    expect(clusterData2.matched).toBe(true);
    expect(clusterData2.isNewCluster).toBeFalsy();
    expect(clusterData2.problem.id).toBe(problem1.id);
    expect(clusterData2.score).toBeGreaterThanOrEqual(0.70);

    // =========================================================================
    // Stage 6: Verify Impact Recalculation on Cluster
    // =========================================================================
    const updatedProblem = await db.getProblemCluster(problem1.id);
    expect(updatedProblem).not.toBeNull();
    // Signal count increased to 2
    expect(updatedProblem?.signal_count).toBe(2);

    // Concentration score increased because count increased from 1 to 2
    expect(updatedProblem?.concentration_score).toBeGreaterThanOrEqual(
      problem1.concentration_score
    );

    // Verify recalculated impact score is the deterministic sum of its 7 components
    const expectedSum2 =
      updatedProblem!.severity_score +
      updatedProblem!.population_score +
      updatedProblem!.duration_score +
      updatedProblem!.concentration_score +
      updatedProblem!.critical_exposure_score +
      updatedProblem!.recurrence_score +
      updatedProblem!.evidence_score;
    expect(updatedProblem!.impact_score).toBe(expectedSum2);

    // Verify cluster membership count
    const membersFinal = await db.getProblemClusterMembers(problem1.id);
    expect(membersFinal).toHaveLength(2);
    expect(membersFinal.some((m) => m.signal_id === signal1.id)).toBe(true);
    expect(membersFinal.some((m) => m.signal_id === signal2.id)).toBe(true);
  });

  it('preserves DEMO_MODE behavior without regression', async () => {
    (env as any).DEMO_MODE = true;
    ProviderContainer.resetAllProviders();
    const demoApp = createApp();

    // Verify Golden Demo problem PRB-2026-0819 exists and preserves score 92
    const res = await request(demoApp)
      .get('/api/v1/problems/PRB-2026-0819')
      .set('Authorization', 'Bearer demo-token-admin');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('PRB-2026-0819');
    expect(res.body.data.impact_score).toBe(92);
    expect(res.body.data.ward_id).toBe('WARD-018');
    expect(res.body.data.estimated_population).toBe(18400);
  });
});
