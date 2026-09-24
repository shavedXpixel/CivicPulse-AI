import {
  DevelopmentIndicator,
  IDevelopmentIndicatorProvider,
  IPublicInvestmentProvider,
  PublicInvestmentRecord,
  PublicInvestmentStatus
} from '@civicpulse/shared';
import {
  IGeographyProvider,
  IPopulationProvider,
  IFacilityProvider,
  WardInfo,
  PopulationEstimate,
  FacilityRecord
} from './reference.interface';

/**
 * Mock geography provider for DEMO_MODE.
 * Preserves the Golden Demo Ward 18 context with SYNTHETIC provenance.
 */
export class MockGeographyProvider implements IGeographyProvider {
  private wards: WardInfo[] = [
    { ward_id: 'WARD-018', ward_name: 'Ward 18', ward_number: 18, provenance: 'SYNTHETIC', centroid: { lat: 20.2961, lng: 85.8245 } },
    { ward_id: 'WARD-019', ward_name: 'Ward 19', ward_number: 19, provenance: 'SYNTHETIC', centroid: { lat: 20.2980, lng: 85.8300 } },
    { ward_id: 'WARD-020', ward_name: 'Ward 20', ward_number: 20, provenance: 'SYNTHETIC', centroid: { lat: 20.3010, lng: 85.8350 } }
  ];

  async getWardByCoordinates(_lat: number, _lng: number): Promise<WardInfo | null> {
    // In demo mode, map to Golden Demo Ward 18
    return {
      ward_id: 'WARD-018',
      ward_name: 'Ward 18',
      ward_number: 18,
      provenance: 'SYNTHETIC',
      centroid: { lat: 20.2961, lng: 85.8245 }
    };
  }

  async getWardById(wardId: string): Promise<WardInfo | null> {
    const found = this.wards.find((w) => w.ward_id === wardId);
    return found ? { ...found } : { ward_id: wardId, ward_name: `Ward ${wardId}`, ward_number: 18, provenance: 'SYNTHETIC', centroid: { lat: 20.2961, lng: 85.8245 } };
  }

  async listWards(): Promise<WardInfo[]> {
    return this.wards.map((w) => ({ ...w }));
  }

  async getWardCentroid(wardId: string): Promise<{ lat: number; lng: number } | null> {
    const ward = await this.getWardById(wardId);
    return ward?.centroid || null;
  }

  async getWardAreaKm2(_wardId: string): Promise<number | null> {
    return 1.25;
  }
}

/**
 * Mock population provider for DEMO_MODE.
 * Preserves the Golden Demo 18,400 population estimate with SYNTHETIC provenance.
 */
export class MockPopulationProvider implements IPopulationProvider {
  async getWardPopulation(wardId: string): Promise<PopulationEstimate | null> {
    if (wardId === 'WARD-018' || wardId === '18') {
      return {
        ward_id: 'WARD-018',
        population: 18400,
        reference_year: 2011,
        provenance: 'SYNTHETIC',
        source_notes: 'Golden Demo Baseline (SYNTHETIC)'
      };
    }
    return {
      ward_id: wardId,
      population: 12000,
      reference_year: 2011,
      provenance: 'SYNTHETIC',
      source_notes: 'Demo default estimate (SYNTHETIC)'
    };
  }
}

/**
 * Mock critical facility provider for DEMO_MODE.
 * Preserves the Golden Demo DAV Public School proximity (80m) with SYNTHETIC provenance.
 */
export class MockFacilityProvider implements IFacilityProvider {
  async getNearbyFacilities(_lat: number, _lng: number, _radiusMeters: number = 500): Promise<FacilityRecord[]> {
    return [
      {
        id: 'fac_dav_school_01',
        name: 'DAV Public School',
        facility_type: 'SCHOOL',
        distance_meters: 80,
        provenance: 'SYNTHETIC',
        location: { lat: 20.2965, lng: 85.8248 }
      }
    ];
  }

  async getAllFacilities(): Promise<FacilityRecord[]> {
    return this.getNearbyFacilities(20.2965, 85.8248);
  }
}

/**
 * Mock development indicator provider for DEMO_MODE.
 */
export class MockDevelopmentIndicatorProvider implements IDevelopmentIndicatorProvider {
  async getWardIndicators(wardId: string): Promise<DevelopmentIndicator[]> {
    return [
      {
        id: `ind_demo_pop_${wardId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        ward_id: wardId,
        indicator_type: 'POPULATION',
        type: 'POPULATION',
        name: 'Demo Ward Total Population',
        value: 18400,
        unit: 'persons',
        measurement_date: '2026-01-01T00:00:00.000Z',
        date: '2026-01-01T00:00:00.000Z',
        source: 'Golden Demo Baseline (SYNTHETIC)',
        confidence: 0.90,
        provenance: {
          is_demo: true,
          source: 'GOLDEN_DEMO',
          measurement_context: 'Synthetic Demo Baseline'
        },
        is_demo: true
      },
      {
        id: `ind_demo_fac_${wardId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        ward_id: wardId,
        indicator_type: 'FACILITY_COUNT',
        type: 'FACILITY_COUNT',
        name: 'Demo Educational Facilities Count',
        value: 1,
        unit: 'facilities',
        measurement_date: '2026-01-01T00:00:00.000Z',
        date: '2026-01-01T00:00:00.000Z',
        source: 'Golden Demo Baseline (SYNTHETIC)',
        confidence: 0.90,
        provenance: {
          is_demo: true,
          source: 'GOLDEN_DEMO',
          measurement_context: 'Synthetic Demo Baseline'
        },
        is_demo: true
      }
    ];
  }

  async getIndicatorBySector(category: string, wardId: string): Promise<DevelopmentIndicator[]> {
    const all = await this.getWardIndicators(wardId);
    if (!category || category === 'all') return all;
    if (category === 'educational_facilities') {
      return all.filter((i) => i.indicator_type === 'FACILITY_COUNT');
    }
    return [];
  }

  async listAvailableIndicators(): Promise<{ id: string; name: string; unit: string; source: string }[]> {
    return [
      { id: 'demo_population', name: 'Demo Ward Total Population', unit: 'persons', source: 'Golden Demo Baseline' },
      { id: 'demo_facilities', name: 'Demo Educational Facilities Count', unit: 'facilities', source: 'Golden Demo Baseline' }
    ];
  }
}

/**
 * Mock public investment provider for DEMO_MODE.
 */
export class MockPublicInvestmentProvider implements IPublicInvestmentProvider {
  async getInvestmentsByWard(wardId: string): Promise<PublicInvestmentRecord[]> {
    return [
      {
        id: 'inv_demo_01',
        plan_name: 'Golden Demo Smart Water Grid Phase 1',
        project_id: 'PRJ-DEMO-WAT-001',
        category: 'drinking_water',
        ward_ids: [wardId],
        status: PublicInvestmentStatus.APPROVED,
        documented_budget: 15000000,
        currency: 'INR',
        announcement_date: '2026-01-15T00:00:00.000Z',
        date: '2026-01-15T00:00:00.000Z',
        announcement: 'Municipal Smart Water Grid Modernization',
        source_agency: 'BMC Engineering Division (DEMO)',
        source_url: 'https://bmc.gov.in/projects/demo-water-01',
        provenance: {
          is_demo: true,
          source: 'GOLDEN_DEMO',
          measurement_context: 'Synthetic Demo Investment Plan'
        },
        is_demo: true
      }
    ];
  }

  async getInvestmentsByCategory(category: string): Promise<PublicInvestmentRecord[]> {
    const all = await this.getInvestmentsByWard('WARD-018');
    return all.filter((inv) => inv.category.toLowerCase() === category.toLowerCase());
  }
}
