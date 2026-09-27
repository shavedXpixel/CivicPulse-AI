import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import { env } from '../src/config/env';
import {
  ProviderContainer,
  MockDatabaseProvider,
  MockAIProvider,
  StaticPublicInvestmentProvider
} from '../src/providers';
import {
  UserRole,
  UserStatus,
  UserProfile
} from '@civicpulse/shared';

describe('PHASE 15B.5.3.21 — CivicPulse Real Data Activation Suite', () => {
  let app: Express;
  let mockDb: MockDatabaseProvider;
  let mockAI: MockAIProvider;
  const originalDemoMode = env.DEMO_MODE;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    // Default each test to REAL_MODE to verify non-negotiable production invariants
    (env as any).DEMO_MODE = false;
    mockDb = new MockDatabaseProvider();
    mockAI = new MockAIProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    ProviderContainer.setAIProvider(mockAI);

    // Register authenticated real citizen and admin profiles in MockDb
    const realCitizen: UserProfile = {
      id: 'usr_real_citizen_01',
      auth_user_id: 'auth_citizen_real_01',
      email: 'citizen@bhubaneswar.gov.in',
      display_name: 'Authoritative Real Citizen',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      ward_id: 'WARD-018',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDb.createUser(realCitizen);

    const realAdmin: UserProfile = {
      id: 'usr_real_admin_01',
      auth_user_id: 'auth_admin_real_01',
      email: 'admin@bhubaneswar.gov.in',
      display_name: 'Municipal Administrator',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDb.createUser(realAdmin);

    // MockAuthProvider for verified tokens in REAL_MODE
    const mockAuthProvider = {
      verifyToken: vi.fn().mockImplementation(async (token: string) => {
        if (token === 'real-token-citizen') {
          return { uid: 'auth_citizen_real_01', email: 'citizen@bhubaneswar.gov.in' };
        }
        if (token === 'real-token-admin') {
          return { uid: 'auth_admin_real_01', email: 'admin@bhubaneswar.gov.in' };
        }
        throw new Error('Invalid token');
      }),
      getUser: vi.fn(),
      createUser: vi.fn(),
      deleteUser: vi.fn(),
      createCustomToken: vi.fn()
    };
    ProviderContainer.setAuthProvider(mockAuthProvider as any);
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
  });

  describe('1. Production Citizen Demand Intake & PII Privacy Boundary', () => {
    it('rejects unauthenticated demand submission with 401', async () => {
      const res = await request(app)
        .post('/api/v1/governance/development-demand/intake')
        .send({
          demand_text: 'Need drainage channel desilting along Nayapalli canal',
          ward_id: 'WARD-018'
        });

      expect(res.status).toBe(401);
    });

    it('validates minimum input length and required ward_id', async () => {
      const shortTextRes = await request(app)
        .post('/api/v1/governance/development-demand/intake')
        .set('Authorization', 'Bearer real-token-citizen')
        .send({
          demand_text: 'Too short',
          ward_id: 'WARD-018'
        });

      expect(shortTextRes.status).toBe(400);
      expect(shortTextRes.body.error.message).toContain('at least 10 characters');

      const noWardRes = await request(app)
        .post('/api/v1/governance/development-demand/intake')
        .set('Authorization', 'Bearer real-token-citizen')
        .send({
          demand_text: 'Valid infrastructure proposal description here for ward',
          ward_id: ''
        });

      expect(noWardRes.status).toBe(400);
      expect(noWardRes.body.error.message).toContain('ward_id is required');
    });

    it('processes authenticated citizen submission, sanitizes PII, embeds, clusters, and returns sanitized DTO', async () => {
      const submissionPayload = {
        demand_text: 'Urgent: Waterlogging near Plot 42 Nayapalli canal road. Contact resident 9876543210 or email resident@example.com for site inspection.',
        ward_id: 'WARD-018',
        locality_name: 'Nayapalli Behera Sahi',
        original_language: 'en',
        source_channel: 'WEB_FORM'
      };

      const res = await request(app)
        .post('/api/v1/governance/development-demand/intake')
        .set('Authorization', 'Bearer real-token-citizen')
        .send(submissionPayload);

      expect(res.status).toBe(201);
      const data = res.body.data;
      expect(data).toBeDefined();

      // Invariant: is_demo MUST be false
      expect(data.is_demo).toBe(false);
      expect(data.signal.is_demo).toBe(false);

      // Invariant: PII must be stripped from normalized text and signal
      expect(data.signal.normalized_text).not.toContain('9876543210');
      expect(data.signal.normalized_text).not.toContain('resident@example.com');
      expect(data.signal.normalized_text).not.toContain('Plot 42');

      // Invariant: Governance DTO must strictly omit internal citizen_id, raw embedding, and phone/email
      expect(data.signal.citizen_id).toBeUndefined();
      expect(data.signal.embedding).toBeUndefined();
      expect((data.signal as any).phone).toBeUndefined();
      expect((data.signal as any).email).toBeUndefined();

      // Invariant: Ward and category capture
      expect(data.signal.ward_id).toBe('WARD-018');
      expect(data.signal.detected_category).toBeDefined();
      expect(data.signal.detected_urgency).toBeDefined();

      // Verify cluster formed and deterministic metrics computed
      expect(data.cluster).toBeDefined();
      expect(data.cluster.is_demo).toBe(false);
      expect(data.cluster.composite_demand_index).toBeGreaterThanOrEqual(0);
      expect(data.metrics).toBeDefined();
      expect(data.metrics.composite_demand_index).toBe(data.cluster.composite_demand_index);
    });

    it('persists signal and cluster in database with cluster membership', async () => {
      const submissionPayload = {
        demand_text: 'Deep borewell and drinking water pipeline extension needed for Behera Sahi Ward 18',
        ward_id: 'WARD-018',
        locality_name: 'Nayapalli',
        original_language: 'en'
      };

      const res = await request(app)
        .post('/api/v1/governance/development-demand/intake')
        .set('Authorization', 'Bearer real-token-citizen')
        .send(submissionPayload);

      expect(res.status).toBe(201);
      const signalId = res.body.data.signal.id;
      const clusterId = res.body.data.cluster.id;

      // Verify persistence directly in DatabaseProvider
      const savedSignal = await mockDb.getDemandSignal!(signalId);
      expect(savedSignal).toBeDefined();
      expect(savedSignal?.is_demo).toBe(false);
      expect(savedSignal?.demand_cluster_id).toBe(clusterId);

      const savedCluster = await mockDb.getDemandCluster!(clusterId);
      expect(savedCluster).toBeDefined();
      expect(savedCluster?.is_demo).toBe(false);
      expect(savedCluster?.signal_count).toBeGreaterThanOrEqual(1);

      const members = await mockDb.getDemandClusterMembers!(clusterId);
      expect(members.some((m) => m.signal_id === signalId)).toBe(true);
    });
  });

  describe('2. Real Context Indicators & Official Public Investment Records', () => {
    it('loads verified Bhubaneswar public investments with official provenance', async () => {
      const provider = new StaticPublicInvestmentProvider(undefined, undefined, { isDemo: false });
      const allInvestments = await provider.getAllInvestments();

      expect(allInvestments.length).toBeGreaterThan(0);

      for (const inv of allInvestments) {
        expect(inv.is_demo).toBe(false);
        expect(inv.source_url).toMatch(/^https:\/\//);
        expect(inv.source_agency).toBeDefined();
        expect(inv.documented_budget).toBeGreaterThan(0);
        expect(inv.currency).toBe('INR');

        // Auditability check (Requirement 8)
        expect(inv.provenance).toBeDefined();
        expect(inv.provenance.source_url).toBe(inv.source_url);
        expect(inv.provenance.source_agency).toBe(inv.source_agency);
        expect(inv.provenance.reference_date).toBeDefined();
        expect(inv.provenance.document_name).toBeDefined();
      }
    });

    it('strictly isolates investments by ward and filters out demo records in REAL_MODE', async () => {
      const provider = new StaticPublicInvestmentProvider(undefined, undefined, { isDemo: false });
      const ward18Investments = await provider.getInvestmentsByWard('WARD-018');

      expect(ward18Investments.length).toBeGreaterThan(0);
      for (const inv of ward18Investments) {
        expect(inv.ward_ids).toContain('WARD-018');
        expect(inv.is_demo).toBe(false);
      }

      // Query ward with no documented investments
      const emptyWardInvestments = await provider.getInvestmentsByWard('WARD-099');
      expect(emptyWardInvestments).toEqual([]);
    });

    it('GET /api/v1/governance/development-demand/investment-context returns official verified investments only', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/investment-context?ward_id=WARD-018')
        .set('Authorization', 'Bearer real-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.is_demo).toBe(false);
      expect(res.body.data.investments.length).toBeGreaterThan(0);
      for (const inv of res.body.data.investments) {
        expect(inv.is_demo).toBe(false);
        expect(inv.source_url).toBeDefined();
      }
    });
  });

  describe('3. REAL_MODE Boundary & Security Hardening', () => {
    it('strictly rejects demo tokens in REAL_MODE with 401', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/overview')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Demo authentication and x-demo-mode headers are strictly forbidden in REAL_MODE');
    });

    it('strictly rejects ?demo=true query override in REAL_MODE', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/overview?demo=true')
        .set('Authorization', 'Bearer real-token-admin');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEMO_MODE_OVERRIDE_PROHIBITED');
    });

    it('strictly rejects x-demo-mode header override in REAL_MODE', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/overview')
        .set('Authorization', 'Bearer real-token-admin')
        .set('x-demo-mode', 'true');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('strictly forbidden in REAL_MODE');
    });

    it('strictly rejects is_demo=true body override on intake in REAL_MODE', async () => {
      const res = await request(app)
        .post('/api/v1/governance/development-demand/intake')
        .set('Authorization', 'Bearer real-token-citizen')
        .send({
          demand_text: 'Proposal for stormwater drain improvements along Janpath',
          ward_id: 'WARD-030',
          is_demo: true
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DEMO_MODE_OVERRIDE_PROHIBITED');
    });

    it('strictly forbids CITIZEN role from accessing governance endpoints (403)', async () => {
      const overviewRes = await request(app)
        .get('/api/v1/governance/development-demand/overview')
        .set('Authorization', 'Bearer real-token-citizen');
      expect(overviewRes.status).toBe(403);

      const clustersRes = await request(app)
        .get('/api/v1/governance/development-demand/clusters')
        .set('Authorization', 'Bearer real-token-citizen');
      expect(clustersRes.status).toBe(403);

      const mapRes = await request(app)
        .get('/api/v1/governance/development-demand/map')
        .set('Authorization', 'Bearer real-token-citizen');
      expect(mapRes.status).toBe(403);
    });
  });

  describe('4. Honest Empty State in REAL_MODE', () => {
    it('returns zero signals and zero clusters when no citizen demand records exist in database', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/overview')
        .set('Authorization', 'Bearer real-token-admin');

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.is_demo).toBe(false);
      expect(data.total_active_demands).toBe(0);
      expect(data.total_demand_signals).toBe(0);
      expect(data.top_sectors).toEqual([]);
      expect(data.ward_demand_summary).toEqual([]);
    });

    it('GET /clusters returns empty list in REAL_MODE when database has no real clusters', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/clusters')
        .set('Authorization', 'Bearer real-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.is_demo).toBe(false);
      expect(res.body.data.clusters).toEqual([]);
      expect(res.body.data.total_count).toBe(0);
    });

    it('GET /map returns ward polygons with 0 demand intensity when no real clusters exist', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/map')
        .set('Authorization', 'Bearer real-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.metadata.is_demo).toBe(false);
      expect(res.body.data.features.length).toBeGreaterThan(0);

      // Verify no cluster centroid points exist when there are no real clusters
      const clusterPoints = res.body.data.features.filter(
        (f: any) => f.properties?.entity_type === 'DEMAND_CLUSTER'
      );
      expect(clusterPoints.length).toBe(0);
    });
  });

  describe('5. End-to-End Real Governance Analysis Pipeline', () => {
    it('executes full pipeline from intake to governance AI analysis and records run audit', async () => {
      // Step A: Citizen submits demand
      const intakeRes = await request(app)
        .post('/api/v1/governance/development-demand/intake')
        .set('Authorization', 'Bearer real-token-citizen')
        .send({
          demand_text: 'Heavy monsoon road flooding near Nayapalli Behera Sahi canal crossing requires primary drainage deepening and box culvert.',
          ward_id: 'WARD-018',
          locality_name: 'Behera Sahi'
        });

      expect(intakeRes.status).toBe(201);
      const clusterId = intakeRes.body.data.cluster.id;

      // Step B: Department Officer or Admin runs Governance Analysis on the real cluster
      const analyzeRes = await request(app)
        .post('/api/v1/governance/development-demand/analyze')
        .set('Authorization', 'Bearer real-token-admin')
        .send({
          cluster_id: clusterId
        });

      expect(analyzeRes.status).toBe(200);
      const analysis = analyzeRes.body.data || analyzeRes.body;
      expect(analysis.is_demo).toBe(false);
      expect(analysis.opportunity_id).toBeDefined();
      expect(analysis.metrics).toBeDefined();
      expect(analysis.metrics.composite_demand_index).toBeGreaterThanOrEqual(0);

      // Step C: Verify analysis run was recorded in audit history
      const runs = await mockDb.getDemandAnalysisRuns!(clusterId);
      expect(runs.length).toBeGreaterThanOrEqual(1);
      expect(runs[0].cluster_id).toBe(clusterId);
      expect(runs[0].is_demo).toBe(false);
    });
  });
});
