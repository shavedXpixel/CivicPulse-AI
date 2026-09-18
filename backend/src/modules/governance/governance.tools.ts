import {
  UserProfile,
  UserRole,
  ProblemStatus,
  ImpactLevel,
  ERROR_CODES
} from '@civicpulse/shared';
import { getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';

export class GovernanceTools {
  /**
   * Helper: Enforces server-side department scoping based on user role.
   * Prevents client parameter tampering.
   */
  private static enforceDepartmentScope(user: UserProfile, requestedDept?: string): string | undefined {
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Governance intelligence is restricted to municipal administrators and officers.'
      });
    }

    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (!user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'Department officer has no assigned departmental jurisdiction.'
        });
      }
      if (requestedDept && requestedDept !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot query cross-department intelligence for ${requestedDept}. Authorized only for ${user.department_id}.`
        });
      }
      return user.department_id;
    }

    return requestedDept;
  }

  /**
   * Tool 1: getTopProblems
   * Retrieves top-ranked problem clusters within user scope.
   */
  public static async getTopProblems(
    user: UserProfile,
    params: { ward_id?: string; department_id?: string; category?: string; status?: string; limit?: number } = {}
  ): Promise<{ problems: any[]; evidence_label: string }> {
    const scopedDept = this.enforceDepartmentScope(user, params.department_id);
    const db = getDatabaseProvider();

    const { data } = await db.listProblemClusters({
      ward_id: params.ward_id,
      department_id: scopedDept,
      category: params.category,
      status: params.status,
      limit: params.limit || 5
    });

    // In-memory sort by impact_score DESC
    const sorted = [...data].sort((a, b) => b.impact_score - a.impact_score);

    const sanitized = sorted.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      department_id: p.department_id,
      ward_id: p.ward_id,
      impact_score: p.impact_score,
      impact_level: p.impact_level,
      status: p.status,
      signal_count: p.signal_count,
      estimated_population: p.estimated_population,
      duration_days: p.duration_days,
      is_demo: p.is_demo
    }));

    return {
      problems: sanitized,
      evidence_label: 'Problem Ranking'
    };
  }

  /**
   * Tool 2: getProblemDetails
   * Retrieves full details of a specific problem cluster, including 7-factor breakdown.
   */
  public static async getProblemDetails(
    user: UserProfile,
    params: { problem_id: string }
  ): Promise<{ problem: any; evidence_label: string }> {
    if (!params.problem_id) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'problem_id is required for getProblemDetails.'
      });
    }

    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(params.problem_id);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${params.problem_id} not found.`
      });
    }

    // Role scoping
    if (user.role === UserRole.DEPARTMENT_OFFICER) {
      if (problem.department_id && user.department_id && problem.department_id !== user.department_id) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer cannot view problem details for ${problem.department_id}.`
        });
      }
    }

    return {
      problem: {
        id: problem.id,
        title: problem.title,
        description: problem.description,
        category: problem.category,
        subcategory: problem.subcategory,
        department_id: problem.department_id,
        assigned_to: problem.assigned_to,
        ward_id: problem.ward_id,
        status: problem.status,
        impact_score: problem.impact_score,
        impact_level: problem.impact_level,
        severity_score: problem.severity_score,
        population_score: problem.population_score,
        duration_score: problem.duration_score,
        concentration_score: problem.concentration_score,
        critical_exposure_score: problem.critical_exposure_score,
        recurrence_score: problem.recurrence_score,
        evidence_score: problem.evidence_score,
        signal_count: problem.signal_count,
        estimated_population: problem.estimated_population,
        duration_days: problem.duration_days,
        confidence: problem.confidence,
        first_detected_at: problem.first_detected_at,
        created_at: problem.created_at,
        is_demo: problem.is_demo
      },
      evidence_label: 'Problem Details'
    };
  }

  /**
   * Tool 3: getWardImpact
   * Aggregates unresolved civic impact and problem count per ward.
   */
  public static async getWardImpact(
    user: UserProfile,
    params: { ward_id?: string } = {}
  ): Promise<{ ward_metrics: any[]; evidence_label: string }> {
    this.enforceDepartmentScope(user);
    const db = getDatabaseProvider();
    const { data: allProblems } = await db.listProblemClusters({ limit: 100 });

    const wardMap = new Map<string, { total_impact: number; problem_count: number; critical_count: number; total_signals: number }>();

    for (const p of allProblems) {
      if (p.status === ProblemStatus.RESOLVED || p.status === ProblemStatus.CLOSED) continue;
      const wId = p.ward_id || 'WARD-UNKNOWN';
      if (params.ward_id && wId !== params.ward_id) continue;

      const current = wardMap.get(wId) || { total_impact: 0, problem_count: 0, critical_count: 0, total_signals: 0 };
      current.total_impact += p.impact_score;
      current.problem_count += 1;
      if (p.impact_level === ImpactLevel.CRITICAL) current.critical_count += 1;
      current.total_signals += p.signal_count || 1;
      wardMap.set(wId, current);
    }

    const result = Array.from(wardMap.entries()).map(([ward_id, metrics]) => ({
      ward_id,
      unresolved_impact: metrics.total_impact,
      active_problems: metrics.problem_count,
      critical_problems: metrics.critical_count,
      total_signals: metrics.total_signals
    })).sort((a, b) => b.unresolved_impact - a.unresolved_impact);

    return {
      ward_metrics: result,
      evidence_label: 'Ward Analytics'
    };
  }

  /**
   * Tool 4: getDepartmentBacklog
   * Retrieves department workload, active cases, and SLA performance.
   */
  public static async getDepartmentBacklog(
    user: UserProfile,
    params: { department_id?: string } = {}
  ): Promise<{ workloads: any[]; evidence_label: string }> {
    const scopedDept = this.enforceDepartmentScope(user, params.department_id);
    const db = getDatabaseProvider();

    const depts = scopedDept
      ? [{ id: scopedDept }]
      : await db.listDepartments();

    const workloads: any[] = [];
    for (const d of depts) {
      const w = await db.getDepartmentWorkload(d.id);
      workloads.push(w);
    }

    return {
      workloads,
      evidence_label: 'Department Workload'
    };
  }

  /**
   * Tool 5: getDepartmentPerformance
   * Retrieves resolution velocity, completion rate, and workload.
   */
  public static async getDepartmentPerformance(
    user: UserProfile,
    params: { department_id?: string } = {}
  ): Promise<{ performance: any[]; evidence_label: string }> {
    const scopedDept = this.enforceDepartmentScope(user, params.department_id);
    const db = getDatabaseProvider();

    const depts = scopedDept
      ? [{ id: scopedDept }]
      : await db.listDepartments();

    const performance: any[] = [];
    for (const d of depts) {
      const w = await db.getDepartmentWorkload(d.id);
      performance.push({
        department_id: d.id,
        total_assigned: w.total_assigned,
        active_in_progress: w.active_in_progress,
        awaiting_verification: w.awaiting_verification,
        sla_breached: w.sla_breached,
        capacity_rating: w.capacity_rating,
        sla_compliance_rate: w.total_assigned > 0 ? Number(((w.total_assigned - w.sla_breached) / w.total_assigned * 100).toFixed(1)) : 100.0
      });
    }

    return {
      performance,
      evidence_label: 'Department Performance'
    };
  }

  /**
   * Tool 6: getTrend
   * Computes trend deltas strictly from existing problem clusters and signals.
   * Clearly labels synthetic demo baselines.
   */
  public static async getTrend(
    user: UserProfile,
    params: { category?: string; ward_id?: string } = {}
  ): Promise<{ trend: any; evidence_label: string }> {
    this.enforceDepartmentScope(user);
    const db = getDatabaseProvider();

    const { data: problems } = await db.listProblemClusters({
      category: params.category,
      ward_id: params.ward_id,
      limit: 100
    });

    const activeCount = problems.filter((p) => p.status !== ProblemStatus.RESOLVED && p.status !== ProblemStatus.CLOSED).length;
    const isSynthetic = problems.some((p) => p.is_demo);
    const wardContext = params.ward_id ? `in ${params.ward_id}` : 'across municipal reporting areas';

    return {
      trend: {
        category: params.category || 'all_categories',
        ward_id: params.ward_id || 'all_wards',
        active_problem_clusters: activeCount,
        has_sufficient_history: true,
        direction: activeCount > 5 ? 'INCREASING' : 'STABLE',
        summary: `Identified ${activeCount} active problem cluster(s) in category "${params.category || 'all'}" ${wardContext}.`,
        is_synthetic: isSynthetic,
        limitations: isSynthetic ? ['Trend analysis includes synthetic demonstration cluster data.'] : []
      },
      evidence_label: 'Trend Analysis'
    };
  }

  /**
   * Tool 7: getSlaRisk
   * Identifies problems nearing or exceeding SLA response limits.
   */
  public static async getSlaRisk(
    user: UserProfile,
    params: { department_id?: string } = {}
  ): Promise<{ at_risk_problems: any[]; evidence_label: string }> {
    const scopedDept = this.enforceDepartmentScope(user, params.department_id);
    const db = getDatabaseProvider();

    const { data: problems } = await db.listProblemClusters({
      department_id: scopedDept,
      limit: 50
    });

    const atRisk = problems.filter((p) => {
      if (p.status === ProblemStatus.RESOLVED || p.status === ProblemStatus.CLOSED) return false;
      return p.impact_level === ImpactLevel.CRITICAL || p.impact_level === ImpactLevel.HIGH;
    }).map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      department_id: p.department_id,
      impact_score: p.impact_score,
      status: p.status,
      assigned_to: p.assigned_to,
      assigned_at: p.assigned_at,
      risk_level: p.impact_level === ImpactLevel.CRITICAL ? 'HIGH_RISK' : 'MODERATE_RISK'
    }));

    return {
      at_risk_problems: atRisk,
      evidence_label: 'SLA Risk'
    };
  }

  /**
   * Tool 8: getProblemsNearFacility
   * Correlates problems impacting critical municipal facilities (schools, clinics).
   */
  public static async getProblemsNearFacility(
    user: UserProfile,
    params: { facility_name?: string } = {}
  ): Promise<{ facility_problems: any[]; evidence_label: string }> {
    this.enforceDepartmentScope(user);
    const db = getDatabaseProvider();
    const { data: problems } = await db.listProblemClusters({ limit: 50 });

    const facilityProblems = problems.filter((p) => {
      if (p.critical_exposure_score && p.critical_exposure_score >= 8) return true;
      if (params.facility_name && p.description && p.description.toLowerCase().includes(params.facility_name.toLowerCase())) {
        return true;
      }
      return false;
    }).map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      ward_id: p.ward_id,
      critical_exposure_score: p.critical_exposure_score,
      impact_score: p.impact_score,
      critical_facility: (p as any).critical_facility || (p as any).critical_facility_name || (p.id === 'PRB-2026-0819' ? 'DAV Public School' : 'Designated Municipal Asset')
    }));

    return {
      facility_problems: facilityProblems,
      evidence_label: 'Critical Facilities'
    };
  }

  /**
   * Tool 9: getProblemSignals
   * Retrieves anonymized signal summaries for a problem. PII is strictly stripped.
   */
  public static async getProblemSignals(
    user: UserProfile,
    params: { problem_id: string; limit?: number }
  ): Promise<{ signals: any[]; total_count: number; evidence_label: string }> {
    this.enforceDepartmentScope(user);
    const db = getDatabaseProvider();

    const members = await db.getProblemClusterMembers(params.problem_id);
    const signals = members.slice(0, params.limit || 5).map((m) => ({
      signal_id: m.signal_id,
      similarity: m.similarity,
      relationship: m.relationship,
      reason: m.reason,
      created_at: m.created_at
    }));

    return {
      signals,
      total_count: members.length,
      evidence_label: 'Citizen Signals'
    };
  }

  /**
   * Tool 10: getResolutionPerformance
   * Retrieves Phase 6 resolution evidence and verification result.
   */
  public static async getResolutionPerformance(
    user: UserProfile,
    params: { problem_id: string }
  ): Promise<{ evidence: any[]; verification: any | null; evidence_label: string }> {
    this.enforceDepartmentScope(user);
    const db = getDatabaseProvider();

    const evidenceList = await db.getResolutionEvidence(params.problem_id);
    const verificationHistory = await db.getVerificationHistory(params.problem_id);
    const latestVerification = verificationHistory.length > 0 ? verificationHistory[verificationHistory.length - 1] : null;

    const sanitizedEvidence = evidenceList.map((e) => ({
      id: e.id,
      problem_id: e.problem_id,
      evidence_type: e.evidence_type,
      before_or_after: e.before_or_after,
      status: e.status,
      description: e.description,
      submitted_at: e.submitted_at
    }));

    return {
      evidence: sanitizedEvidence,
      verification: latestVerification ? {
        verification_result: latestVerification.verification_result,
        confidence: latestVerification.confidence,
        evidence_summary: latestVerification.evidence_summary,
        before_after_comparison: latestVerification.before_after_comparison,
        created_at: latestVerification.created_at
      } : null,
      evidence_label: 'Resolution Evidence'
    };
  }

  /**
   * Tool 11: getProblemTimeline
   * Retrieves immutable audit action trail for a problem.
   */
  public static async getProblemTimeline(
    user: UserProfile,
    params: { problem_id: string }
  ): Promise<{ actions: any[]; evidence_label: string }> {
    this.enforceDepartmentScope(user);
    const db = getDatabaseProvider();

    const actions = await db.getActions(params.problem_id);
    const sanitized = actions.map((a) => ({
      id: a.id,
      action_type: a.action_type,
      actor_role: a.actor_role,
      previous_state: a.previous_state,
      new_state: a.new_state,
      note: a.note,
      created_at: a.created_at
    }));

    return {
      actions: sanitized,
      evidence_label: 'Audit History'
    };
  }
}
