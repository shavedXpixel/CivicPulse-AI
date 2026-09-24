import { Request, Response, NextFunction } from 'express';
import {
  GovernanceQueryInputSchema,
  DevelopmentDemandAnalyzeRequestSchema,
  DeterministicDemandMetricsSchema,
  DeterministicDemandMetrics
} from '@civicpulse/shared';
import { GovernanceService } from './governance.service';
import {
  DevelopmentDemandGovernanceService,
  clusterDemandSignals,
  calculateDemandMetrics,
  developmentDemandWorkspaceService
} from '../../services';

export class GovernanceController {
  /**
   * POST /api/v1/governance/query
   * Executes a grounded governance intelligence natural language query.
   */
  public static async query(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const validatedInput = GovernanceQueryInputSchema.parse(req.body);

      const result = await GovernanceService.executeGovernanceQuery(user, validatedInput);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/governance/brief
   * Retrieves high-level executive intelligence brief.
   */
  public static async getBrief(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const brief = await GovernanceService.getAIBrief(user);
      res.status(200).json({ data: brief });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/governance/development-demand/overview
   * Returns aggregated macro indicators of active development demands.
   */
  public static async getDevelopmentDemandOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await developmentDemandWorkspaceService.getOverview();
      res.status(200).json({ data: overview });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/governance/development-demand/clusters
   * Returns list of development demand clusters with optional filtering.
   */
  public static async listDevelopmentDemandClusters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, ward_id, priority_band } = req.query;
      const clusters = await developmentDemandWorkspaceService.getClusters({
        category: category ? String(category) : undefined,
        ward_id: ward_id ? String(ward_id) : undefined,
        priority_band: priority_band ? String(priority_band) : undefined
      });
      res.status(200).json({ data: clusters });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/governance/development-demand/clusters/:id
   * Returns full detail for a selected demand cluster.
   */
  public static async getDevelopmentDemandClusterById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cluster = await developmentDemandWorkspaceService.getClusterById(String(req.params.id));
      res.status(200).json({ data: cluster });
    } catch (err) {
      next(err);
    }
  }


  /**
   * GET /api/v1/governance/development-demand/map
   * Returns a GeoJSON FeatureCollection of 67 BMC ward boundaries and cluster centroids.
   */
  public static async getDevelopmentDemandMap(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mapData = await developmentDemandWorkspaceService.getMap();
      res.status(200).json({ data: mapData });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/governance/development-demand/indicators
   * Returns authoritative reference infrastructure indicators for a ward/category.
   */
  public static async getDevelopmentDemandIndicators(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ward_id, category } = req.query;
      const indicators = await developmentDemandWorkspaceService.getIndicators(
        ward_id ? String(ward_id) : 'WARD-018',
        category ? String(category) : undefined
      );
      res.status(200).json({ data: indicators });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/governance/development-demand/investment-context
   * Returns public investment records for a ward/category.
   */
  public static async getDevelopmentDemandInvestmentContext(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ward_id, category } = req.query;
      const investmentContext = await developmentDemandWorkspaceService.getInvestmentContext(
        ward_id ? String(ward_id) : undefined,
        category ? String(category) : undefined
      );
      res.status(200).json({ data: investmentContext });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/governance/development-demand/analyze
   * HF7.6 & HF7.7: Advisory-only interpretation of development demand cluster and metrics.
   * Server strictly calculates/validates deterministic metrics (Critical Metric Trust Rule).
   */
  public static async analyzeDevelopmentDemand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      const validated = DevelopmentDemandAnalyzeRequestSchema.parse(req.body);

      const clusterId = validated.cluster_id || (validated as any).cluster?.id;
      let cluster = (validated as any).cluster;
      let signals = (validated as any).signals || [];
      let indicators = (validated as any).indicators || [];
      let investments = (validated as any).investments || [];

      // If cluster_id matches a known scenario and components are missing, populate authoritative scenario data
      if (clusterId) {
        const scenario = developmentDemandWorkspaceService.getDemoScenario(clusterId);
        if (scenario) {
          if (!cluster) cluster = scenario.cluster;
          if (signals.length === 0) signals = scenario.signals;
          if (indicators.length === 0) indicators = scenario.indicators;
          if (investments.length === 0) investments = scenario.investments;
        }
      }

      if (!cluster && signals.length > 0) {
        const clusters = await clusterDemandSignals(signals, { includeDemo: false });
        cluster = clusters[0];
      }

      if (!cluster) {
        res.status(400).json({ error: 'No demand cluster or signals provided for analysis' });
        return;
      }

      // CRITICAL METRIC TRUST RULE:
      // Frontend-supplied metrics are never trusted blindly without backend validation.
      // - If client provides metrics, validate that they conform to DeterministicDemandMetricsSchema
      //   and that composite_demand_index strictly equals the sum of its components.
      // - If the cluster is a known scenario, client cannot spoof scores (discrepancies override with authoritative scenario metrics).
      // - If client metrics are missing, invalid, or spoofed, server computes or resolves authoritative metrics.
      let metrics: DeterministicDemandMetrics;
      const scenario = clusterId ? developmentDemandWorkspaceService.getDemoScenario(clusterId) : undefined;

      if ((validated as any).metrics) {
        const parsed = DeterministicDemandMetricsSchema.safeParse((validated as any).metrics);
        if (!parsed.success) {
          metrics = scenario ? scenario.metrics : await calculateDemandMetrics(cluster, signals, indicators, investments);
        } else {
          const sum =
            parsed.data.demand_volume_score +
            parsed.data.recurrence_score +
            parsed.data.geographic_concentration_score +
            parsed.data.population_exposure_score +
            parsed.data.infrastructure_deficit_score +
            parsed.data.investment_gap_score;
          if (parsed.data.composite_demand_index !== sum) {
            metrics = scenario ? scenario.metrics : await calculateDemandMetrics(cluster, signals, indicators, investments);
          } else if (scenario && Math.abs(parsed.data.composite_demand_index - scenario.metrics.composite_demand_index) > 5) {
            // Discard spoofed score for known scenario
            metrics = scenario.metrics;
          } else {
            metrics = parsed.data;
          }
        }
      } else if (scenario) {
        metrics = scenario.metrics;
      } else {
        metrics = await calculateDemandMetrics(cluster, signals, indicators, investments);
      }



      const isDemo = cluster.is_demo ?? Boolean((validated as any).is_demo);

      const result = await DevelopmentDemandGovernanceService.analyzeDevelopmentDemand({
        cluster,
        signals,
        indicators,
        investments,
        metrics,
        user,
        is_demo: isDemo
      });

      res.status(200).json({
        ...result,
        data: result,
        analysis: result
      });
    } catch (err) {
      next(err);
    }
  }
}
