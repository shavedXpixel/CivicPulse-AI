import {
  UserProfile,
  UserRole,
  ProblemCluster,
  ProblemStatus,
  ImpactLevel
} from '@civicpulse/shared';
import { getDatabaseProvider } from '../../providers';
import { SLAService } from '../workflow/sla.service';

export interface DashboardSummary {
  total_signals: number;
  active_problems: number;
  critical_problems: number;
  resolved_problems: number;
  sla_on_track_count: number;
  sla_at_risk_count: number;
  sla_breached_count: number;
  sla_compliance_rate: number;
  department_id?: string;
  scope_description: string;
}

export class DashboardService {
  /**
   * Retrieves high-level operational KPIs scoped to the authenticated caller.
   */
  public static async getSummary(user: UserProfile): Promise<DashboardSummary> {
    const db = getDatabaseProvider();
    const problemListResult = await db.listProblemClusters({ limit: 500 });
    const allProblems = problemListResult.data;

    // Filter problems according to role scope
    let scopedProblems: ProblemCluster[] = allProblems;
    let scopeDesc = 'Citywide Municipal Overview';

    if (user.role === UserRole.FIELD_OFFICER) {
      scopedProblems = allProblems.filter((p) => p.assigned_to === user.id);
      scopeDesc = `Field Officer Queue (${user.display_name})`;
    } else if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      scopedProblems = allProblems.filter((p) => p.department_id === user.department_id);
      scopeDesc = `${user.department_id} Department Operations`;
    }

    let activeCount = 0;
    let criticalCount = 0;
    let resolvedCount = 0;
    let slaOnTrack = 0;
    let slaAtRisk = 0;
    let slaBreached = 0;
    let totalAssignedSla = 0;

    for (const p of scopedProblems) {
      const isResolved = p.status === ProblemStatus.RESOLVED || p.status === ProblemStatus.CLOSED;
      if (isResolved) {
        resolvedCount++;
      } else {
        activeCount++;
      }

      if (p.impact_level === ImpactLevel.CRITICAL || p.impact_level === ImpactLevel.HIGH) {
        criticalCount++;
      }

      // Compute live SLA state
      const sla = SLAService.computeSLAState(p);
      if (sla.status === 'BREACHED') {
        slaBreached++;
        totalAssignedSla++;
      } else if (sla.status === 'AT_RISK') {
        slaAtRisk++;
        totalAssignedSla++;
      } else if (sla.status === 'ON_TRACK') {
        slaOnTrack++;
        totalAssignedSla++;
      } else if (sla.status === 'MET') {
        totalAssignedSla++;
      }
    }

    const compliantCount = totalAssignedSla - slaBreached;
    const complianceRate = totalAssignedSla > 0 ? Math.round((compliantCount / totalAssignedSla) * 100) : 100;

    // Estimate signals from scoped problems
    const totalSignals = scopedProblems.reduce((sum, p) => sum + (p.signal_count || 1), 0);

    return {
      total_signals: totalSignals,
      active_problems: activeCount,
      critical_problems: criticalCount,
      resolved_problems: resolvedCount,
      sla_on_track_count: slaOnTrack,
      sla_at_risk_count: slaAtRisk,
      sla_breached_count: slaBreached,
      sla_compliance_rate: complianceRate,
      department_id: user.department_id,
      scope_description: scopeDesc
    };
  }

  /**
   * Retrieves priority ranked problems scoped to caller with live SLA calculation.
   */
  public static async getPriorityProblems(user: UserProfile, limit: number = 20): Promise<ProblemCluster[]> {
    const db = getDatabaseProvider();
    const filter: { department_id?: string; limit: number } = { limit: 100 };

    if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      filter.department_id = user.department_id;
    }

    const result = await db.listProblemClusters(filter);
    let problems = result.data;

    if (user.role === UserRole.FIELD_OFFICER) {
      problems = problems.filter((p) => p.assigned_to === user.id);
    }

    return problems.slice(0, limit).map((p) => ({
      ...p,
      sla_state: SLAService.computeSLAState(p)
    }));
  }

  /**
   * Returns geo-located problems for map rendering scoped to caller.
   */
  public static async getMapData(user: UserProfile): Promise<ProblemCluster[]> {
    const db = getDatabaseProvider();
    const result = await db.listProblemClusters({ limit: 100 });
    let problems = result.data;

    if (user.role === UserRole.FIELD_OFFICER) {
      problems = problems.filter((p) => p.assigned_to === user.id);
    } else if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      problems = problems.filter((p) => p.department_id === user.department_id);
    }

    return problems
      .filter((p) => p.location && p.location.lat && p.location.lng)
      .map((p) => ({
        ...p,
        sla_state: SLAService.computeSLAState(p)
      }));
  }

  /**
   * Returns problems at risk of SLA breach or already breached, scoped to caller.
   */
  public static async getSlaRiskProblems(user: UserProfile): Promise<ProblemCluster[]> {
    const problems = await this.getPriorityProblems(user, 100);
    return problems.filter(
      (p) => p.sla_state?.status === 'AT_RISK' || p.sla_state?.status === 'BREACHED'
    );
  }
}
