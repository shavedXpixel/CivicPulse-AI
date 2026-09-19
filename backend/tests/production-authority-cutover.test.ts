import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider, SupabaseAuthProvider } from '../src/providers';
import { env } from '../src/config/env';
import { UserRole, UserStatus, ProblemStatus, ERROR_CODES } from '@civicpulse/shared';

// Mock Supabase admin API for isolated, deterministic invitation testing without cloud SMTP rate limits
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async (email: string, options: any) => {
            if (email === 'officer.fail@civicpulse.gov.in') {
              return { data: { user: null }, error: { message: 'SMTP relay delivery failure' } };
            }
            return {
              data: {
                user: {
                  id: `auth-invited-${email.split('@')[0]}`,
                  email,
                  user_metadata: options?.data
                }
              },
              error: null
            };
          })
        }
      }
    }))
  };
});

describe('Phase 15B.5.3.8 — Production Authority & Access Control Test Suite', () => {
  let app: any;
  let mockDb: MockDatabaseProvider;
  let testPrivateKey: any;
  let testPublicKeyJwk: any;

  const TEST_ISSUER = 'https://sihttdjkubjuizwdjmrj.supabase.co/auth/v1';
  const TEST_AUDIENCE = 'authenticated';
  const TEST_KID = 'c8a9f9b4-ec07-49dc-b1ac-bae37ec458dd';

  const ADMIN_UUID = '10000000-0000-4000-8000-000000000001';
  const ADMIN_AUTH_ID = 'auth-admin-uuid-1111';

  const DEPT_OFFICER_UUID = '10000000-0000-4000-8000-000000000002';
  const DEPT_OFFICER_AUTH_ID = 'auth-dept-watco-2222';

  const FIELD_OFFICER_UUID = '10000000-0000-4000-8000-000000000003';
  const FIELD_OFFICER_AUTH_ID = 'auth-field-watco-3333';

  const OTHER_OFFICER_UUID = '999b5d0b-e966-4215-a36e-8096c5e0c8df';
  const OTHER_OFFICER_AUTH_ID = 'auth-field-other-4444';

  const CITIZEN_UUID = '10000000-0000-4000-8000-000000000004';
  const CITIZEN_AUTH_ID = 'auth-citizen-uuid-5555';

  async function createTestToken(claims: {
    sub?: string;
    email?: string;
    role?: string;
    iss?: string;
    aud?: string;
  }): Promise<string> {
    const jwt = new SignJWT({
      email: claims.email || 'user@example.com',
      role: claims.role || 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Test Identity' }
    })
      .setProtectedHeader({ alg: 'ES256', kid: TEST_KID })
      .setSubject(claims.sub || 'test-subject')
      .setIssuer(claims.iss !== undefined ? claims.iss : TEST_ISSUER)
      .setAudience(claims.aud !== undefined ? claims.aud : TEST_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('2h');

    return await jwt.sign(testPrivateKey);
  }

  beforeAll(async () => {
    const kp = await generateKeyPair('ES256', { extractable: true });
    testPrivateKey = kp.privateKey;
    testPublicKeyJwk = await exportJWK(kp.publicKey);
    testPublicKeyJwk.kid = TEST_KID;
    testPublicKeyJwk.alg = 'ES256';
    testPublicKeyJwk.use = 'sig';

    (env as any).DEMO_MODE = false;
    (env as any).PROVIDER_MODE = 'cloud';
    (env as any).AUTH_PROVIDER = 'supabase';
    (env as any).SUPABASE_URL = 'https://sihttdjkubjuizwdjmrj.supabase.co';

    mockDb = new MockDatabaseProvider();

    // 1. Seed Municipal Admin
    await mockDb.createUser({
      id: ADMIN_UUID,
      auth_user_id: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in',
      display_name: 'Municipal Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 2. Seed WATCO Department Officer
    await mockDb.createUser({
      id: DEPT_OFFICER_UUID,
      auth_user_id: DEPT_OFFICER_AUTH_ID,
      email: 'dept.watco@civicpulse.gov.in',
      display_name: 'WATCO Department Officer',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: 'WATCO',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 3. Seed WATCO Field Officer
    await mockDb.createUser({
      id: FIELD_OFFICER_UUID,
      auth_user_id: FIELD_OFFICER_AUTH_ID,
      email: 'field.watco@civicpulse.gov.in',
      display_name: 'WATCO Field Engineer',
      role: UserRole.FIELD_OFFICER,
      department_id: 'WATCO',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 4. Seed Other Field Officer
    await mockDb.createUser({
      id: OTHER_OFFICER_UUID,
      auth_user_id: OTHER_OFFICER_AUTH_ID,
      email: 'field.other@civicpulse.gov.in',
      display_name: 'Other Field Engineer',
      role: UserRole.FIELD_OFFICER,
      department_id: 'BMC_DRAINAGE',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // 5. Seed Existing Citizen
    await mockDb.createUser({
      id: CITIZEN_UUID,
      auth_user_id: CITIZEN_AUTH_ID,
      email: 'citizen@example.com',
      display_name: 'Existing Citizen',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    await mockDb.createCitizenProfile({
      id: `prof_${CITIZEN_UUID}`,
      user_id: CITIZEN_UUID,
      preferred_language: 'en',
      notification_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Seed Department WATCO
    await mockDb.createDepartment({
      id: 'WATCO',
      name: 'Water Corporation of Odisha',
      short_name: 'WATCO',
      description: 'Municipal water supply division'
    });

    // Seed Department BMC_DRAINAGE
    await mockDb.createDepartment({
      id: 'BMC_DRAINAGE',
      name: 'BMC Drainage & Sewerage',
      short_name: 'DRAINAGE',
      description: 'Stormwater & drainage management'
    });

    // Seed a Problem Cluster assigned to FIELD_OFFICER_UUID under WATCO
    await mockDb.createProblemCluster({
      id: 'PRB-2026-AUTH-01',
      title: 'Water Main Break on VIP Road',
      description: 'Severe pipeline leak affecting Nayapalli',
      category: 'water_supply',
      department_id: 'WATCO',
      ward_id: 'WARD-018',
      status: ProblemStatus.ASSIGNED,
      assigned_to: FIELD_OFFICER_UUID,
      signal_count: 5,
      impact_score: 80,
      impact_level: 'HIGH' as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    ProviderContainer.setDatabaseProvider(mockDb);

    const testProvider = new SupabaseAuthProvider();
    (testProvider as any).jwks = async (protectedHeader: any) => {
      if (protectedHeader.kid === TEST_KID) {
        const { importJWK } = await import('jose');
        return await importJWK(testPublicKeyJwk, 'ES256');
      }
      throw new Error(`Unknown kid: ${protectedHeader.kid}`);
    };

    ProviderContainer.setAuthProvider(testProvider);

    app = createApp();
  });

  afterAll(() => {
    ProviderContainer.resetAllProviders();
  });

  // ---------------------------------------------------------------------------
  // 1. Citizen Self-Registration & Provisioning
  // ---------------------------------------------------------------------------

  it('Test 1: Citizen self-registration provisions public.users and citizen_profiles with role=CITIZEN', async () => {
    const newCitizenAuthId = 'auth-new-citizen-1001';
    const newCitizenEmail = 'newcitizen@civicpulse.org';

    const token = await createTestToken({
      sub: newCitizenAuthId,
      email: newCitizenEmail
    });

    const res = await request(app)
      .post('/api/v1/auth/register-citizen')
      .set('Authorization', `Bearer ${token}`)
      .send({ display_name: 'Savitri Devi' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(newCitizenEmail);
    expect(res.body.data.user.role).toBe(UserRole.CITIZEN);
    expect(res.body.data.user.status).toBe(UserStatus.ACTIVE);
    expect(res.body.data.citizen_profile).toBeDefined();
    expect(res.body.data.citizen_profile.user_id).toBe(res.body.data.user.id);
  });

  it('Test 2: Client CANNOT choose ADMIN role during citizen registration (server overrides to CITIZEN)', async () => {
    const exploitAuthId = 'auth-exploit-citizen-1002';
    const exploitEmail = 'exploit@civicpulse.org';

    const token = await createTestToken({
      sub: exploitAuthId,
      email: exploitEmail
    });

    const res = await request(app)
      .post('/api/v1/auth/register-citizen')
      .set('Authorization', `Bearer ${token}`)
      .send({
        display_name: 'Hacker',
        role: 'ADMIN',
        department_id: 'WATCO'
      });

    expect(res.status).toBe(200);
    // Server-side authoritative derivation enforces CITIZEN
    expect(res.body.data.user.role).toBe(UserRole.CITIZEN);
    expect(res.body.data.user.role).not.toBe(UserRole.ADMIN);
  });

  it('Test 3: Duplicate/idempotent citizen registration returns existing authoritative profile safely', async () => {
    const token = await createTestToken({
      sub: CITIZEN_AUTH_ID,
      email: 'citizen@example.com'
    });

    const res = await request(app)
      .post('/api/v1/auth/register-citizen')
      .set('Authorization', `Bearer ${token}`)
      .send({ display_name: 'Existing Citizen' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(CITIZEN_UUID);
    expect(res.body.data.user.role).toBe(UserRole.CITIZEN);
  });

  it('Test 4: Unknown JWT.sub outside explicit provisioning flow fails closed with 401 ACCOUNT_NOT_PROVISIONED', async () => {
    const unprovisionedAuthId = 'auth-unprovisioned-stranger-9999';
    const unprovisionedEmail = 'stranger@gmail.com';

    const token = await createTestToken({
      sub: unprovisionedAuthId,
      email: unprovisionedEmail
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/ACCOUNT_NOT_PROVISIONED/);
  });

  it('Test 4A: Post-confirmation session token successfully provisions citizen into public.users and citizen_profiles', async () => {
    const postConfirmAuthId = 'auth-post-confirm-citizen-2001';
    const postConfirmEmail = 'confirmed.citizen@civicpulse.org';

    const token = await createTestToken({
      sub: postConfirmAuthId,
      email: postConfirmEmail
    });

    const res = await request(app)
      .post('/api/v1/auth/register-citizen')
      .set('Authorization', `Bearer ${token}`)
      .send({ display_name: 'Confirmed Citizen' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(postConfirmEmail);
    expect(res.body.data.user.role).toBe(UserRole.CITIZEN);
    expect(res.body.data.citizen_profile.user_id).toBe(res.body.data.user.id);
  });

  it('Test 4B: Expired or tampered confirmation token calling register-citizen returns 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register-citizen')
      .set('Authorization', 'Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.tampered.token')
      .send({ display_name: 'Tampered Citizen' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
  });

  // ---------------------------------------------------------------------------
  // 2. Government & Department Provisioning RBAC Gatekeeping
  // ---------------------------------------------------------------------------

  it('Test 5: Citizen CANNOT create departments (403 Forbidden)', async () => {
    const token = await createTestToken({
      sub: CITIZEN_AUTH_ID,
      email: 'citizen@example.com'
    });

    const res = await request(app)
      .post('/api/v1/admin/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'BMC_HEALTH',
        name: 'BMC Public Health Division',
        description: 'Health & Sanitation'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('Test 6: Citizen CANNOT provision government users (403 Forbidden)', async () => {
    const token = await createTestToken({
      sub: CITIZEN_AUTH_ID,
      email: 'citizen@example.com'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer.rogue@civicpulse.gov.in',
        display_name: 'Rogue Officer',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'WATCO'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('Test 7: Field Officer CANNOT provision government users (403 Forbidden)', async () => {
    const token = await createTestToken({
      sub: FIELD_OFFICER_AUTH_ID,
      email: 'field.watco@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer.sub@civicpulse.gov.in',
        display_name: 'Sub Officer',
        role: UserRole.FIELD_OFFICER,
        department_id: 'WATCO'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('Test 8: Department Officer CANNOT provision government users (403 Forbidden)', async () => {
    const token = await createTestToken({
      sub: DEPT_OFFICER_AUTH_ID,
      email: 'dept.watco@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer.junior@civicpulse.gov.in',
        display_name: 'Junior Engineer',
        role: UserRole.FIELD_OFFICER,
        department_id: 'WATCO'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('Test 9: Admin CAN create municipal departments (201 Created)', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code: 'BMC_ELECTRICAL',
        name: 'BMC Electrical & Street Lighting',
        description: 'Municipal lighting grid maintenance'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.department.id).toBe('BMC_ELECTRICAL');
    expect(res.body.data.department.name).toBe('BMC Electrical & Street Lighting');
  });

  it('Test 10: Admin CAN provision a DEPARTMENT_OFFICER account with valid department (201 Created)', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'superintendent.roads@civicpulse.gov.in',
        display_name: 'Er. Bikram Rout',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'WATCO'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe(UserRole.DEPARTMENT_OFFICER);
    expect(res.body.data.user.department_id).toBe('WATCO');
    expect(res.body.data.user.status).toBe(UserStatus.INVITED);
  });

  it('Test 11: Admin CAN provision a FIELD_OFFICER account with valid department (201 Created)', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'inspector.patra@civicpulse.gov.in',
        display_name: 'Manoj Patra',
        role: UserRole.FIELD_OFFICER,
        department_id: 'WATCO'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe(UserRole.FIELD_OFFICER);
    expect(res.body.data.user.department_id).toBe('WATCO');
    expect(res.body.data.user.status).toBe(UserStatus.INVITED);
  });

  it('Test 12: Admin provisioning rejects non-existent department (404 Not Found)', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer.ghost@civicpulse.gov.in',
        display_name: 'Ghost Officer',
        role: UserRole.FIELD_OFFICER,
        department_id: 'NON_EXISTENT_DEPT'
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('Test 13: Admin provisioning rejects invalid government roles like CITIZEN or ADMIN (400 Bad Request)', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer.badrole@civicpulse.gov.in',
        display_name: 'Bad Role Officer',
        role: 'CITIZEN',
        department_id: 'WATCO'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('Test 13A: Admin provisioning strictly rejects requests containing a password (400 VALIDATION_ERROR)', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer.withpass@civicpulse.gov.in',
        display_name: 'Pass Attempt Officer',
        role: UserRole.FIELD_OFFICER,
        department_id: 'WATCO',
        password: 'AttemptedAdminSetPassword123!'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.message).toMatch(/Admin cannot set passwords/);
  });

  it('Test 13B: Admin provisioning NEVER returns raw invite links, tokens, or passwords', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer.safemetadata@civicpulse.gov.in',
        display_name: 'Safe Metadata Officer',
        role: UserRole.DEPARTMENT_OFFICER,
        department_id: 'WATCO'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.invitation_sent).toBe(true);
    // Invariants: Raw links, action links, tokens, passwords must NEVER be present in response
    expect(res.body.data.invite_link).toBeUndefined();
    expect(res.body.data.action_link).toBeUndefined();
    expect(res.body.data.raw_token).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('Test 13C: Government invitation failure does NOT produce false success (returns 502 and does not create user)', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/admin/users/government')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'officer.fail@civicpulse.gov.in',
        display_name: 'Failed Delivery Officer',
        role: UserRole.FIELD_OFFICER,
        department_id: 'WATCO'
      });

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(res.body.error.message).toMatch(/Failed to dispatch officer invitation email/);

    // Verify user was NOT created in database
    const users = await mockDb.listUsers();
    const found = users.find((u) => u.email === 'officer.fail@civicpulse.gov.in');
    expect(found).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // 3. Operational Isolation & Field Assignment RBAC
  // ---------------------------------------------------------------------------

  it('Test 14: Department Isolation: WATCO officer cannot act on problem belonging to BMC_DRAINAGE', async () => {
    // Seed drainage problem
    await mockDb.createProblemCluster({
      id: 'PRB-2026-DRAINAGE-01',
      title: 'Stormwater drain overflow',
      description: 'Canal blockage',
      category: 'drainage',
      department_id: 'BMC_DRAINAGE',
      ward_id: 'WARD-018',
      status: ProblemStatus.TRIAGED,
      impact_score: 75,
      impact_level: 'HIGH' as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const token = await createTestToken({
      sub: DEPT_OFFICER_AUTH_ID,
      email: 'dept.watco@civicpulse.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/problems/PRB-2026-DRAINAGE-01/assign')
      .set('Authorization', `Bearer ${token}`)
      .send({
        department_id: 'WATCO',
        assigned_to: FIELD_OFFICER_UUID,
        priority: 'HIGH'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('Test 15: Field Officer Assignment Isolation: Officer cannot submit work on unassigned problem', async () => {
    const token = await createTestToken({
      sub: OTHER_OFFICER_AUTH_ID,
      email: 'field.other@civicpulse.gov.in'
    });

    // Attempting to act on PRB-2026-AUTH-01 which is assigned to FIELD_OFFICER_UUID
    const res = await request(app)
      .patch('/api/v1/problems/PRB-2026-AUTH-01/status')
      .set('Authorization', `Bearer ${token}`)
      .send({
        status: ProblemStatus.IN_PROGRESS,
        notes: 'Attempting unauthorized progress update'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  // ---------------------------------------------------------------------------
  // 4. Zero Demo Fallback Gate in REAL_MODE
  // ---------------------------------------------------------------------------

  it('Test 16: No demo token fallback allowed in REAL_MODE (unconditionally rejected with 401)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer demo-token-admin');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/strictly forbidden in REAL_MODE/);
  });

  it('Test 17: Admin user directory lists live users truthfully without fabricated rows', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@civicpulse.gov.in'
    });

    const res = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.users)).toBe(true);
    expect(res.body.data.users.length).toBeGreaterThanOrEqual(5);

    // Verify admin user is in the list
    const foundAdmin = res.body.data.users.find((u: any) => u.email === 'admin@civicpulse.gov.in');
    expect(foundAdmin).toBeDefined();
    expect(foundAdmin.role).toBe(UserRole.ADMIN);
  });
});
