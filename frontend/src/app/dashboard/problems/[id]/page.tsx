'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../../../components/shells/GovernmentShell';
import { ImpactScore } from '../../../../components/domain/ImpactScore';
import { ImpactBreakdown } from '../../../../components/domain/ImpactBreakdown';
import { StatusBadge } from '../../../../components/domain/StatusBadge';
import { Timeline } from '../../../../components/domain/Timeline';
import { AIInsight } from '../../../../components/domain/AIInsight';
import { ResolutionWorkspace } from '../../../../components/domain/ResolutionWorkspace';
import { apiClient } from '../../../../lib/api-client';
import { useAuth } from '../../../../context/AuthContext';
import {
  ProblemClusterDetail,
  ProblemClusterMember,
  ProblemStatus,
  ProblemAction,
} from '@civicpulse/shared';
import {
  MapPin,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Building2,
  ArrowRight,
  UserPlus,
  Play,
  Check,
  RotateCcw,
  XCircle,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  Sliders,
} from 'lucide-react';

export default function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, userProfile } = useAuth();

  const [liveProblem, setLiveProblem] = useState<ProblemClusterDetail | null>(null);
  const [liveActions, setLiveActions] = useState<ProblemAction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [recalcSuccess, setRecalcSuccess] = useState<string | null>(null);

  // Operations Workflow State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [availableDepts, setAvailableDepts] = useState<{ id: string; name: string }[]>([]);
  const [deptOfficers, setDeptOfficers] = useState<{ id: string; display_name: string; email?: string }[]>([]);
  const [assignDept, setAssignDept] = useState<string>('WATCO');
  const [assignOfficer, setAssignOfficer] = useState<string>('');
  const [assignPriority, setAssignPriority] = useState<string>('HIGH');
  const [assignNotes, setAssignNotes] = useState<string>('');
  
  // Action Logging State
  const [transitionNote, setTransitionNote] = useState<string>('');
  const [workflowLoading, setWorkflowLoading] = useState<boolean>(false);
  const [workflowSuccess, setWorkflowSuccess] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState<boolean>(false);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ProblemClusterDetail }>(
        `/api/v1/problems/${id}/details`
      );
      if (res?.data) {
        setLiveProblem(res.data);
        setIsConflict(false);
      }
    } catch (err) {
      console.warn('Could not fetch live problem details:', err);
    }
  }, [id]);

  const fetchActions = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ProblemAction[] }>(
        `/api/v1/problems/${id}/timeline`
      ).catch(() =>
        apiClient.get<{ data: ProblemAction[] }>(
          `/api/v1/problems/${id}/actions`
        )
      );
      if (res?.data) {
        setLiveActions(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch actions timeline:', err);
    }
  }, [id]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: any[] }>('/api/v1/departments');
      if (res?.data && res.data.length > 0) {
        const watcoOnly = res.data
          .filter((d) => d.id === 'WATCO')
          .map((d) => ({ id: d.id, name: d.name || d.id }));
        setAvailableDepts(
          watcoOnly.length > 0
            ? watcoOnly
            : [{ id: 'WATCO', name: 'Water Corporation of Odisha' }]
        );
      } else {
        setAvailableDepts([{ id: 'WATCO', name: 'Water Corporation of Odisha' }]);
      }
    } catch {
      setAvailableDepts([{ id: 'WATCO', name: 'Water Corporation of Odisha' }]);
    }
  }, []);

  const fetchOfficersForDept = useCallback(async (deptId: string) => {
    try {
      const res = await apiClient.get<{ data: any[] }>(
        `/api/v1/departments/${deptId}/officers`
      );
      if (res?.data && res.data.length > 0 && res.data[0]) {
        setDeptOfficers(res.data);
        setAssignOfficer(res.data[0].id);
      } else {
        setDeptOfficers([]);
        setAssignOfficer('');
      }
    } catch {
      setDeptOfficers([]);
      setAssignOfficer('');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchDetails(), fetchActions(), fetchDepartments()]);
      if (mounted) setLoading(false);
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [fetchDetails, fetchActions, fetchDepartments]);

  useEffect(() => {
    if (assignDept) {
      fetchOfficersForDept(assignDept);
    }
  }, [assignDept, fetchOfficersForDept]);

  const handleRecalculateImpact = async () => {
    setRecalculating(true);
    setRecalcSuccess(null);
    setWorkflowError(null);
    try {
      const res = await apiClient.post<{ data: ProblemClusterDetail }>(
        `/api/v1/problems/${id}/recalculate-impact`,
        {}
      );
      if (res?.data) {
        setLiveProblem((prev) => (prev ? { ...prev, ...res.data } : res.data));
        setRecalcSuccess(`Impact recomputed deterministically: ${res.data.impact_score}/100 (${res.data.impact_level})`);
      }
    } catch (err: any) {
      setWorkflowError(err.message || 'Impact recalculation failed');
    } finally {
      setRecalculating(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkflowLoading(true);
    setWorkflowSuccess(null);
    setWorkflowError(null);
    try {
      const res = await apiClient.post<{ data: any }>(
        `/api/v1/problems/${id}/assign`,
        {
          department_id: assignDept,
          assigned_to: assignOfficer,
          priority: assignPriority,
          notes: assignNotes,
        }
      );
      if (res?.data) {
        setWorkflowSuccess(`Successfully dispatched to ${assignDept} (${assignOfficer}) with priority ${assignPriority}`);
        setIsAssignModalOpen(false);
        await Promise.all([fetchDetails(), fetchActions()]);
      }
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.includes('conflict')) {
        setIsConflict(true);
        setWorkflowError('The problem state changed while you were viewing it. Please refresh and try again.');
      } else {
        setWorkflowError(err.message || 'Assignment failed');
      }
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleStatusTransition = async (newStatus: ProblemStatus, defaultNote: string) => {
    setWorkflowLoading(true);
    setWorkflowSuccess(null);
    setWorkflowError(null);
    try {
      const res = await apiClient.post<{ data: any }>(
        `/api/v1/problems/${id}/actions`,
        {
          action: newStatus,
          note: transitionNote.trim() || defaultNote,
        }
      );
      if (res?.data) {
        setWorkflowSuccess(`Status transition to ${newStatus} recorded authoritatively.`);
        setTransitionNote('');
        await Promise.all([fetchDetails(), fetchActions()]);
      }
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.includes('conflict')) {
        setIsConflict(true);
        setWorkflowError('The problem state changed while you were viewing it. Please refresh and try again.');
      } else {
        setWorkflowError(err.message || 'Status transition failed');
      }
    } finally {
      setWorkflowLoading(false);
    }
  };

  const title = liveProblem?.title || 'Unknown Incident';
  const status = (liveProblem?.status || ProblemStatus.NEW) as ProblemStatus;
  const department = liveProblem?.department_id || 'Unassigned';
  const assignedTo = liveProblem?.assigned_to;
  const wardName = liveProblem?.ward_id ? `Ward ${liveProblem.ward_id.replace(/\D/g, '') || '18'} (Nayapalli, Bhubaneswar)` : 'Ward 18 (Nayapalli, Bhubaneswar)';
  const signalCount = liveProblem?.signal_count || 0;
  const supportingMediaCount = liveProblem?.supporting_media_count ?? 0;
  const impactScore = liveProblem?.impact_score ?? 0;
  const impactLevel = liveProblem?.impact_level || 'LOW';
  const explanation = liveProblem?.impact_explanation || 'No impact assessment synthesized.';
  const sla = liveProblem?.sla_state;

  const breakdown = {
    severity: liveProblem?.severity_score ?? 0,
    population: liveProblem?.population_score ?? 0,
    duration: liveProblem?.duration_score ?? 0,
    concentration: liveProblem?.concentration_score ?? 0,
    facilities: liveProblem?.critical_exposure_score ?? 0,
    recurrence: liveProblem?.recurrence_score ?? 0,
    evidence: liveProblem?.evidence_score ?? 0,
  };

  const provenance = liveProblem?.data_provenance;

  const getProvenanceBadge = (src?: string) => {
    if (src === 'REAL') {
      return (
        <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
          Real
        </span>
      );
    }
    if (src === 'ESTIMATED') {
      return (
        <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono uppercase bg-amber-50 text-amber-900 border border-amber-300">
          Estimated
        </span>
      );
    }
    if (src === 'SYNTHETIC') {
      return (
        <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono uppercase bg-canvas-subtle text-ink-secondary border border-ink-border">
          Synthetic
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.2 rounded-xs text-[10px] font-mono uppercase bg-canvas-subtle text-ink-muted border border-ink-border">
        Unknown
      </span>
    );
  };

  const members: ProblemClusterMember[] = liveProblem?.members || [];

  const timelineEvents = liveActions.length > 0
    ? liveActions.map((act) => ({
        id: act.id,
        timestamp: new Date(act.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
        actor: `${act.actor_id || 'System'} (${act.action_type.replace(/_/g, ' ')})`,
        action: act.action_type.replace(/_/g, ' '),
        description: act.note || (act.metadata ? JSON.stringify(act.metadata) : 'Audit action recorded.'),
        isCompleted: true,
      }))
    : [];

  const slaStatus = sla?.status || (impactLevel === 'CRITICAL' ? 'AT_RISK' : 'ON_TRACK');
  const slaTargetHours = sla?.target_hours ?? (impactLevel === 'CRITICAL' ? 24 : 48);
  const slaRemainingHours = sla?.hours_remaining ?? 0;

  if (loading && !liveProblem) {
    return (
      <GovernmentShell>
        <div className="space-y-6 max-w-6xl mx-auto py-12">
          <div className="h-8 w-64 bg-canvas-muted animate-pulse rounded-xs" />
          <div className="h-96 bg-canvas-muted animate-pulse rounded-xs" />
        </div>
      </GovernmentShell>
    );
  }

  if (!liveProblem) {
    return (
      <GovernmentShell>
        <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-canvas-card border border-ink-border text-civic-terracotta mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-ink-primary">Problem Cluster Not Found</h2>
          <p className="text-xs text-ink-secondary max-w-md mx-auto">
            Problem cluster <code className="font-mono text-ink-primary font-bold">{id}</code> does not exist in live PostgreSQL or you do not have permission to view it.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/problems"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono uppercase bg-ink-primary text-canvas-card hover:bg-ink-secondary transition-colors"
            >
              ← Back to Problems Directory
            </Link>
          </div>
        </div>
      </GovernmentShell>
    );
  }

  return (
    <GovernmentShell>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Navigation & Contextual Actions Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-ink-border">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/problems"
              className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-ink-secondary hover:text-ink-primary"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Problems Directory</span>
            </Link>
            <span className="text-ink-border">/</span>
            <span className="text-xs font-mono text-ink-muted">INCIDENT #{id}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/dashboard/ai?problemId=${id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase bg-canvas-card border border-ink-border text-ink-primary hover:border-civic-terracotta transition-colors"
            >
              <span>Governance AI</span>
              <ArrowRight className="w-3 h-3 text-civic-terracotta" />
            </Link>
            <Link
              href={`/dashboard/simulation?problemId=${id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase bg-canvas-card border border-ink-border text-ink-primary hover:border-civic-terracotta transition-colors"
            >
              <Sliders className="w-3 h-3 text-civic-terracotta" />
              <span>Simulate</span>
            </Link>
          </div>
        </div>

        {/* Verified Operator Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-canvas-card border border-ink-border text-xs gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-civic-terracotta" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-secondary">Operator:</span>
            <span className="font-mono text-ink-primary font-semibold">{userProfile?.display_name || user?.email}</span>
            <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-canvas-subtle border border-ink-border text-ink-primary">
              {userProfile?.role === 'ADMIN' ? 'MUNICIPAL_ADMIN' : `${userProfile?.department_id || 'WATCO'} SUPERVISOR`}
            </span>
          </div>
          <div className="text-[10px] text-ink-muted font-mono uppercase tracking-widest">
            Live Operations Authority • PostgreSQL
          </div>
        </div>

        {/* Concurrency Banner */}
        {isConflict && (
          <div className="p-4 bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <strong className="block font-mono uppercase tracking-wider">Concurrency Conflict (409)</strong>
                <span>The problem changed while you were viewing it. Refresh to inspect the latest state.</span>
              </div>
            </div>
            <button
              onClick={() => {
                fetchDetails();
                fetchActions();
              }}
              className="px-3 py-1.5 bg-amber-800 text-white font-mono text-[11px] uppercase hover:bg-amber-900"
            >
              Refresh Now
            </button>
          </div>
        )}

        {/* Notifications */}
        {workflowSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-xs font-mono text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{workflowSuccess}</span>
          </div>
        )}

        {workflowError && !isConflict && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 text-xs font-mono text-rose-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{workflowError}</span>
          </div>
        )}

        {recalcSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-xs font-mono text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{recalcSuccess}</span>
          </div>
        )}

        {/* =========================================================================
            EDITORIAL INCIDENT REPORT DOSSIER
            Structured with thin architectural grid lines and restrained typography
            ========================================================================= */}
        <article className="border border-ink-border bg-canvas-card divide-y divide-ink-border shadow-xs">

          {/* MASTHEAD HEADER */}
          <header className="p-6 sm:p-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                <span>INCIDENT DOSSIER</span>
                <span>{'//'}</span>
                <span>REF: {id}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setLoading(true);
                    await Promise.all([fetchDetails(), fetchActions()]);
                    setLoading(false);
                  }}
                  className="px-3 py-1.5 text-xs font-mono uppercase border border-ink-border bg-canvas-card hover:bg-canvas-subtle text-ink-primary transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-ink-muted ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleRecalculateImpact}
                  disabled={recalculating}
                  className="px-3 py-1.5 text-xs font-mono uppercase border border-ink-border bg-canvas-card hover:bg-canvas-subtle text-ink-primary transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-ink-muted ${recalculating ? 'animate-spin' : ''}`} />
                  <span>{recalculating ? 'Calculating...' : 'Recalculate'}</span>
                </button>
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl font-serif font-bold text-ink-primary tracking-tight leading-tight">
              {title}
            </h1>

            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-ink-secondary font-mono border-t border-ink-border/50">
              <div>
                <span className="text-ink-muted uppercase mr-1.5">Ward:</span>
                <span className="text-ink-primary font-semibold">{wardName}</span>
              </div>
              <div>
                <span className="text-ink-muted uppercase mr-1.5">Department:</span>
                <span className="text-ink-primary font-semibold">{department || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-ink-muted uppercase mr-1.5">Signals:</span>
                <span className="text-ink-primary font-semibold">{signalCount} Correlated</span>
              </div>
              <div>
                <span className="text-ink-muted uppercase mr-1.5">Evidence:</span>
                <span className="text-ink-primary font-semibold">{supportingMediaCount} Assets</span>
              </div>
              {liveProblem?.location && (
                <div>
                  <span className="text-ink-muted uppercase mr-1.5">Coordinates:</span>
                  <span className="text-ink-primary font-semibold">
                    {liveProblem.location.lat.toFixed(4)}° N, {liveProblem.location.lng.toFixed(4)}° E
                  </span>
                </div>
              )}
            </div>
          </header>

          {/* SECTION 1: STATUS & OVERVIEW */}
          <section className="p-6 sm:p-8">
            <div className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta mb-4">
              01 // STATUS & OPERATIONAL LIFECYCLE
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-8 space-y-3">
                <h3 className="text-sm font-mono uppercase tracking-wider text-ink-primary font-bold">
                  Problem Description & Municipal Context
                </h3>
                <p className="text-sm text-ink-secondary leading-relaxed font-sans">
                  {liveProblem?.description || 'Municipal infrastructure cluster disrupting citizen mobility, water security, or public facilities.'}
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-canvas-subtle border border-ink-border text-ink-secondary">
                    Category: {liveProblem?.category || 'MUNICIPAL'}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono uppercase bg-canvas-subtle border border-ink-border text-ink-secondary">
                    Cluster Size: {signalCount} Citizen Reports
                  </span>
                </div>
              </div>

              <div className="md:col-span-4 p-4 border border-ink-border bg-canvas-subtle space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-ink-muted flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-civic-terracotta" />
                  <span>CURRENT DISPATCH STATE</span>
                </div>
                <div>
                  <StatusBadge status={status} />
                </div>
                <div className="pt-2 border-t border-ink-border text-xs font-mono space-y-1">
                  <div className="flex justify-between text-ink-secondary">
                    <span>SLA Target:</span>
                    <span className="font-bold text-ink-primary">{slaTargetHours}h</span>
                  </div>
                  <div className="flex justify-between text-ink-secondary">
                    <span>Deadline:</span>
                    <span className="font-bold text-ink-primary">
                      {sla?.due_at
                        ? new Date(sla.due_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                        : 'Deterministic 24h'}
                    </span>
                  </div>
                  <div className="flex justify-between text-ink-secondary">
                    <span>Time Window:</span>
                    <span className={`font-bold ${
                      slaStatus === 'BREACHED'
                        ? 'text-civic-terracotta'
                        : slaStatus === 'AT_RISK'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}>
                      {slaStatus === 'BREACHED'
                        ? `Breached by ${Math.abs(Math.round(slaRemainingHours))}h`
                        : `${Math.max(0, Math.round(slaRemainingHours))}h remaining`}
                    </span>
                  </div>
                  {sla?.was_breached && (
                    <div className="pt-2 border-t border-ink-border flex items-center gap-1.5 text-[10px] font-mono text-civic-terracotta">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Permanent Breach Recorded</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: LOCATION & GIS */}
          <section className="p-6 sm:p-8">
            <div className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta mb-4">
              02 // LOCATION & TERRITORIAL GEOMETRY
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-7 space-y-3">
                <div className="flex items-start gap-2 text-ink-primary">
                  <MapPin className="w-4 h-4 text-civic-terracotta shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-serif font-bold text-ink-primary">
                      {wardName}
                    </h3>
                    <p className="text-xs text-ink-secondary font-mono mt-0.5">
                      Territorial Corridor: Nayapalli — Bhubaneswar Municipal Corporation
                    </p>
                  </div>
                </div>
                <div className="p-3 border border-ink-border bg-canvas-subtle text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-ink-muted uppercase">Centroid Coordinates:</span>
                    <span className="text-ink-primary font-semibold">20.2961° N, 85.8245° E</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted uppercase">GIS Ward Identifier:</span>
                    <span className="text-ink-primary font-semibold">{liveProblem?.ward_id || 'WARD-018'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-ink-muted uppercase">Geospatial Provenance:</span>
                    {getProvenanceBadge(provenance?.geography)}
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 h-36 border border-ink-border bg-canvas-subtle p-4 flex flex-col justify-between font-mono text-xs">
                <div className="flex items-center justify-between text-[10px] text-ink-muted uppercase">
                  <span>Cartographic Grid Ref</span>
                  <span className="text-civic-terracotta">Zone BMC-04</span>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-base font-serif font-bold text-ink-primary">VIP Road Corridor</div>
                  <div className="text-[10px] text-ink-muted">High-density public transit artery</div>
                </div>
                <div className="text-[10px] text-ink-muted text-right">
                  Projection: EPSG:4326 (WGS84)
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: IMPACT & SCORING */}
          <section className="p-6 sm:p-8">
            <div className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta mb-4">
              03 // DETERMINISTIC PUBLIC IMPACT & SCORING
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-4 space-y-4">
                <div className="p-6 border border-ink-border bg-canvas-subtle text-center space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted block">
                    CIVIC IMPACT SCORE
                  </span>
                  <div className="text-5xl font-serif font-bold text-ink-primary tracking-tight">
                    {impactScore}
                    <span className="text-xl font-normal text-ink-muted">/100</span>
                  </div>
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-civic-terracotta">
                    Level: {impactLevel}
                  </div>
                  <div className="pt-2">
                    <ImpactScore score={impactScore} size="md" />
                  </div>
                </div>

                <div className="text-xs text-ink-secondary space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                    DATA PROVENANCE
                  </div>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span>Population Density:</span>
                    {getProvenanceBadge(provenance?.population)}
                  </div>
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span>Critical Facilities:</span>
                    {getProvenanceBadge(provenance?.facility)}
                  </div>
                </div>
              </div>

              <div className="md:col-span-8 space-y-6">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-primary font-bold mb-3">
                    Canonical 7-Factor Impact Matrix Breakdown
                  </h3>
                  <ImpactBreakdown
                    severity={breakdown.severity}
                    population={breakdown.population}
                    duration={breakdown.duration}
                    concentration={breakdown.concentration}
                    facilities={breakdown.facilities}
                    recurrence={breakdown.recurrence}
                    evidence={breakdown.evidence}
                  />
                </div>

                <AIInsight
                  title="Intelligence Summary & Impact Rationale"
                  confidence="High"
                  citations={[`Cluster #${id}`, '7-Factor Deterministic Impact Matrix']}
                >
                  {explanation}
                </AIInsight>
              </div>
            </div>
          </section>

          {/* SECTION 4: DEPARTMENT & ASSIGNMENT */}
          <section className="p-6 sm:p-8">
            <div className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta mb-4">
              04 // DEPARTMENT RESPONSIBILITY & FIELD ASSIGNMENT
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-6 p-5 border border-ink-border bg-canvas-subtle space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted uppercase text-[10px]">RESPONSIBLE AGENCY</span>
                  <Building2 className="w-4 h-4 text-civic-terracotta" />
                </div>
                <div className="text-base font-serif font-bold text-ink-primary font-sans">
                  {department || 'Unassigned Agency'}
                </div>
                <p className="text-[11px] text-ink-secondary font-sans leading-relaxed">
                  Agency retains jurisdictional operating authority and statutory service level commitments.
                </p>
              </div>

              <div className="md:col-span-6 p-5 border border-ink-border bg-canvas-subtle space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted uppercase text-[10px]">FIELD DISPATCH OFFICER</span>
                  <span className="text-ink-primary font-bold">{assignedTo || 'Unassigned'}</span>
                </div>
                <div className="text-sm font-semibold text-ink-primary font-sans">
                  {assignedTo ? `Assigned Engineer: ${assignedTo}` : 'Pending Official Officer Assignment'}
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setAssignDept('WATCO');
                      setAssignNotes('');
                      setIsAssignModalOpen(true);
                    }}
                    className="w-full py-2 px-3 text-xs font-mono uppercase bg-canvas-card border border-ink-border text-ink-primary hover:border-civic-terracotta transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-civic-terracotta" />
                    <span>{assignedTo ? 'Reassign Department & Officer' : 'Assign Department & Officer'}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: EVIDENCE & VERIFICATION WORKSPACE */}
          <section className="p-6 sm:p-8 space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta">
              05 // RESOLUTION EVIDENCE & AI ADVISORY VERIFICATION
            </div>
            <ResolutionWorkspace
              problemId={id}
              problemTitle={title}
              problemCategory={liveProblem?.category || 'MUNICIPAL'}
              problemStatus={status}
              assignedTo={assignedTo}
              departmentId={department}
              authToken=""
              userRole={userProfile?.role || 'DEPARTMENT_OFFICER'}
              userName={userProfile?.display_name || user?.displayName || user?.email || 'Government Officer'}
              onStatusChange={async () => {
                await Promise.all([fetchDetails(), fetchActions()]);
              }}
            />
          </section>

          {/* SECTION 6: ACTIONS & AUDIT TRAIL */}
          <section className="p-6 sm:p-8">
            <div className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta mb-4">
              06 // OPERATIONAL ACTIONS & AUDIT TRAIL
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Operations Lifecycle Actions */}
              <div className="md:col-span-5 space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-ink-primary font-bold">
                  Execute State Action
                </h3>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-ink-muted flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-civic-terracotta" />
                    <span>Audit Action Note (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={transitionNote}
                    onChange={(e) => setTransitionNote(e.target.value)}
                    placeholder="Reason for state transition..."
                    className="w-full px-3 py-2 border border-ink-border bg-canvas-card text-xs text-ink-primary font-sans focus:outline-none focus:border-civic-terracotta"
                  />
                </div>

                <div className="space-y-2 pt-2">
                  {status === ProblemStatus.NEW && (
                    <button
                      onClick={() => handleStatusTransition(ProblemStatus.TRIAGED, 'Problem triaged by department dispatcher.')}
                      disabled={workflowLoading}
                      className="w-full py-2.5 px-4 text-xs font-mono uppercase bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Triage Problem (Mark TRIAGED)</span>
                    </button>
                  )}

                  {status === ProblemStatus.ASSIGNED && (
                    <button
                      onClick={() => handleStatusTransition(ProblemStatus.IN_PROGRESS, 'Field crew dispatched and commenced site intervention.')}
                      disabled={workflowLoading}
                      className="w-full py-2.5 px-4 text-xs font-mono uppercase bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start Work (IN PROGRESS)</span>
                    </button>
                  )}

                  {status === ProblemStatus.IN_PROGRESS && (
                    <button
                      onClick={() => handleStatusTransition(ProblemStatus.AWAITING_VERIFICATION, 'Field repairs completed. Requesting supervisory inspection.')}
                      disabled={workflowLoading}
                      className="w-full py-2.5 px-4 text-xs font-mono uppercase bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Submit for Verification</span>
                    </button>
                  )}

                  {status === ProblemStatus.AWAITING_VERIFICATION && (
                    <button
                      onClick={() => handleStatusTransition(ProblemStatus.RESOLVED, 'Repairs inspected and officially validated by supervisor.')}
                      disabled={workflowLoading}
                      className="w-full py-2.5 px-4 text-xs font-mono uppercase bg-emerald-700 text-white hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verify & Resolve (RESOLVED)</span>
                    </button>
                  )}

                  {status === ProblemStatus.RESOLVED && (
                    <button
                      onClick={() => handleStatusTransition(ProblemStatus.CLOSED, 'Incident administrative audit complete. Case closed.')}
                      disabled={workflowLoading}
                      className="w-full py-2.5 px-4 text-xs font-mono uppercase bg-ink-primary text-canvas-card hover:bg-ink-secondary transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Close Case (CLOSED)</span>
                    </button>
                  )}

                  {status === ProblemStatus.CLOSED && (
                    <button
                      onClick={() => handleStatusTransition(ProblemStatus.REOPENED, 'Recurring failure reported. Problem reopened for investigation.')}
                      disabled={workflowLoading}
                      className="w-full py-2.5 px-4 text-xs font-mono uppercase border border-civic-terracotta text-civic-terracotta hover:bg-canvas-subtle transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen Incident (REOPENED)</span>
                    </button>
                  )}

                  {status === ProblemStatus.REOPENED && (
                    <button
                      onClick={() => handleStatusTransition(ProblemStatus.TRIAGED, 'Reopened problem triaged for remediation.')}
                      disabled={workflowLoading}
                      className="w-full py-2.5 px-4 text-xs font-mono uppercase bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Re-triage Incident</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Immutable Timeline */}
              <div className="md:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-ink-border pb-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-ink-primary font-bold">
                    Immutable Audit Trail
                  </h3>
                  <span className="text-[10px] font-mono text-ink-muted uppercase">
                    {timelineEvents.length} Entries Logged
                  </span>
                </div>
                <Timeline events={timelineEvents} />
              </div>
            </div>
          </section>

          {/* SECTION 7: CORRELATED CITIZEN SIGNALS */}
          <section className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-border pb-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta">
                07 // CORRELATED CITIZEN SIGNALS ({members.length > 0 ? members.length : signalCount})
              </div>
              <span className="text-[10px] font-mono text-ink-muted uppercase">Similarity &ge; 70%</span>
            </div>

            <div className="space-y-2">
              {members.length > 0 ? (
                members.map((mem) => {
                  const sig = mem.signal;
                  const simPct = Math.round((mem.similarity || 0.85) * 100);
                  return (
                    <div
                      key={mem.id}
                      className="p-3.5 border border-ink-border bg-canvas-subtle/50 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-primary">{mem.signal_id}</span>
                          <span className="px-1.5 py-0.2 text-[9px] uppercase border border-ink-border bg-canvas-card">
                            {mem.relationship}
                          </span>
                          <span className="text-ink-muted">•</span>
                          <span className="text-ink-secondary">{sig?.category?.replace(/_/g, ' ') || 'public service'}</span>
                        </div>
                        <span className="text-[10px] font-bold text-civic-terracotta">
                          {simPct}% Similarity
                        </span>
                      </div>
                      <p className="text-ink-primary font-serif italic text-sm">
                        &ldquo;{sig?.original_text || 'Citizen incident report.'}&rdquo;
                      </p>
                      <div className="text-[10px] font-mono text-ink-muted flex items-center justify-between pt-1 border-t border-ink-border/40">
                        <span>{mem.reason || 'Correlated via spatial proximity and semantic match.'}</span>
                        {sig?.critical_facility && (
                          <span className="font-semibold text-amber-800">Near {sig.critical_facility}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 border border-ink-border bg-canvas-subtle text-xs font-mono text-ink-secondary">
                  <p className="font-semibold text-ink-primary">
                    {signalCount} citizen signals correlated in cluster #{id}
                  </p>
                  <p>Supporting media assets: {supportingMediaCount} verified photos/videos.</p>
                </div>
              )}
            </div>
          </section>

        </article>

        {/* Modal: Assignment Workflow */}
        {isAssignModalOpen && (
          <div className="fixed inset-0 z-50 bg-ink-primary/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-canvas-card border border-ink-border max-w-md w-full p-6 shadow-elevated space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-ink-primary flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-civic-terracotta" />
                  <span>Assign Incident #{id}</span>
                </h3>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="text-ink-muted hover:text-ink-primary text-xs font-mono font-bold"
                >
                  ✕
                </button>
              </div>

              {status === ProblemStatus.NEW && (
                <div className="p-3 border border-ink-border bg-canvas-subtle text-ink-secondary text-xs font-mono">
                  <strong>Notice:</strong> State is currently NEW. Triage step will automatically be recorded with this assignment.
                </div>
              )}

              <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs font-mono">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-ink-muted">Responsible Department</label>
                  <select
                    value="WATCO"
                    onChange={() => setAssignDept('WATCO')}
                    className="w-full p-2 border border-ink-border bg-canvas-card text-ink-primary focus:outline-none focus:border-civic-terracotta"
                  >
                    {availableDepts
                      .filter((d) => d.id === 'WATCO')
                      .map((d) => (
                        <option key={d.id} value="WATCO">
                          {d.name.includes('WATCO') ? d.name : `WATCO — ${d.name}`}
                        </option>
                      ))}
                    {availableDepts.filter((d) => d.id === 'WATCO').length === 0 && (
                      <option value="WATCO">WATCO — Water Corporation of Odisha</option>
                    )}
                  </select>
                  <p className="text-[10px] text-ink-muted">CivicPulse operates with WATCO as the authoritative operational department.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-ink-muted">Eligible Field Officer</label>
                  <select
                    value={assignOfficer}
                    onChange={(e) => setAssignOfficer(e.target.value)}
                    className="w-full p-2 border border-ink-border bg-canvas-card text-ink-primary focus:outline-none focus:border-civic-terracotta"
                  >
                    {deptOfficers.length === 0 ? (
                      <option value="">No field officers registered</option>
                    ) : (
                      deptOfficers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.display_name ? `${o.display_name} (${o.email || o.id})` : o.id}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-ink-muted">Work Order Priority</label>
                  <select
                    value={assignPriority}
                    onChange={(e) => setAssignPriority(e.target.value)}
                    className="w-full p-2 border border-ink-border bg-canvas-card text-ink-primary focus:outline-none focus:border-civic-terracotta"
                  >
                    <option value="CRITICAL">Critical (Immediate dispatch)</option>
                    <option value="HIGH">High (Within SLA target)</option>
                    <option value="MEDIUM">Medium (Standard queue)</option>
                    <option value="LOW">Low (Routine maintenance)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-ink-muted">Dispatch Instructions</label>
                  <textarea
                    rows={3}
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    className="w-full p-2 border border-ink-border bg-canvas-card text-ink-primary font-sans focus:outline-none focus:border-civic-terracotta"
                    placeholder="Provide specific engineering instructions for field crew..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink-border">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="px-3 py-2 text-ink-secondary hover:text-ink-primary text-xs font-mono uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={workflowLoading}
                    className="px-4 py-2 bg-civic-terracotta text-white font-mono uppercase text-xs hover:bg-civic-terracottaDark disabled:opacity-60"
                  >
                    {workflowLoading ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </GovernmentShell>
  );
}
