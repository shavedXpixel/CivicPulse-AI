import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider, MockEmailProvider } from '../src/providers';
import { UserRole, UserStatus, ProblemStatus, ImpactLevel } from '@civicpulse/shared';
import { GovernanceTools } from '../src/modules/governance/governance.tools';

// Mock @supabase/supabase-js to isolate tests
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn().mockImplementation(() => ({
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({ data: { user: { id: 'usr_mock' } }, error: null }),
          generateLink: vi.fn().mockResolvedValue({ data: { properties: { action_link: 'http://localhost/invite' } }, error: null }),
          getUserById: vi.fn().mockResolvedValue({ data: { user: { id: 'usr_mock' } }, error: null }),
          updateUserById: vi.fn().mockResolvedValue({ data: { user: { id: 'usr_mock' } }, error: null })
        }
      }
    }))
  };
});

describe('Phase 15B.5.3.17 — Role-Specific Workspaces & Dedicated Directory Pages Scoping', () => {
  let app: any;
  let db: MockDatabaseProvider;
  let emailProvider: MockEmailProvider;
  const originalDemoMode = env.DEMO_MODE;

  beforeEach(async () => {
    (env as any).DEMO_MODE = true;
    db = new MockDatabaseProvider();
    ProviderContainer.setDatabaseProvider(db);
    emailProvider = new MockEmailProvider();
    ProviderContainer.setEmailProvider(emailProvider);

    // Setup Departments: WATCO (Active), BMC_DRAINAGE (Active), INACTIVE_DEPT (Inactive)
    await db.createDepartment({
      id: 'WATCO',
      short_name: 'WATCO',
      name: 'Water Corporation of Odisha',
      description: 'Potable water supply and distribution',
      status: 'ACTIVE'
    });

    await db.createDepartment({
      id: 'BMC_DRAINAGE',
      short_name: 'DRAINAGE',
      name: 'BMC Drainage & Sewerage Department',
      description: 'Stormwater drainage and flood prevention',
      status: 'ACTIVE'
    });

    await db.createDepartment({
      id: 'INACTIVE_DEPT',
      short_name: 'INACT',
      name: 'Decommissioned Heritage Board',
      description: 'Historical department now inactive',
      status: 'INACTIVE'
    });

    // Setup Test Problems
    const watcoProblem = {
      id: 'PRB-WATCO-01',
      title: 'Water Pipe Rupture in Saheed Nagar',
      description: 'Major drinking water distribution line burst',
      category: 'water_supply',
      subcategory: 'pipe_burst',
      department_id: 'WATCO',
      assigned_to: 'usr_officer_01',
      ward_id: 'WARD-018',
      location: { lat: 20.2961, lng: 85.8245 },
      status: ProblemStatus.ASSIGNED,
      signal_count: 15,
      impact_score: 82,
      impact_level: ImpactLevel.HIGH,
      severity_score: 22,
      population_score: 18,
      duration_score: 12,
      concentration_score: 12,
      critical_exposure_score: 8,
      recurrence_score: 6,
      evidence_score: 4,
      first_detected_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const drainageProblem = {
      id: 'PRB-DRAINAGE-01',
      title: 'Severe Storm Drain Blockage in Acharya Vihar',
      description: 'Drain clogged with debris causing street inundation',
      category: 'drainage',
      subcategory: 'waterlogging',
      department_id: 'BMC_DRAINAGE',
      assigned_to: 'usr_field_drainage',
      ward_id: 'WARD-012',
      location: { lat: 20.3015, lng: 85.8312 },
      status: ProblemStatus.TRIAGED,
      signal_count: 8,
      impact_score: 75,
      impact_level: ImpactLevel.HIGH,
      severity_score: 20,
      population_score: 16,
      duration_score: 11,
      concentration_score: 11,
      critical_exposure_score: 7,
      recurrence_score: 6,
      evidence_score: 4,
      first_detected_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    await db.createProblemCluster(watcoProblem as any);
    await db.createProblemCluster(drainageProblem as any);

    // Setup Assignments
    // WATCO problem assigned to Field Officer 1 (usr_officer_01)
    await db.createAssignment({
      id: 'ASG-WATCO-01',
      problem_id: 'PRB-WATCO-01',
      assigned_to: 'usr_officer_01',
      department_id: 'WATCO',
      assigned_by: 'usr_admin_01',
      priority: 'HIGH' as any,
      status: 'ASSIGNED' as any,
      assigned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Drainage problem assigned to Field Officer Drainage (usr_field_drainage)
    await db.createAssignment({
      id: 'ASG-DRAINAGE-01',
      problem_id: 'PRB-DRAINAGE-01',
      assigned_to: 'usr_field_drainage',
      department_id: 'BMC_DRAINAGE',
      assigned_by: 'usr_admin_01',
      priority: 'HIGH' as any,
      status: 'ASSIGNED' as any,
      assigned_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    app = createApp();
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.setEmailProvider(null);
    vi.clearAllMocks();
  });

  describe('1. Department Officer Server-Side Scoping', () => {
    it('allows department officer to access own department workload', async () => {
      const res = await request(app)
        .get('/api/v1/departments/WATCO/workload')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.department_id).toBe('WATCO');
    });

    it('denies department officer access to another department workload (403)', async () => {
      const res = await request(app)
        .get('/api/v1/departments/BMC_DRAINAGE/workload')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('Authorized only for WATCO');
    });

    it('denies department officer access to another department officers list (403)', async () => {
      const res = await request(app)
        .get('/api/v1/departments/BMC_DRAINAGE/officers')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows department officer to access problem belonging to own department', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-WATCO-01')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('PRB-WATCO-01');
      expect(res.body.data.department_id).toBe('WATCO');
    });

    it('denies department officer access to problem belonging to another department (403)', async () => {
      const res = await request(app)
        .get('/api/v1/problems/PRB-DRAINAGE-01')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('cannot view problem belonging to BMC_DRAINAGE');
    });

    it('automatically scopes listProblems to caller department even if query param attempts cross-department', async () => {
      const res = await request(app)
        .get('/api/v1/problems?department_id=BMC_DRAINAGE')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      for (const prob of res.body.data) {
        expect(prob.department_id).toBe('WATCO');
      }
    });

    it('denies department officer querying another department assignments (403)', async () => {
      const res = await request(app)
        .get('/api/v1/assignments?department_id=BMC_DRAINAGE')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies department officer calling getTrend on another department in GovernanceTools', async () => {
      const watcoUser = await db.getUser('usr_dept_watco');
      expect(watcoUser).toBeDefined();

      await expect(
        GovernanceTools.getTrend(watcoUser!, {
          department_id: 'BMC_DRAINAGE'
        })
      ).rejects.toThrow(/Department officer cannot query cross-department intelligence/);
    });

    it('denies department officer access to /admin/* endpoints (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('2. Field Officer Server-Side Scoping', () => {
    it('allows field officer to retrieve own assignments', async () => {
      const res = await request(app)
        .get('/api/v1/assignments?assigned_to=usr_officer_01')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].assigned_to).toBe('usr_officer_01');
    });

    it('denies field officer querying another field officer assignments (403)', async () => {
      const res = await request(app)
        .get('/api/v1/assignments?assigned_to=usr_field_drainage')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain("another officer's assignments");
    });

    it('automatically defaults to caller assignments when no filter is provided', async () => {
      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      for (const asg of res.body.data) {
        expect(asg.assigned_to).toBe('usr_officer_01');
      }
    });

    it('denies field officer modifying/acting on another officer assigned problem (403)', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-DRAINAGE-01/actions')
        .set('Authorization', 'Bearer demo-token-officer')
        .send({
          action: 'STARTED_WORK',
          note: 'Attempting to work on unassigned drainage task'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('assigned');
    });

    it('allows field officer to transition work on their assigned problem', async () => {
      const res = await request(app)
        .post('/api/v1/problems/PRB-WATCO-01/actions')
        .set('Authorization', 'Bearer demo-token-officer')
        .send({
          action: 'STARTED_WORK',
          note: 'Field crew arrived on site at Saheed Nagar'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.action).toBeDefined();
      expect(res.body.data.action.action_type).toBe('STARTED_WORK');
      if (res.body.data.problem) {
        expect(res.body.data.problem.status).toBe(ProblemStatus.IN_PROGRESS);
      }
    });

    it('denies field officer access to /admin/* endpoints (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', 'Bearer demo-token-officer');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('3. Citizen Access Restrictions', () => {
    it('denies citizen access to government dashboard summary (403)', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/summary')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies citizen access to department workload telemetry (403)', async () => {
      const res = await request(app)
        .get('/api/v1/departments/WATCO/workload')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies citizen access to government assignments (403)', async () => {
      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies citizen access to admin user directory (403)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies citizen disabling government staff (403)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/usr_officer_01/disable')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('4. Department Registry & Inactive State Enforcement', () => {
    it('displays inactive departments in the general registry', async () => {
      const res = await request(app)
        .get('/api/v1/departments')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();

      const inactive = res.body.data.find((d: any) => d.id === 'INACTIVE_DEPT');
      expect(inactive).toBeDefined();
      expect(inactive.status).toBe('INACTIVE');
    });

    it('rejects provisioning new staff to an INACTIVE department (400)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'officer_inactive@bmc.gov.in',
          full_name: 'Inactive Dept Officer',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'INACTIVE_DEPT'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('inactive department');
    });

    it('allows ADMIN to update department details and status', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/departments/WATCO')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          status: 'INACTIVE',
          description: 'Temporarily deactivated for organizational restructuring'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.department.status).toBe('INACTIVE');

      // Now attempting to provision to WATCO should fail
      const provRes = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'new_watco_worker@watco.odisha.gov.in',
          full_name: 'Rohan Senapati',
          role: UserRole.FIELD_OFFICER,
          department_id: 'WATCO'
        });

      expect(provRes.status).toBe(400);
      expect(provRes.body.error.message).toContain('inactive department');
    });
  });

  describe('5. Staff Lifecycle Action Matrix & Admin Protections', () => {
    it('prevents an administrator from disabling their own account (400)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/usr_admin_01/disable')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Administrators cannot disable their own');
    });

    it('rejects resend-invite on an already ACTIVE user (400)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/usr_officer_01/resend-invite')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('already activated');
    });

    it('allows disabling and re-enabling government field officers', async () => {
      // Disable
      const disableRes = await request(app)
        .post('/api/v1/admin/users/usr_officer_01/disable')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(disableRes.status).toBe(200);
      expect(disableRes.body.data.user.status).toBe(UserStatus.INACTIVE);

      // Verify disabled officer cannot perform authenticated actions
      const actionRes = await request(app)
        .post('/api/v1/problems/PRB-WATCO-01/actions')
        .set('Authorization', 'Bearer demo-token-officer')
        .send({
          action: 'STARTED_WORK',
          note: 'Should fail because account is disabled'
        });

      expect(actionRes.status).toBe(403);

      // Re-enable
      const enableRes = await request(app)
        .post('/api/v1/admin/users/usr_officer_01/enable')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(enableRes.status).toBe(200);
      expect(enableRes.body.data.user.status).toBe(UserStatus.ACTIVE);
    });
  });
});
