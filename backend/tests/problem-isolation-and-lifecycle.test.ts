import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  ProviderContainer,
  MockDatabaseProvider,
  MockAIProvider
} from '../src/providers';
import {
  SignalStatus,
  SignalProcessingStatus,
  ProblemStatus,
  UserRole,
  ActionType,
  AssignmentPriority,
  AssignmentStatus,
  Assignment,
  ProblemCluster,
  ResolutionEvidence,
  ProblemAction,
  ClusterRelationshipType
} from '@civicpulse/shared';
import { env } from '../src/config/env';

describe('Strict Problem Isolation & Lifecycle Independence Regression Suite', () => {
  let app: ReturnType<typeof createApp>;
  let mockDb: MockDatabaseProvider;
  let mockAI: MockAIProvider;

  const CLOSED_PROBLEM_ID = 'PRB-2026-CLOSED-01';
  const RESOLVED_PROBLEM_ID = 'PRB-2026-RESOLVED-01';
  const ACTIVE_PROBLEM_A_ID = 'PRB-2026-ACTIVE-A';
  const ACTIVE_PROBLEM_B_ID = 'PRB-2026-ACTIVE-B';

  const FIELD_OFFICER_A = 'usr_officer_01';
  const FIELD_OFFICER_B = 'usr_field_drainage';
  const DEPT_OFFICER = 'usr_dept_watco';
  const CITIZEN_ID = 'usr_citizen_01';

  beforeEach(async () => {
    mockDb = new MockDatabaseProvider();
    mockAI = new MockAIProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    ProviderContainer.setAIProvider(mockAI);
    (env as any).DEMO_MODE = true;
    app = createApp();

    // 1. Seed CLOSED Problem with assignment, evidence, and audit history
    const closedProblem: ProblemCluster = {
      id: CLOSED_PROBLEM_ID,
      title: 'Broken Streetlight on Janpath',
      description: 'Streetlight pole 42 completely dark',
      category: 'streetlights',
      department_id: 'WATCO',
      ward_id: 'WARD-013',
      location: { lat: 20.3179, lng: 85.8182 },
      status: ProblemStatus.CLOSED,
      signal_count: 1,
      impact_score: 50,
      impact_level: 'MEDIUM' as any,
      severity_score: 15,
      population_score: 10,
      duration_score: 5,
      concentration_score: 5,
      critical_exposure_score: 0,
      recurrence_score: 5,
      evidence_score: 5,
      first_detected_at: new Date(Date.now() - 86400000).toISOString(),
      resolved_at: new Date(Date.now() - 7200000).toISOString(),
      closed_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    };
    await mockDb.createProblemCluster(closedProblem);

    const closedAssignment: Assignment = {
      id: 'asgn_closed_01',
      problem_id: CLOSED_PROBLEM_ID,
      department_id: 'WATCO',
      assigned_to: FIELD_OFFICER_A,
      assigned_by: DEPT_OFFICER,
      priority: AssignmentPriority.HIGH,
      status: AssignmentStatus.COMPLETED,
      assigned_at: new Date(Date.now() - 80000000).toISOString(),
      completed_at: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 80000000).toISOString(),
      updated_at: new Date(Date.now() - 7200000).toISOString()
    };
    await mockDb.createAssignment(closedAssignment);

    const closedEvidence: ResolutionEvidence = {
      id: 'evid_closed_01',
      problem_id: CLOSED_PROBLEM_ID,
      assignment_id: closedAssignment.id,
      submitted_by: FIELD_OFFICER_A,
      notes: 'Replaced bulb and restored wiring',
      media_urls: ['https://example.com/evidence/closed_01.jpg'],
      media_ids: ['media_closed_01'],
      created_at: new Date(Date.now() - 7500000).toISOString()
    };
    await mockDb.createResolutionEvidence(closedEvidence);

    const closedAction: ProblemAction = {
      id: 'act_closed_01',
      problem_id: CLOSED_PROBLEM_ID,
      actor_id: DEPT_OFFICER,
      actor_role: UserRole.DEPARTMENT_OFFICER,
      action_type: ActionType.CLOSED,
      previous_state: ProblemStatus.RESOLVED,
      new_state: ProblemStatus.CLOSED,
      note: 'Verified and closed by supervisor.',
      created_at: new Date(Date.now() - 3600000).toISOString()
    };
    await mockDb.createAction(closedAction);

    // 2. Seed RESOLVED Problem with assignment and evidence
    const resolvedProblem: ProblemCluster = {
      id: RESOLVED_PROBLEM_ID,
      title: 'Water Leak on VIP Road',
      description: 'Major pipeline rupture near Nayapalli',
      category: 'water_supply',
      department_id: 'WATCO',
      ward_id: 'WARD-016',
      location: { lat: 20.2976, lng: 85.8225 },
      status: ProblemStatus.RESOLVED,
      signal_count: 1,
      impact_score: 65,
      impact_level: 'HIGH' as any,
      severity_score: 20,
      population_score: 15,
      duration_score: 10,
      concentration_score: 10,
      critical_exposure_score: 0,
      recurrence_score: 5,
      evidence_score: 5,
      first_detected_at: new Date(Date.now() - 43200000).toISOString(),
      resolved_at: new Date(Date.now() - 1800000).toISOString(),
      created_at: new Date(Date.now() - 43200000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString()
    };
    await mockDb.createProblemCluster(resolvedProblem);

    const resolvedAssignment: Assignment = {
      id: 'asgn_resolved_01',
      problem_id: RESOLVED_PROBLEM_ID,
      department_id: 'WATCO',
      assigned_to: FIELD_OFFICER_B,
      assigned_by: DEPT_OFFICER,
      priority: AssignmentPriority.CRITICAL,
      status: AssignmentStatus.COMPLETED,
      assigned_at: new Date(Date.now() - 40000000).toISOString(),
      completed_at: new Date(Date.now() - 1800000).toISOString(),
      created_at: new Date(Date.now() - 40000000).toISOString(),
      updated_at: new Date(Date.now() - 1800000).toISOString()
    };
    await mockDb.createAssignment(resolvedAssignment);

    // 3. Seed Active Problem A
    const probA: ProblemCluster = {
      id: ACTIVE_PROBLEM_A_ID,
      title: 'Water Pipe Leakage at Unit 9',
      category: 'water_supply',
      department_id: 'WATCO',
      ward_id: 'WARD-009',
      location: { lat: 20.2910, lng: 85.8300 },
      status: ProblemStatus.ASSIGNED,
      signal_count: 1,
      impact_score: 60,
      impact_level: 'HIGH' as any,
      severity_score: 18,
      population_score: 12,
      duration_score: 5,
      concentration_score: 5,
      critical_exposure_score: 0,
      recurrence_score: 5,
      evidence_score: 5,
      first_detected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createProblemCluster(probA);

    const seedSignalA: Signal = {
      id: 'sig_seed_prob_a',
      citizen_id: CITIZEN_ID,
      original_text: 'Water Pipe Leakage at Unit 9',
      category: 'water_supply',
      ward_id: 'WARD-009',
      location: { lat: 20.2910, lng: 85.8300 },
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      processing_status: SignalProcessingStatus.COMPLETED,
      problem_cluster_id: ACTIVE_PROBLEM_A_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createSignal(seedSignalA);
    await mockDb.addProblemClusterMember({
      id: 'mem_seed_prob_a',
      problem_id: ACTIVE_PROBLEM_A_ID,
      signal_id: seedSignalA.id,
      relationship: ClusterRelationshipType.DUPLICATE,
      similarity: 1.0,
      created_at: new Date().toISOString()
    });

    // 4. Seed Active Problem B
    const probB: ProblemCluster = {
      id: ACTIVE_PROBLEM_B_ID,
      title: 'Broken Streetlight at Unit 4',
      category: 'streetlights',
      department_id: 'WATCO',
      ward_id: 'WARD-004',
      location: { lat: 20.2882, lng: 85.8436 },
      status: ProblemStatus.IN_PROGRESS,
      signal_count: 1,
      impact_score: 40,
      impact_level: 'MEDIUM' as any,
      severity_score: 12,
      population_score: 10,
      duration_score: 5,
      concentration_score: 3,
      critical_exposure_score: 0,
      recurrence_score: 5,
      evidence_score: 5,
      first_detected_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createProblemCluster(probB);

    const seedSignalB: Signal = {
      id: 'sig_seed_prob_b',
      citizen_id: CITIZEN_ID,
      original_text: 'Broken Streetlight at Unit 4',
      category: 'streetlights',
      ward_id: 'WARD-004',
      location: { lat: 20.2882, lng: 85.8436 },
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      processing_status: SignalProcessingStatus.COMPLETED,
      problem_cluster_id: ACTIVE_PROBLEM_B_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createSignal(seedSignalB);
    await mockDb.addProblemClusterMember({
      id: 'mem_seed_prob_b',
      problem_id: ACTIVE_PROBLEM_B_ID,
      signal_id: seedSignalB.id,
      relationship: ClusterRelationshipType.DUPLICATE,
      similarity: 1.0,
      created_at: new Date().toISOString()
    });
  });

  // Test 1: CLOSED problem + new similar signal -> new problem, old remains CLOSED
  it('1. CLOSED problem + new similar signal creates NEW problem; old problem remains strictly CLOSED', async () => {
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Streetlight pole 42 is completely dark again on Janpath',
        ward_id: 'WARD-013',
        location: { lat: 20.3179, lng: 85.8182 },
        auto_process: true
      });

    expect(res.status).toBe(201);
    const newSignal = res.body.data;
    const newProblemId = newSignal.problem_cluster_id;

    // A brand new problem ID was generated
    expect(newProblemId).toBeDefined();
    expect(newProblemId).toMatch(/^PRB-2026-/);
    expect(newProblemId).not.toBe(CLOSED_PROBLEM_ID);

    // Old problem is unchanged and remains CLOSED
    const oldProblem = await mockDb.getProblemCluster(CLOSED_PROBLEM_ID);
    expect(oldProblem?.status).toBe(ProblemStatus.CLOSED);
    expect(oldProblem?.signal_count).toBe(1);
    expect(oldProblem?.closed_at).toBeDefined();
  });

  // Test 2: RESOLVED problem + new similar signal -> new problem, old remains RESOLVED
  it('2. RESOLVED problem + new similar signal creates NEW problem; old problem remains strictly RESOLVED', async () => {
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Major pipeline rupture near Nayapalli VIP Road leaking fresh water',
        ward_id: 'WARD-016',
        location: { lat: 20.2976, lng: 85.8225 },
        auto_process: true
      });

    expect(res.status).toBe(201);
    const newSignal = res.body.data;
    const newProblemId = newSignal.problem_cluster_id;

    expect(newProblemId).toBeDefined();
    expect(newProblemId).toMatch(/^PRB-2026-/);
    expect(newProblemId).not.toBe(RESOLVED_PROBLEM_ID);

    // Old problem remains RESOLVED
    const oldProblem = await mockDb.getProblemCluster(RESOLVED_PROBLEM_ID);
    expect(oldProblem?.status).toBe(ProblemStatus.RESOLVED);
    expect(oldProblem?.signal_count).toBe(1);
    expect(oldProblem?.resolved_at).toBeDefined();
  });

  // Test 3: New problem cannot alter old assignment
  it('3. New problem cannot alter or mutate old assignment', async () => {
    const assignmentsBefore = await mockDb.getAssignments(CLOSED_PROBLEM_ID);
    expect(assignmentsBefore.length).toBe(1);
    const originalAssignment = { ...assignmentsBefore[0] };

    // Citizen submits signal for same area
    await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Streetlight not working Janpath',
        ward_id: 'WARD-013',
        location: { lat: 20.3179, lng: 85.8182 },
        auto_process: true
      });

    const assignmentsAfter = await mockDb.getAssignments(CLOSED_PROBLEM_ID);
    expect(assignmentsAfter.length).toBe(1);
    expect(assignmentsAfter[0]?.id).toBe(originalAssignment.id);
    expect(assignmentsAfter[0]?.status).toBe(originalAssignment.status);
    expect(assignmentsAfter[0]?.assigned_to).toBe(originalAssignment.assigned_to);
  });

  // Test 4: New problem cannot alter old evidence
  it('4. New problem cannot alter, replace, or attach to old problem evidence', async () => {
    const evidenceBefore = await mockDb.getResolutionEvidence(CLOSED_PROBLEM_ID);
    expect(evidenceBefore.length).toBe(1);

    await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Streetlight still broken at pole 42',
        ward_id: 'WARD-013',
        location: { lat: 20.3179, lng: 85.8182 },
        auto_process: true
      });

    const evidenceAfter = await mockDb.getResolutionEvidence(CLOSED_PROBLEM_ID);
    expect(evidenceAfter.length).toBe(1);
    expect(evidenceAfter[0]?.id).toBe('evid_closed_01');
    expect(evidenceAfter[0]?.submitted_by).toBe(FIELD_OFFICER_A);
  });

  // Test 5: New problem cannot alter old audit history
  it('5. New problem cannot alter or append to old audit history', async () => {
    const actionsBefore = await mockDb.getActions(CLOSED_PROBLEM_ID);
    expect(actionsBefore.length).toBe(1);

    await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Streetlight pole 42 dark',
        ward_id: 'WARD-013',
        location: { lat: 20.3179, lng: 85.8182 },
        auto_process: true
      });

    const actionsAfter = await mockDb.getActions(CLOSED_PROBLEM_ID);
    expect(actionsAfter.length).toBe(1);
    expect(actionsAfter[0]?.action_type).toBe(ActionType.CLOSED);
  });

  // Test 6: Citizen POST /signals cannot reopen a problem
  it('6. Citizen submission (POST /signals) has zero workflow authority and cannot reopen any problem', async () => {
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Reopen this street light incident immediately',
        ward_id: 'WARD-013',
        location: { lat: 20.3179, lng: 85.8182 },
        auto_process: true
      });

    expect(res.status).toBe(201);
    const closedProblem = await mockDb.getProblemCluster(CLOSED_PROBLEM_ID);
    expect(closedProblem?.status).toBe(ProblemStatus.CLOSED);

    // Direct attempt by citizen to trigger reopen action on workflow endpoint must fail with 403 Forbidden
    const directActionRes = await request(app)
      .post(`/api/v1/problems/${CLOSED_PROBLEM_ID}/actions`)
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        action: ActionType.REOPENED,
        note: 'Citizen demanding reopen'
      });
    expect(directActionRes.status).toBe(403);
  });

  // Test 7: Explicit Department Officer/Admin reopen still works
  it('7. Explicit Department Officer / Admin reopen action succeeds adhering to canonical state machine', async () => {
    const reopenRes = await request(app)
      .post(`/api/v1/problems/${CLOSED_PROBLEM_ID}/actions`)
      .set('Authorization', 'Bearer demo-token-dept-watco')
      .send({
        action: ActionType.REOPENED,
        note: 'Supervisor authorized reopen for recurring failure.',
        expected_status: ProblemStatus.CLOSED
      });

    expect(reopenRes.status).toBe(200);
    const reopened = await mockDb.getProblemCluster(CLOSED_PROBLEM_ID);
    expect(reopened?.status).toBe(ProblemStatus.REOPENED);

    const actions = await mockDb.getActions(CLOSED_PROBLEM_ID);
    const lastAction = actions[actions.length - 1];
    expect(lastAction?.action_type).toBe(ActionType.REOPENED);
    expect(lastAction?.actor_id).toBe('usr_dept_watco');
  });

  // Test 8: Two genuinely different problems can exist simultaneously without affecting each other
  it('8. Two genuinely different problems exist simultaneously without cross-talk', async () => {
    const fetchedA = await mockDb.getProblemCluster(ACTIVE_PROBLEM_A_ID);
    const fetchedB = await mockDb.getProblemCluster(ACTIVE_PROBLEM_B_ID);

    expect(fetchedA?.id).toBe(ACTIVE_PROBLEM_A_ID);
    expect(fetchedA?.category).toBe('water_supply');
    expect(fetchedA?.status).toBe(ProblemStatus.ASSIGNED);

    expect(fetchedB?.id).toBe(ACTIVE_PROBLEM_B_ID);
    expect(fetchedB?.category).toBe('streetlights');
    expect(fetchedB?.status).toBe(ProblemStatus.IN_PROGRESS);
  });

  // Test 9: Two different active problems can have different IDs, assignments, statuses, and evidence simultaneously
  it('9. Two active problems have independent IDs, assignments, statuses, and evidence simultaneously', async () => {
    // Problem A: Assigned to Officer A
    const asgnA: Assignment = {
      id: 'asgn_active_a',
      problem_id: ACTIVE_PROBLEM_A_ID,
      department_id: 'WATCO',
      assigned_to: FIELD_OFFICER_A,
      status: AssignmentStatus.ASSIGNED,
      priority: AssignmentPriority.HIGH,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    // Problem B: Assigned to Officer B
    const asgnB: Assignment = {
      id: 'asgn_active_b',
      problem_id: ACTIVE_PROBLEM_B_ID,
      department_id: 'WATCO',
      assigned_to: FIELD_OFFICER_B,
      status: AssignmentStatus.IN_PROGRESS,
      priority: AssignmentPriority.MEDIUM,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createAssignment(asgnA);
    await mockDb.createAssignment(asgnB);

    // Evidence strictly for Problem B
    const evidB: ResolutionEvidence = {
      id: 'evid_active_b',
      problem_id: ACTIVE_PROBLEM_B_ID,
      assignment_id: asgnB.id,
      submitted_by: FIELD_OFFICER_B,
      notes: 'Initial inspection of lamp post complete',
      media_urls: ['https://example.com/b.jpg'],
      media_ids: ['med_b'],
      created_at: new Date().toISOString()
    };
    await mockDb.createResolutionEvidence(evidB);

    const asgnsForA = await mockDb.getAssignments(ACTIVE_PROBLEM_A_ID);
    const asgnsForB = await mockDb.getAssignments(ACTIVE_PROBLEM_B_ID);
    const evidsForA = await mockDb.getResolutionEvidence(ACTIVE_PROBLEM_A_ID);
    const evidsForB = await mockDb.getResolutionEvidence(ACTIVE_PROBLEM_B_ID);

    expect(asgnsForA.length).toBe(1);
    expect(asgnsForA[0]?.assigned_to).toBe(FIELD_OFFICER_A);
    expect(asgnsForB.length).toBe(1);
    expect(asgnsForB[0]?.assigned_to).toBe(FIELD_OFFICER_B);

    expect(evidsForA.length).toBe(0);
    expect(evidsForB.length).toBe(1);
    expect(evidsForB[0]?.id).toBe('evid_active_b');
  });

  // Test 10: Completing Problem A must never mark Problem B complete
  it('10. Completing Problem A never marks Problem B complete', async () => {
    // Problem A transitions through resolution and closure
    const probA = await mockDb.getProblemCluster(ACTIVE_PROBLEM_A_ID);
    await mockDb.updateProblemCluster(ACTIVE_PROBLEM_A_ID, {
      status: ProblemStatus.CLOSED,
      closed_at: new Date().toISOString()
    });

    const checkA = await mockDb.getProblemCluster(ACTIVE_PROBLEM_A_ID);
    const checkB = await mockDb.getProblemCluster(ACTIVE_PROBLEM_B_ID);

    expect(checkA?.status).toBe(ProblemStatus.CLOSED);
    expect(checkB?.status).toBe(ProblemStatus.IN_PROGRESS);
    expect(checkB?.closed_at).toBeUndefined();
  });

  // Test 11: Reopening Problem A must never reopen Problem B
  it('11. Reopening Problem A never reopens Problem B', async () => {
    // Problem A is reopened by supervisor
    await mockDb.updateProblemCluster(ACTIVE_PROBLEM_A_ID, {
      status: ProblemStatus.REOPENED
    });

    const checkA = await mockDb.getProblemCluster(ACTIVE_PROBLEM_A_ID);
    const checkB = await mockDb.getProblemCluster(ACTIVE_PROBLEM_B_ID);

    expect(checkA?.status).toBe(ProblemStatus.REOPENED);
    expect(checkB?.status).toBe(ProblemStatus.IN_PROGRESS);
  });

  // Test 12: Citizen sees the correct status for each individual report/problem
  it('12. Citizen sees the correct status for each individual report/problem', async () => {
    // Citizen queries signal 1 (linked to closed problem)
    const sig1 = await mockDb.createSignal({
      id: 'sig_test_citizen_01',
      citizen_id: CITIZEN_ID,
      original_text: 'Report 1 for Janpath streetlight',
      category: 'streetlights',
      ward_id: 'WARD-013',
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      processing_status: SignalProcessingStatus.COMPLETED,
      problem_cluster_id: CLOSED_PROBLEM_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Citizen queries signal 2 (linked to active problem)
    const sig2 = await mockDb.createSignal({
      id: 'sig_test_citizen_02',
      citizen_id: CITIZEN_ID,
      original_text: 'Report 2 for Unit 4 streetlight',
      category: 'streetlights',
      ward_id: 'WARD-004',
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      processing_status: SignalProcessingStatus.COMPLETED,
      problem_cluster_id: ACTIVE_PROBLEM_B_ID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const res1 = await request(app)
      .get(`/api/v1/signals/${sig1.id}`)
      .set('Authorization', 'Bearer demo-token-citizen');
    expect(res1.status).toBe(200);
    expect(res1.body.data.problem_cluster_id).toBe(CLOSED_PROBLEM_ID);

    const res2 = await request(app)
      .get(`/api/v1/signals/${sig2.id}`)
      .set('Authorization', 'Bearer demo-token-citizen');
    expect(res2.status).toBe(200);
    expect(res2.body.data.problem_cluster_id).toBe(ACTIVE_PROBLEM_B_ID);

    // Verify problems have distinct states
    const prob1 = await mockDb.getProblemCluster(CLOSED_PROBLEM_ID);
    const prob2 = await mockDb.getProblemCluster(ACTIVE_PROBLEM_B_ID);
    expect(prob1?.status).toBe(ProblemStatus.CLOSED);
    expect(prob2?.status).toBe(ProblemStatus.IN_PROGRESS);
  });

  // Test 13: Department Officer sees each independent operational problem separately
  it('13. Department Officer sees each independent operational problem separately', async () => {
    const res = await request(app)
      .get('/api/v1/problems')
      .set('Authorization', 'Bearer demo-token-dept-watco');

    expect(res.status).toBe(200);
    const problemList: ProblemCluster[] = res.body.data;
    const ids = problemList.map((p) => p.id);

    // Both problems appear as separate entities in the list
    expect(ids).toContain(CLOSED_PROBLEM_ID);
    expect(ids).toContain(RESOLVED_PROBLEM_ID);

    const closedItem = problemList.find((p) => p.id === CLOSED_PROBLEM_ID);
    const resolvedItem = problemList.find((p) => p.id === RESOLVED_PROBLEM_ID);

    expect(closedItem?.status).toBe(ProblemStatus.CLOSED);
    expect(resolvedItem?.status).toBe(ProblemStatus.RESOLVED);
  });

  // Test 14: Field Officer receives only assignments belonging to the assigned problem
  it('14. Field Officer receives only assignments belonging to their assigned problem', async () => {
    const resA = await request(app)
      .get('/api/v1/assignments?assigned_to=me')
      .set('Authorization', 'Bearer demo-token-officer');

    expect(resA.status).toBe(200);
    const assignmentsOfficerA: Assignment[] = resA.body.data || resA.body;
    for (const asgn of assignmentsOfficerA) {
      if (asgn.assigned_to) {
        expect(asgn.assigned_to).toBe(FIELD_OFFICER_A);
      }
    }

    // Officer B only sees Officer B assignments
    const assignmentsOfficerB = await mockDb.listAssignments({ assigned_to: FIELD_OFFICER_B });
    for (const asgn of assignmentsOfficerB) {
      expect(asgn.assigned_to).toBe(FIELD_OFFICER_B);
    }
  });

  // Test 15: REOPENED historical problem + new similar citizen signal => creates a NEW independent problem
  it('15. REOPENED historical problem + new similar citizen signal => creates a NEW independent problem', async () => {
    // Reopen closed problem via supervisor action
    await request(app)
      .post(`/api/v1/problems/${CLOSED_PROBLEM_ID}/actions`)
      .set('Authorization', 'Bearer demo-token-dept-watco')
      .send({
        action: ActionType.REOPENED,
        note: 'Supervisor reopened.',
        expected_status: ProblemStatus.CLOSED
      });

    const reopenedProb = await mockDb.getProblemCluster(CLOSED_PROBLEM_ID);
    expect(reopenedProb?.status).toBe(ProblemStatus.REOPENED);

    // Citizen reports similar streetlight issue at same location
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Streetlight pole 42 completely dark on Janpath',
        ward_id: 'WARD-013',
        location: { lat: 20.3179, lng: 85.8182 },
        auto_process: true
      });

    expect(res.status).toBe(201);
    const clusterResult = res.body.cluster || res.body.data.cluster;
    expect(clusterResult.isNewCluster).toBe(true);
    expect(res.body.data.problem_cluster_id).not.toBe(CLOSED_PROBLEM_ID);

    // Reopened problem cluster was not mutated
    const postReopenedProb = await mockDb.getProblemCluster(CLOSED_PROBLEM_ID);
    expect(postReopenedProb?.status).toBe(ProblemStatus.REOPENED);
    expect(postReopenedProb?.signal_count).toBe(1);
  });

  // Test 16: Same ward + same category + >150m distance => creates a NEW problem
  it('16. Same ward + same category + >150m distance => creates a NEW problem', async () => {
    // ACTIVE_PROBLEM_B_ID is in WARD-004 at lat: 20.2882, lng: 85.8436 (streetlights)
    // New signal is 350m away (lat: 20.2915, lng: 85.8436)
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen')
      .send({
        original_text: 'Broken Streetlight at Unit 4 north lane',
        ward_id: 'WARD-004',
        location: { lat: 20.2915, lng: 85.8436 },
        auto_process: true
      });

    expect(res.status).toBe(201);
    const clusterResult = res.body.cluster || res.body.data.cluster;
    expect(clusterResult.isNewCluster).toBe(true);
    expect(res.body.data.problem_cluster_id).not.toBe(ACTIVE_PROBLEM_B_ID);

    const probB = await mockDb.getProblemCluster(ACTIVE_PROBLEM_B_ID);
    expect(probB?.signal_count).toBe(1);
  });

  // Test 17: Same ward + same category + <=150m but relationship is RELATED (0.70-0.84) => creates a NEW problem
  it('17. Same ward + same category + <=150m but relationship is RELATED (0.70-0.84) => creates a NEW problem', async () => {
    // Return orthogonal-ish vector producing moderate cosine similarity (0.65) -> relationship_score ~0.79 (RELATED)
    let callCount = 0;
    const spy = vi.spyOn(mockAI, 'generateEmbedding').mockImplementation(async () => {
      callCount++;
      const v = new Array(1536).fill(0);
      if (callCount % 2 === 1) {
        v[0] = 0.65;
        v[1] = Math.sqrt(1 - 0.65 * 0.65);
      } else {
        v[0] = 1.0;
      }
      return v;
    });

    try {
      // ACTIVE_PROBLEM_A_ID is in WARD-009 at lat: 20.2910, lng: 85.8300 (water_supply, "Water Pipe Leakage at Unit 9")
      // New report is 80m away with distinct text ("Low water pressure and weak trickle from tap")
      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .set('Idempotency-Key', 'idemp-rel-test-17')
        .send({
          original_text: 'Low water pressure and weak trickle from tap in kitchen',
          ward_id: 'WARD-009',
          location: { lat: 20.2916, lng: 85.8300 },
          auto_process: true
        });

      expect(res.status).toBe(201);
      const clusterResult = res.body.cluster || res.body.data.cluster;
      // Even if related within the same ward and nearby, it cannot merge as a duplicate -> creates NEW problem
      expect(clusterResult.isNewCluster).toBe(true);
      expect(res.body.data.problem_cluster_id).not.toBe(ACTIVE_PROBLEM_A_ID);

      const probA = await mockDb.getProblemCluster(ACTIVE_PROBLEM_A_ID);
      expect(probA?.signal_count).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });

  // Test 18: Strong DUPLICATE >=0.85 and <=150m may correlate to the SAME active problem
  it('18. Strong DUPLICATE >=0.85 and <=150m correlates to the SAME active problem', async () => {
    // Seed existing assignment on ACTIVE_PROBLEM_A_ID
    const asgnA: Assignment = {
      id: 'asgn_test_18',
      problem_id: ACTIVE_PROBLEM_A_ID,
      department_id: 'WATCO',
      assigned_to: FIELD_OFFICER_A,
      status: AssignmentStatus.ASSIGNED,
      priority: AssignmentPriority.HIGH,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createAssignment(asgnA);

    // Second citizen reports the exact same active incident 20m away (lat: 20.2911, lng: 85.8300 vs probA: 20.2910, 85.8300)
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen-2')
      .set('Idempotency-Key', 'idemp-test-18-dup')
      .send({
        original_text: 'Water Pipe Leakage at Unit 9',
        ward_id: 'WARD-009',
        location: { lat: 20.2911, lng: 85.8300 },
        auto_process: true
      });

    expect(res.status).toBe(201);
    const clusterResult = res.body.cluster || res.body.data.cluster;
    expect(clusterResult.matched).toBe(true);
    expect(clusterResult.isNewCluster).toBe(false);
    expect(clusterResult.problem.id).toBe(ACTIVE_PROBLEM_A_ID);
    expect(res.body.data.problem_cluster_id).toBe(ACTIVE_PROBLEM_A_ID);

    const updatedProb = await mockDb.getProblemCluster(ACTIVE_PROBLEM_A_ID);
    expect(updatedProb?.signal_count).toBe(2);
  });

  // Test 19: Correlating a duplicate must NOT modify status, assignment, evidence, resolution, closure, or audit history
  it('19. Correlating a duplicate must not modify status, assignment, evidence, resolution, closure, or audit history', async () => {
    // 1. Setup Active Problem A in ASSIGNED state with assigned_to officer, assignment, and initial action
    await mockDb.updateProblemCluster(ACTIVE_PROBLEM_A_ID, { assigned_to: FIELD_OFFICER_A });
    const initialProb = await mockDb.getProblemCluster(ACTIVE_PROBLEM_A_ID);
    expect(initialProb?.status).toBe(ProblemStatus.ASSIGNED);
    expect(initialProb?.assigned_to).toBe(FIELD_OFFICER_A);

    const initialAssignment: Assignment = {
      id: 'asgn_test_19',
      problem_id: ACTIVE_PROBLEM_A_ID,
      department_id: 'WATCO',
      assigned_to: FIELD_OFFICER_A,
      status: AssignmentStatus.ASSIGNED,
      priority: AssignmentPriority.HIGH,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await mockDb.createAssignment(initialAssignment);

    const initialAction: ProblemAction = {
      id: 'act_test_19',
      problem_id: ACTIVE_PROBLEM_A_ID,
      actor_id: DEPT_OFFICER,
      actor_role: UserRole.DEPARTMENT_OFFICER,
      action_type: ActionType.ASSIGNED,
      previous_state: ProblemStatus.TRIAGED,
      new_state: ProblemStatus.ASSIGNED,
      target_officer_id: FIELD_OFFICER_A,
      note: 'Assigned to Officer A',
      created_at: new Date().toISOString()
    };
    await mockDb.createAction(initialAction);

    const actionsBefore = await mockDb.getActions(ACTIVE_PROBLEM_A_ID);
    const assignmentsBefore = await mockDb.getAssignments(ACTIVE_PROBLEM_A_ID);
    const evidenceBefore = await mockDb.getResolutionEvidence(ACTIVE_PROBLEM_A_ID);

    // 2. Submit matching duplicate signal from second citizen 25m away
    const res = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', 'Bearer demo-token-citizen-2')
      .set('Idempotency-Key', 'idemp-test-19-dup')
      .send({
        original_text: 'Water Pipe Leakage at Unit 9',
        ward_id: 'WARD-009',
        location: { lat: 20.2912, lng: 85.8300 },
        auto_process: true
      });

    expect(res.status).toBe(201);
    expect(res.body.data.problem_cluster_id).toBe(ACTIVE_PROBLEM_A_ID);

    // 3. Verify ALL lifecycle attributes remain pristine and unmodified
    const postProb = await mockDb.getProblemCluster(ACTIVE_PROBLEM_A_ID);
    expect(postProb?.status).toBe(ProblemStatus.ASSIGNED); // Status did not change
    expect(postProb?.assigned_to).toBe(FIELD_OFFICER_A); // Assigned officer did not change
    expect(postProb?.resolved_at).toBeUndefined(); // Resolved date did not change
    expect(postProb?.closed_at).toBeUndefined(); // Closed date did not change
    expect(postProb?.signal_count).toBe(2); // Only aggregate count updated

    // Assignments untouched
    const assignmentsAfter = await mockDb.getAssignments(ACTIVE_PROBLEM_A_ID);
    expect(assignmentsAfter.length).toBe(assignmentsBefore.length);
    expect(assignmentsAfter[0]?.id).toBe(initialAssignment.id);
    expect(assignmentsAfter[0]?.status).toBe(AssignmentStatus.ASSIGNED);

    // Evidence untouched
    const evidenceAfter = await mockDb.getResolutionEvidence(ACTIVE_PROBLEM_A_ID);
    expect(evidenceAfter.length).toBe(evidenceBefore.length);

    // Audit actions untouched (citizen submission generated ZERO workflow actions)
    const actionsAfter = await mockDb.getActions(ACTIVE_PROBLEM_A_ID);
    expect(actionsAfter.length).toBe(actionsBefore.length);
    expect(actionsAfter[0]?.id).toBe(initialAction.id);
  });
});
