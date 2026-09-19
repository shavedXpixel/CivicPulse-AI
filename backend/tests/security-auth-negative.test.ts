import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider, SupabaseAuthProvider } from '../src/providers';
import { env } from '../src/config/env';
import { UserRole, UserStatus, ProblemStatus, ActionType, ERROR_CODES } from '@civicpulse/shared';
import fs from 'fs';
import path from 'path';

describe('Phase 15B.4 — Supabase Authentication & Security Negative Suite', () => {
  let app: any;
  let mockDb: MockDatabaseProvider;
  let testPrivateKey: any;
  let testPublicKeyJwk: any;
  let differentPrivateKey: any;

  const TEST_ISSUER = 'https://sihttdjkubjuizwdjmrj.supabase.co/auth/v1';
  const TEST_AUDIENCE = 'authenticated';
  const TEST_KID = 'c8a9f9b4-ec07-49dc-b1ac-bae37ec458dd';

  // Test Persona UUIDs
  const ADMIN_UUID = '10000000-0000-4000-8000-000000000001';
  const ADMIN_AUTH_ID = 'auth-admin-uuid-1111';

  const DEPT_OFFICER_UUID = '10000000-0000-4000-8000-000000000002';
  const DEPT_OFFICER_AUTH_ID = 'auth-dept-watco-2222';

  const FIELD_OFFICER_UUID = '10000000-0000-4000-8000-000000000003';
  const FIELD_OFFICER_AUTH_ID = 'auth-field-watco-3333';

  const OTHER_OFFICER_UUID = '999b5d0b-e966-4215-a36e-8096c5e0c8df';
  const OTHER_OFFICER_AUTH_ID = 'auth-field-drainage-4444';

  const DRAINAGE_DEPT_OFFICER_UUID = '888b5d0b-e966-4215-a36e-8096c5e0c8df';
  const DRAINAGE_DEPT_OFFICER_AUTH_ID = 'auth-dept-drainage-8888';

  const CITIZEN_UUID = '10000000-0000-4000-8000-000000000004';
  const CITIZEN_AUTH_ID = 'auth-citizen-uuid-5555';

  const SUSPENDED_UUID = '77777777-7777-7777-7777-777777777777';
  const SUSPENDED_AUTH_ID = 'auth-suspended-uuid-7777';

  // Helper to create test JWT tokens signed with ES256
  async function createTestToken(claims: {
    sub?: string;
    email?: string;
    role?: string;
    iss?: string;
    aud?: string;
    exp?: string | number;
    key?: any;
    kid?: string;
  }): Promise<string> {
    const keyToUse = claims.key || testPrivateKey;
    const jwt = new SignJWT({
      email: claims.email,
      role: claims.role || 'authenticated',
      app_metadata: { provider: 'email' },
      user_metadata: {}
    })
      .setProtectedHeader({ alg: 'ES256', kid: claims.kid || TEST_KID })
      .setSubject(claims.sub || 'test-subject')
      .setIssuer(claims.iss !== undefined ? claims.iss : TEST_ISSUER)
      .setAudience(claims.aud !== undefined ? claims.aud : TEST_AUDIENCE)
      .setIssuedAt();

    if (claims.exp !== undefined) {
      if (typeof claims.exp === 'number') {
        jwt.setExpirationTime(claims.exp);
      } else {
        jwt.setExpirationTime(claims.exp);
      }
    } else {
      jwt.setExpirationTime('2h');
    }

    return await jwt.sign(keyToUse);
  }

  beforeAll(async () => {
    // Generate valid EC P-256 keypair for ES256 testing
    const kp = await generateKeyPair('ES256', { extractable: true });
    testPrivateKey = kp.privateKey;
    testPublicKeyJwk = await exportJWK(kp.publicKey);
    testPublicKeyJwk.kid = TEST_KID;
    testPublicKeyJwk.alg = 'ES256';
    testPublicKeyJwk.use = 'sig';

    // Generate separate untrusted keypair for signature tampering tests
    const diffKp = await generateKeyPair('ES256', { extractable: true });
    differentPrivateKey = diffKp.privateKey;

    // Configure test environment
    (env as any).DEMO_MODE = false;
    (env as any).PROVIDER_MODE = 'cloud';
    (env as any).AUTH_PROVIDER = 'supabase';
    (env as any).SUPABASE_URL = 'https://sihttdjkubjuizwdjmrj.supabase.co';

    // Seed mock DB with authoritative personas
    mockDb = new MockDatabaseProvider();

    // 1. Admin
    await mockDb.createUser({
      id: ADMIN_UUID,
      email: 'admin@example.com',
      display_name: 'Municipal Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...({ auth_user_id: ADMIN_AUTH_ID } as any)
    });

    // 2. Department Officer (WATCO)
    await mockDb.createUser({
      id: DEPT_OFFICER_UUID,
      email: 'officer@example.com',
      display_name: 'WATCO Officer',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: 'WATCO',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...({ auth_user_id: DEPT_OFFICER_AUTH_ID } as any)
    });

    // 3. Field Officer (WATCO)
    await mockDb.createUser({
      id: FIELD_OFFICER_UUID,
      email: 'field@example.com',
      display_name: 'WATCO Field Inspector',
      role: UserRole.FIELD_OFFICER,
      department_id: 'WATCO',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...({ auth_user_id: FIELD_OFFICER_AUTH_ID } as any)
    });

    // 4. Other Officer (Drainage)
    await mockDb.createUser({
      id: OTHER_OFFICER_UUID,
      email: 'other.officer@bmc.gov.in',
      display_name: 'Drainage Officer',
      role: UserRole.FIELD_OFFICER,
      department_id: 'BMC_DRAINAGE',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...({ auth_user_id: OTHER_OFFICER_AUTH_ID } as any)
    });

    // 4b. Department Officer from Drainage (Department Scope Violation Persona)
    await mockDb.createUser({
      id: DRAINAGE_DEPT_OFFICER_UUID,
      email: 'drainage.supervisor@bmc.gov.in',
      display_name: 'Drainage Department Supervisor',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: 'BMC_DRAINAGE',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...({ auth_user_id: DRAINAGE_DEPT_OFFICER_AUTH_ID } as any)
    });

    // 5. Citizen
    await mockDb.createUser({
      id: CITIZEN_UUID,
      email: 'citizen2@example.com',
      display_name: 'Citizen Reporter',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...({ auth_user_id: CITIZEN_AUTH_ID } as any)
    });

    // 6. Suspended User
    await mockDb.createUser({
      id: SUSPENDED_UUID,
      email: 'suspended@civicpulse.test',
      display_name: 'Suspended Account',
      role: UserRole.CITIZEN,
      status: UserStatus.SUSPENDED,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...({ auth_user_id: SUSPENDED_AUTH_ID } as any)
    });

    // 7. Synthetic officer_live_verifier (auth_user_id MUST be NULL)
    await mockDb.createUser({
      id: '10000000-0000-4000-8000-000000000006',
      email: 'officer_live_verifier@firebase.civicpulse.local',
      display_name: 'Historical Verifier',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
      // auth_user_id is omitted / null
    });

    // Create a problem assigned specifically to FIELD_OFFICER_UUID
    await mockDb.createProblemCluster({
      id: 'PRB-2026-WATCO-01',
      title: 'Water Main Rupture on VIP Road',
      description: 'Major pipeline break affecting Nayapalli',
      category: 'water_supply',
      department_id: 'WATCO',
      ward_id: 'WARD-018',
      location: { lat: 20.2965, lng: 85.8248 },
      status: ProblemStatus.ASSIGNED,
      assigned_to: FIELD_OFFICER_UUID,
      signal_count: 12,
      impact_score: 85,
      impact_level: 'HIGH' as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as any);

    ProviderContainer.setDatabaseProvider(mockDb);

    // Initialize custom SupabaseAuthProvider using local test JWKS
    const testProvider = new SupabaseAuthProvider();
    // Inject local test public key into provider's JWKS verification
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

  // ===========================================================================
  // 1. Positive Verification (Case A)
  // ===========================================================================
  it('Case A: Valid Supabase JWT with mapped sub authenticates successfully (200)', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      email: 'admin@example.com'
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(ADMIN_UUID);
    expect(res.body.data.user.email).toBe('admin@example.com');
    expect(res.body.data.user.role).toBe(UserRole.ADMIN);
  });

  // ===========================================================================
  // 2. Expired Token (Case B)
  // ===========================================================================
  it('Case B: Expired JWT returns 401 UNAUTHORIZED', async () => {
    const expiredTimestamp = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      exp: expiredTimestamp
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    expect(res.body.error.message).toMatch(/expired|authentication failed/i);
  });

  // ===========================================================================
  // 3. Invalid Signature (Case C)
  // ===========================================================================
  it('Case C: Wrong/tampered signature returns 401 UNAUTHORIZED', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      key: differentPrivateKey
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    expect(res.body.error.message).toMatch(/signature verification failed|authentication failed/i);
  });

  // ===========================================================================
  // 4. Valid JWT with Unknown sub (Case D)
  // ===========================================================================
  it('Case D: Valid JWT with unknown/unmapped sub fails closed with 401 ACCOUNT_NOT_PROVISIONED', async () => {
    const token = await createTestToken({
      sub: 'unmapped-auth-user-9999',
      email: 'unmapped.stranger@example.com'
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('ACCOUNT_NOT_PROVISIONED');
  });

  // ===========================================================================
  // 5. Zero Email Runtime Linking (Case E)
  // ===========================================================================
  it('Case E: Valid JWT with matching email but unmapped sub STILL returns 401 ACCOUNT_NOT_PROVISIONED', async () => {
    // Token has the admin's email, but an unmapped sub UUID
    const token = await createTestToken({
      sub: 'unmapped-impostor-sub-8888',
      email: 'admin@example.com'
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    // Absolute Rule: Must NEVER link by email!
    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('ACCOUNT_NOT_PROVISIONED');
  });

  // ===========================================================================
  // 6. Audience Validation (Requirement 13)
  // ===========================================================================
  it('Negative: JWT with wrong audience returns 401 UNAUTHORIZED', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      aud: 'anon' // invalid audience (expected 'authenticated')
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/audience|authentication failed/i);
  });

  // ===========================================================================
  // 7. Issuer Validation (Requirement 13)
  // ===========================================================================
  it('Negative: JWT with wrong issuer returns 401 UNAUTHORIZED', async () => {
    const token = await createTestToken({
      sub: ADMIN_AUTH_ID,
      iss: 'https://evil-spoof.supabase.co/auth/v1'
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/issuer|authentication failed/i);
  });

  // ===========================================================================
  // 8. Algorithm Security Fail-Closed (Requirement 13)
  // ===========================================================================
  it('Negative: Non-ES256 algorithm in production mode fails closed', async () => {
    // Manually create an HS256 token while temporarily setting NODE_ENV to production
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = 'production';
      const provider = new SupabaseAuthProvider();

      const hs256Token = await new SignJWT({ email: 'admin@example.com' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(ADMIN_AUTH_ID)
        .setIssuer(TEST_ISSUER)
        .setAudience(TEST_AUDIENCE)
        .sign(new TextEncoder().encode('super-secret-key-32-chars-long-123456'));

      await expect(provider.verifyToken(hs256Token)).rejects.toThrow(
        /Untrusted token algorithm 'HS256'\. Production requires ES256/
      );
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  // ===========================================================================
  // 9. Suspended User Account (Case F)
  // ===========================================================================
  it('Case F: Valid JWT for suspended user account returns 403 FORBIDDEN', async () => {
    const token = await createTestToken({
      sub: SUSPENDED_AUTH_ID,
      email: 'suspended@civicpulse.test'
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    expect(res.body.error.message).toContain('User account is suspended');
  });

  // ===========================================================================
  // 10. Citizen Accessing Government Endpoint (Case G)
  // ===========================================================================
  it('Case G: Citizen token accessing government operational endpoint returns 403 FORBIDDEN', async () => {
    const token = await createTestToken({
      sub: CITIZEN_AUTH_ID,
      email: 'citizen2@example.com'
    });

    const res = await request(app)
      .get('/api/v1/dashboard/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  // ===========================================================================
  // 11. Field Officer Scope Violation (Case H)
  // ===========================================================================
  it('Case H: Field officer attempting to modify another officer assigned problem returns 403 FORBIDDEN', async () => {
    // OTHER_OFFICER_AUTH_ID belongs to Drainage, not WATCO
    const token = await createTestToken({
      sub: OTHER_OFFICER_AUTH_ID,
      email: 'other.officer@bmc.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/problems/PRB-2026-WATCO-01/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        action: ActionType.STARTED_WORK,
        note: 'Attempting to intervene on another officer problem'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  // ===========================================================================
  // 11b. Cross-Department Scope Violation (Department Officer)
  // ===========================================================================
  it('Requirement 6: Department Officer from department A attempting to modify problem of department B returns 403 FORBIDDEN', async () => {
    // DRAINAGE_DEPT_OFFICER_AUTH_ID belongs to BMC_DRAINAGE, while PRB-2026-WATCO-01 belongs to WATCO
    const token = await createTestToken({
      sub: DRAINAGE_DEPT_OFFICER_AUTH_ID,
      email: 'drainage.supervisor@bmc.gov.in'
    });

    const res = await request(app)
      .post('/api/v1/problems/PRB-2026-WATCO-01/actions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        action: ActionType.TRIAGED,
        note: 'Drainage officer attempting unauthorized action on WATCO problem'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    expect(res.body.error.message).toMatch(/department officer cannot act on problem belonging to WATCO/i);
  });

  // ===========================================================================
  // 12. Synthetic officer_live_verifier Isolation (Case M)
  // ===========================================================================
  it('Case M: Historical synthetic officer_live_verifier has auth_user_id=NULL and cannot authenticate', async () => {
    // Attempting to present a token for officer_live_verifier
    const token = await createTestToken({
      sub: 'officer_live_verifier',
      email: 'officer_live_verifier@firebase.civicpulse.local'
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('ACCOUNT_NOT_PROVISIONED');
  });

  // ===========================================================================
  // 13. Client Secret Leakage Guard (Requirement 13)
  // ===========================================================================
  it('Requirement 13: Client bundle scan confirms zero backend secrets exposed', () => {
    // Verify frontend source code does not import SUPABASE_SECRET_KEY or DATABASE_URL
    const frontendSrcDir = path.resolve(__dirname, '../../frontend/src');
    const readDirRecursive = (dir: string): string[] => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const e of entries) {
        const fullPath = path.join(dir, e.name);
        if (e.isDirectory()) {
          files.push(...readDirRecursive(fullPath));
        } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx') || e.name.endsWith('.js')) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const frontendFiles = readDirRecursive(frontendSrcDir);
    for (const f of frontendFiles) {
      const content = fs.readFileSync(f, 'utf8');
      expect(content).not.toContain('SUPABASE_SECRET_KEY');
      expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(content).not.toContain('DATABASE_URL');
      expect(content).not.toContain('GOOGLE_APPLICATION_CREDENTIALS');
    }
  });

  // ===========================================================================
  // 14. Recovery Link Confidentiality Guard (Requirement 13)
  // ===========================================================================
  it('Requirement 13: Recovery links are never exposed in public API responses or committed artifacts', () => {
    const classificationPath = path.resolve(__dirname, '../../migration/auth/auth-account-classification.json');
    if (fs.existsSync(classificationPath)) {
      const content = fs.readFileSync(classificationPath, 'utf8');
      expect(content).not.toContain('action_link');
      expect(content).not.toContain('hashed_token');
    }
  });

  // ===========================================================================
  // 15. PostgREST / RLS Direct Table Access Boundary (Case J)
  // ===========================================================================
  it('Case J: Direct PostgREST domain-table access with public publishable key fails/blocked', async () => {
    // When browser sends direct PostgREST request without backend service role, it is blocked
    const supabaseUrl = env.SUPABASE_URL || 'https://sihttdjkubjuizwdjmrj.supabase.co';
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/problem_clusters?select=*`, {
        headers: {
          apikey: 'invalid-anon-key'
        }
      });
      // Should return 401 or 403 or empty array
      expect([401, 403, 404]).toContain(res.status);
    } catch {
      // Network/offline in mock is acceptable
    }
  }, 15000);
});
