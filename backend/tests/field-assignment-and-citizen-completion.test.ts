import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import { ProviderContainer, MockDatabaseProvider } from '../src/providers';
import {
  ProblemStatus,
  UserRole,
  UserStatus,
  UserProfile,
  ProblemCluster,
  AssignmentPriority,
  ImpactLevel,
  EvidenceType,
  BeforeOrAfter,
  EvidenceStatus
} from '@civicpulse/shared';
import { PostgresDatabaseProvider } from '../src/providers/database/postgres.provider';
import { ProblemService } from '../src/modules/problems/problem.service';

describe('Field Officer Assignment & Citizen Completion Invariants', () => {
  let app: Express;
  let mockDb: MockDatabaseProvider;

  const CANONICAL_WATCO_FIELD_UUID = '10000000-0000-4000-8000-000000000003';
  const CANONICAL_WATCO_DEPT_UUID = '10000000-0000-4000-8000-000000000002';
  const CANONICAL_ADMIN_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const CANONICAL_DRAINAGE_FIELD_UUID = 'f9e8d7c6-b5a4-4321-9876-543210fedcba';
  const CANONICAL_INACTIVE_FIELD_UUID = '11112222-3333-4444-5555-666677778888';

  const PROBLEM_ID = 'PRB-2026-ASSIGN-TEST';

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    mockDb = new MockDatabaseProvider();
    ProviderContainer.setDatabaseProvider(mockDb);

    // Register test users in MockDatabase
    const watcoFieldOfficer: UserProfile = {
      id: CANONICAL_WATCO_FIELD_UUID,
      email: 'field@example.com',
      display_name: 'Priyanshu Dash (WATCO Field)',
      role: UserRole.FIELD_OFFICER,
      department_id: 'WATCO',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createUser(watcoFieldOfficer);

    const watcoDeptOfficer: UserProfile = {
      id: CANONICAL_WATCO_DEPT_UUID,
      email: 'officer@example.com',
      display_name: 'Priyanshu Dash (WATCO Dept Officer)',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: 'WATCO',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createUser(watcoDeptOfficer);

    const adminUser: UserProfile = {
      id: CANONICAL_ADMIN_UUID,
      email: 'commissioner.admin@bmc.gov.in',
      display_name: 'Municipal Commissioner',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createUser(adminUser);

    const drainageFieldOfficer: UserProfile = {
      id: CANONICAL_DRAINAGE_FIELD_UUID,
      email: 'bikram.drainage@bmc.gov.in',
      display_name: 'Bikram Rout (Drainage Field)',
      role: UserRole.FIELD_OFFICER,
      department_id: 'BMC_DRAINAGE',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createUser(drainageFieldOfficer);

    const inactiveFieldOfficer: UserProfile = {
      id: CANONICAL_INACTIVE_FIELD_UUID,
      email: 'inactive.field@watco.odisha.gov.in',
      display_name: 'Inactive Crew Officer',
      role: UserRole.FIELD_OFFICER,
      department_id: 'WATCO',
      status: UserStatus.SUSPENDED,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createUser(inactiveFieldOfficer);

    // Create standard TRIAGED problem for WATCO
    const testProblem: ProblemCluster = {
      id: PROBLEM_ID,
      title: 'Severed Water Main Pipe on Janpath',
      description: 'Major potable pipeline ruptured affecting 12,000 households',
      category: 'water_supply',
      department_id: 'WATCO',
      ward_id: 'WARD-018',
      status: ProblemStatus.TRIAGED,
      impact_score: 85,
      impact_level: ImpactLevel.HIGH,
      signal_count: 5,
      severity_score: 20,
      population_score: 15,
      duration_score: 12,
      concentration_score: 14,
      critical_exposure_score: 9,
      recurrence_score: 10,
      evidence_score: 5,
      first_detected_at: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    };
    await mockDb.createProblemCluster(testProblem);
  });

  // ===========================================================================
  // SECTION 1: DEPARTMENT OFFICER ASSIGNMENT DROPDOWN RESTRICTIONS
  // ===========================================================================
  describe('1. Department Officer Assignment Dropdown Restrictions', () => {
    it('GET /api/v1/departments/WATCO/officers?role=FIELD_OFFICER returns ONLY FIELD_OFFICER users', async () => {
      const res = await request(app)
        .get('/api/v1/departments/WATCO/officers?role=FIELD_OFFICER&assignable=true')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify every returned user has role = FIELD_OFFICER
      for (const officer of res.body.data) {
        expect(officer.role).toBe(UserRole.FIELD_OFFICER);
        expect(officer.department_id).toBe('WATCO');
      }

      // DEPARTMENT_OFFICER cannot appear
      const deptOfficers = res.body.data.filter((u: any) => u.role === UserRole.DEPARTMENT_OFFICER);
      expect(deptOfficers.length).toBe(0);

      // ADMIN cannot appear
      const admins = res.body.data.filter((u: any) => u.role === UserRole.ADMIN);
      expect(admins.length).toBe(0);

      // Inactive officer cannot appear
      const inactive = res.body.data.filter((u: any) => u.id === CANONICAL_INACTIVE_FIELD_UUID);
      expect(inactive.length).toBe(0);

      // Cross-department officer cannot appear
      const wrongDept = res.body.data.filter((u: any) => u.id === CANONICAL_DRAINAGE_FIELD_UUID);
      expect(wrongDept.length).toBe(0);

      // Contains canonical WATCO field officer
      const canonicalField = res.body.data.find((u: any) => u.id === CANONICAL_WATCO_FIELD_UUID);
      expect(canonicalField).toBeDefined();
    });

    it('Backend rejects assignment to a DEPARTMENT_OFFICER with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${PROBLEM_ID}/assign`)
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: CANONICAL_WATCO_DEPT_UUID, // Trying to assign to department officer
          priority: AssignmentPriority.HIGH
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Only FIELD_OFFICER');
    });

    it('Backend rejects assignment to an ADMIN with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${PROBLEM_ID}/assign`)
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: CANONICAL_ADMIN_UUID, // Trying to assign to admin
          priority: AssignmentPriority.HIGH
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Only FIELD_OFFICER');
    });

    it('Backend rejects assignment to an officer from the wrong department with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${PROBLEM_ID}/assign`)
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: CANONICAL_DRAINAGE_FIELD_UUID, // Drainage field officer assigned to WATCO problem
          priority: AssignmentPriority.HIGH
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('belongs to department');
    });

    it('Backend rejects assignment to an inactive officer with 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${PROBLEM_ID}/assign`)
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: CANONICAL_INACTIVE_FIELD_UUID, // Inactive officer
          priority: AssignmentPriority.HIGH
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('account status is');
    });

    it('Backend rejects assignment to a non-existent officer with 404 NOT_FOUND', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${PROBLEM_ID}/assign`)
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: '00000000-0000-0000-0000-000000000000',
          priority: AssignmentPriority.HIGH
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('Backend successfully assigns valid active WATCO FIELD_OFFICER and records canonical UUID', async () => {
      const res = await request(app)
        .post(`/api/v1/problems/${PROBLEM_ID}/assign`)
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: CANONICAL_WATCO_FIELD_UUID,
          priority: AssignmentPriority.HIGH,
          notes: 'Emergency excavation dispatch'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.status).toBe(ProblemStatus.ASSIGNED);
      expect(res.body.data.problem.assigned_to).toBe(CANONICAL_WATCO_FIELD_UUID);
      expect(res.body.data.assignment.assigned_to).toBe(CANONICAL_WATCO_FIELD_UUID);
    });
  });

  // ===========================================================================
  // SECTION 2: CITIZEN WORK-COMPLETED LIFECYCLE MESSAGING
  // ===========================================================================
  describe('2. Citizen Work-Completed Lifecycle Messaging', () => {
    it('AWAITING_VERIFICATION shows "Work completed by field officer — awaiting verification" and NOT "Work Complete"', async () => {
      const problemService = new ProblemService();
      const citizenUser: UserProfile = {
        id: 'usr_citizen_tester',
        email: 'citizen@test.com',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Set problem to AWAITING_VERIFICATION
      await mockDb.updateProblemCluster(PROBLEM_ID, {
        status: ProblemStatus.AWAITING_VERIFICATION
      });

      const details = await problemService.getProblemDetails(citizenUser, PROBLEM_ID);
      const statusTimelineItem = details.timeline?.find((t) => t.id === 'tl_3');

      expect(statusTimelineItem).toBeDefined();
      expect(statusTimelineItem?.description).toBe('Work completed by field officer — awaiting verification.');
      expect(statusTimelineItem?.action).toBe('Awaiting Verification');
      expect(statusTimelineItem?.isCompleted).toBe(false); // MUST NOT be marked complete yet
    });

    it('RESOLVED shows "Work Complete" with secondary text "The department has verified the submitted resolution."', async () => {
      const problemService = new ProblemService();
      const citizenUser: UserProfile = {
        id: 'usr_citizen_tester',
        email: 'citizen@test.com',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Set problem to RESOLVED
      await mockDb.updateProblemCluster(PROBLEM_ID, {
        status: ProblemStatus.RESOLVED
      });

      const details = await problemService.getProblemDetails(citizenUser, PROBLEM_ID);
      const statusTimelineItem = details.timeline?.find((t) => t.id === 'tl_3');

      expect(statusTimelineItem).toBeDefined();
      expect(statusTimelineItem?.action).toBe('Work Complete');
      expect(statusTimelineItem?.description).toBe('The department has verified the submitted resolution.');
      expect(statusTimelineItem?.isCompleted).toBe(true);
    });

    it('CLOSED shows "Work Complete" with secondary text "This issue has been completed and closed."', async () => {
      const problemService = new ProblemService();
      const citizenUser: UserProfile = {
        id: 'usr_citizen_tester',
        email: 'citizen@test.com',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Set problem to CLOSED
      await mockDb.updateProblemCluster(PROBLEM_ID, {
        status: ProblemStatus.CLOSED
      });

      const details = await problemService.getProblemDetails(citizenUser, PROBLEM_ID);
      const statusTimelineItem = details.timeline?.find((t) => t.id === 'tl_3');

      expect(statusTimelineItem).toBeDefined();
      expect(statusTimelineItem?.action).toBe('Work Complete');
      expect(statusTimelineItem?.description).toBe('This issue has been completed and closed.');
      expect(statusTimelineItem?.isCompleted).toBe(true);
    });

    it('REOPENED removes completion message and shows "This issue has been reopened for further action."', async () => {
      const problemService = new ProblemService();
      const citizenUser: UserProfile = {
        id: 'usr_citizen_tester',
        email: 'citizen@test.com',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Set problem to REOPENED
      await mockDb.updateProblemCluster(PROBLEM_ID, {
        status: ProblemStatus.REOPENED
      });

      const details = await problemService.getProblemDetails(citizenUser, PROBLEM_ID);
      const statusTimelineItem = details.timeline?.find((t) => t.id === 'tl_3');

      expect(statusTimelineItem).toBeDefined();
      expect(statusTimelineItem?.action).toBe('Incident Reopened');
      expect(statusTimelineItem?.description).toBe('This issue has been reopened for further action.');
      expect(statusTimelineItem?.isCompleted).toBe(false);
      expect(statusTimelineItem?.action).not.toBe('Work Complete');
    });

    it('Evidence upload alone does not show final completion (remains AWAITING_VERIFICATION)', async () => {
      const problemService = new ProblemService();
      const citizenUser: UserProfile = {
        id: 'usr_citizen_tester',
        email: 'citizen@test.com',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Field officer uploads completion evidence while problem is IN_PROGRESS -> transitions to AWAITING_VERIFICATION
      await mockDb.updateProblemCluster(PROBLEM_ID, {
        status: ProblemStatus.AWAITING_VERIFICATION
      });
      await mockDb.createResolutionEvidence({
        id: 'evd_test_completion',
        problem_id: PROBLEM_ID,
        submitted_by: CANONICAL_WATCO_FIELD_UUID,
        submitted_at: new Date().toISOString(),
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: 'mock://evidence/repair_done.jpg',
        media_type: 'image/jpeg',
        observed_at: new Date().toISOString(),
        before_or_after: BeforeOrAfter.AFTER,
        status: EvidenceStatus.SUBMITTED,
        created_at: new Date().toISOString()
      });

      const details = await problemService.getProblemDetails(citizenUser, PROBLEM_ID);
      const statusTimelineItem = details.timeline?.find((t) => t.id === 'tl_3');

      // Crucial: Existence of evidence does NOT mark problem complete or change action to "Work Complete"
      expect(details.status).toBe(ProblemStatus.AWAITING_VERIFICATION);
      expect(statusTimelineItem?.action).toBe('Awaiting Verification');
      expect(statusTimelineItem?.action).not.toBe('Work Complete');
      expect(statusTimelineItem?.isCompleted).toBe(false);
    });
  });

  // ===========================================================================
  // SECTION 3: POSTGRES DATABASE PROVIDER QUERY INTEGRITY
  // ===========================================================================
  describe('3. Postgres Database Provider Query Integrity', () => {
    it('PostgresDatabaseProvider: listDepartmentOfficers with assignable=true queries role = FIELD_OFFICER and status = ACTIVE', async () => {
      const executedQueries: { sql: string; params?: any[] }[] = [];
      const mockPool: any = {
        query: async (sql: string, params?: any[]) => {
          executedQueries.push({ sql, params });
          return {
            rows: [
              {
                id: CANONICAL_WATCO_FIELD_UUID,
                email: 'field@example.com',
                display_name: 'Priyanshu Dash',
                role: 'FIELD_OFFICER',
                department_id: 'WATCO',
                status: 'ACTIVE'
              }
            ]
          };
        }
      };

      const provider = new PostgresDatabaseProvider({ pool: mockPool });
      const officers = await provider.listDepartmentOfficers('WATCO', { assignable: true });

      expect(officers.length).toBe(1);
      expect(officers[0].id).toBe(CANONICAL_WATCO_FIELD_UUID);

      const query = executedQueries[0];
      expect(query.sql).toContain("role = 'FIELD_OFFICER'");
      expect(query.sql).toContain("status = 'ACTIVE'");
      expect(query.params?.[0]).toBe('WATCO');
    });
  });
});
