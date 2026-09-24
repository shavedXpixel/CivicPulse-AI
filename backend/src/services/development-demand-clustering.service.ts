/**
 * CivicPulse Development Demand Intelligence — Demand Clustering Service
 * 
 * Phase: 15B.5.3.20-HF7.3
 * 
 * Capabilities:
 * - Semantic + Geographic + Temporal + Category clustering of NormalizedDemandSignal
 * - Canonical distance formula:
 *     distance = 0.45 * semantic_distance
 *              + 0.30 * geographic_distance
 *              + 0.15 * temporal_distance
 *              + 0.10 * category_mismatch
 * - Cluster threshold: 0.28
 * - Temporal rolling window: 180 days (signals outside window do not form one cluster)
 * - 1536-dimensional Gemini embedding via existing IAIProvider
 * - Ward-aware coarse geographic distance via StaticGeographyProvider (67 Bhubaneswar wards)
 * - Zero exact residential coordinates required or exposed
 * - REAL_MODE / DEMO_MODE isolation: demo signals excluded in REAL_MODE
 * - Deterministic / stable cluster identification and membership
 * - Fail-closed on missing/malformed embeddings
 */

import crypto from 'crypto';
import {
  DemandCluster,
  DemandClusterSchema,
  NormalizedDemandSignal,
  DemandSignal,
  DEVELOPMENT_DEMAND_TAXONOMY,
  DevelopmentDemandSector,
  AppError
} from '@civicpulse/shared';
import { cosineSimilarity, haversineDistanceKm } from '../modules/clustering/similarity.math';
import { getAIProvider, getGeographyProvider } from '../providers';
import { IAIProvider } from '../providers/ai/ai.interface';
import { IGeographyProvider } from '../providers/reference/reference.interface';
import { StaticGeographyProvider } from '../providers/reference/static-geography.provider';
import { env } from '../config/env';

// ============================================================================
// CANONICAL CLUSTERING CONSTANTS & WEIGHTS (HF7.3)
// ============================================================================

export const CLUSTERING_ALGORITHM_VERSION = 'development_demand_clustering_v1';
export const CLUSTER_DISTANCE_THRESHOLD = 0.28;
export const TEMPORAL_ROLLING_WINDOW_DAYS = 180;
export const TEMPORAL_ROLLING_WINDOW_MS = TEMPORAL_ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000; // 15,552,000,000 ms
export const EMBEDDING_DIMENSIONALITY = 1536;
export const EMBEDDING_MODEL_NAME = 'gemini-embedding-001';
export const MAX_BHUBANESWAR_DISTANCE_KM = 25.0;

export const CLUSTERING_WEIGHTS = {
  SEMANTIC: 0.45,
  GEOGRAPHIC: 0.30,
  TEMPORAL: 0.15,
  CATEGORY: 0.10
} as const;

// ============================================================================
// CONTRACTS & DTOs
// ============================================================================

export interface DistanceComponents {
  semantic_distance: number;
  geographic_distance: number;
  temporal_distance: number;
  category_mismatch: number;
}

export interface PairwiseDistanceResult {
  distance: number;
  isEligible: boolean;
  components: DistanceComponents;
}

export interface DemandClusterMemberInfo {
  signal_id: string;
  cluster_id: string;
  distance_to_cluster: number;
  components: DistanceComponents;
}

export interface DemandClusteringMetadata {
  algorithm_version: string;
  weights: typeof CLUSTERING_WEIGHTS;
  threshold: number;
  temporal_window_days: number;
  embedding_model: string;
  embedding_dimensions: number;
  total_signals_input: number;
  signals_clustered: number;
  clusters_formed: number;
  executed_at: string;
}

export interface DemandClusteringResult {
  clusters: DemandCluster[];
  memberships: DemandClusterMemberInfo[];
  metadata: DemandClusteringMetadata;
}

export interface DemandClusteringOptions {
  includeDemo?: boolean;
  failOnEmbeddingError?: boolean;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

export class DevelopmentDemandClusteringService {
  private aiProvider: IAIProvider;
  private geoProvider: IGeographyProvider;
  private wardCentroidsCache: Map<string, { lat: number; lng: number }> | null = null;

  constructor(
    aiProvider?: IAIProvider,
    geoProvider?: IGeographyProvider,
    customWardCentroids?: Map<string, { lat: number; lng: number }>
  ) {
    this.aiProvider = aiProvider ?? getAIProvider();
    this.geoProvider = geoProvider ?? getGeographyProvider();
    if (customWardCentroids) {
      this.wardCentroidsCache = customWardCentroids;
    }
  }

  /**
   * Loads and caches coarse ward centroids (from StaticGeographyProvider or GeoJSON).
   * Zero residential point data is ever loaded or computed.
   */
  public async getWardCentroids(): Promise<Map<string, { lat: number; lng: number }>> {
    if (this.wardCentroidsCache !== null) {
      return this.wardCentroidsCache;
    }

    const centroids = new Map<string, { lat: number; lng: number }>();

    try {
      const wards = await this.geoProvider.listWards();
      for (const w of wards) {
        if (w.centroid) {
          centroids.set(w.ward_id, w.centroid);
          // Also set by numeric suffix for resilient matching (e.g. "WARD-019" and "19")
          const cleanNum = w.ward_id.replace(/^WARD-0*/i, '').replace(/^W0*/i, '').trim();
          if (cleanNum) {
            centroids.set(`WARD-${cleanNum.padStart(3, '0')}`, w.centroid);
          }
        }
      }
    } catch {
      // Graceful fallback to static geography provider if interface differs
      const staticGeo = new StaticGeographyProvider();
      const wards = await staticGeo.listWards();
      for (const w of wards) {
        if (w.centroid) {
          centroids.set(w.ward_id, w.centroid);
        }
      }
    }

    this.wardCentroidsCache = centroids;
    return centroids;
  }

  /**
   * Computes semantic distance = 1.0 - cosine_similarity over 1536-dimensional vectors.
   * Clamped to [0.0, 1.0].
   */
  public calculateSemanticDistance(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_EMBEDDING',
        message: 'Embedding vector is missing or undefined.'
      });
    }

    if (vecA.length !== EMBEDDING_DIMENSIONALITY || vecB.length !== EMBEDDING_DIMENSIONALITY) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_EMBEDDING_DIMENSIONS',
        message: `Embeddings must be strictly ${EMBEDDING_DIMENSIONALITY} dimensions. Received ${vecA.length} and ${vecB.length}.`
      });
    }

    const similarity = cosineSimilarity(vecA, vecB);
    const clampedSim = Math.max(0, Math.min(1.0, similarity));
    return Number((1.0 - clampedSim).toFixed(4));
  }

  /**
   * Computes coarse ward-aware geographic distance normalized to [0.0, 1.0].
   * If same ward: distance = 0.0.
   * If different wards: haversineDistance(centroidA, centroidB) / MAX_BHUBANESWAR_DISTANCE_KM.
   * Never accepts or computes household coordinates.
   */
  public async calculateGeographicDistance(wardIdA: string, wardIdB: string): Promise<number> {
    const cleanA = wardIdA?.trim().toUpperCase() || 'WARD-UNKNOWN';
    const cleanB = wardIdB?.trim().toUpperCase() || 'WARD-UNKNOWN';

    if (cleanA === cleanB && cleanA !== 'WARD-UNKNOWN') {
      return 0.0;
    }

    const centroids = await this.getWardCentroids();
    const cA = centroids.get(cleanA);
    const cB = centroids.get(cleanB);

    if (cA && cB) {
      const distKm = haversineDistanceKm(cA.lat, cA.lng, cB.lat, cB.lng);
      return Number(Math.min(1.0, distKm / MAX_BHUBANESWAR_DISTANCE_KM).toFixed(4));
    }

    // Default neutral distance when ward centroid is unknown
    return 0.5;
  }

  /**
   * Computes temporal distance within a 180-day rolling window.
   * If diff > 180 days: isWithinWindow = false, distance = 1.0.
   * If diff <= 180 days: distance = |t1 - t2| / 180_days.
   */
  public calculateTemporalDistance(
    submittedAtA: string,
    submittedAtB: string
  ): { distance: number; isWithinWindow: boolean } {
    const t1 = new Date(submittedAtA).getTime();
    const t2 = new Date(submittedAtB).getTime();

    if (isNaN(t1) || isNaN(t2)) {
      throw new AppError({
        statusCode: 400,
        code: 'INVALID_TIMESTAMP',
        message: `Invalid ISO submission timestamp: '${submittedAtA}' or '${submittedAtB}'.`
      });
    }

    const diffMs = Math.abs(t1 - t2);

    if (diffMs > TEMPORAL_ROLLING_WINDOW_MS) {
      return { distance: 1.0, isWithinWindow: false };
    }

    const distance = Number((diffMs / TEMPORAL_ROLLING_WINDOW_MS).toFixed(4));
    return { distance, isWithinWindow: true };
  }

  /**
   * Computes category mismatch:
   * Same canonical taxonomy category = 0.0
   * Different category = 1.0
   */
  public calculateCategoryMismatch(categoryA: string, categoryB: string): number {
    if (!categoryA || !categoryB) return 1.0;
    return categoryA.trim().toLowerCase() === categoryB.trim().toLowerCase() ? 0.0 : 1.0;
  }

  /**
   * Computes canonical composite distance:
   *   distance = 0.45 * semantic + 0.30 * geographic + 0.15 * temporal + 0.10 * category
   * Eligible if: isWithinWindow && distance <= 0.28
   */
  public async calculatePairwiseDistance(
    signalA: DemandSignal,
    signalB: DemandSignal
  ): Promise<PairwiseDistanceResult> {
    if (!signalA.embedding || !signalB.embedding) {
      throw new AppError({
        statusCode: 400,
        code: 'MISSING_EMBEDDING',
        message: 'Both signals must have 1536-dimensional embeddings for distance computation.'
      });
    }

    const semanticDist = this.calculateSemanticDistance(signalA.embedding, signalB.embedding);
    const geoDist = await this.calculateGeographicDistance(signalA.ward_id, signalB.ward_id);
    const temporalRes = this.calculateTemporalDistance(signalA.submitted_at, signalB.submitted_at);
    const catMismatch = this.calculateCategoryMismatch(signalA.detected_category, signalB.detected_category);

    const totalDistance =
      CLUSTERING_WEIGHTS.SEMANTIC * semanticDist +
      CLUSTERING_WEIGHTS.GEOGRAPHIC * geoDist +
      CLUSTERING_WEIGHTS.TEMPORAL * temporalRes.distance +
      CLUSTERING_WEIGHTS.CATEGORY * catMismatch;

    const roundedDistance = Number(totalDistance.toFixed(4));
    const isEligible = temporalRes.isWithinWindow && roundedDistance <= CLUSTER_DISTANCE_THRESHOLD;

    return {
      distance: roundedDistance,
      isEligible,
      components: {
        semantic_distance: semanticDist,
        geographic_distance: geoDist,
        temporal_distance: temporalRes.distance,
        category_mismatch: catMismatch
      }
    };
  }

  /**
   * Evaluates if an incoming signal can join an existing cluster (comparing against seed/representative).
   */
  public async evaluateClusterMembership(
    signal: DemandSignal,
    clusterSeed: DemandSignal
  ): Promise<PairwiseDistanceResult> {
    return this.calculatePairwiseDistance(signal, clusterSeed);
  }

  /**
   * Main entrypoint: Groups normalized development demand signals into explainable
   * demand clusters using semantic similarity, coarse geography, time, and taxonomy consistency.
   */
  public async clusterDemandSignals(
    signals: (NormalizedDemandSignal | DemandSignal)[],
    options?: DemandClusteringOptions
  ): Promise<DemandCluster[]> {
    const result = await this.clusterDemandSignalsWithDetails(signals, options);
    return result.clusters;
  }

  /**
   * Detailed entrypoint: Returns clusters, deterministic signal-to-cluster memberships,
   * and complete analysis metadata for subsequent opportunity scoring (HF7.5).
   */
  public async clusterDemandSignalsWithDetails(
    signals: (NormalizedDemandSignal | DemandSignal)[],
    options?: DemandClusteringOptions
  ): Promise<DemandClusteringResult> {
    const executedAt = new Date().toISOString();

    if (!signals || !Array.isArray(signals) || signals.length === 0) {
      return {
        clusters: [],
        memberships: [],
        metadata: {
          algorithm_version: CLUSTERING_ALGORITHM_VERSION,
          weights: CLUSTERING_WEIGHTS,
          threshold: CLUSTER_DISTANCE_THRESHOLD,
          temporal_window_days: TEMPORAL_ROLLING_WINDOW_DAYS,
          embedding_model: EMBEDDING_MODEL_NAME,
          embedding_dimensions: EMBEDDING_DIMENSIONALITY,
          total_signals_input: 0,
          signals_clustered: 0,
          clusters_formed: 0,
          executed_at: executedAt
        }
      };
    }

    // 1. Strict REAL_MODE / DEMO_MODE isolation
    const allowDemo = options?.includeDemo ?? env.DEMO_MODE;
    const eligibleSignals = signals.filter((s) => {
      if (!allowDemo && s.is_demo === true) {
        return false;
      }
      return true;
    });

    if (eligibleSignals.length === 0) {
      return {
        clusters: [],
        memberships: [],
        metadata: {
          algorithm_version: CLUSTERING_ALGORITHM_VERSION,
          weights: CLUSTERING_WEIGHTS,
          threshold: CLUSTER_DISTANCE_THRESHOLD,
          temporal_window_days: TEMPORAL_ROLLING_WINDOW_DAYS,
          embedding_model: EMBEDDING_MODEL_NAME,
          embedding_dimensions: EMBEDDING_DIMENSIONALITY,
          total_signals_input: signals.length,
          signals_clustered: 0,
          clusters_formed: 0,
          executed_at: executedAt
        }
      };
    }

    // 2. Ensure all signals have 1536-dimensional embeddings
    const preparedSignals: DemandSignal[] = [];
    for (const rawSig of eligibleSignals) {
      let embedding = (rawSig as DemandSignal).embedding;

      if (!embedding || embedding.length === 0) {
        try {
          const textToEmbed = rawSig.normalized_text || rawSig.original_text;
          embedding = await this.aiProvider.generateEmbedding(textToEmbed);
        } catch (err: any) {
          if (options?.failOnEmbeddingError) {
            throw new AppError({
              statusCode: 502,
              code: 'EMBEDDING_FAILED',
              message: `Failed to generate embedding for signal ${rawSig.id}: ${err.message}`
            });
          }
          throw new AppError({
            statusCode: 502,
            code: 'AI_PROVIDER_ERROR',
            message: `Embedding provider failure: ${err.message || 'Unknown error'}`
          });
        }
      }

      if (embedding.length !== EMBEDDING_DIMENSIONALITY) {
        throw new AppError({
          statusCode: 400,
          code: 'INVALID_EMBEDDING_DIMENSIONS',
          message: `Signal ${rawSig.id} has invalid embedding dimensions (${embedding.length}). Expected ${EMBEDDING_DIMENSIONALITY}.`
        });
      }

      preparedSignals.push({
        ...rawSig,
        embedding
      });
    }

    // 3. Deterministic ordering: sort signals by submitted_at ASC, then id ASC
    preparedSignals.sort((a, b) => {
      const timeDiff = new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });

    // 4. Deterministic Leader Clustering with Minimum Distance Attachment
    interface InternalCluster {
      id: string;
      seedSignal: DemandSignal;
      signals: DemandSignal[];
      wardIds: Set<string>;
      localityNames: Set<string>;
      memberships: DemandClusterMemberInfo[];
    }

    const internalClusters: InternalCluster[] = [];

    for (const signal of preparedSignals) {
      let bestCluster: InternalCluster | null = null;
      let minDistance = Infinity;
      let bestComponents: DistanceComponents | null = null;

      // Evaluate against all active candidate clusters
      for (const candidate of internalClusters) {
        const evalResult = await this.evaluateClusterMembership(signal, candidate.seedSignal);

        if (evalResult.isEligible && evalResult.distance < minDistance) {
          minDistance = evalResult.distance;
          bestCluster = candidate;
          bestComponents = evalResult.components;
        }
      }

      if (bestCluster && bestComponents) {
        // Attach to best matching existing cluster
        bestCluster.signals.push(signal);
        bestCluster.wardIds.add(signal.ward_id);
        if (signal.locality_name) bestCluster.localityNames.add(signal.locality_name);
        bestCluster.memberships.push({
          signal_id: signal.id,
          cluster_id: bestCluster.id,
          distance_to_cluster: minDistance,
          components: bestComponents
        });
      } else {
        // Form a new cluster seeded by this signal
        // Deterministic cluster ID from SHA256(category + ward + seed_signal_id)
        const hashSeed = `${signal.detected_category}_${signal.ward_id}_${signal.id}`;
        const clusterId = `dclus_${crypto.createHash('sha256').update(hashSeed).digest('hex').substring(0, 16)}`;

        const initialMembership: DemandClusterMemberInfo = {
          signal_id: signal.id,
          cluster_id: clusterId,
          distance_to_cluster: 0.0,
          components: {
            semantic_distance: 0.0,
            geographic_distance: 0.0,
            temporal_distance: 0.0,
            category_mismatch: 0.0
          }
        };

        const newCluster: InternalCluster = {
          id: clusterId,
          seedSignal: signal,
          signals: [signal],
          wardIds: new Set([signal.ward_id]),
          localityNames: new Set(signal.locality_name ? [signal.locality_name] : []),
          memberships: [initialMembership]
        };

        internalClusters.push(newCluster);
      }
    }

    // 5. Construct Canonical DemandCluster records validated by DemandClusterSchema
    const wardCentroids = await this.getWardCentroids();
    const finalClusters: DemandCluster[] = [];
    const allMemberships: DemandClusterMemberInfo[] = [];

    for (const ic of internalClusters) {
      const wardIdsArray = Array.from(ic.wardIds).sort();
      const localityNamesArray = Array.from(ic.localityNames).filter(Boolean).sort();

      // Compute cluster centroid as average of its member wards' centroids
      let centroid: { lat: number; lng: number } | undefined = undefined;
      const validCentroids = wardIdsArray
        .map((wid) => wardCentroids.get(wid))
        .filter((c): c is { lat: number; lng: number } => Boolean(c));

      if (validCentroids.length > 0) {
        const sumLat = validCentroids.reduce((sum, c) => sum + c.lat, 0);
        const sumLng = validCentroids.reduce((sum, c) => sum + c.lng, 0);
        centroid = {
          lat: Number((sumLat / validCentroids.length).toFixed(6)),
          lng: Number((sumLng / validCentroids.length).toFixed(6))
        };
      }

      // Temporal bounds
      const timestamps = ic.signals.map((s) => new Date(s.submitted_at).getTime());
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const durationDays = Number(((maxTime - minTime) / (1000 * 3600 * 24)).toFixed(1));

      // Category metadata & title
      const category = ic.seedSignal.detected_category;
      const categoryMeta = DEVELOPMENT_DEMAND_TAXONOMY[category as DevelopmentDemandSector];
      const categoryName = categoryMeta?.name || category.replace(/_/g, ' ');
      const title = `${categoryName} Demand Cluster — ${wardIdsArray.join(', ')}`;

      const clusterObj: DemandCluster = {
        id: ic.id,
        title,
        category,
        ward_ids: wardIdsArray,
        locality_names: localityNamesArray.length > 0 ? localityNamesArray : undefined,
        centroid,
        signal_count: ic.signals.length,
        first_signal_at: new Date(minTime).toISOString(),
        last_signal_at: new Date(maxTime).toISOString(),
        duration_days: durationDays,
        is_demo: ic.signals.some((s) => s.is_demo),
        created_at: ic.seedSignal.ingested_at || executedAt,
        updated_at: executedAt
      };

      // Strict validation through canonical shared Zod schema
      const validated = DemandClusterSchema.parse(clusterObj);
      finalClusters.push(validated);
      allMemberships.push(...ic.memberships);
    }

    return {
      clusters: finalClusters,
      memberships: allMemberships,
      metadata: {
        algorithm_version: CLUSTERING_ALGORITHM_VERSION,
        weights: CLUSTERING_WEIGHTS,
        threshold: CLUSTER_DISTANCE_THRESHOLD,
        temporal_window_days: TEMPORAL_ROLLING_WINDOW_DAYS,
        embedding_model: EMBEDDING_MODEL_NAME,
        embedding_dimensions: EMBEDDING_DIMENSIONALITY,
        total_signals_input: signals.length,
        signals_clustered: preparedSignals.length,
        clusters_formed: finalClusters.length,
        executed_at: executedAt
      }
    };
  }
}

export const developmentDemandClusteringService = new DevelopmentDemandClusteringService();

export async function clusterDemandSignals(
  signals: (NormalizedDemandSignal | DemandSignal)[],
  options?: DemandClusteringOptions
): Promise<DemandCluster[]> {
  return developmentDemandClusteringService.clusterDemandSignals(signals, options);
}
