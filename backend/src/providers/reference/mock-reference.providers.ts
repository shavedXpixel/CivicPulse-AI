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
}
