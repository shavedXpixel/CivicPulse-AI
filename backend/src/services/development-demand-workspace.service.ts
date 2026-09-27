/**
 * CivicPulse Development Demand Intelligence — Workspace & Map Service
 * 
 * Phase: 15B.5.3.20-HF7.7
 * 
 * Capabilities:
 * - Powers read endpoints for the Governance Development Demand Workspace:
 *   * GET /overview
 *   * GET /clusters
 *   * GET /clusters/:id
 *   * GET /map (FeatureCollection with ward polygons and cluster centroids)
 *   * GET /indicators
 *   * GET /investment-context
 * - Strict Invariant Protection:
 *   * REAL_MODE: Returns actual database records only. If no persistent development
 *     demand records exist yet, returns honest empty states without synthetic fallback.
 *   * DEMO_MODE: Serves deterministic synthetic municipal scenarios with explicit `is_demo: true`.
 *   * Zero citizen PII, zero officer UUIDs, zero household GPS points.
 */

import fs from 'fs';
import path from 'path';
import {
  DevelopmentDemandOverviewResponse,
  DevelopmentDemandClustersResponse,
  DevelopmentDemandClusterDetailResponse,
  DevelopmentDemandMapResponse,
  DevelopmentDemandMapFeature,
  DevelopmentDemandIndicatorsResponse,
  DevelopmentDemandInvestmentContextResponse,
  DemandCluster,
  DemandPriorityBand,
  NormalizedDemandSignal,
  AppError,
  ERROR_CODES
} from '@civicpulse/shared';
import { DEMO_DEVELOPMENT_DEMAND_SCENARIOS, DemoDemandScenario } from '../providers/reference/demo-development-demand.data';
import { getDatabaseProvider, getDevelopmentIndicatorProvider, getPublicInvestmentProvider } from '../providers';
import { env } from '../config/env';

function resolveDataPath(relPath: string): string {
  const direct = path.resolve(process.cwd(), relPath);
  if (fs.existsSync(direct)) return direct;
  const parent = path.resolve(process.cwd(), '..', relPath);
  if (fs.existsSync(parent)) return parent;
  return direct;
}

export interface ClusterFilterOptions {
  category?: string;
  ward_id?: string;
  priority_band?: string;
}

export class DevelopmentDemandWorkspaceService {
  private geojsonPath: string;
  private cachedWardGeoJSON: any = null;

  constructor(customGeojsonPath?: string) {
    this.geojsonPath = customGeojsonPath || resolveDataPath('data/reference/geography/bmc_wards.geojson');
  }

  /**
   * Loads the BMC 67 Ward Boundaries GeoJSON.
   */
  private loadWardGeoJSON(): any {
    if (this.cachedWardGeoJSON) return this.cachedWardGeoJSON;
    if (fs.existsSync(this.geojsonPath)) {
      try {
        const raw = fs.readFileSync(this.geojsonPath, 'utf8');
        this.cachedWardGeoJSON = JSON.parse(raw);
        return this.cachedWardGeoJSON;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * GET /overview
   * Returns aggregated macro indicators of active development demands.
   */
  async getOverview(isDemo: boolean = env.DEMO_MODE): Promise<DevelopmentDemandOverviewResponse> {
    const executedAt = new Date().toISOString();

    if (!isDemo) {
      const db = getDatabaseProvider();
      const clusters = db.listDemandClusters ? await db.listDemandClusters({ is_demo: false }) : [];
      const signals = db.listDemandSignals ? await db.listDemandSignals({ is_demo: false }) : [];

      if (clusters.length === 0 && signals.length === 0) {
        return {
          total_active_demands: 0,
          total_demand_signals: 0,
          top_sectors: [],
          ward_demand_summary: [],
          is_demo: false,
          generated_at: executedAt
        };
      }

      const sectorMap = new Map<string, { count: number; sumIndex: number }>();
      for (const cl of clusters) {
        const existing = sectorMap.get(cl.category) || { count: 0, sumIndex: 0 };
        existing.count += cl.signal_count;
        existing.sumIndex += cl.composite_demand_index || 0;
        sectorMap.set(cl.category, existing);
      }

      const topSectors = Array.from(sectorMap.entries())
        .map(([cat, val]) => ({
          category: cat,
          count: val.count,
          composite_index_avg: Math.round(
            val.sumIndex / (clusters.filter((c) => c.category === cat).length || 1)
          )
        }))
        .sort((a, b) => b.count - a.count);

      const wardMap = new Map<string, { count: number; top_category: string }>();
      for (const cl of clusters) {
        for (const w of cl.ward_ids) {
          const existing = wardMap.get(w) || { count: 0, top_category: cl.category };
          existing.count += cl.signal_count;
          wardMap.set(w, existing);
        }
      }

      const wardSummary = Array.from(wardMap.entries()).map(([w, val]) => ({
        ward_id: w,
        demand_count: val.count,
        top_category: val.top_category
      }));

      return {
        total_active_demands: clusters.length,
        total_demand_signals: signals.length,
        top_sectors: topSectors,
        ward_demand_summary: wardSummary,
        is_demo: false,
        generated_at: executedAt
      };
    }

    // DEMO_MODE: Grounded in deterministic synthetic scenarios
    const scenarios = DEMO_DEVELOPMENT_DEMAND_SCENARIOS;
    const totalSignals = scenarios.reduce((sum, s) => sum + s.signals.length, 0);

    const sectorMap = new Map<string, { count: number; sumIndex: number }>();
    for (const sc of scenarios) {
      const existing = sectorMap.get(sc.cluster.category) || { count: 0, sumIndex: 0 };
      existing.count += sc.signals.length;
      existing.sumIndex += sc.metrics.composite_demand_index;
      sectorMap.set(sc.cluster.category, existing);
    }

    const topSectors = Array.from(sectorMap.entries()).map(([cat, val]) => ({
      category: cat,
      count: val.count,
      composite_index_avg: Math.round(val.sumIndex / (val.count > 0 ? 1 : 1))
    })).sort((a, b) => b.count - a.count);

    const wardMap = new Map<string, { count: number; top_category: string }>();
    for (const sc of scenarios) {
      for (const w of sc.cluster.ward_ids) {
        const existing = wardMap.get(w) || { count: 0, top_category: sc.cluster.category };
        existing.count += sc.cluster.signal_count;
        wardMap.set(w, existing);
      }
    }

    const wardSummary = Array.from(wardMap.entries()).map(([w, val]) => ({
      ward_id: w,
      demand_count: val.count,
      top_category: val.top_category
    }));

    return {
      total_active_demands: scenarios.length,
      total_demand_signals: totalSignals,
      top_sectors: topSectors,
      ward_demand_summary: wardSummary,
      is_demo: true,
      generated_at: executedAt
    };
  }

  /**
   * GET /clusters
   * Returns list of development demand clusters with optional filtering.
   */
  async getClusters(
    filters?: ClusterFilterOptions,
    isDemo: boolean = env.DEMO_MODE
  ): Promise<DevelopmentDemandClustersResponse> {
    if (!isDemo) {
      const db = getDatabaseProvider();
      const clusters = db.listDemandClusters
        ? await db.listDemandClusters({
            is_demo: false,
            category: filters?.category,
            ward_id: filters?.ward_id,
            priority_band: filters?.priority_band
          })
        : [];

      return {
        clusters,
        total_count: clusters.length,
        is_demo: false
      };
    }

    let scenarios = DEMO_DEVELOPMENT_DEMAND_SCENARIOS;

    if (filters?.category) {
      scenarios = scenarios.filter((s) => s.cluster.category === filters.category);
    }

    if (filters?.ward_id) {
      scenarios = scenarios.filter((s) => s.cluster.ward_ids.includes(filters.ward_id!));
    }

    if (filters?.priority_band) {
      scenarios = scenarios.filter((s) => s.opportunity.priority_band === filters.priority_band);
    }

    const clusters: DemandCluster[] = scenarios.map((s) => ({
      ...s.cluster,
      is_demo: true
    }));

    return {
      clusters,
      total_count: clusters.length,
      is_demo: true
    };
  }

  /**
   * GET /clusters/:id
   * Returns full detail for a selected demand cluster.
   */
  async getClusterById(
    clusterId: string,
    isDemo: boolean = env.DEMO_MODE
  ): Promise<DevelopmentDemandClusterDetailResponse> {
    if (!isDemo) {
      const db = getDatabaseProvider();
      const cluster = db.getDemandCluster ? await db.getDemandCluster(clusterId) : null;
      if (!cluster || cluster.is_demo) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: `Demand cluster '${clusterId}' was not found in real records.`
        });
      }

      const memberRefs = db.getDemandClusterMembers ? await db.getDemandClusterMembers(clusterId) : [];
      const signals: NormalizedDemandSignal[] = [];
      for (const m of memberRefs) {
        if (db.getDemandSignal) {
          const sig = await db.getDemandSignal(m.signal_id);
          if (sig) {
            signals.push(sig);
          }
        }
      }

      return {
        cluster,
        signals,
        opportunities: [],
        is_demo: false
      };
    }

    const scenario = DEMO_DEVELOPMENT_DEMAND_SCENARIOS.find(
      (s) => s.cluster.id === clusterId || s.opportunity.id === clusterId
    );

    if (!scenario) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Demand cluster '${clusterId}' not found.`
      });
    }

    return {
      cluster: scenario.cluster,
      signals: scenario.signals,
      opportunities: [scenario.opportunity],
      is_demo: true
    };
  }

  /**
   * GET /map
   * Returns a GeoJSON FeatureCollection of 67 BMC ward boundaries with demand heat
   * and cluster centroid markers. Zero residential GPS or citizen locations.
   */
  async getMap(isDemo: boolean = env.DEMO_MODE): Promise<DevelopmentDemandMapResponse> {
    const executedAt = new Date().toISOString();
    const features: DevelopmentDemandMapFeature[] = [];

    // 1. Load Ward Boundaries
    const wardGeoJSON = this.loadWardGeoJSON();
    const wardFeatures = wardGeoJSON?.features || [];

    // Map demand intensity per ward
    const wardIntensityMap = new Map<string, { intensity: number; category?: string; count: number }>();
    let realClusters: DemandCluster[] = [];

    if (isDemo) {
      for (const sc of DEMO_DEVELOPMENT_DEMAND_SCENARIOS) {
        for (const w of sc.cluster.ward_ids) {
          const cleanW = w.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
          wardIntensityMap.set(cleanW, {
            intensity: sc.metrics.composite_demand_index,
            category: sc.cluster.category,
            count: sc.cluster.signal_count
          });
        }
      }
    } else {
      const db = getDatabaseProvider();
      realClusters = db.listDemandClusters ? await db.listDemandClusters({ is_demo: false }) : [];
      for (const cl of realClusters) {
        for (const w of cl.ward_ids) {
          const cleanW = w.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
          wardIntensityMap.set(cleanW, {
            intensity: cl.composite_demand_index || 0,
            category: cl.category,
            count: cl.signal_count
          });
        }
      }
    }

    for (const feat of wardFeatures) {
      const props = feat.properties || {};
      const rawWard = props.ward_id || props.ward_no || props.wardNo || props.Ward_No || '';
      const cleanW = String(rawWard).replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
      const paddedWard = `WARD-${cleanW.padStart(3, '0')}`;

      const heat = wardIntensityMap.get(cleanW);

      features.push({
        type: 'Feature',
        geometry: feat.geometry,
        properties: {
          entity_id: `ward_boundary_${paddedWard}`,
          entity_type: 'WARD_HEAT',
          category: heat?.category,
          demand_intensity: heat?.intensity || 0,
          ward_id: paddedWard,
          signal_count: heat?.count || 0,
          is_demo: isDemo
        }
      });
    }

    // 2. Add Cluster Centroid Features (Aggregated Centroids Only)
    if (isDemo) {
      for (const sc of DEMO_DEVELOPMENT_DEMAND_SCENARIOS) {
        if (!sc.cluster.centroid) continue;
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [sc.cluster.centroid.lng, sc.cluster.centroid.lat]
          },
          properties: {
            entity_id: sc.cluster.id,
            entity_type: 'DEMAND_CLUSTER',
            category: sc.cluster.category,
            demand_intensity: sc.metrics.composite_demand_index,
            ward_id: sc.cluster.ward_ids[0] || 'WARD-001',
            signal_count: sc.cluster.signal_count,
            is_demo: true
          }
        });
      }
    } else {
      for (const cl of realClusters) {
        if (!cl.centroid) continue;
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [cl.centroid.lng, cl.centroid.lat]
          },
          properties: {
            entity_id: cl.id,
            entity_type: 'DEMAND_CLUSTER',
            category: cl.category,
            demand_intensity: cl.composite_demand_index || 0,
            ward_id: cl.ward_ids[0] || 'WARD-001',
            signal_count: cl.signal_count,
            is_demo: false
          }
        });
      }
    }

    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        total_features: features.length,
        is_demo: isDemo,
        generated_at: executedAt
      }
    };
  }

  /**
   * GET /indicators
   * Returns authoritative reference infrastructure indicators for a ward/category.
   */
  async getIndicators(
    wardId: string = 'WARD-018',
    category?: string,
    isDemo: boolean = env.DEMO_MODE
  ): Promise<DevelopmentDemandIndicatorsResponse> {
    if (isDemo) {
      const scenario = DEMO_DEVELOPMENT_DEMAND_SCENARIOS.find(
        (s) => s.cluster.ward_ids.includes(wardId) && (!category || s.cluster.category === category)
      );

      if (scenario) {
        return {
          ward_id: wardId,
          indicators: scenario.indicators,
          is_demo: true
        };
      }
    }

    const provider = getDevelopmentIndicatorProvider();
    const indicators = await provider.getWardIndicators(wardId);

    const filtered = category
      ? indicators.filter((i: any) => i.sector === category || i.indicator_type === category || i.name?.toLowerCase().includes(category.toLowerCase()))
      : indicators;

    return {
      ward_id: wardId,
      indicators: filtered,
      is_demo: isDemo
    };
  }


  /**
   * GET /investment-context
   * Returns public investment records for a ward/category.
   */
  async getInvestmentContext(
    wardId?: string,
    category?: string,
    isDemo: boolean = env.DEMO_MODE
  ): Promise<DevelopmentDemandInvestmentContextResponse> {
    if (isDemo) {
      let scenarios = DEMO_DEVELOPMENT_DEMAND_SCENARIOS;

      if (wardId) {
        scenarios = scenarios.filter((s) => s.cluster.ward_ids.includes(wardId));
      }
      if (category) {
        scenarios = scenarios.filter((s) => s.cluster.category === category);
      }

      const investments = scenarios.flatMap((s) => s.investments);
      const totalBudget = investments.reduce((sum, inv) => sum + (inv.documented_budget || 0), 0);

      return {
        investments,
        total_budget: totalBudget,
        is_demo: true
      };
    }

    const provider = getPublicInvestmentProvider();
    const records = wardId
      ? await provider.getInvestmentsByWard(wardId)
      : (category
          ? await provider.getInvestmentsByCategory(category)
          : (provider.getAllInvestments ? await provider.getAllInvestments() : []));

    const totalBudget = records.reduce((sum, inv) => sum + (inv.documented_budget || 0), 0);

    return {
      investments: records,
      total_budget: totalBudget,
      is_demo: false
    };
  }

  /**
   * Helper to retrieve full demo scenario for a given cluster ID.
   */
  getDemoScenario(clusterId: string): DemoDemandScenario | undefined {
    return DEMO_DEVELOPMENT_DEMAND_SCENARIOS.find(
      (s) => s.cluster.id === clusterId || s.opportunity.id === clusterId
    );
  }
}

export const developmentDemandWorkspaceService = new DevelopmentDemandWorkspaceService();
