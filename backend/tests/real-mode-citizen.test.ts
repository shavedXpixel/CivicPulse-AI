import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider } from '../src/providers';
import { env } from '../src/config/env';
import { UserRole, UserStatus, ERROR_CODES } from '@civicpulse/shared';
import * as firebaseAdminModule from '../src/infrastructure/firebase/firebase-admin';

describe('Phase 10 Step 3: Real-Mode Authentication & Citizen Reporting', () => {
  let app: ReturnType<typeof createApp>;
  const originalDemoMode = env.DEMO_MODE;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ProviderContainer.resetAllProviders();
    ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());
    app = createApp();

    mockVerifyIdToken = vi.fn();
    vi.spyOn(firebaseAdminModule, 'getFirebaseAuth').mockReturnValue({
      verifyIdToken: mockVerifyIdToken
    } as any);
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.resetAllProviders();
    vi.restoreAllMocks();
  });

  describe('1. REAL_MODE Authentication & Server Provisioning', () => {
    beforeEach(() => {
      (env as any).DEMO_MODE = false;
    });

    it('rejects unauthenticated requests to protected endpoints with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/v1/signals/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('rejects requests with malformed Authorization header with 401', async () => {
      const res = await request(app)
        .get('/api/v1/signals/me')
        .set('Authorization', 'InvalidTokenStructure');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('handles expired or invalid Firebase ID token with 401 UNAUTHORIZED', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired.'));

      const res = await request(app)
        .get('/api/v1/signals/me')
        .set('Authorization', 'Bearer expired-firebase-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(res.body.error.message).toContain('Firebase ID token has expired');
    });

    it('verifies valid Firebase token and auto-provisions new user as CITIZEN in database', async () => {
      const uid = 'firebase_citizen_999';
      mockVerifyIdToken.mockResolvedValue({
        uid,
        email: 'realcitizen@bhubaneswar.gov.in',
        name: 'Smita Mohanty'
      });

      const res = await request(app)
        .get('/api/v1/signals/me')
        .set('Authorization', 'Bearer valid-firebase-token-999');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      // Verify the user was created in the database with CITIZEN role
      const db = ProviderContainer.getDatabaseProvider();
      const user = await db.getUser(uid);
      expect(user).not.toBeNull();
      expect(user?.id).toBe(uid);
      expect(user?.role).toBe(UserRole.CITIZEN);
      expect(user?.status).toBe(UserStatus.ACTIVE);
      expect(user?.display_name).toBe('Smita Mohanty');
      expect(user?.email).toBe('realcitizen@bhubaneswar.gov.in');

      // Verify CitizenProfile was also created
      const profile = await db.getCitizenProfile(uid);
      expect(profile).not.toBeNull();
      expect(profile?.user_id).toBe(uid);
    });

    it('rejects suspended accounts with 403 FORBIDDEN even with a valid token', async () => {
      const uid = 'firebase_suspended_01';
      const db = ProviderContainer.getDatabaseProvider();
      await db.createUser({
        id: uid,
        email: 'suspended@example.com',
        display_name: 'Suspended Citizen',
        role: UserRole.CITIZEN,
        status: UserStatus.SUSPENDED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      mockVerifyIdToken.mockResolvedValue({
        uid,
        email: 'suspended@example.com'
      });

      const res = await request(app)
        .get('/api/v1/signals/me')
        .set('Authorization', 'Bearer suspended-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(res.body.error.message).toContain('suspended');
    });
  });

  describe('2. REAL_MODE Citizen Reporting & Scoping', () => {
    const citizenUidA = 'citizen_alpha_01';
    const citizenUidB = 'citizen_beta_02';

    beforeEach(() => {
      (env as any).DEMO_MODE = false;
    });

    it('submits a real citizen report with GPS coordinates and does NOT silently assign Ward 18', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: citizenUidA,
        email: 'alpha@bhubaneswar.local'
      });

      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer token-alpha')
        .send({
          original_text: 'Major water leakage from municipal mains near Block B Janpath',
          location: { lat: 20.2882, lng: 85.8436 },
          location_reference: 'Near Block B Market Square, Saheed Nagar'
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toMatch(/^sig_/);
      expect(res.body.data.citizen_id).toBe(citizenUidA);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.processing_status).toBe('PENDING');
      // Crucial: In REAL_MODE, does NOT silently default to Ward 18 / Nayapalli
      expect(res.body.data.ward_id).not.toBe('WARD-018');
      expect(['REAL', 'UNKNOWN']).toContain(res.body.data.geography_provenance);
    });

    it('enriches ward when geography provider matches coordinates in REAL_MODE', async () => {
      mockVerifyIdToken.mockResolvedValue({
        uid: citizenUidA,
        email: 'alpha@bhubaneswar.local'
      });

      ProviderContainer.setGeographyProvider({
        getWardByCoordinates: vi.fn().mockResolvedValue({
          ward_id: 'WARD-004',
          ward_name: 'Ward 04 (Saheed Nagar)',
          provenance: 'REAL'
        }),
        getWardById: vi.fn(),
        listWards: vi.fn()
      } as any);

      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer token-alpha')
        .send({
          original_text: 'Major water leakage from municipal mains near Block B Janpath',
          location: { lat: 20.2882, lng: 85.8436 }
        });

      expect(res.status).toBe(201);
      expect(res.body.data.ward_id).toBe('WARD-004');
      expect(res.body.data.ward_name).toBe('Ward 04 (Saheed Nagar)');
      expect(res.body.data.geography_provenance).toBe('REAL');
    });

    it('enforces privacy: Citizen B receives 404 when querying Citizen A private signal', async () => {
      // Citizen A creates a report
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: citizenUidA,
        email: 'alpha@bhubaneswar.local'
      });

      const createRes = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer token-alpha')
        .send({
          original_text: 'Private water issue at Citizen A residence',
          location: { lat: 20.2961, lng: 85.8245 }
        });

      const signalId = createRes.body.data.id;

      // Citizen A can read it
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: citizenUidA,
        email: 'alpha@bhubaneswar.local'
      });
      const readResA = await request(app)
        .get(`/api/v1/signals/${signalId}`)
        .set('Authorization', 'Bearer token-alpha');
      expect(readResA.status).toBe(200);
      expect(readResA.body.data.id).toBe(signalId);

      // Citizen B tries to read it -> 404 NOT_FOUND
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: citizenUidB,
        email: 'beta@bhubaneswar.local'
      });
      const readResB = await request(app)
        .get(`/api/v1/signals/${signalId}`)
        .set('Authorization', 'Bearer token-beta');
      expect(readResB.status).toBe(404);
      expect(readResB.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('isolates /api/v1/signals/me: returns only authenticated citizen signals', async () => {
      // Citizen A creates a signal
      mockVerifyIdToken.mockResolvedValue({
        uid: citizenUidA,
        email: 'alpha@bhubaneswar.local'
      });

      await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer token-alpha')
        .send({
          original_text: 'Citizen Alpha unique signal text for isolation verification',
          location: { lat: 20.2961, lng: 85.8245 }
        });

      // Citizen B requests their reports -> should be empty (no cross-citizen leak, no Golden Demo leak)
      mockVerifyIdToken.mockResolvedValue({
        uid: citizenUidB,
        email: 'beta@bhubaneswar.local'
      });

      const resB = await request(app)
        .get('/api/v1/signals/me')
        .set('Authorization', 'Bearer token-beta');

      expect(resB.status).toBe(200);
      expect(resB.body.data).toHaveLength(0);

      // Citizen A requests their reports -> returns their 1 signal
      mockVerifyIdToken.mockResolvedValue({
        uid: citizenUidA,
        email: 'alpha@bhubaneswar.local'
      });

      const resA = await request(app)
        .get('/api/v1/signals/me')
        .set('Authorization', 'Bearer token-alpha');

      expect(resA.status).toBe(200);
      expect(resA.body.data).toHaveLength(1);
      expect(resA.body.data[0].citizen_id).toBe(citizenUidA);
      expect(resA.body.data[0].original_text).toContain('Citizen Alpha unique signal');
    });
  });

  describe('3. REAL_MODE Media Flow & Validation', () => {
    const citizenUid = 'citizen_media_user';
    let userSignalId: string;

    beforeEach(async () => {
      (env as any).DEMO_MODE = false;
      mockVerifyIdToken.mockResolvedValue({
        uid: citizenUid,
        email: 'mediauser@bhubaneswar.local'
      });

      const createRes = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer token-media')
        .send({
          original_text: 'Broken road with severe potholes after pipeline excavation',
          location: { lat: 20.2589, lng: 85.7876 }
        });

      userSignalId = createRes.body.data.id;
    });

    it('successfully registers media on owned signal within 10MB limit', async () => {
      const res = await request(app)
        .post(`/api/v1/signals/${userSignalId}/media`)
        .set('Authorization', 'Bearer token-media')
        .send({
          file_name: 'road_damage_photo.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 4 * 1024 * 1024 // 4 MB
        });

      expect(res.status).toBe(201);
      expect(res.body.data.media_id).toBeDefined();
      expect(res.body.data.upload_url).toBeDefined();
    });

    it('rejects media exceeding 10MB Canonical MVP Limit with 400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post(`/api/v1/signals/${userSignalId}/media`)
        .set('Authorization', 'Bearer token-media')
        .send({
          file_name: 'huge_video.mp4',
          mime_type: 'image/jpeg',
          file_size_bytes: 12 * 1024 * 1024 // 12 MB (> 10MB)
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toContain('10 MB');
    });

    it('rejects media with unsupported MIME type with 400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post(`/api/v1/signals/${userSignalId}/media`)
        .set('Authorization', 'Bearer token-media')
        .send({
          file_name: 'document.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 1024 * 1024
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toContain('Only JPEG, PNG, WEBP, and HEIC');
    });

    it('prevents non-owner citizen from registering media on another user signal', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'other_intruder_citizen',
        email: 'intruder@bhubaneswar.local'
      });

      const res = await request(app)
        .post(`/api/v1/signals/${userSignalId}/media`)
        .set('Authorization', 'Bearer token-intruder')
        .send({
          file_name: 'photo.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 1024 * 500
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(res.body.error.message).toContain('Cannot attach media to a signal you do not own');
    });
  });

  describe('4. DEMO_MODE Regression Preservation', () => {
    beforeEach(() => {
      (env as any).DEMO_MODE = true;
    });

    it('preserves demo persona tokens mapping to seeded persona accounts', async () => {
      const resCitizen = await request(app)
        .get('/api/v1/signals/sig_1001')
        .set('Authorization', 'Bearer demo-token-citizen');
      expect(resCitizen.status).toBe(200);
      expect(resCitizen.body.data.citizen_id).toBe('usr_citizen_01');

      const resOfficer = await request(app)
        .get('/api/v1/signals/sig_1001')
        .set('Authorization', 'Bearer demo-token-officer');
      expect(resOfficer.status).toBe(200);

      const resAdmin = await request(app)
        .get('/api/v1/signals/sig_1001')
        .set('Authorization', 'Bearer demo-token-admin');
      expect(resAdmin.status).toBe(200);
    });

    it('DEMO_MODE /api/v1/signals/me returns seeded Golden Demo signals for usr_citizen_01', async () => {
      const res = await request(app)
        .get('/api/v1/signals/me')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((s: any) => s.citizen_id === 'usr_citizen_01')).toBe(true);
    });
  });
});
