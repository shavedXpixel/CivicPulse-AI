'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { OfficerShell } from '../../components/shells/OfficerShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import { Assignment, ProblemCluster } from '@civicpulse/shared';
import {
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  Navigation,
  FileCheck,
  AlertTriangle,
  Play,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

interface AssignmentWithProblem extends Assignment {
  problem?: ProblemCluster;
}

export default function OfficerPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const res = await apiClient.get<{ data: AssignmentWithProblem[] }>(
        '/api/v1/assignments?assigned_to=me'
      );
      if (res?.data) {
        setAssignments(res.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch live officer assignments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    fetchAssignments();
  }, [authLoading, user, fetchAssignments]);

  const handleStartWork = async (problemId: string) => {
    setActionLoading(problemId);
    setActionSuccess(null);
    setActionError(null);
    try {
      await apiClient.post(
        `/api/v1/problems/${problemId}/actions`,
        {
          action: 'STARTED_WORK',
          note: 'Field crew deployed on site and initiated maintenance protocol.',
        }
      );
      setActionSuccess(`Work successfully commenced on problem ${problemId}! State transitioned to IN_PROGRESS.`);
      await fetchAssignments();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.includes('conflict')) {
        setActionError('The task state changed concurrently. Please refresh.');
      } else {
        setActionError(err.message || 'Failed to start work');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestVerification = async (problemId: string) => {
    setActionLoading(problemId);
    setActionSuccess(null);
    setActionError(null);
    try {
      await apiClient.post(
        `/api/v1/problems/${problemId}/actions`,
        {
          action: 'VERIFICATION_REQUESTED',
          note: 'Field repairs completed. Restored infrastructure submitted for supervisory verification.',
        }
      );
      setActionSuccess(`Verification requested for ${problemId}! State transitioned to AWAITING_VERIFICATION.`);
      await fetchAssignments();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.includes('conflict')) {
        setActionError('The task state changed concurrently. Please refresh.');
      } else {
        setActionError(err.message || 'Failed to request verification');
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <OfficerShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title="Field Operations Queue"
            description="Active emergency dispatches and assigned infrastructure work orders (scoped to assigned_to === user.id)."
            badge={
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-civic-amberLight text-amber-900">
                {assignments.length} Assigned {assignments.length === 1 ? 'Task' : 'Tasks'}
              </span>
            }
          />
        </div>

        {/* Action alerts */}
        {actionSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 font-mono text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 font-mono text-xs text-rose-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{actionError}</span>
          </div>
        )}

        {/* Work Queue List */}
        {loading ? (
          <div className="p-8 border border-ink-border bg-canvas-card flex items-center justify-center text-xs text-ink-tertiary gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-civic-terracotta" />
            <span>Loading scoped officer tasks...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-12 border border-ink-border bg-canvas-card text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-civic-emerald mx-auto" />
            <h3 className="text-sm font-bold text-ink-primary">No Operational Problems Assigned</h3>
            <p className="text-xs text-ink-secondary max-w-sm mx-auto">
              No active work orders are currently assigned to {userProfile?.display_name || user?.email || 'your officer account'}. As emergency dispatches or infrastructure work orders are assigned by department leadership, they will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {assignments.map((assignment) => {
              const problem = assignment.problem;
              const sla = problem?.sla_state;
              const isCritical = problem?.impact_level === 'CRITICAL';
              const hoursRemaining = sla ? Math.max(0, Math.round(sla.hours_remaining)) : 3;
              const riskStatus = sla?.status || (isCritical ? 'AT_RISK' : 'ON_TRACK');
              const wasBreached = sla?.was_breached;

              return (
                <div
                  key={assignment.id}
                  className={`p-6 rounded-xl border ${
                    isCritical ? 'border-civic-rose/30 bg-white' : 'border-ink-border bg-white'
                  } shadow-card space-y-5`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-border/60 pb-4 gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isCritical ? 'bg-civic-roseLight text-civic-rose' : 'bg-civic-blueLight text-civic-terracottaDark'
                          }`}
                        >
                          {isCritical ? 'EMERGENCY DISPATCH' : 'SCHEDULED WORK ORDER'}
                        </span>
                        <span className="text-xs font-mono text-ink-tertiary">
                          Assignment #{assignment.id} • Problem #{assignment.problem_id}
                        </span>
                      </div>
                      <h2 className="text-xl font-serif font-bold text-ink-primary">
                        {problem?.title || `Problem Incident #${assignment.problem_id}`}
                      </h2>
                    </div>
                    {problem && <StatusBadge status={problem.status} />}
                  </div>

                  {/* Operational Telemetry Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-start gap-2 text-ink-secondary">
                      <MapPin className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-ink-primary">Location & GIS</span>
                        <div className="text-[11px] font-mono text-ink-tertiary">
                          {problem?.location
                            ? `${problem.location.lat.toFixed(4)}° N, ${problem.location.lng.toFixed(4)}° E`
                            : 'Nayapalli Ward 18, Bhubaneswar'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-ink-secondary">
                      <Clock className="w-4 h-4 text-civic-amber shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-ink-primary">SLA Target & Countdown</span>
                        <div className="text-[11px] font-mono flex items-center gap-1.5 font-bold">
                          <span className="text-ink-secondary">
                            Target: {sla?.target_hours ?? (isCritical ? 24 : 48)}h
                          </span>
                          <span className="text-ink-tertiary">•</span>
                          <span
                            className={
                              riskStatus === 'BREACHED'
                                ? 'text-civic-rose'
                                : riskStatus === 'AT_RISK'
                                ? 'text-civic-amber'
                                : 'text-civic-emerald'
                            }
                          >
                            {hoursRemaining}h remaining ({riskStatus})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Historical SLA Breach Guardrail Indicator */}
                    {wasBreached && (
                      <div className="flex items-start gap-2 text-rose-800 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[11px]">Historical Breach Preserved</span>
                          <p className="text-[10px] text-rose-700 leading-tight">
                            Exceeded deadline prior to resolution. Retained for audit & performance reporting.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assignment Instructions */}
                  <div className="p-4 rounded-lg bg-canvas-subtle border border-ink-border text-xs space-y-1">
                    <span className="font-mono text-ink-tertiary uppercase font-semibold text-[10px]">
                      DISPATCH INSTRUCTIONS & NOTES
                    </span>
                    <p className="text-ink-secondary leading-relaxed">
                      {assignment.notes || 'Proceed to coordinates, inspect reported infrastructure disruption, and execute repair protocol.'}
                    </p>
                  </div>

                  {/* Action Workflow Buttons */}
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    {problem?.status === 'ASSIGNED' && (
                      <Button
                        size="md"
                        className="gap-2 bg-civic-terracotta text-white hover:bg-civic-terracottaDark font-mono uppercase text-xs"
                        disabled={actionLoading === problem.id}
                        onClick={() => handleStartWork(problem.id)}
                      >
                        <Play className="w-4 h-4" />
                        <span>{actionLoading === problem.id ? 'Starting Work...' : 'Start Work (Commence Repairs)'}</span>
                      </Button>
                    )}

                    {problem?.status === 'IN_PROGRESS' && (
                      <Button
                        size="md"
                        className="gap-2 bg-civic-terracotta text-white hover:bg-civic-terracottaDark font-mono uppercase text-xs"
                        disabled={actionLoading === problem.id}
                        onClick={() => handleRequestVerification(problem.id)}
                      >
                        <Camera className="w-4 h-4" />
                        <span>{actionLoading === problem.id ? 'Requesting...' : 'Request Verification (Submit Proof)'}</span>
                      </Button>
                    )}

                    {problem?.status === 'AWAITING_VERIFICATION' && (
                      <div className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Verification Requested — Awaiting Department Supervisory Review</span>
                      </div>
                    )}

                    <Button variant="outline" size="md" className="gap-2 text-xs">
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Navigate to Site</span>
                    </Button>

                    <Link
                      href={`/dashboard/problems/${assignment.problem_id}`}
                      className="text-xs font-semibold text-civic-terracotta hover:underline ml-auto"
                    >
                      Inspect Problem Dossier →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Completed Tasks History Section */}
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider">
            Completed Tasks Today
          </h3>
          <div className="p-4 border border-ink-border bg-canvas-card flex items-center justify-between text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink-primary">Valve Pressure Check #WO-398</span>
                <span className="px-2 py-0.2 rounded text-[10px] bg-civic-emeraldLight text-emerald-800 font-semibold">
                  Resolved
                </span>
              </div>
              <div className="text-[11px] text-ink-tertiary">Nayapalli VIP Road • Completed 08:30 AM</div>
            </div>
            <FileCheck className="w-5 h-5 text-civic-emerald" />
          </div>
        </div>
      </div>
    </OfficerShell>
  );
}
