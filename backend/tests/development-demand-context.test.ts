import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DevelopmentIndicator,
  PublicInvestmentRecord,
  PublicInvestmentStatus,
  IDevelopmentIndicatorProvider,
  IPublicInvestmentProvider,
  DevelopmentIndicatorSchema,
  PublicInvestmentRecordSchema,
  ProblemCluster,
  ProblemStatus,
  ImpactLevel
} from '@civicpulse/shared';
import {
  ProviderContainer,
  getDevelopmentIndicatorProvider,
  getPublicInvestmentProvider,
  StaticDevelopmentIndicatorProvider,
  StaticPublicInvestmentProvider,
  MockDevelopmentIndicatorProvider,
  MockPublicInvestmentProvider,
  StaticPopulationProvider,
  StaticGeographyProvider,
  StaticFacilityProvider,
  IDatabaseProvider
} from '../src/providers';
import { env } from '../src/config/env';

const createTestProblemCluster = (overrides?: Partial<ProblemCluster>): ProblemCluster => ({
  id: 'PRB-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
  title: 'Test Problem Cluster',
  category: 'drinking_water',
  department_id: 'WATCO',
  status: ProblemStatus.TRIAGED,
  signal_count: 1,
  impact_score: 50,
  impact_level: ImpactLevel.MEDIUM,
  severity_score: 15,
  population_score: 10,
  duration_score: 8,
  concentration_score: 7,
  critical_exposure_score: 5,
  recurrence_score: 3,
  evidence_score: 2,
  first_detected_at: new Date().toISOString(),
  last_updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_demo: false,
  ...overrides
});

describe('PHASE 15B.5.3.20-HF7.4 — Development Indicators & Investment Context Suite', () => {
  beforeEach(() => {
    ProviderContainer.resetAllProviders();
  });

  afterEach(() => {
    ProviderContainer.resetAllProviders();
  });

  // ============================================================================
  // 1. PROVIDER REGISTRATION & CONTRACT STRUCTURE
  // ============================================================================
  describe('1. Provider Registration & Contract Satisfaction', () => {
    it('resolves concrete development indicator provider from container', () => {
      const provider = getDevelopmentIndicatorProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.getWardIndicators).toBe('function');
      expect(typeof provider.getIndicatorBySector).toBe('function');
      expect(typeof provider.listAvailableIndicators).toBe('function');
    });

    it('resolves concrete public investment provider from container', () => {
      const provider = getPublicInvestmentProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.getInvestmentsByWard).toBe('function');
      expect(typeof provider.getInvestmentsByCategory).toBe('function');
    });

    it('allows dependency injection of mock/custom providers and resets cleanly', () => {
      const customIndicator: IDevelopmentIndicatorProvider = {
        async getWardIndicators() { return []; },
        async getIndicatorBySector() { return []; },
        async listAvailableIndicators() { return []; }
      };

      const customInvestment: IPublicInvestmentProvider = {
        async getInvestmentsByWard() { return []; },
        async getInvestmentsByCategory() { return []; }
      };

      ProviderContainer.setDevelopmentIndicatorProvider(customIndicator);
      ProviderContainer.setPublicInvestmentProvider(customInvestment);

      expect(getDevelopmentIndicatorProvider()).toBe(customIndicator);
      expect(getPublicInvestmentProvider()).toBe(customInvestment);

      ProviderContainer.resetAllProviders();

      // After reset, should return a fresh instance from factory
      expect(getDevelopmentIndicatorProvider()).not.toBe(customIndicator);
      expect(getPublicInvestmentProvider()).not.toBe(customInvestment);
    });
  });

  // ============================================================================
  // 2. DEVELOPMENT INDICATORS: POPULATION & GEOGRAPHY CONTEXT
  // ============================================================================
  describe('2. Development Indicators: Population & Geography Context', () => {
    it('retrieves authoritative Census 2011 population for a known BMC ward (WARD-001)', async () => {
      const provider = new StaticDevelopmentIndicatorProvider(
        undefined,
        undefined,
        undefined,
        undefined,
        { isDemo: false }
      );

      const indicators = await provider.getWardIndicators('WARD-001');
      expect(indicators.length).toBeGreaterThan(0);

      const popInd = indicators.find((i) => i.indicator_type === 'POPULATION');
      expect(popInd).toBeDefined();
      expect(popInd!.value).toBe(12378); // Census 2011 BMC ward enumeration table
      expect(popInd!.unit).toBe('persons');
      expect(popInd!.ward_id).toBe('WARD-001');
      expect(popInd!.source).toContain('Census');
      expect(popInd!.confidence).toBeGreaterThanOrEqual(0.9);
      expect(popInd!.confidence).toBeLessThanOrEqual(1.0);
      expect(popInd!.provenance.is_demo).toBe(false);
      expect(popInd!.is_demo).toBe(false);

      const validation = DevelopmentIndicatorSchema.safeParse(popInd);
      expect(validation.success).toBe(true);
    });

    it('returns honest empty list for an unknown ward without inventing data', async () => {
      const provider = new StaticDevelopmentIndicatorProvider(
        undefined,
        undefined,
        undefined,
        undefined,
        { isDemo: false }
      );

      const indicators = await provider.getWardIndicators('WARD-999-DOES-NOT-EXIST');
      expect(indicators).toEqual([]);
    });

    it('computes deterministic polygon geographic area and population density for known ward', async () => {
      const provider = new StaticDevelopmentIndicatorProvider(
        undefined,
        undefined,
        undefined,
        undefined,
        { isDemo: false }
      );

      const indicators = await provider.getWardIndicators('WARD-001');

      const areaInd = indicators.find((i) => i.indicator_type === 'GEOGRAPHIC_AREA');
      expect(areaInd).toBeDefined();
      expect(areaInd!.unit).toBe('sq_km');
      expect(areaInd!.value).toBeGreaterThan(2.0); // BMC WARD-001 is approx 2.58 km²
      expect(areaInd!.value).toBeLessThan(3.5);
      expect(areaInd!.confidence).toBe(0.98);
      expect(areaInd!.provenance.measurement_context).toContain('Polygon Boundary');

      const densityInd = indicators.find((i) => i.indicator_type === 'POPULATION_DENSITY');
      expect(densityInd).toBeDefined();
      expect(densityInd!.unit).toBe('persons_per_sq_km');
      // Density = 12378 / ~2.583 km² = ~4793 persons/sq km
      expect(densityInd!.value).toBeGreaterThan(4000);
      expect(densityInd!.value).toBeLessThan(6000);
      expect(densityInd!.provenance.source).toBe('BMC_CENSUS_GIS_DERIVATION');
      expect(densityInd!.provenance.measurement_context).toContain('Mathematically derived');
    });

    it('normalizes ward id formatting (e.g., "1", "W1", "WARD-001")', async () => {
      const provider = new StaticDevelopmentIndicatorProvider(
        undefined,
        undefined,
        undefined,
        undefined,
        { isDemo: false }
      );

      const indFromPadded = await provider.getWardIndicators('WARD-001');
      const indFromNumber = await provider.getWardIndicators('1');

      const popPadded = indFromPadded.find((i) => i.indicator_type === 'POPULATION');
      const popNumber = indFromNumber.find((i) => i.indicator_type === 'POPULATION');

      expect(popPadded).toBeDefined();
      expect(popNumber).toBeDefined();
      expect(popPadded!.value).toBe(popNumber!.value);
    });
  });

  // ============================================================================
  // 3. DEVELOPMENT INDICATORS: FACILITY CONTEXT
  // ============================================================================
  describe('3. Development Indicators: Facility Context & Sectors', () => {
    it('aggregates deterministic facility counts by spatial point-in-polygon', async () => {
      const provider = new StaticDevelopmentIndicatorProvider(
        undefined,
        undefined,
        undefined,
        undefined,
        { isDemo: false }
      );

      const indicators = await provider.getWardIndicators('WARD-001');

      const totalFacs = indicators.find((i) => i.id.includes('fac_total'));
      const schools = indicators.find((i) => i.id.includes('fac_school'));
      const hospitals = indicators.find((i) => i.id.includes('fac_hospital'));
      const critical = indicators.find((i) => i.id.includes('fac_critical'));

      expect(totalFacs).toBeDefined();
      expect(schools).toBeDefined();
      expect(hospitals).toBeDefined();
      expect(critical).toBeDefined();

      expect(totalFacs!.value).toBeGreaterThanOrEqual(0);
      expect(critical!.value).toBe(schools!.value + hospitals!.value);
      expect(totalFacs!.source).toContain('BhubaneswarOne GIS');
    });

    it('filters indicators strictly by sector category', async () => {
      const provider = new StaticDevelopmentIndicatorProvider(
        undefined,
        undefined,
        undefined,
        undefined,
        { isDemo: false }
      );

      // Educational facilities sector
      const eduIndicators = await provider.getIndicatorBySector('educational_facilities', 'WARD-001');
      expect(eduIndicators.length).toBeGreaterThan(0);
      expect(eduIndicators.every((i) => i.id.includes('school') || i.name.toLowerCase().includes('school'))).toBe(true);

      // Healthcare accessibility sector
      const healthIndicators = await provider.getIndicatorBySector('healthcare_accessibility', 'WARD-001');
      expect(healthIndicators.length).toBeGreaterThan(0);
      expect(healthIndicators.every((i) => i.id.includes('hospital') || i.name.toLowerCase().includes('hospital'))).toBe(true);

      // Sector without verified reference facilities in project returns empty without fabrication
      const waterIndicators = await provider.getIndicatorBySector('drinking_water', 'WARD-001');
      expect(waterIndicators).toEqual([]);

      // 'all' category returns the full set
      const allIndicators = await provider.getIndicatorBySector('all', 'WARD-001');
      const directAll = await provider.getWardIndicators('WARD-001');
      expect(allIndicators.length).toBe(directAll.length);
    });

    it('lists all available indicator descriptors with required metadata', async () => {
      const provider = new StaticDevelopmentIndicatorProvider();
      const list = await provider.listAvailableIndicators();

      expect(list.length).toBeGreaterThanOrEqual(7);
      for (const item of list) {
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.unit).toBeDefined();
        expect(item.source).toBeDefined();
      }

      const ids = list.map((i) => i.id);
      expect(ids).toContain('ward_population');
      expect(ids).toContain('ward_population_density');
      expect(ids).toContain('ward_geographic_area');
      expect(ids).toContain('total_facilities_count');
      expect(ids).toContain('school_facilities_count');
      expect(ids).toContain('hospital_facilities_count');
    });
  });

  // ============================================================================
  // 4. OPERATIONAL PROBLEM CONTEXT & PRIVACY BOUNDARY
  // ============================================================================
  describe('4. Operational Problem Context & Privacy Safeguards', () => {
    it('aggregates registered problem counts while strictly excluding demo problems and citizen PII', async () => {
      const mockProblems: ProblemCluster[] = [
        createTestProblemCluster({
          id: 'prob_real_01',
          title: 'Leaking water main pipeline',
          description: 'Citizen reported pipe break on main road',
          category: 'drinking_water',
          status: ProblemStatus.TRIAGED,
          impact_score: 65,
          impact_level: ImpactLevel.HIGH,
          ward_id: 'WARD-001',
          is_demo: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }),
        createTestProblemCluster({
          id: 'prob_real_02',
          title: 'Damaged storm drain culvert',
          description: 'Culvert blockage causing waterlogging',
          category: 'drainage_flood_stormwater',
          status: ProblemStatus.IN_PROGRESS,
          impact_score: 72,
          impact_level: ImpactLevel.HIGH,
          ward_id: 'WARD-001',
          is_demo: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }),
        createTestProblemCluster({
          id: 'prob_demo_fixture',
          title: 'Synthetic test problem',
          description: 'Demo problem fixture',
          category: 'drinking_water',
          status: ProblemStatus.TRIAGED,
          impact_score: 40,
          impact_level: ImpactLevel.LOW,
          ward_id: 'WARD-001',
          is_demo: true, // Should be excluded!
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      ];

      const mockDb: Partial<IDatabaseProvider> = {
        async listProblemClusters(filter) {
          const filtered = mockProblems.filter((p) => p.ward_id === filter.ward_id);
          return { data: filtered };
        }
      };

      const provider = new StaticDevelopmentIndicatorProvider(
        undefined,
        undefined,
        undefined,
        mockDb as IDatabaseProvider,
        { isDemo: false }
      );

      const indicators = await provider.getWardIndicators('WARD-001');
      const opsInd = indicators.find((i) => i.indicator_type === 'OPERATIONAL_PROBLEM_COUNT');

      expect(opsInd).toBeDefined();
      // Should be 2, strictly excluding the 1 demo problem
      expect(opsInd!.value).toBe(2);
      expect(opsInd!.unit).toBe('problems');
      expect(opsInd!.is_demo).toBe(false);
      expect(opsInd!.provenance.is_demo).toBe(false);
      expect(opsInd!.provenance.source).toBe('CIVICPULSE_OPERATIONAL_DB');

      // Verify ZERO citizen PII is exposed anywhere on the returned indicator
      const jsonStr = JSON.stringify(opsInd);
      expect(jsonStr).not.toContain('pupuhari');
      expect(jsonStr).not.toContain('@');
      expect(jsonStr).not.toContain('+91');
      expect(jsonStr).not.toContain('officer');
      expect(jsonStr).not.toContain('auth_user_id');
      expect(jsonStr).not.toContain('pipe break on main road'); // No raw citizen text
    });
  });

  // ============================================================================
  // 5. REAL_MODE & DEMO_MODE FILTERING
  // ============================================================================
  describe('5. REAL_MODE & DEMO_MODE Boundaries', () => {
    it('strictly excludes demo data when isDemo is false (REAL_MODE)', async () => {
      // Create a mock population provider returning SYNTHETIC provenance
      const syntheticPopProvider: any = {
        async getWardPopulation(wardId: string) {
          return {
            ward_id: wardId,
            population: 99999,
            reference_year: 2026,
            provenance: 'SYNTHETIC'
          };
        }
      };

      const realModeProvider = new StaticDevelopmentIndicatorProvider(
        syntheticPopProvider,
        undefined,
        undefined,
        undefined,
        { isDemo: false }
      );

      const indicators = await realModeProvider.getWardIndicators('WARD-001');

      // Population indicator was SYNTHETIC, so REAL_MODE must have excluded it!
      const popInd = indicators.find((i) => i.indicator_type === 'POPULATION');
      expect(popInd).toBeUndefined();

      // All remaining indicators in REAL_MODE must have is_demo === false
      for (const ind of indicators) {
        expect(ind.is_demo).toBe(false);
        expect(ind.provenance.is_demo).toBe(false);
      }
    });

    it('MockDevelopmentIndicatorProvider flags all indicators as demo fixtures', async () => {
      const mockProvider = new MockDevelopmentIndicatorProvider();
      const indicators = await mockProvider.getWardIndicators('WARD-018');

      expect(indicators.length).toBeGreaterThan(0);
      for (const ind of indicators) {
        expect(ind.is_demo).toBe(true);
        expect(ind.provenance.is_demo).toBe(true);
        expect(ind.provenance.source).toBe('GOLDEN_DEMO');
      }
    });
  });

  // ============================================================================
  // 6. PUBLIC INVESTMENT PROVIDER & PROVENANCE
  // ============================================================================
  describe('6. Public Investment Provider & Provenance', () => {
    it('returns an explicit empty dataset by default when no verified investment data exists', async () => {
      const investmentProvider = new StaticPublicInvestmentProvider(undefined, undefined, { isDemo: false });

      // No government projects fabricated for any ward
      const wardInvestments = await investmentProvider.getInvestmentsByWard('WARD-001');
      expect(wardInvestments).toEqual([]);

      // No government projects fabricated for any category
      const catInvestments = await investmentProvider.getInvestmentsByCategory('drinking_water');
      expect(catInvestments).toEqual([]);
    });

    it('accurately filters verified investment records by ward and category when provided', async () => {
      const verifiedRecords: PublicInvestmentRecord[] = [
        {
          id: 'inv_verified_01',
          plan_name: 'AMRUT 2.0 24x7 Water Supply Distribution Network',
          project_id: 'OD-BMC-WAT-001',
          category: 'drinking_water',
          ward_ids: ['WARD-001', 'WARD-002'],
          status: PublicInvestmentStatus.APPROVED,
          documented_budget: 45000000,
          currency: 'INR',
          announcement_date: '2026-01-15T00:00:00.000Z',
          source_agency: 'WATCO Odisha',
          source_url: 'https://watcoodisha.in/projects/amrut-001',
          provenance: {
            is_demo: false,
            source: 'WATCO_ANNUAL_REPORT_2026',
            measurement_context: 'Approved DPR for Ward 1-2 Distribution Network'
          },
          is_demo: false
        },
        {
          id: 'inv_verified_02',
          plan_name: 'Smart City High-Mast LED Lighting Phase 3',
          project_id: 'OD-BSCL-LT-003',
          category: 'power_public_lighting',
          ward_ids: ['WARD-001'],
          status: PublicInvestmentStatus.IN_PROGRESS,
          documented_budget: 12000000,
          currency: 'INR',
          announcement_date: '2026-02-01T00:00:00.000Z',
          source_agency: 'Bhubaneswar Smart City Limited',
          source_url: 'https://smartcitybhubaneswar.gov.in/tenders/led-003',
          provenance: {
            is_demo: false,
            source: 'BSCL_WORK_ORDERS',
            measurement_context: 'Tender Work Order #BSCL-2026-89'
          },
          is_demo: false
        },
        {
          id: 'inv_demo_record',
          plan_name: 'Synthetic Demo Sewer Upgrade',
          project_id: 'DEMO-SEW-999',
          category: 'sanitation_hygiene',
          ward_ids: ['WARD-001'],
          status: PublicInvestmentStatus.PROPOSED,
          documented_budget: 5000000,
          currency: 'INR',
          announcement_date: '2026-01-01T00:00:00.000Z',
          source_agency: 'Demo Authority',
          source_url: 'https://demo.gov.in/project',
          provenance: {
            is_demo: true,
            source: 'DEMO_FIXTURE'
          },
          is_demo: true
        }
      ];

      const provider = new StaticPublicInvestmentProvider(verifiedRecords, undefined, { isDemo: false });

      // In REAL_MODE, query for WARD-001 should retrieve only the 2 real records, excluding the demo one
      const ward1Investments = await provider.getInvestmentsByWard('WARD-001');
      expect(ward1Investments).toHaveLength(2);
      expect(ward1Investments.some((r) => r.id === 'inv_demo_record')).toBe(false);

      // Query for WARD-002 should retrieve only the water supply project
      const ward2Investments = await provider.getInvestmentsByWard('WARD-002');
      expect(ward2Investments).toHaveLength(1);
      expect(ward2Investments[0]!.project_id).toBe('OD-BMC-WAT-001');

      // Query for category
      const waterInvestments = await provider.getInvestmentsByCategory('drinking_water');
      expect(waterInvestments).toHaveLength(1);
      expect(waterInvestments[0]!.category).toBe('drinking_water');

      // Validation check against schema
      const validation = PublicInvestmentRecordSchema.safeParse(ward1Investments[0]);
      expect(validation.success).toBe(true);
    });

    it('MockPublicInvestmentProvider returns synthetic investment for demo mode', async () => {
      const mockProvider = new MockPublicInvestmentProvider();
      const demoInvestments = await mockProvider.getInvestmentsByWard('WARD-018');

      expect(demoInvestments).toHaveLength(1);
      expect(demoInvestments[0]!.is_demo).toBe(true);
      expect(demoInvestments[0]!.provenance.is_demo).toBe(true);
      expect(demoInvestments[0]!.provenance.source).toBe('GOLDEN_DEMO');
    });
  });
});
