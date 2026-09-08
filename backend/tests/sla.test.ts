import { describe, it, expect } from 'vitest';
import { SLAService, DETERMINISTIC_SLA_TARGET_HOURS } from '../src/modules/workflow/sla.service';
import { ProblemCluster, ImpactLevel, ProblemStatus } from '@civicpulse/shared';

describe('SLAService — Deterministic SLA Computation', () => {
  const baseProblem: ProblemCluster = {
    id: 'PRB-SLA-TEST',
    title: 'SLA Verification Cluster',
    category: 'water_supply',
    status: ProblemStatus.ASSIGNED,
    signal_count: 10,
    severity_score: 24,
    population_score: 18,
    duration_score: 14,
    concentration_score: 14,
    critical_exposure_score: 9,
    recurrence_score: 8,
    evidence_score: 5,
    impact_score: 92,
    impact_level: ImpactLevel.CRITICAL,
    first_detected_at: '2026-09-01T00:00:00Z',
    last_updated_at: '2026-09-01T00:00:00Z',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    assigned_at: '2026-09-01T00:00:00Z'
  };

  it('1. Target hours are strictly deterministic with no ranges and zero ambiguity', () => {
    expect(SLAService.getTargetHours(ImpactLevel.CRITICAL)).toBe(24);
    expect(SLAService.getTargetHours(ImpactLevel.HIGH)).toBe(48);
    expect(SLAService.getTargetHours(ImpactLevel.MEDIUM)).toBe(120);
    expect(SLAService.getTargetHours(ImpactLevel.LOW)).toBe(240);

    expect(DETERMINISTIC_SLA_TARGET_HOURS[ImpactLevel.CRITICAL]).toBe(24);
    expect(DETERMINISTIC_SLA_TARGET_HOURS[ImpactLevel.HIGH]).toBe(48);
    expect(DETERMINISTIC_SLA_TARGET_HOURS[ImpactLevel.MEDIUM]).toBe(120);
    expect(DETERMINISTIC_SLA_TARGET_HOURS[ImpactLevel.LOW]).toBe(240);
  });

  it('2. Correctly calculates due_at and ON_TRACK status early in lifecycle', () => {
    const assignedAt = new Date('2026-09-01T00:00:00Z').getTime();
    const problem = { ...baseProblem, assigned_at: new Date(assignedAt).toISOString() };

    // 4 hours elapsed out of 24h: 20h remaining (> 6h = 25% of 24h) => ON_TRACK
    const now = assignedAt + 4 * 3600000;
    const sla = SLAService.computeSLAState(problem, now);

    expect(sla.target_hours).toBe(24);
    expect(sla.hours_elapsed).toBe(4);
    expect(sla.hours_remaining).toBe(20);
    expect(sla.status).toBe('ON_TRACK');
    expect(sla.is_at_risk).toBe(false);
    expect(sla.is_breached).toBe(false);
    expect(sla.was_breached).toBe(false);
    expect(new Date(sla.due_at).getTime()).toBe(assignedAt + 24 * 3600000);
  });

  it('3. Classifies as AT_RISK when remaining time is <= 25% of target hours', () => {
    const assignedAt = new Date('2026-09-01T00:00:00Z').getTime();
    const problem = { ...baseProblem, assigned_at: new Date(assignedAt).toISOString() };

    // 20 hours elapsed out of 24h: 4h remaining (<= 6h = 25% of 24h) => AT_RISK
    const now = assignedAt + 20 * 3600000;
    const sla = SLAService.computeSLAState(problem, now);

    expect(sla.hours_elapsed).toBe(20);
    expect(sla.hours_remaining).toBe(4);
    expect(sla.status).toBe('AT_RISK');
    expect(sla.is_at_risk).toBe(true);
    expect(sla.is_breached).toBe(false);
    expect(sla.was_breached).toBe(false);
  });

  it('4. Classifies as BREACHED when remaining time is <= 0', () => {
    const assignedAt = new Date('2026-09-01T00:00:00Z').getTime();
    const problem = { ...baseProblem, assigned_at: new Date(assignedAt).toISOString() };

    // 26 hours elapsed out of 24h: -2h remaining => BREACHED
    const now = assignedAt + 26 * 3600000;
    const sla = SLAService.computeSLAState(problem, now);

    expect(sla.hours_elapsed).toBe(26);
    expect(sla.hours_remaining).toBe(-2);
    expect(sla.status).toBe('BREACHED');
    expect(sla.is_at_risk).toBe(false);
    expect(sla.is_breached).toBe(true);
    expect(sla.was_breached).toBe(true);
  });

  it('5. User Guardrail: Problem resolved within deadline is MET with was_breached = false', () => {
    const assignedAt = new Date('2026-09-01T00:00:00Z').getTime();
    const resolvedAt = new Date(assignedAt + 18 * 3600000).toISOString(); // 18h elapsed <= 24h target

    const problem: ProblemCluster = {
      ...baseProblem,
      assigned_at: new Date(assignedAt).toISOString(),
      status: ProblemStatus.RESOLVED,
      resolved_at: resolvedAt
    };

    const sla = SLAService.computeSLAState(problem);

    expect(sla.status).toBe('MET');
    expect(sla.is_breached).toBe(false);
    expect(sla.was_breached).toBe(false); // Clean on-time resolution
    expect(sla.hours_elapsed).toBe(18);
  });

  it('6. User Guardrail: Problem resolved AFTER breach deadline preserves was_breached = true', () => {
    const assignedAt = new Date('2026-09-01T00:00:00Z').getTime();
    const resolvedAt = new Date(assignedAt + 30 * 3600000).toISOString(); // 30h elapsed > 24h target

    const problem: ProblemCluster = {
      ...baseProblem,
      assigned_at: new Date(assignedAt).toISOString(),
      status: ProblemStatus.RESOLVED,
      resolved_at: resolvedAt
    };

    const sla = SLAService.computeSLAState(problem);

    expect(sla.status).toBe('MET'); // Current operational state is completed/MET
    expect(sla.is_breached).toBe(false); // Not currently active breached
    expect(sla.was_breached).toBe(true); // Historical audit indicator retained!
    expect(sla.hours_elapsed).toBe(30);
  });
});
