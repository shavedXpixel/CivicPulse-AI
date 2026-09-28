import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import { ProviderContainer, MockDatabaseProvider, MockAIProvider } from '../src/providers';
import {
  ProblemStatus,
  UserRole,
  UserStatus,
  UserProfile,
  ProblemCluster,
  Signal,
  SignalStatus,
  SignalProcessingStatus,
  ImpactLevel,
  ActionType
} from '@civicpulse/shared';
import { ClusteringService } from '../src/modules/clustering/clustering.service';
import { ProblemService } from '../src/modules/problems/problem.service';

describe('Cluster Correlation & Citizen Lifecycle Invariants', () => {
  let app: Express;
  let mockDb: MockDatabaseProvider;
  let mockAI: MockAIProvider;
  let clusteringService: ClusteringService;
  let problemService: ProblemService;

  const CITIZEN_ID = 'usr_citizen_test';
  const DEPT_OFFICER_ID = 'usr_dept_officer_test';
  const FIELD_OFFICER_ID = 'usr_field_officer_test';
  const DEPT_ID = 'WATCO';

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    mockDb = new MockDatabaseProvider();
    mockDb.problemClusters.clear();
    mockDb.signals.clear();
    mockDb.problemClusterMembers.clear();
    mockAI = new MockAIProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    ProviderContainer.setAIProvider(mockAI);

    clusteringService = new ClusteringService();
    problemService = new ProblemService();

    // Register test users
    const citizen: UserProfile = {
      id: CITIZEN_ID,
      email: 'citizen@test.gov.in',
      display_name: 'Test Citizen',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createUser(citizen);

    const deptOfficer: UserProfile = {
      id: DEPT_OFFICER_ID,
      email: 'officer@watco.odisha.gov.in',
      display_name: 'WATCO Supervisor',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: DEPT_ID,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createUser(deptOfficer);

    const fieldOfficer: UserProfile = {
      id: FIELD_OFFICER_ID,
      email: 'field@watco.odisha.gov.in',
      display_name: 'WATCO Field Worker',
      role: UserRole.FIELD_OFFICER,
      department_id: DEPT_ID,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createUser(fieldOfficer);
  });

  // =========================================================================
  // A. Fresh submission: creates cluster in NEW state & appears in WATCO queue
  // =========================================================================
  describe('A. Fresh submission lifecycle', () => {
    it('creates a problem cluster in status NEW and makes it visible in Department Officer queue', async () => {
      const signal: Signal = {
        id: 'sig_fresh_01',
        citizen_id: CITIZEN_ID,
        original_text: 'Major water pipe break on Janpath Road',
        category: 'water_supply',
        ward_id: 'WARD-012',
        location: { lat: 20.2961, lng: 85.8245 },
        status: SignalStatus.ACTIVE,
        processing_status: SignalProcessingStatus.COMPLETED,
        created_at: new Date().toISOString(),
        submitted_at: new Date().toISOString()
      };
      await mockDb.createSignal(signal);

      const clusterResult = await clusteringService.clusterSignal(signal.id, { autoCreate: true });

      expect(clusterResult.matched).toBe(true);
      expect(clusterResult.isNewCluster).toBe(true);
      expect(clusterResult.problem).toBeDefined();
      expect([ProblemStatus.NEW, ProblemStatus.TRIAGED]).toContain(clusterResult.problem!.status);
      expect(clusterResult.problem!.status).not.toBe(ProblemStatus.RESOLVED);
      expect(clusterResult.problem!.status).not.toBe(ProblemStatus.CLOSED);
      expect(clusterResult.problem!.department_id).toBe('WATCO');

      // Check Department Officer problem list
      const deptProblems = await problemService.listProblems(
        await mockDb.getUser(DEPT_OFFICER_ID) as UserProfile,
        { department_id: 'WATCO' }
      );
      const found = deptProblems.data.find((p) => p.id === clusterResult.problem!.id);
      expect(found).toBeDefined();
      expect([ProblemStatus.NEW, ProblemStatus.TRIAGED]).toContain(found!.status);

      // Check citizen signal query
      const citizenSignals = await mockDb.listSignals({ citizen_id: CITIZEN_ID });
      const citizenSig = citizenSignals.data.find((s) => s.id === signal.id);
      expect(citizenSig).toBeDefined();
      expect([ProblemStatus.NEW, ProblemStatus.TRIAGED]).toContain(citizenSig!.problem_status);
      expect(citizenSig!.problem_status).not.toBe(ProblemStatus.RESOLVED);
      expect(citizenSig!.problem_status).not.toBe(ProblemStatus.CLOSED);
    });
  });

  // =========================================================================
  // B & C. Fresh signal when prior RESOLVED / CLOSED cluster exists
  // =========================================================================
  describe('B & C. Non-correlation into completed clusters (RESOLVED and CLOSED)', () => {
    it('does NOT correlate new signal into an existing RESOLVED cluster even if similarity is high', async () => {
      // 1. Establish an older RESOLVED cluster in WATCO / WARD-012
      const resolvedCluster: ProblemCluster = {
        id: 'PRB-2026-OLD-RESOLVED',
        title: 'Water Pipe Leakage at Janpath',
        description: 'Broken water line resolved yesterday',
        category: 'water_supply',
        department_id: 'WATCO',
        ward_id: 'WARD-012',
        location: { lat: 20.2961, lng: 85.8245 },
        status: ProblemStatus.RESOLVED,
        signal_count: 3,
        severity_score: 15,
        population_score: 10,
        duration_score: 5,
        concentration_score: 3,
        critical_exposure_score: 0,
        recurrence_score: 5,
        evidence_score: 3,
        impact_score: 41,
        impact_level: ImpactLevel.MEDIUM,
        resolved_at: new Date(Date.now() - 3600000).toISOString(),
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString()
      };
      await mockDb.createProblemCluster(resolvedCluster);

      // 2. Submit a brand-new signal today with the same water_supply category and ward
      const freshSignal: Signal = {
        id: 'sig_fresh_after_resolved',
        citizen_id: CITIZEN_ID,
        original_text: 'Fresh water leak sprouting on Janpath Road today',
        category: 'water_supply',
        ward_id: 'WARD-012',
        location: { lat: 20.2961, lng: 85.8245 },
        status: SignalStatus.ACTIVE,
        processing_status: SignalProcessingStatus.COMPLETED,
        created_at: new Date().toISOString(),
        submitted_at: new Date().toISOString()
      };
      await mockDb.createSignal(freshSignal);

      // 3. Cluster signal
      const result = await clusteringService.clusterSignal(freshSignal.id, { autoCreate: true });

      // Must NOT be attached to the resolved cluster
      expect(result.problem!.id).not.toBe('PRB-2026-OLD-RESOLVED');
      expect(result.isNewCluster).toBe(true);
      expect([ProblemStatus.NEW, ProblemStatus.TRIAGED]).toContain(result.problem!.status);
      expect(result.problem!.status).not.toBe(ProblemStatus.RESOLVED);
      expect(result.problem!.status).not.toBe(ProblemStatus.CLOSED);

      // The old resolved cluster must remain completely untouched
      const oldCluster = await mockDb.getProblemCluster('PRB-2026-OLD-RESOLVED');
      expect(oldCluster!.status).toBe(ProblemStatus.RESOLVED);
      expect(oldCluster!.signal_count).toBe(3);

      // Citizen view of the new signal must NOT show RESOLVED or Work Complete
      const citizenSignals = await mockDb.listSignals({ citizen_id: CITIZEN_ID });
      const queriedSig = citizenSignals.data.find((s) => s.id === freshSignal.id);
      expect([ProblemStatus.NEW, ProblemStatus.TRIAGED]).toContain(queriedSig!.problem_status);
      expect(queriedSig!.problem_status).not.toBe(ProblemStatus.RESOLVED);
    });

    it('does NOT correlate new signal into an existing CLOSED cluster', async () => {
      const closedCluster: ProblemCluster = {
        id: 'PRB-2026-OLD-CLOSED',
        title: 'Closed Drainage Issue',
        description: 'Fixed and closed issue',
        category: 'drainage',
        department_id: 'WATCO',
        ward_id: 'WARD-012',
        location: { lat: 20.2961, lng: 85.8245 },
        status: ProblemStatus.CLOSED,
        signal_count: 2,
        severity_score: 10,
        population_score: 10,
        duration_score: 5,
        concentration_score: 3,
        critical_exposure_score: 0,
        recurrence_score: 5,
        evidence_score: 2,
        impact_score: 35,
        impact_level: ImpactLevel.LOW,
        closed_at: new Date(Date.now() - 3600000).toISOString(),
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString()
      };
      await mockDb.createProblemCluster(closedCluster);

      const freshSignal: Signal = {
        id: 'sig_fresh_after_closed',
        citizen_id: CITIZEN_ID,
        original_text: 'Drainage overflowing again',
        category: 'drainage',
        ward_id: 'WARD-012',
        location: { lat: 20.2961, lng: 85.8245 },
        status: SignalStatus.ACTIVE,
        processing_status: SignalProcessingStatus.COMPLETED,
        created_at: new Date().toISOString(),
        submitted_at: new Date().toISOString()
      };
      await mockDb.createSignal(freshSignal);

      const result = await clusteringService.clusterSignal(freshSignal.id, { autoCreate: true });

      expect(result.problem!.id).not.toBe('PRB-2026-OLD-CLOSED');
      expect(result.isNewCluster).toBe(true);
      expect([ProblemStatus.NEW, ProblemStatus.TRIAGED]).toContain(result.problem!.status);
      expect(result.problem!.status).not.toBe(ProblemStatus.CLOSED);
      expect(result.problem!.status).not.toBe(ProblemStatus.RESOLVED);

      const citizenSignals = await mockDb.listSignals({ citizen_id: CITIZEN_ID });
      const queriedSig = citizenSignals.data.find((s) => s.id === freshSignal.id);
      expect([ProblemStatus.NEW, ProblemStatus.TRIAGED]).toContain(queriedSig!.problem_status);
      expect(queriedSig!.problem_status).not.toBe(ProblemStatus.CLOSED);
    });

    it('defensively prevents post-resolution signal from inheriting RESOLVED if attached to completed cluster', async () => {
      // Historical edge case: signal somehow points to resolved cluster
      const resolvedAt = new Date(Date.now() - 3600000).toISOString();
      const resolvedCluster: ProblemCluster = {
        id: 'PRB-2026-HISTORICAL-RESOLVED',
        title: 'Resolved Water Incident',
        description: 'Fixed and resolved',
        category: 'water_supply',
        department_id: 'WATCO',
        status: ProblemStatus.RESOLVED,
        signal_count: 1,
        severity_score: 10,
        population_score: 10,
        duration_score: 5,
        concentration_score: 3,
        critical_exposure_score: 0,
        recurrence_score: 5,
        evidence_score: 2,
        impact_score: 35,
        impact_level: ImpactLevel.LOW,
        resolved_at: resolvedAt,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: resolvedAt
      };
      await mockDb.createProblemCluster(resolvedCluster);

      // Signal created AFTER resolution
      const lateSignal: Signal = {
        id: 'sig_late_post_resolution',
        citizen_id: CITIZEN_ID,
        problem_cluster_id: 'PRB-2026-HISTORICAL-RESOLVED',
        original_text: 'Still leaking after fix',
        category: 'water_supply',
        status: SignalStatus.ATTACHED_TO_PROBLEM,
        processing_status: SignalProcessingStatus.COMPLETED,
        created_at: new Date().toISOString(),
        submitted_at: new Date().toISOString()
      };
      await mockDb.createSignal(lateSignal);

      const signals = await mockDb.listSignals({ citizen_id: CITIZEN_ID });
      const sig = signals.data.find((s) => s.id === 'sig_late_post_resolution');
      expect(sig).toBeDefined();
      // Must NOT inherit RESOLVED because it was created after cluster was resolved
      expect(sig!.problem_status).toBe(ProblemStatus.NEW);
    });
  });

  // =========================================================================
  // D. Department Officer Triage & Assignment
  // =========================================================================
  describe('D. Department Officer Triage & Assignment', () => {
    it('allows Department Officer to triage NEW problem and then assign Field Officer', async () => {
      const cluster: ProblemCluster = {
        id: 'PRB-2026-TRIAGE-TEST',
        title: 'Water Pipe Burst',
        description: 'Heavy leak',
        category: 'water_supply',
        department_id: 'WATCO',
        status: ProblemStatus.NEW,
        signal_count: 1,
        severity_score: 15,
        population_score: 10,
        duration_score: 5,
        concentration_score: 3,
        critical_exposure_score: 0,
        recurrence_score: 5,
        evidence_score: 2,
        impact_score: 40,
        impact_level: ImpactLevel.MEDIUM,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await mockDb.createProblemCluster(cluster);

      const deptUser = (await mockDb.getUser(DEPT_OFFICER_ID)) as UserProfile;

      // 1. Triage: NEW -> TRIAGED
      const { WorkflowService } = await import('../src/modules/workflow/workflow.service');
      const triageRes = await WorkflowService.recordAction(deptUser, cluster.id, {
        action: ActionType.TRIAGED,
        note: 'Triaged by WATCO control room'
      });
      expect(triageRes.problem!.status).toBe(ProblemStatus.TRIAGED);

      // 2. Assign: TRIAGED -> ASSIGNED
      const assignRes = await WorkflowService.assignProblem(deptUser, cluster.id, {
        department_id: 'WATCO',
        assigned_to: FIELD_OFFICER_ID,
        notes: 'Dispatching field crew'
      });
      expect(assignRes.problem.status).toBe(ProblemStatus.ASSIGNED);
      expect(assignRes.problem.assigned_to).toBe(FIELD_OFFICER_ID);
    });
  });

  // =========================================================================
  // E. Full Citizen Lifecycle Status Verification
  // =========================================================================
  describe('E. Citizen Lifecycle Status Verification', () => {
    it('returns exact expected milestone status descriptions for each state', async () => {
      const deptUser = (await mockDb.getUser(DEPT_OFFICER_ID)) as UserProfile;

      const statusesToTest = [
        {
          status: ProblemStatus.NEW,
          expectCompleted: false,
          expectAction: undefined // NEW does not add operational status milestone
        },
        {
          status: ProblemStatus.TRIAGED,
          expectCompleted: false,
          expectAction: 'Triage Completed'
        },
        {
          status: ProblemStatus.ASSIGNED,
          expectCompleted: false,
          expectAction: 'Work Dispatched'
        },
        {
          status: ProblemStatus.IN_PROGRESS,
          expectCompleted: false,
          expectAction: 'Field Work Underway'
        },
        {
          status: ProblemStatus.AWAITING_VERIFICATION,
          expectCompleted: false,
          expectAction: 'Awaiting Verification'
        },
        {
          status: ProblemStatus.RESOLVED,
          expectCompleted: true,
          expectAction: 'Work Complete'
        },
        {
          status: ProblemStatus.CLOSED,
          expectCompleted: true,
          expectAction: 'Work Complete'
        },
        {
          status: ProblemStatus.REOPENED,
          expectCompleted: false,
          expectAction: 'Incident Reopened'
        }
      ];

      for (const item of statusesToTest) {
        const cluster: ProblemCluster = {
          id: `PRB-2026-STATUS-${item.status}`,
          title: `Testing ${item.status}`,
          description: 'Status verification',
          category: 'water_supply',
          department_id: 'WATCO',
          status: item.status,
          signal_count: 1,
          severity_score: 10,
          population_score: 10,
          duration_score: 5,
          concentration_score: 3,
          critical_exposure_score: 0,
          recurrence_score: 5,
          evidence_score: 2,
          impact_score: 35,
          impact_level: ImpactLevel.LOW,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await mockDb.createProblemCluster(cluster);

        const publicDetails = await problemService.getProblemDetails(deptUser, cluster.id);
        const operationalMilestone = publicDetails.timeline.find((t) => t.id === 'tl_3');

        if (item.expectAction) {
          expect(operationalMilestone).toBeDefined();
          expect(operationalMilestone!.action).toBe(item.expectAction);
          expect(operationalMilestone!.isCompleted).toBe(item.expectCompleted);
        }

        if (item.status === ProblemStatus.AWAITING_VERIFICATION) {
          expect(operationalMilestone!.description).toBe(
            'Work completed by field officer — awaiting verification.'
          );
        } else if (item.status === ProblemStatus.RESOLVED) {
          expect(operationalMilestone!.description).toBe(
            'The department has verified the submitted resolution.'
          );
        } else if (item.status === ProblemStatus.CLOSED) {
          expect(operationalMilestone!.description).toBe(
            'This issue has been completed and closed.'
          );
        }
      }
    });
  });

  // =========================================================================
  // F. Genuine completed incidents preserve Work Complete
  // =========================================================================
  describe('F. Genuine completed incidents preserve Work Complete', () => {
    it('genuinely completed clusters continue returning RESOLVED and CLOSED status', async () => {
      const priorDate = new Date(Date.now() - 7200000).toISOString();
      const resolvedDate = new Date(Date.now() - 3600000).toISOString();

      const genuineResolved: ProblemCluster = {
        id: 'PRB-GENUINE-RESOLVED',
        title: 'Original Resolved Leak',
        description: 'Fixed and verified',
        category: 'water_supply',
        department_id: 'WATCO',
        status: ProblemStatus.RESOLVED,
        signal_count: 1,
        severity_score: 10,
        population_score: 10,
        duration_score: 5,
        concentration_score: 3,
        critical_exposure_score: 0,
        recurrence_score: 5,
        evidence_score: 2,
        impact_score: 35,
        impact_level: ImpactLevel.LOW,
        resolved_at: resolvedDate,
        created_at: priorDate,
        updated_at: resolvedDate
      };
      await mockDb.createProblemCluster(genuineResolved);

      const originalSignal: Signal = {
        id: 'sig_original_genuine',
        citizen_id: CITIZEN_ID,
        problem_cluster_id: 'PRB-GENUINE-RESOLVED',
        original_text: 'Original water report that was resolved',
        category: 'water_supply',
        status: SignalStatus.ATTACHED_TO_PROBLEM,
        processing_status: SignalProcessingStatus.COMPLETED,
        created_at: priorDate,
        submitted_at: priorDate
      };
      await mockDb.createSignal(originalSignal);

      const signals = await mockDb.listSignals({ citizen_id: CITIZEN_ID });
      const sig = signals.data.find((s) => s.id === 'sig_original_genuine');
      expect(sig).toBeDefined();
      expect(sig!.problem_status).toBe(ProblemStatus.RESOLVED);
    });
  });
});
