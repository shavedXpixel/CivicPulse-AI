import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  ProviderContainer,
  getGeographyProvider,
  getPopulationProvider,
  getFacilityProvider,
  MockGeographyProvider,
  MockPopulationProvider,
  MockFacilityProvider,
  StaticGeographyProvider,
  StaticPopulationProvider,
  StaticFacilityProvider,
  MockDatabaseProvider
} from '../src/providers';
import { env } from '../src/config/env';
import { SignalService } from '../src/modules/signals/signal.service';
import { SignalRepository } from '../src/modules/signals/signal.repository';
import { deriveProblemProvenance } from '../src/modules/impact/impact.service';
import { UserProfile, UserRole, UserStatus, ProblemStatus, ImpactLevel } from '@civicpulse/shared';

describe('Phase 10 Step 2: Reference Data Providers & Provenance', () => {
  const originalDemoMode = env.DEMO_MODE;
  let tempDir: string;

  beforeEach(() => {
    ProviderContainer.resetAllProviders();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-test-'));
  });

  afterEach(() => {
    (env as any).DEMO_MODE = originalDemoMode;
    ProviderContainer.resetAllProviders();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('1. Reference Provider Registration', () => {
    it('registers mock reference providers when DEMO_MODE=true', () => {
      (env as any).DEMO_MODE = true;
      ProviderContainer.resetAllProviders();

      expect(getGeographyProvider()).toBeInstanceOf(MockGeographyProvider);
      expect(getPopulationProvider()).toBeInstanceOf(MockPopulationProvider);
      expect(getFacilityProvider()).toBeInstanceOf(MockFacilityProvider);
    });

    it('registers static reference providers when DEMO_MODE=false', () => {
      (env as any).DEMO_MODE = false;
      ProviderContainer.resetAllProviders();

      expect(getGeographyProvider()).toBeInstanceOf(StaticGeographyProvider);
      expect(getPopulationProvider()).toBeInstanceOf(StaticPopulationProvider);
      expect(getFacilityProvider()).toBeInstanceOf(StaticFacilityProvider);
    });
  });

  describe('2. Missing Reference Files Graceful Handling', () => {
    it('StaticGeographyProvider returns null/empty on missing files without throwing', async () => {
      const nonExistentPath = path.join(tempDir, 'missing_wards.geojson');
      const provider = new StaticGeographyProvider(nonExistentPath);

      const ward = await provider.getWardByCoordinates(20.2961, 85.8245);
      expect(ward).toBeNull();

      const wards = await provider.listWards();
      expect(wards).toEqual([]);
    });

    it('StaticPopulationProvider returns null on missing files without throwing', async () => {
      const nonExistentPath = path.join(tempDir, 'missing_pop.json');
      const provider = new StaticPopulationProvider(nonExistentPath);

      const pop = await provider.getWardPopulation('WARD-018');
      expect(pop).toBeNull();
    });

    it('StaticFacilityProvider returns empty array on missing files without throwing', async () => {
      const nonExistentPath = path.join(tempDir, 'missing_facilities.geojson');
      const provider = new StaticFacilityProvider(nonExistentPath);

      const facilities = await provider.getNearbyFacilities(20.2961, 85.8245, 500);
      expect(facilities).toEqual([]);
    });
  });

  describe('3. Valid Static Provider Lookups', () => {
    it('StaticGeographyProvider correctly identifies point inside GeoJSON polygon', async () => {
      const geojsonFile = path.join(tempDir, 'test_wards.geojson');
      const sampleGeoJson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              ward_id: 'WARD-042',
              ward_name: 'Chandrasekharpur Ward 42'
            },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [85.80, 20.30],
                  [85.85, 20.30],
                  [85.85, 20.35],
                  [85.80, 20.35],
                  [85.80, 20.30]
                ]
              ]
            }
          }
        ]
      };
      fs.writeFileSync(geojsonFile, JSON.stringify(sampleGeoJson), 'utf8');

      const provider = new StaticGeographyProvider(geojsonFile);

      // Point inside polygon
      const match = await provider.getWardByCoordinates(20.32, 85.82);
      expect(match).not.toBeNull();
      expect(match?.ward_id).toBe('WARD-042');
      expect(match?.ward_name).toBe('Chandrasekharpur Ward 42');
      expect(match?.provenance).toBe('REAL');

      // Point outside polygon
      const outside = await provider.getWardByCoordinates(20.25, 85.80);
      expect(outside).toBeNull();
    });

    it('StaticPopulationProvider correctly looks up population with ESTIMATED provenance', async () => {
      const popFile = path.join(tempDir, 'test_pop.json');
      fs.writeFileSync(
        popFile,
        JSON.stringify({
          'WARD-042': { population: 21500, source: 'Census 2011 Table' }
        }),
        'utf8'
      );

      const provider = new StaticPopulationProvider(popFile);
      const res = await provider.getWardPopulation('WARD-042');
      expect(res).not.toBeNull();
      expect(res?.population).toBe(21500);
      expect(res?.provenance).toBe('ESTIMATED');

      const missingWard = await provider.getWardPopulation('WARD-999');
      expect(missingWard).toBeNull();
    });

    it('StaticFacilityProvider filters nearby points within radius with REAL provenance', async () => {
      const facFile = path.join(tempDir, 'test_facilities.geojson');
      const sampleFacilities = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: 'fac_capital_hospital',
              name: 'Capital Hospital',
              type: 'HOSPITAL'
            },
            geometry: {
              type: 'Point',
              coordinates: [85.8248, 20.2965] // Very close to (20.2961, 85.8245) ~50m
            }
          },
          {
            type: 'Feature',
            properties: {
              id: 'fac_distant_school',
              name: 'Distant High School',
              type: 'SCHOOL'
            },
            geometry: {
              type: 'Point',
              coordinates: [85.9000, 20.4000] // ~14 km away
            }
          }
        ]
      };
      fs.writeFileSync(facFile, JSON.stringify(sampleFacilities), 'utf8');

      const provider = new StaticFacilityProvider(facFile);
      const matches = await provider.getNearbyFacilities(20.2961, 85.8245, 500);

      expect(matches).toHaveLength(1);
      expect(matches[0]?.name).toBe('Capital Hospital');
      expect(matches[0]?.facility_type).toBe('HOSPITAL');
      expect(matches[0]?.provenance).toBe('REAL');
      expect(matches[0]?.distance_meters).toBeLessThan(100);
    });
  });

  describe('4. DEMO_MODE Golden Demo Values Preservation', () => {
    it('DEMO_MODE reference providers return Ward 18, 18400 pop, DAV School with SYNTHETIC provenance', async () => {
      (env as any).DEMO_MODE = true;
      ProviderContainer.resetAllProviders();

      const geo = getGeographyProvider();
      const ward = await geo.getWardByCoordinates(20.2961, 85.8245);
      expect(ward?.ward_id).toBe('WARD-018');
      expect(ward?.ward_name).toBe('Ward 18');
      expect(ward?.provenance).toBe('SYNTHETIC');

      const pop = getPopulationProvider();
      const popRes = await pop.getWardPopulation('WARD-018');
      expect(popRes?.population).toBe(18400);
      expect(popRes?.provenance).toBe('SYNTHETIC');

      const fac = getFacilityProvider();
      const facRes = await fac.getNearbyFacilities(20.2961, 85.8245);
      expect(facRes).toHaveLength(1);
      expect(facRes[0]?.name).toBe('DAV Public School');
      expect(facRes[0]?.distance_meters).toBe(80);
      expect(facRes[0]?.provenance).toBe('SYNTHETIC');
    });
  });

  describe('5. REAL_MODE Signal Geography Enrichment', () => {
    const mockUser: UserProfile = {
      id: 'usr_real_01',
      email: 'citizen@example.com',
      display_name: 'Citizen Real',
      role: UserRole.CITIZEN,
      status: UserStatus.ACTIVE,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    it('enriches signal with resolved ward and REAL provenance when location matches', async () => {
      (env as any).DEMO_MODE = false;
      ProviderContainer.resetAllProviders();
      ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());

      // Inject test geography provider with defined polygon
      const geojsonFile = path.join(tempDir, 'signal_test_wards.geojson');
      fs.writeFileSync(
        geojsonFile,
        JSON.stringify({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { ward_id: 'WARD-025', ward_name: 'Saheed Nagar' },
              geometry: {
                type: 'Polygon',
                coordinates: [
                  [
                    [85.80, 20.20],
                    [85.90, 20.20],
                    [85.90, 20.30],
                    [85.80, 20.30],
                    [85.80, 20.20]
                  ]
                ]
              }
            }
          ]
        }),
        'utf8'
      );
      ProviderContainer.setGeographyProvider(new StaticGeographyProvider(geojsonFile));

      const service = new SignalService(new SignalRepository());
      const signal = await service.createSignal(mockUser, {
        original_text: 'Burst pipe on Janpath road',
        location: { lat: 20.25, lng: 85.85 }
      });

      expect(signal.ward_id).toBe('WARD-025');
      expect(signal.ward_name).toBe('Saheed Nagar');
      expect(signal.geography_provenance).toBe('REAL');
    });

    it('assigns UNKNOWN provenance and does NOT default to Ward 18 when reference data is missing', async () => {
      (env as any).DEMO_MODE = false;
      ProviderContainer.resetAllProviders();
      ProviderContainer.setDatabaseProvider(new MockDatabaseProvider());

      // Empty / missing geography provider
      ProviderContainer.setGeographyProvider(new StaticGeographyProvider(path.join(tempDir, 'none.geojson')));

      const service = new SignalService(new SignalRepository());
      const signal = await service.createSignal(mockUser, {
        original_text: 'Unknown location pipe leak',
        location: { lat: 20.2961, lng: 85.8245 }
      });

      // Crucial requirement: DO NOT default to Ward 18 in REAL_MODE
      expect(signal.ward_id).toBeUndefined();
      expect(signal.ward_name).toBeUndefined();
      expect(signal.geography_provenance).toBe('UNKNOWN');
    });
  });

  describe('6. Problem Provenance Derivation Integration', () => {
    it('derives SYNTHETIC provenance for is_demo problems', async () => {
      const demoProblem = {
        id: 'PRB-2026-0819',
        is_demo: true,
        severity_score: 24,
        population_score: 18,
        duration_score: 14,
        concentration_score: 14,
        critical_exposure_score: 9,
        recurrence_score: 8,
        evidence_score: 5,
        title: 'Demo Main Rupture',
        category: 'water_supply',
        status: ProblemStatus.IN_PROGRESS,
        signal_count: 327,
        impact_score: 92,
        impact_level: ImpactLevel.CRITICAL,
        first_detected_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const prov = await deriveProblemProvenance(demoProblem as any);
      expect(prov.geography).toBe('SYNTHETIC');
      expect(prov.population).toBe('SYNTHETIC');
      expect(prov.facility).toBe('SYNTHETIC');
    });

    it('derives UNKNOWN provenance for non-demo problems without reference data', async () => {
      (env as any).DEMO_MODE = false;
      ProviderContainer.resetAllProviders();

      const realProblem = {
        id: 'PRB-REAL-001',
        is_demo: false,
        severity_score: 15,
        population_score: 10,
        duration_score: 8,
        concentration_score: 6,
        critical_exposure_score: 0,
        recurrence_score: 5,
        evidence_score: 3,
        title: 'Real World Incident',
        category: 'drainage',
        status: ProblemStatus.NEW,
        signal_count: 3,
        impact_score: 47,
        impact_level: ImpactLevel.MEDIUM,
        location: { lat: 20.35, lng: 85.80 },
        ward_id: 'WARD-999',
        first_detected_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const prov = await deriveProblemProvenance(realProblem as any);
      expect(prov.geography).toBe('UNKNOWN');
      expect(prov.population).toBe('UNKNOWN');
      expect(prov.facility).toBe('UNKNOWN');
    });
  });
});
