import {
  ProblemCluster,
  ImpactLevel,
  ProblemStatus,
  SLAState,
  SLARiskStatus
} from '@civicpulse/shared';

export const DETERMINISTIC_SLA_TARGET_HOURS: Record<ImpactLevel, number> = {
  [ImpactLevel.CRITICAL]: 24,
  [ImpactLevel.HIGH]: 48,
  [ImpactLevel.MEDIUM]: 120,
  [ImpactLevel.LOW]: 240
};

export class SLAService {
  /**
   * Deterministically returns the SLA target hours based on severity/impact.
   * Produces exactly one target_hours value with zero ambiguity.
   */
  public static getTargetHours(severityOrImpact: ImpactLevel | string): number {
    const key = (severityOrImpact || 'MEDIUM').toUpperCase() as ImpactLevel;
    return DETERMINISTIC_SLA_TARGET_HOURS[key] ?? 120;
  }

  /**
   * Computes the deterministic SLA state for a problem cluster.
   * Preserves historical breach outcomes (was_breached) even when resolved/closed.
   */
  public static computeSLAState(problem: ProblemCluster, referenceNow?: number): SLAState {
    const targetHours = this.getTargetHours(problem.impact_level || ImpactLevel.MEDIUM);
    const assignedAtTime = problem.assigned_at
      ? new Date(problem.assigned_at).getTime()
      : new Date(problem.created_at).getTime();

    const assignedAtIso = new Date(assignedAtTime).toISOString();
    const dueAtTime = assignedAtTime + targetHours * 3600000;
    const dueAtIso = new Date(dueAtTime).toISOString();

    const now = referenceNow ?? Date.now();
    const isCompleted =
      problem.status === ProblemStatus.RESOLVED || problem.status === ProblemStatus.CLOSED;

    const resolvedTime = problem.resolved_at
      ? new Date(problem.resolved_at).getTime()
      : problem.closed_at
      ? new Date(problem.closed_at).getTime()
      : null;

    // Elapsed hours calculation: if completed, capped at resolution time
    const effectiveEndTime = isCompleted && resolvedTime ? resolvedTime : now;
    const hoursElapsed = Math.max(
      0,
      Math.round(((effectiveEndTime - assignedAtTime) / 3600000) * 10) / 10
    );

    // Remaining hours calculation: relative to due time
    const hoursRemaining = Math.round(((dueAtTime - effectiveEndTime) / 3600000) * 10) / 10;

    // Historical breach determination:
    // If deadline was exceeded before resolution, retain was_breached = true.
    const historicallyBreached =
      problem.sla_state?.was_breached === true ||
      (isCompleted && resolvedTime !== null && resolvedTime > dueAtTime) ||
      (!isCompleted && now > dueAtTime);

    let status: SLARiskStatus;
    if (isCompleted) {
      status = 'MET';
    } else if (hoursRemaining <= 0) {
      status = 'BREACHED';
    } else if (hoursRemaining <= 0.25 * targetHours) {
      status = 'AT_RISK';
    } else {
      status = 'ON_TRACK';
    }

    return {
      problem_id: problem.id,
      target_hours: targetHours,
      assigned_at: assignedAtIso,
      due_at: dueAtIso,
      resolved_at: problem.resolved_at,
      hours_elapsed: hoursElapsed,
      hours_remaining: hoursRemaining,
      status,
      is_at_risk: status === 'AT_RISK',
      is_breached: status === 'BREACHED',
      was_breached: historicallyBreached
    };
  }
}
