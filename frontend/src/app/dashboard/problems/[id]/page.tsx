'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
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
  const fallbackProblem = DEMO_PROBLEMS.find((p) => p.id === id) || DEMO_PROBLEMS[0]!;

  const [personaId, setPersonaId] = useState<string>('dept_watco');
  const activePersona = PERSONAS.find((p) => p.id === personaId) || PERSONAS[0]!;

  const [liveProblem, setLiveProblem] = useState<ProblemClusterDetail | null>(null);
  const [liveActions, setLiveActions] = useState<ProblemAction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [recalcSuccess, setRecalcSuccess] = useState<string | null>(null);

  // Operations Workflow State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [assignDept, setAssignDept] = useState<string>('WATCO');
  const [assignOfficer, setAssignOfficer] = useState<string>('usr_officer_01');
  const [assignNotes, setAssignNotes] = useState<string>('Dispatched emergency engineering team for valve replacement.');
  const [workflowLoading, setWorkflowLoading] = useState<boolean>(false);
  const [workflowSuccess, setWorkflowSuccess] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ProblemClusterDetail }>(
        `/api/v1/problems/${id}/details`,
        { Authorization: `Bearer ${activePersona.token}` }
      );
      if (res?.data) {
        setLiveProblem(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch live problem details, rendering client fallback data:', err);
    }
  }, [id, activePersona.token]);

  const fetchActions = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: ProblemAction[] }>(
        `/api/v1/problems/${id}/actions`,
        { Authorization: `Bearer ${activePersona.token}` }
      );
      if (res?.data) {
        setLiveActions(res.data);
      }
    } catch (err) {
      console.warn('Could not fetch actions:', err);
    }
  }, [id, activePersona.token]);


  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      await Promise.all([fetchDetails(), fetchActions()]);
      if (mounted) setLoading(false);
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [fetchDetails, fetchActions]);

  const handleRecalculateImpact = async () => {
    setRecalculating(true);
    setRecalcSuccess(null);
    try {
      const res = await apiClient.post<{ data: ProblemClusterDetail }>(
        `/api/v1/problems/${id}/recalculate-impact`,
        {},
        { Authorization: `Bearer ${activePersona.token}` }
      );
      if (res?.data) {
        setLiveProblem((prev) => (prev ? { ...prev, ...res.data } : res.data));
        setRecalcSuccess(`Impact recomputed deterministically: ${res.data.impact_score}/100 (${res.data.impact_level})`);
      }
    } catch (err: any) {
      console.error('Impact recalculation error:', err);
    } finally {
      setRecalculating(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkflowLoading(true);
    setWorkflowSuccess(null);
    setWorkflowError(null);
    try {
      await apiClient.post(
        `/api/v1/problems/${id}/assign`,
        {
          department_id: assignDept,
          assigned_to: assignOfficer,
          notes: assignNotes,
        },
        { Authorization: `Bearer ${activePersona.token}` }
      );
      setWorkflowSuccess(`Problem assigned to ${assignDept} (${assignOfficer}) successfully.`);
      setIsAssignModalOpen(false);
      await Promise.all([fetchDetails(), fetchActions()]);
    } catch (err: any) {
      setWorkflowError(err.message || 'Assignment failed');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleStatusTransition = async (newStatus: ProblemStatus, notes?: string) => {
    setWorkflowLoading(true);
    setWorkflowSuccess(null);
    setWorkflowError(null);
    try {
      await apiClient.patch(
        `/api/v1/problems/${id}/status`,
        {
          status: newStatus,
          notes: notes || `Operational status transitioned to ${newStatus}.`,
        },
        { Authorization: `Bearer ${activePersona.token}` }
      );
      setWorkflowSuccess(`Status transitioned to ${newStatus}.`);
      await Promise.all([fetchDetails(), fetchActions()]);
    } catch (err: any) {
      setWorkflowError(err.message || 'Status transition failed');
    } finally {
      setWorkflowLoading(false);
    }
  };

  // Resolved values blending live API data with rich visual fallbacks
  const isDemo = liveProblem?.is_demo ?? (id === 'PRB-2026-0819');
  const title = liveProblem?.title || fallbackProblem.title;
  const status = (liveProblem?.status || fallbackProblem.status) as ProblemStatus;
  const department = liveProblem?.department_id || fallbackProblem.department;
  const assignedTo = liveProblem?.assigned_to;
  const wardName = liveProblem?.ward_id ? `Ward ${liveProblem.ward_id.replace(/\D/g, '') || '18'} (Nayapalli, Bhubaneswar)` : fallbackProblem.wardName;
  const signalCount = liveProblem?.signal_count || fallbackProblem.signalCount;
  const supportingMediaCount = liveProblem?.supporting_media_count ?? fallbackProblem.supporting_media_count ?? 42;
  const impactScore = liveProblem?.impact_score ?? fallbackProblem.impactScore;
  const impactLevel = liveProblem?.impact_level || fallbackProblem.severity;
  const explanation = liveProblem?.impact_explanation || fallbackProblem.aiSummary;
  const sla = liveProblem?.sla_state;

  const breakdown = {
    severity: liveProblem?.severity_score ?? fallbackProblem.impactBreakdown.severity,
    population: liveProblem?.population_score ?? fallbackProblem.impactBreakdown.population,
    duration: liveProblem?.duration_score ?? fallbackProblem.impactBreakdown.duration,
    concentration: liveProblem?.concentration_score ?? fallbackProblem.impactBreakdown.concentration,
    facilities: liveProblem?.critical_exposure_score ?? fallbackProblem.impactBreakdown.facilities,
    recurrence: liveProblem?.recurrence_score ?? fallbackProblem.impactBreakdown.recurrence,
    evidence: liveProblem?.evidence_score ?? fallbackProblem.impactBreakdown.evidence,
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

  // Map live actions to timeline events if available
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
              <span>Back to Problems</span>
            </Link>
            <span className="text-ink-border">•</span>
            <Link
              href="/dashboard"
              className="text-xs text-ink-secondary hover:text-ink-primary font-medium"
            >
              Command Center
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

        {/* Evaluation Persona Switcher for RBAC & Verification Testing */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-white border border-ink-border shadow-subtle text-xs gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-civic-blue" />
            <span className="font-bold text-ink-primary">Testing Role Persona:</span>
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

        {/* Demo Data Banner if synthetic */}
        {isDemo && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-amber-900">
                Golden Demo Presentation Metadata (Phase 4 & 5)
              </p>
              <p className="text-amber-800 leading-relaxed">
                Aggregate metadata represents <strong>{signalCount} citizen reports</strong> and <strong>{supportingMediaCount} media records</strong> across Nayapalli Ward 18.
                Live operations state machine and deterministic SLA tracking are fully enabled.
              </p>
            </div>
          </div>
        )}

        {/* Problem Header */}
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
              <Link
                href={`/dashboard/simulation?problemId=${id}`}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark shadow-subtle transition-colors flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Simulate Intervention</span>
              </Link>
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

        {/* Workflow Alerts */}
        {workflowSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{workflowSuccess}</span>
          </div>
        )}

        {workflowError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{workflowError}</span>
          </div>
        )}

        {recalcSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{recalcSuccess}</span>
          </div>
        )}

        {/* Two-Column Problem Operations Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Column (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Why This Matters Section */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider">
                  Why This Matters
                </h3>
                <span className="text-xs text-civic-rose font-semibold">
                  {impactLevel} Systemic Urgency ({impactScore}/100)
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2.5 text-xs text-ink-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-rose mt-1.5 shrink-0" />
                  <span className="leading-relaxed">
                    Potable water distribution main rupture disrupting Nayapalli residential corridor and municipal schools.
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-ink-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-rose mt-1.5 shrink-0" />
                  <span className="leading-relaxed">
                    Direct water seepage threatening basement structures and adjacent DAV Public School gate entrance.
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

            {/* Resolution Evidence & AI Advisory Verification Workspace (Phase 6) */}
            <ResolutionWorkspace
              problemId={id}
              problemTitle={title}
              problemCategory={liveProblem?.category || fallbackProblem.category}
              problemStatus={status}
              assignedTo={assignedTo}
              departmentId={department}
              authToken={activePersona.token}
              userRole={activePersona.role}
              userName={activePersona.name}
              onStatusChange={async () => {
                await Promise.all([fetchDetails(), fetchActions()]);
              }}
            />

            {/* Representative Clustered Citizen Signals Batch */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider">
                    Representative Clustered Signals ({members.length > 0 ? members.length : 3})
                  </h3>
                  <p className="text-xs text-ink-secondary">
                    Linked using semantic cosine similarity, geographic proximity, and temporal decay
                  </p>
                </div>
                <span className="text-xs font-semibold text-civic-blue">Relationship Threshold &ge; 70%</span>
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
                            <span className="text-ink-secondary">{sig?.category?.replace(/_/g, ' ') || 'water supply'}</span>
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
                  <>
                    <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-primary font-mono">sig_1001</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">DUPLICATE</span>
                          <span className="text-ink-tertiary">•</span>
                          <span className="text-ink-secondary">water supply</span>
                        </div>
                        <span className="text-[11px] font-semibold text-civic-blue">94% Similarity</span>
                      </div>
                      <p className="text-ink-primary font-medium italic">
                        &ldquo;Water supply pipeline bursting on Nayapalli VIP Road, submerging basement driveways.&rdquo;
                      </p>
                      <div className="text-[11px] text-ink-secondary">
                        Same water_supply category, identical corridor coordinates, matching rupture description
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-primary font-mono">sig_1003</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">DUPLICATE</span>
                          <span className="text-ink-tertiary">•</span>
                          <span className="text-ink-secondary">water supply</span>
                        </div>
                        <span className="text-[11px] font-semibold text-civic-blue">89% Similarity</span>
                      </div>
                      <p className="text-ink-primary font-medium italic">
                        &ldquo;Basement flooding and zero drinking water pressure on VIP Road Nayapalli for two days.&rdquo;
                      </p>
                      <div className="text-[11px] text-ink-secondary">
                        Matching basement flooding and zero potable water pressure within 180m
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink-primary font-mono">sig_1004</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">RELATED</span>
                          <span className="text-ink-tertiary">•</span>
                          <span className="text-ink-secondary">water supply</span>
                        </div>
                        <span className="text-[11px] font-semibold text-civic-blue">92% Similarity</span>
                      </div>
                      <p className="text-ink-primary font-medium italic">
                        &ldquo;Drinking water pipeline leakage impacting DAV Public School gate entrance Nayapalli.&rdquo;
                      </p>
                      <div className="text-[11px] text-amber-800 font-semibold">
                        Critical facility exposure: DAV Public School Gate 2
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Operational Event Audit Timeline */}
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

          {/* Right Rail Details (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Government Lifecycle Controls Card */}
            <div className="p-6 rounded-xl border border-civic-blue/30 bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <span className="text-xs uppercase tracking-wider text-ink-secondary font-bold flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-civic-blue" />
                  <span>Operations Workflow</span>
                </span>
                <StatusBadge status={status} />
              </div>

              {/* Current Assignment Status */}
              <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-ink-tertiary uppercase font-semibold text-[10px]">DEPARTMENT</span>
                  <span className="font-bold text-ink-primary">{department || 'Not Assigned'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-tertiary uppercase font-semibold text-[10px]">ASSIGNED OFFICER</span>
                  <span className="font-mono text-ink-primary font-semibold">{assignedTo || 'Unassigned'}</span>
                </div>
              </div>

              {/* Actions based on 8-step state machine */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-semibold text-ink-secondary">Available State Actions:</div>

                {/* Assign / Reassign Button */}
                {(status === ProblemStatus.NEW || status === ProblemStatus.TRIAGED || status === ProblemStatus.ASSIGNED || status === ProblemStatus.IN_PROGRESS) && (
                  <button
                    onClick={() => setIsAssignModalOpen(true)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-blue-700 shadow-subtle flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{assignedTo ? 'Reassign Problem' : 'Assign Department & Officer'}</span>
                  </button>
                )}

                {/* State Machine Step Buttons */}
                {status === ProblemStatus.NEW && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.TRIAGED, 'Problem triaged by department dispatcher.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-civic-blue" />
                    <span>Mark as TRIAGED</span>
                  </button>
                )}

                {status === ProblemStatus.ASSIGNED && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.IN_PROGRESS, 'Field crew dispatched and commenced excavation.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-civic-blue" />
                    <span>Mark as IN PROGRESS</span>
                  </button>
                )}

                {status === ProblemStatus.IN_PROGRESS && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.AWAITING_VERIFICATION, 'Repairs completed on site. Awaiting verification review.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-civic-amber" />
                    <span>Request Verification</span>
                  </button>
                )}

                {status === ProblemStatus.AWAITING_VERIFICATION && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.RESOLVED, 'Repairs inspected and officially validated by supervisor.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-civic-emerald text-white hover:bg-emerald-700 shadow-subtle flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark as RESOLVED</span>
                  </button>
                )}

                {status === ProblemStatus.RESOLVED && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.CLOSED, 'Incident administrative audit complete. Case closed.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5 text-ink-tertiary" />
                    <span>Close Incident (CLOSED)</span>
                  </button>
                )}

                {status === ProblemStatus.CLOSED && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.REOPENED, 'Recurring failure reported. Problem reopened for investigation.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-ink-border text-civic-rose hover:bg-rose-50 flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen Incident (REOPENED)</span>
                  </button>
                )}

                {status === ProblemStatus.REOPENED && (
                  <button
                    onClick={() => handleStatusTransition(ProblemStatus.TRIAGED, 'Reopened problem triaged for fresh remediation.')}
                    disabled={workflowLoading}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-civic-blue" />
                    <span>Re-triage Incident</span>
                  </button>
                )}
              </div>
            </div>

            {/* SLA Tracking & Historical Breach Card */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <span className="uppercase tracking-wider text-ink-secondary font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-civic-amber" />
                  <span>SLA Performance</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    sla?.status === 'BREACHED'
                      ? 'bg-civic-roseLight text-civic-rose'
                      : sla?.status === 'AT_RISK'
                      ? 'bg-civic-amberLight text-amber-900'
                      : 'bg-civic-emeraldLight text-emerald-800'
                  }`}
                >
                  {sla?.status || (impactLevel === 'CRITICAL' ? 'AT_RISK' : 'ON_TRACK')}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Deterministic Target:</span>
                  <span className="font-mono font-bold text-ink-primary">
                    {sla?.target_hours ?? (impactLevel === 'CRITICAL' ? 24 : 48)} hours
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Calculated Deadline:</span>
                  <span className="font-mono text-ink-primary">
                    {sla?.due_at
                      ? new Date(sla.due_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                      : 'Today, 04:00 PM'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary">Remaining Time:</span>
                  <span className="font-mono font-bold text-civic-amber">
                    {sla ? `${Math.max(0, Math.round(sla.hours_remaining))}h remaining` : '3h 15m remaining'}
                  </span>
                </div>
              </div>

              {/* Historical SLA Breach Guardrail Alert */}
              {sla?.was_breached && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-700">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Historical Breach Retained</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-snug">
                    SLA deadline was exceeded prior to resolution. Retained in historical audit records for performance metrics and compliance.
                  </p>
                </div>
              )}
            </div>

            {/* Impact Rating Card */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-ink-secondary font-semibold">
                  Deterministic Impact Score
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

              {/* Provenance Indicator for Enrichment-Dependent Factors */}
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
                <span>VIP Road, Jayadev Vihar Crossing, Nayapalli, Bhubaneswar</span>
              </div>

              <div className="h-28 rounded-lg bg-canvas-subtle border border-ink-border flex flex-col items-center justify-center p-3 text-center text-ink-tertiary">
                <MapPin className="w-6 h-6 text-civic-rose mb-1" />
                <span className="font-mono text-[11px] text-ink-secondary">
                  Lat: 20.2961 • Lng: 85.8245
                </span>
                <span className="text-[10px]">Nayapalli Ward 18 Corridor, Bhubaneswar</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Assign Problem */}
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

              <form onSubmit={handleAssign} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Department</label>
                  <select
                    value={assignDept}
                    onChange={(e) => setAssignDept(e.target.value)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue"
                  >
                    <option value="WATCO">WATCO — Water Corporation of Odisha</option>
                    <option value="BMC_DRAINAGE">BMC Drainage & Stormwater Division</option>
                    <option value="BMC_ROADS">BMC Roads & Engineering Department</option>
                    <option value="BMC_SAN">BMC Solid Waste Management & Sanitation</option>
                    <option value="TPCODL">TP Central Odisha Distribution Ltd (Power)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Field Officer</label>
                  <select
                    value={assignOfficer}
                    onChange={(e) => setAssignOfficer(e.target.value)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue font-mono"
                  >
                    <option value="usr_officer_01">usr_officer_01 (Rajesh K. — Senior Field Engineer)</option>
                    <option value="usr_field_drainage">usr_field_drainage (Suresh P. — Drainage Officer)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Dispatch Notes / Instructions</label>
                  <textarea
                    rows={3}
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue"
                    placeholder="Provide specific engineering instructions..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
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
