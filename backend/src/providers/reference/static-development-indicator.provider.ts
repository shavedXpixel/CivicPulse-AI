import {
  DevelopmentIndicator,
  IDevelopmentIndicatorProvider
} from '@civicpulse/shared';
import {
  IFacilityProvider,
  IGeographyProvider,
  IPopulationProvider,
  FacilityRecord
} from './reference.interface';
import { StaticPopulationProvider } from './static-population.provider';
import {
  StaticGeographyProvider,
  isPointInGeometry,
  computeGeometryAreaKm2
} from './static-geography.provider';
import { StaticFacilityProvider } from './static-facility.provider';
import { IDatabaseProvider } from '../database/database.interface';
import { env } from '../../config/env';

export interface StaticDevelopmentIndicatorOptions {
  isDemo?: boolean;
  facilityPath?: string;
  populationPath?: string;
  geographyPath?: string;
}

/**
 * REAL_MODE Development Indicator Provider.
 *
 * Backed by authoritative reference infrastructure:
 * - StaticPopulationProvider (Census 2011 Primary Census Abstract for BMC)
 * - StaticGeographyProvider (BMC 67 Ward Boundaries GeoJSON)
 * - StaticFacilityProvider (BhubaneswarOne GIS Critical Facilities)
 * - Read-only operational problem aggregates (excluding demo fixtures and PII)
 *
 * Strict Production Invariants:
 * 1. Zero fabricated census data, household income, or poverty values.
 * 2. Mathematically derived values (like population density) record their exact derivation.
 * 3. Every indicator carries strict provenance, confidence, measurement date, and unit.
 * 4. REAL_MODE excludes synthetic/demo items.
 */
export class StaticDevelopmentIndicatorProvider implements IDevelopmentIndicatorProvider {
  private populationProvider: IPopulationProvider;
  private geographyProvider: IGeographyProvider;
  private facilityProvider: IFacilityProvider;
  private dbProvider?: IDatabaseProvider;
  private isDemo: boolean;
  private wardFacilitiesCache: Map<string, FacilityRecord[]> = new Map();

  constructor(
    populationProvider?: IPopulationProvider,
    geographyProvider?: IGeographyProvider,
    facilityProvider?: IFacilityProvider,
    dbProvider?: IDatabaseProvider,
    options?: StaticDevelopmentIndicatorOptions
  ) {
    this.populationProvider = populationProvider || new StaticPopulationProvider(options?.populationPath);
    this.geographyProvider = geographyProvider || new StaticGeographyProvider(options?.geographyPath);
    this.facilityProvider = facilityProvider || new StaticFacilityProvider(options?.facilityPath);
    this.dbProvider = dbProvider;
    this.isDemo = options?.isDemo ?? env.DEMO_MODE;
  }

  private cleanWardKey(wardId: string): string {
    return wardId.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  async getWardIndicators(wardId: string): Promise<DevelopmentIndicator[]> {
    if (!wardId || wardId.trim().length === 0) {
      return [];
    }

    const wardInfo = await this.geographyProvider.getWardById(wardId);
    const popEstimate = await this.populationProvider.getWardPopulation(wardId);

    // If the ward is unknown to both geography and population providers, return empty list (no fabrication)
    if (!wardInfo && !popEstimate) {
      return [];
    }

    const canonicalWardId = wardInfo?.ward_id || popEstimate?.ward_id || wardId;
    const cleanKey = this.cleanWardKey(canonicalWardId);
    const indicators: DevelopmentIndicator[] = [];

    // 1. Population indicator
    if (popEstimate) {
      const isPopSynthetic = popEstimate.provenance === 'SYNTHETIC';
      const indicatorIsDemo = isPopSynthetic || this.isDemo;

      indicators.push({
        id: `ind_pop_${cleanKey}`,
        ward_id: canonicalWardId,
        indicator_type: 'POPULATION',
        type: 'POPULATION',
        name: 'Ward Total Population',
        value: popEstimate.population,
        unit: 'persons',
        measurement_date: `${popEstimate.reference_year || 2011}-01-01T00:00:00.000Z`,
        date: `${popEstimate.reference_year || 2011}-01-01T00:00:00.000Z`,
        source: popEstimate.source_notes || 'Census of India 2011 Primary Census Abstract / Bhubaneswar Municipal Corporation',
        confidence: isPopSynthetic ? 0.85 : 0.95,
        provenance: {
          is_demo: indicatorIsDemo,
          source: popEstimate.source_notes || 'Census 2011 Primary Census Abstract',
          measurement_context: 'Official Ward Population from BMC Census enumeration table',
          confidence: isPopSynthetic ? 0.85 : 0.95
        },
        is_demo: indicatorIsDemo
      });
    }

    // 2. Geographic Area & Population Density
    let areaKm2: number | null = null;
    if (wardInfo?.boundary) {
      areaKm2 = computeGeometryAreaKm2(wardInfo.boundary);
      if (areaKm2 > 0) {
        const isGeoSynthetic = wardInfo.provenance === 'SYNTHETIC';
        const geoIsDemo = isGeoSynthetic || this.isDemo;

        indicators.push({
          id: `ind_area_${cleanKey}`,
          ward_id: canonicalWardId,
          indicator_type: 'GEOGRAPHIC_AREA',
          type: 'GEOGRAPHIC_AREA',
          name: 'Ward Geographic Area',
          value: Number(areaKm2.toFixed(3)),
          unit: 'sq_km',
          measurement_date: '2026-09-07T19:10:56.976Z',
          date: '2026-09-07T19:10:56.976Z',
          source: 'Bhubaneswar Municipal Corporation GIS Administrative Boundary',
          confidence: 0.98,
          provenance: {
            is_demo: geoIsDemo,
            source: 'BMC_GIS_BOUNDARY',
            measurement_context: 'Official Polygon Boundary Geodesic Area Calculation',
            confidence: 0.98
          },
          is_demo: geoIsDemo
        });

        // Mathematically derived density
        if (popEstimate && popEstimate.population > 0) {
          const density = Math.round(popEstimate.population / areaKm2);
          const isDensityDemo = (popEstimate.provenance === 'SYNTHETIC') || isGeoSynthetic || this.isDemo;

          indicators.push({
            id: `ind_density_${cleanKey}`,
            ward_id: canonicalWardId,
            indicator_type: 'POPULATION_DENSITY',
            type: 'POPULATION_DENSITY',
            name: 'Ward Population Density',
            value: density,
            unit: 'persons_per_sq_km',
            measurement_date: `${popEstimate.reference_year || 2011}-01-01T00:00:00.000Z`,
            date: `${popEstimate.reference_year || 2011}-01-01T00:00:00.000Z`,
            source: 'Derived: Census 2011 Population / BMC GIS Boundary Area',
            confidence: 0.92,
            provenance: {
              is_demo: isDensityDemo,
              source: 'BMC_CENSUS_GIS_DERIVATION',
              measurement_context: `Mathematically derived: ${popEstimate.population} persons / ${areaKm2.toFixed(3)} sq km`,
              confidence: 0.92
            },
            is_demo: isDensityDemo
          });
        }
      }
    }

    // 3. Facility Counts & Critical Facilities
    if (wardInfo?.boundary) {
      let wardFacilities = this.wardFacilitiesCache.get(canonicalWardId);
      if (!wardFacilities) {
        const allFacilities = this.facilityProvider.getAllFacilities
          ? await this.facilityProvider.getAllFacilities()
          : [];

        wardFacilities = allFacilities.filter((fac) => {
          if (fac.location && typeof fac.location.lat === 'number' && typeof fac.location.lng === 'number') {
            return isPointInGeometry(fac.location.lng, fac.location.lat, wardInfo.boundary);
          }
          return false;
        });

        this.wardFacilitiesCache.set(canonicalWardId, wardFacilities);
      }

      const totalFacs = wardFacilities.length;
      const schoolCount = wardFacilities.filter((f) => f.facility_type === 'SCHOOL').length;
      const hospitalCount = wardFacilities.filter((f) => f.facility_type === 'HOSPITAL').length;
      const criticalCount = schoolCount + hospitalCount;

      indicators.push({
        id: `ind_fac_total_${cleanKey}`,
        ward_id: canonicalWardId,
        indicator_type: 'FACILITY_COUNT',
        type: 'FACILITY_COUNT',
        name: 'Total Public Facilities Count',
        value: totalFacs,
        unit: 'facilities',
        measurement_date: '2026-09-07T19:10:56.976Z',
        date: '2026-09-07T19:10:56.976Z',
        source: 'BhubaneswarOne GIS (Category MapServer)',
        confidence: 0.95,
        provenance: {
          is_demo: this.isDemo,
          source: 'BhubaneswarOne GIS',
          measurement_context: 'Spatial point-in-polygon aggregation within official ward boundary',
          confidence: 0.95
        },
        is_demo: this.isDemo
      });

      indicators.push({
        id: `ind_fac_school_${cleanKey}`,
        ward_id: canonicalWardId,
        indicator_type: 'FACILITY_COUNT',
        type: 'FACILITY_COUNT',
        name: 'Educational Facilities Count (Schools)',
        value: schoolCount,
        unit: 'facilities',
        measurement_date: '2026-09-07T19:10:56.976Z',
        date: '2026-09-07T19:10:56.976Z',
        source: 'BhubaneswarOne GIS (Category MapServer/22 - School OPEPA DISE)',
        confidence: 0.95,
        provenance: {
          is_demo: this.isDemo,
          source: 'BhubaneswarOne GIS OPEPA DISE',
          measurement_context: 'OPEPA DISE School enumeration within ward boundary',
          confidence: 0.95
        },
        is_demo: this.isDemo
      });

      indicators.push({
        id: `ind_fac_hospital_${cleanKey}`,
        ward_id: canonicalWardId,
        indicator_type: 'FACILITY_COUNT',
        type: 'FACILITY_COUNT',
        name: 'Healthcare Facilities Count (Hospitals/Clinics)',
        value: hospitalCount,
        unit: 'facilities',
        measurement_date: '2026-09-07T19:10:56.976Z',
        date: '2026-09-07T19:10:56.976Z',
        source: 'BhubaneswarOne GIS (Category MapServer - Health Facilities)',
        confidence: 0.95,
        provenance: {
          is_demo: this.isDemo,
          source: 'BhubaneswarOne GIS Health Facilities',
          measurement_context: 'Health facility locations within ward boundary',
          confidence: 0.95
        },
        is_demo: this.isDemo
      });

      indicators.push({
        id: `ind_fac_critical_${cleanKey}`,
        ward_id: canonicalWardId,
        indicator_type: 'CRITICAL_FACILITY_PRESENCE',
        type: 'CRITICAL_FACILITY_PRESENCE',
        name: 'Critical Facility Count (Schools & Hospitals)',
        value: criticalCount,
        unit: 'facilities',
        measurement_date: '2026-09-07T19:10:56.976Z',
        date: '2026-09-07T19:10:56.976Z',
        source: 'BhubaneswarOne GIS',
        confidence: 0.95,
        provenance: {
          is_demo: this.isDemo,
          source: 'BhubaneswarOne GIS',
          measurement_context: 'Total critical public infrastructure points in ward',
          confidence: 0.95
        },
        is_demo: this.isDemo
      });
    }

    // 4. Read-Only Operational Problem Aggregates (Strict Real-Mode Boundary, No PII, No Officer UUIDs)
    if (this.dbProvider?.listProblemClusters) {
      try {
        const clusterRes = await this.dbProvider.listProblemClusters({
          ward_id: canonicalWardId,
          limit: 100
        });

        // Filter out demo problems strictly
        const realProblems = (clusterRes.data || []).filter((p) => !p.is_demo);

        indicators.push({
          id: `ind_ops_problems_${cleanKey}`,
          ward_id: canonicalWardId,
          indicator_type: 'OPERATIONAL_PROBLEM_COUNT',
          type: 'OPERATIONAL_PROBLEM_COUNT',
          name: 'Operational Public Problems Count',
          value: realProblems.length,
          unit: 'problems',
          measurement_date: new Date().toISOString(),
          date: new Date().toISOString(),
          source: 'CivicPulse Operational Problem Store',
          confidence: 1.0,
          provenance: {
            is_demo: false,
            source: 'CIVICPULSE_OPERATIONAL_DB',
            measurement_context: 'Read-only aggregate of registered operational problem clusters, strictly excluding demo fixtures and citizen PII',
            confidence: 1.0
          },
          is_demo: false
        });
      } catch {
        // Non-fatal: if dbProvider is not connected or mock throws, do not fail
      }
    }

    // REAL_MODE Boundary enforcement:
    // If not in demo mode, strictly exclude any indicator that is marked is_demo = true
    if (!this.isDemo) {
      return indicators.filter((ind) => !ind.is_demo && !ind.provenance?.is_demo);
    }

    return indicators;
  }

  async getIndicatorBySector(category: string, wardId: string): Promise<DevelopmentIndicator[]> {
    const all = await this.getWardIndicators(wardId);
    if (!category || category === 'all') {
      return all;
    }

    const catLower = category.toLowerCase().trim();

    if (catLower === 'educational_facilities' || catLower.includes('education') || catLower.includes('school')) {
      return all.filter(
        (ind) =>
          ind.id.includes('school') ||
          ind.name.toLowerCase().includes('school') ||
          ind.name.toLowerCase().includes('education')
      );
    }

    if (catLower === 'healthcare_accessibility' || catLower.includes('health') || catLower.includes('hospital')) {
      return all.filter(
        (ind) =>
          ind.id.includes('hospital') ||
          ind.name.toLowerCase().includes('hospital') ||
          ind.name.toLowerCase().includes('health')
      );
    }

    // For sectors without reference dataset in the repository (e.g. drinking_water, sanitation),
    // return empty array rather than fabricating numbers.
    return [];
  }

  async listAvailableIndicators(): Promise<{ id: string; name: string; unit: string; source: string }[]> {
    return [
      {
        id: 'ward_population',
        name: 'Ward Total Population',
        unit: 'persons',
        source: 'Census of India 2011 Primary Census Abstract / Bhubaneswar Municipal Corporation'
      },
      {
        id: 'ward_population_density',
        name: 'Ward Population Density',
        unit: 'persons_per_sq_km',
        source: 'Derived: Census 2011 Population / BMC GIS Boundary Area'
      },
      {
        id: 'ward_geographic_area',
        name: 'Ward Geographic Area',
        unit: 'sq_km',
        source: 'Bhubaneswar Municipal Corporation GIS Administrative Boundary'
      },
      {
        id: 'total_facilities_count',
        name: 'Total Public Facilities Count',
        unit: 'facilities',
        source: 'BhubaneswarOne GIS (Category MapServer)'
      },
      {
        id: 'school_facilities_count',
        name: 'Educational Facilities Count (Schools)',
        unit: 'facilities',
        source: 'BhubaneswarOne GIS (Category MapServer/22 - School OPEPA DISE)'
      },
      {
        id: 'hospital_facilities_count',
        name: 'Healthcare Facilities Count (Hospitals/Clinics)',
        unit: 'facilities',
        source: 'BhubaneswarOne GIS (Category MapServer - Health Facilities)'
      },
      {
        id: 'critical_facilities_count',
        name: 'Critical Facility Count (Schools & Hospitals)',
        unit: 'facilities',
        source: 'BhubaneswarOne GIS'
      },
      {
        id: 'operational_problem_count',
        name: 'Operational Public Problems Count',
        unit: 'problems',
        source: 'CivicPulse Operational Problem Store'
      }
    ];
  }
}
