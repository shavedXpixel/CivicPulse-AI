import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  haversineDistanceKm,
  calculateSignalRelationship
} from '../src/modules/clustering/similarity.math';
import {
  Signal,
  SignalSourceType,
  SignalSeverity,
  SignalStatus,
  SignalProcessingStatus,
  ClusterRelationshipType,
  RELATIONSHIP_THRESHOLDS,
  RELATIONSHIP_WEIGHTS
} from '@civicpulse/shared';

describe('Similarity & Relationship Engine (Phase 4)', () => {
  describe('cosineSimilarity', () => {
    it('returns 1.0 for identical unit vectors', () => {
      const vec = [0.5774, 0.5774, 0.5774];
      const sim = cosineSimilarity(vec, vec);
      expect(sim).toBeCloseTo(1.0, 3);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      const sim = cosineSimilarity(vecA, vecB);
      expect(sim).toBeCloseTo(0.0, 3);
    });

    it('returns -1.0 for opposite vectors', () => {
      const vecA = [1, 0];
      const vecB = [-1, 0];
      const sim = cosineSimilarity(vecA, vecB);
      expect(sim).toBeCloseTo(-1.0, 3);
    });

    it('returns 0.0 safely for empty or zero vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
      expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
    });
  });

  describe('haversineDistanceKm', () => {
    it('returns 0.0 for identical coordinates', () => {
      const dist = haversineDistanceKm(20.2961, 85.8245, 20.2961, 85.8245);
      expect(dist).toBe(0);
    });

    it('calculates accurate distance between known Bhubaneswar locations (~2.16 km)', () => {
      // Nayapalli VIP Road to Saheed Nagar Block B
      const dist = haversineDistanceKm(20.2961, 85.8245, 20.2882, 85.8436);
      expect(dist).toBeGreaterThan(1.8);
      expect(dist).toBeLessThan(2.6);
    });

    it('calculates short walking distance accurately (~100m)', () => {
      const dist = haversineDistanceKm(20.2961, 85.8245, 20.2969, 85.8249);
      expect(dist).toBeLessThan(0.2); // Less than 200m
    });
  });

  describe('calculateSignalRelationship & Configurable Weights', () => {
    const baseSignal: Signal = {
      id: 'sig_base',
      source_type: SignalSourceType.CITIZEN,
      citizen_id: 'usr_1',
      original_text: 'Potable water main burst on Nayapalli VIP Road, flooding basements.',
      category: 'water_supply',
      ward_id: 'WARD-018',
      location: { lat: 20.2961, lng: 85.8245 },
      severity: SignalSeverity.HIGH,
      status: SignalStatus.ACTIVE,
      processing_status: SignalProcessingStatus.COMPLETED,
      created_at: '2026-09-05T08:00:00Z',
      updated_at: '2026-09-05T08:00:00Z',
      submitted_at: '2026-09-05T08:00:00Z',
      media_ids: ['media_1']
    };

    it('classifies strong candidate as DUPLICATE when relationship_score >= 0.85', () => {
      // Nearby (within 50m), same category, reported within 30 min, high semantic sim (0.95), both have media
      const duplicateSignal: Signal = {
        ...baseSignal,
        id: 'sig_dup',
        citizen_id: 'usr_2',
        original_text: 'Severe drinking water line breakage on VIP Road Nayapalli with driveway flooding.',
        location: { lat: 20.2963, lng: 85.8246 },
        created_at: '2026-09-05T08:25:00Z',
        media_ids: ['media_2']
      };

      const result = calculateSignalRelationship(baseSignal, duplicateSignal, 0.95);

      expect(result.relationship_score).toBeGreaterThanOrEqual(RELATIONSHIP_THRESHOLDS.STRONG_DUPLICATE);
      expect(result.relationship).toBe(ClusterRelationshipType.DUPLICATE);
      expect(result.is_match).toBe(true);
      expect(result.reason).toContain('water_supply');
      expect(result.reason).toContain('semantic similarity');
    });

    it('classifies related candidate as RELATED when score is between 0.70 and 0.84', () => {
      // Same ward, same category, within 600m, reported within 12 hours, moderate semantic sim (0.75)
      const relatedSignal: Signal = {
        ...baseSignal,
        id: 'sig_rel',
        citizen_id: 'usr_3',
        original_text: 'No water pressure in taps and low trickle on Jayadev Vihar road.',
        location: { lat: 20.2995, lng: 85.8280 },
        created_at: '2026-09-05T14:00:00Z',
        media_ids: []
      };

      const result = calculateSignalRelationship(baseSignal, relatedSignal, 0.75);

      expect(result.relationship_score).toBeGreaterThanOrEqual(RELATIONSHIP_THRESHOLDS.RELATED_CANDIDATE);
      expect(result.relationship_score).toBeLessThan(RELATIONSHIP_THRESHOLDS.STRONG_DUPLICATE);
      expect(result.relationship).toBe(ClusterRelationshipType.RELATED);
      expect(result.is_match).toBe(true);
    });

    it('classifies distant or different issue as unrelated (is_match = false) when score < 0.70', () => {
      const unrelatedSignal: Signal = {
        ...baseSignal,
        id: 'sig_unrelated',
        citizen_id: 'usr_4',
        original_text: 'Streetlights malfunctioning in Saheed Nagar Ward 4.',
        category: 'streetlights',
        ward_id: 'WARD-004',
        location: { lat: 20.2882, lng: 85.8436 },
        created_at: '2026-09-01T10:00:00Z',
        media_ids: []
      };

      const result = calculateSignalRelationship(baseSignal, unrelatedSignal, 0.20);

      expect(result.relationship_score).toBeLessThan(RELATIONSHIP_THRESHOLDS.RELATED_CANDIDATE);
      expect(result.is_match).toBe(false);
    });

    it('verifies explicit relationship formula weights sum to 1.00', () => {
      const weightSum =
        RELATIONSHIP_WEIGHTS.SEMANTIC +
        RELATIONSHIP_WEIGHTS.SPATIAL +
        RELATIONSHIP_WEIGHTS.TEMPORAL +
        RELATIONSHIP_WEIGHTS.CATEGORY +
        RELATIONSHIP_WEIGHTS.EVIDENCE;
      expect(weightSum).toBeCloseTo(1.00, 4);
    });
  });
});
