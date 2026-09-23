import fs from 'fs';
import path from 'path';
import { IGeographyProvider, WardInfo } from './reference.interface';

function isPointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!;
    const xj = ring[j]![0]!, yj = ring[j]![1]!;
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInGeometry(lng: number, lat: number, geometry: any): boolean {
  if (!geometry || !geometry.coordinates) return false;

  if (geometry.type === 'Polygon') {
    const outerRing = geometry.coordinates[0];
    if (!outerRing || !Array.isArray(outerRing)) return false;
    return isPointInRing(lng, lat, outerRing);
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      const outerRing = polygon[0];
      if (outerRing && Array.isArray(outerRing) && isPointInRing(lng, lat, outerRing)) {
        return true;
      }
    }
  }
  return false;
}

function computeGeometryCentroid(geometry: any): { lat: number; lng: number } | null {
  if (!geometry || !geometry.coordinates) return null;
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  const traverse = (item: any) => {
    if (Array.isArray(item) && item.length >= 2 && typeof item[0] === 'number' && typeof item[1] === 'number') {
      sumLng += item[0];
      sumLat += item[1];
      count++;
    } else if (Array.isArray(item)) {
      for (const sub of item) traverse(sub);
    }
  };

  traverse(geometry.coordinates);
  if (count === 0) return null;
  return {
    lat: Number((sumLat / count).toFixed(6)),
    lng: Number((sumLng / count).toFixed(6))
  };
}

/**
 * REAL_MODE geography provider backed by static GeoJSON boundaries.
 * Reads data/reference/geography/bmc_wards.geojson if available.
 * If file is missing, gracefully returns null/empty without crashing.
 */
function resolveDataPath(relPath: string): string {
  const direct = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(direct)) return direct;
  const parent = path.resolve(process.cwd(), '..', relPath);
  if (fs.existsSync(parent)) return parent;
  return direct;
}

export class StaticGeographyProvider implements IGeographyProvider {
  private geojsonPath: string;
  private cachedWards: WardInfo[] | null = null;

  constructor(customPath?: string) {
    this.geojsonPath =
      customPath ||
      resolveDataPath('data/reference/geography/bmc_wards.geojson');
  }

  private loadWards(): WardInfo[] {
    if (this.cachedWards !== null) return this.cachedWards;

    if (!fs.existsSync(this.geojsonPath)) {
      this.cachedWards = [];
      return this.cachedWards;
    }

    try {
      const raw = fs.readFileSync(this.geojsonPath, 'utf8');
      const parsed = JSON.parse(raw);
      const features = parsed.features || [];

      this.cachedWards = features.map((feat: any, index: number) => {
        const props = feat.properties || {};
        const wardId =
          props.ward_id ||
          props.ward_no ||
          props.wardNo ||
          props.id ||
          `WARD-${String(index + 1).padStart(3, '0')}`;
        const wardName = props.ward_name || props.name || props.wardName || `Ward ${wardId}`;

        const rawWardNo = props.ward_number ?? props.ward_no ?? props.wardNo;
        const wardNumber =
          typeof rawWardNo === 'number'
            ? rawWardNo
            : typeof rawWardNo === 'string' && !isNaN(parseInt(rawWardNo, 10))
            ? parseInt(rawWardNo, 10)
            : undefined;

        const centroid = computeGeometryCentroid(feat.geometry);

        return {
          ward_id: String(wardId),
          ward_name: String(wardName),
          ward_number: wardNumber,
          provenance: 'REAL',
          boundary: feat.geometry,
          centroid: centroid || undefined
        };
      });

      return this.cachedWards || [];
    } catch {
      this.cachedWards = [];
      return this.cachedWards;
    }
  }

  async getWardByCoordinates(lat: number, lng: number): Promise<WardInfo | null> {
    const wards = this.loadWards();
    if (wards.length === 0) {
      return null;
    }

    for (const ward of wards) {
      if (ward.boundary && isPointInGeometry(lng, lat, ward.boundary)) {
        return {
          ward_id: ward.ward_id,
          ward_name: ward.ward_name,
          ward_number: ward.ward_number,
          provenance: ward.provenance,
          centroid: ward.centroid
        };
      }
    }

    return null;
  }

  async getWardById(wardId: string): Promise<WardInfo | null> {
    const wards = this.loadWards();
    const found = wards.find((w) => {
      if (w.ward_id === wardId) return true;
      const cleanInput = wardId.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
      const cleanWard = w.ward_id.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
      return cleanInput.length > 0 && cleanInput === cleanWard;
    });
    return found
      ? {
          ward_id: found.ward_id,
          ward_name: found.ward_name,
          ward_number: found.ward_number,
          provenance: found.provenance,
          boundary: found.boundary,
          centroid: found.centroid
        }
      : null;
  }

  async listWards(): Promise<WardInfo[]> {
    return this.loadWards().map((w) => ({
      ward_id: w.ward_id,
      ward_name: w.ward_name,
      ward_number: w.ward_number,
      provenance: w.provenance,
      centroid: w.centroid
    }));
  }

  async getWardCentroid(wardId: string): Promise<{ lat: number; lng: number } | null> {
    const ward = await this.getWardById(wardId);
    return ward?.centroid || null;
  }
}
