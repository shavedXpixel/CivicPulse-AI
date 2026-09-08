import fs from 'fs';
import path from 'path';
import { IPopulationProvider, PopulationEstimate } from './reference.interface';

/**
 * REAL_MODE population provider backed by static population tables (e.g., Census 2011 ward data).
 * Reads data/reference/population/bmc_ward_population.json if available.
 * If file is missing, gracefully returns null without crashing.
 */
function resolveDataPath(relPath: string): string {
  const direct = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(direct)) return direct;
  const parent = path.resolve(process.cwd(), '..', relPath);
  if (fs.existsSync(parent)) return parent;
  return direct;
}

export class StaticPopulationProvider implements IPopulationProvider {
  private populationPath: string;
  private cachedMap: Map<string, PopulationEstimate> | null = null;

  constructor(customPath?: string) {
    this.populationPath =
      customPath ||
      resolveDataPath('data/reference/population/bmc_ward_population.json');
  }

  private loadData(): Map<string, PopulationEstimate> {
    if (this.cachedMap) return this.cachedMap;

    this.cachedMap = new Map();

    if (!fs.existsSync(this.populationPath)) {
      return this.cachedMap;
    }

    try {
      const raw = fs.readFileSync(this.populationPath, 'utf8');
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const wardId = String(item.ward_id || item.wardNo || item.id);
          const pop = Number(item.population || item.total_population || item.pop);
          const rawYear = item.reference_year;
          const refYear =
            typeof rawYear === 'number'
              ? rawYear
              : typeof rawYear === 'string' && !isNaN(parseInt(rawYear, 10))
              ? parseInt(rawYear, 10)
              : 2011;
          if (wardId && !isNaN(pop)) {
            this.cachedMap.set(wardId, {
              ward_id: wardId,
              population: pop,
              reference_year: refYear,
              provenance: 'ESTIMATED',
              source_notes: item.source_name || item.source || 'Census 2011 Primary Census Abstract'
            });
          }
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        for (const [key, value] of Object.entries(parsed)) {
          const pop =
            typeof value === 'number'
              ? value
              : Number((value as any)?.population || (value as any)?.total_population);
          const rawYear = (value as any)?.reference_year;
          const refYear =
            typeof rawYear === 'number'
              ? rawYear
              : typeof rawYear === 'string' && !isNaN(parseInt(rawYear, 10))
              ? parseInt(rawYear, 10)
              : 2011;
          if (!isNaN(pop)) {
            this.cachedMap.set(key, {
              ward_id: key,
              population: pop,
              reference_year: refYear,
              provenance: 'ESTIMATED',
              source_notes: (value as any)?.source_name || (value as any)?.source || 'Census 2011 Primary Census Abstract'
            });
          }
        }
      }

      return this.cachedMap;
    } catch {
      return this.cachedMap;
    }
  }

  async getWardPopulation(wardId: string): Promise<PopulationEstimate | null> {
    const map = this.loadData();
    let found = map.get(wardId);
    if (!found) {
      const cleanInput = wardId.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
      for (const [k, v] of map.entries()) {
        const cleanKey = k.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
        if (cleanInput.length > 0 && cleanInput === cleanKey) {
          found = v;
          break;
        }
      }
    }
    return found ? { ...found } : null;
  }
}
