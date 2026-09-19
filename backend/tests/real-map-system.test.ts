import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ProviderContainer, MockDatabaseProvider, MockAIProvider, LocalStorageProvider } from '../src/providers';
import { env } from '../src/config/env';
import { UserRole, UserStatus, ProblemStatus, ImpactLevel, SignalStatus, SignalProcessingStatus, SignalSourceType, SignalSeverity } from '@civicpulse/shared';

describe('Phase 15B.5.3.13: Real CivicPulse Map System — Backend Validation & RBAC Scoping', () => {
  let app: ReturnType<typeof createApp>;
  let mockDb: MockDatabaseProvider;
  const originalDemoMode = env.DEMO_MODE;

  beforeEach(async () => {
    (env as any).DEMO_MODE = true; // Use demo token persona resolution in test suite
    ProviderContainer.resetAllProviders();
    mockDb = new MockDatabaseProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    ProviderContainer.setAIProvider(new MockAIProvider());
    ProviderContainer.setStorageProvider(new LocalStorageProvider());
    app = createApp();

    // Seed test users
    await mockDb.createUser({
      id: 'usr_citizen_01',
      email: 'citizen1@test.com',
      display_name: 'Citizen One',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await mockDb.createUser({
      id: 'usr_citizen_02',
      email: 'citizen2@test.com',
      display_name: 'Citizen Two',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await mockDb.createUser({
      id: 'usr_dept_watco',
      email: 'watco@civicpulse.gov.in',
      display_name: 'WATCO Officer',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: 'WATCO',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await mockDb.createUser({
      id: 'usr_dept_drainage',
      email: 'drainage@civicpulse.gov.in',
      display_name: 'Drainage Officer',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: 'BMC_DRAINAGE',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await mockDb.createUser({
      id: 'usr_field_drainage',
      email: 'field@civicpulse.gov.in',
      display_name: 'Field Officer',
      role: UserRole.FIELD_OFFICER,
      department_id: 'BMC_DRAINAGE',
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    await mockDb.createUser({
      id: 'usr_admin_01',
      email: 'admin@civicpulse.gov.in',
      display_name: 'System Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.resetAllProviders();
  });

  describe('A. Coordinate & Location Validation on Report Submission', () => {
    it('1. rejects latitude > 90 with 400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Deep pothole on Janpath road',
          location: { lat: 90.0001, lng: 85.8245 }
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/Latitude must be between -90 and 90/);
    });

    it('2. rejects latitude < -90 with 400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Severe drainage overflow outside school',
          location: { lat: -90.0001, lng: 85.8245 }
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/Latitude must be between -90 and 90/);
    });

    it('3. rejects longitude > 180 with 400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Burst water pipe flooding marketplace',
          location: { lat: 20.2961, lng: 180.0001 }
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/Longitude must be between -180 and 180/);
    });

    it('4. rejects longitude < -180 with 400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Fallen electric transformer pole',
          location: { lat: 20.2961, lng: -180.0001 }
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toMatch(/Longitude must be between -180 and 180/);
    });

    it('5. accepts valid coordinates and persists them accurately', async () => {
      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Blocked storm water drain at Kalpana square',
          location: { lat: 20.2524, lng: 85.8398 }
        });

      expect(res.status).toBe(201);
      expect(res.body.data.location).toEqual({
        lat: 20.2524,
        lng: 85.8398
      });
    });

    it('6. preserves location_source (GPS and MANUAL)', async () => {
      const resGps = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Contaminated tap water with brown sludge',
          location: { lat: 20.2961, lng: 85.8245 },
          location_source: 'GPS',
          location_accuracy_m: 8.5
        });

      expect(resGps.status).toBe(201);
      expect(resGps.body.data.location_source).toBe('GPS');

      const resManual = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Open sewer lid near hospital entrance',
          location: { lat: 20.2961, lng: 85.8245 },
          location_source: 'MANUAL'
        });

      expect(resManual.status).toBe(201);
      expect(resManual.body.data.location_source).toBe('MANUAL');
    });

    it('7. preserves location_accuracy_m when provided', async () => {
      const res = await request(app)
        .post('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          original_text: 'Street light transformer spark',
          location: { lat: 20.3012, lng: 85.8194 },
          location_source: 'GPS',
          location_accuracy_m: 14.2
        });

      expect(res.status).toBe(201);
      expect(res.body.data.location_accuracy_m).toBe(14.2);
    });
  });

  describe('B. Citizen Location Precision & Cross-Account Privacy', () => {
    it('8. citizen sees only own report locations and cannot query another citizen locations', async () => {
      // Seed signal from Citizen 1
      await mockDb.createSignal({
        id: 'sig_c1_loc',
        source_type: SignalSourceType.CITIZEN,
        citizen_id: 'usr_citizen_01',
        original_text: 'Citizen 1 Private Home Leak',
        severity: SignalSeverity.MEDIUM,
        status: SignalStatus.ACTIVE,
        processing_status: SignalProcessingStatus.COMPLETED,
        location: { lat: 20.2961, lng: 85.8245 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Seed signal from Citizen 2
      await mockDb.createSignal({
        id: 'sig_c2_loc',
        source_type: SignalSourceType.CITIZEN,
        citizen_id: 'usr_citizen_02',
        original_text: 'Citizen 2 Private Home Leak',
        severity: SignalSeverity.HIGH,
        status: SignalStatus.ACTIVE,
        processing_status: SignalProcessingStatus.COMPLETED,
        location: { lat: 20.3533, lng: 85.8193 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Citizen 1 queries signals
      const resC1 = await request(app)
        .get('/api/v1/signals')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(resC1.status).toBe(200);
      const returnedIds = resC1.body.data.map((s: any) => s.id);
      expect(returnedIds).toContain('sig_c1_loc');
      expect(returnedIds).not.toContain('sig_c2_loc');
    });

    it("9. citizen cannot retrieve another citizen's location by ID manipulation (returns 404)", async () => {
      await mockDb.createSignal({
        id: 'sig_c2_sensitive',
        source_type: SignalSourceType.CITIZEN,
        citizen_id: 'usr_citizen_02',
        original_text: 'Sensitive Private Property Sewage Leak',
        severity: SignalSeverity.CRITICAL,
        status: SignalStatus.ACTIVE,
        processing_status: SignalProcessingStatus.COMPLETED,
        location: { lat: 20.3533, lng: 85.8193 },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Citizen 1 attempts to query Citizen 2's specific signal ID
      const res = await request(app)
        .get('/api/v1/signals/sig_c2_sensitive')
        .set('Authorization', 'Bearer demo-token-citizen');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('C. Server-Side Operational Map Scoping & RBAC', () => {
    beforeEach(async () => {
      // Seed operational problem clusters across departments
      await mockDb.createProblemCluster({
        id: 'PRB-WATCO-01',
        title: 'Major Water Transmission Failure',
        category: 'WATER_SUPPLY',
        department_id: 'WATCO',
        ward_id: 'WARD-018',
        location: { lat: 20.2961, lng: 85.8245 },
        status: ProblemStatus.IN_PROGRESS,
        signal_count: 5,
        impact_score: 84,
        impact_level: ImpactLevel.CRITICAL,
        severity_score: 22,
        population_score: 18,
        duration_score: 14,
        concentration_score: 12,
        critical_exposure_score: 8,
        recurrence_score: 6,
        evidence_score: 4,
        first_detected_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await mockDb.createProblemCluster({
        id: 'PRB-DRAINAGE-01',
        title: 'Culvert Blockage on NH-16',
        category: 'DRAINAGE',
        department_id: 'BMC_DRAINAGE',
        assigned_to: 'usr_field_drainage',
        ward_id: 'WARD-004',
        location: { lat: 20.2882, lng: 85.8436 },
        status: ProblemStatus.ASSIGNED,
        signal_count: 3,
        impact_score: 68,
        impact_level: ImpactLevel.HIGH,
        severity_score: 18,
        population_score: 14,
        duration_score: 12,
        concentration_score: 10,
        critical_exposure_score: 6,
        recurrence_score: 5,
        evidence_score: 3,
        first_detected_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await mockDb.createProblemCluster({
        id: 'PRB-DRAINAGE-02',
        title: 'Unassigned Drainage Collapse',
        category: 'DRAINAGE',
        department_id: 'BMC_DRAINAGE',
        assigned_to: 'usr_other_officer',
        ward_id: 'WARD-022',
        location: { lat: 20.3533, lng: 85.8193 },
        status: ProblemStatus.TRIAGED,
        signal_count: 2,
        impact_score: 52,
        impact_level: ImpactLevel.MEDIUM,
        severity_score: 14,
        population_score: 10,
        duration_score: 10,
        concentration_score: 8,
        critical_exposure_score: 5,
        recurrence_score: 3,
        evidence_score: 2,
        first_detected_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });

    it('10. department officer only receives own department locations', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/map')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const returnedIds = res.body.data.map((p: any) => p.id);
      expect(returnedIds).toContain('PRB-WATCO-01');
      expect(returnedIds).not.toContain('PRB-DRAINAGE-01');
      expect(returnedIds).not.toContain('PRB-DRAINAGE-02');
    });

    it('11. department officer cannot bypass department scope through query manipulation', async () => {
      // WATCO officer maliciously passes ?department_id=BMC_DRAINAGE in query
      const res = await request(app)
        .get('/api/v1/dashboard/map?department_id=BMC_DRAINAGE')
        .set('Authorization', 'Bearer demo-token-dept-watco');

      expect(res.status).toBe(200);
      const returnedIds = res.body.data.map((p: any) => p.id);
      expect(returnedIds).toContain('PRB-WATCO-01');
      expect(returnedIds).not.toContain('PRB-DRAINAGE-01');
      expect(returnedIds).not.toContain('PRB-DRAINAGE-02');
    });

    it('12. field officer only receives assigned locations', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/map')
        .set('Authorization', 'Bearer demo-token-field-drainage');

      expect(res.status).toBe(200);
      const returnedIds = res.body.data.map((p: any) => p.id);
      expect(returnedIds).toContain('PRB-DRAINAGE-01'); // assigned_to === usr_field_drainage
      expect(returnedIds).not.toContain('PRB-DRAINAGE-02'); // assigned to another officer
      expect(returnedIds).not.toContain('PRB-WATCO-01'); // different department
    });

    it("13. field officer cannot access another officer's unassigned or differently-assigned locations", async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/map')
        .set('Authorization', 'Bearer demo-token-field-drainage');

      expect(res.status).toBe(200);
      const assignments = res.body.data.map((p: any) => p.assigned_to);
      assignments.forEach((assigned: string) => {
        expect(assigned).toBe('usr_field_drainage');
      });
    });

    it('14. admin receives authorized operational locations across all departments', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/map')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      const returnedIds = res.body.data.map((p: any) => p.id);
      expect(returnedIds).toContain('PRB-WATCO-01');
      expect(returnedIds).toContain('PRB-DRAINAGE-01');
      expect(returnedIds).toContain('PRB-DRAINAGE-02');
    });

    it('15. empty result produces zero markers and an honest empty list', async () => {
      // Clear all problems in mock DB
      (mockDb as any).problemClusters.clear();

      const res = await request(app)
        .get('/api/v1/dashboard/map')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.data.length).toBe(0);
    });

    it('16. REAL_MODE never produces synthetic coordinates', async () => {
      // Add problem cluster without location
      await mockDb.createProblemCluster({
        id: 'PRB-NOLOC-01',
        title: 'Incident without GPS',
        category: 'ROADS',
        department_id: 'BMC_ROADS',
        status: ProblemStatus.NEW,
        signal_count: 1,
        impact_score: 40,
        impact_level: ImpactLevel.LOW,
        severity_score: 10,
        population_score: 10,
        duration_score: 10,
        concentration_score: 5,
        critical_exposure_score: 5,
        recurrence_score: 0,
        evidence_score: 0,
        first_detected_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const res = await request(app)
        .get('/api/v1/dashboard/map')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      // Ensure that problem without coordinates is NOT returned with a fabricated coordinate
      const returnedIds = res.body.data.map((p: any) => p.id);
      expect(returnedIds).not.toContain('PRB-NOLOC-01');

      // Every returned problem must possess authentic valid coordinates
      res.body.data.forEach((p: any) => {
        expect(p.location).toBeDefined();
        expect(typeof p.location.lat).toBe('number');
        expect(typeof p.location.lng).toBe('number');
      });
    });
  });
});
