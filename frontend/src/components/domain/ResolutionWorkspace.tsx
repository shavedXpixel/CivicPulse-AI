'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ResolutionEvidence,
  VerificationResult,
  EvidenceType,
  BeforeOrAfter,
  ProblemStatus
} from '@civicpulse/shared';
import { apiClient } from '../../lib/api-client';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Camera,
  Clock,
  Sparkles,
  RefreshCw,
  Info,
  MapPin,
  Check,
  Sliders
} from 'lucide-react';

interface ResolutionWorkspaceProps {
  problemId: string;
  problemTitle: string;
  problemCategory: string;
  problemStatus: ProblemStatus;
  assignedTo?: string;
  departmentId?: string;
  authToken: string;
  userRole: string;
  userName: string;
  onStatusChange?: () => Promise<void>;
}

export function ResolutionWorkspace({
  problemId,
  problemTitle,
  problemCategory,
  problemStatus,
  assignedTo,
  departmentId,
  authToken,
  userRole,
  userName,
  onStatusChange
}: ResolutionWorkspaceProps) {
  const [evidenceList, setEvidenceList] = useState<ResolutionEvidence[]>([]);
  const [latestVerification, setLatestVerification] = useState<VerificationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'comparison' | 'ai_analysis'>('comparison');
  const [loading, setLoading] = useState<boolean>(true);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [reviewing, setReviewing] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Evidence Submission Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [submitEvidenceType, setSubmitEvidenceType] = useState<EvidenceType>(EvidenceType.COMPLETION_PHOTO);
  const [submitBeforeAfter, setSubmitBeforeAfter] = useState<BeforeOrAfter>(BeforeOrAfter.AFTER);
  const [submitDescription, setSubmitDescription] = useState<string>(
    'Emergency excavation completed. High-pressure 250mm DI flange pipe joint replaced, bolted, and hydrostatic pressure tested at 3.8 bar. Trench backfilled and asphalt road surface cleared of standing water.'
  );
  const [submitLocation, setSubmitLocation] = useState<string>('Nayapalli Junction, Ward 18, VIP Road');
  const [submitStoragePath, setSubmitStoragePath] = useState<string>('evidence/prb_0819_after_repair.jpg');
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);

  // Rejection Review Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectionNotes, setRejectionNotes] = useState<string>(
    'Photo indicates incomplete asphalt compaction. Residual road depression requires additional hot-mix rolling.'
  );

  const fetchWorkspaceData = useCallback(async () => {
    try {
      const [evRes, verRes] = await Promise.allSettled([
        apiClient.get<{ data: ResolutionEvidence[] }>(`/api/v1/problems/${problemId}/evidence`, {
          Authorization: `Bearer ${authToken}`
        }),
        apiClient.get<{ data: VerificationResult | null }>(`/api/v1/problems/${problemId}/verification`, {
          Authorization: `Bearer ${authToken}`
        })
      ]);

      if (evRes.status === 'fulfilled' && evRes.value?.data) {
        setEvidenceList(evRes.value.data);
      }
      if (verRes.status === 'fulfilled' && verRes.value?.data) {
        setLatestVerification(verRes.value.data);
      }
    } catch (err) {
      console.warn('Could not fetch resolution workspace data:', err);
    } finally {
      setLoading(false);
    }
  }, [problemId, authToken]);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  // Handle Trigger AI Advisory Verification
  const handleTriggerVerification = async () => {
    setVerifying(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await apiClient.post<{ data: VerificationResult }>(
        `/api/v1/problems/${problemId}/verify`,
        {},
        { Authorization: `Bearer ${authToken}` }
      );
      if (res?.data) {
        setLatestVerification(res.data);
        setActionSuccess(
          `AI Advisory Verification completed: [${res.data.verification_result}] with ${(res.data.confidence * 100).toFixed(0)}% confidence.`
        );
        setActiveTab('ai_analysis');
        await fetchWorkspaceData();
      }
    } catch (err: any) {
      setActionError(err.message || 'AI verification failed');
    } finally {
      setVerifying(false);
    }
  };

  // Handle Evidence Submission
  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await apiClient.post<{ data: { evidence: ResolutionEvidence; problem_status: ProblemStatus } }>(
        `/api/v1/problems/${problemId}/evidence`,
        {
          evidence_type: submitEvidenceType,
          before_or_after: submitBeforeAfter,
          storage_path: submitStoragePath,
          description: submitDescription,
          location: {
            lat: 20.2961,
            lng: 85.8245,
            reference: submitLocation
          }
        },
        { Authorization: `Bearer ${authToken}` }
      );

      setIsSubmitModalOpen(false);
      setActionSuccess(
        `Resolution evidence submitted! State transitioned to ${res.data.problem_status}. AI verification triggered.`
      );

      if (onStatusChange) {
        await onStatusChange();
      }
      await fetchWorkspaceData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit evidence');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle Supervisor Acceptance
  const handleAcceptResolution = async () => {
    setReviewing(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await apiClient.post(
        `/api/v1/problems/${problemId}/review-resolution`,
        {
          decision: 'ACCEPT',
          notes: `Resolution verified and accepted by ${userName} (${userRole}). Case marked as RESOLVED.`
        },
        { Authorization: `Bearer ${authToken}` }
      );
      setActionSuccess(`Resolution accepted! Problem transitioned to RESOLVED.`);
      if (onStatusChange) {
        await onStatusChange();
      }
      await fetchWorkspaceData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to accept resolution');
    } finally {
      setReviewing(false);
    }
  };

  // Handle Supervisor Rejection
  const handleRejectResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewing(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      await apiClient.post(
        `/api/v1/problems/${problemId}/review-resolution`,
        {
          decision: 'REJECT',
          notes: rejectionNotes
        },
        { Authorization: `Bearer ${authToken}` }
      );
      setIsRejectModalOpen(false);
      setActionSuccess(
        `Resolution rejected. Problem transitioned from AWAITING_VERIFICATION back to IN_PROGRESS for rework.`
      );
      if (onStatusChange) {
        await onStatusChange();
      }
      await fetchWorkspaceData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to reject resolution');
    } finally {
      setReviewing(false);
    }
  };

  // Split evidence into before vs after for comparison
  const beforeEvidence = evidenceList.filter((e) => e.before_or_after === BeforeOrAfter.BEFORE);
  const afterEvidence = evidenceList.filter((e) => e.before_or_after === BeforeOrAfter.AFTER);

  const isDepartmentOfficerOrAdmin =
    userRole === 'DEPARTMENT_OFFICER' || userRole === 'ADMIN' || userRole === 'SYSTEM_ADMIN';
  const isAssignedFieldOfficer =
    userRole === 'FIELD_OFFICER' && (!assignedTo || assignedTo === 'usr_officer_01');
  const isCitizen = userRole === 'CITIZEN';

  return (
    <div className="border border-ink-border bg-canvas-card overflow-hidden space-y-0">
      {/* Top Header & Telemetry Bar */}
      <div className="p-5 border-b border-ink-border bg-canvas-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold tracking-wider text-ink-secondary uppercase flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-civic-blue" />
              <span>Phase 6 Evidence & AI Verification</span>
            </span>
            {latestVerification && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  latestVerification.verification_result === 'VERIFIED'
                    ? 'bg-civic-emeraldLight text-emerald-800 border border-emerald-300'
                    : latestVerification.verification_result === 'REJECTED'
                    ? 'bg-civic-roseLight text-civic-rose border border-rose-300'
                    : 'bg-civic-amberLight text-amber-900 border border-amber-300'
                }`}
              >
                AI: {latestVerification.verification_result} ({(latestVerification.confidence * 100).toFixed(0)}%)
              </span>
            )}
            <span className="text-[11px] font-mono text-ink-tertiary">
              {evidenceList.length} {evidenceList.length === 1 ? 'Record' : 'Records'} Stored
            </span>
          </div>
          <h3 className="text-sm font-bold text-ink-primary">
            Infrastructure Resolution Verification Workspace — {problemTitle} ({problemCategory})
          </h3>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Submit Proof Button (Only active for assigned field officer, department officer, or admin) */}
          {(isAssignedFieldOfficer || isDepartmentOfficerOrAdmin) && (
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark flex items-center gap-1.5 transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Submit Resolution Proof</span>
            </button>
          )}

          {/* Trigger Verification Button */}
          {!isCitizen && (
            <button
              onClick={handleTriggerVerification}
              disabled={verifying || evidenceList.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle shadow-subtle flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 text-civic-amber ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Verifying Proof...' : 'Trigger AI Verification'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Alerts */}
      {actionSuccess && (
        <div className="mx-5 mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="px-5 border-b border-ink-border flex items-center gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('comparison')}
          className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'comparison'
              ? 'border-civic-terracotta text-civic-terracotta font-semibold'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Before / After Comparison</span>
        </button>

        <button
          onClick={() => setActiveTab('ai_analysis')}
          className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'ai_analysis'
              ? 'border-civic-blue text-civic-blue'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-civic-amber" />
          <span>AI Advisory Assessment</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'timeline'
              ? 'border-civic-blue text-civic-blue'
              : 'border-transparent text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Evidence History ({evidenceList.length})</span>
        </button>
      </div>

      {/* Workspace Content Body */}
      <div className="p-5">
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-tertiary flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-civic-blue" />
            <span>Loading resolution evidence workspace...</span>
          </div>
        ) : (
          <>
            {/* 1. BEFORE / AFTER COMPARISON VIEW */}
            {activeTab === 'comparison' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* BEFORE CARD */}
                  <div className="p-5 border border-ink-border bg-canvas-subtle/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-civic-roseLight text-civic-rose uppercase border border-rose-200">
                        BEFORE • Disruption State
                      </span>
                      <span className="text-[10px] font-mono text-ink-tertiary">
                        {beforeEvidence[0]?.submitted_at
                          ? new Date(beforeEvidence[0].submitted_at).toLocaleDateString()
                          : 'Report Intake'}
                      </span>
                    </div>

                    {/* Before Photo Simulation Container */}
                    <div className="relative aspect-video rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-slate-700 flex flex-col items-center justify-center p-4 text-center text-white overflow-hidden shadow-inner">
                      <div className="absolute inset-0 bg-radial from-rose-500/10 via-transparent to-black/60 pointer-events-none" />
                      <AlertTriangle className="w-8 h-8 text-civic-rose mb-2 animate-pulse" />
                      <span className="text-xs font-bold text-rose-200 uppercase tracking-wide">
                        Visible Pipeline Rupture & Surface Flood
                      </span>
                      <span className="text-[11px] text-slate-300 max-w-xs mt-1">
                        High-pressure potable line crack; ~15cm water covering Nayapalli roadway corridor.
                      </span>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[9px] font-mono text-slate-300">
                        Geo: 20.2961° N, 85.8245° E (Ward 18)
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="font-semibold text-ink-primary">Pre-Remediation Observation:</span>
                      <p className="text-ink-secondary text-[11px] leading-relaxed">
                        {beforeEvidence[0]?.description ||
                          'Gushing surface flooding from ruptured main transmission line; subterranean erosion risking road collapse.'}
                      </p>
                    </div>
                  </div>

                  {/* AFTER CARD */}
                  <div className="p-5 border border-ink-border bg-canvas-subtle/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-civic-emeraldLight text-emerald-800 uppercase border border-emerald-200">
                        AFTER • Remediated Infrastructure
                      </span>
                      <span className="text-[10px] font-mono text-ink-tertiary">
                        {afterEvidence[0]?.submitted_at
                          ? new Date(afterEvidence[0].submitted_at).toLocaleDateString()
                          : 'Post-Repair Proof'}
                      </span>
                    </div>

                    {/* After Photo Simulation Container */}
                    <div className="relative aspect-video rounded-lg bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-emerald-700/60 flex flex-col items-center justify-center p-4 text-center text-white overflow-hidden shadow-inner">
                      <div className="absolute inset-0 bg-radial from-emerald-500/10 via-transparent to-black/60 pointer-events-none" />
                      <CheckCircle2 className="w-8 h-8 text-civic-emerald mb-2" />
                      <span className="text-xs font-bold text-emerald-200 uppercase tracking-wide">
                        Flanged Pipe Replaced & Surface Cleared
                      </span>
                      <span className="text-[11px] text-slate-300 max-w-xs mt-1">
                        Excavation backfilled; 3.8 bar pressure restored; asphalt surface dry and operational.
                      </span>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[9px] font-mono text-slate-300">
                        Proof: DI Flange Joint Assembly (3.8 bar)
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <span className="font-semibold text-ink-primary">Field Engineering Note:</span>
                      <p className="text-ink-secondary text-[11px] leading-relaxed">
                        {afterEvidence[0]?.description ||
                          'Emergency excavation completed. High-pressure 250mm DI flange pipe joint replaced and pressure tested.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Comparative Observations Grid */}
                <div className="p-5 border-t border-ink-border bg-canvas-card space-y-3 text-xs">
                  <span className="font-bold text-ink-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-civic-amber" />
                    <span>Observable Visual Deltas (AI & Telemetry Analysis)</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-white border border-ink-border space-y-1">
                      <span className="text-[10px] text-ink-tertiary uppercase font-mono">Surface Water</span>
                      <p className="font-semibold text-ink-primary">Eliminated (0cm standing water)</p>
                      <span className="text-[10px] text-civic-emerald font-bold">100% Volume Cleared</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-ink-border space-y-1">
                      <span className="text-[10px] text-ink-tertiary uppercase font-mono">Pipeline Assembly</span>
                      <p className="font-semibold text-ink-primary">Ductile Iron Flanged Joint</p>
                      <span className="text-[10px] text-civic-emerald font-bold">Pressure verified: 3.8 bar</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-ink-border space-y-1">
                      <span className="text-[10px] text-ink-tertiary uppercase font-mono">Corridor Access</span>
                      <p className="font-semibold text-ink-primary">VIP Road Nayapalli Reopened</p>
                      <span className="text-[10px] text-civic-emerald font-bold">Normal Transit Resumed</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. AI ADVISORY ASSESSMENT TAB */}
            {activeTab === 'ai_analysis' && (
              <div className="space-y-4">
                {latestVerification ? (
                  <div className="space-y-4">
                    {/* Top Result Banner */}
                    <div
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        latestVerification.verification_result === 'VERIFIED'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : latestVerification.verification_result === 'REJECTED'
                          ? 'bg-rose-50 border-rose-200 text-rose-950'
                          : 'bg-amber-50 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold tracking-wider ${
                              latestVerification.verification_result === 'VERIFIED'
                                ? 'bg-civic-emerald text-white'
                                : latestVerification.verification_result === 'REJECTED'
                                ? 'bg-civic-rose text-white'
                                : 'bg-civic-amber text-black'
                            }`}
                          >
                            AI VERDICT: {latestVerification.verification_result}
                          </span>
                          <span className="text-xs font-semibold">
                            Confidence: {(latestVerification.confidence * 100).toFixed(0)}% (
                            {latestVerification.confidence >= 0.85
                              ? 'High'
                              : latestVerification.confidence >= 0.65
                              ? 'Moderate'
                              : 'Low'}
                            )
                          </span>
                          {latestVerification.failure_reason && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              FAILURE REASON: {latestVerification.failure_reason}
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed">{latestVerification.explanation}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-mono text-ink-tertiary block">
                          Model: {latestVerification.model || 'Gemini 2.5 Flash'}
                        </span>
                        <span className="text-[10px] font-mono text-ink-tertiary block">
                          Prompt: {latestVerification.prompt_version || 'resolution_verification_v1'}
                        </span>
                      </div>
                    </div>

                    {/* Observed Conditions & Inconsistencies Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Observed Conditions */}
                      <div className="p-4 rounded-xl border border-ink-border bg-white space-y-2">
                        <span className="font-bold text-ink-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-civic-emerald" />
                          <span>Structured Observed Conditions</span>
                        </span>
                        <ul className="space-y-1.5 text-ink-secondary">
                          {latestVerification.observed_conditions.map((cond, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-civic-emerald font-bold">•</span>
                              <span>{cond}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Inconsistencies & Limitations */}
                      <div className="p-4 rounded-xl border border-ink-border bg-white space-y-2">
                        <span className="font-bold text-ink-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-civic-amber" />
                          <span>Limitations & Discrepancies</span>
                        </span>
                        {latestVerification.inconsistencies && latestVerification.inconsistencies.length > 0 ? (
                          <ul className="space-y-1.5 text-rose-800">
                            {latestVerification.inconsistencies.map((inc, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <span className="text-civic-rose font-bold">⚠️</span>
                                <span>{inc}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-ink-tertiary text-[11px] italic">
                            No visual or operational inconsistencies detected.
                          </p>
                        )}
                        <div className="pt-2 border-t border-ink-border/50 text-[10px] text-ink-tertiary space-y-1">
                          {latestVerification.limitations.map((lim, idx) => (
                            <div key={idx} className="flex items-start gap-1">
                              <span>ℹ️</span>
                              <span>{lim}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Advisory Guardrail Disclaimer */}
                    <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border text-xs text-ink-secondary flex items-start gap-2">
                      <Info className="w-4 h-4 text-civic-blue shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold text-ink-primary">Human Oversight Mandatory:</span>
                        <p className="text-[11px] leading-relaxed">
                          AI verification serves exclusively as an advisory evidence interpretation layer. It possesses
                          no legal or administrative authority to close municipal incidents. Official case resolution
                          strictly requires departmental supervisor review.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-ink-tertiary space-y-2">
                    <Sparkles className="w-6 h-6 text-civic-amber mx-auto" />
                    <p className="font-semibold text-ink-primary">No AI Verification Performed Yet</p>
                    <p className="max-w-sm mx-auto">
                      Click &quot;Trigger AI Verification&quot; above to evaluate submitted resolution proof against the reported
                      problem.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 3. EVIDENCE TIMELINE TAB */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {evidenceList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-ink-tertiary space-y-2">
                    <Camera className="w-6 h-6 text-ink-tertiary mx-auto" />
                    <p className="font-semibold text-ink-primary">No Evidence Records Persisted</p>
                    <p className="max-w-sm mx-auto">
                      The assigned field engineer has not yet submitted completion proof for this case.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evidenceList.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-4 rounded-xl border border-ink-border bg-white shadow-subtle flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                ev.before_or_after === BeforeOrAfter.BEFORE
                                  ? 'bg-civic-roseLight text-civic-rose border border-rose-200'
                                  : 'bg-civic-emeraldLight text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {ev.before_or_after || 'AFTER'}
                            </span>
                            <span className="font-mono text-ink-tertiary text-[11px]">#{ev.id}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-canvas-subtle text-ink-secondary border border-ink-border">
                              {ev.evidence_type}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                ev.status === 'ACCEPTED'
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : ev.status === 'REJECTED'
                                  ? 'text-rose-700 bg-rose-50'
                                  : 'text-amber-800 bg-amber-50'
                              }`}
                            >
                              {ev.status}
                            </span>
                            {ev.is_demo && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                SYNTHETIC DEMO
                              </span>
                            )}
                          </div>

                          <p className="text-ink-primary leading-relaxed">{ev.description || 'No notes provided.'}</p>

                          {ev.location && (
                            <div className="flex items-center gap-1.5 text-[11px] text-ink-tertiary">
                              <MapPin className="w-3 h-3 text-civic-rose" />
                              <span>{ev.location.reference || `${ev.location.lat}, ${ev.location.lng}`}</span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 text-right space-y-1 text-[11px] text-ink-tertiary font-mono">
                          <div>By: {ev.submitted_by}</div>
                          <div>{new Date(ev.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUPERVISORY HUMAN DECISION BAR (ONLY VISIBLE WHEN AWAITING_VERIFICATION) */}
            {problemStatus === ProblemStatus.AWAITING_VERIFICATION && (
              <div className="mt-6 pt-5 border-t border-ink-border">
                {isDepartmentOfficerOrAdmin ? (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50/50 via-white to-emerald-50/50 border border-civic-blue/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-ink-primary flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-civic-emerald" />
                          <span>Supervisory Decision Required (Human-in-the-Loop Authority)</span>
                        </span>
                        <p className="text-[11px] text-ink-secondary">
                          You are authenticated as an authorized supervisor ({userRole}). Review submitted evidence and
                          make the final administrative determination.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Reject Resolution Button */}
                        <button
                          onClick={() => setIsRejectModalOpen(true)}
                          disabled={reviewing}
                          className="px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-rose-300 text-civic-rose hover:bg-rose-50 shadow-subtle flex items-center gap-1.5 transition-colors"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject Proof & Reopen (IN_PROGRESS)</span>
                        </button>

                        {/* Accept Resolution Button */}
                        <button
                          onClick={handleAcceptResolution}
                          disabled={reviewing}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-civic-emerald text-white hover:bg-emerald-700 shadow-subtle flex items-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{reviewing ? 'Processing...' : 'Accept Resolution (RESOLVED)'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : isAssignedFieldOfficer ? (
                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-950 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold">Awaiting Supervisory Resolution Sign-Off:</span>
                      <p className="text-[11px] text-amber-900 mt-0.5">
                        Your completion proof has been recorded. Departmental supervisors ({departmentId || 'WATCO'})
                        must formally validate evidence before the problem moves to RESOLVED.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-canvas-subtle border border-ink-border text-xs text-ink-secondary flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-civic-blue shrink-0" />
                    <span>Resolution evidence under active departmental supervisory review.</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: SUBMIT RESOLUTION EVIDENCE */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-modal border border-ink-border space-y-4">
            <div className="flex items-center justify-between border-b border-ink-border pb-3">
              <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                <Camera className="w-4 h-4 text-civic-blue" />
                <span>Submit Resolution Evidence #{problemId}</span>
              </h3>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-ink-tertiary hover:text-ink-primary text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEvidence} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Evidence Type</label>
                  <select
                    value={submitEvidenceType}
                    onChange={(e) => setSubmitEvidenceType(e.target.value as EvidenceType)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue"
                  >
                    <option value={EvidenceType.COMPLETION_PHOTO}>Completion Photo</option>
                    <option value={EvidenceType.FIELD_NOTE}>Field Engineering Note</option>
                    <option value={EvidenceType.WORK_LOG}>Work Order Log</option>
                    <option value={EvidenceType.DOCUMENT}>Inspection Document</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink-primary">Classification</label>
                  <select
                    value={submitBeforeAfter}
                    onChange={(e) => setSubmitBeforeAfter(e.target.value as BeforeOrAfter)}
                    className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue font-mono"
                  >
                    <option value={BeforeOrAfter.AFTER}>AFTER (Post-Repair Proof)</option>
                    <option value={BeforeOrAfter.BEFORE}>BEFORE (Disruption Proof)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-primary">Location Reference</label>
                <input
                  type="text"
                  value={submitLocation}
                  onChange={(e) => setSubmitLocation(e.target.value)}
                  className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-primary">Storage Path / Media Reference</label>
                <input
                  type="text"
                  value={submitStoragePath}
                  onChange={(e) => setSubmitStoragePath(e.target.value)}
                  className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary font-mono text-xs focus:ring-1 focus:ring-civic-blue"
                  placeholder="e.g. evidence/prb_0819_after_repair.jpg"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink-primary">Engineering Field Notes / Work Log</label>
                <textarea
                  rows={3}
                  value={submitDescription}
                  onChange={(e) => setSubmitDescription(e.target.value)}
                  className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-blue leading-relaxed"
                  placeholder="Describe physical repairs performed, telemetry readings, parts replaced, and site conditions..."
                />
              </div>

              <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border text-[11px] text-ink-secondary space-y-1">
                <span className="font-bold text-ink-primary">Canonical Workflow Transition:</span>
                <p>
                  Submitting resolution evidence from <strong>IN_PROGRESS</strong> authoritatively moves the case into{' '}
                  <strong>AWAITING_VERIFICATION</strong>. AI verification will evaluate the evidence advisively.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-border">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-ink-secondary hover:bg-canvas-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 rounded-lg bg-civic-blue text-white font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {submitLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  <span>{submitLoading ? 'Submitting Proof...' : 'Submit Resolution Proof'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REJECT RESOLUTION */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-modal border border-ink-border space-y-4">
            <div className="flex items-center justify-between border-b border-ink-border pb-3">
              <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                <XCircle className="w-4 h-4 text-civic-rose" />
                <span>Reject Resolution Proof #{problemId}</span>
              </h3>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="text-ink-tertiary hover:text-ink-primary text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRejectResolution} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-ink-primary">Rejection Feedback / Rework Instructions</label>
                <textarea
                  rows={4}
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  className="w-full p-2 rounded-lg border border-ink-border bg-white text-ink-primary focus:ring-1 focus:ring-civic-rose leading-relaxed"
                  placeholder="Specify why proof is rejected and what corrective physical remediation is required on site..."
                  required
                />
              </div>

              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1">
                <span className="font-bold">Canonical Rejection Behavior:</span>
                <p>
                  The problem will transition from <strong>AWAITING_VERIFICATION</strong> back to{' '}
                  <strong>IN_PROGRESS</strong>. Evidence is permanently retained as <code>REJECTED</code>, and your
                  feedback is preserved in the audit trail.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-border">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-3 py-2 rounded-lg text-ink-secondary hover:bg-canvas-subtle"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewing}
                  className="px-4 py-2 rounded-lg bg-civic-rose text-white font-semibold hover:bg-rose-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{reviewing ? 'Rejecting...' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
