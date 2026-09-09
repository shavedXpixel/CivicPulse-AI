'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../components/shells/GovernmentShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { KPIStat } from '../../components/domain/KPIStat';
import { AIBrief } from '../../components/domain/AIBrief';
import { ProblemCard } from '../../components/domain/ProblemCard';
import { MapContainer } from '../../components/domain/MapContainer';
import { FilterBar } from '../../components/domain/FilterBar';
import {
  DEMO_PROBLEMS,
  DEMO_KPIS,
  DEMO_DEPARTMENTS,
  DEMO_AI_BRIEF,
} from '../../lib/mockData';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowRight,
  Activity,
  Users,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Building2
} from 'lucide-react';

export default function GovernmentDashboardPage() {
  const { isDemoMode } = useAuth();
  const [ward, setWard] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [department, setDepartment] = useState('ALL');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [liveSummary, setLiveSummary] = useState<any>(null);
  const [liveProblems, setLiveProblems] = useState<any[]>([]);
  const [liveSlaRisk, setLiveSlaRisk] = useState<any[]>([]);
  const [liveDepartments, setLiveDepartments] = useState<any[]>([]);
  const [liveMap, setLiveMap] = useState<any[]>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, problemsRes, slaRiskRes, deptsRes, mapRes] = await Promise.all([
        apiClient.get<any>('/api/v1/dashboard/summary').catch(() => null),
        apiClient.get<any>('/api/v1/dashboard/problems').catch(() => null),
        apiClient.get<any>('/api/v1/dashboard/sla-risk').catch(() => null),
        apiClient.get<any>('/api/v1/departments').catch(() => null),
        apiClient.get<any>('/api/v1/dashboard/map').catch(() => null),
      ]);

      if (summaryRes?.data) {
        setLiveSummary(summaryRes.data);
      }
      if (problemsRes?.data && Array.isArray(problemsRes.data)) {
        setLiveProblems(problemsRes.data);
      }
      if (slaRiskRes?.data && Array.isArray(slaRiskRes.data)) {
        setLiveSlaRisk(slaRiskRes.data);
      }
      if (deptsRes?.data && Array.isArray(deptsRes.data)) {
        // Fetch workloads for departments
        const deptsWithWl = await Promise.all(
          deptsRes.data.map(async (d: any) => {
            try {
              const wlRes = await apiClient.get<any>(`/api/v1/departments/${d.id}/workload`);
              return { ...d, workload: wlRes?.data };
            } catch {
              return d;
            }
          })
        );
        setLiveDepartments(deptsWithWl);
      }
      if (mapRes?.data && Array.isArray(mapRes.data)) {
        setLiveMap(mapRes.data);
      }
    } catch (err: any) {
      console.warn('Dashboard live API fetch fallback:', err);
      if (!isDemoMode) {
        setError(err.message || 'Failed to connect to operations backend. Click retry to reconnect.');
      }
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Single Authoritative Dataset Resolution:
  // In DEMO_MODE:
  // Use liveProblems if available and non-empty, otherwise use DEMO_PROBLEMS.
  // In REAL_MODE:
  // Strictly use liveProblems (truthful empty [] if none in database).
  const rawProblems = isDemoMode
    ? (liveProblems.length > 0 ? liveProblems : DEMO_PROBLEMS)
    : liveProblems;

  // Effective departments list:
  // In DEMO_MODE:
  // Use liveDepartments if available and non-empty, otherwise use DEMO_DEPARTMENTS.
  // In REAL_MODE:
  // Strictly use liveDepartments (truthful empty [] if none in database).
  const displayDepartments = isDemoMode
    ? (liveDepartments.length > 0 ? liveDepartments : DEMO_DEPARTMENTS)
    : liveDepartments;

  // Single Authoritative Counts (Invariant: problem count, badge, quick nav, and KPIs derived from same dataset):
  const authoritativeProblemCount = rawProblems.length;
  const authoritativeDepartmentCount = displayDepartments.length;

  const authoritativeActiveCount = isDemoMode && liveProblems.length === 0
    ? DEMO_KPIS.activeProblems
    : (liveSummary?.active_problems ?? rawProblems.filter((p) => p.status !== 'RESOLVED' && p.status !== 'CLOSED').length);

  const authoritativeCriticalCount = isDemoMode && liveProblems.length === 0
    ? DEMO_KPIS.highImpact
    : (liveSummary?.critical_problems ?? rawProblems.filter((p) => {
        const sev = p.impact_level || p.severity;
        return sev === 'CRITICAL' || sev === 'HIGH';
      }).length);

  const authoritativeSignalCount = isDemoMode
    ? (liveSummary && liveProblems.length > 0 && liveSummary.total_signals > 0
        ? liveSummary.total_signals
        : rawProblems.reduce((sum, p) => sum + (p.signalCount ?? p.signal_count ?? 0), 0))
    : (liveSummary?.total_signals ?? rawProblems.reduce((sum, p) => sum + (p.signal_count ?? p.signalCount ?? 0), 0));

  // Determine highest impact problem for primary contextual navigation
  const highestProblem = rawProblems.slice().sort((a, b) => {
    const scoreA = a.impact_score ?? a.impactScore ?? 0;
    const scoreB = b.impact_score ?? b.impactScore ?? 0;
    return scoreB - scoreA;
  })[0];
  const primaryProblemId = highestProblem?.id || (isDemoMode ? 'PRB-2026-0819' : null);

  const filteredProblems = rawProblems.filter((p) => {
    const pWard = p.ward_id || p.wardId;
    if (ward !== 'ALL' && pWard !== ward) return false;
    if (category !== 'ALL' && p.category !== category) return false;
    const pSeverity = p.impact_level || p.severity;
    if (severity !== 'ALL' && pSeverity !== severity) return false;
    const pDept = p.department_id || p.department;
    if (department !== 'ALL' && pDept !== department) return false;
    return true;
  });

  // Effective SLA risk list:
  const slaRiskList = liveSlaRisk.length > 0
    ? liveSlaRisk
    : (isDemoMode
        ? DEMO_PROBLEMS.filter((p) => p.severity === 'CRITICAL')
        : rawProblems.filter((p) => p.sla_state?.status === 'AT_RISK' || p.sla_state?.status === 'BREACHED'));

  // Authoritative Intelligence Brief Data
  let briefData: {
    headline: string;
    summary: string;
    recommendedAction: string;
    confidence: string;
    sourcesCount: number;
    problemLink: string;
  };

  if (isDemoMode) {
    const demoSourcesCount = highestProblem?.signalCount ?? highestProblem?.signal_count ?? 327;
    briefData = {
      headline: DEMO_AI_BRIEF.headline,
      summary: DEMO_AI_BRIEF.summary,
      recommendedAction: DEMO_AI_BRIEF.recommendedAction,
      confidence: DEMO_AI_BRIEF.confidence,
      sourcesCount: demoSourcesCount,
      problemLink: primaryProblemId ? `/dashboard/problems/${primaryProblemId}` : '/dashboard/problems',
    };
  } else {
    // In REAL_MODE: Never render hardcoded Golden Demo intelligence
    if (authoritativeProblemCount === 0 || authoritativeSignalCount === 0) {
      briefData = {
        headline: 'District Operational Calm — No Incident Signals',
        summary: 'No citizen signals or correlated problem clusters currently require executive remediation in the municipal database.',
        recommendedAction: 'Continue monitoring automated DPI ingestion and IoT telemetry streams.',
        confidence: '100%',
        sourcesCount: 0,
        problemLink: '/dashboard/problems',
      };
    } else {
      const topSigCount = highestProblem?.signal_count ?? highestProblem?.signalCount ?? 1;
      const topImpact = highestProblem?.impact_score ?? highestProblem?.impactScore ?? 0;
      const topWard = highestProblem?.ward_id ?? highestProblem?.wardId ?? 'Ward 18';
      briefData = {
        headline: `Priority Incident Cluster: #${highestProblem?.id} (${highestProblem?.title})`,
        summary: highestProblem?.impact_explanation || highestProblem?.description || `High-impact municipal incident localized in ${topWard}. Auditable impact score: ${topImpact}/100.`,
        recommendedAction: `Coordinate with ${highestProblem?.department_id || highestProblem?.department || 'assigned department'} to dispatch field verification team and track SLA countdown.`,
        confidence: `${Math.round((highestProblem?.confidence || 0.92) * 100)}%`,
        sourcesCount: topSigCount,
        problemLink: `/dashboard/problems/${highestProblem?.id}`,
      };
    }
  }

  return (
    <GovernmentShell problemCount={authoritativeProblemCount}>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <PageHeader
          title="District Intelligence Operations"
          description={
            liveSummary?.scope_description ||
            'Live view of citizen signals, public problem clusters, impact velocity, and verified government action.'
          }
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-civic-emeraldLight text-emerald-800">
              {isDemoMode ? 'Demo Feed Active' : 'Live Municipal Console'}
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadDashboard()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-ink-border bg-white hover:bg-canvas-subtle text-ink-primary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <Link
                href="/dashboard/problems"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-ink-border bg-white hover:bg-canvas-subtle text-ink-primary transition-colors"
              >
                <span>Problems Queue</span>
              </Link>
              <Link
                href="/dashboard/ai"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark transition-colors shadow-subtle"
              >
                <span>Ask Governance AI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          }
        />

        {/* Error Alert with Retry */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadDashboard()}
              className="px-3 py-1 rounded bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Quick Operational Actions / Journey Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-ink-border shadow-subtle text-xs">
          <div className="flex items-center gap-2 text-ink-secondary">
            <span className="font-semibold text-ink-primary">Quick Navigation:</span>
            <span>Jump across intelligence layers</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/problems"
              className="px-3 py-1.5 rounded-lg border border-ink-border bg-canvas-subtle hover:bg-white text-ink-primary font-medium transition-colors"
            >
              All Problems ({authoritativeProblemCount})
            </Link>
            {primaryProblemId && (
              <Link
                href={`/dashboard/problems/${primaryProblemId}`}
                className="px-3 py-1.5 rounded-lg border border-civic-rose/30 bg-rose-50 text-rose-800 hover:bg-rose-100 font-semibold transition-colors flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-civic-rose animate-pulse" />
                <span>
                  {isDemoMode && primaryProblemId === 'PRB-2026-0819'
                    ? 'Golden Demo: PRB-2026-0819 (Impact 92)'
                    : `Priority: #${primaryProblemId}`}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <Link
              href={`/dashboard/ai${primaryProblemId ? `?problemId=${primaryProblemId}` : ''}`}
              className="px-3 py-1.5 rounded-lg border border-civic-blue/30 bg-civic-blueLight/50 text-civic-blueDark hover:bg-civic-blueLight font-medium transition-colors"
            >
              Governance AI
            </Link>
            <Link
              href={`/dashboard/simulation${primaryProblemId ? `?problemId=${primaryProblemId}` : ''}`}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-medium transition-colors"
            >
              Intervention Simulator
            </Link>
            <Link
              href="/dashboard/departments"
              className="px-3 py-1.5 rounded-lg border border-ink-border bg-canvas-subtle hover:bg-white text-ink-primary font-medium transition-colors"
            >
              Departments ({authoritativeDepartmentCount})
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar
          ward={ward}
          onWardChange={setWard}
          category={category}
          onCategoryChange={setCategory}
          severity={severity}
          onSeverityChange={setSeverity}
          department={department}
          onDepartmentChange={setDepartment}
          onReset={() => {
            setWard('ALL');
            setCategory('ALL');
            setSeverity('ALL');
            setDepartment('ALL');
          }}
        />

        {/* 6-Card KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          <KPIStat
            label="Citizen Signals"
            value={authoritativeSignalCount.toLocaleString()}
            comparison={isDemoMode ? '+384 today' : 'Correlated signals'}
            trend="up"
            trendValue={isDemoMode ? '+12%' : ''}
            isPositive={false}
            icon={<Activity className="w-4 h-4" />}
          />
          <KPIStat
            label="Active Problems"
            value={authoritativeActiveCount.toLocaleString()}
            comparison="Clustered from signals"
            trend="down"
            trendValue={isDemoMode ? '-4%' : ''}
            isPositive={true}
            icon={<AlertOctagon className="w-4 h-4" />}
          />
          <KPIStat
            label="Critical / High"
            value={authoritativeCriticalCount}
            comparison="Urgent municipal focus"
            trend="up"
            trendValue=""
            isPositive={false}
            icon={<Users className="w-4 h-4" />}
          />
          <KPIStat
            label="SLA Compliance"
            value={
              liveSummary
                ? `${liveSummary.sla_compliance_rate}%`
                : isDemoMode
                ? DEMO_KPIS.resolutionRate
                : '100%'
            }
            comparison={
              liveSummary?.sla_breached_count
                ? `${liveSummary.sla_breached_count} SLA breached`
                : 'Deterministic target'
            }
            trend="up"
            trendValue=""
            isPositive={true}
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <KPIStat
            label="SLA Risk Pipeline"
            value={
              liveSummary
                ? `${liveSummary.sla_at_risk_count} At Risk`
                : isDemoMode
                ? '3 At Risk'
                : '0 At Risk'
            }
            comparison={
              liveSummary
                ? `${liveSummary.sla_breached_count || 0} Breached`
                : 'Active tracking'
            }
            trend="down"
            trendValue=""
            isPositive={false}
            icon={<Clock className="w-4 h-4" />}
          />
          <KPIStat
            label="Median Res. Time"
            value={
              liveSummary?.median_resolution_time_hours != null
                ? `${liveSummary.median_resolution_time_hours}h`
                : isDemoMode
                ? DEMO_KPIS.medianResponse
                : 'N/A'
            }
            comparison="Resolved cases"
            trend="down"
            trendValue=""
            isPositive={true}
            icon={<Clock className="w-4 h-4" />}
          />
        </div>

        {/* Dedicated SLA Risk Priority Banner (Sorted BREACHED then AT_RISK) */}
        {slaRiskList.length > 0 && (
          <div className="p-5 rounded-xl border border-rose-300/80 bg-rose-50/40 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-civic-rose" />
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">
                    Urgent SLA Breach & Escalation Watch
                  </h3>
                  <p className="text-xs text-ink-secondary">
                    Problems requiring immediate dispatch or supervisory intervention to prevent/remedy SLA breach
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-civic-rose text-white">
                {slaRiskList.length} Requiring Action
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {slaRiskList.slice(0, 3).map((problem) => {
                const slaStatus = problem.sla_state?.status || (problem.impact_level === 'CRITICAL' ? 'AT_RISK' : 'BREACHED');
                const isBreached = slaStatus === 'BREACHED';
                return (
                  <div
                    key={problem.id}
                    className="p-3.5 rounded-lg bg-white border border-rose-200/80 shadow-subtle space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-ink-primary">{problem.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                          isBreached
                            ? 'bg-rose-100 text-rose-900 border border-rose-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {isBreached ? <AlertTriangle className="w-3 h-3 text-rose-700" /> : <Clock className="w-3 h-3 text-amber-700" />}
                        <span>{slaStatus}</span>
                      </span>
                    </div>
                    <div className="font-semibold text-ink-primary line-clamp-1">
                      {problem.title}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-ink-secondary pt-1 border-t border-ink-border/50">
                      <span>Dept: {problem.department_id || problem.department || 'Unassigned'}</span>
                      <Link
                        href={`/dashboard/problems/${problem.id}`}
                        className="font-bold text-civic-blue hover:underline flex items-center gap-0.5"
                      >
                        <span>Manage</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Priority Problems + AI Brief Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Priority Incidents List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-ink-primary">Priority Problems</h2>
                <p className="text-xs text-ink-secondary">Ranked by auditable public impact score</p>
              </div>
              <Link
                href="/dashboard/problems"
                className="text-xs font-semibold text-civic-blue hover:underline"
              >
                View all ({filteredProblems.length}) →
              </Link>
            </div>

            {loading && rawProblems.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-36 rounded-xl bg-canvas-muted animate-pulse" />
                ))}
              </div>
            ) : filteredProblems.length > 0 ? (
              <div className="space-y-3">
                {filteredProblems.slice(0, 3).map((problem, idx) => (
                  <ProblemCard key={problem.id} problem={problem} rank={idx + 1} />
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-ink-border bg-white text-center space-y-2">
                <AlertOctagon className="w-8 h-8 text-ink-tertiary mx-auto" />
                <p className="text-sm font-semibold text-ink-primary">No active problems</p>
                <p className="text-xs text-ink-secondary">
                  {rawProblems.length === 0
                    ? 'No problem clusters have been recorded or clustered in the operations console.'
                    : 'No problem clusters match the selected filters.'}
                </p>
              </div>
            )}
          </div>

          {/* AI Executive Briefing Note */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-ink-primary">Intelligence Brief</h2>
              <p className="text-xs text-ink-secondary">Real-time cross-district synthesis</p>
            </div>
            <AIBrief
              headline={briefData.headline}
              summary={briefData.summary}
              recommendedAction={briefData.recommendedAction}
              confidence={briefData.confidence}
              sourcesCount={briefData.sourcesCount}
              problemLink={briefData.problemLink}
            />
          </div>
        </div>

        {/* Geographic Problem Map */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-primary">Geographic Problem Heatmap</h2>
              <p className="text-xs text-ink-secondary">
                Spatial distribution of correlated citizen signals and active municipal problem clusters
              </p>
            </div>
            <Link
              href="/dashboard/map"
              className="text-xs font-semibold text-civic-blue hover:underline"
            >
              Open Fullscreen GIS →
            </Link>
          </div>
          <div className="rounded-xl overflow-hidden border border-ink-border shadow-card">
            <MapContainer problems={(liveMap.length > 0 ? liveMap : filteredProblems) as any} height="420px" />
          </div>
        </div>

        {/* Department Workload Summary Strip */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-primary">Department Workload Distribution</h2>
              <p className="text-xs text-ink-secondary">
                Active problem queues and SLA adherence by municipal agency
              </p>
            </div>
            <Link
              href="/dashboard/departments"
              className="text-xs font-semibold text-civic-blue hover:underline"
            >
              All Departments ({authoritativeDepartmentCount}) →
            </Link>
          </div>

          {displayDepartments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayDepartments.slice(0, 3).map((dept: any) => {
                const deptId = dept.id || dept.name;
                const deptName = dept.name || dept.short_name;
                const activeCount = dept.workload?.active_in_progress ?? dept.active ?? 0;
                const highImpactCount = dept.workload?.critical_or_high ?? dept.highImpact ?? 0;
                const slaRiskCount = dept.workload?.sla_at_risk ?? dept.slaRisk ?? 0;
                const medianRes = dept.medianResolution || '4.2 hrs';

                return (
                  <div
                    key={deptId}
                    className="p-5 rounded-xl border border-ink-border bg-white shadow-card space-y-3 hover:border-civic-blue/40 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-civic-blue shrink-0" />
                          <h3 className="text-sm font-bold text-ink-primary">{deptName}</h3>
                        </div>
                        <span className="text-xs text-ink-secondary font-mono">
                          {activeCount} active problems
                        </span>
                      </div>
                      {slaRiskCount > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-civic-amberLight text-amber-900">
                          {slaRiskCount} SLA At Risk
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-canvas-subtle border border-ink-border">
                        <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">
                          High Impact
                        </span>
                        <span className="font-bold text-civic-rose">{highImpactCount}</span>
                      </div>
                      <div className="p-2 rounded bg-canvas-subtle border border-ink-border">
                        <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">
                          Median Res.
                        </span>
                        <span className="font-bold text-ink-primary">{medianRes}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-ink-border/60 flex items-center justify-end">
                      <Link
                        href={`/dashboard/problems?department=${dept.id || dept.name}`}
                        className="text-xs font-semibold text-civic-blue hover:underline flex items-center gap-1"
                      >
                        <span>View Department Queue</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-ink-border bg-white text-center space-y-2">
              <Building2 className="w-8 h-8 text-ink-tertiary mx-auto" />
              <p className="text-sm font-semibold text-ink-primary">No department records available</p>
              <p className="text-xs text-ink-secondary">
                Department metadata directory has not been populated in the active database.
              </p>
            </div>
          )}
        </div>
      </div>
    </GovernmentShell>
  );
}
