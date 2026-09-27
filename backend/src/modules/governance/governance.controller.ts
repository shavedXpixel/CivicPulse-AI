import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import {
  GovernanceQueryInputSchema,
  DevelopmentDemandAnalyzeRequestSchema,
  DeterministicDemandMetricsSchema,
  DeterministicDemandMetrics,
  DemandSignal,
  DemandCluster,
  DemandSignalSourceChannel,
  AppError,
  ERROR_CODES
} from '@civicpulse/shared';
import { GovernanceService } from './governance.service';
import {
  DevelopmentDemandGovernanceService,
  DevelopmentDemandNormalizationService,
  developmentDemandClusteringService,
  clusterDemandSignals,
  calculateDemandMetrics,
  calculateDemandMetricsWithDetails,
  developmentDemandWorkspaceService
} from '../../services';
import {
  getAIProvider,
  getDatabaseProvider,
  getDevelopmentIndicatorProvider,
  getPublicInvestmentProvider
} from '../../providers';
import { env } from '../../config/env';

function enforceRealModeBoundary(req: Request): boolean {
  if (!env.DEMO_MODE) {
    const queryDemo = String(req.query.demo ?? req.query.is_demo ?? '').toLowerCase();
    const headerDemo = String(req.headers['x-demo-mode'] ?? '').toLowerCase();
    const bodyDemo = String(req.body?.is_demo ?? req.body?.demo ?? '').toLowerCase();
    if (queryDemo === 'true' || headerDemo === 'true' || bodyDemo === 'true') {
      throw new AppError({
        statusCode: 400,
        code: 'DEMO_MODE_OVERRIDE_PROHIBITED',
        message:
          'Demo mode overrides are strictly prohibited on production endpoints. Hosted CivicPulse operates exclusively in REAL_MODE.'
      });
    }
    return false;
  }
  const demoParam = req.query.demo ?? req.query.is_demo;
  if (demoParam !== undefined) {
    return String(demoParam).toLowerCase() === 'true';
  }
  return true;
}

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
      const isDemo = enforceRealModeBoundary(req);
      const overview = await developmentDemandWorkspaceService.getOverview(isDemo);
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
      const isDemo = enforceRealModeBoundary(req);
      const { category, ward_id, priority_band } = req.query;
      const clusters = await developmentDemandWorkspaceService.getClusters(
        {
          category: category ? String(category) : undefined,
          ward_id: ward_id ? String(ward_id) : undefined,
          priority_band: priority_band ? String(priority_band) : undefined
        },
        isDemo
      );
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
      const isDemo = enforceRealModeBoundary(req);
      const cluster = await developmentDemandWorkspaceService.getClusterById(String(req.params.id), isDemo);
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
      const isDemo = enforceRealModeBoundary(req);
      const mapData = await developmentDemandWorkspaceService.getMap(isDemo);
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
      const isDemo = enforceRealModeBoundary(req);
      const { ward_id, category } = req.query;
      const indicators = await developmentDemandWorkspaceService.getIndicators(
        ward_id ? String(ward_id) : 'WARD-018',
        category ? String(category) : undefined,
        isDemo
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
      const isDemo = enforceRealModeBoundary(req);
      const { ward_id, category } = req.query;
      const investmentContext = await developmentDemandWorkspaceService.getInvestmentContext(
        ward_id ? String(ward_id) : undefined,
        category ? String(category) : undefined,
        isDemo
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
      const isDemo = enforceRealModeBoundary(req);
      const validated = DevelopmentDemandAnalyzeRequestSchema.parse(req.body);

      const clusterId = validated.cluster_id || (validated as any).cluster?.id;
      let cluster = (validated as any).cluster;
      let signals = (validated as any).signals || [];
      let indicators = (validated as any).indicators || [];
      let investments = (validated as any).investments || [];

      const db = getDatabaseProvider();

      // In REAL_MODE, resolve real cluster from database if clusterId is provided
      if (!isDemo && clusterId) {
        if (db.getDemandCluster) {
          const dbCluster = await db.getDemandCluster(clusterId);
          if (dbCluster && !dbCluster.is_demo) {
            if (!cluster) cluster = dbCluster;
            if (signals.length === 0 && db.getDemandClusterMembers && db.getDemandSignal) {
              const members = await db.getDemandClusterMembers(clusterId);
              for (const m of members) {
                const s = await db.getDemandSignal(m.signal_id);
                if (s) signals.push(s);
              }
            }
            if (indicators.length === 0 && cluster.ward_ids && cluster.ward_ids[0]) {
              indicators = await getDevelopmentIndicatorProvider().getWardIndicators(cluster.ward_ids[0]);
            }
            if (investments.length === 0 && cluster.ward_ids && cluster.ward_ids[0]) {
              investments = await getPublicInvestmentProvider().getInvestmentsByWard(cluster.ward_ids[0]);
            }
          }
        }
      } else if (isDemo && clusterId) {
        // DEMO_MODE: populate authoritative scenario data
        const scenario = developmentDemandWorkspaceService.getDemoScenario(clusterId);
        if (scenario) {
          if (!cluster) cluster = scenario.cluster;
          if (signals.length === 0) signals = scenario.signals;
          if (indicators.length === 0) indicators = scenario.indicators;
          if (investments.length === 0) investments = scenario.investments;
        }
      }

      if (!cluster && signals.length > 0) {
        const clusters = await clusterDemandSignals(signals, { includeDemo: isDemo });
        cluster = clusters[0];
      }

      if (!cluster) {
        res.status(400).json({ error: 'No demand cluster or signals provided for analysis' });
        return;
      }

      if (!isDemo && cluster.is_demo) {
        throw new AppError({
          statusCode: 400,
          code: 'REAL_MODE_VIOLATION',
          message: 'Demo clusters cannot be analyzed in REAL_MODE.'
        });
      }

      // CRITICAL METRIC TRUST RULE:
      // Frontend-supplied metrics are never trusted blindly without backend validation.
      let metrics: DeterministicDemandMetrics;
      const scenario = isDemo && clusterId ? developmentDemandWorkspaceService.getDemoScenario(clusterId) : undefined;

      if ((validated as any).metrics) {
        const parsed = DeterministicDemandMetricsSchema.safeParse((validated as any).metrics);
        if (!parsed.success) {
          metrics = scenario ? scenario.metrics : await calculateDemandMetrics(cluster, signals, indicators, investments, { isDemo });
        } else {
          const sum =
            parsed.data.demand_volume_score +
            parsed.data.recurrence_score +
            parsed.data.geographic_concentration_score +
            parsed.data.population_exposure_score +
            parsed.data.infrastructure_deficit_score +
            parsed.data.investment_gap_score;
          if (parsed.data.composite_demand_index !== sum) {
            metrics = scenario ? scenario.metrics : await calculateDemandMetrics(cluster, signals, indicators, investments, { isDemo });
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
        metrics = await calculateDemandMetrics(cluster, signals, indicators, investments, { isDemo });
      }

      const result = await DevelopmentDemandGovernanceService.analyzeDevelopmentDemand({
        cluster,
        signals,
        indicators,
        investments,
        metrics,
        user,
        is_demo: isDemo
      });

      // Persist analysis audit run in demand_analysis_runs if persistence available
      if (db.recordDemandAnalysisRun && cluster?.id) {
        try {
          await db.recordDemandAnalysisRun({
            id: `dar_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
            cluster_id: cluster.id,
            executed_at: new Date().toISOString(),
            model_name: env.GEMINI_PRIMARY_MODEL || 'gemini-3.6-flash',
            prompt_version: 'v1.0.0',
            analysis_response: result,
            is_demo: isDemo
          });
        } catch (err: any) {
          console.warn('[GovernanceController] Failed to record demand analysis run audit:', err.message);
        }
      }

      res.status(200).json({
        ...result,
        data: result,
        analysis: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/governance/development-demand/intake
   * Authenticated citizen development demand intake pipeline.
   *
   * Real Data Pipeline (PHASE 15B.5.3.21):
   * Citizen raw text
   *     ↓
   * PII sanitization (phone, email, residential identifiers)
   *     ↓
   * Gemini normalization (canonical English, category, urgency)
   *     ↓
   * 1536-dimensional embedding via IAIProvider
   *     ↓
   * Persistent storage in demand_signals (is_demo=false)
   *     ↓
   * Real clustering via developmentDemandClusteringService (HF7.3)
   *     ↓
   * Contextual indicators & official public investments
   *     ↓
   * Deterministic metrics calculation (HF7.5)
   *     ↓
   * Persist clusters & memberships in demand_clusters & demand_cluster_members
   */
  public static async submitDevelopmentDemand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Authentication required to submit development demand.'
        });
      }

      const isDemo = enforceRealModeBoundary(req);

      const { text, demand_text, ward_id, locality_name, original_language, source_channel } = req.body;
      const rawText = (text || demand_text || '').trim();

      if (!rawText || rawText.length < 10) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_INPUT',
          message: 'Demand text is required and must be at least 10 characters long.'
        });
      }

      if (!ward_id || typeof ward_id !== 'string') {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_INPUT',
          message: 'ward_id is required (e.g. WARD-018).'
        });
      }

      // Format ward_id cleanly (e.g. WARD-018)
      const cleanWardNo = ward_id.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
      const normalizedWardId = cleanWardNo ? `WARD-${cleanWardNo.padStart(3, '0')}` : ward_id;

      // 1. Multilingual Normalization + Deterministic PII Sanitization (HF7.2)
      const normalizationService = new DevelopmentDemandNormalizationService();
      const normalized = await normalizationService.normalizeDemandSignal({
        raw_text: rawText,
        ward_id: normalizedWardId,
        locality_name: locality_name ? String(locality_name).trim() : undefined,
        is_demo: isDemo
      });

      // 2. Generate 1536-dimensional embedding via Gemini/AI Provider
      const aiProvider = getAIProvider();
      const textToEmbed = normalized.normalized_text || rawText;
      const embedding = await aiProvider.generateEmbedding(textToEmbed);

      // 3. Construct canonical DemandSignal
      const signalId = `ds_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      const demandSignal: DemandSignal = {
        id: signalId,
        citizen_id: user.id, // Internal association only; strictly omitted from Governance DTOs
        source_channel: source_channel || DemandSignalSourceChannel.WEB_FORM,
        original_language: original_language || normalized.original_language || 'en',
        original_text: rawText,
        normalized_language: 'en',
        normalized_text: normalized.normalized_text,
        normalization_confidence: normalized.normalization_confidence,
        detected_category: normalized.detected_category,
        detected_urgency: normalized.detected_urgency,
        ward_id: normalized.ward_id,
        locality_name: normalized.locality_name,
        embedding,
        is_demo: false,
        submitted_at: new Date().toISOString(),
        ingested_at: new Date().toISOString()
      };

      // 4. Persist in database
      const db = getDatabaseProvider();
      if (db.createDemandSignal) {
        await db.createDemandSignal(demandSignal);
      }

      // 5. Run clustering engine against all persisted real signals
      const allRealSignals = db.listDemandSignals
        ? await db.listDemandSignals({ is_demo: false })
        : [demandSignal];

      if (!allRealSignals.some((s) => s.id === demandSignal.id)) {
        allRealSignals.push(demandSignal);
      }

      const clusteringResult = await developmentDemandClusteringService.clusterDemandSignalsWithDetails(allRealSignals, {
        includeDemo: false
      });

      let assignedCluster: DemandCluster | null = null;
      let calculatedMetrics: any = null;

      // 6. Persist formed clusters, memberships, and compute deterministic metrics (HF7.5)
      for (const cluster of clusteringResult.clusters) {
        const clusterMembers = clusteringResult.memberships.filter((m: any) => m.cluster_id === cluster.id);
        const clusterSignals = allRealSignals.filter((s) => clusterMembers.some((m: any) => m.signal_id === s.id));

        const clusterWard = cluster.ward_ids[0] || normalizedWardId;
        const indicators = await getDevelopmentIndicatorProvider().getWardIndicators(clusterWard);
        const investments = await getPublicInvestmentProvider().getInvestmentsByWard(clusterWard);

        const metricsWithDetails = await calculateDemandMetricsWithDetails(
          cluster,
          clusterSignals,
          indicators,
          investments,
          { isDemo: false }
        );

        cluster.composite_demand_index = metricsWithDetails.metrics.composite_demand_index;
        cluster.priority_band = metricsWithDetails.priority_band;
        cluster.metrics = metricsWithDetails.metrics;
        cluster.is_demo = false;

        if (db.createDemandCluster && db.updateDemandCluster) {
          const existing = db.getDemandCluster ? await db.getDemandCluster(cluster.id) : null;
          if (existing) {
            await db.updateDemandCluster(cluster.id, cluster);
          } else {
            await db.createDemandCluster(cluster);
          }
        }

        if (db.addDemandClusterMember) {
          for (const m of clusterMembers) {
            await db.addDemandClusterMember(cluster.id, m.signal_id, 1.0 - m.distance_to_cluster);
          }
        }

        if (clusterMembers.some((m: any) => m.signal_id === demandSignal.id)) {
          assignedCluster = cluster;
          calculatedMetrics = metricsWithDetails.metrics;
          demandSignal.demand_cluster_id = cluster.id;
          if (db.updateDemandSignal) {
            await db.updateDemandSignal(demandSignal.id, { demand_cluster_id: cluster.id });
          }
        }
      }

      // Return sanitized DTO with privacy protection (omitting user IDs, embeddings, and household coordinates)
      const { citizen_id: _cid, embedding: _emb, ...sanitizedSignal } = demandSignal as any;

      res.status(201).json({
        status: 'success',
        data: {
          signal: sanitizedSignal,
          cluster: assignedCluster,
          metrics: calculatedMetrics,
          is_demo: false,
          provenance: {
            source: 'CIVICPULSE_CITIZEN_INTAKE',
            normalization_confidence: normalized.normalization_confidence,
            is_demo: false
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
