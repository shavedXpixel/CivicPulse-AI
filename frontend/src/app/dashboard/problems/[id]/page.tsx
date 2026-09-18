'use client';

import React, { use, useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { ImpactScore } from '../../../../components/domain/ImpactScore';
import { ImpactBreakdown } from '../../../../components/domain/ImpactBreakdown';
import { StatusBadge } from '../../../../components/domain/StatusBadge';
import { Timeline } from '../../../../components/domain/Timeline';
import { AIInsight } from '../../../../components/domain/AIInsight';
import { ResolutionWorkspace } from '../../../../components/domain/ResolutionWorkspace';
import { DEMO_PROBLEMS } from '../../../../lib/mockData';
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
  UserCheck,
  Sliders,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

const PERSONAS = [
  { id: 'dept_watco', label: 'Er. Subrat (Dept Officer - WATCO)', role: 'DEPARTMENT_OFFICER', name: 'Er. Subrat Jena', token: 'demo-token-dept-watco' },
  { id: 'officer_rajesh', label: 'Rajesh K. (Assigned Field Officer)', role: 'FIELD_OFFICER', name: 'Rajesh K.', token: 'demo-token-officer' },
  { id: 'officer_suresh', label: 'Suresh P. (Unassigned Field Officer)', role: 'FIELD_OFFICER', name: 'Suresh P.', token: 'demo-token-field-drainage' },
  { id: 'admin', label: 'Commissioner (Admin)', role: 'ADMIN', name: 'Municipal Commissioner', token: 'demo-token-admin' },
  { id: 'citizen', label: 'Aarav (Citizen - Public View)', role: 'CITIZEN', name: 'Aarav Patnaik', token: 'demo-token-citizen' },
] as const;

export default function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, userProfile, isDemoMode } = useAuth();
  const fallbackProblem = isDemoMode ? (DEMO_PROBLEMS.find((p) => p.id === id) || DEMO_PROBLEMS[0]!) : null;

  const [personaId, setPersonaId] = useState<string>('dept_watco');
  const activePersona = PERSONAS.find((p) => p.id === personaId) || PERSONAS[0]!;
  const authHeaders = useMemo(() => {
    return isDemoMode ? { Authorization: `Bearer ${activePersona.token}` } : undefined;
  }, [isDemoMode, activePersona.token]);

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
  const [assignOfficer, setAssignOfficer] = useState<string>('usr_officer_01');
  const [assignPriority, setAssignPriority] = useState<string>('HIGH');
  const [assignNotes, setAssignNotes] = useState<string>('Dispatched emergency engineering team for pipeline excavation and valve repair.');
  
  // Action Logging State
  const [transitionNote, setTransitionNote] = useState<string>('');
  const [workflowLoading, setWorkflowLoading] = useState<boolean>(false);
  const [workflowSuccess, setWorkflowSuccess] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState<boolean>(false);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ProblemClusterDetail }>(
        `/api/v1/problems/${id}/details`,
        authHeaders
      );
      if (res?.data) {
        setLiveProblem(res.data);
        setIsConflict(false);
      }
    } catch (err) {
      console.warn('Could not fetch live problem details, rendering fallback:', err);
    }
  }, [id, authHeaders]);

  const fetchActions = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ProblemAction[] }>(
        `/api/v1/problems/${id}/timeline`,
        authHeaders
      ).catch(() =>
        apiClient.get<{ data: ProblemAction[] }>(
          `/api/v1/problems/${id}/actions`,
          authHeaders
        )
      );
      if (res?.data) {
        setLiveActions(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch actions timeline:', err);
    }
  }, [id, authHeaders]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: any[] }>('/api/v1/departments', authHeaders);
      if (res?.data && res.data.length > 0) {
        setAvailableDepts(res.data.map((d) => ({ id: d.id, name: d.name || d.id })));
      } else {
        setAvailableDepts([
          { id: 'WATCO', name: 'WATCO — Water Corporation of Odisha' },
          { id: 'BMC_DRAINAGE', name: 'BMC Drainage & Stormwater Division' },
          { id: 'BMC_ROADS', name: 'BMC Roads & Engineering' },
          { id: 'BMC_SAN', name: 'BMC Solid Waste Management' },
          { id: 'TPCODL', name: 'TP Central Odisha Distribution Ltd (Power)' },
        ]);
      }
    } catch {
      setAvailableDepts([
        { id: 'WATCO', name: 'WATCO — Water Corporation of Odisha' },
        { id: 'BMC_DRAINAGE', name: 'BMC Drainage & Stormwater Division' },
        { id: 'BMC_ROADS', name: 'BMC Roads & Engineering' },
        { id: 'BMC_SAN', name: 'BMC Solid Waste Management' },
        { id: 'TPCODL', name: 'TP Central Odisha Distribution Ltd (Power)' },
      ]);
    }
  }, [authHeaders]);

  const fetchOfficersForDept = useCallback(async (deptId: string) => {
    try {
      const res = await apiClient.get<{ data: any[] }>(
        `/api/v1/departments/${deptId}/officers`,
        authHeaders
      );
      if (res?.data && res.data.length > 0 && res.data[0]) {
        setDeptOfficers(res.data);
        setAssignOfficer(res.data[0].id);
      } else {
        if (isDemoMode) {
          const fallbackOfficers = [
            { id: 'usr_officer_01', display_name: 'Rajesh K. (Field Engineer)' },
            { id: 'usr_field_drainage', display_name: 'Suresh P. (Field Officer)' },
          ];
          setDeptOfficers(fallbackOfficers);
          setAssignOfficer(fallbackOfficers[0]!.id);
        } else {
          setDeptOfficers([]);
          setAssignOfficer('');
        }
      }
    } catch {
      if (isDemoMode) {
        setDeptOfficers([
          { id: 'usr_officer_01', display_name: 'Rajesh K. (Field Engineer)' },
          { id: 'usr_field_drainage', display_name: 'Suresh P. (Field Officer)' },
        ]);
        setAssignOfficer('usr_officer_01');
      } else {
        setDeptOfficers([]);
        setAssignOfficer('');
      }
    }
  }, [authHeaders, isDemoMode]);

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
        {},
        authHeaders
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

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkflowLoading(true);
    setWorkflowSuccess(null);
    setWorkflowError(null);
    setIsConflict(false);
    try {
      // If problem is currently NEW, transition to TRIAGED first to satisfy canonical lifecycle
      if (status === ProblemStatus.NEW) {
        await apiClient.patch(
          `/api/v1/problems/${id}/status`,
          {
            status: ProblemStatus.TRIAGED,
            note: 'Automated triage before official assignment.',
          },
          authHeaders
        );
      }

      await apiClient.post(
        `/api/v1/problems/${id}/assign`,
        {
          department_id: assignDept,
          assigned_to: assignOfficer,
          priority: assignPriority,
          notes: assignNotes,
        },
        authHeaders
      );
      setWorkflowSuccess(`Problem assigned to ${assignDept} (${assignOfficer}) successfully.`);
      setIsAssignModalOpen(false);
      await Promise.all([fetchDetails(), fetchActions()]);
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.includes('conflict') || err.message?.includes('concurrent')) {
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
    setIsConflict(false);
    const finalNote = transitionNote.trim() || defaultNote;
    try {
      await apiClient.patch(
        `/api/v1/problems/${id}/status`,
        {
          status: newStatus,
          note: finalNote,
          notes: finalNote,
        },
        authHeaders
      );
      setWorkflowSuccess(`Status transitioned to ${newStatus}.`);
      setTransitionNote('');
      await Promise.all([fetchDetails(), fetchActions()]);
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.includes('conflict') || err.message?.includes('concurrent')) {
        setIsConflict(true);
        setWorkflowError('The problem state changed while you were viewing it. Please refresh and try again.');
      } else {
        setWorkflowError(err.message || 'Status transition failed');
      }
    } finally {
      setWorkflowLoading(false);
    }
  };

  // Resolved values blending live API data with rich fallbacks in demo mode only
  const isDemo = liveProblem?.is_demo ?? (id === 'PRB-2026-0819');
  const title = liveProblem?.title || fallbackProblem?.title || 'Unknown Incident';
  const status = (liveProblem?.status || fallbackProblem?.status || ProblemStatus.NEW) as ProblemStatus;
  const department = liveProblem?.department_id || fallbackProblem?.department || 'Unassigned';
  const assignedTo = liveProblem?.assigned_to;
  const wardName = liveProblem?.ward_id ? `Ward ${liveProblem.ward_id.replace(/\D/g, '') || '18'} (Nayapalli, Bhubaneswar)` : (fallbackProblem?.wardName || 'Ward 18 (Nayapalli, Bhubaneswar)');
  const signalCount = liveProblem?.signal_count || fallbackProblem?.signalCount || 0;
  const supportingMediaCount = liveProblem?.supporting_media_count ?? fallbackProblem?.supporting_media_count ?? (isDemo ? 42 : 0);
  const impactScore = liveProblem?.impact_score ?? fallbackProblem?.impactScore ?? 0;
  const impactLevel = liveProblem?.impact_level || fallbackProblem?.severity || 'LOW';
  const explanation = liveProblem?.impact_explanation || fallbackProblem?.aiSummary || 'No impact assessment synthesized.';
  const sla = liveProblem?.sla_state;

  const breakdown = {
    severity: liveProblem?.severity_score ?? fallbackProblem?.impactBreakdown?.severity ?? 0,
    population: liveProblem?.population_score ?? fallbackProblem?.impactBreakdown?.population ?? 0,
    duration: liveProblem?.duration_score ?? fallbackProblem?.impactBreakdown?.duration ?? 0,
    concentration: liveProblem?.concentration_score ?? fallbackProblem?.impactBreakdown?.concentration ?? 0,
    facilities: liveProblem?.critical_exposure_score ?? fallbackProblem?.impactBreakdown?.facilities ?? 0,
    recurrence: liveProblem?.recurrence_score ?? fallbackProblem?.impactBreakdown?.recurrence ?? 0,
    evidence: liveProblem?.evidence_score ?? fallbackProblem?.impactBreakdown?.evidence ?? 0,
  };

  const provenance = liveProblem?.data_provenance || (isDemo ? {
    geography: 'SYNTHETIC' as const,
    population: 'SYNTHETIC' as const,
    facility: 'SYNTHETIC' as const,
  } : undefined);

  const getProvenanceBadge = (src?: string) => {
    if (src === 'REAL') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Real
        </span>
      );
    }
    if (src === 'ESTIMATED') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          Estimated
        </span>
      );
    }
    if (src === 'SYNTHETIC') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
          Synthetic demo
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-canvas-subtle text-ink-tertiary border border-ink-border">
        Unknown
      </span>
    );
  };

  const members: ProblemClusterMember[] = liveProblem?.members || [];

  // Map live actions to timeline events
  const timelineEvents = liveActions.length > 0
    ? liveActions.map((act) => ({
        id: act.id,
        timestamp: new Date(act.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }),
        actor: `${act.actor_id || 'System'} (${act.action_type.replace(/_/g, ' ')})`,
        action: act.action_type.replace(/_/g, ' '),
        description: act.note || (act.metadata ? JSON.stringify(act.metadata) : 'Audit action recorded.'),
        isCompleted: true,
      }))
    : [
        {
          id: '1',
          timestamp: 'Sep 5, 06:30 AM',
          actor: 'Civic Intelligence Engine',
          action: 'Cluster Created from Citizen Signals',
          description: 'Correlated initial citizen signals into unified high-pressure pipe rupture incident.',
          isCompleted: true,
        },
        {
          id: '2',
          timestamp: 'Sep 5, 08:45 AM',
          actor: 'CivicPulse Impact Engine',
          action: 'Deterministic Public Impact Evaluated (92/100)',
          description: 'Deterministic 7-factor engine calculated score 92 (CRITICAL) based on facility exposure and outage duration.',
          isCompleted: true,
        },
        {
          id: '3',
          timestamp: 'Sep 5, 10:15 AM',
          actor: 'WATCO Dispatcher',
          action: 'Emergency Response Triaged & Assigned',
          description: 'Valve isolation scheduled and emergency pipe excavation unit assigned to Rajesh K. (usr_officer_01).',
          isCompleted: true,
          isCurrent: true,
        },
      ];

  // Format SLA display values
  const slaStatus = sla?.status || (impactLevel === 'CRITICAL' ? 'AT_RISK' : 'ON_TRACK');
  const slaTargetHours = sla?.target_hours ?? (impactLevel === 'CRITICAL' ? 24 : 48);
  const slaRemainingHours = sla?.hours_remaining ?? 3.25;

  if (loading && !liveProblem) {
    return (
      <GovernmentShell>
        <div className="space-y-6 max-w-6xl mx-auto py-12">
          <div className="h-8 w-64 bg-canvas-muted animate-pulse rounded-lg" />
          <div className="h-96 bg-canvas-muted animate-pulse rounded-xl" />
        </div>
      </GovernmentShell>
    );
  }

  if (!isDemoMode && !liveProblem) {
    return (
      <GovernmentShell>
        <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-ink-primary">Problem Cluster Not Found</h2>
          <p className="text-xs text-ink-secondary max-w-md mx-auto">
            Problem cluster <code className="font-mono text-ink-primary font-bold">{id}</code> does not exist in live PostgreSQL or you do not have permission to view it.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard/problems"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark transition-colors"
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
        {/* Navigation Breadcrumb & Contextual Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-ink-border/50">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/problems"
              className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Problems Directory</span>
            </Link>
            <span className="text-ink-border">•</span>
            <Link
              href="/dashboard"
              className="text-xs text-ink-secondary hover:text-ink-primary font-medium"
            >
              Operations Overview
            </Link>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/dashboard/ai?problemId=${id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-civic-blueLight text-civic-blueDark hover:bg-civic-blue hover:text-white transition-colors border border-civic-blue/20 shadow-subtle"
            >
              <span>Governance AI</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              href={`/dashboard/simulation?problemId=${id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors border border-amber-300 shadow-subtle"
            >
              <Sliders className="w-3 h-3" />
              <span>Simulate Intervention</span>
            </Link>
            {isDemo && (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                SYNTHETIC DEMO
              </span>
            )}
          </div>
        </div>

        {/* Evaluation Persona Switcher (DEMO_MODE) OR Verified Operator Banner (REAL_MODE) */}
        {isDemoMode ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white border border-ink-border shadow-subtle text-xs gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-civic-blue" />
              <span className="font-bold text-ink-primary">Testing Persona:</span>
              <span className="font-mono text-ink-secondary">{activePersona.label}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonaId(p.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-colors text-[11px] ${
                    personaId === p.id
                      ? 'bg-civic-blue text-white shadow-subtle'
                      : 'bg-canvas-subtle border border-ink-border text-ink-secondary hover:bg-white'
                  }`}
                >
                  {p.id === 'dept_watco'
                    ? 'WATCO Officer'
                    : p.id === 'officer_rajesh'
                    ? 'Assigned Officer (Rajesh)'
                    : p.id === 'officer_suresh'
                    ? 'Unassigned (Suresh)'
                    : p.id === 'admin'
                    ? 'Admin'
                    : 'Citizen (Public)'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white border border-ink-border shadow-subtle text-xs gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-civic-emerald" />
              <span className="font-bold text-ink-primary">Verified Operator:</span>
              <span className="font-semibold text-ink-primary">{userProfile?.display_name || user?.email}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-civic-blueLight text-civic-blueDark">
                {userProfile?.role === 'ADMIN' ? 'MUNICIPAL_ADMIN' : `${userProfile?.department_id || 'WATCO'} SUPERVISOR`}
              </span>
            </div>
            <div className="text-[11px] text-ink-tertiary font-mono">
              Live Operations Authority • PostgreSQL (Supabase)
            </div>
          </div>
        )}

        {/* Problem Header (Section 1) */}
        <PageHeader
          title={title}
          description={`Incident ID: ${id} • Ward: ${wardName} • Department: ${department || 'Unassigned'}`}
          badge={<StatusBadge status={status} />}
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Problems', href: '/dashboard/problems' },
            { label: id },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setLoading(true);
                  await Promise.all([fetchDetails(), fetchActions()]);
                  setLoading(false);
                }}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle shadow-subtle transition-colors flex items-center gap-1.5"
                title="Refresh problem details"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-ink-tertiary ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleRecalculateImpact}
                disabled={recalculating}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle shadow-subtle transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-ink-tertiary ${recalculating ? 'animate-spin' : ''}`} />
                <span>{recalculating ? 'Recalculating...' : 'Recalculate Impact'}</span>
              </button>
            </div>
          }
        />

        {/* Concurrency / 409 Conflict Banner */}
        {isConflict && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <strong className="block">Concurrency Conflict (409)</strong>
                <span>The problem changed while you were viewing it. Refresh to inspect the latest state.</span>
              </div>
            </div>
            <button
              onClick={() => {
                fetchDetails();
                fetchActions();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 transition-colors"
            >
              Refresh Now
            </button>
          </div>
        )}

        {/* Workflow Alerts */}
        {workflowSuccess && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{workflowSuccess}</span>
          </div>
        )}

        {workflowError && !isConflict && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{workflowError}</span>
          </div>
        )}

        {recalcSuccess && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{recalcSuccess}</span>
          </div>
        )}

        {/* Two-Column Problem Operations Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Column (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Why This Matters Section (Section 5) */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider">
                  Why This Matters & AI Grounding
                </h3>
                <span className="text-xs text-civic-rose font-semibold">
                  {impactLevel} Urgency ({impactScore}/100)
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2.5 text-xs text-ink-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-rose mt-1.5 shrink-0" />
                  <span className="leading-relaxed">
                    Municipal infrastructure cluster disrupting citizen mobility, water security, or public facilities.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-ink-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-rose mt-1.5 shrink-0" />
                  <span className="leading-relaxed">
                    Prioritized deterministically using the canonical 7-factor civic impact formula.
                  </span>
                </div>
              </div>

              <AIInsight
                title="Intelligence Summary & Impact Rationale"
                confidence="High"
                citations={[`Cluster #${id}`, '7-Factor Deterministic Impact Matrix']}
              >
                {explanation}
              </AIInsight>
            </div>

            {/* Resolution Evidence & AI Advisory Verification Workspace */}
            <ResolutionWorkspace
              problemId={id}
              problemTitle={title}
              problemCategory={liveProblem?.category || fallbackProblem?.category || 'MUNICIPAL'}
              problemStatus={status}
              assignedTo={assignedTo}
              departmentId={department}
              authToken={isDemoMode ? activePersona.token : ''}
              userRole={isDemoMode ? activePersona.role : (userProfile?.role || 'DEPARTMENT_OFFICER')}
              userName={isDemoMode ? activePersona.name : (userProfile?.display_name || user?.displayName || user?.email || 'Government Officer')}
              onStatusChange={async () => {
                await Promise.all([fetchDetails(), fetchActions()]);
              }}
            />

            {/* Supporting Correlated Signals Batch (Section 9) */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider">
                    Correlated Citizen Signals ({members.length > 0 ? members.length : signalCount})
                  </h3>
                  <p className="text-xs text-ink-secondary">
                    Linked using semantic cosine similarity, geographic proximity, and temporal decay
                  </p>
                </div>
                <span className="text-xs font-semibold text-civic-blue">Similarity &ge; 70%</span>
              </div>

              <div className="space-y-2.5">
                {members.length > 0 ? (
                  members.map((mem) => {
                    const sig = mem.signal;
                    const simPct = Math.round((mem.similarity || 0.85) * 100);
                    return (
                      <div
                        key={mem.id}
                        className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink-primary font-mono">{mem.signal_id}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                mem.relationship === 'DUPLICATE'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {mem.relationship}
                            </span>
                            <span className="text-ink-tertiary">•</span>
                            <span className="text-ink-secondary">{sig?.category?.replace(/_/g, ' ') || 'public service'}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-civic-blue">
                            {simPct}% Similarity
                          </span>
                        </div>

                        <p className="text-ink-primary font-medium italic">
                          &ldquo;{sig?.original_text || 'Citizen incident report.'}&rdquo;
                        </p>

                        <div className="text-[11px] text-ink-secondary flex items-center justify-between pt-1 border-t border-ink-border/40">
                          <span>{mem.reason || 'Correlated via spatial proximity and semantic match.'}</span>
                          {sig?.critical_facility && (
                            <span className="font-semibold text-amber-800">
                              Near {sig.critical_facility}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 rounded-lg bg-canvas-subtle border border-ink-border text-xs text-ink-secondary space-y-1">
                    <p className="font-semibold text-ink-primary">
                      {signalCount} citizen signals correlated in cluster #{id}
                    </p>
                    <p>Supporting media assets: {supportingMediaCount} verified photos/videos.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Operational Event Audit Timeline (Section 8) */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider">
                  Operational Event Audit Timeline
                </h3>
                <span className="text-xs text-ink-tertiary font-mono">
                  {timelineEvents.length} Immutable Audit Entries
                </span>
              </div>
              <Timeline events={timelineEvents} />
            </div>
          </div>

          {/* Right Rail Operations (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Operations Lifecycle & Assignment Card (Sections 2 & 6) */}
            <div className="p-6 rounded-xl border border-civic-blue/30 bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <span className="text-xs uppercase tracking-wider text-ink-secondary font-bold flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-civic-blue" />
                  <span>Operations Workflow</span>
                </span>
                <StatusBadge status={status} />
              </div>

              {/* Current Assignment Status Bar (Section 2) */}
              <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink-tertiary uppercase font-semibold text-[10px]">DEPARTMENT</span>
                  <span className="font-bold text-ink-primary">{department || 'Not Assigned'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-tertiary uppercase font-semibold text-[10px]">ASSIGNED OFFICER</span>
                  <span className="font-mono text-ink-primary font-semibold">{assignedTo || 'Unassigned'}</span>
                </div>
              </div>

              {/* Action Note Input (Section 6) */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-semibold text-ink-secondary flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-ink-tertiary" />
                  <span>Audit Action Note (Optional)</span>
                </label>
                <input
                  type="text"
                  value={transitionNote}
                  onChange={(e) => setTransitionNote(e.target.value)}
                  placeholder="Reason for state transition or dispatch..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-ink-border bg-white text-xs text-ink-primary focus:ring-1 focus:ring-civic-blue"
                />
              </div>

              {/* Lifecycle Step Actions (Section 6) */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-ink-secondary">Available State Actions:</div>

                {/* Triage Action (for NEW problems) */}
                {status === ProblemStatus.NEW && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.TRIAGED, 'Problem triaged by department dispatcher.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-blue-700 shadow-subtle flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Triage Problem (Mark TRIAGED)</span>
                  </button>
                )}

                {/* Assign / Reassign Button */}
                {(status === ProblemStatus.NEW || status === ProblemStatus.TRIAGED || status === ProblemStatus.ASSIGNED || status === ProblemStatus.IN_PROGRESS) && (
                  <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-civic-blue text-civic-blue hover:bg-civic-blueLight/40 shadow-subtle flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{assignedTo ? 'Reassign Department & Officer' : 'Assign Department & Officer'}</span>
                  </button>
                )}

                {/* Start Work Action */}
                {status === ProblemStatus.ASSIGNED && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.IN_PROGRESS, 'Field crew dispatched and commenced site intervention.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-blue-700 shadow-subtle flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start Work (IN PROGRESS)</span>
                  </button>
                )}

                {/* Request Verification Action */}
                {status === ProblemStatus.IN_PROGRESS && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.AWAITING_VERIFICATION, 'Field repairs completed. Requesting supervisory inspection.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-civic-amber text-white hover:bg-amber-600 shadow-subtle flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Submit for Verification</span>
                  </button>
                )}

                {/* Resolve Action */}
                {status === ProblemStatus.AWAITING_VERIFICATION && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.RESOLVED, 'Repairs inspected and officially validated by supervisor.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-civic-emerald text-white hover:bg-emerald-700 shadow-subtle flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify & Resolve (RESOLVED)</span>
                  </button>
                )}

                {/* Close Action */}
                {status === ProblemStatus.RESOLVED && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.CLOSED, 'Incident administrative audit complete. Case closed.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5 text-ink-tertiary" />
                    <span>Close Case (CLOSED)</span>
                  </button>
                )}

                {/* Reopen Action */}
                {status === ProblemStatus.CLOSED && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.REOPENED, 'Recurring failure reported. Problem reopened for investigation.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-rose-300 text-civic-rose hover:bg-rose-50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen Incident (REOPENED)</span>
                  </button>
                )}

                {/* Re-triage Action */}
                {status === ProblemStatus.REOPENED && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.TRIAGED, 'Reopened problem triaged for remediation.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-civic-blue" />
                    <span>Re-triage Incident</span>
                  </button>
                )}
              </div>
            </div>

            {/* Deterministic SLA Tracking Card (Section 3) */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <span className="uppercase tracking-wider text-ink-secondary font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-civic-amber" />
                  <span>SLA Countdown & Status</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    slaStatus === 'BREACHED'
                      ? 'bg-civic-roseLight text-civic-rose'
                      : slaStatus === 'AT_RISK'
                      ? 'bg-civic-amberLight text-amber-900'
                      : 'bg-civic-emeraldLight text-emerald-800'
                  }`}
                >
                  {slaStatus}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Deterministic SLA Target:</span>
                  <span className="font-mono font-bold text-ink-primary">
                    {slaTargetHours} hours
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Calculated Deadline:</span>
                  <span className="font-mono text-ink-primary">
                    {sla?.due_at
                      ? new Date(sla.due_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                      : 'Deterministic 24h'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Remaining / Overdue:</span>
                  <span
                    className={`font-mono font-bold ${
                      slaStatus === 'BREACHED'
                        ? 'text-civic-rose'
                        : slaStatus === 'AT_RISK'
                        ? 'text-amber-700'
                        : 'text-civic-emerald'
                    }`}
                  >
                    {slaStatus === 'BREACHED'
                      ? `Breached by ${Math.abs(Math.round(slaRemainingHours))}h`
                      : slaStatus === 'MET'
                      ? 'SLA Met'
                      : `${Math.max(0, Math.round(slaRemainingHours))}h remaining`}
                  </span>
                </div>
              </div>

              {/* Historical SLA Breach Guardrail Alert */}
              {sla?.was_breached && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-700">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Permanent Breach Recorded</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-snug">
                    SLA target was exceeded prior to resolution. Retained permanently in immutable municipal audit records.
                  </p>
                </div>
              )}
            </div>

            {/* 7-Factor Deterministic Impact Card (Section 4) */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-secondary font-semibold">
                  Deterministic Public Impact
                </span>
                <span className="text-xs text-civic-rose font-bold">
                  {impactScore}/100 ({impactLevel})
                </span>
              </div>

              <ImpactScore score={impactScore} size="lg" />

              <ImpactBreakdown
                severity={breakdown.severity}
                population={breakdown.population}
                duration={breakdown.duration}
                concentration={breakdown.concentration}
                facilities={breakdown.facilities}
                recurrence={breakdown.recurrence}
                evidence={breakdown.evidence}
              />

              {/* Provenance Indicator for Enrichment Factors */}
              <div className="pt-3 border-t border-ink-border/60 flex items-center justify-between text-[11px]">
                <span className="text-ink-secondary font-medium">Data Provenance:</span>
                <div className="flex items-center gap-2">
                  <span className="text-ink-tertiary text-[10px]">Pop:</span>
                  {getProvenanceBadge(provenance?.population)}
                  <span className="text-ink-tertiary text-[10px]">Facility:</span>
                  {getProvenanceBadge(provenance?.facility)}
                </div>
              </div>
            </div>

            {/* Location & GIS Card */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-3 text-xs">
              <div className="flex items-center justify-between text-ink-secondary">
                <span className="uppercase font-semibold tracking-wider">Location & GIS</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono">{liveProblem?.ward_id || 'WARD-018'}</span>
                  {getProvenanceBadge(provenance?.geography)}
                </div>
              </div>

              <div className="flex items-start gap-2 text-ink-primary font-medium">
                <MapPin className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
                <span>Nayapalli Ward 18, Bhubaneswar</span>
              </div>

              <div className="h-24 rounded-lg bg-canvas-subtle border border-ink-border flex flex-col items-center justify-center p-3 text-center text-ink-tertiary">
                <MapPin className="w-5 h-5 text-civic-rose mb-1" />
                <span className="font-mono text-[11px] text-ink-secondary">
                  Lat: 20.2961 • Lng: 85.8245
                </span>
                <span className="text-[10px]">Nayapalli Corridor, Bhubaneswar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Real Assignment Workflow (Section 7) */}
        {isAssignModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-modal border border-ink-border space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-civic-blue" />
                  <span>Assign Problem #{id}</span>
                </h3>
                <button
                  onClick={() => setIsAssignModalOpen(false)}
                  className="text-ink-tertiary hover:text-ink-primary text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {status === ProblemStatus.NEW && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs">
                  <strong>Note:</strong> This incident is currently in state <strong>NEW</strong>. Triage step will automatically be recorded with this assignment.
                </div>
              )}

              <form onSubmit={handleAssign} className="space-y-4 text-xs">
                {/* Department Selection */}
                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Responsible Department</label>
                  <select
                    value={assignDept}
                    onChange={(e) => setAssignDept(e.target.value)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue"
                  >
                    {availableDepts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Eligible Officer Selection */}
                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Eligible Field Officer</label>
                  <select
                    value={assignOfficer}
                    onChange={(e) => setAssignOfficer(e.target.value)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue font-mono"
                  >
                    {deptOfficers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} — {o.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Work Order Priority</label>
                  <select
                    value={assignPriority}
                    onChange={(e) => setAssignPriority(e.target.value)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue font-medium"
                  >
                    <option value="CRITICAL">Critical (Immediate dispatch)</option>
                    <option value="HIGH">High (Within SLA target)</option>
                    <option value="MEDIUM">Medium (Standard queue)</option>
                    <option value="LOW">Low (Routine maintenance)</option>
                  </select>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Dispatch Instructions & Notes</label>
                  <textarea
                    rows={3}
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue"
                    placeholder="Provide specific engineering instructions for field officer..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-border/60">
                  <button
                    type="button"
                    onClick={() => setIsAssignModalOpen(false)}
                    className="px-3 py-2 rounded-lg text-ink-secondary hover:bg-canvas-subtle"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={workflowLoading}
                    className="px-4 py-2 rounded-lg bg-civic-blue text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
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
