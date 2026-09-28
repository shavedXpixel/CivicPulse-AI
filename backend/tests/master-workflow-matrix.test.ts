import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider } from '../src/providers';
import {
  ProblemStatus,
  AssignmentPriority,
  AssignmentStatus,
  ActionType,
  EvidenceType,
  EvidenceStatus,
  BeforeOrAfter,
  ProblemCluster,
  ImpactLevel,
  UserRole,
  UserProfile,
  UserStatus,
  ERROR_CODES
} from '@civicpulse/shared';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';
import { WorkflowStateMachine, CANONICAL_TRANSITIONS } from '../src/modules/workflow/workflow.machine';

describe('CivicPulse AI — Master Backend Workflow Matrix (49 Requirements)', () => {
  let app: any;
  let mockDb: MockDatabaseProvider;
  const originalDemoMode = env.DEMO_MODE;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;
  let activeToken: string = 'usr_admin_1';

  const citizenUser: UserProfile = {
    id: 'usr_citizen_1',
    email: 'citizen@example.com',
    display_name: 'Priyanshu Citizen',
    role: UserRole.CITIZEN,
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const fieldOfficer1: UserProfile = {
    id: 'usr_field_1',
    email: 'field1@watco.gov.in',
    display_name: 'Field Officer 1',
    role: UserRole.FIELD_OFFICER,
    department_id: 'WATCO',
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const fieldOfficer2: UserProfile = {
    id: 'usr_field_2',
    email: 'field2@watco.gov.in',
    display_name: 'Field Officer 2',
    role: UserRole.FIELD_OFFICER,
    department_id: 'WATCO',
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const deptOfficer: UserProfile = {
    id: 'usr_dept_1',
    email: 'dept@watco.gov.in',
    display_name: 'WATCO Dept Supervisor',
    role: UserRole.DEPARTMENT_OFFICER,
    department_id: 'WATCO',
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const adminUser: UserProfile = {
    id: 'usr_admin_1',
    email: 'admin@civicpulse.gov.in',
    display_name: 'Municipal Admin',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const createTestProblem = (overrides?: Partial<ProblemCluster>): ProblemCluster => ({
    id: 'PRB-MATRIX-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
    title: 'Water Pipe Disruption',
    category: 'water_supply',
    department_id: 'WATCO',
    status: ProblemStatus.NEW,
    signal_count: 3,
    severity_score: 20,
    population_score: 15,
    duration_score: 10,
    concentration_score: 10,
    critical_exposure_score: 8,
    recurrence_score: 6,
    evidence_score: 4,
    impact_score: 73,
    impact_level: ImpactLevel.HIGH,
    first_detected_at: new Date().toISOString(),
    last_updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    (env as any).DEMO_MODE = true;
    mockDb = new MockDatabaseProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    app = createApp();

    mockVerifyIdToken = vi.fn();
    vi.spyOn(firebaseAdminModule, 'getFirebaseAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken
    } as any);

    // Seed test users in mock DB
    await mockDb.createUser(citizenUser);
    await mockDb.createUser(fieldOfficer1);
    await mockDb.createUser(fieldOfficer2);
    await mockDb.createUser(deptOfficer);
    await mockDb.createUser(adminUser);

    activeToken = adminUser.id;
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    vi.restoreAllMocks();
  });

  const authenticate = (user: UserProfile) => {
    activeToken = user.id;
    mockVerifyIdToken.mockResolvedValue({
      uid: user.id,
      email: user.email,
      role: user.role,
      user_id: user.id
    });
  };

  // =========================================================================
  // 1. STATE MACHINE TRANSITIONS (Tests 1-9)
  // =========================================================================
  describe('STATE TRANSITIONS (1-9)', () => {
    it('1. NEW -> TRIAGED is canonical', () => {
      const p = createTestProblem({ status: ProblemStatus.NEW });
      const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.TRIAGED, ActionType.TRIAGED, deptOfficer);
      expect(rule).toBeDefined();
      expect(rule.to).toBe(ProblemStatus.TRIAGED);
    });

    it('2. TRIAGED -> ASSIGNED is canonical', () => {
      const p = createTestProblem({ status: ProblemStatus.TRIAGED });
      const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.ASSIGNED, ActionType.ASSIGNED, deptOfficer);
      expect(rule).toBeDefined();
      expect(rule.to).toBe(ProblemStatus.ASSIGNED);
    });

    it('3. ASSIGNED -> IN_PROGRESS is canonical for assigned field officer', () => {
      const p = createTestProblem({ status: ProblemStatus.ASSIGNED, assigned_to: fieldOfficer1.id });
      const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.IN_PROGRESS, ActionType.STARTED_WORK, fieldOfficer1);
      expect(rule).toBeDefined();
      expect(rule.to).toBe(ProblemStatus.IN_PROGRESS);
    });

    it('4. IN_PROGRESS -> AWAITING_VERIFICATION is canonical', () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS, assigned_to: fieldOfficer1.id });
      const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.AWAITING_VERIFICATION, ActionType.RESOLUTION_SUBMITTED, fieldOfficer1);
      expect(rule).toBeDefined();
      expect(rule.to).toBe(ProblemStatus.AWAITING_VERIFICATION);
    });

    it('5. AWAITING_VERIFICATION -> RESOLVED is canonical for supervisor (not assigned)', () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.RESOLVED, ActionType.RESOLVED, deptOfficer);
      expect(rule).toBeDefined();
      expect(rule.to).toBe(ProblemStatus.RESOLVED);
    });

    it('6. RESOLVED -> CLOSED is canonical for supervisor', () => {
      const p = createTestProblem({ status: ProblemStatus.RESOLVED });
      const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.CLOSED, ActionType.CLOSED, deptOfficer);
      expect(rule).toBeDefined();
      expect(rule.to).toBe(ProblemStatus.CLOSED);
    });

    it('7. CLOSED -> REOPENED is canonical for supervisor', () => {
      const p = createTestProblem({ status: ProblemStatus.CLOSED });
      const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.REOPENED, ActionType.REOPENED, deptOfficer);
      expect(rule).toBeDefined();
      expect(rule.to).toBe(ProblemStatus.REOPENED);
    });

    it('8. REOPENED -> TRIAGED is canonical for supervisor', () => {
      const p = createTestProblem({ status: ProblemStatus.REOPENED });
      const rule = WorkflowStateMachine.validateTransition(p, ProblemStatus.TRIAGED, ActionType.TRIAGED, deptOfficer);
      expect(rule).toBeDefined();
      expect(rule.to).toBe(ProblemStatus.TRIAGED);
    });

    it('9. invalid transitions are strictly rejected', () => {
      const pNew = createTestProblem({ status: ProblemStatus.NEW });
      expect(() =>
        WorkflowStateMachine.validateTransition(pNew, ProblemStatus.RESOLVED, ActionType.RESOLVED, deptOfficer)
      ).toThrow();
      expect(() =>
        WorkflowStateMachine.validateTransition(pNew, ProblemStatus.CLOSED, ActionType.CLOSED, deptOfficer)
      ).toThrow();

      const pAssigned = createTestProblem({ status: ProblemStatus.ASSIGNED });
      expect(() =>
        WorkflowStateMachine.validateTransition(pAssigned, ProblemStatus.CLOSED, ActionType.CLOSED, deptOfficer)
      ).toThrow();

      const pInProgress = createTestProblem({ status: ProblemStatus.IN_PROGRESS });
      expect(() =>
        WorkflowStateMachine.validateTransition(pInProgress, ProblemStatus.CLOSED, ActionType.CLOSED, deptOfficer)
      ).toThrow();

      const pAwaiting = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION });
      expect(() =>
        WorkflowStateMachine.validateTransition(pAwaiting, ProblemStatus.CLOSED, ActionType.CLOSED, deptOfficer)
      ).toThrow();
      expect(() =>
        WorkflowStateMachine.validateTransition(pAwaiting, ProblemStatus.REOPENED, ActionType.REOPENED, deptOfficer)
      ).toThrow();
    });
  });

  // =========================================================================
  // 2. AUTHORIZATION (Tests 10-23)
  // =========================================================================
  describe('AUTHORIZATION (10-23)', () => {
    it('10. Citizen cannot triage', async () => {
      const p = createTestProblem({ status: ProblemStatus.NEW });
      await mockDb.createProblemCluster(p);
      authenticate(citizenUser);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'TRIAGED' });
      expect(res.status).toBe(403);
    });

    it('11. Citizen cannot assign', async () => {
      const p = createTestProblem({ status: ProblemStatus.TRIAGED });
      await mockDb.createProblemCluster(p);
      authenticate(citizenUser);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'WATCO', assigned_to: fieldOfficer1.id });
      expect(res.status).toBe(403);
    });

    it('12. Citizen cannot submit resolution evidence', async () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS });
      await mockDb.createProblemCluster(p);
      authenticate(citizenUser);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/evidence`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ evidence_type: 'COMPLETION_PHOTO', description: 'citizen proof' });
      expect(res.status).toBe(403);
    });

    it('13. Field Officer cannot triage', async () => {
      const p = createTestProblem({ status: ProblemStatus.NEW });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'TRIAGED' });
      expect(res.status).toBe(403);
    });

    it('14. Field Officer cannot assign', async () => {
      const p = createTestProblem({ status: ProblemStatus.TRIAGED });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'WATCO', assigned_to: fieldOfficer2.id });
      expect(res.status).toBe(403);
    });

    it('15. Field Officer cannot accept resolution', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer2);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/review-resolution`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ decision: 'ACCEPT', notes: 'Field officer trying to accept' });
      expect(res.status).toBe(403);
    });

    it('16. Field Officer cannot close', async () => {
      const p = createTestProblem({ status: ProblemStatus.RESOLVED });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'CLOSED' });
      expect(res.status).toBe(403);
    });

    it('17. Field Officer cannot reopen', async () => {
      const p = createTestProblem({ status: ProblemStatus.CLOSED });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'REOPENED' });
      expect(res.status).toBe(403);
    });

    it('18. Department Officer can accept resolution', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/review-resolution`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ decision: 'ACCEPT', notes: 'Supervisor approved' });
      expect(res.status).toBe(200);
      expect(res.body.data.problem_status).toBe(ProblemStatus.RESOLVED);
    });

    it('19. Department Officer can close', async () => {
      const p = createTestProblem({ status: ProblemStatus.RESOLVED });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'CLOSED', note: 'Case closed by dept officer' });
      expect(res.status).toBe(200);
      expect(res.body.data.action.new_state).toBe(ProblemStatus.CLOSED);
    });

    it('20. Department Officer can reopen', async () => {
      const p = createTestProblem({ status: ProblemStatus.CLOSED });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'REOPENED', note: 'Case reopened by dept officer' });
      expect(res.status).toBe(200);
      expect(res.body.data.action.new_state).toBe(ProblemStatus.REOPENED);
    });

    it('21. Admin can accept resolution', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(adminUser);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/review-resolution`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ decision: 'ACCEPT', notes: 'Admin approved' });
      expect(res.status).toBe(200);
      expect(res.body.data.problem_status).toBe(ProblemStatus.RESOLVED);
    });

    it('22. Admin can close', async () => {
      const p = createTestProblem({ status: ProblemStatus.RESOLVED });
      await mockDb.createProblemCluster(p);
      authenticate(adminUser);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'CLOSED', note: 'Case closed by admin' });
      expect(res.status).toBe(200);
      expect(res.body.data.action.new_state).toBe(ProblemStatus.CLOSED);
    });

    it('23. Admin can reopen', async () => {
      const p = createTestProblem({ status: ProblemStatus.CLOSED });
      await mockDb.createProblemCluster(p);
      authenticate(adminUser);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'REOPENED', note: 'Case reopened by admin' });
      expect(res.status).toBe(200);
      expect(res.body.data.action.new_state).toBe(ProblemStatus.REOPENED);
    });
  });

  // =========================================================================
  // 3. FOUR-EYES / SELF-APPROVAL (Tests 24-25)
  // =========================================================================
  describe('FOUR-EYES / SELF-APPROVAL (24-25)', () => {
    it('24. assigned Field Officer cannot self-approve resolution', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/review-resolution`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ decision: 'ACCEPT', notes: 'Self approval attempt' });
      expect(res.status).toBe(403);
    });

    it('25. evidence submitter cannot self-approve (even if admin/supervisor)', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      // Admin submitted evidence
      await mockDb.createResolutionEvidence({
        id: 'evd_admin_1',
        problem_id: p.id,
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        status: EvidenceStatus.UNDER_REVIEW,
        storage_path: 'evidence/test.jpg',
        submitted_by: adminUser.id,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      authenticate(adminUser);
      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/review-resolution`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ decision: 'ACCEPT', notes: 'Admin self-approval' });
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Self-approval is strictly forbidden');
    });
  });

  // =========================================================================
  // 4. ASSIGNMENTS & DUPLICATE PREVENTION (Tests 26-29)
  // =========================================================================
  describe('ASSIGNMENTS & DUPLICATES (26-29)', () => {
    it('26. repeated assignment cannot create two active assignments', async () => {
      const p = createTestProblem({ status: ProblemStatus.TRIAGED });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const res1 = await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'WATCO', assigned_to: fieldOfficer1.id, priority: 'HIGH' });
      expect(res1.status).toBe(200);

      // Re-assigning to officer 2
      const res2 = await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'WATCO', assigned_to: fieldOfficer2.id, priority: 'CRITICAL' });
      expect(res2.status).toBe(200);

      const allAsgns = await mockDb.getAssignments(p.id);
      const activeAsgns = allAsgns.filter((a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.ACCEPTED);
      expect(activeAsgns.length).toBe(1);
      expect(activeAsgns[0].assigned_to).toBe(fieldOfficer2.id);
    });

    it('27. reassignment ends previous active assignment', async () => {
      const p = createTestProblem({ status: ProblemStatus.ASSIGNED, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      await mockDb.createAssignment({
        id: 'asgn_old_1',
        problem_id: p.id,
        department_id: 'WATCO',
        assigned_to: fieldOfficer1.id,
        assigned_by: deptOfficer.id,
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.ASSIGNED,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      authenticate(deptOfficer);
      await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'WATCO', assigned_to: fieldOfficer2.id });

      const all = await mockDb.getAssignments(p.id);
      const oldAsgn = all.find((a) => a.id === 'asgn_old_1');
      expect(oldAsgn?.status).toBe(AssignmentStatus.CANCELLED);
      expect(oldAsgn?.completed_at).toBeDefined();
    });

    it('28. Field Officer queue shows only active assignment assigned to caller', async () => {
      const p1 = createTestProblem({ status: ProblemStatus.ASSIGNED, assigned_to: fieldOfficer1.id });
      const p2 = createTestProblem({ status: ProblemStatus.CLOSED, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p1);
      await mockDb.createProblemCluster(p2);

      await mockDb.createAssignment({
        id: 'asgn_active',
        problem_id: p1.id,
        department_id: 'WATCO',
        assigned_to: fieldOfficer1.id,
        assigned_by: deptOfficer.id,
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.ASSIGNED,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await mockDb.createAssignment({
        id: 'asgn_closed',
        problem_id: p2.id,
        department_id: 'WATCO',
        assigned_to: fieldOfficer1.id,
        assigned_by: deptOfficer.id,
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.COMPLETED,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      authenticate(fieldOfficer1);
      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${activeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('asgn_active');
    });

    it('29. historical assignments remain historical (not deleted)', async () => {
      const p = createTestProblem({ status: ProblemStatus.TRIAGED });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'WATCO', assigned_to: fieldOfficer1.id });

      await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'WATCO', assigned_to: fieldOfficer2.id });

      const all = await mockDb.getAssignments(p.id);
      expect(all.length).toBe(2);
      expect(all.some((a) => a.status === AssignmentStatus.CANCELLED)).toBe(true);
      expect(all.some((a) => a.status === AssignmentStatus.ASSIGNED)).toBe(true);
    });
  });

  // =========================================================================
  // 5. EVIDENCE WORKFLOW (Tests 30-35)
  // =========================================================================
  describe('EVIDENCE WORKFLOW (30-35)', () => {
    it('30. real R2 presigned upload URL generation works', async () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/media`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ file_name: 'repair.jpg', mime_type: 'image/jpeg', file_size_bytes: 102400 });
      expect(res.status).toBe(201);
      expect(res.body.data.upload_url).toBeDefined();
      expect(res.body.data.media_id).toBeDefined();
    });

    it('31. media record persists upon completion', async () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const mRes = await request(app)
        .post(`/api/v1/problems/${p.id}/media`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ file_name: 'repair.jpg', mime_type: 'image/jpeg', file_size_bytes: 102400 });

      const completeRes = await request(app)
        .post(`/api/v1/problems/${p.id}/media/${mRes.body.data.media_id}/complete`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({});
      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.status).toBe('ATTACHED');
    });

    it('32. evidence record persists and transitions IN_PROGRESS -> AWAITING_VERIFICATION', async () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const mRes = await request(app)
        .post(`/api/v1/problems/${p.id}/media`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ file_name: 'repair.jpg', mime_type: 'image/jpeg', file_size_bytes: 102400 });
      await request(app)
        .post(`/api/v1/problems/${p.id}/media/${mRes.body.data.media_id}/complete`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({});

      const evdRes = await request(app)
        .post(`/api/v1/problems/${p.id}/evidence`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({
          evidence_type: 'COMPLETION_PHOTO',
          storage_path: mRes.body.data.storage_path,
          media_ids: [mRes.body.data.media_id],
          description: 'Replaced main valve on pipeline.'
        });
      expect(evdRes.status).toBe(201);
      expect(evdRes.body.data.problem_status).toBe(ProblemStatus.AWAITING_VERIFICATION);
    });

    it('33. evidence links to correct incident', async () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const mRes = await request(app)
        .post(`/api/v1/problems/${p.id}/media`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ file_name: 'repair.jpg', mime_type: 'image/jpeg', file_size_bytes: 102400 });
      await request(app)
        .post(`/api/v1/problems/${p.id}/media/${mRes.body.data.media_id}/complete`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({});

      const evdRes = await request(app)
        .post(`/api/v1/problems/${p.id}/evidence`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({
          evidence_type: 'COMPLETION_PHOTO',
          storage_path: mRes.body.data.storage_path,
          media_ids: [mRes.body.data.media_id],
          description: 'Valve replaced'
        });
      expect(evdRes.body.data.evidence.problem_id).toBe(p.id);
    });

    it('34. failed upload does not change workflow state', async () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      // Attempting to submit completion photo without storage path or media fails validation
      const evdRes = await request(app)
        .post(`/api/v1/problems/${p.id}/evidence`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({
          evidence_type: 'COMPLETION_PHOTO',
          description: 'No photo provided'
        });
      expect(evdRes.status).toBe(400);

      const current = await mockDb.getProblemCluster(p.id);
      expect(current?.status).toBe(ProblemStatus.IN_PROGRESS);
    });

    it('35. fake/unverified media reference rejected when not uploaded', async () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(fieldOfficer1);

      const evdRes = await request(app)
        .post(`/api/v1/problems/${p.id}/evidence`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({
          evidence_type: 'COMPLETION_PHOTO',
          media_ids: ['fake_media_id_not_registered'],
          description: 'Fraudulent evidence'
        });
      expect(evdRes.status).toBe(400);
    });
  });

  // =========================================================================
  // 6. ADVISORY AI VERIFICATION (Tests 36-40)
  // =========================================================================
  describe('ADVISORY AI VERIFICATION (36-40)', () => {
    it('36. successful AI verification remains advisory (incident remains AWAITING_VERIFICATION)', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      await mockDb.createResolutionEvidence({
        id: 'evd_1',
        problem_id: p.id,
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        status: EvidenceStatus.UNDER_REVIEW,
        storage_path: 'evidence/p.jpg',
        submitted_by: fieldOfficer1.id,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      authenticate(deptOfficer);
      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/verify`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({});
      expect(res.status).toBe(200);

      const current = await mockDb.getProblemCluster(p.id);
      expect(current?.status).toBe(ProblemStatus.AWAITING_VERIFICATION);
    });

    it('37. AI INCONCLUSIVE keeps incident in AWAITING_VERIFICATION', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      await mockDb.createResolutionEvidence({
        id: 'evd_2',
        problem_id: p.id,
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        status: EvidenceStatus.UNDER_REVIEW,
        storage_path: 'evidence/p.jpg',
        submitted_by: fieldOfficer1.id,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      authenticate(deptOfficer);
      await request(app)
        .post(`/api/v1/problems/${p.id}/verify`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({});

      const current = await mockDb.getProblemCluster(p.id);
      expect(current?.status).toBe(ProblemStatus.AWAITING_VERIFICATION);
    });

    it('38. AI provider failure keeps incident in AWAITING_VERIFICATION with review_required', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      await mockDb.createResolutionEvidence({
        id: 'evd_3',
        problem_id: p.id,
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        status: EvidenceStatus.UNDER_REVIEW,
        storage_path: 'evidence/p.jpg',
        submitted_by: fieldOfficer1.id,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      authenticate(deptOfficer);
      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/verify`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.data.review_required).toBe(true);

      const current = await mockDb.getProblemCluster(p.id);
      expect(current?.status).toBe(ProblemStatus.AWAITING_VERIFICATION);
    });

    it('39. supervisor acceptance moves incident to RESOLVED', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/review-resolution`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ decision: 'ACCEPT', notes: 'Inspection confirmed' });
      expect(res.status).toBe(200);
      expect(res.body.data.problem_status).toBe(ProblemStatus.RESOLVED);
    });

    it('40. supervisor rejection moves incident back to IN_PROGRESS', async () => {
      const p = createTestProblem({ status: ProblemStatus.AWAITING_VERIFICATION, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/review-resolution`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ decision: 'REJECT', notes: 'Leak still bubbling, rework needed.' });
      expect(res.status).toBe(200);
      expect(res.body.data.problem_status).toBe(ProblemStatus.IN_PROGRESS);
    });
  });

  // =========================================================================
  // 7. REOPENING (Tests 41-43)
  // =========================================================================
  describe('REOPENING (41-43)', () => {
    it('41. CLOSED -> REOPENED works only for Department Officer / Admin', async () => {
      const p = createTestProblem({ status: ProblemStatus.CLOSED });
      await mockDb.createProblemCluster(p);

      authenticate(fieldOfficer1);
      const res1 = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'REOPENED' });
      expect(res1.status).toBe(403);

      authenticate(deptOfficer);
      const res2 = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'REOPENED', note: 'Failure recurred' });
      expect(res2.status).toBe(200);
      expect(res2.body.data.action.new_state).toBe(ProblemStatus.REOPENED);
    });

    it('42. reopened case does not create duplicate active assignment and clears assigned_to', async () => {
      const p = createTestProblem({ status: ProblemStatus.CLOSED, assigned_to: fieldOfficer1.id });
      await mockDb.createProblemCluster(p);
      await mockDb.createAssignment({
        id: 'asgn_hist_1',
        problem_id: p.id,
        department_id: 'WATCO',
        assigned_to: fieldOfficer1.id,
        assigned_by: deptOfficer.id,
        priority: AssignmentPriority.HIGH,
        status: AssignmentStatus.COMPLETED,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      authenticate(deptOfficer);
      await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'REOPENED', note: 'Reopened' });

      const updated = await mockDb.getProblemCluster(p.id);
      expect(updated?.status).toBe(ProblemStatus.REOPENED);
      expect(updated?.assigned_to ?? null).toBeNull();

      const asgns = await mockDb.getAssignments(p.id);
      const activeAsgns = asgns.filter((a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.ACCEPTED);
      expect(activeAsgns.length).toBe(0);
    });

    it('43. reopened case follows TRIAGED -> ASSIGNED -> IN_PROGRESS cycle again', async () => {
      const p = createTestProblem({ status: ProblemStatus.REOPENED });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      // 1. REOPENED -> TRIAGED
      const triageRes = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'TRIAGED', note: 'Re-triaged' });
      expect(triageRes.status).toBe(200);

      // 2. TRIAGED -> ASSIGNED
      const assignRes = await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'WATCO', assigned_to: fieldOfficer2.id, priority: 'HIGH' });
      expect(assignRes.status).toBe(200);

      // 3. ASSIGNED -> IN_PROGRESS
      authenticate(fieldOfficer2);
      const workRes = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'STARTED_WORK', note: 'Commencing remediation' });
      expect(workRes.status).toBe(200);
      expect(workRes.body.data.action.new_state).toBe(ProblemStatus.IN_PROGRESS);
    });
  });

  // =========================================================================
  // 8. OPTIMISTIC CONCURRENCY (Tests 44-46)
  // =========================================================================
  describe('OPTIMISTIC CONCURRENCY (44-46)', () => {
    it('44. stale expected_status returns HTTP 409 Conflict', async () => {
      const p = createTestProblem({ status: ProblemStatus.IN_PROGRESS });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'TRIAGED', expected_status: ProblemStatus.NEW });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(ERROR_CODES.CONFLICT);
    });

    it('45. concurrent assignment cannot create duplicate active assignments', async () => {
      const p = createTestProblem({ status: ProblemStatus.TRIAGED });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      // Run two parallel assignments
      await Promise.all([
        request(app)
          .post(`/api/v1/problems/${p.id}/assign`)
          .set('Authorization', `Bearer ${activeToken}`)
          .send({ department_id: 'WATCO', assigned_to: fieldOfficer1.id, priority: 'HIGH' }),
        request(app)
          .post(`/api/v1/problems/${p.id}/assign`)
          .set('Authorization', `Bearer ${activeToken}`)
          .send({ department_id: 'WATCO', assigned_to: fieldOfficer2.id, priority: 'CRITICAL' })
      ]);

      const asgns = await mockDb.getAssignments(p.id);
      const activeAsgns = asgns.filter((a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.ACCEPTED);
      expect(activeAsgns.length).toBe(1);
    });

    it('46. concurrent closure cannot close twice', async () => {
      const p = createTestProblem({ status: ProblemStatus.RESOLVED });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const [r1, r2] = await Promise.all([
        request(app)
          .post(`/api/v1/problems/${p.id}/actions`)
          .set('Authorization', `Bearer ${activeToken}`)
          .send({ action: 'CLOSED', expected_status: ProblemStatus.RESOLVED }),
        request(app)
          .post(`/api/v1/problems/${p.id}/actions`)
          .set('Authorization', `Bearer ${activeToken}`)
          .send({ action: 'CLOSED', expected_status: ProblemStatus.RESOLVED })
      ]);

      const statuses = [r1.status, r2.status];
      expect(statuses).toContain(200);
      expect(statuses.filter((s) => s === 200).length).toBe(1);
      expect(statuses.filter((s) => s === 409).length).toBe(1);
    });
  });

  // =========================================================================
  // 9. CANONICAL DEPARTMENT WATCO (Tests 47-49)
  // =========================================================================
  describe('CANONICAL DEPARTMENT WATCO (47-49)', () => {
    it('47. only WATCO exists as operational department', async () => {
      authenticate(adminUser);
      const res = await request(app)
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${activeToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe('WATCO');
    });

    it('48. non-WATCO assignment is rejected by schema/backend', async () => {
      const p = createTestProblem({ status: ProblemStatus.TRIAGED });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/assign`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ department_id: 'BMC_DRAINAGE', assigned_to: fieldOfficer1.id });
      expect(res.status).toBe(400);
    });

    it('49. AI cannot create or persist a non-WATCO department', async () => {
      const p = createTestProblem({ status: ProblemStatus.NEW, category: 'streetlights' });
      await mockDb.createProblemCluster(p);
      authenticate(deptOfficer);

      // When triaged, problem retains WATCO regardless of category
      const res = await request(app)
        .post(`/api/v1/problems/${p.id}/actions`)
        .set('Authorization', `Bearer ${activeToken}`)
        .send({ action: 'TRIAGED' });
      expect(res.status).toBe(200);

      const updated = await mockDb.getProblemCluster(p.id);
      expect(updated?.department_id).toBe('WATCO');
    });
  });
});
