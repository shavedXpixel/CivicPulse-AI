'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DEMO_DEPARTMENTS } from '../../../lib/mockData';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../context/AuthContext';
import { Department, DepartmentWorkload } from '@civicpulse/shared';
import { Building2, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, ArrowRight } from 'lucide-react';

interface DepartmentWithWorkload extends Department {
  workload?: DepartmentWorkload;
}

export default function DepartmentsPage() {
  const { isDemoMode } = useAuth();
  const [departments, setDepartments] = useState<DepartmentWithWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDepartmentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const deptRes = await apiClient.get<{ data: Department[] }>('/api/v1/departments');
      if (deptRes?.data && deptRes.data.length > 0) {
        const deptsWithWorkload = await Promise.all(
          deptRes.data.map(async (dept) => {
            try {
              const wRes = await apiClient.get<{ data: DepartmentWorkload }>(
                `/api/v1/departments/${dept.id}/workload`
              );
              return { ...dept, workload: wRes.data };
            } catch {
              return { ...dept };
            }
          })
        );
        setDepartments(deptsWithWorkload);
      } else {
        if (!isDemoMode) {
          setDepartments([]);
        } else {
          setDepartments([]);
        }
      }
    } catch (err: any) {
      console.warn('Could not load departments from API:', err);
      if (!isDemoMode) {
        setError(err.message || 'Failed to load departmental workloads.');
        setDepartments([]);
      }
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    loadDepartmentData();
  }, [loadDepartmentData]);

  const displayDepts = departments.length > 0 ? departments : (isDemoMode ? (DEMO_DEPARTMENTS as any[]) : []);

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
          <div className="p-12 rounded-xl border border-ink-border bg-white shadow-card flex items-center justify-center text-xs text-ink-tertiary gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-civic-blue" />
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
                  className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4 hover:shadow-cardHover transition-shadow"
                >
                  <div className="flex items-start justify-between border-b border-ink-border/60 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-civic-blue shrink-0" />
                        <h3 className="text-sm font-bold text-ink-primary">{dept.name}</h3>
                      </div>
                      <span className="text-[11px] font-mono text-ink-tertiary">
                        Code: {dept.short_name || dept.id} • Tier 1 Municipal
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
                    {dept.description || 'Municipal public works and engineering division.'}
                  </p>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">
                        ACTIVE IN PROGRESS
                      </div>
                      <div className="text-lg font-bold text-ink-primary">
                        {activeCount}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                      <div className="text-[10px] text-ink-tertiary uppercase tracking-wider font-semibold">
                        CRITICAL / HIGH
                      </div>
                      <div className="text-lg font-bold text-civic-rose">
                        {highImpactCount}
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
                        TOTAL QUEUED
                      </div>
                      <div className="text-lg font-bold text-civic-blue">
                        {totalAssigned}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-ink-border/60 flex items-center justify-between text-xs font-semibold text-civic-blue">
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
          <div className="p-12 rounded-xl border border-ink-border bg-white text-center space-y-2">
            <Building2 className="w-8 h-8 text-ink-tertiary mx-auto" />
            <p className="text-sm font-semibold text-ink-primary">No departments recorded</p>
            <p className="text-xs text-ink-secondary">
              Municipal department directory has no active agency records.
            </p>
          </div>
        )}
      </div>
    </GovernmentShell>
  );
}
