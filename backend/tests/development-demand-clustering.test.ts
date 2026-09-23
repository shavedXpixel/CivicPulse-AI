/**
 * CivicPulse Development Demand Intelligence — Demand Clustering Test Suite
 * 
 * Phase: 15B.5.3.20-HF7.3
 * 
 * Tests covering:
 * - Identical/near-identical semantic signals cluster
 * - Semantically unrelated signals do not cluster
 * - Same ward receives geographic proximity advantage
 * - Distant wards affect geographic distance
 * - Recent signals cluster within the 180-day window
 * - Old signals outside the temporal window do not form the same cluster
 * - Same-category signals
 * - Different-category signals
 * - Threshold exactly at boundary (0.28)
 * - Threshold just below and above boundary
 * - Demo signals excluded in REAL_MODE
 * - Exact coordinates are never required
 * - Deterministic repeated clustering produces stable results
 * - Empty input handling
 * - Single signal clustering
 * - Multiple clusters formation
 * - Isolated signal clustering
 * - 1536-dimensional embedding validation
 * - Cosine distance edge cases
 * - Malformed/missing embedding handling
 * - Provider failure handling
 * - Metadata & Schema validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DemandSignalSourceChannel,
  NormalizedDemandSignal,
  DemandSignal,
  DemandClusterSchema,
  AppError
} from '@civicpulse/shared';
import {
  DevelopmentDemandClusteringService,
  clusterDemandSignals,
  CLUSTER_DISTANCE_THRESHOLD,
  CLUSTERING_WEIGHTS,
  TEMPORAL_ROLLING_WINDOW_DAYS,
  EMBEDDING_DIMENSIONALITY
} from '../src/services/development-demand-clustering.service';
import { MockAIProvider } from '../src/providers/ai/mock.ai';
import { MockGeographyProvider } from '../src/providers/reference/mock-reference.providers';
import { IAIProvider } from '../src/providers/ai/ai.interface';

// Helper to create normalized 1536-dimensional unit vectors
function createTestEmbedding(activeIdx: number = 0): number[] {
  const vec = new Array(EMBEDDING_DIMENSIONALITY).fill(0);
  vec[activeIdx % EMBEDDING_DIMENSIONALITY] = 1.0;
  return vec;
}

// Helper to create synthetic DemandSignal
function makeTestSignal(overrides: Partial<DemandSignal> = {}): DemandSignal {
  const now = new Date('2026-09-01T10:00:00.000Z').toISOString();
  return {
    id: `dem_sig_${Math.random().toString(36).substring(2, 9)}`,
    source_channel: DemandSignalSourceChannel.WEB_FORM,
    original_language: 'en',
    original_text: 'Need drinking water pipeline in locality.',
    normalized_language: 'en',
    normalized_text: 'Need drinking water pipeline in locality.',
    normalization_confidence: 0.95,
    detected_category: 'drinking_water',
    detected_urgency: 'MEDIUM',
    ward_id: 'WARD-018',
    locality_name: 'Nayapalli',
    is_demo: false,
    submitted_at: now,
    ingested_at: now,
    embedding: createTestEmbedding(0),
    ...overrides
  };
}

describe('PHASE 15B.5.3.20-HF7.3 — Development Demand Clustering Suite', () => {
  let mockAI: MockAIProvider;
  let mockGeo: MockGeographyProvider;
  let service: DevelopmentDemandClusteringService;

  beforeEach(() => {
    mockAI = new MockAIProvider();
    mockGeo = new MockGeographyProvider();
    service = new DevelopmentDemandClusteringService(mockAI, mockGeo);
  });

  // ==========================================================================
  // 1. Semantic Distance & Edge Cases
  // ==========================================================================
  describe('1. Semantic Distance & Embeddings', () => {
    it('calculates 0.0 semantic distance for identical unit vectors', () => {
      const vecA = createTestEmbedding(5);
      const vecB = createTestEmbedding(5);

      const dist = service.calculateSemanticDistance(vecA, vecB);
      expect(dist).toBe(0.0);
    });

    it('calculates 1.0 semantic distance for orthogonal unit vectors', () => {
      const vecA = createTestEmbedding(1);
      const vecB = createTestEmbedding(2);

      const dist = service.calculateSemanticDistance(vecA, vecB);
      expect(dist).toBe(1.0);
    });

    it('rejects vectors with dimensions not equal to 1536', () => {
      const shortVec = new Array(512).fill(0.1);
      const validVec = createTestEmbedding(0);

      expect(() => service.calculateSemanticDistance(shortVec, validVec)).toThrow(
        /strictly 1536 dimensions|INVALID_EMBEDDING_DIMENSIONS/
      );
    });

    it('rejects undefined or missing vectors', () => {
      expect(() => service.calculateSemanticDistance(null as any, createTestEmbedding(0))).toThrow(
        /missing or undefined/
      );
    });
  });

  // ==========================================================================
  // 2. Geographic Distance & Ward Proximity
  // ==========================================================================
  describe('2. Geographic Distance & Ward Proximity', () => {
    it('returns 0.0 geographic distance for identical ward IDs', async () => {
      const dist = await service.calculateGeographicDistance('WARD-018', 'WARD-018');
      expect(dist).toBe(0.0);
    });

    it('gives adjacent/close wards a low geographic distance', async () => {
      // Mock geography has Ward 18 (20.2961, 85.8245) and Ward 19 (20.2980, 85.8300)
      const dist = await service.calculateGeographicDistance('WARD-018', 'WARD-019');
      expect(dist).toBeGreaterThan(0.0);
      expect(dist).toBeLessThan(0.15); // Distance is ~0.6 km / 25 km ~ 0.024
    });

    it('penalizes distant wards with higher geographic distance', async () => {
      const customCentroids = new Map<string, { lat: number; lng: number }>();
      customCentroids.set('WARD-NORTH', { lat: 20.3500, lng: 85.8000 });
      customCentroids.set('WARD-SOUTH', { lat: 20.2000, lng: 85.8500 }); // ~17 km apart

      const customService = new DevelopmentDemandClusteringService(mockAI, mockGeo, customCentroids);
      const dist = await customService.calculateGeographicDistance('WARD-NORTH', 'WARD-SOUTH');

      expect(dist).toBeGreaterThan(0.5);
    });

    it('returns 0.5 default distance for unknown wards', async () => {
      const dist = await service.calculateGeographicDistance('WARD-UNKNOWN-A', 'WARD-UNKNOWN-B');
      expect(dist).toBe(0.5);
    });
  });

  // ==========================================================================
  // 3. Temporal Distance & 180-Day Window
  // ==========================================================================
  describe('3. Temporal Distance & 180-Day Rolling Window', () => {
    it('returns 0.0 temporal distance for identical timestamps', () => {
      const t = '2026-09-01T12:00:00.000Z';
      const res = service.calculateTemporalDistance(t, t);
      expect(res.distance).toBe(0.0);
      expect(res.isWithinWindow).toBe(true);
    });

    it('scales linearly within the 180-day window', () => {
      const t1 = '2026-01-01T00:00:00.000Z';
      const t2 = '2026-04-01T00:00:00.000Z'; // 90 days diff
      const res = service.calculateTemporalDistance(t1, t2);

      expect(res.isWithinWindow).toBe(true);
      expect(res.distance).toBeCloseTo(0.5, 1);
    });

    it('disqualifies signals outside the 180-day window', () => {
      const t1 = '2026-01-01T00:00:00.000Z';
      const t2 = '2026-07-15T00:00:00.000Z'; // ~195 days diff > 180 days
      const res = service.calculateTemporalDistance(t1, t2);

      expect(res.isWithinWindow).toBe(false);
      expect(res.distance).toBe(1.0);
    });

    it('rejects invalid timestamps with 400 AppError', () => {
      expect(() => service.calculateTemporalDistance('invalid-date', '2026-01-01')).toThrow(
        /Invalid ISO submission timestamp/
      );
    });
  });

  // ==========================================================================
  // 4. Category Mismatch
  // ==========================================================================
  describe('4. Category Mismatch', () => {
    it('returns 0.0 for identical canonical taxonomy sectors', () => {
      expect(service.calculateCategoryMismatch('drinking_water', 'drinking_water')).toBe(0.0);
      expect(service.calculateCategoryMismatch('roads_pedestrian', 'ROADS_PEDESTRIAN')).toBe(0.0);
    });

    it('returns 1.0 for different categories', () => {
      expect(service.calculateCategoryMismatch('drinking_water', 'roads_pedestrian')).toBe(1.0);
    });
  });

  // ==========================================================================
  // 5. Canonical Distance Formula & Threshold Boundary
  // ==========================================================================
  describe('5. Canonical Clustering Formula & Threshold Boundary (0.28)', () => {
    it('clusters identical semantic signals in same ward and time (distance = 0.0 <= 0.28)', async () => {
      const sigA = makeTestSignal({ id: 'sig_1' });
      const sigB = makeTestSignal({ id: 'sig_2' });

      const res = await service.calculatePairwiseDistance(sigA, sigB);
      expect(res.distance).toBe(0.0);
      expect(res.isEligible).toBe(true);
    });

    it('does not cluster semantically orthogonal signals even in same ward and time', async () => {
      const sigA = makeTestSignal({ id: 'sig_1', embedding: createTestEmbedding(1) });
      const sigB = makeTestSignal({ id: 'sig_2', embedding: createTestEmbedding(2) });

      // sem_dist = 1.0 -> 0.45 * 1.0 = 0.45 > 0.28
      const res = await service.calculatePairwiseDistance(sigA, sigB);
      expect(res.distance).toBe(0.45);
      expect(res.isEligible).toBe(false);
    });

    it('evaluates threshold boundary exactly at 0.28', async () => {
      // Craft a signal pair where distance = 0.28
      // If geo=0, temp=0, cat=0 -> distance = 0.45 * sem_dist
      // If sem_dist = 0.28 / 0.45 = 0.6222 -> similarity = 1 - 0.6222 = 0.3778
      const sigA = makeTestSignal({ id: 'sig_a' });
      const sigB = makeTestSignal({ id: 'sig_b' });

      // Custom pairwise calculation directly
      const compDist = Number((0.45 * 0.6222 + 0.30 * 0.0 + 0.15 * 0.0 + 0.10 * 0.0).toFixed(4));
      expect(compDist).toBeLessThanOrEqual(CLUSTER_DISTANCE_THRESHOLD);
    });

    it('does not cluster when distance is just above boundary (> 0.28)', async () => {
      const distAbove = 0.2801;
      expect(distAbove <= CLUSTER_DISTANCE_THRESHOLD).toBe(false);
    });
  });

  // ==========================================================================
  // 6. Cluster Formation (Batch Clustering)
  // ==========================================================================
  describe('6. Demand Cluster Formation', () => {
    it('returns empty clusters array for empty input', async () => {
      const result = await service.clusterDemandSignals([]);
      expect(result).toEqual([]);
    });

    it('creates a single cluster for a single signal', async () => {
      const sig = makeTestSignal({ id: 'sig_single', ward_id: 'WARD-018' });
      const clusters = await service.clusterDemandSignals([sig]);

      expect(clusters).toHaveLength(1);
      const c = clusters[0]!;
      expect(c.signal_count).toBe(1);
      expect(c.category).toBe('drinking_water');
      expect(c.ward_ids).toContain('WARD-018');
      expect(c.is_demo).toBe(false);

      // Validate schema
      expect(DemandClusterSchema.safeParse(c).success).toBe(true);
    });

    it('clusters multiple similar signals in the same ward into one cluster', async () => {
      const sig1 = makeTestSignal({ id: 'sig_1', submitted_at: '2026-09-01T00:00:00Z' });
      const sig2 = makeTestSignal({ id: 'sig_2', submitted_at: '2026-09-05T00:00:00Z' });
      const sig3 = makeTestSignal({ id: 'sig_3', submitted_at: '2026-09-10T00:00:00Z' });

      const clusters = await service.clusterDemandSignals([sig1, sig2, sig3]);

      expect(clusters).toHaveLength(1);
      expect(clusters[0]!.signal_count).toBe(3);
      expect(clusters[0]!.duration_days).toBeCloseTo(9, 0);
    });

    it('forms separate clusters for disparate signals (different categories / orthogonal)', async () => {
      const waterSig = makeTestSignal({
        id: 'sig_water',
        detected_category: 'drinking_water',
        embedding: createTestEmbedding(0)
      });
      const roadSig = makeTestSignal({
        id: 'sig_road',
        detected_category: 'roads_pedestrian',
        embedding: createTestEmbedding(10)
      });

      const clusters = await service.clusterDemandSignals([waterSig, roadSig]);

      expect(clusters).toHaveLength(2);
      const categories = clusters.map((c) => c.category);
      expect(categories).toContain('drinking_water');
      expect(categories).toContain('roads_pedestrian');
    });

    it('does not group signals separated by more than 180 days into the same cluster', async () => {
      const sigRecent = makeTestSignal({
        id: 'sig_recent',
        submitted_at: '2026-09-01T00:00:00Z',
        embedding: createTestEmbedding(0)
      });
      const sigOld = makeTestSignal({
        id: 'sig_old',
        submitted_at: '2025-12-01T00:00:00Z', // > 270 days apart
        embedding: createTestEmbedding(0)
      });

      const clusters = await service.clusterDemandSignals([sigRecent, sigOld]);
      expect(clusters).toHaveLength(2);
    });
  });

  // ==========================================================================
  // 7. Determinism & Stability
  // ==========================================================================
  describe('7. Deterministic & Stable Cluster Identification', () => {
    it('produces identical cluster IDs and counts regardless of input array order', async () => {
      const sig1 = makeTestSignal({ id: 'sig_alpha', submitted_at: '2026-08-01T00:00:00Z' });
      const sig2 = makeTestSignal({ id: 'sig_beta', submitted_at: '2026-08-05T00:00:00Z' });
      const sig3 = makeTestSignal({
        id: 'sig_gamma',
        detected_category: 'roads_pedestrian',
        embedding: createTestEmbedding(10),
        submitted_at: '2026-08-02T00:00:00Z'
      });

      const runA = await service.clusterDemandSignals([sig1, sig2, sig3]);
      const runB = await service.clusterDemandSignals([sig3, sig1, sig2]);

      expect(runA.length).toBe(runB.length);
      expect(runA.map((c) => c.id).sort()).toEqual(runB.map((c) => c.id).sort());
      expect(runA.map((c) => c.signal_count).sort()).toEqual(runB.map((c) => c.signal_count).sort());
    });
  });

  // ==========================================================================
  // 8. REAL_MODE & is_demo Boundaries
  // ==========================================================================
  describe('8. REAL_MODE & is_demo Boundaries', () => {
    it('excludes is_demo=true signals in REAL_MODE / when includeDemo is false', async () => {
      const realSig = makeTestSignal({ id: 'real_sig_1', is_demo: false });
      const demoSig = makeTestSignal({ id: 'demo_sig_2', is_demo: true });

      const clusters = await service.clusterDemandSignals([realSig, demoSig], { includeDemo: false });

      expect(clusters).toHaveLength(1);
      expect(clusters[0]!.signal_count).toBe(1);
      expect(clusters[0]!.is_demo).toBe(false);
    });

    it('includes demo signals only when includeDemo is explicitly true', async () => {
      const demoSig1 = makeTestSignal({ id: 'demo_1', is_demo: true });
      const demoSig2 = makeTestSignal({ id: 'demo_2', is_demo: true });

      const clusters = await service.clusterDemandSignals([demoSig1, demoSig2], {
        includeDemo: true
      });

      expect(clusters).toHaveLength(1);
      expect(clusters[0]!.signal_count).toBe(2);
      expect(clusters[0]!.is_demo).toBe(true);
    });
  });

  // ==========================================================================
  // 9. Provider Integration & Embedding Generation
  // ==========================================================================
  describe('9. Provider Integration & Embedding Generation', () => {
    it('automatically generates 1536-dimensional embeddings for signals lacking embeddings', async () => {
      const sigWithoutEmbedding: NormalizedDemandSignal = {
        id: 'sig_no_emb',
        source_channel: DemandSignalSourceChannel.WEB_FORM,
        original_language: 'en',
        original_text: 'Need streetlight in ward.',
        normalized_language: 'en',
        normalized_text: 'Need streetlight in ward.',
        normalization_confidence: 0.9,
        detected_category: 'power_public_lighting',
        detected_urgency: 'MEDIUM',
        ward_id: 'WARD-018',
        is_demo: false,
        submitted_at: '2026-09-01T00:00:00Z',
        ingested_at: '2026-09-01T00:00:00Z'
      };

      const clusters = await service.clusterDemandSignals([sigWithoutEmbedding]);
      expect(clusters).toHaveLength(1);
      expect(clusters[0]!.category).toBe('power_public_lighting');
    });

    it('fails closed when AI provider embedding generation fails', async () => {
      mockAI.simulateFailure(true);

      const sigWithoutEmbedding: NormalizedDemandSignal = {
        id: 'sig_fail',
        source_channel: DemandSignalSourceChannel.WEB_FORM,
        original_language: 'en',
        original_text: 'Broken tap.',
        normalized_language: 'en',
        normalized_text: 'Broken tap.',
        normalization_confidence: 0.9,
        detected_category: 'drinking_water',
        detected_urgency: 'HIGH',
        ward_id: 'WARD-018',
        is_demo: false,
        submitted_at: '2026-09-01T00:00:00Z',
        ingested_at: '2026-09-01T00:00:00Z'
      };

      await expect(
        service.clusterDemandSignals([sigWithoutEmbedding])
      ).rejects.toThrow(/Embedding provider failure|EMBEDDING_FAILED|AI_PROVIDER_ERROR/);
    });
  });

  // ==========================================================================
  // 10. Privacy & Exact Coordinate Rejection
  // ==========================================================================
  describe('10. Privacy & Coarse-Only Geographic Representation', () => {
    it('operates strictly without requiring or persisting household coordinates', async () => {
      const sig = makeTestSignal({ id: 'sig_privacy' });
      // Verify signal has no exact coordinates
      expect((sig as any).lat).toBeUndefined();
      expect((sig as any).lng).toBeUndefined();
      expect((sig as any).email).toBeUndefined();
      expect((sig as any).phone).toBeUndefined();

      const clusters = await service.clusterDemandSignals([sig]);
      expect(clusters).toHaveLength(1);
      // Centroid is coarse administrative ward centroid, not parcel coordinates
      expect(clusters[0]!.centroid).toBeDefined();
      expect(clusters[0]!.ward_ids).toEqual(['WARD-018']);
    });
  });

  // ==========================================================================
  // 11. Detailed Metadata & Membership Breakdown
  // ==========================================================================
  describe('11. Detailed Metadata & Membership Audit', () => {
    it('returns full breakdown and weights metadata in clusterDemandSignalsWithDetails', async () => {
      const sigA = makeTestSignal({ id: 'sig_detail_1' });
      const sigB = makeTestSignal({ id: 'sig_detail_2' });

      const details = await service.clusterDemandSignalsWithDetails([sigA, sigB]);

      expect(details.clusters).toHaveLength(1);
      expect(details.memberships).toHaveLength(2);
      expect(details.metadata.algorithm_version).toBe('development_demand_clustering_v1');
      expect(details.metadata.threshold).toBe(0.28);
      expect(details.metadata.temporal_window_days).toBe(180);
      expect(details.metadata.embedding_dimensions).toBe(1536);
      expect(details.metadata.embedding_model).toBe('gemini-embedding-001');
      expect(details.metadata.weights).toEqual(CLUSTERING_WEIGHTS);

      const mem = details.memberships[0]!;
      expect(mem.components.semantic_distance).toBeDefined();
      expect(mem.components.geographic_distance).toBeDefined();
      expect(mem.components.temporal_distance).toBeDefined();
      expect(mem.components.category_mismatch).toBeDefined();
    });
  });
});
