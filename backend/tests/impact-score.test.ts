import { describe, it, expect } from 'vitest';
import { calculateImpact, deriveImpactFactors } from '../src/modules/impact/impact.service';
import {
  ImpactLevel,
  IMPACT_MAX_SCORES,
  IMPACT_WEIGHTS,
  IMPACT_THRESHOLDS,
  ProblemCluster,
  ProblemStatus
} from '@civicpulse/shared';

describe('Deterministic 7-Factor Impact Scoring Engine (Phase 4)', () => {
  it('verifies canonical weights sum to 100% and max component scores sum to 100', () => {
    const weightSum =
      IMPACT_WEIGHTS.SEVERITY +
      IMPACT_WEIGHTS.POPULATION +
      IMPACT_WEIGHTS.DURATION +
      IMPACT_WEIGHTS.CONCENTRATION +
      IMPACT_WEIGHTS.CRITICAL_FACILITY +
      IMPACT_WEIGHTS.RECURRENCE +
      IMPACT_WEIGHTS.EVIDENCE;
    expect(weightSum).toBeCloseTo(1.0, 4);

    const maxScoreSum =
      IMPACT_MAX_SCORES.SEVERITY +
      IMPACT_MAX_SCORES.POPULATION +
      IMPACT_MAX_SCORES.DURATION +
      IMPACT_MAX_SCORES.CONCENTRATION +
      IMPACT_MAX_SCORES.CRITICAL_FACILITY +
      IMPACT_MAX_SCORES.RECURRENCE +
      IMPACT_MAX_SCORES.EVIDENCE;
    expect(maxScoreSum).toBe(100);
  });

  it('calculates the exact Golden Demo 92/100 score from the seven factors', () => {
    const goldenFactors = {
      severity_score: 24,         // Max 25
      population_score: 18,       // Max 20
      duration_score: 14,         // Max 15
      concentration_score: 14,    // Max 15
      critical_exposure_score: 9, // Max 10
      recurrence_score: 8,        // Max 10
      evidence_score: 5           // Max 5
    };

    const result = calculateImpact(goldenFactors);

    // Explicit arithmetic verification: 24 + 18 + 14 + 14 + 9 + 8 + 5 = 92
    expect(result.impact_score).toBe(92);
    expect(result.impact_level).toBe(ImpactLevel.CRITICAL);
    expect(result.components.severity_score).toBe(24);
    expect(result.components.population_score).toBe(18);
    expect(result.components.duration_score).toBe(14);
    expect(result.components.concentration_score).toBe(14);
    expect(result.components.critical_exposure_score).toBe(9);
    expect(result.components.recurrence_score).toBe(8);
    expect(result.components.evidence_score).toBe(5);

    // Verify transparent explainability text
    expect(result.impact_explanation).toContain('critical impact (92/100)');
    expect(result.impact_explanation).toContain('Severity (24/25)');
    expect(result.impact_explanation).toContain('Population Affected (18/20)');
    expect(result.impact_explanation).toContain('Duration (14/15)');
    expect(result.impact_explanation).toContain('Complaint Concentration (14/15)');
    expect(result.impact_explanation).toContain('Critical Facility Exposure (9/10)');
    expect(result.impact_explanation).toContain('Recurrence (8/10)');
    expect(result.impact_explanation).toContain('Evidence Confidence (5/5)');
  });

  it('maps scores accurately across all four canonical ImpactLevel boundaries', () => {
    // 1. LOW: 0 - 39
    expect(calculateImpact({
      severity_score: 5, population_score: 5, duration_score: 5,
      concentration_score: 5, critical_exposure_score: 5, recurrence_score: 5, evidence_score: 0
    }).impact_level).toBe(ImpactLevel.LOW); // 30

    expect(calculateImpact({
      severity_score: 10, population_score: 9, duration_score: 5,
      concentration_score: 5, critical_exposure_score: 5, recurrence_score: 5, evidence_score: 0
    }).impact_level).toBe(ImpactLevel.LOW); // 39

    // 2. MEDIUM: 40 - 64
    expect(calculateImpact({
      severity_score: 10, population_score: 10, duration_score: 5,
      concentration_score: 5, critical_exposure_score: 5, recurrence_score: 5, evidence_score: 0
    }).impact_level).toBe(ImpactLevel.MEDIUM); // 40

    expect(calculateImpact({
      severity_score: 16, population_score: 14, duration_score: 10,
      concentration_score: 10, critical_exposure_score: 7, recurrence_score: 5, evidence_score: 2
    }).impact_level).toBe(ImpactLevel.MEDIUM); // 64

    // 3. HIGH: 65 - 84
    expect(calculateImpact({
      severity_score: 17, population_score: 14, duration_score: 10,
      concentration_score: 10, critical_exposure_score: 7, recurrence_score: 5, evidence_score: 2
    }).impact_level).toBe(ImpactLevel.HIGH); // 65

    expect(calculateImpact({
      severity_score: 22, population_score: 17, duration_score: 13,
      concentration_score: 13, critical_exposure_score: 8, recurrence_score: 7, evidence_score: 4
    }).impact_level).toBe(ImpactLevel.HIGH); // 84

    // 4. CRITICAL: 85 - 100
    expect(calculateImpact({
      severity_score: 23, population_score: 17, duration_score: 13,
      concentration_score: 13, critical_exposure_score: 8, recurrence_score: 7, evidence_score: 4
    }).impact_level).toBe(ImpactLevel.CRITICAL); // 85

    expect(calculateImpact({
      severity_score: 25, population_score: 20, duration_score: 15,
      concentration_score: 15, critical_exposure_score: 10, recurrence_score: 10, evidence_score: 5
    }).impact_level).toBe(ImpactLevel.CRITICAL); // 100
  });

  it('clamps out-of-bounds component values safely', () => {
    // Excessive values should be clamped to component maxes
    const resultOver = calculateImpact({
      severity_score: 50,       // Max 25
      population_score: 40,     // Max 20
      duration_score: 30,       // Max 15
      concentration_score: 30,  // Max 15
      critical_exposure_score: 20, // Max 10
      recurrence_score: 20,     // Max 10
      evidence_score: 10        // Max 5
    });

    expect(resultOver.impact_score).toBe(100);
    expect(resultOver.components.severity_score).toBe(25);
    expect(resultOver.components.population_score).toBe(20);
    expect(resultOver.components.duration_score).toBe(15);
    expect(resultOver.components.concentration_score).toBe(15);
    expect(resultOver.components.critical_exposure_score).toBe(10);
    expect(resultOver.components.recurrence_score).toBe(10);
    expect(resultOver.components.evidence_score).toBe(5);

    // Negative values should be clamped to 0
    const resultNeg = calculateImpact({
      severity_score: -10,
      population_score: -5,
      duration_score: -2,
      concentration_score: -3,
      critical_exposure_score: -1,
      recurrence_score: -4,
      evidence_score: -5
    });

    expect(resultNeg.impact_score).toBe(0);
    expect(resultNeg.impact_level).toBe(ImpactLevel.LOW);
    expect(resultNeg.components.severity_score).toBe(0);
  });

  it('derives factors strictly from stored records for demo clusters', () => {
    const demoProblem: ProblemCluster = {
      id: 'PRB-2026-0819',
      title: 'Water Supply Disruption — Nayapalli Ward 18',
      category: 'water_supply',
      status: ProblemStatus.IN_PROGRESS,
      signal_count: 327,
      is_demo: true,
      severity_score: 24,
      population_score: 18,
      duration_score: 14,
      concentration_score: 14,
      critical_exposure_score: 9,
      recurrence_score: 8,
      evidence_score: 5,
      impact_score: 92,
      impact_level: ImpactLevel.CRITICAL,
      first_detected_at: '2026-09-04T08:00:00Z',
      last_updated_at: '2026-09-07T00:30:00Z',
      created_at: '2026-09-04T08:00:00Z',
      updated_at: '2026-09-07T00:30:00Z'
    };

    const derived = deriveImpactFactors(demoProblem, []);
    expect(derived.severity_score).toBe(24);
    expect(derived.population_score).toBe(18);
    expect(derived.duration_score).toBe(14);
    expect(derived.concentration_score).toBe(14);
    expect(derived.critical_exposure_score).toBe(9);
    expect(derived.recurrence_score).toBe(8);
    expect(derived.evidence_score).toBe(5);

    const calc = calculateImpact(derived);
    expect(calc.impact_score).toBe(92);
  });
});
