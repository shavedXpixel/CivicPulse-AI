import {
  Signal,
  ClusterRelationshipType,
  RELATIONSHIP_WEIGHTS,
  RELATIONSHIP_THRESHOLDS
} from '@civicpulse/shared';

/**
 * Computes cosine similarity between two numerical vectors.
 * Returns a normalized float between -1.0 and 1.0 (or 0.0 for zero vectors).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  const length = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    const a = vecA[i]!;
    const b = vecB[i]!;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  const sim = dotProduct / denominator;
  return Math.max(-1.0, Math.min(1.0, Number(sim.toFixed(4))));
}

/**
 * Calculates great-circle distance between two geographic coordinates in kilometers
 * using the Haversine formula (Earth radius = 6371 km).
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(4));
}

export interface SignalRelationshipResult {
  relationship: ClusterRelationshipType;
  relationship_score: number; // 0.0 to 1.0
  reason: string;
  is_match: boolean;
}

/**
 * Explicit, deterministic calculation of relationship score between two signals.
 * Strictly separates relationship_score (0-1) from public impact_score (0-100).
 */
export function calculateSignalRelationship(
  signalA: Signal,
  signalB: Signal,
  semanticSimilarity: number
): SignalRelationshipResult {
  // 1. Semantic Similarity Component (Weight: 0.50)
  const clampedSemantic = Math.max(0, Math.min(1, semanticSimilarity));
  const semanticPart = clampedSemantic * RELATIONSHIP_WEIGHTS.SEMANTIC;

  // 2. Geographic Proximity Component (Weight: 0.20)
  let spatialScore = 0.2; // Baseline default if no coordinates
  let distanceMeters: number | null = null;

  if (signalA.location && signalB.location) {
    const distKm = haversineDistanceKm(
      signalA.location.lat,
      signalA.location.lng,
      signalB.location.lat,
      signalB.location.lng
    );
    distanceMeters = Math.round(distKm * 1000);

    if (distKm <= 0.2) {
      // Within 200m
      spatialScore = 1.0;
    } else if (distKm <= 1.0) {
      // 200m to 1km linear decay from 1.0 down to 0.5
      spatialScore = 1.0 - ((distKm - 0.2) / 0.8) * 0.5;
    } else if (distKm <= 3.0) {
      // 1km to 3km linear decay from 0.5 down to 0.1
      spatialScore = 0.5 - ((distKm - 1.0) / 2.0) * 0.4;
    } else {
      spatialScore = 0.0;
    }
  } else if (signalA.ward_id && signalB.ward_id && signalA.ward_id === signalB.ward_id) {
    spatialScore = 0.75;
  }
  const spatialPart = spatialScore * RELATIONSHIP_WEIGHTS.SPATIAL;

  // 3. Temporal Proximity Component (Weight: 0.15)
  let temporalScore = 0.5;
  let timeDiffHours = 0;
  if (signalA.created_at && signalB.created_at) {
    const timeA = new Date(signalA.created_at).getTime();
    const timeB = new Date(signalB.created_at).getTime();
    timeDiffHours = Math.abs(timeA - timeB) / (1000 * 60 * 60);

    if (timeDiffHours <= 6) {
      temporalScore = 1.0;
    } else if (timeDiffHours <= 24) {
      temporalScore = 0.8;
    } else if (timeDiffHours <= 72) {
      temporalScore = 0.5;
    } else if (timeDiffHours <= 168) {
      temporalScore = 0.25;
    } else {
      temporalScore = 0.1;
    }
  }
  const temporalPart = temporalScore * RELATIONSHIP_WEIGHTS.TEMPORAL;

  // 4. Category Match Component (Weight: 0.10)
  const catA = (signalA.category || '').toLowerCase();
  const catB = (signalB.category || '').toLowerCase();
  const isCategoryMatch = catA.length > 0 && catA === catB;
  const categoryScore = isCategoryMatch ? 1.0 : 0.0;
  const categoryPart = categoryScore * RELATIONSHIP_WEIGHTS.CATEGORY;

  // 5. Evidence / Visual Match Component (Weight: 0.05)
  const hasMediaA = signalA.media_ids && signalA.media_ids.length > 0;
  const hasMediaB = signalB.media_ids && signalB.media_ids.length > 0;
  let evidenceScore = 0.3;
  if (hasMediaA && hasMediaB) {
    evidenceScore = 1.0;
  } else if (hasMediaA || hasMediaB) {
    evidenceScore = 0.6;
  }
  const evidencePart = evidenceScore * RELATIONSHIP_WEIGHTS.EVIDENCE;

  // Composite Relationship Score (0.00 to 1.00)
  const relationship_score = Number(
    (semanticPart + spatialPart + temporalPart + categoryPart + evidencePart).toFixed(4)
  );

  // Determine Relationship Type based on configurable thresholds
  let relationship = ClusterRelationshipType.SUPPORTING;
  let is_match = false;

  if (relationship_score >= RELATIONSHIP_THRESHOLDS.STRONG_DUPLICATE) {
    relationship = ClusterRelationshipType.DUPLICATE;
    is_match = true;
  } else if (relationship_score >= RELATIONSHIP_THRESHOLDS.RELATED_CANDIDATE) {
    relationship = ClusterRelationshipType.RELATED;
    is_match = true;
  }

  // Explainability string for inspection
  const reasons: string[] = [];
  if (isCategoryMatch) reasons.push(`matching ${catA} category`);
  if (distanceMeters !== null) {
    reasons.push(`${distanceMeters}m proximity`);
  } else if (signalA.ward_id === signalB.ward_id) {
    reasons.push(`same ward (${signalA.ward_id})`);
  }
  if (timeDiffHours <= 24) {
    reasons.push(`reported within ${Math.round(timeDiffHours)}h`);
  }
  reasons.push(`semantic similarity ${(clampedSemantic * 100).toFixed(0)}%`);

  const reason = `Likely related because: ${reasons.join(', ')}.`;

  return {
    relationship,
    relationship_score,
    reason,
    is_match
  };
}
