import fs from 'fs';
import path from 'path';
import { IPublicInvestmentProvider, PublicInvestmentRecord } from '@civicpulse/shared';
import { env } from '../../config/env';

function resolveDataPath(relPath: string): string {
  const direct = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(direct)) return direct;
  const parent = path.resolve(process.cwd(), '..', relPath);
  if (fs.existsSync(parent)) return parent;
  return direct;
}

export interface StaticPublicInvestmentOptions {
  isDemo?: boolean;
}

/**
 * REAL_MODE Public Investment Context Provider.
 *
 * Strict Production Invariant:
 * Zero fabricated government projects, budgets, or schemes.
 * Backed by verified official BMC and BSCL public disclosures:
 * - data/reference/investment/bhubaneswar_public_investments.json
 *
 * Returns verified official project records only, with explicit source URLs and provenance.
 */
export class StaticPublicInvestmentProvider implements IPublicInvestmentProvider {
  private records: PublicInvestmentRecord[] = [];
  private isDemo: boolean;

  constructor(
    customRecords?: PublicInvestmentRecord[],
    customPath?: string,
    options?: StaticPublicInvestmentOptions
  ) {
    this.isDemo = options?.isDemo ?? env.DEMO_MODE;

    if (customRecords) {
      this.records = [...customRecords];
    } else {
      const targetPath =
        customPath ||
        resolveDataPath('data/reference/investment/bhubaneswar_public_investments.json');

      if (fs.existsSync(targetPath)) {
        try {
          const raw = fs.readFileSync(targetPath, 'utf8');
          const parsed = JSON.parse(raw);
          this.records = Array.isArray(parsed) ? parsed : [];
        } catch {
          this.records = [];
        }
      } else {
        this.records = [];
      }
    }
  }

  async getAllInvestments(): Promise<PublicInvestmentRecord[]> {
    return this.records.filter((rec) => {
      if (!this.isDemo && (rec.is_demo || rec.provenance?.is_demo)) {
        return false;
      }
      return true;
    });
  }

  async getInvestmentsByWard(wardId: string): Promise<PublicInvestmentRecord[]> {
    if (!wardId || this.records.length === 0) {
      return [];
    }

    const cleanInput = wardId.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();

    return this.records.filter((rec) => {
      // In REAL_MODE, strictly exclude demo records
      if (!this.isDemo && (rec.is_demo || rec.provenance?.is_demo)) {
        return false;
      }

      return rec.ward_ids.some((w) => {
        if (w === wardId) return true;
        const cleanW = w.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
        return cleanInput.length > 0 && cleanInput === cleanW;
      });
    });
  }

  async getInvestmentsByCategory(category: string): Promise<PublicInvestmentRecord[]> {
    if (!category || this.records.length === 0) {
      return [];
    }

    const catLower = category.toLowerCase().trim();

    return this.records.filter((rec) => {
      // In REAL_MODE, strictly exclude demo records
      if (!this.isDemo && (rec.is_demo || rec.provenance?.is_demo)) {
        return false;
      }

      return rec.category.toLowerCase().trim() === catLower;
    });
  }
}
