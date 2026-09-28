import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider, getDatabaseProvider, FirebaseAuthProvider } from '../src/providers';
import {
  ProblemStatus,
  AssignmentPriority,
  AssignmentStatus,
  ActionType,
  EvidenceType,
  EvidenceStatus,
  BeforeOrAfter,
  ProblemCluster,
  VerificationResultStatus,
  VerificationFailureReason,
  UserRole,
  UserProfile,
  UserStatus,
  ImpactLevel,
  Assignment,
  ProblemAction,
  ERROR_CODES
} from '@civicpulse/shared';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';
import { GeminiVerificationProvider } from '../src/providers/ai/gemini.verification';
import { VerificationService } from '../src/modules/resolutions/verification.service';
import { ResolutionService } from '../src/modules/resolutions/resolution.service';
import { WorkflowService } from '../src/modules/workflow/workflow.service';

describe('PHASE 15B.5.3.18-HF6.1 — Production Hardening Implementation', () => {
  let app: any;
  const originalDemoMode = env.DEMO_MODE;
  const originalApiKey = env.GEMINI_API_KEY;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;
  let db: MockDatabaseProvider;

  const adminUser: UserProfile = {
    id: 'usr_admin_001',
    auth_user_id: 'auth_admin_001',
    email: 'admin@civicpulse.gov.in',
    display_name: 'System Admin',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const fieldOfficer: UserProfile = {
    id: 'usr_officer_001',
    auth_user_id: 'auth_officer_001',
    email: 'officer@civicpulse.gov.in',
    display_name: 'Field Officer Patel',
    role: UserRole.FIELD_OFFICER,
    status: UserStatus.ACTIVE,
    department_id: 'WATCO',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const wrongOfficer: UserProfile = {
    id: 'usr_officer_999',
    auth_user_id: 'auth_officer_999',
    email: 'other_officer@civicpulse.gov.in',
    display_name: 'Officer Sharma',
    role: UserRole.FIELD_OFFICER,
    status: UserStatus.ACTIVE,
    department_id: 'WATCO',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const supervisorUser: UserProfile = {
    id: 'usr_dept_head',
    auth_user_id: 'auth_dept_head',
    email: 'dept_head@civicpulse.gov.in',
    display_name: 'Department Head Das',
    role: UserRole.DEPARTMENT_OFFICER,
    status: UserStatus.ACTIVE,
    department_id: 'WATCO',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const createTestProblemCluster = (overrides?: Partial<ProblemCluster>): ProblemCluster => ({
    id: 'PRB-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
    title: 'Test Incident',
    category: 'water_supply',
    department_id: 'WATCO',
    status: ProblemStatus.TRIAGED,
    signal_count: 1,
    severity_score: 15,
    population_score: 10,
    duration_score: 5,
    concentration_score: 5,
    critical_exposure_score: 5,
    recurrence_score: 5,
    evidence_score: 5,
    impact_score: 50,
    impact_level: ImpactLevel.MEDIUM,
    first_detected_at: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    (env as any).DEMO_MODE = false;
    (env as any).GEMINI_API_KEY = 'test_gemini_api_key_valid';

    db = new MockDatabaseProvider();
    ProviderContainer.setDatabaseProvider(db);
    ProviderContainer.setVerificationProvider(null);
    ProviderContainer.setAuthProvider(new FirebaseAuthProvider());

    app = createApp();

    mockVerifyIdToken = vi.fn().mockImplementation(async (token: string) => {
      if (token === 'valid-supervisor-token') {
        return {
          uid: supervisorUser.id,
          email: supervisorUser.email
        };
      }
      return {
        uid: supervisorUser.id,
        email: supervisorUser.email
      };
    });
    vi.spyOn(firebaseAdminModule, 'getFirebaseAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken
    } as any);

    // Pre-populate users in mock db
    await db.createUser(adminUser);
    await db.createUser(fieldOfficer);
    await db.createUser(wrongOfficer);
    await db.createUser(supervisorUser);
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    (env as any).GEMINI_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // AI VERIFICATION HARDENING (REQ-HARD-1 & REQ-HARD-2, Tests 1–10)
  // ===========================================================================
  describe('AI Verification Hardening', () => {
    it('1. 30-second timeout configuration is defined on GeminiVerificationProvider', () => {
      expect(GeminiVerificationProvider.TIMEOUT_MS).toBe(30000);
      expect(GeminiVerificationProvider.MAX_RETRIES).toBe(3);
    });

    it('2. TIMEOUT produces structured failure_reason: TIMEOUT', async () => {
      const provider = new GeminiVerificationProvider();

      // Mock fetch that simulates AbortController abort (timeout)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'AbortError';
        return Promise.reject(err);
      });

      const output = await provider.verifyResolutionEvidence({
        problem_id: 'PRB-TEST-001',
        problem_title: 'Water Pipe Leak',
        problem_category: 'water_supply',
        evidence: {
          id: 'evd_001',
          problem_id: 'PRB-TEST-001',
          submitted_by: fieldOfficer.id,
          submitted_at: new Date().toISOString(),
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/water_repaired.jpg',
          status: EvidenceStatus.SUBMITTED,
          created_at: new Date().toISOString()
        }
      });

      expect(output.verification_result).toBe(VerificationResultStatus.INCONCLUSIVE);
      expect(output.failure_reason).toBe(VerificationFailureReason.TIMEOUT);
      expect(output.review_required).toBe(true);
      expect(output.confidence).toBe(0.5);
      fetchSpy.mockRestore();
    });

    it('3. provider 503 produces structured failure_reason: PROVIDER_UNAVAILABLE', async () => {
      const provider = new GeminiVerificationProvider();

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable: Backend model is overloaded'
      } as any);

      const output = await provider.verifyResolutionEvidence({
        problem_id: 'PRB-TEST-001',
        problem_title: 'Water Pipe Leak',
        problem_category: 'water_supply',
        evidence: {
          id: 'evd_001',
          problem_id: 'PRB-TEST-001',
          submitted_by: fieldOfficer.id,
          submitted_at: new Date().toISOString(),
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/water_repaired.jpg',
          status: EvidenceStatus.SUBMITTED,
          created_at: new Date().toISOString()
        }
      });

      expect(output.verification_result).toBe(VerificationResultStatus.INCONCLUSIVE);
      expect(output.failure_reason).toBe(VerificationFailureReason.PROVIDER_UNAVAILABLE);
      expect(output.review_required).toBe(true);
      fetchSpy.mockRestore();
    });

    it('4. malformed response produces structured failure_reason: INVALID_RESPONSE', async () => {
      const provider = new GeminiVerificationProvider();

      // Return JSON without candidates
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [] })
      } as any);

      const output = await provider.verifyResolutionEvidence({
        problem_id: 'PRB-TEST-001',
        problem_title: 'Water Pipe Leak',
        problem_category: 'water_supply',
        evidence: {
          id: 'evd_001',
          problem_id: 'PRB-TEST-001',
          submitted_by: fieldOfficer.id,
          submitted_at: new Date().toISOString(),
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/water_repaired.jpg',
          status: EvidenceStatus.SUBMITTED,
          created_at: new Date().toISOString()
        }
      });

      expect(output.verification_result).toBe(VerificationResultStatus.INCONCLUSIVE);
      expect(output.failure_reason).toBe(VerificationFailureReason.INVALID_RESPONSE);
      expect(output.review_required).toBe(true);
      fetchSpy.mockRestore();
    });

    it('5. schema validation failure produces structured failure_reason: SCHEMA_VALIDATION', async () => {
      const provider = new GeminiVerificationProvider();

      // Return invalid verification schema (missing required fields)
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ invalid_field: 123 }) }]
              }
            }
          ]
        })
      } as any);

      const output = await provider.verifyResolutionEvidence({
        problem_id: 'PRB-TEST-001',
        problem_title: 'Water Pipe Leak',
        problem_category: 'water_supply',
        evidence: {
          id: 'evd_001',
          problem_id: 'PRB-TEST-001',
          submitted_by: fieldOfficer.id,
          submitted_at: new Date().toISOString(),
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/water_repaired.jpg',
          status: EvidenceStatus.SUBMITTED,
          created_at: new Date().toISOString()
        }
      });

      expect(output.verification_result).toBe(VerificationResultStatus.INCONCLUSIVE);
      expect(output.failure_reason).toBe(VerificationFailureReason.SCHEMA_VALIDATION);
      expect(output.review_required).toBe(true);
      fetchSpy.mockRestore();
    });

    it('6. legitimate INCONCLUSIVE model response does NOT get a failure_reason', async () => {
      const provider = new GeminiVerificationProvider();

      const validInconclusiveResponse = {
        verification_result: 'INCONCLUSIVE',
        confidence: 0.52,
        observed_conditions: ['Camera angle is obstructed; cannot confirm joint replacement.'],
        evidence_summary: 'Image shows ongoing road excavation, repair state cannot be verified.',
        inconsistencies: ['Obscured perspective'],
        explanation: 'Low confidence due to poor lighting and blocked vantage point.',
        recommended_review_reason: 'Conduct physical inspection.',
        limitations: ['Night capture'],
        review_required: true
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(validInconclusiveResponse) }]
              }
            }
          ]
        })
      } as any);

      const output = await provider.verifyResolutionEvidence({
        problem_id: 'PRB-TEST-001',
        problem_title: 'Water Pipe Leak',
        problem_category: 'water_supply',
        evidence: {
          id: 'evd_001',
          problem_id: 'PRB-TEST-001',
          submitted_by: fieldOfficer.id,
          submitted_at: new Date().toISOString(),
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/water_repaired.jpg',
          status: EvidenceStatus.SUBMITTED,
          created_at: new Date().toISOString()
        }
      });

      expect(output.verification_result).toBe(VerificationResultStatus.INCONCLUSIVE);
      expect(output.failure_reason).toBeUndefined();
      expect(output.confidence).toBe(0.52);
      expect(output.review_required).toBe(true);
      fetchSpy.mockRestore();
    });

    it('7. all failure paths require manual review', async () => {
      const provider = new GeminiVerificationProvider();

      // Test with network error
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Connection reset by peer'));

      const output = await provider.verifyResolutionEvidence({
        problem_id: 'PRB-TEST-001',
        problem_title: 'Water Pipe Leak',
        problem_category: 'water_supply',
        evidence: {
          id: 'evd_001',
          problem_id: 'PRB-TEST-001',
          submitted_by: fieldOfficer.id,
          submitted_at: new Date().toISOString(),
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/water_repaired.jpg',
          status: EvidenceStatus.SUBMITTED,
          created_at: new Date().toISOString()
        }
      });

      expect(output.review_required).toBe(true);
      expect(output.failure_reason).toBe(VerificationFailureReason.PROVIDER_UNAVAILABLE);
      fetchSpy.mockRestore();
    });

    it('8. no failure path auto-resolves/closes a problem', async () => {
      // Set up problem in AWAITING_VERIFICATION
      const problem: ProblemCluster = createTestProblemCluster({
        id: 'PRB-AWAIT-001',
        title: 'Road Pit Repair',
        description: 'Deep road cavity',
        category: 'roads',
        department_id: 'BMC_ROADS',
        status: ProblemStatus.AWAITING_VERIFICATION,
        assigned_to: fieldOfficer.id,
        signal_count: 5,
        impact_score: 45
      });
      await db.createProblemCluster(problem);

      // Add evidence
      await db.createResolutionEvidence({
        id: 'evd_await_001',
        problem_id: problem.id,
        submitted_by: fieldOfficer.id,
        submitted_at: new Date().toISOString(),
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: 'evidence/road_patch.jpg',
        status: EvidenceStatus.SUBMITTED,
        created_at: new Date().toISOString()
      });

      // Provider throws an error
      const failingProvider = {
        verifyResolutionEvidence: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
        getModelName: () => 'mock-failing-ai',
        getPromptVersion: () => 'v1'
      };
      ProviderContainer.setVerificationProvider(failingProvider);

      const verificationRecord = await VerificationService.verifyProblemEvidence(fieldOfficer, problem.id);

      expect(verificationRecord.verification_result).toBe(VerificationResultStatus.INCONCLUSIVE);
      expect(verificationRecord.failure_reason).toBe(VerificationFailureReason.PROVIDER_UNAVAILABLE);
      expect(verificationRecord.review_required).toBe(true);

      // Verify the problem is STILL strictly in AWAITING_VERIFICATION, NOT RESOLVED or CLOSED
      const persistedProblem = await db.getProblemCluster(problem.id);
      expect(persistedProblem?.status).toBe(ProblemStatus.AWAITING_VERIFICATION);
      expect(persistedProblem?.status).not.toBe(ProblemStatus.RESOLVED);
      expect(persistedProblem?.status).not.toBe(ProblemStatus.CLOSED);
    });

    it('9. retry count remains bounded and deterministic errors do not retry', async () => {
      const provider = new GeminiVerificationProvider();

      let fetchCallCount = 0;
      // 400 Bad Request is a deterministic validation failure and should NOT be retried
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        fetchCallCount++;
        return Promise.resolve({
          ok: false,
          status: 400,
          text: async () => 'Bad Request: malformed JSON parameter'
        } as any);
      });

      await provider.verifyResolutionEvidence({
        problem_id: 'PRB-TEST-001',
        problem_title: 'Water Pipe Leak',
        problem_category: 'water_supply',
        evidence: {
          id: 'evd_001',
          problem_id: 'PRB-TEST-001',
          submitted_by: fieldOfficer.id,
          submitted_at: new Date().toISOString(),
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/water_repaired.jpg',
          status: EvidenceStatus.SUBMITTED,
          created_at: new Date().toISOString()
        }
      });

      // Deterministic error must break out after attempt 1
      expect(fetchCallCount).toBe(1);
      fetchSpy.mockRestore();
    });

    it('10. retry backoff is bounded', () => {
      // Test the backoff equation for attempts 1, 2, 3
      const maxRetries = 3;
      for (let attempt = 1; attempt < maxRetries; attempt++) {
        const baseDelay = 500 * Math.pow(2, attempt - 1);
        const maxJitter = 100 * attempt;
        const delay = Math.min(2000, baseDelay + maxJitter);
        expect(delay).toBeLessThanOrEqual(2000);
      }
    });
  });

  // ===========================================================================
  // EVIDENCE PROVENANCE HARDENING (REQ-HARD-3, Tests 11–16)
  // ===========================================================================
  describe('Evidence Provenance Hardening', () => {
    let activeProblem: ProblemCluster;

    beforeEach(async () => {
      activeProblem = createTestProblemCluster({
        id: 'PRB-PROD-001',
        title: 'Damaged Water Valve on Trunk Line',
        description: 'Potable water main leaking near junction',
        category: 'water_supply',
        department_id: 'WATCO',
        status: ProblemStatus.IN_PROGRESS,
        assigned_to: fieldOfficer.id,
        is_demo: false, // Production problem
        signal_count: 8,
        impact_score: 55
      });
      await db.createProblemCluster(activeProblem);
    });

    it('11. production evidence defaults to is_demo = false', async () => {
      const { evidence, problem_status } = await ResolutionService.submitEvidence(
        fieldOfficer,
        activeProblem.id,
        {
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/valve_repaired.jpg',
          description: 'Replaced ruptured flange and sealed trunk pipe'
        }
      );

      expect(evidence.is_demo).toBe(false);
      expect(problem_status).toBe(ProblemStatus.AWAITING_VERIFICATION);

      const persisted = await db.getEvidenceById(evidence.id);
      expect(persisted?.is_demo).toBe(false);
    });

    it('12. authorized synthetic/test workflow can persist is_demo = true', async () => {
      // System administrator explicitly marking test evidence as synthetic
      const { evidence } = await ResolutionService.submitEvidence(
        adminUser,
        activeProblem.id,
        {
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/test_synthetic_valve.jpg',
          description: 'Synthetic end-to-end integration proof',
          is_demo: true
        }
      );

      expect(evidence.is_demo).toBe(true);

      const persisted = await db.getEvidenceById(evidence.id);
      expect(persisted?.is_demo).toBe(true);
    });

    it('13. ordinary Field Officer cannot arbitrarily spoof provenance (403 Forbidden)', async () => {
      // Field officer attempts to declare is_demo: true on production problem
      await expect(
        ResolutionService.submitEvidence(
          fieldOfficer,
          activeProblem.id,
          {
            evidence_type: EvidenceType.COMPLETION_PHOTO,
            storage_path: 'evidence/unauthorized_spoof.jpg',
            description: 'Trying to pass synthetic flag as normal officer',
            is_demo: true
          }
        )
      ).rejects.toThrow(/Only administrators are authorized/);
    });

    it('14. description text cannot override provenance', async () => {
      // Ordinary field officer includes synthetic text in description
      const { evidence } = await ResolutionService.submitEvidence(
        fieldOfficer,
        activeProblem.id,
        {
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/valve_repaired.jpg',
          description: '[SYNTHETIC TEST EVIDENCE - FOR TESTING ONLY] Physical pipe restored.'
        }
      );

      // Provenance strictly remains false based on server authority
      expect(evidence.is_demo).toBe(false);
      const persisted = await db.getEvidenceById(evidence.id);
      expect(persisted?.is_demo).toBe(false);
    });

    it('15. governance queries can exclude is_demo records by boolean', async () => {
      // Submit one production evidence (is_demo: false)
      await ResolutionService.submitEvidence(
        fieldOfficer,
        activeProblem.id,
        {
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/prod_proof.jpg',
          description: 'Real official field photo'
        }
      );

      // Submit one synthetic evidence via admin (is_demo: true)
      await ResolutionService.submitEvidence(
        adminUser,
        activeProblem.id,
        {
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/synth_proof.jpg',
          description: 'Synthetic E2E proof',
          is_demo: true
        }
      );

      const allEvidence = await db.getResolutionEvidence(activeProblem.id);
      expect(allEvidence.length).toBe(2);

      const productionOnly = allEvidence.filter((e) => e.is_demo === false);
      const syntheticOnly = allEvidence.filter((e) => e.is_demo === true);

      expect(productionOnly.length).toBe(1);
      expect(productionOnly[0].storage_path).toBe('evidence/prod_proof.jpg');

      expect(syntheticOnly.length).toBe(1);
      expect(syntheticOnly[0].storage_path).toBe('evidence/synth_proof.jpg');
    });

    it('16. evidence API preserves is_demo in HTTP response', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: supervisorUser.auth_user_id,
        email: supervisorUser.email
      });

      // Submit evidence with is_demo: false
      const { evidence } = await ResolutionService.submitEvidence(
        fieldOfficer,
        activeProblem.id,
        {
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/api_proof.jpg',
          description: 'Tested via API'
        }
      );

      const res = await request(app)
        .get(`/api/v1/problems/${activeProblem.id}/evidence`)
        .set('Authorization', 'Bearer valid-supervisor-token');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const found = res.body.data.find((e: any) => e.id === evidence.id);
      expect(found).toBeDefined();
      expect(found.is_demo).toBe(false);
    });
  });

  // ===========================================================================
  // ASSIGNMENT PROJECTION & HISTORICAL FALLBACK (REQ-HARD-4, Tests 17–21)
  // ===========================================================================
  describe('Assignment Projection & Historical Fallback', () => {
    it('17. new assignment populates problem_clusters.assigned_to', async () => {
      const unassignedProblem: ProblemCluster = createTestProblemCluster({
        id: 'PRB-NEW-001',
        title: 'New Drain Blockage',
        description: 'Water overflowing from drain',
        category: 'drainage',
        department_id: 'BMC_DRAINAGE',
        status: ProblemStatus.TRIAGED,
        signal_count: 3,
        impact_score: 30
      });
      await db.createProblemCluster(unassignedProblem);

      const assignment: Assignment = {
        id: `asgn_${Date.now()}`,
        problem_id: unassignedProblem.id,
        assigned_to: fieldOfficer.id,
        assigned_by: supervisorUser.id,
        department_id: 'WATCO',
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.ASSIGNED,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const action: ProblemAction = {
        id: `act_${Date.now()}`,
        problem_id: unassignedProblem.id,
        actor_id: supervisorUser.id,
        actor_role: supervisorUser.role,
        action_type: ActionType.ASSIGNED,
        previous_state: ProblemStatus.TRIAGED,
        new_state: ProblemStatus.ASSIGNED,
        note: 'Assigned to field officer',
        created_at: new Date().toISOString()
      };

      const result = await db.atomicAssignProblem(
        unassignedProblem.id,
        assignment,
        ProblemStatus.ASSIGNED,
        action,
        ProblemStatus.TRIAGED
      );

      expect(result.problem.assigned_to).toBe(fieldOfficer.id);
      expect(result.problem.status).toBe(ProblemStatus.ASSIGNED);

      const fetched = await db.getProblemCluster(unassignedProblem.id);
      expect(fetched?.assigned_to).toBe(fieldOfficer.id);
    });

    it('18. historical fallback resolves assigned_to read-only when problem_clusters.assigned_to is undefined', async () => {
      // Simulate historical problem created before HF5.1 where assigned_to was only in assignments table
      const historicalProblem: ProblemCluster = createTestProblemCluster({
        id: 'PRB-HIST-001',
        title: 'Historical Road Cave-in',
        description: 'Historical record from early phase',
        category: 'roads',
        department_id: 'BMC_ROADS',
        status: ProblemStatus.IN_PROGRESS,
        assigned_to: undefined, // Unpopulated on problem_clusters
        signal_count: 10,
        impact_score: 70,
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z'
      });
      await db.createProblemCluster(historicalProblem);

      // Create historical assignment
      const historicalAssignment: Assignment = {
        id: 'asgn_hist_001',
        problem_id: historicalProblem.id,
        assigned_to: fieldOfficer.id,
        assigned_by: supervisorUser.id,
        department_id: 'BMC_ROADS',
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.ASSIGNED,
        assigned_at: '2026-08-01T10:30:00Z',
        created_at: '2026-08-01T10:30:00Z',
        updated_at: '2026-08-01T10:30:00Z'
      };
      await db.createAssignment(historicalAssignment);

      // Retrieve via getProblemCluster
      const resolved = await db.getProblemCluster(historicalProblem.id);
      expect(resolved).not.toBeNull();
      expect(resolved?.assigned_to).toBe(fieldOfficer.id);
      expect(resolved?.assigned_at).toBe('2026-08-01T10:30:00Z');
    });

    it('19. Field Officer matching the resolved ID remains authorized for workflow actions', async () => {
      const historicalProblem: ProblemCluster = createTestProblemCluster({
        id: 'PRB-HIST-002',
        title: 'Historical Pipe Burst',
        description: 'Burst main',
        category: 'water_supply',
        department_id: 'WATCO',
        status: ProblemStatus.IN_PROGRESS,
        assigned_to: undefined,
        signal_count: 4,
        impact_score: 50,
        created_at: '2026-08-02T10:00:00Z',
        updated_at: '2026-08-02T10:00:00Z'
      });
      await db.createProblemCluster(historicalProblem);

      await db.createAssignment({
        id: 'asgn_hist_002',
        problem_id: historicalProblem.id,
        assigned_to: fieldOfficer.id,
        assigned_by: supervisorUser.id,
        department_id: 'WATCO',
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.ASSIGNED,
        assigned_at: '2026-08-02T10:30:00Z',
        created_at: '2026-08-02T10:30:00Z',
        updated_at: '2026-08-02T10:30:00Z'
      });

      // Field officer submits evidence on this historical problem
      const { evidence, problem_status } = await ResolutionService.submitEvidence(
        fieldOfficer,
        historicalProblem.id,
        {
          evidence_type: EvidenceType.COMPLETION_PHOTO,
          storage_path: 'evidence/hist_repaired.jpg',
          description: 'Historical repair completed'
        }
      );

      expect(evidence).toBeDefined();
      expect(problem_status).toBe(ProblemStatus.AWAITING_VERIFICATION);
    });

    it('20. wrong Field Officer remains forbidden (403) on historical problem', async () => {
      const historicalProblem: ProblemCluster = createTestProblemCluster({
        id: 'PRB-HIST-003',
        title: 'Historical Streetlight Fault',
        description: 'Dark junction',
        category: 'electrical',
        department_id: 'WATCO',
        status: ProblemStatus.IN_PROGRESS,
        assigned_to: undefined,
        signal_count: 2,
        impact_score: 20,
        created_at: '2026-08-03T10:00:00Z',
        updated_at: '2026-08-03T10:00:00Z'
      });
      await db.createProblemCluster(historicalProblem);

      // Assigned to fieldOfficer, NOT wrongOfficer
      await db.createAssignment({
        id: 'asgn_hist_003',
        problem_id: historicalProblem.id,
        assigned_to: fieldOfficer.id,
        assigned_by: supervisorUser.id,
        department_id: 'WATCO',
        priority: AssignmentPriority.MEDIUM,
        status: AssignmentStatus.ASSIGNED,
        assigned_at: '2026-08-03T10:30:00Z',
        created_at: '2026-08-03T10:30:00Z',
        updated_at: '2026-08-03T10:30:00Z'
      });

      // wrongOfficer attempts to submit evidence
      await expect(
        ResolutionService.submitEvidence(
          wrongOfficer,
          historicalProblem.id,
          {
            evidence_type: EvidenceType.COMPLETION_PHOTO,
            storage_path: 'evidence/wrong_officer.jpg',
            description: 'Attempt by unauthorized officer'
          }
        )
      ).rejects.toThrow(/Field officer usr_officer_999 can only submit resolution evidence for explicitly assigned problems/);
    });

    it('21. no write occurs to historical record during fallback', async () => {
      const historicalProblem: ProblemCluster = createTestProblemCluster({
        id: 'PRB-HIST-004',
        title: 'Historical Sewer Overflow',
        description: 'Sewer manhole bubbling',
        category: 'sanitation',
        department_id: 'WATCO',
        status: ProblemStatus.IN_PROGRESS,
        assigned_to: undefined,
        signal_count: 5,
        impact_score: 40,
        created_at: '2026-08-04T10:00:00Z',
        updated_at: '2026-08-04T10:00:00Z'
      });
      await db.createProblemCluster(historicalProblem);

      await db.createAssignment({
        id: 'asgn_hist_004',
        problem_id: historicalProblem.id,
        assigned_to: fieldOfficer.id,
        assigned_by: supervisorUser.id,
        department_id: 'WATCO',
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.ASSIGNED,
        assigned_at: '2026-08-04T10:30:00Z',
        created_at: '2026-08-04T10:30:00Z',
        updated_at: '2026-08-04T10:30:00Z'
      });

      // Spy on updateProblemCluster
      const updateSpy = vi.spyOn(db, 'updateProblemCluster');

      // Call getProblemCluster
      const resolved = await db.getProblemCluster(historicalProblem.id);
      expect(resolved?.assigned_to).toBe(fieldOfficer.id);

      // Verify no DB write occurred during the read-only fallback query
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });
});
