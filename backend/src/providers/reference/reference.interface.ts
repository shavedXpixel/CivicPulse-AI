import { ProvenanceSource } from '@civicpulse/shared';

export interface WardInfo {
  ward_id: string;
  ward_name: string;
  ward_number?: number;
  provenance: ProvenanceSource;
  boundary?: any;
  centroid?: { lat: number; lng: number };
}

export interface PopulationEstimate {
  ward_id: string;
  population: number;
  reference_year?: number;
  provenance: ProvenanceSource;
  source_notes?: string;
}

export interface FacilityRecord {
  id: string;
  name: string;
  facility_type: 'SCHOOL' | 'HOSPITAL' | 'CRITICAL_INFRASTRUCTURE' | 'GOVERNMENT' | 'OTHER';
  distance_meters: number;
  provenance: ProvenanceSource;
  location?: { lat: number; lng: number };
}

export interface IGeographyProvider {
  getWardByCoordinates(lat: number, lng: number): Promise<WardInfo | null>;
  getWardById(wardId: string): Promise<WardInfo | null>;
  listWards(): Promise<WardInfo[]>;
  getWardCentroid?(wardId: string): Promise<{ lat: number; lng: number } | null>;
  getWardAreaKm2?(wardId: string): Promise<number | null>;
}

export interface IPopulationProvider {
  getWardPopulation(wardId: string): Promise<PopulationEstimate | null>;
}

export interface IFacilityProvider {
  getNearbyFacilities(lat: number, lng: number, radiusMeters?: number): Promise<FacilityRecord[]>;
  getAllFacilities?(): Promise<FacilityRecord[]>;
}
