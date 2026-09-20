import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer } from '../src/providers';
import { PostgresDatabaseProvider } from '../src/providers/database/postgres.provider';
import { SignalService } from '../src/modules/signals/signal.service';
import { SignalRepository } from '../src/modules/signals/signal.repository';
import { env } from '../src/config/env';
import {
  UserProfile,
  UserRole,
  UserStatus,
  ERROR_CODES
} from '@civicpulse/shared';

// Mock storage provider for media uploads
vi.mock('../src/providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/providers')>();
  return {
    ...actual,
    getStorageProvider: vi.fn().mockReturnValue({
      getSignedUploadUrl: vi.fn().mockResolvedValue({
        uploadUrl: 'https://r2.cloudflarestorage.com/mock-bucket/signals/sig_1789895984486_kn7y7e/test.jpg?signed=true',
        storagePath: 'signals/sig_1789895984486_kn7y7e/test.jpg',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      }),
      getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.mock/download.jpg'),
      deleteFile: vi.fn().mockResolvedValue(undefined)
    })
  };
});

describe('PHASE 15B.5.3.18-HF1 — Citizen Ownership Identifier Consistency', () => {
  // Authoritative production test identities specified in HF1
  const MIGRATED_AUTH_USER_ID = '00000000-0000-4000-8000-000000000004';
  const MIGRATED_POSTGRES_USER_ID = '10000000-0000-4000-8000-000000000004';
  const MIGRATED_LEGACY_FIREBASE_UID = 'fb_uid_citizen_synthetic_04';
  const TEST_SIGNAL_ID = 'sig_1789895984486_kn7y7e';

  const migratedCitizenUser: UserProfile = {
    id: MIGRATED_POSTGRES_USER_ID,
    auth_user_id: MIGRATED_AUTH_USER_ID,
    legacy_firebase_uid: MIGRATED_LEGACY_FIREBASE_UID,
    email: 'citizen2@example.com',
    display_name: 'Pupu Citizen',
    role: UserRole.CITIZEN,
    status: UserStatus.ACTIVE,
    created_at: new Date('2026-09-15T00:00:00.000Z').toISOString(),
    updated_at: new Date('2026-09-15T00:00:00.000Z').toISOString()
  };

  const otherCitizenUser: UserProfile = {
    id: 'b0e1ce1b-b054-4d8c-ac81-b87a8400741b',
    auth_user_id: 'b17a68fb-1191-4a93-aa34-c39746d004c2',
    email: 'other.citizen@bhubaneswar.local',
    display_name: 'Other Citizen',
    role: UserRole.CITIZEN,
    status: UserStatus.ACTIVE,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const departmentOfficerUser: UserProfile = {
    id: 'd0e1ce1b-b054-4d8c-ac81-b87a8400741d',
    auth_user_id: 'd17a68fb-1191-4a93-aa34-c39746d004c3',
    email: 'officer@example.com',
    display_name: 'WATCO Officer',
    role: UserRole.DEPARTMENT_OFFICER,
    status: UserStatus.ACTIVE,
    department_id: 'WATCO',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Canonical raw DB row from PostgreSQL signals table joined with users
  const rawSignalRow = {
    id: TEST_SIGNAL_ID,
    citizen_id: MIGRATED_POSTGRES_USER_ID, // PostgreSQL UUID in signals table
    citizen_legacy_uid: MIGRATED_LEGACY_FIREBASE_UID, // from users.legacy_firebase_uid join
    source_type: 'CITIZEN',
    original_text: 'Potable water distribution / pipeline rupture at Ward 18',
    normalized_text: 'Potable water distribution / pipeline rupture at Ward 18',
    category: 'WATER_SUPPLY',
    subcategory: 'PIPELINE_RUPTURE',
    department_id: 'WATCO',
    recommended_department: 'WATCO',
    severity: 'HIGH',
    language: 'en',
    status: 'ACTIVE',
    processing_status: 'PENDING',
    latitude: '20.2961',
    longitude: '85.8245',
    location_reference: 'BMC Ward 18, Bhubaneswar',
    ward_id: 'WARD-018',
    media_ids: [],
    created_at: new Date('2026-09-20T09:00:00.000Z'),
    submitted_at: new Date('2026-09-20T09:00:00.000Z'),
    updated_at: new Date('2026-09-20T09:00:00.000Z')
  };

  let mockPool: any;
  let provider: PostgresDatabaseProvider;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn()
      }),
      end: vi.fn().mockResolvedValue(undefined)
    };
    provider = new PostgresDatabaseProvider({ pool: mockPool as any });
  });

  describe('1. PostgresDatabaseProvider Identifier Contract', () => {
    it('maps Signal.citizen_id to signals.citizen_id (PostgreSQL UUID) and citizen_legacy_uid as separate metadata', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });

      const signal = await provider.getSignal(TEST_SIGNAL_ID);
      expect(signal).not.toBeNull();

      // STRICT INVARIANT: citizen_id MUST be the PostgreSQL UUID
      expect(signal?.citizen_id).toBe(MIGRATED_POSTGRES_USER_ID);
      expect(signal?.citizen_id).not.toBe(MIGRATED_LEGACY_FIREBASE_UID);

      // Separate metadata preserved
      expect(signal?.citizen_legacy_uid).toBe(MIGRATED_LEGACY_FIREBASE_UID);
    });

    it('returns PostgreSQL UUID as citizen_id across listSignals results', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });

      const result = await provider.listSignals({ citizen_id: MIGRATED_POSTGRES_USER_ID });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].citizen_id).toBe(MIGRATED_POSTGRES_USER_ID);
      expect(result.data[0].citizen_legacy_uid).toBe(MIGRATED_LEGACY_FIREBASE_UID);
    });

    it('getUserByAuthId returns authoritative PostgreSQL UUID as user.id with legacy_firebase_uid metadata', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: MIGRATED_POSTGRES_USER_ID,
            auth_user_id: MIGRATED_AUTH_USER_ID,
            legacy_firebase_uid: MIGRATED_LEGACY_FIREBASE_UID,
            email: 'citizen2@example.com',
            display_name: 'Pupu Citizen',
            role: 'CITIZEN',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const user = await provider.getUserByAuthId(MIGRATED_AUTH_USER_ID);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(MIGRATED_POSTGRES_USER_ID);
      expect(user?.auth_user_id).toBe(MIGRATED_AUTH_USER_ID);
      expect(user?.legacy_firebase_uid).toBe(MIGRATED_LEGACY_FIREBASE_UID);
    });

    it('getUser by UUID returns authoritative PostgreSQL UUID as user.id', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: MIGRATED_POSTGRES_USER_ID,
            auth_user_id: MIGRATED_AUTH_USER_ID,
            legacy_firebase_uid: MIGRATED_LEGACY_FIREBASE_UID,
            email: 'citizen2@example.com',
            display_name: 'Pupu Citizen',
            role: 'CITIZEN',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const user = await provider.getUser(MIGRATED_POSTGRES_USER_ID);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(MIGRATED_POSTGRES_USER_ID);
      expect(user?.legacy_firebase_uid).toBe(MIGRATED_LEGACY_FIREBASE_UID);
    });
  });

  describe('2. SignalService Ownership & Media Authorization (HF1 Scenarios)', () => {
    let service: SignalService;

    beforeEach(() => {
      ProviderContainer.setDatabaseProvider(provider);
      service = new SignalService(new SignalRepository());
    });

    // SCENARIO A: Migrated citizen can access their own signal
    it('Scenario A: Migrated citizen can access their own signal', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });

      const signal = await service.getSignal(migratedCitizenUser, TEST_SIGNAL_ID);
      expect(signal).toBeDefined();
      expect(signal.id).toBe(TEST_SIGNAL_ID);
      expect(signal.citizen_id).toBe(MIGRATED_POSTGRES_USER_ID);
      expect(signal.citizen_legacy_uid).toBe(MIGRATED_LEGACY_FIREBASE_UID);
    });

    // SCENARIO B: Migrated citizen can register media against their own signal
    it('Scenario B: Migrated citizen can register media against their own signal', async () => {
      // 1. findById query for ownership verification
      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });
      // 2. createSignalMedia insert
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const mediaResponse = await service.registerMedia(migratedCitizenUser, TEST_SIGNAL_ID, {
        file_name: 'pipe_burst.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 2 * 1024 * 1024
      });

      expect(mediaResponse).toBeDefined();
      expect(mediaResponse.media_id).toMatch(/^med_/);
      expect(mediaResponse.upload_url).toBeDefined();
      expect(mediaResponse.storage_path).toBeDefined();
    });

    // SCENARIO C: Migrated citizen cannot register media against another citizen signal
    it('Scenario C: Migrated citizen cannot register media against another citizen signal', async () => {
      // Signal owned by otherCitizenUser
      const otherCitizenSignalRow = {
        ...rawSignalRow,
        id: 'sig_other_user_123',
        citizen_id: otherCitizenUser.id,
        citizen_legacy_uid: null
      };

      mockPool.query.mockResolvedValueOnce({ rows: [otherCitizenSignalRow] });

      await expect(
        service.registerMedia(migratedCitizenUser, 'sig_other_user_123', {
          file_name: 'intruder_photo.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 1024 * 500
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: expect.stringContaining('Cannot attach media to a signal you do not own')
      });
    });

    // SCENARIO D: Legacy Firebase UID is not substituted for public.users.id
    it('Scenario D: Legacy Firebase UID is NOT substituted for public.users.id', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });

      const signal = await service.getSignal(migratedCitizenUser, TEST_SIGNAL_ID);

      // Verify that citizen_id is strictly a valid UUID and not the 28-char legacy UID
      expect(signal.citizen_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(signal.citizen_id).not.toBe(MIGRATED_LEGACY_FIREBASE_UID);

      // If a request arrived with user.id mistakenly set to the legacy Firebase UID,
      // it MUST be rejected because signals.citizen_id is the authoritative PostgreSQL UUID
      const userWithLegacyId: UserProfile = {
        ...migratedCitizenUser,
        id: MIGRATED_LEGACY_FIREBASE_UID // Invalid: using legacy UID as primary authorization ID
      };

      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });
      await expect(
        service.registerMedia(userWithLegacyId, TEST_SIGNAL_ID, {
          file_name: 'pipe_burst.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 1024
        })
      ).rejects.toMatchObject({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: expect.stringContaining('Cannot attach media to a signal you do not own')
      });
    });

    // SCENARIO E: Explicit proof for the exact production identities specified in user prompt
    it('Scenario E: Explicit proof for approved test identity (a17a68fb, a0e1ce1b, sPAuiLRS)', async () => {
      // Identity specified:
      // auth_user_id: 00000000-0000-4000-8000-000000000004
      // PostgreSQL user.id: 10000000-0000-4000-8000-000000000004
      // legacy Firebase UID: fb_uid_citizen_synthetic_04
      const authSub = '00000000-0000-4000-8000-000000000004';
      const pgUuid = '10000000-0000-4000-8000-000000000004';
      const legacyUid = 'fb_uid_citizen_synthetic_04';

      // 1. Auth resolution step: SELECT * FROM users WHERE auth_user_id = sub
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: pgUuid,
            auth_user_id: authSub,
            legacy_firebase_uid: legacyUid,
            email: 'citizen2@example.com',
            display_name: 'Pupu Citizen',
            role: 'CITIZEN',
            status: 'ACTIVE',
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const resolvedUser = await provider.getUserByAuthId(authSub);
      expect(resolvedUser).not.toBeNull();
      expect(resolvedUser!.id).toBe(pgUuid);
      expect(resolvedUser!.auth_user_id).toBe(authSub);
      expect(resolvedUser!.legacy_firebase_uid).toBe(legacyUid);

      // 2. Database fetch of signal sig_1789895984486_kn7y7e
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            ...rawSignalRow,
            citizen_id: pgUuid,
            citizen_legacy_uid: legacyUid
          }
        ]
      });

      const retrievedSignal = await provider.getSignal(TEST_SIGNAL_ID);
      expect(retrievedSignal).not.toBeNull();
      expect(retrievedSignal!.citizen_id).toBe(pgUuid);
      expect(retrievedSignal!.citizen_id).toBe(resolvedUser!.id);

      // 3. Media registration by resolvedUser succeeds
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            ...rawSignalRow,
            citizen_id: pgUuid,
            citizen_legacy_uid: legacyUid
          }
        ]
      });
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const regResult = await service.registerMedia(resolvedUser!, TEST_SIGNAL_ID, {
        file_name: 'pipeline_rupture.jpg',
        mime_type: 'image/jpeg',
        file_size_bytes: 1024 * 1024
      });

      expect(regResult.media_id).toBeDefined();
      expect(regResult.upload_url).toBeDefined();
    });

    // SCENARIO F: Existing non-citizen authorization behavior remains unchanged
    it('Scenario F: Non-citizen authorization behavior remains unchanged', async () => {
      // 1. WATCO Department Officer can access signal in their department
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            ...rawSignalRow,
            department_id: 'WATCO',
            recommended_department: 'WATCO'
          }
        ]
      });

      const officerSignal = await service.getSignal(departmentOfficerUser, TEST_SIGNAL_ID);
      expect(officerSignal).toBeDefined();
      expect(officerSignal.id).toBe(TEST_SIGNAL_ID);

      // 2. Department Officer denied access to signal of a different department
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            ...rawSignalRow,
            department_id: 'TPCODL',
            recommended_department: 'TPCODL'
          }
        ]
      });

      await expect(
        service.getSignal(departmentOfficerUser, TEST_SIGNAL_ID)
      ).rejects.toMatchObject({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: expect.stringContaining('Access denied to signals outside your department')
      });
    });
  });

  describe('3. HTTP End-to-End Scoping via App Routes', () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
      // Configure REAL_MODE with Supabase auth provider
      (env as any).DEMO_MODE = false;
      (env as any).AUTH_PROVIDER = 'supabase';

      const mockAuthProvider = {
        verifyToken: vi.fn().mockImplementation(async (token: string) => {
          if (token === 'migrated-owner-token') {
            return { uid: MIGRATED_AUTH_USER_ID, email: 'citizen2@example.com' };
          }
          if (token === 'stranger-citizen-token') {
            return { uid: otherCitizenUser.auth_user_id, email: otherCitizenUser.email };
          }
          throw new Error('Invalid token');
        }),
        getUser: vi.fn(),
        createUser: vi.fn(),
        deleteUser: vi.fn(),
        createCustomToken: vi.fn()
      };

      ProviderContainer.setDatabaseProvider(provider);
      ProviderContainer.setAuthProvider(mockAuthProvider as any);
      app = createApp();
    });

    it('GET /api/v1/signals/:id allows citizen owner using PostgreSQL UUID and rejects stranger', async () => {
      // 1. Stranger citizen attempts to access the signal -> 404
      // getUserByAuthId lookup in auth middleware:
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: otherCitizenUser.id,
            auth_user_id: otherCitizenUser.auth_user_id,
            role: 'CITIZEN',
            status: 'ACTIVE',
            display_name: 'Other'
          }
        ]
      });
      // Route getSignal query:
      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });

      const forbiddenRes = await request(app)
        .get(`/api/v1/signals/${TEST_SIGNAL_ID}`)
        .set('Authorization', 'Bearer stranger-citizen-token');

      expect(forbiddenRes.status).toBe(404);
      expect(forbiddenRes.body.error.code).toBe('NOT_FOUND');

      // 2. Owner citizen using PostgreSQL UUID -> 200
      // getUserByAuthId lookup in auth middleware:
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: MIGRATED_POSTGRES_USER_ID,
            auth_user_id: MIGRATED_AUTH_USER_ID,
            legacy_firebase_uid: MIGRATED_LEGACY_FIREBASE_UID,
            role: 'CITIZEN',
            status: 'ACTIVE',
            display_name: 'Owner'
          }
        ]
      });
      // Route getSignal query:
      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });

      const ownerRes = await request(app)
        .get(`/api/v1/signals/${TEST_SIGNAL_ID}`)
        .set('Authorization', 'Bearer migrated-owner-token');

      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.data.id).toBe(TEST_SIGNAL_ID);
      expect(ownerRes.body.data.citizen_id).toBe(MIGRATED_POSTGRES_USER_ID);
    });

    it('POST /api/v1/signals/:id/media allows owner citizen to register media', async () => {
      // getUserByAuthId lookup in auth middleware:
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: MIGRATED_POSTGRES_USER_ID,
            auth_user_id: MIGRATED_AUTH_USER_ID,
            legacy_firebase_uid: MIGRATED_LEGACY_FIREBASE_UID,
            role: 'CITIZEN',
            status: 'ACTIVE',
            display_name: 'Owner'
          }
        ]
      });
      // Route getSignal query for ownership verification:
      mockPool.query.mockResolvedValueOnce({ rows: [rawSignalRow] });
      // Insert media record into signal_media:
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const mediaRes = await request(app)
        .post(`/api/v1/signals/${TEST_SIGNAL_ID}/media`)
        .set('Authorization', 'Bearer migrated-owner-token')
        .send({
          file_name: 'repair.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 500000
        });

      expect(mediaRes.status).toBe(201);
      expect(mediaRes.body.data.media_id).toBeDefined();
      expect(mediaRes.body.data.upload_url).toBeDefined();
    });
  });
});
