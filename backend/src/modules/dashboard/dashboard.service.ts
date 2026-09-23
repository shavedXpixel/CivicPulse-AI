import {
  UserProfile,
  UserRole,
  ProblemCluster,
  ProblemStatus,
  ImpactLevel
} from '@civicpulse/shared';
import { getDatabaseProvider } from '../../providers';
import { SLAService } from '../workflow/sla.service';
import { env } from '../../config/env';

export interface DashboardSummary {
  total_signals: number;
  active_problems: number;
  critical_problems: number;
  resolved_problems: number;
  sla_on_track_count: number;
  sla_at_risk_count: number;
  sla_breached_count: number;
  sla_compliance_rate: number;
  median_resolution_time_hours?: number | null;
  department_id?: string;
  scope_description: string;
}

export class DashboardService {
  /**
   * Retrieves high-level operational KPIs scoped to the authenticated caller.
   */
  public static async getSummary(user: UserProfile): Promise<DashboardSummary> {
    const db = getDatabaseProvider();
    const isDemoFilter = env.DEMO_MODE ? undefined : false;
    const problemListResult = await db.listProblemClusters({
      limit: 500,
      is_demo: isDemoFilter
    });
    const allProblems = isDemoFilter !== undefined
      ? problemListResult.data.filter((p) => (p.is_demo || false) === isDemoFilter)
      : problemListResult.data;

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
    const resolutionDurationsHours: number[] = [];

    for (const p of scopedProblems) {
      const isResolved = p.status === ProblemStatus.RESOLVED || p.status === ProblemStatus.CLOSED;
      if (isResolved) {
        resolvedCount++;
        const resolvedTimestamp = p.resolved_at || p.closed_at || p.updated_at;
        if (resolvedTimestamp && p.created_at) {
          const durationMs = new Date(resolvedTimestamp).getTime() - new Date(p.created_at).getTime();
          if (durationMs > 0) {
            resolutionDurationsHours.push(durationMs / (1000 * 60 * 60));
          }
        }
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

    let medianResolutionTimeHours: number | null = null;
    if (resolutionDurationsHours.length > 0) {
      resolutionDurationsHours.sort((a, b) => a - b);
      const mid = Math.floor(resolutionDurationsHours.length / 2);
      medianResolutionTimeHours =
        resolutionDurationsHours.length % 2 !== 0
          ? Math.round(resolutionDurationsHours[mid]! * 10) / 10
          : Math.round(((resolutionDurationsHours[mid - 1]! + resolutionDurationsHours[mid]!) / 2) * 10) / 10;
    }

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
      median_resolution_time_hours: medianResolutionTimeHours,
      department_id: user.department_id,
      scope_description: scopeDesc
    };
  }

  /**
   * Retrieves priority ranked problems scoped to caller with live SLA calculation.
   */
  public static async getPriorityProblems(user: UserProfile, limit: number = 20): Promise<ProblemCluster[]> {
    const db = getDatabaseProvider();
    const isDemoFilter = env.DEMO_MODE ? undefined : false;
    const filter: { department_id?: string; limit: number; is_demo?: boolean } = {
      limit: 100,
      is_demo: isDemoFilter
    };

    if (user.role === UserRole.DEPARTMENT_OFFICER && user.department_id) {
      filter.department_id = user.department_id;
    }

    const result = await db.listProblemClusters(filter);
    let problems = isDemoFilter !== undefined
      ? result.data.filter((p) => (p.is_demo || false) === isDemoFilter)
      : result.data;

    if (user.role === UserRole.FIELD_OFFICER) {
      problems = problems.filter((p) => p.assigned_to === user.id);
    }

    return problems.slice(0, limit).map((p) => ({
      ...p,
      sla_state: SLAService.computeSLAState(p)
    }));
  }

  /**
   * Returns geo-located problems for map rendering scoped to caller with RBAC enforcement.
   */
  public static async getMapData(
    user: UserProfile,
    filters?: {
      department_id?: string;
      status?: string;
      severity?: string;
      impact_level?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ProblemCluster[]> {
    const db = getDatabaseProvider();
    const isDemoFilter = env.DEMO_MODE ? undefined : false;
    const result = await db.listProblemClusters({
      limit: 100,
      is_demo: isDemoFilter
    });
    let problems = isDemoFilter !== undefined
      ? result.data.filter((p) => (p.is_demo || false) === isDemoFilter)
      : result.data;

    // 1. Strict Server-Side RBAC Enforcement
    if (user.role === UserRole.CITIZEN) {
      // Citizens only see problem locations linked to their own reports
      const citizenSignals = await db.listSignals({ citizen_id: user.id, limit: 100 });
      const problemIds = new Set(
        citizenSignals.data
          .map((s) => s.problem_cluster_id)
          .filter((id): id is string => Boolean(id))
      );

      let citizenProblems = problems.filter((p) => problemIds.has(p.id));

      // If signals are not yet attached to clusters, surface signal locations as standalone points
      if (citizenProblems.length === 0 && citizenSignals.data.length > 0) {
        citizenProblems = citizenSignals.data
          .filter((s) => s.location && typeof s.location.lat === 'number' && typeof s.location.lng === 'number')
          .map((s) => ({
            id: s.id,
            title: s.original_text ? s.original_text.slice(0, 80) : 'Citizen Report',
            category: s.category || 'MUNICIPAL',
            department_id: s.recommended_department,
            ward_id: s.ward_id,
            location: s.location,
            status: ProblemStatus.NEW,
            signal_count: 1,
            impact_score: 50,
            impact_level: ImpactLevel.MEDIUM,
            severity_score: 10,
            population_score: 10,
            duration_score: 10,
            concentration_score: 10,
            critical_exposure_score: 5,
            recurrence_score: 5,
            evidence_score: 0,
            first_detected_at: s.created_at,
            last_updated_at: s.updated_at,
            created_at: s.created_at
          } as ProblemCluster));
      }

      problems = citizenProblems;
    } else if (user.role === UserRole.FIELD_OFFICER) {
      // Field officers only receive assigned problem locations
      problems = problems.filter((p) => p.assigned_to === user.id);
    } else if (user.role === UserRole.DEPARTMENT_OFFICER) {
      // Department officers strictly receive their own department locations
      // Query manipulation attempt to override department is ignored
      if (!user.department_id) {
        return [];
      }
      problems = problems.filter((p) => p.department_id === user.department_id);
    } else if ((user.role === UserRole.ADMIN || user.role === UserRole.SYSTEM_ADMIN) && filters?.department_id) {
      // Admins may optionally filter by department
      problems = problems.filter((p) => p.department_id === filters.department_id);
    }

    // 2. Real Filter Application
    if (filters?.status) {
      problems = problems.filter((p) => p.status === filters.status);
    }

    const targetSeverity = filters?.impact_level || filters?.severity;
    if (targetSeverity) {
      problems = problems.filter((p) => p.impact_level === targetSeverity);
    }

    if (filters?.startDate) {
      const startMs = new Date(filters.startDate).getTime();
      if (!isNaN(startMs)) {
        problems = problems.filter((p) => new Date(p.created_at).getTime() >= startMs);
      }
    }

    if (filters?.endDate) {
      const endMs = new Date(filters.endDate).getTime();
      if (!isNaN(endMs)) {
        problems = problems.filter((p) => new Date(p.created_at).getTime() <= endMs);
      }
    }

    // 3. Valid Geographic Coordinates Only (-90..90, -180..180)
    return problems
      .filter(
        (p) =>
          p.location &&
          typeof p.location.lat === 'number' &&
          typeof p.location.lng === 'number' &&
          p.location.lat >= -90 &&
          p.location.lat <= 90 &&
          p.location.lng >= -180 &&
          p.location.lng <= 180
      )
      .map((p) => ({
        ...p,
        sla_state: SLAService.computeSLAState(p)
      }));
  }

  /**
   * Returns problems at risk of SLA breach or already breached, scoped to caller.
   * Sorted with BREACHED first, then AT_RISK, then by impact_score descending.
   */
  public static async getSlaRiskProblems(user: UserProfile): Promise<ProblemCluster[]> {
    const problems = await this.getPriorityProblems(user, 100);
    const filtered = problems.filter(
      (p) => p.sla_state?.status === 'AT_RISK' || p.sla_state?.status === 'BREACHED'
    );

    return filtered.sort((a, b) => {
      const statusWeight = (status?: string) => (status === 'BREACHED' ? 2 : status === 'AT_RISK' ? 1 : 0);
      const weightDiff = statusWeight(b.sla_state?.status) - statusWeight(a.sla_state?.status);
      if (weightDiff !== 0) return weightDiff;
      return (b.impact_score || 0) - (a.impact_score || 0);
    });
  }
}
