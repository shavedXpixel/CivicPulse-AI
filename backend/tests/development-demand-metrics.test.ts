import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DemandCluster,
  NormalizedDemandSignal,
  DemandSignalSourceChannel,
  DevelopmentIndicator,
  PublicInvestmentRecord,
  PublicInvestmentStatus,
  DemandPriorityBand,
  DeterministicDemandMetricsSchema,
  DetailedDemandMetricsResultSchema
} from '@civicpulse/shared';
import {
  calculateDemandMetrics,
  calculateDemandMetricsWithDetails,
  mapCompositeToPriorityBand,
  METRIC_BOUNDS
} from '../src/services/development-demand-metrics.service';
import { ProviderContainer, StaticGeographyProvider } from '../src/providers';

describe('PHASE 15B.5.3.20-HF7.5 — Deterministic Development Demand Metrics Suite', () => {
  beforeEach(() => {
    ProviderContainer.resetAllProviders();
  });

  afterEach(() => {
    ProviderContainer.resetAllProviders();
  });

  // Base fixtures helper
  function createBaseCluster(overrides: Partial<DemandCluster> = {}): DemandCluster {
    return {
      id: 'dclust_test_001',
      title: 'Drinking Water Pipeline Supply Deficit',
      category: 'drinking_water',
      ward_ids: ['WARD-001'],
      signal_count: 5,
      first_signal_at: '2026-08-01T10:00:00.000Z',
      last_signal_at: '2026-08-20T10:00:00.000Z',
      duration_days: 19,
      is_demo: false,
      created_at: '2026-08-01T10:00:00.000Z',
      ...overrides
    };
  }

  function createSignal(id: string, wardId: string, timestamp: string, isDemo = false): NormalizedDemandSignal {
    return {
      id,
      source_channel: DemandSignalSourceChannel.WEB_FORM,
      original_language: 'en',
      original_text: 'Potable water supply low pressure in ward street',
      normalized_language: 'en',
      normalized_text: 'Potable water supply low pressure in ward street',
      normalization_confidence: 0.95,
      detected_category: 'drinking_water',
      detected_urgency: 'HIGH',
      ward_id: wardId,
      is_demo: isDemo,
      submitted_at: timestamp,
      ingested_at: timestamp
    };
  }

  // ==========================================================================
  // 1. DEMAND VOLUME SCORE (0–25)
  // ==========================================================================
  describe('1. Demand Volume Score (0–25)', () => {
    it('evaluates zero signals as exactly 0 volume score', async () => {
      const cluster = createBaseCluster({ signal_count: 0 });
      const result = await calculateDemandMetricsWithDetails(cluster, [], [], [], { isDemo: false });

      expect(result.metrics.demand_volume_score).toBe(0);
      expect(result.components.demand_volume.score).toBe(0);
      expect(result.components.demand_volume.raw_inputs.signal_count).toBe(0);
    });

    it('evaluates a single signal to a non-zero baseline score', async () => {
      const cluster = createBaseCluster({ signal_count: 1 });
      const signal = createSignal('sig_1', 'WARD-001', '2026-08-01T10:00:00.000Z');
      const result = await calculateDemandMetricsWithDetails(cluster, [signal], [], [], { isDemo: false });

      expect(result.metrics.demand_volume_score).toBeGreaterThan(0);
      expect(result.metrics.demand_volume_score).toBeLessThanOrEqual(5);
      // N = 1 -> Math.round(25 * ln(2)/ln(51)) = 4
      expect(result.metrics.demand_volume_score).toBe(4);
    });

    it('demonstrates strictly monotonic increasing volume as signal counts increase', async () => {
      const counts = [1, 5, 10, 20, 35, 50];
      const scores: number[] = [];

      for (const count of counts) {
        const signals = Array.from({ length: count }, (_, i) =>
          createSignal(`sig_${count}_${i}`, 'WARD-001', '2026-08-01T10:00:00.000Z')
        );
        const cluster = createBaseCluster({ signal_count: count });
        const res = await calculateDemandMetrics(cluster, signals, [], [], { isDemo: false });
        scores.push(res.demand_volume_score);
      }

      // Check strictly non-decreasing and mostly strictly increasing
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]!).toBeGreaterThanOrEqual(scores[i - 1]!);
      }
      expect(scores[0]).toBe(4);  // 1 signal
      expect(scores[1]).toBe(11); // 5 signals
      expect(scores[2]).toBe(15); // 10 signals
      expect(scores[3]).toBe(19); // 20 signals
      expect(scores[4]).toBe(23); // 35 signals
      expect(scores[5]).toBe(25); // 50 signals
    });

    it('enforces maximum bound clamp of 25 even for very large signal volumes', async () => {
      const hugeSignals = Array.from({ length: 250 }, (_, i) =>
        createSignal(`sig_huge_${i}`, 'WARD-001', '2026-08-01T10:00:00.000Z')
      );
      const cluster = createBaseCluster({ signal_count: 250 });
      const res = await calculateDemandMetrics(cluster, hugeSignals, [], [], { isDemo: false });

      expect(res.demand_volume_score).toBe(25);
      expect(res.demand_volume_score).toBeLessThanOrEqual(METRIC_BOUNDS.DEMAND_VOLUME_MAX);
    });
  });

  // ==========================================================================
  // 2. RECURRENCE SCORE (0–20)
  // ==========================================================================
  describe('2. Recurrence Score (0–20)', () => {
    it('scores 0 recurrence for burst submissions with identical timestamps / same date', async () => {
      // 10 signals all submitted at the exact same hour
      const burstSignals = Array.from({ length: 10 }, (_, i) =>
        createSignal(`sig_burst_${i}`, 'WARD-001', '2026-08-01T10:00:00.000Z')
      );
      const cluster = createBaseCluster({
        signal_count: 10,
        first_signal_at: '2026-08-01T10:00:00.000Z',
        last_signal_at: '2026-08-01T10:00:00.000Z',
        duration_days: 0
      });

      const res = await calculateDemandMetricsWithDetails(cluster, burstSignals, [], [], { isDemo: false });
      expect(res.metrics.recurrence_score).toBe(0);
      expect(res.components.recurrence.raw_inputs.temporal_duration_days).toBe(0);
      expect(res.components.recurrence.raw_inputs.distinct_active_days).toBe(1);
    });

    it('scores substantially higher for signals repeated over multiple dates across weeks', async () => {
      // 5 signals across 5 separate weeks
      const dates = [
        '2026-08-01T10:00:00.000Z',
        '2026-08-08T10:00:00.000Z',
        '2026-08-15T10:00:00.000Z',
        '2026-08-22T10:00:00.000Z',
        '2026-08-29T10:00:00.000Z'
      ];
      const multiDateSignals = dates.map((d, i) => createSignal(`sig_rep_${i}`, 'WARD-001', d));
      const cluster = createBaseCluster({
        signal_count: 5,
        first_signal_at: dates[0]!,
        last_signal_at: dates[dates.length - 1]!,
        duration_days: 28
      });

      const res = await calculateDemandMetricsWithDetails(cluster, multiDateSignals, [], [], { isDemo: false });
      expect(res.metrics.recurrence_score).toBeGreaterThan(5);
      expect(res.components.recurrence.raw_inputs.distinct_active_days).toBe(5);
      expect(res.components.recurrence.raw_inputs.temporal_duration_days).toBe(28);
    });

    it('reaches maximum recurrence score for long-lived clusters spanning 180 days across 15+ dates', async () => {
      // 16 signals spaced 12 days apart spanning 180 days
      const signals: NormalizedDemandSignal[] = [];
      const baseMs = Date.parse('2026-03-01T00:00:00.000Z');
      for (let i = 0; i < 16; i++) {
        const t = new Date(baseMs + i * 12 * 86400 * 1000).toISOString();
        signals.push(createSignal(`sig_long_${i}`, 'WARD-001', t));
      }

      const cluster = createBaseCluster({
        signal_count: 16,
        first_signal_at: signals[0]!.submitted_at,
        last_signal_at: signals[signals.length - 1]!.submitted_at,
        duration_days: 180
      });

      const res = await calculateDemandMetricsWithDetails(cluster, signals, [], [], { isDemo: false });
      expect(res.metrics.recurrence_score).toBe(20);
      expect(res.components.recurrence.score).toBe(20);
      expect(res.components.recurrence.raw_inputs.effective_duration_days).toBe(180);
    });

    it('clips cleanly at the 180-day rolling window boundary', async () => {
      // Timestamps spanning 300 days
      const signals = [
        createSignal('sig_start', 'WARD-001', '2026-01-01T00:00:00.000Z'),
        createSignal('sig_mid', 'WARD-001', '2026-06-01T00:00:00.000Z'),
        createSignal('sig_end', 'WARD-001', '2026-11-01T00:00:00.000Z')
      ];

      const cluster = createBaseCluster({
        signal_count: 3,
        first_signal_at: '2026-01-01T00:00:00.000Z',
        last_signal_at: '2026-11-01T00:00:00.000Z',
        duration_days: 304
      });

      const res = await calculateDemandMetricsWithDetails(cluster, signals, [], [], { isDemo: false });
      expect(res.components.recurrence.raw_inputs.effective_duration_days).toBe(180);
      expect(res.metrics.recurrence_score).toBeLessThanOrEqual(20);
    });
  });

  // ==========================================================================
  // 3. GEOGRAPHIC CONCENTRATION SCORE (0–15)
  // ==========================================================================
  describe('3. Geographic Concentration Score (0–15)', () => {
    it('awards maximum score (15) for demand concentrated entirely in a single ward', async () => {
      const signals = [
        createSignal('s1', 'WARD-001', '2026-08-01T00:00:00.000Z'),
        createSignal('s2', 'WARD-001', '2026-08-02T00:00:00.000Z'),
        createSignal('s3', 'WARD-001', '2026-08-03T00:00:00.000Z')
      ];
      const cluster = createBaseCluster({ ward_ids: ['WARD-001'] });

      const res = await calculateDemandMetricsWithDetails(cluster, signals, [], [], { isDemo: false });
      expect(res.metrics.geographic_concentration_score).toBe(15);
      expect(res.components.geographic_concentration.score).toBe(15);
      expect(res.components.geographic_concentration.explanation).toContain('entirely localized within a single administrative ward');
    });

    it('evaluates adjacent/nearby wards with moderate concentration score (10–12)', async () => {
      // WARD-001 and WARD-002 are adjacent in northern BMC
      const signals = [
        createSignal('s1', 'WARD-001', '2026-08-01T00:00:00.000Z'),
        createSignal('s2', 'WARD-001', '2026-08-02T00:00:00.000Z'),
        createSignal('s3', 'WARD-001', '2026-08-03T00:00:00.000Z'),
        createSignal('s4', 'WARD-002', '2026-08-04T00:00:00.000Z')
      ];
      const cluster = createBaseCluster({ ward_ids: ['WARD-001', 'WARD-002'] });

      const res = await calculateDemandMetricsWithDetails(cluster, signals, [], [], { isDemo: false });
      expect(res.metrics.geographic_concentration_score).toBeGreaterThanOrEqual(9);
      expect(res.metrics.geographic_concentration_score).toBeLessThanOrEqual(13);
    });

    it('evaluates dispersed wards on opposite sides of the city with low score (2–6)', async () => {
      // Mock geography provider with distant centroids
      const mockGeo = new StaticGeographyProvider();
      const signals = [
        createSignal('s1', 'WARD-001', '2026-08-01T00:00:00.000Z'), // North
        createSignal('s2', 'WARD-040', '2026-08-02T00:00:00.000Z'), // South
        createSignal('s3', 'WARD-060', '2026-08-03T00:00:00.000Z'), // South-west
        createSignal('s4', 'WARD-067', '2026-08-04T00:00:00.000Z')  // Peripheral
      ];
      const cluster = createBaseCluster({ ward_ids: ['WARD-001', 'WARD-040', 'WARD-060', 'WARD-067'] });

      const res = await calculateDemandMetricsWithDetails(cluster, signals, [], [], {
        isDemo: false,
        geographyProvider: mockGeo
      });

      expect(res.metrics.geographic_concentration_score).toBeLessThanOrEqual(6);
      expect(res.metrics.geographic_concentration_score).toBeGreaterThanOrEqual(1);
    });

    it('strictly avoids residential GPS or parcel coordinates in raw inputs or explanation', async () => {
      const cluster = createBaseCluster({ ward_ids: ['WARD-001', 'WARD-002'] });
      const signals = [createSignal('s1', 'WARD-001', '2026-08-01T00:00:00.000Z')];

      const res = await calculateDemandMetricsWithDetails(cluster, signals, [], [], { isDemo: false });
      const serialized = JSON.stringify(res.components.geographic_concentration);

      expect(serialized).not.toContain('gps');
      expect(serialized).not.toContain('parcel');
      expect(serialized).not.toContain('household');
      expect(serialized).not.toContain('address');
    });
  });

  // ==========================================================================
  // 4. POPULATION EXPOSURE SCORE (0–15)
  // ==========================================================================
  describe('4. Population Exposure Score (0–15)', () => {
    it('scores known Census 2011 population deterministically', async () => {
      const cluster = createBaseCluster({ ward_ids: ['WARD-001'] });
      const indicators: DevelopmentIndicator[] = [
        {
          id: 'ind_pop_ward_001',
          ward_id: 'WARD-001',
          indicator_type: 'POPULATION',
          name: 'Ward Total Population',
          value: 12378,
          unit: 'persons',
          measurement_date: '2011-01-01T00:00:00.000Z',
          source: 'Census 2011',
          confidence: 0.95,
          provenance: { is_demo: false, source: 'CENSUS_2011' },
          is_demo: false
        }
      ];

      const res = await calculateDemandMetricsWithDetails(cluster, [], indicators, [], { isDemo: false });
      expect(res.metrics.population_exposure_score).toBe(10);
      expect(res.components.population_exposure.data_available).toBe(true);
      expect(res.components.population_exposure.raw_inputs.total_population).toBe(12378);
    });

    it('aggregates population cleanly across multi-ward clusters without double-counting', async () => {
      const cluster = createBaseCluster({ ward_ids: ['WARD-001', 'WARD-002'] });
      const indicators: DevelopmentIndicator[] = [
        {
          id: 'ind_pop_ward_001',
          ward_id: 'WARD-001',
          indicator_type: 'POPULATION',
          name: 'Ward 1 Population',
          value: 12378,
          unit: 'persons',
          measurement_date: '2011-01-01T00:00:00.000Z',
          source: 'Census 2011',
          confidence: 0.95,
          provenance: { is_demo: false, source: 'CENSUS_2011' },
          is_demo: false
        },
        {
          id: 'ind_pop_ward_002',
          ward_id: 'WARD-002',
          indicator_type: 'POPULATION',
          name: 'Ward 2 Population',
          value: 14200,
          unit: 'persons',
          measurement_date: '2011-01-01T00:00:00.000Z',
          source: 'Census 2011',
          confidence: 0.95,
          provenance: { is_demo: false, source: 'CENSUS_2011' },
          is_demo: false
        },
        // Duplicate indicator for WARD-001 should not be double-added
        {
          id: 'ind_pop_ward_001_dup',
          ward_id: 'WARD-001',
          indicator_type: 'POPULATION',
          name: 'Ward 1 Population Duplicate',
          value: 12378,
          unit: 'persons',
          measurement_date: '2011-01-01T00:00:00.000Z',
          source: 'Census 2011',
          confidence: 0.95,
          provenance: { is_demo: false, source: 'CENSUS_2011' },
          is_demo: false
        }
      ];

      const res = await calculateDemandMetricsWithDetails(cluster, [], indicators, [], { isDemo: false });
      // Total population: 12,378 + 14,200 = 26,578
      expect(res.components.population_exposure.raw_inputs.total_population).toBe(26578);
      expect(res.metrics.population_exposure_score).toBe(13);
    });

    it('honestly treats missing population as 0 score with data_available: false without inventing numbers', async () => {
      const cluster = createBaseCluster({ ward_ids: ['WARD-UNKNOWN-999'] });
      const res = await calculateDemandMetricsWithDetails(cluster, [], [], [], { isDemo: false });

      expect(res.metrics.population_exposure_score).toBe(0);
      expect(res.components.population_exposure.score).toBe(0);
      expect(res.components.population_exposure.data_available).toBe(false);
      expect(res.components.population_exposure.explanation).toContain('Census 2011 population data unavailable');
    });
  });

  // ==========================================================================
  // 5. INFRASTRUCTURE DEFICIT SCORE (0–15)
  // ==========================================================================
  describe('5. Infrastructure Deficit Score (0–15)', () => {
    it('evaluates educational facilities demand against school facility indicator', async () => {
      const cluster = createBaseCluster({
        category: 'educational_facilities',
        title: 'Need Government Primary School in Ward 1'
      });

      // Case 1: 0 schools -> severe deficit (14)
      const indicatorsZeroSchools: DevelopmentIndicator[] = [
        {
          id: 'ind_fac_school_ward_001',
          ward_id: 'WARD-001',
          indicator_type: 'FACILITY_COUNT',
          name: 'Educational Facilities Count (Schools)',
          value: 0,
          unit: 'facilities',
          measurement_date: '2026-09-01T00:00:00.000Z',
          source: 'OPEPA DISE',
          confidence: 0.95,
          provenance: { is_demo: false, source: 'OPEPA_DISE' },
          is_demo: false
        }
      ];

      const resZero = await calculateDemandMetricsWithDetails(cluster, [], indicatorsZeroSchools, [], { isDemo: false });
      expect(resZero.metrics.infrastructure_deficit_score).toBe(14);
      expect(resZero.components.infrastructure_deficit.data_available).toBe(true);

      // Case 2: 3+ schools -> low deficit (2)
      const indicatorsThreeSchools: DevelopmentIndicator[] = [
        {
          ...indicatorsZeroSchools[0]!,
          value: 4
        }
      ];
      const resThree = await calculateDemandMetricsWithDetails(cluster, [], indicatorsThreeSchools, [], { isDemo: false });
      expect(resThree.metrics.infrastructure_deficit_score).toBe(2);
    });

    it('evaluates healthcare accessibility demand against hospital facility indicator', async () => {
      const cluster = createBaseCluster({
        category: 'healthcare_accessibility',
        title: 'Lack of Primary Health Centre in Ward'
      });

      // 0 hospitals -> severe deficit (14)
      const indicatorsZeroHospitals: DevelopmentIndicator[] = [
        {
          id: 'ind_fac_hospital_ward_001',
          ward_id: 'WARD-001',
          indicator_type: 'FACILITY_COUNT',
          name: 'Healthcare Facilities Count (Hospitals/Clinics)',
          value: 0,
          unit: 'facilities',
          measurement_date: '2026-09-01T00:00:00.000Z',
          source: 'BhubaneswarOne GIS Health Facilities',
          confidence: 0.95,
          provenance: { is_demo: false, source: 'GIS_HEALTH' },
          is_demo: false
        }
      ];

      const resZero = await calculateDemandMetricsWithDetails(cluster, [], indicatorsZeroHospitals, [], { isDemo: false });
      expect(resZero.metrics.infrastructure_deficit_score).toBe(14);

      // 2 hospitals -> low deficit (3)
      const indicatorsTwoHospitals: DevelopmentIndicator[] = [
        { ...indicatorsZeroHospitals[0]!, value: 2 }
      ];
      const resTwo = await calculateDemandMetricsWithDetails(cluster, [], indicatorsTwoHospitals, [], { isDemo: false });
      expect(resTwo.metrics.infrastructure_deficit_score).toBe(3);
    });

    it('uses operational problem counts for sectors with active problem aggregate indicator', async () => {
      const cluster = createBaseCluster({
        category: 'drainage_flood_stormwater'
      });

      const indicatorsWithOps: DevelopmentIndicator[] = [
        {
          id: 'ind_ops_problems_ward_001',
          ward_id: 'WARD-001',
          indicator_type: 'OPERATIONAL_PROBLEM_COUNT',
          name: 'Operational Public Problems Count',
          value: 5,
          unit: 'problems',
          measurement_date: '2026-09-24T00:00:00.000Z',
          source: 'CivicPulse Operational Problem Store',
          confidence: 1.0,
          provenance: { is_demo: false, source: 'OPERATIONAL_DB' },
          is_demo: false
        }
      ];

      const res = await calculateDemandMetricsWithDetails(cluster, [], indicatorsWithOps, [], { isDemo: false });
      expect(res.metrics.infrastructure_deficit_score).toBeGreaterThanOrEqual(10);
      expect(res.components.infrastructure_deficit.data_available).toBe(true);
    });

    it('returns honest 0 with data_available: false for unsupported sectors without reference data', async () => {
      const cluster = createBaseCluster({
        category: 'digital_connectivity'
      });

      const res = await calculateDemandMetricsWithDetails(cluster, [], [], [], { isDemo: false });
      expect(res.metrics.infrastructure_deficit_score).toBe(0);
      expect(res.components.infrastructure_deficit.data_available).toBe(false);
      expect(res.components.infrastructure_deficit.explanation).toContain('No authoritative infrastructure reference indicators');
    });
  });

  // ==========================================================================
  // 6. INVESTMENT GAP SCORE (0–10)
  // ==========================================================================
  describe('6. Investment Gap Score (0–10)', () => {
    it('treats empty verified investment dataset as 0 score with data_available: false (not fabricating gap)', async () => {
      const cluster = createBaseCluster();
      const res = await calculateDemandMetricsWithDetails(cluster, [], [], [], { isDemo: false });

      expect(res.metrics.investment_gap_score).toBe(0);
      expect(res.components.investment_gap.score).toBe(0);
      expect(res.components.investment_gap.data_available).toBe(false);
      expect(res.components.investment_gap.explanation).toContain('No verified public investment context available in repository');
    });

    it('scores low investment gap (2) when verified project is actively APPROVED/IN_PROGRESS in same ward and sector', async () => {
      const cluster = createBaseCluster({
        category: 'drinking_water',
        ward_ids: ['WARD-001']
      });

      const relevantInvestment: PublicInvestmentRecord[] = [
        {
          id: 'inv_real_01',
          plan_name: 'AMRUT 2.0 24x7 Piped Water Extension',
          project_id: 'PRJ-WAT-001',
          category: 'drinking_water',
          ward_ids: ['WARD-001'],
          status: PublicInvestmentStatus.IN_PROGRESS,
          documented_budget: 35000000,
          currency: 'INR',
          announcement_date: '2026-01-15T00:00:00.000Z',
          source_agency: 'WATCO Odisha',
          source_url: 'https://watco.odisha.gov.in/amrut-01',
          provenance: { is_demo: false, source: 'WATCO_GAZETTE' },
          is_demo: false
        }
      ];

      const res = await calculateDemandMetricsWithDetails(cluster, [], [], relevantInvestment, { isDemo: false });
      expect(res.metrics.investment_gap_score).toBe(2);
      expect(res.components.investment_gap.data_available).toBe(true);
      expect(res.components.investment_gap.explanation).toContain('is already documented for this sector in the ward');
    });

    it('scores high investment gap (9) when verified investments exist in ward but zero in this sector', async () => {
      const cluster = createBaseCluster({
        category: 'drinking_water',
        ward_ids: ['WARD-001']
      });

      // Investment exists in WARD-001, but for lighting, not drinking water
      const unrelatedSectorInvestment: PublicInvestmentRecord[] = [
        {
          id: 'inv_real_02',
          plan_name: 'Smart High Mast LED Lighting',
          project_id: 'PRJ-LT-002',
          category: 'power_public_lighting',
          ward_ids: ['WARD-001'],
          status: PublicInvestmentStatus.APPROVED,
          documented_budget: 15000000,
          currency: 'INR',
          announcement_date: '2026-02-01T00:00:00.000Z',
          source_agency: 'BSCL',
          source_url: 'https://smartcity.gov.in/led',
          provenance: { is_demo: false, source: 'BSCL' },
          is_demo: false
        }
      ];

      const res = await calculateDemandMetricsWithDetails(cluster, [], [], unrelatedSectorInvestment, { isDemo: false });
      expect(res.metrics.investment_gap_score).toBe(9);
      expect(res.components.investment_gap.data_available).toBe(true);
      expect(res.components.investment_gap.explanation).toContain('Confirmed sectoral investment gap');
    });

    it('strictly filters demo investment records when in REAL_MODE (isDemo: false)', async () => {
      const cluster = createBaseCluster({
        category: 'drinking_water',
        ward_ids: ['WARD-001'],
        is_demo: false
      });

      const demoInvestment: PublicInvestmentRecord[] = [
        {
          id: 'inv_demo_synthetic',
          plan_name: 'Synthetic Demo Water Pipeline Project',
          project_id: 'PRJ-DEMO-001',
          category: 'drinking_water',
          ward_ids: ['WARD-001'],
          status: PublicInvestmentStatus.IN_PROGRESS,
          documented_budget: 50000000,
          currency: 'INR',
          announcement_date: '2026-01-01T00:00:00.000Z',
          source_agency: 'DEMO',
          source_url: 'https://demo.local',
          provenance: { is_demo: true, source: 'GOLDEN_DEMO' },
          is_demo: true // Should be filtered out in REAL_MODE
        }
      ];

      const res = await calculateDemandMetricsWithDetails(cluster, [], [], demoInvestment, { isDemo: false });
      // Because the only record was demo, in REAL_MODE validInvestments is empty -> gap score 0, data_available false
      expect(res.metrics.investment_gap_score).toBe(0);
      expect(res.components.investment_gap.data_available).toBe(false);
    });
  });

  // ==========================================================================
  // 7. COMPOSITE INDEX & PRIORITY BANDS
  // ==========================================================================
  describe('7. Composite Demand Index & Priority Band Boundaries', () => {
    it('verifies composite demand index is exactly the sum of the six component scores', async () => {
      const cluster = createBaseCluster({ signal_count: 10, ward_ids: ['WARD-001'] });
      const signals = Array.from({ length: 10 }, (_, i) =>
        createSignal(`s_${i}`, 'WARD-001', `2026-08-0${i + 1}T10:00:00.000Z`)
      );
      const indicators: DevelopmentIndicator[] = [
        {
          id: 'ind_pop_1',
          ward_id: 'WARD-001',
          indicator_type: 'POPULATION',
          name: 'Ward Population',
          value: 12378,
          unit: 'persons',
          measurement_date: '2011-01-01T00:00:00.000Z',
          source: 'Census 2011',
          confidence: 0.95,
          provenance: { is_demo: false, source: 'CENSUS' },
          is_demo: false
        }
      ];

      const res = await calculateDemandMetricsWithDetails(cluster, signals, indicators, [], { isDemo: false });
      const m = res.metrics;

      const manualSum =
        m.demand_volume_score +
        m.recurrence_score +
        m.geographic_concentration_score +
        m.population_exposure_score +
        m.infrastructure_deficit_score +
        m.investment_gap_score;

      expect(m.composite_demand_index).toBe(manualSum);
      expect(m.composite_demand_index).toBeGreaterThanOrEqual(0);
      expect(m.composite_demand_index).toBeLessThanOrEqual(100);

      // Validate schema conformance
      expect(DeterministicDemandMetricsSchema.safeParse(m).success).toBe(true);
      expect(DetailedDemandMetricsResultSchema.safeParse(res).success).toBe(true);
    });

    it('maps priority bands correctly along canonical thresholds', () => {
      // LOW: 0–39
      expect(mapCompositeToPriorityBand(0)).toBe(DemandPriorityBand.LOW);
      expect(mapCompositeToPriorityBand(39)).toBe(DemandPriorityBand.LOW);

      // MEDIUM: 40–64
      expect(mapCompositeToPriorityBand(40)).toBe(DemandPriorityBand.MEDIUM);
      expect(mapCompositeToPriorityBand(64)).toBe(DemandPriorityBand.MEDIUM);

      // HIGH: 65–84
      expect(mapCompositeToPriorityBand(65)).toBe(DemandPriorityBand.HIGH);
      expect(mapCompositeToPriorityBand(84)).toBe(DemandPriorityBand.HIGH);

      // CRITICAL: 85–100
      expect(mapCompositeToPriorityBand(85)).toBe(DemandPriorityBand.CRITICAL);
      expect(mapCompositeToPriorityBand(100)).toBe(DemandPriorityBand.CRITICAL);
    });
  });

  // ==========================================================================
  // 8. REPRODUCIBILITY & DETERMINISM GUARANTEE
  // ==========================================================================
  describe('8. Determinism & Zero Current-Time Dependence', () => {
    it('produces byte-for-byte identical output over 100 repeated executions with identical inputs', async () => {
      const cluster = createBaseCluster({ signal_count: 5, ward_ids: ['WARD-001'] });
      const signals = [
        createSignal('s1', 'WARD-001', '2026-08-01T00:00:00.000Z'),
        createSignal('s2', 'WARD-001', '2026-08-05T00:00:00.000Z'),
        createSignal('s3', 'WARD-001', '2026-08-10T00:00:00.000Z'),
        createSignal('s4', 'WARD-001', '2026-08-15T00:00:00.000Z'),
        createSignal('s5', 'WARD-001', '2026-08-20T00:00:00.000Z')
      ];

      const indicators: DevelopmentIndicator[] = [
        {
          id: 'ind_pop_w1',
          ward_id: 'WARD-001',
          indicator_type: 'POPULATION',
          name: 'Ward Population',
          value: 12378,
          unit: 'persons',
          measurement_date: '2011-01-01T00:00:00.000Z',
          source: 'Census 2011',
          confidence: 0.95,
          provenance: { is_demo: false, source: 'CENSUS' },
          is_demo: false
        }
      ];

      const firstRun = await calculateDemandMetrics(cluster, signals, indicators, [], { isDemo: false });

      for (let i = 0; i < 100; i++) {
        const nextRun = await calculateDemandMetrics(cluster, signals, indicators, [], { isDemo: false });
        expect(nextRun).toEqual(firstRun);
      }
    });
  });

  // ==========================================================================
  // 9. PRIVACY SAFEGUARDS & RBAC BOUNDARIES
  // ==========================================================================
  describe('9. Privacy Safeguards & Non-Fabrication Invariants', () => {
    it('never leaks citizen PII, residential coordinates, or officer identifiers in details output', async () => {
      const cluster = createBaseCluster();
      const signals = [
        createSignal('sig_privacy_check', 'WARD-001', '2026-08-01T10:00:00.000Z')
      ];

      const res = await calculateDemandMetricsWithDetails(cluster, signals, [], [], { isDemo: false });
      const json = JSON.stringify(res);

      expect(json).not.toContain('email');
      expect(json).not.toContain('phone');
      expect(json).not.toContain('citizen_name');
      expect(json).not.toContain('officer');
      expect(json).not.toContain('auth_user_id');
      expect(json).not.toContain('legacy_firebase_uid');
      expect(json).not.toContain('pupuhari');
      expect(json).not.toContain('@');
    });
  });
});
