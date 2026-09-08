'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DEMO_DEPARTMENTS } from '../../../lib/mockData';
import { apiClient } from '../../../lib/api-client';
import { Department, DepartmentWorkload } from '@civicpulse/shared';
import { Building2, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

interface DepartmentWithWorkload extends Department {
  workload?: DepartmentWorkload;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentWithWorkload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadDepartmentData() {
      setLoading(true);
      try {
        const deptRes = await apiClient.get<{ data: Department[] }>('/api/v1/departments');
        if (deptRes?.data && deptRes.data.length > 0) {
          const deptsWithWorkload = await Promise.all(
            deptRes.data.map(async (dept) => {
              try {
                const wRes = await apiClient.get<{ data: DepartmentWorkload }>(
                  `/api/v1/departments/${dept.id}/workload`,
                  { Authorization: 'Bearer demo-token-dept-watco' }
                );
                return { ...dept, workload: wRes.data };
              } catch {
                return { ...dept };
              }
            })
          );
          if (mounted) {
            setDepartments(deptsWithWorkload);
          }
        }
      } catch (err) {
        console.warn('Could not load departments from API, using demo fallback:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDepartmentData();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Department Operations & SLA Workload"
          description="Cross-departmental incident distribution, operational capacity, and deterministic SLA compliance."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Departments' },
          ]}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-civic-blueLight text-civic-blueDark">
              {departments.length > 0 ? departments.length : DEMO_DEPARTMENTS.length} Active Departments
            </span>
          }
        />

        {loading ? (
          <div className="p-12 rounded-xl border border-ink-border bg-white shadow-card flex items-center justify-center text-xs text-ink-tertiary gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-civic-blue" />
            <span>Loading departmental operations workload...</span>
          </div>
        ) : departments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => {
              const wl = dept.workload;
              const atRiskCount = wl?.sla_at_risk ?? 0;
              const breachedCount = wl?.sla_breached ?? 0;

              return (
                <div
                  key={dept.id}
                  className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4 hover:shadow-cardHover transition-shadow"
                >
                  <div className="flex items-start justify-between border-b border-ink-border/60 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-civic-blue shrink-0" />
                        <h3 className="text-sm font-bold text-ink-primary">{dept.name}</h3>
                      </div>
                      <span className="text-[11px] font-mono text-ink-tertiary">
                        Code: {dept.short_name || dept.id} • Tier 1
                      </span>
                    </div>

                    {breachedCount > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-civic-roseLight text-civic-rose flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>{breachedCount} Breached</span>
                      </span>
                    ) : atRiskCount > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-civic-amberLight text-amber-900 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{atRiskCount} At Risk</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-civic-emeraldLight text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Compliant</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-secondary line-clamp-2">
                    {dept.description}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">
                        ACTIVE IN PROGRESS
                      </div>
                      <div className="text-lg font-bold text-ink-primary">
                        {wl?.active_in_progress ?? 0}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">
                        CRITICAL / HIGH
                      </div>
                      <div className="text-lg font-bold text-civic-rose">
                        {wl?.critical_or_high ?? 0}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">
                        SLA AT RISK
                      </div>
                      <div className="text-lg font-bold text-civic-amber">
                        {atRiskCount}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">
                        TOTAL ASSIGNED
                      </div>
                      <div className="text-lg font-bold text-civic-blue">
                        {wl?.total_assigned ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-ink-border/60 flex items-center justify-between text-xs font-semibold text-civic-blue">
                    <Link
                      href="/dashboard/problems"
                      className="hover:underline flex items-center gap-1 w-full justify-between"
                    >
                      <span>View Department Incidents</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEMO_DEPARTMENTS.map((dept) => (
              <div
                key={dept.name}
                className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4"
              >
                <div className="flex items-start justify-between border-b border-ink-border/60 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-civic-blue" />
                      <h3 className="text-sm font-bold text-ink-primary">{dept.name}</h3>
                    </div>
                    <span className="text-[11px] font-mono text-ink-tertiary">BMC Municipal Tier 1</span>
                  </div>
                  {dept.slaRisk > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-civic-amberLight text-amber-900">
                      {dept.slaRisk} SLA At Risk
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                    <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">ACTIVE PROBLEMS</div>
                    <div className="text-lg font-bold text-ink-primary">{dept.active}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                    <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">HIGH IMPACT</div>
                    <div className="text-lg font-bold text-civic-rose">{dept.highImpact}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                    <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">MEDIAN TIME</div>
                    <div className="text-lg font-bold text-ink-primary">{dept.medianResolution}</div>
                  </div>

                  <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                    <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">ON-TIME RATE</div>
                    <div className="text-lg font-bold text-civic-emerald">91.4%</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-ink-border/60 flex items-center justify-between text-xs font-semibold text-civic-blue">
                  <Link href="/dashboard/problems" className="hover:underline flex items-center gap-1 w-full justify-between">
                    <span>View Department Queue</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GovernmentShell>
  );
}
