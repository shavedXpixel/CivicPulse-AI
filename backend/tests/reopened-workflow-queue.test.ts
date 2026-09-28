import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import { getDatabaseProvider, ProviderContainer, MockDatabaseProvider } from '../src/providers';
import {
  ProblemStatus,
  AssignmentStatus,
  UserRole,
  ActionType,
  AssignmentPriority,
  Assignment,
  ProblemCluster
} from '@civicpulse/shared';
import { PostgresDatabaseProvider } from '../src/providers/database/postgres.provider';

describe('Reopened Incident Workflow & Field Officer Queue Regression Suite', () => {
  let app: Express;
  let mockDb: MockDatabaseProvider;

  const PROBLEM_ID = 'PRB-2026-REOPEN-TEST';
  const FIELD_OFFICER_1_ID = 'usr_officer_01'; // Default test officer (demo-token-officer)
  const FIELD_OFFICER_2_ID = 'usr_field_drainage'; // Second officer
  const DEPT_OFFICER_ID = 'usr_dept_watco';

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(async () => {
    mockDb = new MockDatabaseProvider();
    ProviderContainer.setDatabaseProvider(mockDb);

    // Create a CLOSED problem with an existing CANCELLED assignment
    const closedProblem: ProblemCluster = {
      id: PROBLEM_ID,
      title: 'Water Main Burst - Reopened Case',
      category: 'WATER_LEAK',
      department_id: 'WATCO',
      ward_id: 'WARD_34',
      status: ProblemStatus.CLOSED,
      impact_level: 'HIGH',
      impact_score: 75,
      signal_count: 3,
      assigned_to: undefined,
      assigned_at: undefined,
      closed_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    };
    await mockDb.createProblemCluster(closedProblem);

    // Add historical cancelled assignment
    const oldAssignment: Assignment = {
      id: 'asgn_old_cancelled_01',
      problem_id: PROBLEM_ID,
      department_id: 'WATCO',
      assigned_to: FIELD_OFFICER_1_ID,
      assigned_by: DEPT_OFFICER_ID,
      priority: AssignmentPriority.HIGH,
      status: AssignmentStatus.CANCELLED,
      assigned_at: new Date(Date.now() - 86400000).toISOString(),
      completed_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    };
    await mockDb.createAssignment(oldAssignment);
  });

  it('executes full CLOSED -> REOPENED -> TRIAGED -> ASSIGNED cycle and displays exactly ONE active work order to Field Officer', async () => {
    // =========================================================================
    // Step 1: CLOSED -> REOPENED
    // =========================================================================
    const resReopen = await request(app)
      .post(`/api/v1/problems/${PROBLEM_ID}/actions`)
      .set('Authorization', 'Bearer demo-token-dept-watco')
      .send({
        action: ActionType.REOPENED,
        note: 'Recurring leak observed at original site after administrative closure.',
        expected_status: ProblemStatus.CLOSED
      });

    expect(resReopen.status).toBe(200);
    expect(resReopen.body.data.action.new_state).toBe(ProblemStatus.REOPENED);

    const problemAfterReopen = await mockDb.getProblemCluster(PROBLEM_ID);
    expect(problemAfterReopen?.status).toBe(ProblemStatus.REOPENED);
    expect(problemAfterReopen?.assigned_to).toBeFalsy();
    expect(problemAfterReopen?.assigned_at).toBeFalsy();

    // Verify historical assignment remains CANCELLED
    const assignmentsAfterReopen = await mockDb.getAssignments(PROBLEM_ID);
    expect(assignmentsAfterReopen.length).toBe(1);
    expect(assignmentsAfterReopen[0].status).toBe(AssignmentStatus.CANCELLED);

    // Field Officer queue must show 0 work orders while REOPENED
    const resQueueReopened = await request(app)
      .get('/api/v1/assignments?assigned_to=me')
      .set('Authorization', 'Bearer demo-token-officer');
    expect(resQueueReopened.status).toBe(200);
    const reopenedOrders = resQueueReopened.body.data.filter((a: any) => a.problem_id === PROBLEM_ID);
    expect(reopenedOrders.length).toBe(0);

    // =========================================================================
    // Step 2: REOPENED -> TRIAGED (Re-triage Incident)
    // =========================================================================
    const resTriage = await request(app)
      .post(`/api/v1/problems/${PROBLEM_ID}/actions`)
      .set('Authorization', 'Bearer demo-token-dept-watco')
      .send({
        action: ActionType.TRIAGED,
        note: 'Reopened problem triaged for urgent remediation.',
        expected_status: ProblemStatus.REOPENED
      });

    expect(resTriage.status).toBe(200);
    expect(resTriage.body.data.action.new_state).toBe(ProblemStatus.TRIAGED);

    const problemAfterTriage = await mockDb.getProblemCluster(PROBLEM_ID);
    expect(problemAfterTriage?.status).toBe(ProblemStatus.TRIAGED);

    // Field Officer queue must still show 0 work orders while TRIAGED (not yet assigned)
    const resQueueTriaged = await request(app)
      .get('/api/v1/assignments?assigned_to=me')
      .set('Authorization', 'Bearer demo-token-officer');
    expect(resQueueTriaged.status).toBe(200);
    const triagedOrders = resQueueTriaged.body.data.filter((a: any) => a.problem_id === PROBLEM_ID);
    expect(triagedOrders.length).toBe(0);

    // =========================================================================
    // Step 3: TRIAGED -> ASSIGNED (Assign Field Officer)
    // =========================================================================
    const resAssign = await request(app)
      .post(`/api/v1/problems/${PROBLEM_ID}/assign`)
      .set('Authorization', 'Bearer demo-token-dept-watco')
      .send({
        department_id: 'WATCO',
        assigned_to: FIELD_OFFICER_1_ID,
        priority: AssignmentPriority.HIGH,
        notes: 'Dispatched crew to fix recurrent leak.',
        expected_status: ProblemStatus.TRIAGED
      });

    expect(resAssign.status).toBe(200);
    expect(resAssign.body.data.problem.status).toBe(ProblemStatus.ASSIGNED);
    expect(resAssign.body.data.problem.assigned_to).toBe(FIELD_OFFICER_1_ID);
    expect(resAssign.body.data.assignment.assigned_to).toBe(FIELD_OFFICER_1_ID);
    expect(resAssign.body.data.assignment.status).toBe(AssignmentStatus.ASSIGNED);

    // INVARIANT: problem.assigned_to must match assignment.assigned_to
    expect(resAssign.body.data.problem.assigned_to).toBe(resAssign.body.data.assignment.assigned_to);

    // Database verification: exactly ONE active assignment exists; old one remains CANCELLED
    const allAssignments = await mockDb.getAssignments(PROBLEM_ID);
    const activeAssignments = allAssignments.filter(
      (a) => a.status === AssignmentStatus.ASSIGNED || a.status === AssignmentStatus.ACCEPTED
    );
    const cancelledAssignments = allAssignments.filter((a) => a.status === AssignmentStatus.CANCELLED);

    expect(activeAssignments.length).toBe(1);
    expect(cancelledAssignments.length).toBe(1);
    expect(activeAssignments[0].assigned_to).toBe(FIELD_OFFICER_1_ID);

    // =========================================================================
    // Step 4: Field Officer 1 Work Queue Inspection (GET /api/v1/assignments?assigned_to=me)
    // =========================================================================
    const resQueueAssigned = await request(app)
      .get('/api/v1/assignments?assigned_to=me')
      .set('Authorization', 'Bearer demo-token-officer');

    expect(resQueueAssigned.status).toBe(200);
    const officerWorkOrders = resQueueAssigned.body.data.filter((a: any) => a.problem_id === PROBLEM_ID);

    // INVARIANT: Exactly ONE active work order is returned
    expect(officerWorkOrders.length).toBe(1);
    expect(officerWorkOrders[0].status).toBe(AssignmentStatus.ASSIGNED);
    expect(officerWorkOrders[0].problem.status).toBe(ProblemStatus.ASSIGNED);
    expect(officerWorkOrders[0].assigned_to).toBe(FIELD_OFFICER_1_ID);
    expect(officerWorkOrders[0].problem.assigned_to).toBe(FIELD_OFFICER_1_ID);

    // Historical CANCELLED assignment must NOT appear in the queue
    const cancelledInQueue = resQueueAssigned.body.data.filter(
      (a: any) => a.id === 'asgn_old_cancelled_01'
    );
    expect(cancelledInQueue.length).toBe(0);

    // =========================================================================
    // Step 5: Isolation Guard — Another Field Officer CANNOT see this work order
    // =========================================================================
    // demo-token-field-drainage resolves to usr_field_drainage
    const resQueueOfficer2 = await request(app)
      .get('/api/v1/assignments?assigned_to=me')
      .set('Authorization', 'Bearer demo-token-field-drainage');

    expect(resQueueOfficer2.status).toBe(200);
    const officer2Orders = resQueueOfficer2.body.data.filter((a: any) => a.problem_id === PROBLEM_ID);
    expect(officer2Orders.length).toBe(0);

    // =========================================================================
    // Step 6: Field Officer 1 Starts Work (STARTED_WORK)
    // =========================================================================
    const resStartWork = await request(app)
      .post(`/api/v1/problems/${PROBLEM_ID}/actions`)
      .set('Authorization', 'Bearer demo-token-officer')
      .send({
        action: ActionType.STARTED_WORK,
        note: 'Field crew arrived on site with excavation equipment.',
        expected_status: ProblemStatus.ASSIGNED
      });

    expect(resStartWork.status).toBe(200);
    expect(resStartWork.body.data.action.new_state).toBe(ProblemStatus.IN_PROGRESS);

    // Queue still returns the assignment, now with IN_PROGRESS state
    const resQueueInProgress = await request(app)
      .get('/api/v1/assignments?assigned_to=me')
      .set('Authorization', 'Bearer demo-token-officer');
    expect(resQueueInProgress.status).toBe(200);
    const inProgressOrders = resQueueInProgress.body.data.filter((a: any) => a.problem_id === PROBLEM_ID);
    expect(inProgressOrders.length).toBe(1);
    expect(inProgressOrders[0].problem.status).toBe(ProblemStatus.IN_PROGRESS);
  });

  it('PostgresDatabaseProvider: normalizes legacy UIDs to canonical public.users.id UUID in assignments and problem_clusters', async () => {
    const CANONICAL_FIELD_UUID = '10000000-0000-4000-8000-000000000003';
    const LEGACY_FIELD_UID = 'fb_uid_field_synthetic_03';
    const CANONICAL_DEPT_UUID = '10000000-0000-4000-8000-000000000002';

    const executedQueries: { sql: string; params?: any[] }[] = [];
    const mockClient: any = {
      query: async (sql: string, params?: any[]) => {
        executedQueries.push({ sql, params });

        // Problem cluster row lock query
        if (sql.includes('SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE')) {
          return {
            rows: [{
              id: 'PRB-PROD-UUID-TEST',
              status: 'TRIAGED',
              department_id: 'WATCO',
              assigned_to: null,
              assigned_at: null,
              impact_score: 50,
              impact_level: 'MEDIUM',
              created_at: new Date()
            }]
          };
        }

        // Resolving users by legacy UID or UUID
        if (sql.includes('FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1')) {
          const input = params?.[0];
          if (input === CANONICAL_FIELD_UUID || input === LEGACY_FIELD_UID) {
            return { rows: [{ id: CANONICAL_FIELD_UUID, legacy_firebase_uid: LEGACY_FIELD_UID }] };
          }
          if (input === CANONICAL_DEPT_UUID) {
            return { rows: [{ id: CANONICAL_DEPT_UUID, legacy_firebase_uid: null }] };
          }
        }

        // Problem cluster update
        if (sql.includes('UPDATE problem_clusters SET status = $1')) {
          return {
            rows: [{
              id: 'PRB-PROD-UUID-TEST',
              status: 'ASSIGNED',
              department_id: 'WATCO',
              assigned_to: CANONICAL_FIELD_UUID,
              assigned_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]
          };
        }

        // Default query response
        return { rows: [] };
      },
      release: () => {}
    };

    const mockPool: any = {
      connect: async () => mockClient,
      query: (sql: string, params?: any[]) => mockClient.query(sql, params),
      end: async () => {}
    };

    const provider = new PostgresDatabaseProvider({ pool: mockPool });

    // Call atomicAssignProblem passing legacy UID
    const result = await provider.atomicAssignProblem(
        'PRB-PROD-UUID-TEST',
        {
          id: 'asgn_uuid_norm_test',
          problem_id: 'PRB-PROD-UUID-TEST',
          department_id: 'WATCO',
          assigned_to: LEGACY_FIELD_UID, // Pass legacy UID
          assigned_by: CANONICAL_DEPT_UUID,
          priority: AssignmentPriority.HIGH,
          status: AssignmentStatus.ASSIGNED,
          assigned_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        ProblemStatus.ASSIGNED,
        {
          id: 'act_uuid_norm_test',
          problem_id: 'PRB-PROD-UUID-TEST',
          actor_id: CANONICAL_DEPT_UUID,
          actor_role: UserRole.DEPARTMENT_OFFICER,
          action_type: ActionType.ASSIGNED,
          previous_state: ProblemStatus.TRIAGED,
          new_state: ProblemStatus.ASSIGNED,
          created_at: new Date().toISOString()
        },
        ProblemStatus.TRIAGED
      );

    // Verify problem_clusters UPDATE was called with the canonical UUID
    const updateProblemQuery = executedQueries.find((q) => q.sql.includes('UPDATE problem_clusters SET status = $1'));
    expect(updateProblemQuery).toBeDefined();
    expect(updateProblemQuery?.params?.[2]).toBe(CANONICAL_FIELD_UUID);

    // Verify assignments INSERT was called with the canonical UUID
    const insertAssignmentQuery = executedQueries.find((q) => q.sql.includes('INSERT INTO assignments'));
    expect(insertAssignmentQuery).toBeDefined();
    expect(insertAssignmentQuery?.params?.[4]).toBe(CANONICAL_FIELD_UUID);

    // Verify returned assignment object is normalized to canonical UUID
    expect(result.problem.assigned_to).toBe(CANONICAL_FIELD_UUID);
    expect(result.assignment.assigned_to).toBe(CANONICAL_FIELD_UUID);
    expect(result.problem.assigned_to).toBe(result.assignment.assigned_to);
  });
});
