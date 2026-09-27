import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';

describe('Phase 5 Operations & Government Workflows API', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('1. Citizen RBAC Guard', () => {
    it('Citizen is strictly blocked with 403 from assigning problems', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/assign')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          department_id: 'WATCO',
          priority: 'CRITICAL'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Citizen is strictly blocked with 403 from updating problem status', async () => {
      const res = await request(app)
        .patch('/api/v1/problems/PRB-2026-0819/status')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          status: 'RESOLVED',
          note: 'Citizen attempting resolution'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Citizen is strictly blocked with 403 from logging official actions', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/actions')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          action: 'STARTED_WORK',
          note: 'Citizen work log'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Citizen is strictly blocked with 403 from officer assignments work queue', async () => {
      const res = await request(app)
        .get('/api/v1/assignments?assigned_to=me')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Citizen is strictly blocked with 403 from operational dashboard', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Department Officer Scoping & Assignments', () => {
    it('BMC_DRAINAGE officer cannot assign a problem belonging to WATCO', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/assign')
        .set('Authorization', 'Bearer demo-token-dept-drainage')
        .send({
          department_id: 'BMC_DRAINAGE',
          notes: 'Attempting cross-department hijack'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('WATCO Department Officer can assign WATCO problem to field officer', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/assign')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: 'usr_officer_01',
          priority: 'CRITICAL',
          notes: 'Official dispatch to Manoj Mohanty for immediate isolation.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.id).toBe('PRB-2026-0819');
      expect(res.body.data.problem.department_id).toBe('WATCO');
      expect(res.body.data.problem.assigned_to).toBe('usr_officer_01');
      expect(res.body.data.assignment.priority).toBe('CRITICAL');
      expect(res.body.data.assignment.sla_state.target_hours).toBe(24);
      expect(['ASSIGNED', 'REASSIGNED']).toContain(res.body.data.action.action_type);
    });

    it('Backend rejects assignment attempted to any department other than WATCO', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/assign')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'TPCODL',
          assigned_to: 'usr_officer_01',
          priority: 'HIGH',
          notes: 'Attempting invalid non-WATCO assignment'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('WATCO');
    });

    it('Admin can assign problem across departments', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0820/assign')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          department_id: 'BMC_DRAINAGE',
          assigned_to: 'usr_field_drainage',
          priority: 'HIGH',
          notes: 'Admin assignment for stormwater drain'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.assigned_to).toBe('usr_field_drainage');
    });
  });

  describe('3. Field Officer Work Queue Scoping (assigned_to === user.id)', () => {
    it('WATCO field officer sees ONLY PRB-2026-0819, NOT PRB-2026-0820', async () => {
      const res = await request(app)
        .get('/api/v1/assignments?assigned_to=me')
        .set('Authorization', 'Bearer demo-token-officer'); // usr_officer_01

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      const problemIds = res.body.data.map((a: any) => a.problem_id);
      expect(problemIds).toContain('PRB-2026-0819');
      expect(problemIds).not.toContain('PRB-2026-0820');
    });

    it('BMC_DRAINAGE field officer sees ONLY PRB-2026-0820, NOT PRB-2026-0819', async () => {
      const res = await request(app)
        .get('/api/v1/assignments?assigned_to=me')
        .set('Authorization', 'Bearer demo-token-field-drainage'); // usr_field_drainage

      expect(res.status).toBe(200);
      const problemIds = res.body.data.map((a: any) => a.problem_id);
      expect(problemIds).toContain('PRB-2026-0820');
      expect(problemIds).not.toContain('PRB-2026-0819');
    });

    it('Field officer cannot act on problems assigned to another officer', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0820/actions')
        .set('Authorization', 'Bearer demo-token-officer') // usr_officer_01 trying to act on PRB-2026-0820
        .send({
          action: 'STARTED_WORK',
          note: 'Unauthorized field officer attempt'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Assigned field officer can transition ASSIGNED -> IN_PROGRESS via STARTED_WORK action', async () => {
      // PRB-2026-0820 is seeded in ASSIGNED state assigned to usr_field_drainage
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0820/actions')
        .set('Authorization', 'Bearer demo-token-field-drainage')
        .send({
          action: 'STARTED_WORK',
          note: 'Drainage crew deployed with desilting suction truck.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.status).toBe('IN_PROGRESS');
      expect(res.body.data.action.action_type).toBe('STARTED_WORK');
    });
  });

  describe('4. Lifecycle State Machine & Concurrency Validation', () => {
    it('Rejects invalid transitions with 400 INVALID_STATE_TRANSITION', async () => {
      // Try to jump directly from IN_PROGRESS to CLOSED (bypassing AWAITING_VERIFICATION and RESOLVED)
      const res = await request(app)
        .patch('/api/v1/problems/PRB-2026-0819/status')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          status: 'CLOSED',
          note: 'Attempting illegal transition'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('Field officer can transition IN_PROGRESS -> AWAITING_VERIFICATION via VERIFICATION_REQUESTED', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/actions')
        .set('Authorization', 'Bearer demo-token-officer')
        .send({
          action: 'VERIFICATION_REQUESTED',
          note: 'Main pipeline replaced and pressure tested. Awaiting engineering sign-off.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.status).toBe('AWAITING_VERIFICATION');
    });

    it('Department officer can transition AWAITING_VERIFICATION -> RESOLVED', async () => {
      const res = await request(app)
        .patch('/api/v1/problems/PRB-2026-0819/status')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          status: 'RESOLVED',
          note: 'Superintending engineer approved resolution.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.status).toBe('RESOLVED');
      expect(res.body.data.problem.sla_state.status).toBe('MET');
    });

    it('Department officer can transition RESOLVED -> CLOSED', async () => {
      const res = await request(app)
        .patch('/api/v1/problems/PRB-2026-0819/status')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          status: 'CLOSED',
          note: 'Public notice issued and case formally closed.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.problem.status).toBe('CLOSED');
      expect(res.body.data.problem.sla_state.status).toBe('MET');
    });

    it('Department officer can cycle CLOSED -> REOPENED -> TRIAGED -> ASSIGNED', async () => {
      // 1. CLOSED -> REOPENED
      const resReopen = await request(app)
        .patch('/api/v1/problems/PRB-2026-0819/status')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          status: 'REOPENED',
          note: 'Secondary low-pressure complaints reported.'
        });
      expect(resReopen.status).toBe(200);
      expect(resReopen.body.data.problem.status).toBe('REOPENED');

      // 2. REOPENED -> TRIAGED
      const resTriaged = await request(app)
        .patch('/api/v1/problems/PRB-2026-0819/status')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          status: 'TRIAGED',
          note: 'Re-triage confirms secondary leak.'
        });
      expect(resTriaged.status).toBe(200);
      expect(resTriaged.body.data.problem.status).toBe('TRIAGED');

      // 3. TRIAGED -> ASSIGNED
      const resAssign = await request(app)
        .post('/api/v1/problems/PRB-2026-0819/assign')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          department_id: 'WATCO',
          assigned_to: 'usr_officer_01',
          priority: 'CRITICAL',
          notes: 'Reassigned for secondary leak patch.'
        });
      expect(resAssign.status).toBe(200);
      expect(resAssign.body.data.problem.status).toBe('ASSIGNED');
    });
  });

  describe('5. Audit Trail & Problem History', () => {
    it('GET /api/v1/problems/:id/actions returns complete immutable audit trail', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819/actions')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);

      // Verify actions have actor, previous_state, new_state, created_at
      const action = res.body.data[0];
      expect(action).toHaveProperty('action_type');
      expect(action).toHaveProperty('actor_id');
      expect(action).toHaveProperty('created_at');
    });

    it('GET /api/v1/problems/:id/assignments returns problem assignment history', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-2026-0819/assignments')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].department_id).toBe('WATCO');
    });
  });

  describe('6. Department Directory & Workload APIs', () => {
    it('GET /api/v1/departments returns standardized department directory list', async () => {
      const res = await request(app)
        .get('/api/v1/departments')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(5);
      const ids = res.body.data.map((d: any) => d.id);
      expect(ids).toContain('WATCO');
      expect(ids).toContain('BMC_DRAINAGE');
      expect(ids).toContain('BMC_ROADS');
      expect(ids).toContain('BMC_SAN');
      expect(ids).toContain('TPCODL');
    });

    it('GET /api/v1/departments/:id/workload returns workload metrics for that department', async () => {
      const res = await request(app)
        .get('/api/v1/departments/WATCO/workload')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(res.body.data.department_id).toBe('WATCO');
      expect(res.body.data).toHaveProperty('total_assigned');
      expect(res.body.data).toHaveProperty('active_in_progress');
      expect(res.body.data).toHaveProperty('critical_or_high');
      expect(res.body.data).toHaveProperty('sla_breached');
      expect(res.body.data).toHaveProperty('capacity_rating');
    });
  });

  describe('7. Dashboard Scoping', () => {
    it('GET /api/v1/dashboard/summary returns scoped operational KPIs', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('active_problems');
      expect(res.body.data).toHaveProperty('critical_problems');
      expect(res.body.data).toHaveProperty('sla_compliance_rate');
      expect(res.body.data).toHaveProperty('scope_description');
    });

    it('GET /api/v1/dashboard/problems returns priority problems with live SLA', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/problems')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('sla_state');
        expect(res.body.data[0].sla_state).toHaveProperty('target_hours');
      }
    });

    it('GET /api/v1/dashboard/map returns geolocated clusters', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/map')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].location).toHaveProperty('lat');
        expect(res.body.data[0].location).toHaveProperty('lng');
      }
    });
  });
});
