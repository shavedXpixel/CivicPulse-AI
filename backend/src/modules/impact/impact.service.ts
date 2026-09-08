import {
  ImpactComponents,
  ImpactLevel,
  ProblemCluster,
  ProblemClusterMember,
  IMPACT_MAX_SCORES,
  IMPACT_THRESHOLDS
} from '@civicpulse/shared';

export interface CalculatedImpactResult {
  impact_score: number;
  impact_level: ImpactLevel;
  impact_explanation: string;
  components: ImpactComponents;
}

/**
 * Deterministically calculates the canonical 7-factor public-impact score.
 * Formula:
 *  Severity (25%) + Population (20%) + Duration (15%) +
 *  Concentration (15%) + Critical Facility Exposure (10%) +
 *  Recurrence (10%) + Evidence Confidence (5%) = 100%
 */
export function calculateImpact(components: ImpactComponents): CalculatedImpactResult {
  // 1. Clamp each component strictly to its canonical maximum and non-negative minimum
  const severity = Math.max(0, Math.min(IMPACT_MAX_SCORES.SEVERITY, Math.round(components.severity_score || 0)));
  const population = Math.max(0, Math.min(IMPACT_MAX_SCORES.POPULATION, Math.round(components.population_score || 0)));
  const duration = Math.max(0, Math.min(IMPACT_MAX_SCORES.DURATION, Math.round(components.duration_score || 0)));
  const concentration = Math.max(0, Math.min(IMPACT_MAX_SCORES.CONCENTRATION, Math.round(components.concentration_score || 0)));
  const criticalExposure = Math.max(0, Math.min(IMPACT_MAX_SCORES.CRITICAL_FACILITY, Math.round(components.critical_exposure_score || 0)));
  const recurrence = Math.max(0, Math.min(IMPACT_MAX_SCORES.RECURRENCE, Math.round(components.recurrence_score || 0)));
  const evidence = Math.max(0, Math.min(IMPACT_MAX_SCORES.EVIDENCE, Math.round(components.evidence_score || 0)));

  // 2. Deterministic sum
  const rawSum = severity + population + duration + concentration + criticalExposure + recurrence + evidence;
  const impact_score = Math.max(0, Math.min(100, rawSum));

  // 3. Map to canonical ImpactLevel using explicit thresholds
  let impact_level = ImpactLevel.LOW;
  if (impact_score >= IMPACT_THRESHOLDS.CRITICAL_MIN) {
    impact_level = ImpactLevel.CRITICAL;
  } else if (impact_score > IMPACT_THRESHOLDS.MEDIUM_MAX) {
    impact_level = ImpactLevel.HIGH;
  } else if (impact_score > IMPACT_THRESHOLDS.LOW_MAX) {
    impact_level = ImpactLevel.MEDIUM;
  } else {
    impact_level = ImpactLevel.LOW;
  }

  // 4. Deterministic, transparent explanation
  const impact_explanation = `This problem is evaluated at ${impact_level.toLowerCase()} impact (${impact_score}/100) based on Severity (${severity}/${IMPACT_MAX_SCORES.SEVERITY}), Population Affected (${population}/${IMPACT_MAX_SCORES.POPULATION}), Duration (${duration}/${IMPACT_MAX_SCORES.DURATION}), Complaint Concentration (${concentration}/${IMPACT_MAX_SCORES.CONCENTRATION}), Critical Facility Exposure (${criticalExposure}/${IMPACT_MAX_SCORES.CRITICAL_FACILITY}), Recurrence (${recurrence}/${IMPACT_MAX_SCORES.RECURRENCE}), and Evidence Confidence (${evidence}/${IMPACT_MAX_SCORES.EVIDENCE}).`;

  return {
    impact_score,
    impact_level,
    impact_explanation,
    components: {
      severity_score: severity,
      population_score: population,
      duration_score: duration,
      concentration_score: concentration,
      critical_exposure_score: criticalExposure,
      recurrence_score: recurrence,
      evidence_score: evidence
    }
  };
}

/**
 * Derives the seven factor scores strictly from authoritative stored database records.
 * Client-controlled components are never accepted directly.
 */
export function deriveImpactFactors(
  problem: ProblemCluster,
  members: ProblemClusterMember[] = []
): ImpactComponents {
  // If this is a seeded demo cluster, preserve the authoritative baseline factor inputs
  if (problem.is_demo) {
    return {
      severity_score: problem.severity_score !== undefined ? problem.severity_score : 24,
      population_score: problem.population_score !== undefined ? problem.population_score : 18,
      duration_score: problem.duration_score !== undefined ? problem.duration_score : 14,
      concentration_score: problem.concentration_score !== undefined ? problem.concentration_score : 14,
      critical_exposure_score: problem.critical_exposure_score !== undefined ? problem.critical_exposure_score : 9,
      recurrence_score: problem.recurrence_score !== undefined ? problem.recurrence_score : 8,
      evidence_score: problem.evidence_score !== undefined ? problem.evidence_score : 5
    };
  }

  // 1. Severity (0-25)
  let severity_score = problem.severity_score || 12;
  const hasHighSeveritySignal = members.some(m => m.signal?.severity === 'CRITICAL' || m.signal?.severity === 'HIGH');
  if (hasHighSeveritySignal && severity_score < 18) {
    severity_score = 20;
  }

  // 2. Population Affected (0-20)
  let population_score = problem.population_score || 8;
  const pop = problem.estimated_population || 0;
  if (pop >= 15000) population_score = 18;
  else if (pop >= 5000) population_score = 14;
  else if (pop >= 1000) population_score = 10;
  else if (pop > 0) population_score = 6;

  // 3. Duration (0-15)
  let duration_score = problem.duration_score || 5;
  const days = problem.duration_days || 0;
  if (days >= 5) duration_score = 15;
  else if (days >= 3) duration_score = 14;
  else if (days >= 2) duration_score = 10;
  else if (days >= 1) duration_score = 7;

  // 4. Complaint Concentration (0-15)
  let concentration_score = problem.concentration_score || 5;
  const count = Math.max(problem.signal_count || 0, members.length);
  if (count >= 50) concentration_score = 15;
  else if (count >= 20) concentration_score = 12;
  else if (count >= 5) concentration_score = 9;
  else if (count >= 2) concentration_score = 6;
  else concentration_score = 3;

  // 5. Critical Facility Exposure (0-10)
  let critical_exposure_score = problem.critical_exposure_score || 0;
  const hasCriticalFacility = members.some(m => Boolean(m.signal?.critical_facility));
  if (hasCriticalFacility && critical_exposure_score < 8) {
    critical_exposure_score = 9;
  }

  // 6. Recurrence (0-10)
  const recurrence_score = problem.recurrence_score !== undefined ? problem.recurrence_score : 5;

  // 7. Evidence Confidence (0-5)
  let evidence_score = problem.evidence_score !== undefined ? problem.evidence_score : 2;
  const hasMedia = members.some(m => (m.signal?.media_ids && m.signal.media_ids.length > 0) || (problem.supporting_media_count && problem.supporting_media_count > 0));
  if (hasMedia) {
    evidence_score = Math.max(evidence_score, 4);
  }

  return {
    severity_score,
    population_score,
    duration_score,
    concentration_score,
    critical_exposure_score,
    recurrence_score,
    evidence_score
  };
}

export class ImpactService {
  public calculate(components: ImpactComponents): CalculatedImpactResult {
    return calculateImpact(components);
  }

  public derive(problem: ProblemCluster, members: ProblemClusterMember[] = []): ImpactComponents {
    return deriveImpactFactors(problem, members);
  }

  public async deriveProvenance(problem: ProblemCluster): Promise<import('@civicpulse/shared').DataProvenance> {
    return deriveProblemProvenance(problem);
  }
}

/**
 * Attaches data provenance for problem enrichment (geography, population, facilities).
 * Preserves existing mathematical scoring models unchanged.
 */
export async function deriveProblemProvenance(
  problem: ProblemCluster
): Promise<import('@civicpulse/shared').DataProvenance> {
  if (problem.is_demo) {
    return {
      geography: 'SYNTHETIC',
      population: 'SYNTHETIC',
      facility: 'SYNTHETIC',
      notes: 'Demo Mode baseline data (SYNTHETIC)'
    };
  }

  const { getGeographyProvider, getPopulationProvider, getFacilityProvider } = await import(
    '../../providers'
  );

  let geoProvenance: import('@civicpulse/shared').ProvenanceSource = 'UNKNOWN';
  let popProvenance: import('@civicpulse/shared').ProvenanceSource = 'UNKNOWN';
  let facProvenance: import('@civicpulse/shared').ProvenanceSource = 'UNKNOWN';

  // 1. Geography check
  if (problem.location) {
    const geo = getGeographyProvider();
    const ward = await geo.getWardByCoordinates(problem.location.lat, problem.location.lng);
    if (ward) {
      geoProvenance = ward.provenance;
    }
  } else if (problem.ward_id) {
    const geo = getGeographyProvider();
    const ward = await geo.getWardById(problem.ward_id);
    if (ward) {
      geoProvenance = ward.provenance;
    }
  }

  // 2. Population check
  if (problem.ward_id) {
    const popProv = getPopulationProvider();
    const pop = await popProv.getWardPopulation(problem.ward_id);
    if (pop) {
      popProvenance = pop.provenance;
    }
  }

  // 3. Facility check
  if (problem.location) {
    const facProv = getFacilityProvider();
    const facilities = await facProv.getNearbyFacilities(problem.location.lat, problem.location.lng, 500);
    if (facilities.length > 0) {
      facProvenance = facilities[0]!.provenance;
    }
  }

  return {
    geography: geoProvenance,
    population: popProvenance,
    facility: facProvenance
  };
}

export const impactService = new ImpactService();
