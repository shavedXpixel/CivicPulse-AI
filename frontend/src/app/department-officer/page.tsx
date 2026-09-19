'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GovernmentShell } from '../../components/shells/GovernmentShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { KPIStat } from '../../components/domain/KPIStat';
import { ProblemCard } from '../../components/domain/ProblemCard';
import { MapContainer } from '../../components/domain/MapContainer';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Loader2,
  Users,
  MapPin,
  CheckSquare,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { UserRole } from '@civicpulse/shared';

export default function DepartmentOfficerPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, getIdToken } = useAuth();

  const [activeTab, setActiveTab] = useState<'problems' | 'assignments' | 'sla' | 'verification' | 'map'>('problems');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Department Telemetry State
  const [summary, setSummary] = useState<any>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [slaRisk, setSlaRisk] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any[]>([]);
  const [departmentInfo, setDepartmentInfo] = useState<any>(null);
  const [workload, setWorkload] = useState<any>(null);

  const getHeaders = useCallback(async (): Promise<Record<string, string> | undefined> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [getIdToken]);

  // Auth Guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (userProfile && userProfile.role !== UserRole.DEPARTMENT_OFFICER) {
      if (userProfile.role === UserRole.ADMIN || userProfile.role === UserRole.SYSTEM_ADMIN) {
        // Admins have access to everything, but can view department workspace
      } else if (userProfile.role === UserRole.FIELD_OFFICER) {
        router.replace('/field-officer');
      } else {
        router.replace('/citizen');
      }
    }
  }, [user, userProfile, authLoading, router]);

  const loadDepartmentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const deptId = userProfile?.department_id;

      const [summaryRes, problemsRes, assignmentsRes, slaRes, mapRes, deptRes, wlRes] =
        await Promise.all([
          apiClient.get<any>('/api/v1/dashboard/summary', headers).catch(() => null),
          apiClient.get<any>('/api/v1/dashboard/problems', headers).catch(() => null),
          apiClient.get<any>('/api/v1/assignments', headers).catch(() => null),
          apiClient.get<any>('/api/v1/dashboard/sla-risk', headers).catch(() => null),
          apiClient.get<any>('/api/v1/dashboard/map', headers).catch(() => null),
          deptId ? apiClient.get<any>(`/api/v1/departments/${deptId}`, headers).catch(() => null) : null,
          deptId ? apiClient.get<any>(`/api/v1/departments/${deptId}/workload`, headers).catch(() => null) : null
        ]);

      if (summaryRes?.data) setSummary(summaryRes.data);
      if (problemsRes?.data && Array.isArray(problemsRes.data)) setProblems(problemsRes.data);
      if (assignmentsRes?.data && Array.isArray(assignmentsRes.data)) setAssignments(assignmentsRes.data);
      if (slaRes?.data && Array.isArray(slaRes.data)) setSlaRisk(slaRes.data);
      if (mapRes?.data && Array.isArray(mapRes.data)) setMapData(mapRes.data);
      if (deptRes?.data) setDepartmentInfo(deptRes.data);
      if (wlRes?.data) setWorkload(wlRes.data);
    } catch (err: any) {
      console.warn('Failed to load department workspace:', err);
      setError(err.message || 'Failed to load department workspace.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, userProfile]);

  useEffect(() => {
    if (!authLoading && user) {
      loadDepartmentData();
    }
  }, [authLoading, user, loadDepartmentData]);

  const departmentName =
    departmentInfo?.name ||
    userProfile?.department_id ||
    'Municipal Department Operations';

  // Cases awaiting supervisory verification
  const verificationQueue = problems.filter((p) => p.status === 'AWAITING_VERIFICATION');

  return (
    <GovernmentShell problemCount={problems.length}>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header with Department Badge */}
        <PageHeader
          title={departmentName}
          description={`Operational command center and case intelligence strictly scoped to ${userProfile?.department_id || 'department'} jurisdiction.`}
          badge={
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold uppercase">
                <Building2 className="w-3.5 h-3.5" />
                {userProfile?.department_id || 'DEPARTMENT'} SCOPE
              </span>
              <button
                onClick={loadDepartmentData}
                disabled={loading}
                className="p-1.5 text-ink-muted hover:text-ink-primary rounded border border-ink-border bg-canvas-card hover:bg-canvas-elevated transition-colors"
                title="Refresh department data"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          }
        />

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-sm text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Top Department KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPIStat
            label="Active Cases"
            value={summary?.active_problems ?? problems.filter((p) => p.status !== 'RESOLVED' && p.status !== 'CLOSED').length}
            icon={<AlertOctagon className="w-4 h-4" />}
          />
          <KPIStat
            label="Critical Disruptions"
            value={summary?.critical_problems ?? problems.filter((p) => p.impact_level === 'CRITICAL' || p.impact_level === 'HIGH').length}
            icon={<ShieldAlert className="w-4 h-4" />}
          />
          <KPIStat
            label="SLA Compliance"
            value={`${summary?.sla_compliance_rate ?? 100}%`}
            icon={<Clock className="w-4 h-4" />}
          />
          <KPIStat
            label="Verification Queue"
            value={verificationQueue.length}
            icon={<CheckSquare className="w-4 h-4" />}
          />
        </div>

        {/* Live Workload Telemetry */}
        {workload && (
          <div className="bg-canvas-card border border-ink-border p-3.5 rounded-lg flex flex-wrap items-center justify-between text-xs font-mono gap-3">
            <span className="text-ink-muted">
              Capacity Status: <strong className="text-ink-primary font-bold">{workload.capacity_rating || 'NORMAL'}</strong>
            </span>
            <span className="text-ink-muted">
              In-Progress: <strong className="text-ink-primary">{workload.active_in_progress ?? 0}</strong>
            </span>
            <span className="text-ink-muted">
              Awaiting Verification: <strong className="text-ink-primary">{workload.awaiting_verification ?? 0}</strong>
            </span>
            <span className="text-ink-muted">
              SLA Breaches: <strong className={(workload.sla_breached ?? 0) > 0 ? 'text-rose-400 font-bold' : 'text-ink-primary'}>{workload.sla_breached ?? 0}</strong>
            </span>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-ink-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('problems')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'problems'
                ? 'border-ink-primary text-ink-primary'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <AlertOctagon className="w-4 h-4" />
            Department Problems ({problems.length})
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'verification'
                ? 'border-ink-primary text-ink-primary'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Verification Queue
            {verificationQueue.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono">
                {verificationQueue.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'assignments'
                ? 'border-ink-primary text-ink-primary'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            Workforce & Assignments ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('sla')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'sla'
                ? 'border-ink-primary text-ink-primary'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <Clock className="w-4 h-4" />
            SLA Risk ({slaRisk.length})
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'map'
                ? 'border-ink-primary text-ink-primary'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Department Map
          </button>
        </div>

        {/* Tab 1: Problems */}
        {activeTab === 'problems' && (
          <div className="space-y-4">
            {loading && problems.length === 0 ? (
              <div className="p-12 text-center text-ink-muted">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-ink-primary" />
                <p className="text-sm">Loading department problem queue...</p>
              </div>
            ) : problems.length === 0 ? (
              <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-ink-primary">Department Backlog Clear</p>
                <p className="text-xs mt-1">No unresolved incidents currently assigned to {departmentName}.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {problems.map((p) => (
                  <ProblemCard key={p.id} problem={p} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Verification Queue */}
        {activeTab === 'verification' && (
          <div className="space-y-4">
            <div className="p-4 bg-canvas-card border border-ink-border rounded-lg">
              <h4 className="text-sm font-semibold text-ink-primary mb-1">
                Human Supervisory Verification Flow
              </h4>
              <p className="text-xs text-ink-muted">
                Field officers submit resolution evidence when completing tasks. AI evaluates proof and provides structured advisory assessments. Final approval and problem closure require official departmental sign-off.
              </p>
            </div>

            {verificationQueue.length === 0 ? (
              <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-ink-primary">Verification Queue Clear</p>
                <p className="text-xs mt-1">No cases are currently awaiting supervisory review.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {verificationQueue.map((p) => (
                  <div key={p.id} className="p-5 bg-canvas-card border border-amber-500/30 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-ink-primary">{p.id}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono">
                        AWAITING VERIFICATION
                      </span>
                    </div>
                    <h4 className="font-semibold text-ink-primary text-sm">{p.title}</h4>
                    <p className="text-xs text-ink-muted line-clamp-2">{p.description}</p>
                    <div className="pt-2 border-t border-ink-border flex items-center justify-between">
                      <span className="text-xs font-mono text-ink-muted">
                        Ward: {p.ward_id || 'N/A'}
                      </span>
                      <Link
                        href={`/dashboard/problems/${p.id}`}
                        className="px-3 py-1.5 bg-ink-primary text-canvas-card text-xs font-medium rounded hover:bg-ink-secondary transition-colors"
                      >
                        Review Evidence
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Assignments */}
        {activeTab === 'assignments' && (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
                <Users className="w-10 h-10 mx-auto mb-2 text-ink-muted/50" />
                <p className="text-sm font-medium text-ink-primary">No Active Assignments</p>
                <p className="text-xs mt-1">No active officer dispatches recorded for this department.</p>
              </div>
            ) : (
              <div className="bg-canvas-card border border-ink-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-canvas-elevated/50 text-[11px] font-mono uppercase text-ink-muted border-b border-ink-border">
                    <tr>
                      <th className="py-3 px-4">Problem</th>
                      <th className="py-3 px-4">Assigned Officer</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Assigned Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-border/50 text-xs">
                    {assignments.map((a) => (
                      <tr key={a.id} className="hover:bg-canvas-elevated/30">
                        <td className="py-3 px-4">
                          <div className="font-medium text-ink-primary font-mono">{a.problem_id}</div>
                          {a.problem?.title && (
                            <div className="text-ink-muted text-[11px] truncate max-w-sm">{a.problem.title}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-ink-primary font-mono">
                          {a.assigned_to}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-canvas-elevated border border-ink-border text-ink-primary">
                            {a.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-ink-muted font-mono">
                          {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: SLA Risk */}
        {activeTab === 'sla' && (
          <div className="space-y-4">
            {slaRisk.length === 0 ? (
              <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-ink-primary">All Cases Within SLA Targets</p>
                <p className="text-xs mt-1">No department cases are currently at risk of breach.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slaRisk.map((p) => {
                  const isBreached = p.sla_state?.status === 'BREACHED';
                  return (
                    <div
                      key={p.id}
                      className={`p-5 rounded-lg border ${
                        isBreached
                          ? 'bg-rose-500/10 border-rose-500/30'
                          : 'bg-amber-500/10 border-amber-500/30'
                      } space-y-3`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-ink-primary">{p.id}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                            isBreached ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {p.sla_state?.status || 'AT_RISK'}
                        </span>
                      </div>
                      <h4 className="font-semibold text-ink-primary text-sm">{p.title}</h4>
                      <p className="text-xs text-ink-muted">
                        Assigned To: <span className="font-mono text-ink-primary">{p.assigned_to || 'Unassigned'}</span>
                      </p>
                      <div className="pt-2 border-t border-ink-border/50 flex items-center justify-between text-xs">
                        <span className="text-ink-muted">Impact Score: {p.impact_score}/100</span>
                        <Link
                          href={`/dashboard/problems/${p.id}`}
                          className="text-xs text-ink-primary hover:underline font-medium"
                        >
                          View Case →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Department Map */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="bg-canvas-card border border-ink-border rounded-lg overflow-hidden h-[550px] relative">
              <MapContainer problems={mapData} />
            </div>
            <div className="text-xs text-ink-muted font-mono text-right">
              Displaying {mapData.length} geo-referenced problems in {departmentName}
            </div>
          </div>
        )}
      </div>
    </GovernmentShell>
  );
}
