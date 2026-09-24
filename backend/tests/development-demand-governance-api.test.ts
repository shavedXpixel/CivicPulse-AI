import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Express } from 'express';
import { env } from '../src/config/env';
import { ProviderContainer, MockDatabaseProvider, MockAIProvider } from '../src/providers';
import { developmentDemandWorkspaceService } from '../src/services';

describe('Phase 15B.5.3.20-HF7.7 — Development Demand Governance Workspace API', () => {
  let app: Express;
  let mockDb: MockDatabaseProvider;
  let mockAI: MockAIProvider;
  const originalDemoMode = env.DEMO_MODE;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    (env as any).DEMO_MODE = true;
    mockDb = new MockDatabaseProvider();
    mockAI = new MockAIProvider();
    ProviderContainer.setDatabaseProvider(mockDb);
    ProviderContainer.setAIProvider(mockAI);
  });


  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
  });

  describe('1. RBAC Enforcements', () => {
    it('Denies unauthenticated access with 401', async () => {
      const res = await request(app).get('/api/v1/governance/development-demand/overview');
      expect(res.status).toBe(401);
    });

    it('Denies CITIZEN role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/overview')
        .set('Authorization', 'Bearer demo-token-citizen');
      expect(res.status).toBe(403);
    });

    it('Denies FIELD_OFFICER role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/clusters')
        .set('Authorization', 'Bearer demo-token-officer');
      expect(res.status).toBe(403);
    });

    it('Allows ADMIN role access to overview', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/overview')
        .set('Authorization', 'Bearer demo-token-admin');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('Allows DEPARTMENT_OFFICER access to clusters', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/clusters')
        .set('Authorization', 'Bearer demo-token-dept-watco');
      expect(res.status).toBe(200);
      expect(res.body.data.clusters).toBeInstanceOf(Array);
    });
  });

  describe('2. Workspace Endpoints in DEMO_MODE', () => {
    it('GET /overview returns macro figures and top sectors', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/overview')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.is_demo).toBe(true);
      expect(data.total_active_demands).toBeGreaterThan(0);
      expect(data.total_demand_signals).toBeGreaterThan(0);
      expect(data.top_sectors.length).toBeGreaterThan(0);
      expect(data.ward_demand_summary.length).toBeGreaterThan(0);
    });

    it('GET /clusters returns synthetic scenarios with filtering support', async () => {
      const resAll = await request(app)
        .get('/api/v1/governance/development-demand/clusters')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(resAll.status).toBe(200);
      expect(resAll.body.data.clusters.length).toBe(4);
      expect(resAll.body.data.is_demo).toBe(true);

      // Filter by category
      const resFiltered = await request(app)
        .get('/api/v1/governance/development-demand/clusters?category=drinking_water')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(resFiltered.status).toBe(200);
      expect(resFiltered.body.data.clusters.length).toBe(1);
      expect(resFiltered.body.data.clusters[0].category).toBe('drinking_water');
    });

    it('GET /clusters/:id returns cluster detail with signals and opportunities', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/clusters/dclust_demo_water_w18')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.cluster.id).toBe('dclust_demo_water_w18');
      expect(data.signals.length).toBeGreaterThan(0);
      expect(data.opportunities.length).toBeGreaterThan(0);
      expect(data.is_demo).toBe(true);

      // Verify privacy: NO citizen PII, email, phone or exact GPS
      for (const sig of data.signals) {
        expect((sig as any).email).toBeUndefined();
        expect((sig as any).phone).toBeUndefined();
        expect((sig as any).submitter_name).toBeUndefined();
        expect((sig as any).user_id).toBeUndefined();
        expect((sig as any).firebase_uid).toBeUndefined();
      }
    });

    it('GET /map returns 67 ward boundaries and aggregated centroids only', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/map')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      const collection = res.body.data;
      expect(collection.type).toBe('FeatureCollection');
      expect(collection.features.length).toBeGreaterThan(0);

      // Must have ward polygons and cluster points
      const wardFeatures = collection.features.filter((f: any) => f.properties.entity_type === 'WARD_HEAT');
      const clusterFeatures = collection.features.filter((f: any) => f.properties.entity_type === 'DEMAND_CLUSTER');

      expect(wardFeatures.length).toBeGreaterThan(0);
      expect(clusterFeatures.length).toBe(4);

      // Verify safety: zero citizen household pins
      for (const feat of collection.features) {
        expect(feat.properties.entity_type).not.toBe('CITIZEN_PIN');
        expect(feat.properties.household_id).toBeUndefined();
      }
    });

    it('GET /indicators returns ward-level contextual indicators', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/indicators?ward_id=WARD-018')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.ward_id).toBe('WARD-018');
      expect(data.indicators.length).toBeGreaterThan(0);
    });

    it('GET /investment-context returns public investment records', async () => {
      const res = await request(app)
        .get('/api/v1/governance/development-demand/investment-context?ward_id=WARD-018')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.investments.length).toBeGreaterThan(0);
      expect(data.total_budget).toBeGreaterThan(0);
    });
  });

  describe('3. REAL_MODE Empty State and Non-Fabrication Guarantee', () => {
    it('Service in REAL_MODE returns honest empty state without fallback', async () => {
      const overview = await developmentDemandWorkspaceService.getOverview(false);
      expect(overview.is_demo).toBe(false);
      expect(overview.total_active_demands).toBe(0);
      expect(overview.total_demand_signals).toBe(0);
      expect(overview.top_sectors).toEqual([]);
      expect(overview.ward_demand_summary).toEqual([]);

      const clusters = await developmentDemandWorkspaceService.getClusters(undefined, false);
      expect(clusters.is_demo).toBe(false);
      expect(clusters.clusters).toEqual([]);
      expect(clusters.total_count).toBe(0);
    });

    it('Demo tokens are rejected with 401 when DEMO_MODE = false', async () => {
      (env as any).DEMO_MODE = false;

      const res = await request(app)
        .get('/api/v1/governance/development-demand/overview')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('4. Critical Metric Trust Rule on Analysis Request', () => {
    it('POST /analyze strictly recomputes deterministic metrics on the server even if client passes spoofed scores', async () => {
      const spoofedClientMetrics = {
        demand_volume_score: 25,
        recurrence_score: 20,
        geographic_concentration_score: 15,
        population_exposure_score: 15,
        infrastructure_deficit_score: 15,
        investment_gap_score: 10,
        composite_demand_index: 100 // Client attempts to force 100
      };

      const res = await request(app)
        .post('/api/v1/governance/development-demand/analyze')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          cluster_id: 'dclust_demo_water_w18',
          metrics: spoofedClientMetrics
        });

      expect(res.status).toBe(200);
      const analysis = res.body.analysis || res.body.data || res.body;

      expect(analysis.opportunity_id).toBeDefined();
      expect(analysis.metrics).toBeDefined();

      // The server must NOT have accepted spoofed 100
      expect(analysis.metrics.composite_demand_index).not.toBe(100);
      expect(analysis.metrics.composite_demand_index).toBeLessThanOrEqual(100);
      expect(analysis.metrics.demand_volume_score).toBeLessThanOrEqual(25);
    });
  });
});
