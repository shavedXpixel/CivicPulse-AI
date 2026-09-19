'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { apiClient } from '../../../lib/api-client';
import { Department, DepartmentWorkload } from '@civicpulse/shared';
import { Building2, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, ArrowRight } from 'lucide-react';

interface DepartmentWithWorkload extends Department {
  workload?: DepartmentWorkload;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentWithWorkload[]>([]);
  const [officersByDept, setOfficersByDept] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDepartmentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const deptRes = await apiClient.get<{ data: Department[] }>('/api/v1/departments');
      if (deptRes?.data && deptRes.data.length > 0) {
        const offMap: Record<string, any[]> = {};
        const deptsWithWorkload = await Promise.all(
          deptRes.data.map(async (dept) => {
            try {
              const [wRes, offRes] = await Promise.all([
                apiClient.get<{ data: DepartmentWorkload }>(`/api/v1/departments/${dept.id}/workload`).catch(() => null),
                apiClient.get<{ data: any[] }>(`/api/v1/departments/${dept.id}/officers`).catch(() => null)
              ]);
              if (offRes?.data) {
                offMap[dept.id] = offRes.data;
              }
              return { ...dept, workload: wRes?.data };
            } catch {
              return { ...dept };
            }
          })
        );
        setOfficersByDept(offMap);
        setDepartments(deptsWithWorkload);
      } else {
        setDepartments([]);
      }
    } catch (err: any) {
      console.warn('Could not load departments from API:', err);
      setError(err.message || 'Failed to load departmental workloads.');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartmentData();
  }, [loadDepartmentData]);

  const displayDepts = departments;

  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Department Operations & SLA Workload"
          description="Cross-departmental incident distribution, active field queues, and deterministic SLA compliance."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Departments' },
          ]}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-civic-blueLight text-civic-blueDark">
              {displayDepts.length} Municipal Agencies
            </span>
          }
          actions={
            <button
              onClick={() => loadDepartmentData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-ink-border bg-white hover:bg-canvas-subtle text-ink-primary transition-colors disabled:opacity-50 shadow-subtle"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          }
        />

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadDepartmentData()}
              className="px-3 py-1 rounded bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="p-12 border border-ink-border bg-canvas-card flex items-center justify-center text-xs font-mono text-ink-muted gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-civic-terracotta" />
            <span>Loading departmental operations workload...</span>
          </div>
        ) : displayDepts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayDepts.map((dept: any) => {
              const deptId = dept.id || dept.short_name || dept.name;
              const wl = dept.workload;
              const atRiskCount = wl?.sla_at_risk ?? dept.slaRisk ?? 0;
              const breachedCount = wl?.sla_breached ?? 0;
              const activeCount = wl?.active_in_progress ?? dept.active ?? 0;
              const highImpactCount = wl?.critical_or_high ?? dept.highImpact ?? 0;
              const totalAssigned = wl?.total_assigned ?? (activeCount + highImpactCount);

              return (
                <div
                  key={deptId}
                  className="p-6 border border-ink-border bg-canvas-card space-y-4"
                >
                  <div className="flex items-start justify-between border-b border-ink-border pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-civic-terracotta shrink-0" />
                        <h3 className="text-base font-serif font-bold text-ink-primary">{dept.name}</h3>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                        Code: {dept.short_name || dept.id} • Tier 1
                      </span>
                    </div>

                    {breachedCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-rose-50 text-civic-terracotta border border-rose-300 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>{breachedCount} Breached</span>
                      </span>
                    ) : atRiskCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{atRiskCount} At Risk</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Compliant</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed">
                    {dept.description || 'Municipal public works and engineering division.'}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">
                        ACTIVE WORK
                      </div>
                      <div className="text-base font-bold text-ink-primary">
                        {activeCount}
                      </div>
                    </div>

                    <div className="p-3 bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">
                        HIGH IMPACT
                      </div>
                      <div className="text-base font-bold text-civic-terracotta">
                        {highImpactCount}
                      </div>
                    </div>

                    <div className="p-3 bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">
                        SLA AT RISK
                      </div>
                      <div className="text-base font-bold text-amber-800">
                        {atRiskCount}
                      </div>
                    </div>

                    <div className="p-3 bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-muted uppercase tracking-wider font-semibold">
                        TOTAL QUEUED
                      </div>
                      <div className="text-base font-bold text-ink-primary">
                        {totalAssigned}
                      </div>
                    </div>
                  </div>

                  {officersByDept[deptId] && officersByDept[deptId].length > 0 && (
                    <div className="pt-2 border-t border-ink-border/40 text-[11px] space-y-1.5">
                      <span className="font-mono text-[10px] uppercase text-ink-muted">
                        Department Personnel ({officersByDept[deptId].length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {officersByDept[deptId].map((off: any) => (
                          <span
                            key={off.id}
                            className="px-2 py-0.5 bg-canvas-subtle border border-ink-border text-ink-secondary text-[10px] font-mono"
                          >
                            {off.display_name} • {off.role.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-ink-border flex items-center justify-between text-xs font-mono uppercase text-civic-terracotta">
                    <Link
                      href={`/dashboard/problems?department=${deptId}`}
                      className="hover:underline flex items-center gap-1 w-full justify-between"
                    >
                      <span>Filter Problem Queue ({dept.name})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 border border-ink-border bg-canvas-card text-center space-y-2">
            <Building2 className="w-8 h-8 text-ink-muted mx-auto" />
            <p className="text-sm font-serif font-bold text-ink-primary">No departments recorded</p>
            <p className="text-xs text-ink-secondary font-mono">
              Municipal department directory has no active agency records.
            </p>
          </div>
        )}
      </div>
    </GovernmentShell>
  );
}
