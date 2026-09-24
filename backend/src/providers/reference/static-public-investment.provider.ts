import fs from 'fs';
import { IPublicInvestmentProvider, PublicInvestmentRecord } from '@civicpulse/shared';
import { env } from '../../config/env';

export interface StaticPublicInvestmentOptions {
  isDemo?: boolean;
}

/**
 * REAL_MODE Public Investment Context Provider.
 *
 * Strict Production Invariant:
 * Zero fabricated government projects, budgets, or schemes.
 * Until verified public investment datasets exist in the project,
 * returns an explicit empty dataset rather than synthetic project records.
 *
 * Designed to cleanly load verified records from data or tests without interface changes.
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
    } else if (customPath && fs.existsSync(customPath)) {
      try {
        const raw = fs.readFileSync(customPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.records = Array.isArray(parsed) ? parsed : [];
      } catch {
        this.records = [];
      }
    } else {
      // Authoritative production behavior:
      // No verified investment project dataset exists in the repository currently.
      // Explicit empty dataset returned.
      this.records = [];
    }
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
