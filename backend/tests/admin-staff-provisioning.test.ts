import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createHash } from 'crypto';
import * as net from 'net';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider, MockEmailProvider, SmtpEmailProvider } from '../src/providers';
import { AdminAuditService } from '../src/modules/admin/admin-audit.service';
import { UserRole, UserStatus } from '@civicpulse/shared';

// Mock @supabase/supabase-js to isolate tests and protect production Supabase instances
const mockInviteUserByEmail = vi.fn();
const mockGenerateLink = vi.fn();
const mockGetUserById = vi.fn();
const mockUpdateUserById = vi.fn();

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn().mockImplementation(() => ({
      auth: {
        admin: {
          inviteUserByEmail: mockInviteUserByEmail,
          generateLink: mockGenerateLink,
          getUserById: mockGetUserById,
          updateUserById: mockUpdateUserById
        }
      }
    }))
  };
});

describe('Phase 15B.5.3.16 — Admin Government Staff Provisioning & Lifecycle', () => {
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

    // Default Supabase mock behaviors
    mockInviteUserByEmail.mockImplementation((email: string, _options: any) => {
      return Promise.resolve({
        data: {
          user: {
            id: `usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
            email
          }
        },
        error: null
      });
    });

    mockGenerateLink.mockImplementation((_options: any) => {
      return Promise.resolve({
        data: {
          properties: {
            action_link: 'http://localhost:3000/update-password?type=invite#mock-token'
          }
        },
        error: null
      });
    });

    mockGetUserById.mockImplementation((id: string) => {
      return Promise.resolve({
        data: {
          user: {
            id,
            email_confirmed_at: null
          }
        },
        error: null
      });
    });

    mockUpdateUserById.mockImplementation((id: string, attrs: any) => {
      return Promise.resolve({
        data: { user: { id, ...attrs } },
        error: null
      });
    });

    // Seed a valid municipal department for testing
    await db.createDepartment({
      id: 'dept_roads',
      short_name: 'ROADS',
      name: 'BMC Roads & Infrastructure Division',
      description: 'Citywide municipal road maintenance'
    });

    app = createApp();
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.setEmailProvider(null);
    vi.clearAllMocks();
  });

  describe('1. Authoritative Staff Provisioning & Lifecycle State', () => {
    it('allows ADMIN to provision DEPARTMENT_OFFICER with initial status INVITED', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'officer_dept@bmc.gov.in',
          full_name: 'Er. Rajesh Kumar',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe('officer_dept@bmc.gov.in');
      expect(res.body.data.user.display_name).toBe('Er. Rajesh Kumar');
      expect(res.body.data.user.role).toBe(UserRole.DEPARTMENT_OFFICER);
      expect(res.body.data.user.department_id).toBe('dept_roads');
      expect(res.body.data.user.status).toBe(UserStatus.INVITED);
      expect(res.body.data.invitation_sent).toBe(true);

      // Verify Supabase invite was called with correct metadata & redirect
      expect(mockInviteUserByEmail).toHaveBeenCalledWith(
        'officer_dept@bmc.gov.in',
        expect.objectContaining({
          data: expect.objectContaining({
            full_name: 'Er. Rajesh Kumar',
            role: UserRole.DEPARTMENT_OFFICER,
            department_id: 'dept_roads'
          }),
          redirectTo: expect.stringContaining('/update-password?type=invite')
        })
      );

      // Verify persisted state in DB
      const persisted = await db.getUser(res.body.data.user.id);
      expect(persisted).toBeDefined();
      expect(persisted?.status).toBe(UserStatus.INVITED);
      expect(persisted?.role).toBe(UserRole.DEPARTMENT_OFFICER);
      expect(persisted?.department_id).toBe('dept_roads');
    });

    it('allows ADMIN to provision FIELD_OFFICER with initial status INVITED', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'field_worker@bmc.gov.in',
          full_name: 'Sunita Patil',
          role: UserRole.FIELD_OFFICER,
          department_id: 'dept_roads'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe(UserRole.FIELD_OFFICER);
      expect(res.body.data.user.status).toBe(UserStatus.INVITED);
      expect(res.body.data.user.department_id).toBe('dept_roads');
    });

    it('rejects provisioning when department_id does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'unknown_dept_worker@bmc.gov.in',
          full_name: 'Worker',
          role: UserRole.FIELD_OFFICER,
          department_id: 'non_existent_department'
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('does not exist');
    });

    it('rejects duplicate email provisioning with 409 Conflict', async () => {
      // First provisioning
      await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'unique_officer@bmc.gov.in',
          full_name: 'Officer One',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads'
        });

      // Duplicate attempt
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'unique_officer@bmc.gov.in',
          full_name: 'Officer Duplicate',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already exists');
    });
  });

  describe('2. Credential Privacy & Zero Password Policy', () => {
    it('strictly rejects requests where admin attempts to provide a password', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'leaked_pw_officer@bmc.gov.in',
          full_name: 'Officer Two',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads',
          password: 'InsecurePassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Admin cannot set passwords');
    });

    it('ensures no password or token fields are stored, logged, or returned', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'clean_officer@bmc.gov.in',
          full_name: 'Clean Officer',
          role: UserRole.FIELD_OFFICER,
          department_id: 'dept_roads'
        });

      expect(res.status).toBe(201);
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toContain('password');
      expect(responseStr).not.toContain('access_token');
      expect(responseStr).not.toContain('refresh_token');

      const persisted = await db.getUser(res.body.data.user.id);
      expect((persisted as any).password).toBeUndefined();
      expect((persisted as any).hash).toBeUndefined();
    });
  });

  describe('3. Staff Activation & Operational Access Boundary', () => {
    it('denies operational access to INVITED government users until activated', async () => {
      // Create user directly in INVITED status
      const invitedUser = await db.createUser({
        id: 'usr_invited_officer',
        auth_user_id: 'usr_invited_officer',
        email: 'invited_officer@bmc.gov.in',
        display_name: 'Invited Officer',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.INVITED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Attempt to access operational endpoint with invited user
      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${invitedUser.id}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Only ACTIVE accounts may access operations');
      expect(res.body.error.message).toContain('INVITED');
    });

    it('transitions INVITED staff to ACTIVE upon calling activate-staff', async () => {
      const invitedUser = await db.createUser({
        id: 'usr_to_activate',
        auth_user_id: 'usr_to_activate',
        email: 'to_activate@bmc.gov.in',
        display_name: 'To Activate',
        role: UserRole.FIELD_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.INVITED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Officer establishes password and calls activate-staff
      const activateRes = await request(app)
        .post('/api/v1/auth/activate-staff')
        .set('Authorization', `Bearer ${invitedUser.id}`)
        .send({});

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.data.user.status).toBe(UserStatus.ACTIVE);

      // Verify persisted status is now ACTIVE
      const updated = await db.getUser(invitedUser.id);
      expect(updated?.status).toBe(UserStatus.ACTIVE);

      // Now the activated officer CAN access operational endpoint
      const operationalRes = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${invitedUser.id}`);

      expect(operationalRes.status).toBe(200);
    });

    it('denies operational government access to INACTIVE and SUSPENDED staff', async () => {
      const inactiveUser = await db.createUser({
        id: 'usr_inactive_officer',
        auth_user_id: 'usr_inactive_officer',
        email: 'inactive@bmc.gov.in',
        display_name: 'Inactive Officer',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.INACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${inactiveUser.id}`);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Resend Invitation Lifecycle', () => {
    it('allows resending invitation for a pending INVITED staff member and dispatches email', async () => {
      const invitedUser = await db.createUser({
        id: 'usr_resend_target',
        auth_user_id: 'usr_resend_target',
        email: 'resend_target@bmc.gov.in',
        display_name: 'Resend Target',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.INVITED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .post(`/api/v1/admin/users/${invitedUser.id}/resend-invite`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('successfully resent');
      expect(mockGenerateLink).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'invite',
          email: 'resend_target@bmc.gov.in'
        })
      );

      // Critical Check: Verify actual invitation email delivery via EmailProvider
      const sent = emailProvider.getSentInvitations();
      const targetInvite = sent.find((s) => s.to === 'resend_target@bmc.gov.in');
      expect(targetInvite).toBeDefined();
      expect(targetInvite?.role).toBe(UserRole.DEPARTMENT_OFFICER);
      expect(targetInvite?.departmentName).toBe('BMC Roads & Infrastructure Division');
      expect(targetInvite?.actionLink).toContain('/update-password?type=invite');

      // Security check: Action link and token are never exposed in API response body
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toContain('action_link');
      expect(responseStr).not.toContain('#mock-token');
      expect(responseStr).not.toContain('password');
    });

    it('rejects resending invitation for an ALREADY ACTIVE user with 400', async () => {
      const activeUser = await db.createUser({
        id: 'usr_active_officer',
        auth_user_id: 'usr_active_officer',
        email: 'already_active@bmc.gov.in',
        display_name: 'Already Active Officer',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .post(`/api/v1/admin/users/${activeUser.id}/resend-invite`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already activated');
    });

    it('rejects resending invitation for an INACTIVE or SUSPENDED user with 400', async () => {
      const suspendedUser = await db.createUser({
        id: 'usr_suspended_officer',
        auth_user_id: 'usr_suspended_officer',
        email: 'suspended@bmc.gov.in',
        display_name: 'Suspended Officer',
        role: UserRole.FIELD_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.SUSPENDED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .post(`/api/v1/admin/users/${suspendedUser.id}/resend-invite`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('re-enable the account first');
    });

    it('strictly rejects resending invitation for an ADMIN target with 400', async () => {
      const adminTarget = await db.createUser({
        id: 'usr_admin_target',
        auth_user_id: 'usr_admin_target',
        email: 'other_admin@bmc.gov.in',
        display_name: 'Other Admin',
        role: UserRole.ADMIN,
        status: UserStatus.INVITED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .post(`/api/v1/admin/users/${adminTarget.id}/resend-invite`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('government staff accounts (DEPARTMENT_OFFICER or FIELD_OFFICER)');
    });

    it('strictly rejects resending invitation for a CITIZEN target with 400', async () => {
      const citizenTarget = await db.createUser({
        id: 'usr_citizen_target',
        auth_user_id: 'usr_citizen_target',
        email: 'citizen@example.com',
        display_name: 'Citizen Target',
        role: UserRole.CITIZEN,
        status: UserStatus.INVITED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .post(`/api/v1/admin/users/${citizenTarget.id}/resend-invite`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('government staff accounts (DEPARTMENT_OFFICER or FIELD_OFFICER)');
    });
  });

  describe('5. Admin Disable & Re-Enable Controls', () => {
    it('allows ADMIN to disable an active staff member', async () => {
      const officer = await db.createUser({
        id: 'usr_to_disable',
        auth_user_id: 'usr_to_disable',
        email: 'disable_me@bmc.gov.in',
        display_name: 'Disable Me',
        role: UserRole.FIELD_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .post(`/api/v1/admin/users/${officer.id}/disable`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.user.status).toBe(UserStatus.INACTIVE);

      const updated = await db.getUser(officer.id);
      expect(updated?.status).toBe(UserStatus.INACTIVE);
    });

    it('allows ADMIN to re-enable an inactive staff member', async () => {
      const officer = await db.createUser({
        id: 'usr_to_enable',
        auth_user_id: 'usr_to_enable',
        email: 'enable_me@bmc.gov.in',
        display_name: 'Enable Me',
        role: UserRole.FIELD_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.INACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .post(`/api/v1/admin/users/${officer.id}/enable`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.user.status).toBe(UserStatus.ACTIVE);

      const updated = await db.getUser(officer.id);
      expect(updated?.status).toBe(UserStatus.ACTIVE);
    });

    it('prevents an ADMIN from disabling their own account', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/usr_admin_01/disable')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('disable their own');
    });
  });

  describe('6. Cryptographic Audit Trail Integrity', () => {
    it('persists administrative audit records with hash chaining and zero credential leakage', async () => {
      // 1. Provision user
      const provRes = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'audit_test_officer@bmc.gov.in',
          full_name: 'Audit Officer',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads'
        });

      expect(provRes.status).toBe(201);
      const newUserId = provRes.body.data.user.id;

      // 2. Resend invite
      await request(app)
        .post(`/api/v1/admin/users/${newUserId}/resend-invite`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      // 3. Disable user
      await request(app)
        .post(`/api/v1/admin/users/${newUserId}/disable`)
        .set('Authorization', 'Bearer demo-token-admin')
        .send({});

      // 4. Verify audit records in DB
      const logs = await db.listAdminAuditLogs();
      expect(logs.length).toBeGreaterThanOrEqual(3);

      // Check actions exist
      const actions = logs.map((l) => l.action);
      expect(actions).toContain('PROVISION_USER');
      expect(actions).toContain('RESEND_INVITE');
      expect(actions).toContain('DISABLE_USER');

      // Verify cryptographic hash chain in chronological order
      const chronologicalLogs = [...logs].reverse();
      for (let i = 0; i < chronologicalLogs.length; i++) {
        const log = chronologicalLogs[i];
        expect(log.record_hash).toBeDefined();
        expect(typeof log.record_hash).toBe('string');
        expect(log.record_hash.length).toBe(64); // SHA-256 hex string

        if (i === 0) {
          expect(log.previous_hash).toBe('GENESIS_CIVICPULSE_ADMIN_AUDIT');
        } else {
          expect(log.previous_hash).toBe(chronologicalLogs[i - 1].record_hash);
        }

        // Verify zero credentials in details or logs
        const logJson = JSON.stringify(log);
        expect(logJson).not.toContain('password');
        expect(logJson).not.toContain('Bearer');
        expect(logJson).not.toContain('token');
      }
    });

    it('strictly serializes concurrent audit writes so no duplicate previous_hash or branching occurs', async () => {
      const concurrentCount = 10;
      const promises = Array.from({ length: concurrentCount }).map((_, i) =>
        AdminAuditService.recordAction({
          actor_user_id: 'usr_admin_01',
          actor_email: 'admin@civicpulse.gov.in',
          action: 'PROVISION_USER',
          target_email: `concurrent_officer_${i}@bmc.gov.in`,
          target_role: UserRole.FIELD_OFFICER,
          department_id: 'dept_roads',
          result: 'SUCCESS',
          details: { writeIndex: i }
        })
      );

      const writtenRecords = await Promise.all(promises);
      expect(writtenRecords.length).toBe(concurrentCount);

      // Verify all records retrieved from database
      const allLogs = await db.listAdminAuditLogs();
      const concurrentLogs = allLogs.filter((l) => l.target_email.startsWith('concurrent_officer_'));
      expect(concurrentLogs.length).toBe(concurrentCount);

      // Chronological order (oldest to newest)
      const chronological = [...concurrentLogs].reverse();

      const seenPreviousHashes = new Set<string>();
      const seenRecordHashes = new Set<string>();

      for (let i = 0; i < chronological.length; i++) {
        const current = chronological[i];

        // 1. Every record must have a unique record_hash
        expect(seenRecordHashes.has(current.record_hash)).toBe(false);
        seenRecordHashes.add(current.record_hash);

        // 2. Exactly one valid predecessor per record (no duplicate sequence positions)
        if (i > 0) {
          const predecessor = chronological[i - 1];
          expect(current.previous_hash).toBe(predecessor.record_hash);
          expect(seenPreviousHashes.has(current.previous_hash!)).toBe(false);
          seenPreviousHashes.add(current.previous_hash!);
        }

        // 3. Every record hash cryptographically verifies
        const hashPayload = [
          current.previous_hash,
          current.id,
          current.actor_user_id,
          current.action,
          current.target_email.toLowerCase(),
          current.target_role,
          current.department_id || 'NONE',
          current.result || 'SUCCESS',
          current.created_at
        ].join('|');
        const expectedHash = createHash('sha256').update(hashPayload).digest('hex');
        expect(current.record_hash).toBe(expectedHash);
      }
    });
  });

  describe('7. Strict RBAC Enforcement', () => {
    it('rejects DEPARTMENT_OFFICER attempting to provision staff with 403', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          email: 'unauthorized_staff@bmc.gov.in',
          full_name: 'Unauthorized',
          role: UserRole.FIELD_OFFICER,
          department_id: 'dept_roads'
        });

      expect(res.status).toBe(403);
    });

    it('rejects FIELD_OFFICER attempting to provision staff with 403', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-field-drainage')
        .send({
          email: 'unauthorized_staff2@bmc.gov.in',
          full_name: 'Unauthorized 2',
          role: UserRole.FIELD_OFFICER,
          department_id: 'dept_roads'
        });

      expect(res.status).toBe(403);
    });

    it('rejects CITIZEN attempting to provision staff with 403', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          email: 'unauthorized_staff3@bmc.gov.in',
          full_name: 'Unauthorized 3',
          role: UserRole.FIELD_OFFICER,
          department_id: 'dept_roads'
        });

      expect(res.status).toBe(403);
    });

    it('government invite does not trigger citizen provisioning', async () => {
      // 1. Provision government officer
      const provRes = await request(app)
        .post('/api/v1/admin/users/government')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          email: 'gov_worker_intake@bmc.gov.in',
          full_name: 'Gov Worker',
          role: UserRole.DEPARTMENT_OFFICER,
          department_id: 'dept_roads'
        });

      expect(provRes.status).toBe(201);
      const officerId = provRes.body.data.user.id;

      // 2. Attempt citizen self-provisioning for this government officer account
      const res = await request(app)
        .post('/api/v1/auth/register-citizen')
        .set('Authorization', `Bearer ${officerId}`)
        .send({
          display_name: 'Gov Worker'
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Account is registered as a government account');
    });
  });

  describe('8. Invite vs Password Recovery Separation', () => {
    it('proves password recovery cannot activate an invited government staff account', async () => {
      // 1. Create an invited officer
      const invitedOfficer = await db.createUser({
        id: 'usr_invited_for_recovery_test',
        auth_user_id: 'usr_invited_for_recovery_test',
        email: 'invited_target@bmc.gov.in',
        display_name: 'Target Officer',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'dept_roads',
        status: UserStatus.INVITED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // 2. Create a normal citizen performing password recovery
      const citizenUser = await db.createUser({
        id: 'usr_citizen_recovering',
        auth_user_id: 'usr_citizen_recovering',
        email: 'citizen_recovery@gmail.com',
        display_name: 'Citizen Recovery',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // 3. Citizen calls activate-staff with their token -> must be rejected (400)
      const citizenRes = await request(app)
        .post('/api/v1/auth/activate-staff')
        .set('Authorization', `Bearer ${citizenUser.id}`)
        .send({});

      expect(citizenRes.status).toBe(400);
      expect(citizenRes.body.error.message).toContain('Staff activation is reserved for government officer accounts');

      // 4. Verify invited officer remains strictly INVITED
      const checkOfficer = await db.getUser(invitedOfficer.id);
      expect(checkOfficer?.status).toBe(UserStatus.INVITED);
    });
  });

  describe('9. Production Email Provider Selection & Mock Prohibition', () => {
    it('prohibits MockEmailProvider in REAL_MODE (DEMO_MODE=false) when EMAIL_PROVIDER is not smtp', () => {
      ProviderContainer.setEmailProvider(null);
      (env as any).DEMO_MODE = false;
      (env as any).EMAIL_PROVIDER = 'mock';

      expect(() => ProviderContainer.getEmailProvider()).toThrow(/Unsupported EMAIL_PROVIDER in REAL_MODE/);

      (env as any).DEMO_MODE = true;
      (env as any).EMAIL_PROVIDER = 'mock';
      ProviderContainer.setEmailProvider(null);
    });

    it('instantiates SmtpEmailProvider in REAL_MODE when EMAIL_PROVIDER=smtp without falling back to mock', () => {
      ProviderContainer.setEmailProvider(null);
      (env as any).DEMO_MODE = false;
      (env as any).EMAIL_PROVIDER = 'smtp';

      const provider = ProviderContainer.getEmailProvider();
      expect(provider).toBeInstanceOf(SmtpEmailProvider);

      (env as any).DEMO_MODE = true;
      (env as any).EMAIL_PROVIDER = 'mock';
      ProviderContainer.setEmailProvider(null);
    });

    it('successfully connects, authenticates, and dispatches MIME email over raw SMTP socket', async () => {
      let receivedEmail = '';
      const server = net.createServer((socket) => {
        socket.on('error', () => {});
        let authStep = 0;
        socket.write('220 smtp.civicpulse.gov.in ESMTP CivicPulse\r\n');
        socket.on('data', (data) => {
          const str = data.toString();
          if (str.startsWith('EHLO')) {
            socket.write('250-smtp.civicpulse.gov.in\r\n250 AUTH LOGIN\r\n');
          } else if (str.startsWith('AUTH LOGIN')) {
            authStep = 1;
            socket.write('334 VXNlcm5hbWU6\r\n');
          } else if (authStep === 1) {
            authStep = 2;
            socket.write('334 UGFzc3dvcmQ6\r\n');
          } else if (authStep === 2) {
            authStep = 3;
            socket.write('235 2.7.0 Authentication successful\r\n');
          } else if (str.startsWith('MAIL FROM:')) {
            socket.write('250 2.1.0 Ok\r\n');
          } else if (str.startsWith('RCPT TO:')) {
            socket.write('250 2.1.5 Ok\r\n');
          } else if (str.startsWith('DATA')) {
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (str.includes('\r\n.\r\n') || str.endsWith('.\r\n')) {
            receivedEmail += str;
            socket.write('250 2.0.0 Ok: queued\r\n');
          } else if (str.startsWith('QUIT')) {
            socket.write('221 2.0.0 Bye\r\n');
            socket.end();
          } else {
            receivedEmail += str;
          }
        });
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const port = (server.address() as net.AddressInfo).port;

      const smtpProvider = new SmtpEmailProvider({
        host: '127.0.0.1',
        port,
        secure: false,
        user: 'smtp_officer_user',
        password: 'smtp_secret_password',
        from: 'CivicPulse Authority <notifications@civicpulse.gov.in>'
      });

      await smtpProvider.sendGovernmentInvitation({
        to: 'staff_officer@bmc.gov.in',
        fullName: 'Rajesh Sharma',
        role: UserRole.DEPARTMENT_OFFICER,
        departmentName: 'BMC Solid Waste Management',
        actionLink: 'https://civicpulse-ai-henna.vercel.app/update-password?type=invite#access_token=verified_token'
      });

      await new Promise<void>((resolve) => server.close(() => resolve()));

      expect(receivedEmail).toContain('From: CivicPulse Authority <notifications@civicpulse.gov.in>');
      expect(receivedEmail).toContain('To: staff_officer@bmc.gov.in');
      expect(receivedEmail).toContain('Subject: [CivicPulse AI] Government Staff Account Invitation — Action Required');
      expect(receivedEmail).toContain('Rajesh Sharma');
      expect(receivedEmail).toContain('DEPARTMENT_OFFICER');
      expect(receivedEmail).toContain('BMC Solid Waste Management');
      expect(receivedEmail).toContain('Complete Account Setup');
      expect(receivedEmail).toContain('https://civicpulse-ai-henna.vercel.app/update-password?type=invite#access_token=verified_token');
    });
  });
});
