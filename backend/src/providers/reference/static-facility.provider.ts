import fs from 'fs';
import path from 'path';
import { IFacilityProvider, FacilityRecord } from './reference.interface';

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * REAL_MODE facility provider backed by static GeoJSON point data.
 * Reads data/reference/facilities/bmc_facilities.geojson if available.
 * If file is missing, gracefully returns empty array without crashing.
 */
function resolveDataPath(relPath: string): string {
  const direct = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(direct)) return direct;
  const parent = path.resolve(process.cwd(), '..', relPath);
  if (fs.existsSync(parent)) return parent;
  return direct;
}

export class StaticFacilityProvider implements IFacilityProvider {
  private facilitiesPath: string;
  private cachedFacilities: FacilityRecord[] | null = null;

  constructor(customPath?: string) {
    this.facilitiesPath =
      customPath ||
      resolveDataPath('data/reference/facilities/bmc_facilities.geojson');
  }

  private loadFacilities(): FacilityRecord[] {
    if (this.cachedFacilities) return this.cachedFacilities;

    if (!fs.existsSync(this.facilitiesPath)) {
      this.cachedFacilities = [];
      return this.cachedFacilities;
    }

    try {
      const raw = fs.readFileSync(this.facilitiesPath, 'utf8');
      const parsed = JSON.parse(raw);
      const features = parsed.features || [];

      this.cachedFacilities = features
        .map((feat: any, idx: number) => {
          const coords = feat.geometry?.coordinates;
          if (!coords || coords.length < 2) return null;
          const lng = coords[0];
          const lat = coords[1];
          const props = feat.properties || {};

          let type: FacilityRecord['facility_type'] = 'OTHER';
          const rawType = String(props.type || props.facility_type || props.category || '').toUpperCase();
          if (rawType.includes('SCHOOL') || rawType.includes('COLLEGE') || rawType.includes('EDUCATION')) {
            type = 'SCHOOL';
          } else if (rawType.includes('HOSPITAL') || rawType.includes('CLINIC') || rawType.includes('HEALTH')) {
            type = 'HOSPITAL';
          } else if (rawType.includes('GOV') || rawType.includes('OFFICE') || rawType.includes('POLICE')) {
            type = 'GOVERNMENT';
          } else if (rawType.includes('WATER') || rawType.includes('POWER') || rawType.includes('SUBSTATION')) {
            type = 'CRITICAL_INFRASTRUCTURE';
          }

          return {
            id: String(props.id || `fac_${idx + 1}`),
            name: String(props.name || props.facility_name || 'Public Facility'),
            facility_type: type,
            distance_meters: 0,
            provenance: 'REAL',
            location: { lat, lng }
          } as FacilityRecord;
        })
        .filter(Boolean) as FacilityRecord[];

      return this.cachedFacilities;
    } catch {
      this.cachedFacilities = [];
      return this.cachedFacilities;
    }
  }

  async getNearbyFacilities(lat: number, lng: number, radiusMeters: number = 500): Promise<FacilityRecord[]> {
    const facilities = this.loadFacilities();
    if (facilities.length === 0) {
      return [];
    }

    const matches: FacilityRecord[] = [];

    for (const fac of facilities) {
      if (fac.location) {
        const dist = haversineMeters(lat, lng, fac.location.lat, fac.location.lng);
        if (dist <= radiusMeters) {
          matches.push({
            ...fac,
            distance_meters: dist
          });
        }
      }
    }

    return matches.sort((a, b) => a.distance_meters - b.distance_meters);
  }
}
