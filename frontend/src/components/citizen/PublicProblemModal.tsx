'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Building2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Layers,
  MapPin,
  Loader2,
  Info,
  CheckCircle2
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Button } from '../ui/Button';

interface PublicProblemTimelineItem {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

interface PublicProblemDetails {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  ward_id?: string;
  ward_name?: string;
  impact_score?: number;
  impact_level?: string;
  impact_explanation?: string;
  status: string;
  department_id?: string;
  first_detected_at?: string;
  created_at: string;
  last_updated_at?: string;
  signal_count?: number;
  members?: Array<{
    id: string;
    problem_id: string;
    signal_id: string;
    relationship?: string;
    similarity?: number;
    reason?: string;
    created_at: string;
  }>;
  timeline?: PublicProblemTimelineItem[];
}

interface PublicProblemModalProps {
  problemId: string;
  onClose: () => void;
  initialProblem?: PublicProblemDetails;
}

export function PublicProblemModal({ problemId, onClose, initialProblem }: PublicProblemModalProps) {
  const [problem, setProblem] = useState<PublicProblemDetails | null>(initialProblem || null);
  const [loading, setLoading] = useState(!initialProblem);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    try {
      if (!initialProblem) setLoading(true);
      setError(null);
      const res = await apiClient.get<{ data: PublicProblemDetails }>(
        `/api/v1/problems/${problemId}/details`
      );
      setProblem(res.data);
    } catch (err: any) {
      if (!initialProblem) {
        setError(err.message || 'Unable to retrieve public problem information.');
      }
    } finally {
      setLoading(false);
    }
  }, [problemId, initialProblem]);

  useEffect(() => {
    if (!initialProblem) {
      fetchDetails();
    }
  }, [fetchDetails, initialProblem]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-civic-blue border-civic-blue/30';
      case 'AWAITING_VERIFICATION':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'TRIAGED':
        return 'bg-amber-50 text-amber-900 border-amber-200';
      case 'REOPENED':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getImpactBadge = (level?: string) => {
    switch (level?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'HIGH':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'MEDIUM':
        return 'bg-blue-100 text-civic-blue border-blue-200';
      case 'LOW':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="public-problem-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-ink-border overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-border bg-canvas-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-civic-blue/10 flex items-center justify-center text-civic-blue">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-civic-blue">
                  Cluster #{problemId}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Public Record
                </span>
              </div>
              <h2 id="public-problem-title" className="text-sm font-bold text-ink-primary">
                Civic Issue Cluster Tracking
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-ink-tertiary hover:text-ink-primary hover:bg-canvas-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-civic-blue mx-auto" />
              <p className="text-xs text-ink-secondary">
                Retrieving verified municipal problem cluster data...
              </p>
            </div>
          ) : error ? (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Unable to load problem details</p>
                  <p className="text-rose-700 mt-1">{error}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchDetails}>
                Try Again
              </Button>
            </div>
          ) : problem ? (
            <>
              {/* Overview Card */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-ink-primary">
                      {problem.title || `${problem.category || 'Civic'} Issue Cluster`}
                    </h3>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {problem.description ||
                        'Multi-signal community incident correlated by the CivicPulse AI engine.'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getStatusBadge(
                      problem.status
                    )}`}
                  >
                    {problem.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  <div className="p-3 rounded-2xl bg-canvas-subtle border border-ink-border space-y-1">
                    <span className="text-[10px] text-ink-tertiary uppercase font-mono font-medium tracking-wider">
                      Aggregate Signals
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-civic-blue" />
                      <span className="text-base font-bold text-ink-primary">
                        {problem.signal_count ?? (problem.members?.length || 1)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-canvas-subtle border border-ink-border space-y-1">
                    <span className="text-[10px] text-ink-tertiary uppercase font-mono font-medium tracking-wider">
                      Impact Score
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-base font-bold text-ink-primary">
                        {problem.impact_score !== undefined ? `${problem.impact_score}/100` : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-canvas-subtle border border-ink-border space-y-1">
                    <span className="text-[10px] text-ink-tertiary uppercase font-mono font-medium tracking-wider">
                      Severity Level
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border mt-0.5 ${getImpactBadge(
                        problem.impact_level
                      )}`}
                    >
                      {problem.impact_level || 'STANDARD'}
                    </span>
                  </div>
                </div>
              </div>

              {/* PROMINENT CITIZEN STATUS BANNER (Authoritative Backend State Machine) */}
              {problem.status === 'RESOLVED' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-emerald-900 tracking-tight">Work Complete</div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      The department has verified the submitted resolution.
                    </p>
                  </div>
                </div>
              )}

              {problem.status === 'CLOSED' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-emerald-900 tracking-tight">Work Complete</div>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      This issue has been completed and closed.
                    </p>
                  </div>
                </div>
              )}

              {problem.status === 'AWAITING_VERIFICATION' && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-purple-900 tracking-tight">
                      Work completed by field officer — awaiting verification
                    </div>
                    <p className="text-xs text-purple-800 leading-relaxed">
                      Field crew has submitted resolution proof; municipal verification is in progress.
                    </p>
                  </div>
                </div>
              )}

              {problem.status === 'REOPENED' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-amber-900 tracking-tight">Issue Reopened</div>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      This issue has been reopened for further action and remediation.
                    </p>
                  </div>
                </div>
              )}

              {/* Administrative Details */}
              <div className="p-4 rounded-2xl bg-canvas-subtle border border-ink-border space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-ink-secondary">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-ink-tertiary" />
                    <span>Jurisdiction:</span>
                  </span>
                  <span className="font-semibold text-ink-primary">
                    {problem.ward_name || problem.ward_id || 'Bhubaneswar Municipal Area'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-ink-secondary">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-ink-tertiary" />
                    <span>Assigned Department:</span>
                  </span>
                  <span className="font-semibold text-ink-primary">
                    {problem.department_id
                      ? problem.department_id.replace(/_/g, ' ')
                      : 'Municipal Dispatch / Pending Routing'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-ink-secondary">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-ink-tertiary" />
                    <span>First Detected:</span>
                  </span>
                  <span className="font-mono text-ink-primary">
                    {new Date(problem.first_detected_at || problem.created_at).toLocaleDateString(
                      'en-IN',
                      {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }
                    )}
                  </span>
                </div>
              </div>

              {/* Impact Explanation */}
              {problem.impact_explanation && (
                <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 text-xs text-blue-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-civic-blue">
                    <Info className="w-3.5 h-3.5" />
                    <span>CivicPulse Impact Assessment</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{problem.impact_explanation}</p>
                </div>
              )}

              {/* Public Milestone Timeline */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-ink-primary tracking-tight">
                  Public Operational Timeline
                </h4>
                <div className="space-y-3 pl-2 border-l-2 border-civic-blue/30">
                  {problem.timeline && problem.timeline.length > 0 ? (
                    problem.timeline.map((item, index) => (
                      <div key={item.id || index} className="relative pl-4 space-y-0.5">
                        <div
                          className={`absolute -left-[17px] top-0.5 w-3 h-3 rounded-full border-2 bg-white ${
                            item.isCompleted
                              ? 'border-emerald-500 bg-emerald-500'
                              : item.isCurrent
                              ? 'border-civic-blue animate-pulse'
                              : 'border-slate-300'
                          }`}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-primary">
                            {item.action}
                          </span>
                          <span className="text-[10px] text-ink-tertiary font-mono">
                            {new Date(item.timestamp).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-secondary leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="pl-4 space-y-1 text-xs text-ink-secondary">
                      <p className="font-semibold text-ink-primary">Cluster Detected & Triaged</p>
                      <p className="text-[11px]">
                        Correlated from citizen reports and dispatched to operational triage.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Zero-PII Privacy Assurance */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 flex items-start gap-2.5 text-[11px] text-emerald-950">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Citizen Privacy Protection Active</span>
                  <span className="text-emerald-800 leading-normal block">
                    Under municipal data governance, personal citizen identities, exact residential
                    addresses, and phone numbers are strictly stripped from public tracking records.
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ink-border bg-canvas-subtle flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
