'use client';

import React, { useState } from 'react';
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
import { ArrowRight, Activity, Users, AlertOctagon, CheckCircle2, Clock } from 'lucide-react';

export default function GovernmentDashboardPage() {
  const [ward, setWard] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [severity, setSeverity] = useState('ALL');
  const [department, setDepartment] = useState('ALL');

  const filteredProblems = DEMO_PROBLEMS.filter((p) => {
    if (ward !== 'ALL' && p.wardId !== ward) return false;
    if (category !== 'ALL' && p.category !== category) return false;
    if (severity !== 'ALL' && p.severity !== severity) return false;
    return true;
  });

  return (
    <GovernmentShell>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Page Header */}
        <PageHeader
          title="District Intelligence Operations"
          description="Live view of citizen signals, public problem clusters, impact velocity, and verified government action."
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
            value={DEMO_KPIS.totalSignals.toLocaleString()}
            comparison="+384 today"
            trend="up"
            trendValue="+12%"
            isPositive={false}
            icon={<Activity className="w-4 h-4" />}
          />
          <KPIStat
            label="Active Problems"
            value={DEMO_KPIS.activeProblems.toLocaleString()}
            comparison="Clustered from signals"
            trend="down"
            trendValue="-4%"
            isPositive={true}
            icon={<AlertOctagon className="w-4 h-4" />}
          />
          <KPIStat
            label="High Impact (>60)"
            value={DEMO_KPIS.highImpact}
            comparison="Urgent municipal focus"
            trend="up"
            trendValue="+2"
            isPositive={false}
            icon={<Users className="w-4 h-4" />}
          />
          <KPIStat
            label="Resolution Rate"
            value={DEMO_KPIS.resolutionRate}
            comparison="Verified by proof"
            trend="up"
            trendValue="+5%"
            isPositive={true}
            icon={<CheckCircle2 className="w-4 h-4" />}
          />
          <KPIStat
            label="Median Response"
            value={DEMO_KPIS.medianResponse}
            comparison="Across all 198 wards"
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
              <p className="text-xs text-ink-secondary">Synthesized from live signals and GIS layers</p>
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

        {/* Map Workspace Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-primary">Public Impact Map</h2>
              <p className="text-xs text-ink-secondary">Geospatial problem density and ward incident clusters</p>
            </div>
            <Link
              href="/dashboard/map"
              className="text-xs font-semibold text-civic-blue hover:underline"
            >
              Full Workspace →
            </Link>
          </div>

          <MapContainer problems={filteredProblems} height="h-[420px]" />
        </div>

        {/* Department Overview Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-ink-primary">Department Performance & SLA</h2>
              <p className="text-xs text-ink-secondary">Workload distribution and response velocity</p>
            </div>
            <Link
              href="/dashboard/departments"
              className="text-xs font-semibold text-civic-blue hover:underline"
            >
              Department Dossier →
            </Link>
          </div>

          <div className="rounded-xl border border-ink-border bg-white shadow-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas-subtle/60 border-b border-ink-border text-ink-secondary font-mono">
                <tr>
                  <th className="p-3.5 font-medium">DEPARTMENT</th>
                  <th className="p-3.5 font-medium">ACTIVE PROBLEMS</th>
                  <th className="p-3.5 font-medium">HIGH IMPACT</th>
                  <th className="p-3.5 font-medium">MEDIAN RESOLUTION</th>
                  <th className="p-3.5 font-medium">SLA RISK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border/60">
                {DEMO_DEPARTMENTS.map((dept) => (
                  <tr key={dept.name} className="hover:bg-canvas-subtle/30 transition-colors">
                    <td className="p-3.5 font-semibold text-ink-primary">{dept.name}</td>
                    <td className="p-3.5 font-mono">{dept.active}</td>
                    <td className="p-3.5 font-mono font-bold text-civic-rose">{dept.highImpact}</td>
                    <td className="p-3.5 font-mono">{dept.medianResolution}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded font-mono font-bold bg-civic-amberLight text-amber-900">
                        {dept.slaRisk} at risk
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </GovernmentShell>
  );
}
