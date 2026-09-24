/**
 * CivicPulse Development Demand Intelligence — Deterministic Demand Metrics Service
 * 
 * Phase: 15B.5.3.20-HF7.5
 * 
 * Core Invariants:
 * 1. Fully deterministic: Given identical inputs (cluster, signals, indicators, investments),
 *    produces identical outputs on repeated execution. Zero random values, zero LLM scoring,
 *    zero current-time dependence.
 * 2. Canonical metric formula (sum of 6 bounded components):
 *    - demand_volume_score:              0–25
 *    - recurrence_score:                 0–20
 *    - geographic_concentration_score:   0–15
 *    - population_exposure_score:        0–15
 *    - infrastructure_deficit_score:    0–15
 *    - investment_gap_score:             0–10
 *    - composite_demand_index:           0–100 (exactly equals sum of the 6 components)
 * 3. Priority band mapping:
 *    - LOW:       0–39
 *    - MEDIUM:   40–64
 *    - HIGH:     65–84
 *    - CRITICAL: 85–100
 * 4. REAL_MODE isolation:
 *    - In REAL_MODE, strictly excludes demo signals, demo indicators, and demo investments.
 * 5. Honest missing-data semantics:
 *    - "Data unavailable" is explicitly preserved and distinguished from confirmed deficits or zero.
 * 6. Privacy:
 *    - Coarse administrative ward geography only. Zero residential GPS or citizen PII.
 */

import {
  DeterministicDemandMetrics,
  DemandPriorityBand,
  DemandCluster,
  NormalizedDemandSignal,
  DemandSignal,
  DevelopmentIndicator,
  PublicInvestmentRecord,
  PublicInvestmentStatus,
  MetricComponentDetail,
  DetailedDemandMetricsResult,
  DemandProvenance
} from '@civicpulse/shared';
import { haversineDistanceKm } from '../modules/clustering/similarity.math';
import { getGeographyProvider } from '../providers';
import { IGeographyProvider } from '../providers/reference/reference.interface';
import { env } from '../config/env';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

export const METRIC_BOUNDS = {
  DEMAND_VOLUME_MAX: 25,
  RECURRENCE_MAX: 20,
  GEOGRAPHIC_CONCENTRATION_MAX: 15,
  POPULATION_EXPOSURE_MAX: 15,
  INFRASTRUCTURE_DEFICIT_MAX: 15,
  INVESTMENT_GAP_MAX: 10,
  COMPOSITE_INDEX_MAX: 100
} as const;

export const PRIORITY_BAND_THRESHOLDS = {
  CRITICAL: 85,
  HIGH: 65,
  MEDIUM: 40,
  LOW: 0
} as const;

export const ROLLING_WINDOW_DAYS_MAX = 180;
export const MAX_CITY_EXTENT_KM = 25.0;

export interface DemandMetricsOptions {
  isDemo?: boolean;
  geographyProvider?: IGeographyProvider;
}

// ============================================================================
// PRIORITY BAND MAPPER
// ============================================================================

/**
 * Maps composite demand index (0–100) to canonical DemandPriorityBand.
 * Approved ranges:
 *   LOW       0–39
 *   MEDIUM   40–64
 *   HIGH     65–84
 *   CRITICAL 85–100
 */
export function mapCompositeToPriorityBand(compositeIndex: number): DemandPriorityBand {
  const clamped = Math.max(0, Math.min(100, compositeIndex));
  if (clamped >= PRIORITY_BAND_THRESHOLDS.CRITICAL) return DemandPriorityBand.CRITICAL;
  if (clamped >= PRIORITY_BAND_THRESHOLDS.HIGH) return DemandPriorityBand.HIGH;
  if (clamped >= PRIORITY_BAND_THRESHOLDS.MEDIUM) return DemandPriorityBand.MEDIUM;
  return DemandPriorityBand.LOW;
}

// ============================================================================
// 1. DEMAND VOLUME SCORE (0–25)
// ============================================================================

function calculateVolumeScore(
  signals: (NormalizedDemandSignal | DemandSignal)[],
  cluster: DemandCluster,
  isDemo: boolean
): MetricComponentDetail {
  const signalCount = signals.length > 0
    ? signals.length
    : (isDemo || !cluster.is_demo ? Math.max(0, cluster.signal_count || 0) : 0);

  let score = 0;
  if (signalCount > 0) {
    // Monotonically saturating logarithmic curve:
    // N = 0 -> 0, N = 1 -> 4, N = 5 -> 11, N = 10 -> 15, N = 20 -> 19, N >= 50 -> 25
    const saturationDenominator = Math.log(1 + 50);
    const raw = METRIC_BOUNDS.DEMAND_VOLUME_MAX * (Math.log(1 + signalCount) / saturationDenominator);
    score = Math.max(0, Math.min(METRIC_BOUNDS.DEMAND_VOLUME_MAX, Math.round(raw)));
  }

  const provenance: DemandProvenance = {
    is_demo: isDemo,
    source: 'CIVICPULSE_NORMALIZED_SIGNALS',
    measurement_context: `Deterministic logarithmic saturation on ${signalCount} normalized citizen demand signal(s)`
  };

  return {
    metric: 'demand_volume_score',
    score,
    max_score: METRIC_BOUNDS.DEMAND_VOLUME_MAX,
    raw_inputs: {
      signal_count: signalCount,
      signals_analyzed: signals.length,
      cluster_nominal_count: cluster.signal_count
    },
    formula: 'min(25, round(25 * ln(1 + signal_count) / ln(51)))',
    explanation: signalCount === 0
      ? 'Zero signals analyzed; volume score is 0.'
      : `Normalized volume of ${signalCount} signal(s) mapped deterministically to ${score}/25 on a saturating scale.`,
    data_available: true,
    provenance
  };
}

// ============================================================================
// 2. RECURRENCE SCORE (0–20)
// ============================================================================

function calculateRecurrenceScore(
  signals: (NormalizedDemandSignal | DemandSignal)[],
  cluster: DemandCluster,
  isDemo: boolean
): MetricComponentDetail {
  const totalCount = signals.length > 0 ? signals.length : cluster.signal_count || 0;

  if (totalCount <= 1) {
    return {
      metric: 'recurrence_score',
      score: 0,
      max_score: METRIC_BOUNDS.RECURRENCE_MAX,
      raw_inputs: { total_signals: totalCount, temporal_duration_days: 0, distinct_active_days: totalCount },
      formula: 'duration_span_score (0-10) + active_days_score (0-10)',
      explanation: totalCount === 0
        ? 'No demand signals present to evaluate recurrence.'
        : 'Single isolated signal; no multi-point recurrence over time observed.',
      data_available: true,
      provenance: {
        is_demo: isDemo,
        source: 'CIVICPULSE_SIGNAL_TIMESTAMPS',
        measurement_context: 'Single observation temporal evaluation'
      }
    };
  }

  // Collect and sort timestamps
  let timestamps: number[] = [];
  if (signals.length > 0) {
    timestamps = signals
      .map((s) => Date.parse(s.submitted_at || s.ingested_at))
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b);
  }

  let minTime: number;
  let maxTime: number;
  let distinctDays = 1;

  if (timestamps.length >= 2) {
    minTime = timestamps[0]!;
    maxTime = timestamps[timestamps.length - 1]!;

    const dateSet = new Set<string>();
    for (const t of timestamps) {
      const d = new Date(t);
      dateSet.add(d.toISOString().slice(0, 10));
    }
    distinctDays = dateSet.size;
  } else {
    minTime = Date.parse(cluster.first_signal_at);
    maxTime = Date.parse(cluster.last_signal_at);
    distinctDays = Math.max(1, Math.min(cluster.duration_days || 1, 15));
  }

  const durationMs = isNaN(minTime) || isNaN(maxTime) ? 0 : Math.max(0, maxTime - minTime);
  const rawDurationDays = durationMs / (1000 * 60 * 60 * 24);
  const effectiveDays = Math.min(ROLLING_WINDOW_DAYS_MAX, rawDurationDays);

  // Component A: Duration span score (0–10)
  // Submissions spanning longer windows within 180-day rolling window score higher
  const durationScore = effectiveDays <= 0
    ? 0
    : Math.min(10, Math.round(10 * Math.sqrt(effectiveDays / ROLLING_WINDOW_DAYS_MAX)));

  // Component B: Distinct active periods score (0–10)
  // Multi-day recurrence distinguishes genuine sustained problems from single-incident bursts
  const activeDaysScore = distinctDays <= 1
    ? 0
    : Math.min(10, Math.round(10 * (Math.log(distinctDays) / Math.log(15))));

  const score = Math.max(0, Math.min(METRIC_BOUNDS.RECURRENCE_MAX, durationScore + activeDaysScore));

  return {
    metric: 'recurrence_score',
    score,
    max_score: METRIC_BOUNDS.RECURRENCE_MAX,
    raw_inputs: {
      total_signals: totalCount,
      temporal_duration_days: Number(rawDurationDays.toFixed(2)),
      effective_duration_days: Number(effectiveDays.toFixed(2)),
      distinct_active_days: distinctDays,
      duration_score: durationScore,
      active_days_score: activeDaysScore
    },
    formula: 'min(10, round(10 * sqrt(days / 180))) + min(10, round(10 * ln(distinct_days) / ln(15)))',
    explanation: effectiveDays === 0 && distinctDays === 1
      ? 'Signals submitted simultaneously or on the same calendar date (burst); recurrence score is 0.'
      : `Demand repeated across ${distinctDays} distinct date(s) over ${rawDurationDays.toFixed(1)} day(s) (effective ${effectiveDays.toFixed(1)}d in 180d window).`,
    data_available: true,
    provenance: {
      is_demo: isDemo,
      source: 'CIVICPULSE_SIGNAL_TIMESTAMPS',
      measurement_context: 'Temporal span and calendar day recurrence analysis'
    }
  };
}

// ============================================================================
// 3. GEOGRAPHIC CONCENTRATION SCORE (0–15)
// ============================================================================

async function calculateGeographicConcentrationScore(
  signals: (NormalizedDemandSignal | DemandSignal)[],
  cluster: DemandCluster,
  isDemo: boolean,
  geographyProvider?: IGeographyProvider
): Promise<MetricComponentDetail> {
  const wardIds = new Set<string>();

  if (signals.length > 0) {
    for (const s of signals) {
      if (s.ward_id && s.ward_id.trim().length > 0) {
        wardIds.add(s.ward_id.trim());
      }
    }
  }

  if (wardIds.size === 0 && cluster.ward_ids && cluster.ward_ids.length > 0) {
    for (const w of cluster.ward_ids) {
      if (w && w.trim().length > 0) wardIds.add(w.trim());
    }
  }

  const wardCount = wardIds.size;
  if (wardCount === 0) {
    return {
      metric: 'geographic_concentration_score',
      score: 0,
      max_score: METRIC_BOUNDS.GEOGRAPHIC_CONCENTRATION_MAX,
      raw_inputs: { ward_count: 0 },
      formula: 'Coarse administrative ward concentration',
      explanation: 'No ward identifiers associated with this cluster; concentration score is 0.',
      data_available: false,
      provenance: {
        is_demo: isDemo,
        source: 'CIVICPULSE_GEOGRAPHY',
        measurement_context: 'Administrative ward boundary evaluation'
      }
    };
  }

  // Exactly one ward: tightly concentrated within a single administrative unit
  if (wardCount === 1) {
    const singleWard = Array.from(wardIds)[0]!;
    return {
      metric: 'geographic_concentration_score',
      score: METRIC_BOUNDS.GEOGRAPHIC_CONCENTRATION_MAX,
      max_score: METRIC_BOUNDS.GEOGRAPHIC_CONCENTRATION_MAX,
      raw_inputs: { ward_count: 1, ward_ids: [singleWard], dominant_ward_share: 1.0, max_spread_km: 0 },
      formula: 'Single ward concentration = 15',
      explanation: `Demand is entirely localized within a single administrative ward (${singleWard}). Maximum concentration score.`,
      data_available: true,
      provenance: {
        is_demo: isDemo,
        source: 'CIVICPULSE_GEOGRAPHY',
        measurement_context: 'Single ward territorial boundary'
      }
    };
  }

  // Multiple wards: compute dominant ward share and spatial spread between ward centroids
  const wardArray = Array.from(wardIds);
  const wardSignalCounts = new Map<string, number>();
  for (const s of signals) {
    const w = s.ward_id?.trim();
    if (w) {
      wardSignalCounts.set(w, (wardSignalCounts.get(w) || 0) + 1);
    }
  }

  let dominantCount = 0;
  for (const count of wardSignalCounts.values()) {
    if (count > dominantCount) dominantCount = count;
  }
  const totalAnalyzed = signals.length > 0 ? signals.length : wardCount;
  const dominantShare = dominantCount > 0 ? dominantCount / totalAnalyzed : 1 / wardCount;

  // Retrieve ward centroids to evaluate coarse spatial spread (strictly NO residential coordinates)
  let maxSpreadKm = 0;
  const geoProv = geographyProvider || getGeographyProvider();

  try {
    const centroids: { lat: number; lng: number }[] = [];
    for (const w of wardArray) {
      const info = await geoProv.getWardById(w);
      if (info?.centroid) {
        centroids.push(info.centroid);
      }
    }

    if (centroids.length >= 2) {
      for (let i = 0; i < centroids.length; i++) {
        for (let j = i + 1; j < centroids.length; j++) {
          const d = haversineDistanceKm(
            centroids[i]!.lat,
            centroids[i]!.lng,
            centroids[j]!.lat,
            centroids[j]!.lng
          );
          if (d > maxSpreadKm) maxSpreadKm = d;
        }
      }
    } else {
      // Fallback estimate based on number of wards if GeoJSON centroids unavailable
      maxSpreadKm = Math.min(MAX_CITY_EXTENT_KM, 2.5 * (wardCount - 1));
    }
  } catch {
    maxSpreadKm = Math.min(MAX_CITY_EXTENT_KM, 2.5 * (wardCount - 1));
  }

  const dispersionRatio = Math.min(1.0, maxSpreadKm / MAX_CITY_EXTENT_KM);
  const proximityFactor = Math.max(0, 1.0 - dispersionRatio);
  const inverseWardFactor = 1 / wardCount;

  // Balanced coarse formula: 40% inverse ward count + 30% dominant share + 30% proximity
  const rawScore = METRIC_BOUNDS.GEOGRAPHIC_CONCENTRATION_MAX * (
    0.4 * inverseWardFactor +
    0.3 * dominantShare +
    0.3 * proximityFactor
  );

  const score = Math.max(1, Math.min(METRIC_BOUNDS.GEOGRAPHIC_CONCENTRATION_MAX - 1, Math.round(rawScore)));

  return {
    metric: 'geographic_concentration_score',
    score,
    max_score: METRIC_BOUNDS.GEOGRAPHIC_CONCENTRATION_MAX,
    raw_inputs: {
      ward_count: wardCount,
      ward_ids: wardArray,
      dominant_ward_share: Number(dominantShare.toFixed(3)),
      max_centroid_spread_km: Number(maxSpreadKm.toFixed(2)),
      proximity_factor: Number(proximityFactor.toFixed(3))
    },
    formula: 'clamp(round(15 * (0.4/k + 0.3*p_dominant + 0.3*(1 - d_max/25))), 1, 14)',
    explanation: maxSpreadKm <= 3.5
      ? `Demand spans ${wardCount} adjacent/nearby wards with coarse spread of ${maxSpreadKm.toFixed(1)} km; moderately concentrated.`
      : `Demand is dispersed across ${wardCount} wards spanning ${maxSpreadKm.toFixed(1)} km across the municipality.`,
    data_available: true,
    provenance: {
      is_demo: isDemo,
      source: 'CIVICPULSE_COARSE_GEOGRAPHY',
      measurement_context: 'Ward centroid coarse distance aggregation (zero household GPS used)'
    }
  };
}

// ============================================================================
// 4. POPULATION EXPOSURE SCORE (0–15)
// ============================================================================

function calculatePopulationExposureScore(
  indicators: DevelopmentIndicator[],
  cluster: DemandCluster,
  isDemo: boolean
): MetricComponentDetail {
  // Extract population indicators
  const popIndicators = indicators.filter(
    (ind) => ind.indicator_type === 'POPULATION' || ind.type === 'POPULATION'
  );

  if (popIndicators.length === 0) {
    return {
      metric: 'population_exposure_score',
      score: 0,
      max_score: METRIC_BOUNDS.POPULATION_EXPOSURE_MAX,
      raw_inputs: { indicators_matched: 0, cluster_wards: cluster.ward_ids },
      formula: 'min(15, round(15 * ln(1 + population / 1000) / ln(51)))',
      explanation: 'Authoritative Census 2011 population data unavailable for the cluster wards; neutral score of 0 applied without fabrication.',
      data_available: false,
      provenance: {
        is_demo: isDemo,
        source: 'CENSUS_2011_REFERENCE',
        measurement_context: 'Missing population reference data'
      }
    };
  }

  // Avoid double-counting if multiple population indicators for the same ward exist
  const wardPopMap = new Map<string, number>();
  for (const ind of popIndicators) {
    const w = ind.ward_id;
    if (!wardPopMap.has(w) || (wardPopMap.get(w)! < ind.value)) {
      wardPopMap.set(w, ind.value);
    }
  }

  let totalPopulation = 0;
  for (const pop of wardPopMap.values()) {
    totalPopulation += pop;
  }

  // Logarithmic saturation: ~2k pop -> 4, ~12k pop -> 10, ~25k pop -> 12, 50k+ -> 15
  const saturationDenominator = Math.log(1 + 50);
  const raw = METRIC_BOUNDS.POPULATION_EXPOSURE_MAX * (Math.log(1 + totalPopulation / 1000) / saturationDenominator);
  const score = Math.max(1, Math.min(METRIC_BOUNDS.POPULATION_EXPOSURE_MAX, Math.round(raw)));

  return {
    metric: 'population_exposure_score',
    score,
    max_score: METRIC_BOUNDS.POPULATION_EXPOSURE_MAX,
    raw_inputs: {
      total_population: totalPopulation,
      wards_counted: Array.from(wardPopMap.keys()),
      ward_populations: Object.fromEntries(wardPopMap)
    },
    formula: 'min(15, round(15 * ln(1 + total_pop / 1000) / ln(51)))',
    explanation: `Total authoritative Census 2011 population exposed across ${wardPopMap.size} ward(s) is ${totalPopulation.toLocaleString()} persons.`,
    data_available: true,
    provenance: {
      is_demo: isDemo,
      source: popIndicators[0]?.source || 'Census 2011 Primary Census Abstract',
      measurement_context: `Summed official ward population: ${totalPopulation.toLocaleString()} persons`
    }
  };
}

// ============================================================================
// 5. INFRASTRUCTURE DEFICIT SCORE (0–15)
// ============================================================================

function calculateInfrastructureDeficitScore(
  indicators: DevelopmentIndicator[],
  cluster: DemandCluster,
  isDemo: boolean
): MetricComponentDetail {
  const categoryLower = cluster.category.toLowerCase().trim();

  // A. Educational facilities sector
  if (
    categoryLower === 'educational_facilities' ||
    categoryLower.includes('education') ||
    categoryLower.includes('school')
  ) {
    const schoolIndicators = indicators.filter(
      (ind) =>
        ind.id.includes('school') ||
        ind.name.toLowerCase().includes('school') ||
        ind.name.toLowerCase().includes('education')
    );

    if (schoolIndicators.length > 0) {
      const totalSchools = schoolIndicators.reduce((sum, ind) => sum + ind.value, 0);

      // Baseline municipal facility benchmark for average BMC ward (~12k population)
      let score = 2;
      if (totalSchools === 0) score = 14;
      else if (totalSchools === 1) score = 9;
      else if (totalSchools === 2) score = 5;
      else score = 2;

      return {
        metric: 'infrastructure_deficit_score',
        score,
        max_score: METRIC_BOUNDS.INFRASTRUCTURE_DEFICIT_MAX,
        raw_inputs: { category: cluster.category, school_facilities_count: totalSchools },
        formula: 'Facility availability benchmark: 0 schools -> 14, 1 school -> 9, 2 schools -> 5, 3+ -> 2',
        explanation: totalSchools === 0
          ? 'Zero registered educational facilities (schools) present in cluster ward(s); high contextual infrastructure deficit.'
          : `${totalSchools} educational facility(ies) enumerated in ward(s); contextual infrastructure deficit evaluated at ${score}/15.`,
        data_available: true,
        provenance: {
          is_demo: isDemo,
          source: schoolIndicators[0]?.source || 'BhubaneswarOne GIS OPEPA DISE',
          measurement_context: `School facility enumeration: ${totalSchools} facility(ies)`
        }
      };
    }
  }

  // B. Healthcare accessibility sector
  if (
    categoryLower === 'healthcare_accessibility' ||
    categoryLower.includes('health') ||
    categoryLower.includes('hospital')
  ) {
    const healthIndicators = indicators.filter(
      (ind) =>
        ind.id.includes('hospital') ||
        ind.name.toLowerCase().includes('hospital') ||
        ind.name.toLowerCase().includes('health')
    );

    if (healthIndicators.length > 0) {
      const totalHospitals = healthIndicators.reduce((sum, ind) => sum + ind.value, 0);

      let score = 3;
      if (totalHospitals === 0) score = 14;
      else if (totalHospitals === 1) score = 7;
      else score = 3;

      return {
        metric: 'infrastructure_deficit_score',
        score,
        max_score: METRIC_BOUNDS.INFRASTRUCTURE_DEFICIT_MAX,
        raw_inputs: { category: cluster.category, healthcare_facilities_count: totalHospitals },
        formula: 'Facility availability benchmark: 0 hospitals -> 14, 1 hospital -> 7, 2+ -> 3',
        explanation: totalHospitals === 0
          ? 'Zero registered healthcare facilities (hospitals/clinics) present in cluster ward(s); high contextual infrastructure deficit.'
          : `${totalHospitals} healthcare facility(ies) enumerated in ward(s); contextual infrastructure deficit evaluated at ${score}/15.`,
        data_available: true,
        provenance: {
          is_demo: isDemo,
          source: healthIndicators[0]?.source || 'BhubaneswarOne GIS Health Facilities',
          measurement_context: `Healthcare facility enumeration: ${totalHospitals} facility(ies)`
        }
      };
    }
  }

  // C. Supported infrastructure indicators: operational problems load
  const opsIndicators = indicators.filter(
    (ind) =>
      ind.indicator_type === 'OPERATIONAL_PROBLEM_COUNT' ||
      ind.type === 'OPERATIONAL_PROBLEM_COUNT' ||
      ind.id.includes('ind_ops_problems')
  );

  if (opsIndicators.length > 0) {
    const totalOpsProblems = opsIndicators.reduce((sum, ind) => sum + ind.value, 0);
    if (totalOpsProblems > 0) {
      const raw = METRIC_BOUNDS.INFRASTRUCTURE_DEFICIT_MAX * (Math.log(1 + totalOpsProblems) / Math.log(1 + 10));
      const score = Math.max(1, Math.min(METRIC_BOUNDS.INFRASTRUCTURE_DEFICIT_MAX, Math.round(raw)));

      return {
        metric: 'infrastructure_deficit_score',
        score,
        max_score: METRIC_BOUNDS.INFRASTRUCTURE_DEFICIT_MAX,
        raw_inputs: {
          category: cluster.category,
          operational_problems_count: totalOpsProblems
        },
        formula: 'min(15, round(15 * ln(1 + ops_problems) / ln(11)))',
        explanation: `${totalOpsProblems} active operational problem cluster(s) registered in ward, indicating infrastructure operational strain.`,
        data_available: true,
        provenance: {
          is_demo: isDemo,
          source: 'CIVICPULSE_OPERATIONAL_DB',
          measurement_context: `Operational problem aggregate: ${totalOpsProblems} problem(s)`
        }
      };
    }
  }

  // D. Unsupported sector without authoritative indicator context
  return {
    metric: 'infrastructure_deficit_score',
    score: 0,
    max_score: METRIC_BOUNDS.INFRASTRUCTURE_DEFICIT_MAX,
    raw_inputs: { category: cluster.category, indicators_count: indicators.length },
    formula: 'Neutral baseline for unsupported indicator sectors',
    explanation: `No authoritative infrastructure reference indicators available in repository for sector '${cluster.category}'. Explicit neutral deficit score of 0 applied without fabrication.`,
    data_available: false,
    provenance: {
      is_demo: isDemo,
      source: 'NO_AUTHORITATIVE_INDICATOR',
      measurement_context: 'Missing verified infrastructure dataset'
    }
  };
}

// ============================================================================
// 6. INVESTMENT GAP SCORE (0–10)
// ============================================================================

function calculateInvestmentGapScore(
  investments: PublicInvestmentRecord[],
  cluster: DemandCluster,
  isDemo: boolean
): MetricComponentDetail {
  // Case A: No verified investment records available in repository
  if (!investments || investments.length === 0) {
    return {
      metric: 'investment_gap_score',
      score: 0,
      max_score: METRIC_BOUNDS.INVESTMENT_GAP_MAX,
      raw_inputs: { verified_records_count: 0, cluster_category: cluster.category, cluster_wards: cluster.ward_ids },
      formula: 'Neutral baseline when no verified investment data exists',
      explanation: 'No verified public investment context available in repository. Gap cannot be confirmed from authoritative sources; scored as 0 to avoid manufacturing an unverified gap.',
      data_available: false,
      provenance: {
        is_demo: isDemo,
        source: 'CIVICPULSE_PUBLIC_INVESTMENT',
        measurement_context: 'No verified investment records found'
      }
    };
  }

  // Case B: Verified investment records exist. Evaluate ward and category overlap.
  const clusterWards = new Set(cluster.ward_ids || []);
  const clusterCat = cluster.category.toLowerCase().trim();

  const matchingCategoryAndWard = investments.filter((inv) => {
    const invCat = inv.category.toLowerCase().trim();
    const hasWardOverlap = inv.ward_ids.some((w) => clusterWards.has(w));
    return invCat === clusterCat && hasWardOverlap;
  });

  const matchingCategoryOnly = investments.filter(
    (inv) => inv.category.toLowerCase().trim() === clusterCat
  );

  const matchingWardOnly = investments.filter((inv) =>
    inv.ward_ids.some((w) => clusterWards.has(w))
  );

  // Subcase B1: Matching category AND ward -> investment is already planned or active
  if (matchingCategoryAndWard.length > 0) {
    const primary = matchingCategoryAndWard[0]!;
    let score = 2;

    if (
      primary.status === PublicInvestmentStatus.IN_PROGRESS ||
      primary.status === PublicInvestmentStatus.APPROVED
    ) {
      score = 2; // Actively funded / underway
    } else if (primary.status === PublicInvestmentStatus.PROPOSED) {
      score = 4; // Proposed but not yet sanctioned
    } else if (primary.status === PublicInvestmentStatus.COMPLETED) {
      score = 5; // Completed, but demand persists
    }

    return {
      metric: 'investment_gap_score',
      score,
      max_score: METRIC_BOUNDS.INVESTMENT_GAP_MAX,
      raw_inputs: {
        matching_investments_count: matchingCategoryAndWard.length,
        primary_project_id: primary.project_id,
        primary_status: primary.status,
        documented_budget: primary.documented_budget
      },
      formula: 'Verified project active in ward/sector: IN_PROGRESS/APPROVED -> 2, PROPOSED -> 4, COMPLETED -> 5',
      explanation: `Verified public investment project '${primary.plan_name}' (${primary.status}, ₹${primary.documented_budget.toLocaleString()}) is already documented for this sector in the ward. Residual investment gap is low (${score}/10).`,
      data_available: true,
      provenance: primary.provenance || {
        is_demo: isDemo,
        source: primary.source_agency || 'PUBLIC_INVESTMENT_RECORD',
        measurement_context: primary.plan_name
      }
    };
  }

  // Subcase B2: Department is investing in the sector, but other wards received the funds
  if (matchingCategoryOnly.length > 0) {
    const score = 7;
    return {
      metric: 'investment_gap_score',
      score,
      max_score: METRIC_BOUNDS.INVESTMENT_GAP_MAX,
      raw_inputs: {
        category_investments_elsewhere: matchingCategoryOnly.length,
        cluster_category: cluster.category
      },
      formula: 'Sector-wide municipal investment confirmed, but cluster ward(s) omitted -> 7',
      explanation: `Verified public investments exist for '${cluster.category}' across the municipality, but zero projects are documented for cluster ward(s). Confirmed spatial allocation gap.`,
      data_available: true,
      provenance: {
        is_demo: isDemo,
        source: matchingCategoryOnly[0]?.source_agency || 'PUBLIC_INVESTMENT_RECORD',
        measurement_context: 'Spatial allocation omission in sector'
      }
    };
  }

  // Subcase B3: Ward receives investments, but zero in this sector
  if (matchingWardOnly.length > 0) {
    const score = 9;
    return {
      metric: 'investment_gap_score',
      score,
      max_score: METRIC_BOUNDS.INVESTMENT_GAP_MAX,
      raw_inputs: {
        ward_other_investments: matchingWardOnly.length,
        cluster_category: cluster.category
      },
      formula: 'Ward receives funding in other sectors, but zero in cluster sector -> 9',
      explanation: `Verified capital expenditure documented in ward for other sectors, but zero public investment allocated for '${cluster.category}'. Confirmed sectoral investment gap.`,
      data_available: true,
      provenance: {
        is_demo: isDemo,
        source: matchingWardOnly[0]?.source_agency || 'PUBLIC_INVESTMENT_RECORD',
        measurement_context: 'Confirmed sectoral omission in ward'
      }
    };
  }

  // Subcase B4: Municipal investment dataset present, but neither ward nor sector funded
  const score = 10;
  return {
    metric: 'investment_gap_score',
    score,
    max_score: METRIC_BOUNDS.INVESTMENT_GAP_MAX,
    raw_inputs: {
      total_verified_records: investments.length,
      cluster_category: cluster.category,
      cluster_wards: cluster.ward_ids
    },
    formula: 'No verified municipal investment in ward or sector -> 10',
    explanation: `Authoritative investment project records confirmed in municipality, but zero funding documented for '${cluster.category}' in cluster ward(s). Maximum investment gap.`,
    data_available: true,
    provenance: {
      is_demo: isDemo,
      source: 'CIVICPULSE_PUBLIC_INVESTMENT',
      measurement_context: 'Confirmed total investment omission'
    }
  };
}

// ============================================================================
// MAIN SERVICE EXPORTS
// ============================================================================

/**
 * Calculates complete deterministic demand metrics with component details, formulas,
 * explanations, and provenance metadata.
 */
export async function calculateDemandMetricsWithDetails(
  cluster: DemandCluster,
  signals: (NormalizedDemandSignal | DemandSignal)[],
  indicators: DevelopmentIndicator[],
  investments: PublicInvestmentRecord[],
  options?: DemandMetricsOptions
): Promise<DetailedDemandMetricsResult> {
  // Determine REAL_MODE vs DEMO_MODE isolation
  const isDemo = options?.isDemo ?? (cluster.is_demo || env.DEMO_MODE);

  // REAL_MODE Filtering: Strictly exclude demo data when isDemo is false
  const validSignals = isDemo ? signals : signals.filter((s) => !s.is_demo);
  const validIndicators = isDemo ? indicators : indicators.filter((ind) => !ind.is_demo && !ind.provenance?.is_demo);
  const validInvestments = isDemo ? investments : investments.filter((inv) => !inv.is_demo && !inv.provenance?.is_demo);

  // 1. Demand Volume (0–25)
  const volumeDetail = calculateVolumeScore(validSignals, cluster, isDemo);

  // 2. Recurrence (0–20)
  const recurrenceDetail = calculateRecurrenceScore(validSignals, cluster, isDemo);

  // 3. Geographic Concentration (0–15)
  const geoDetail = await calculateGeographicConcentrationScore(
    validSignals,
    cluster,
    isDemo,
    options?.geographyProvider
  );

  // 4. Population Exposure (0–15)
  const populationDetail = calculatePopulationExposureScore(validIndicators, cluster, isDemo);

  // 5. Infrastructure Deficit (0–15)
  const infraDetail = calculateInfrastructureDeficitScore(validIndicators, cluster, isDemo);

  // 6. Investment Gap (0–10)
  const investmentDetail = calculateInvestmentGapScore(validInvestments, cluster, isDemo);

  // Composite Demand Index (0–100) = Exact sum of all six components
  const compositeDemandIndex = Math.max(
    0,
    Math.min(
      METRIC_BOUNDS.COMPOSITE_INDEX_MAX,
      volumeDetail.score +
      recurrenceDetail.score +
      geoDetail.score +
      populationDetail.score +
      infraDetail.score +
      investmentDetail.score
    )
  );

  const metrics: DeterministicDemandMetrics = {
    demand_volume_score: volumeDetail.score,
    recurrence_score: recurrenceDetail.score,
    geographic_concentration_score: geoDetail.score,
    population_exposure_score: populationDetail.score,
    infrastructure_deficit_score: infraDetail.score,
    investment_gap_score: investmentDetail.score,
    composite_demand_index: compositeDemandIndex
  };

  const priorityBand = mapCompositeToPriorityBand(compositeDemandIndex);

  return {
    metrics,
    priority_band: priorityBand,
    components: {
      demand_volume: volumeDetail,
      recurrence: recurrenceDetail,
      geographic_concentration: geoDetail,
      population_exposure: populationDetail,
      infrastructure_deficit: infraDetail,
      investment_gap: investmentDetail
    },
    calculated_at: new Date().toISOString(),
    is_demo: isDemo
  };
}

/**
 * Convenience wrapper returning DeterministicDemandMetrics contract.
 */
export async function calculateDemandMetrics(
  cluster: DemandCluster,
  signals: (NormalizedDemandSignal | DemandSignal)[],
  indicators: DevelopmentIndicator[],
  investments: PublicInvestmentRecord[],
  options?: DemandMetricsOptions
): Promise<DeterministicDemandMetrics> {
  const result = await calculateDemandMetricsWithDetails(
    cluster,
    signals,
    indicators,
    investments,
    options
  );
  return result.metrics;
}
