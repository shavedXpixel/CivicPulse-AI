'use client';

import React, { useState, useEffect } from 'react';
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
import { ArrowRight, Activity, Users, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';

export default function GovernmentDashboardPage() {
  const [ward, setWard] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [department, setDepartment] = useState('ALL');

  const [liveSummary, setLiveSummary] = useState<any>(null);
  const [liveProblems, setLiveProblems] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      try {
        const [summaryRes, problemsRes] = await Promise.all([
          apiClient.get<any>('/api/v1/dashboard/summary').catch(() => null),
          apiClient.get<any>('/api/v1/dashboard/problems').catch(() => null),
        ]);

        if (mounted) {
          if (summaryRes?.data) {
            setLiveSummary(summaryRes.data);
          }
          if (problemsRes?.data && Array.isArray(problemsRes.data)) {
            setLiveProblems(problemsRes.data);
          }
        }
      } catch (err) {
        console.warn('Dashboard live API fetch fallback:', err);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  const problemsToFilter = liveProblems.length > 0 ? liveProblems : DEMO_PROBLEMS;

  const filteredProblems = problemsToFilter.filter((p) => {
    const pWard = p.ward_id || p.wardId;
    if (ward !== 'ALL' && pWard !== ward) return false;
    if (category !== 'ALL' && p.category !== category) return false;
    const pSeverity = p.impact_level || p.severity;
    if (severity !== 'ALL' && pSeverity !== severity) return false;
    const pDept = p.department_id || p.department;
    if (department !== 'ALL' && pDept !== department) return false;
    return true;
  });

  return (
    <GovernmentShell>
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
              Live Feed Active
            </span>
          }
          actions={
            <Link
              href="/dashboard/ai"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark transition-colors shadow-subtle"
            >
              <span>Ask Governance AI</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        />

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

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPIStat
            label="Citizen Signals"
            value={
              liveSummary
                ? liveSummary.total_signals.toLocaleString()
                : DEMO_KPIS.totalSignals.toLocaleString()
            }
            comparison="+384 today"
            trend="up"
            trendValue="+12%"
            isPositive={false}
            icon={<Activity className="w-4 h-4" />}
          />
          <KPIStat
            label="Active Problems"
            value={
              liveSummary
                ? liveSummary.active_problems.toLocaleString()
                : DEMO_KPIS.activeProblems.toLocaleString()
            }
            comparison="Clustered from signals"
            trend="down"
            trendValue="-4%"
            isPositive={true}
            icon={<AlertOctagon className="w-4 h-4" />}
          />
          <KPIStat
            label="Critical / High Impact"
            value={liveSummary ? liveSummary.critical_problems : DEMO_KPIS.highImpact}
            comparison="Urgent municipal focus"
            trend="up"
            trendValue="+2"
            isPositive={false}
            icon={<Users className="w-4 h-4" />}
          />
          <KPIStat
            label="SLA Compliance"
            value={
              liveSummary ? `${liveSummary.sla_compliance_rate}%` : DEMO_KPIS.resolutionRate
            }
            comparison={
              liveSummary?.sla_breached_count
                ? `${liveSummary.sla_breached_count} SLA breached`
                : 'Deterministic SLA tracking'
            }
            trend="up"
            trendValue="+5%"
            isPositive={true}
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <KPIStat
            label="SLA Risk Pipeline"
            value={
              liveSummary
                ? `${liveSummary.sla_at_risk_count} At Risk`
                : DEMO_KPIS.medianResponse
            }
            comparison={
              liveSummary
                ? `${liveSummary.sla_on_track_count} on-track`
                : 'Across all 198 wards'
            }
            trend="down"
            trendValue="-3 hrs"
            isPositive={true}
            icon={<Clock className="w-4 h-4" />}
          />
        </div>

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

            <div className="space-y-3">
              {filteredProblems.slice(0, 3).map((problem, idx) => (
                <ProblemCard key={problem.id} problem={problem} rank={idx + 1} />
              ))}
            </div>
          </div>

          {/* AI Executive Briefing Note */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-0.5">
              <h2 className="text-base font-bold text-ink-primary">Intelligence Brief</h2>
              <p className="text-xs text-ink-secondary">Real-time cross-district synthesis</p>
            </div>
            <AIBrief
              headline={DEMO_AI_BRIEF.headline}
              summary={DEMO_AI_BRIEF.summary}
              recommendedAction={DEMO_AI_BRIEF.recommendedAction}
              confidence={DEMO_AI_BRIEF.confidence}
              sourcesCount={DEMO_AI_BRIEF.sourcesCount}
              problemLink="/dashboard/problems/PRB-2026-0819"
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
            <MapContainer problems={filteredProblems as any} height="420px" />
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
              All Departments ({DEMO_DEPARTMENTS.length}) →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEMO_DEPARTMENTS.slice(0, 3).map((dept) => (
              <div
                key={dept.name}
                className="p-5 rounded-xl border border-ink-border bg-white shadow-card space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ink-primary">{dept.name}</h3>
                    <span className="text-xs text-ink-secondary font-mono">
                      {dept.active} active problems
                    </span>
                  </div>
                  {dept.slaRisk > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-civic-amberLight text-amber-900">
                      {dept.slaRisk} SLA At Risk
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-canvas-subtle border border-ink-border">
                    <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">
                      High Impact
                    </span>
                    <span className="font-bold text-civic-rose">{dept.highImpact}</span>
                  </div>
                  <div className="p-2 rounded bg-canvas-subtle border border-ink-border">
                    <span className="text-ink-tertiary block text-[10px] uppercase font-semibold">
                      Median Res.
                    </span>
                    <span className="font-bold text-ink-primary">{dept.medianResolution}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GovernmentShell>
  );
}
