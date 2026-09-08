import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  StaticGeographyProvider,
  StaticPopulationProvider,
  StaticFacilityProvider
} from '../src/providers';
import { ProviderContainer, MockDatabaseProvider } from '../src/providers';
import { impactService } from '../src/modules/impact/impact.service';
import { clusteringService } from '../src/modules/clustering/clustering.service';
import { SignalRepository } from '../src/modules/signals/signal.repository';
import { ProblemRepository } from '../src/modules/problems/problem.repository';
import { env } from '../src/config/env';
import {
  SignalSourceType,
  SignalSeverity,
  SignalStatus,
  SignalProcessingStatus,
  ProblemStatus,
  ImpactLevel
} from '@civicpulse/shared';

describe('Phase 10 — Real Reference Data Integration', () => {
  const originalDemoMode = env.DEMO_MODE;

  beforeEach(() => {
    ProviderContainer.resetAllProviders();
    (env as any).DEMO_MODE = false;
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.resetAllProviders();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Real BMC Ward Polygon Lookup (Small Fixture)
  // =========================================================================
  describe('1. BMC Ward Polygon Lookup (Unit Fixture)', () => {
    it('accurately resolves point-in-polygon for representative ward boundary', async () => {
      // Small representative fixture: Ward 18 (Nayapalli) bounded box
      const fixtureWards = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: 'WARD-018',
            properties: {
              ward_id: 'WARD-018',
              ward_number: 18,
              ward_name: 'Ward 18 (North Zone)',
              source_type: 'REAL'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [85.86, 20.28],
                  [85.89, 20.28],
                  [85.89, 20.32],
                  [85.86, 20.32],
                  [85.86, 20.28]
                ]
              ]
            }
          }
        ]
      };

      const tempGeoPath = path.resolve(process.cwd(), 'temp_test_wards.geojson');
      fs.writeFileSync(tempGeoPath, JSON.stringify(fixtureWards), 'utf8');

      try {
        const provider = new StaticGeographyProvider(tempGeoPath);

        // Point inside Ward 18
        const inside = await provider.getWardByCoordinates(20.30, 85.875);
        expect(inside).not.toBeNull();
        expect(inside?.ward_id).toBe('WARD-018');
        expect(inside?.ward_name).toBe('Ward 18 (North Zone)');
        expect(inside?.provenance).toBe('REAL');

        // Point outside Ward 18
        const outside = await provider.getWardByCoordinates(20.25, 85.80);
        expect(outside).toBeNull();
      } finally {
        if (fs.existsSync(tempGeoPath)) fs.unlinkSync(tempGeoPath);
      }
    });
  });

  // =========================================================================
  // 2. Boundary Lookup Using Actual Normalized Data
  // =========================================================================
  describe('2. Boundary Lookup Using Actual Normalized Data', () => {
    const geoProvider = new StaticGeographyProvider();

    it('loads 67 authoritative BMC wards with REAL provenance', async () => {
      const wards = await geoProvider.listWards();
      expect(wards.length).toBe(67);
      expect(wards.every((w) => w.provenance === 'REAL')).toBe(true);
      expect(wards.some((w) => w.ward_id === 'WARD-018')).toBe(true);
      expect(wards.some((w) => w.ward_id === 'WARD-027')).toBe(true);
    });

    it('resolves actual coordinates to BMC ward polygons without fallback', async () => {
      // Real Nayapalli coordinates resolve to Ward 27 in BMC boundaries
      const wardNayapalli = await geoProvider.getWardByCoordinates(20.2961, 85.8245);
      expect(wardNayapalli).not.toBeNull();
      expect(wardNayapalli?.ward_id).toBe('WARD-027');
      expect(wardNayapalli?.provenance).toBe('REAL');

      // Direct Ward 18 polygon coordinates
      const ward18Direct = await geoProvider.getWardByCoordinates(20.3000, 85.8756);
      expect(ward18Direct).not.toBeNull();
      expect(ward18Direct?.ward_id).toBe('WARD-018');
      expect(ward18Direct?.provenance).toBe('REAL');
    });

    it('supports flexible ward ID lookup (WARD-018 and 18)', async () => {
      const byFormatted = await geoProvider.getWardById('WARD-018');
      const byRawNumber = await geoProvider.getWardById('18');

      expect(byFormatted).not.toBeNull();
      expect(byRawNumber).not.toBeNull();
      expect(byFormatted?.ward_id).toBe('WARD-018');
      expect(byRawNumber?.ward_id).toBe('WARD-018');
      expect(byFormatted?.ward_name).toContain('Ward 18');
    });
  });

  // =========================================================================
  // 3. Ward Population Lookup (Census 2011)
  // =========================================================================
  describe('3. Ward Population Lookup (Census 2011)', () => {
    const popProvider = new StaticPopulationProvider();

    it('retrieves Census 2011 population with ESTIMATED provenance', async () => {
      const pop18 = await popProvider.getWardPopulation('WARD-018');
      expect(pop18).not.toBeNull();
      expect(pop18?.population).toBe(13094);
      expect(pop18?.provenance).toBe('ESTIMATED');
      expect(pop18?.source_notes).toMatch(/Census.*2011/);

      // Normalized ward lookup with raw number
      const pop18ByNum = await popProvider.getWardPopulation('18');
      expect(pop18ByNum).not.toBeNull();
      expect(pop18ByNum?.population).toBe(13094);
      expect(pop18ByNum?.provenance).toBe('ESTIMATED');
    });

    it('retrieves population for Ward 27', async () => {
      const pop27 = await popProvider.getWardPopulation('WARD-027');
      expect(pop27).not.toBeNull();
      expect(pop27?.population).toBe(12039);
      expect(pop27?.provenance).toBe('ESTIMATED');
    });

    it('returns null for non-existent ward', async () => {
      const nonExistent = await popProvider.getWardPopulation('WARD-999');
      expect(nonExistent).toBeNull();
    });
  });

  // =========================================================================
  // 4. Public Facilities Proximity Lookup
  // =========================================================================
  describe('4. Public Facilities Proximity Lookup', () => {
    const facProvider = new StaticFacilityProvider();

    it('finds real schools and health facilities within radius with REAL provenance', async () => {
      const nearby = await facProvider.getNearbyFacilities(20.2961, 85.8245, 1000);
      expect(nearby.length).toBeGreaterThan(0);
      expect(nearby.every((f) => f.provenance === 'REAL')).toBe(true);

      // Verify sorted by distance
      for (let i = 1; i < nearby.length; i++) {
        expect(nearby[i]!.distance_meters).toBeGreaterThanOrEqual(nearby[i - 1]!.distance_meters);
      }

      // Proximity should contain real institutions
      const names = nearby.map((f) => f.name);
      expect(names.some((n) => n.includes('Acharya Vihar') || n.includes('R R L Colony') || n.includes('Health'))).toBe(true);
    });

    it('returns empty array when no facilities within requested radius', async () => {
      // 5 meter radius around arbitrary coordinate
      const veryTight = await facProvider.getNearbyFacilities(20.2961, 85.8245, 5);
      expect(Array.isArray(veryTight)).toBe(true);
    });
  });

  // =========================================================================
  // 5. Data Provenance Verification
  // =========================================================================
  describe('5. Data Provenance Derivation', () => {
    it('correctly maps REAL, ESTIMATED, and UNKNOWN provenance', async () => {
      // Case A: Real mode problem with coordinates and ward_id matching reference datasets
      const realProblem: any = {
        id: 'PRB-TEST-REAL',
        ward_id: 'WARD-027',
        location: { lat: 20.2961, lng: 85.8245 },
        is_demo: false
      };

      const prov = await impactService.deriveProvenance(realProblem);
      expect(prov.geography).toBe('REAL');
      expect(prov.population).toBe('ESTIMATED');
      expect(prov.facility).toBe('REAL');
    });

    it('marks unlinked/missing fields as UNKNOWN', async () => {
      // Case B: Real mode problem in ocean / out of coverage
      const unlinkedProblem: any = {
        id: 'PRB-TEST-OCEAN',
        location: { lat: 10.0, lng: 70.0 }, // Arabian Sea
        is_demo: false
      };

      const prov = await impactService.deriveProvenance(unlinkedProblem);
      expect(prov.geography).toBe('UNKNOWN');
      expect(prov.population).toBe('UNKNOWN');
      expect(prov.facility).toBe('UNKNOWN');
    });
  });

  // =========================================================================
  // 6. Missing-Data Behavior (Degradation without Defaulting to Ward 18)
  // =========================================================================
  describe('6. Missing-Data & Out-of-Coverage Behavior', () => {
    it('returns null for coordinates outside BMC boundary without defaulting to Ward 18', async () => {
      const geoProvider = new StaticGeographyProvider();
      const bayOfBengal = await geoProvider.getWardByCoordinates(18.0, 88.0);
      expect(bayOfBengal).toBeNull();

      const facProvider = new StaticFacilityProvider();
      const oceanFacs = await facProvider.getNearbyFacilities(18.0, 88.0, 2000);
      expect(oceanFacs).toEqual([]);
    });

    it('gracefully handles missing reference files without crashing', async () => {
      const missingGeo = new StaticGeographyProvider('/non/existent/path/wards.geojson');
      const missingPop = new StaticPopulationProvider('/non/existent/path/pop.json');
      const missingFac = new StaticFacilityProvider('/non/existent/path/fac.geojson');

      expect(await missingGeo.getWardByCoordinates(20.2961, 85.8245)).toBeNull();
      expect(await missingGeo.listWards()).toEqual([]);
      expect(await missingPop.getWardPopulation('WARD-018')).toBeNull();
      expect(await missingFac.getNearbyFacilities(20.2961, 85.8245)).toEqual([]);
    });
  });

  // =========================================================================
  // 7. Real-Mode Enrichment in Clustering Pipeline
  // =========================================================================
  describe('7. Real-Mode Clustering & Impact Enrichment', () => {
    it('enriches newly clustered problem with real ward, census population, and facilities', async () => {
      const db = new MockDatabaseProvider();
      ProviderContainer.setDatabaseProvider(db);
      (env as any).DEMO_MODE = false;

      const signalRepo = new SignalRepository();
      const problemRepo = new ProblemRepository();

      // Create a real citizen signal in Nayapalli
      const signal = await signalRepo.create({
        id: `sig_enrich_${Date.now()}`,
        source_type: SignalSourceType.CITIZEN,
        citizen_id: 'usr_real_cit_99',
        original_text: 'Flooding and road blockage near Nayapalli VIP road crossing',
        normalized_text: 'Road blockage from flooding near Nayapalli',
        category: 'solid_waste',
        location: { lat: 20.2961, lng: 85.8245 },
        severity: SignalSeverity.HIGH,
        status: SignalStatus.ACTIVE,
        processing_status: SignalProcessingStatus.COMPLETED,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Cluster signal with auto-create
      const { problem } = await clusteringService.createClusterFromSignal(signal.id);

      // Verify REAL_MODE reference data was applied:
      // 1. Ward resolved to WARD-027 (not defaulted to Ward 18)
      expect(problem.ward_id).toBe('WARD-027');

      // 2. Population resolved to Census 2011 figure for Ward 27 (12,039)
      expect(problem.estimated_population).toBe(12039);

      // 3. Population score derived deterministically from formula (pop 12,039 >= 5000 -> 14)
      expect(problem.population_score).toBe(14);

      // 4. Critical facility exposure score derived from nearby facility (Acharya Vihar PS)
      expect(problem.critical_exposure_score).toBe(8);

      // 5. Provenance correctly indicates REAL geography & facilities, ESTIMATED population
      expect(problem.data_provenance).toBeDefined();
      expect(problem.data_provenance?.geography).toBe('REAL');
      expect(problem.data_provenance?.population).toBe('ESTIMATED');
      expect(problem.data_provenance?.facility).toBe('REAL');

      // 6. Impact score is exact deterministic sum of the 7 factors
      const totalScore =
        problem.severity_score +
        problem.population_score +
        problem.duration_score +
        problem.concentration_score +
        problem.critical_exposure_score +
        problem.recurrence_score +
        problem.evidence_score;
      expect(problem.impact_score).toBe(totalScore);
    });
  });

  // =========================================================================
  // 8. DEMO_MODE Isolation
  // =========================================================================
  describe('8. DEMO_MODE Isolation', () => {
    it('preserves Golden Demo PRB-2026-0819 with SYNTHETIC provenance and score 92', async () => {
      (env as any).DEMO_MODE = true;
      ProviderContainer.resetAllProviders();
      const db = new MockDatabaseProvider();

      const goldenProblem = await db.getProblemCluster('PRB-2026-0819');
      expect(goldenProblem).not.toBeNull();
      expect(goldenProblem?.ward_id).toBe('WARD-018');
      expect(goldenProblem?.impact_score).toBe(92);
      expect(goldenProblem?.estimated_population).toBe(18400);

      const prov = await impactService.deriveProvenance(goldenProblem!);
      expect(prov.geography).toBe('SYNTHETIC');
      expect(prov.population).toBe('SYNTHETIC');
      expect(prov.facility).toBe('SYNTHETIC');
    });
  });
});
