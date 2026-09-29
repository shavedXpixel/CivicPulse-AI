'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CitizenShell } from '../../../components/shells/CitizenShell';
import {
  Check,
  ArrowLeft,
  Building2,
  Clock,
  AlertCircle,
  Plus,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Lock,
  RefreshCw,
  Camera,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { SignalAIPreview, SignalAIPreviewData } from '../../../components/citizen/SignalAIPreview';
import { PublicProblemModal } from '../../../components/citizen/PublicProblemModal';
import { useAuth } from '../../../context/AuthContext';
import { useTranslation } from '../../../context/LanguageContext';

interface CitizenSignal {
  id: string;
  original_text?: string;
  category?: string;
  ward_id?: string;
  ward_name?: string;
  location_reference?: string;
  location?: { lat: number; lng: number };
  status: string;
  problem_status?: string;
  processing_status: string;
  created_at: string;
  media_ids?: string[];
  recommended_department?: string;
  problem_cluster_id?: string;
  ai_analysis?: SignalAIPreviewData;
}

export default function CitizenIssuesPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [signals, setSignals] = useState<CitizenSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiClient.get<{ data: CitizenSignal[] }>('/api/v1/signals/me');
      setSignals(res.data || []);
    } catch (err: any) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        setError('Your session has expired or you are unauthenticated. Please sign in to view your reports.');
      } else if (err.status === 403 || err.code === 'FORBIDDEN') {
        setError('Access forbidden. You do not have permission to access these records.');
      } else {
        setError(err.message || 'Unable to load reports from server.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wait for auth initialization to complete
    if (authLoading) {
      return;
    }

    if (!user) {
      setIsLoading(false);
      return;
    }

    loadReports();
  }, [authLoading, user, loadReports]);

  return (
    <CitizenShell>
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="flex items-center justify-between">
          <Link
            href="/citizen"
            className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('common.backToHome')}</span>
          </Link>

          <Link href="/citizen/report">
            <Button variant="primary" size="sm" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>{t('issues.newReport')}</span>
            </Button>
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
            {t('issues.title')}
          </h1>
          <p className="text-xs text-ink-secondary">
            {t('issues.subtitle')}
          </p>
        </div>

        {/* Unauthenticated state */}
        {!authLoading && !user ? (
          <div className="p-8 text-center rounded-sm border border-ink-border bg-canvas-card shadow-none space-y-4">
            <div className="w-10 h-10 rounded-sm bg-canvas-subtle border border-ink-border text-ink-tertiary mx-auto flex items-center justify-center">
              <Lock className="w-5 h-5 text-civic-terracotta" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink-primary font-mono uppercase tracking-wider">{t('issues.authRequiredTitle')}</h3>
              <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
                {t('issues.authRequiredDesc')}
              </p>
            </div>
            <Link href="/login" className="inline-block pt-1">
              <Button variant="primary" size="sm" className="font-mono text-xs">
                {t('issues.signInCitizen')}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-4 rounded-sm border border-civic-rose/30 bg-rose-50 text-xs text-rose-900 flex items-start justify-between gap-3 font-mono">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadReports}
                    className="text-xs font-semibold text-civic-terracotta hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{t('common.retry')}</span>
                  </button>
                  {!user && (
                    <Link href="/login" className="text-xs font-semibold text-civic-rose hover:underline">
                      {t('common.signIn')}
                    </Link>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="p-12 text-center text-ink-secondary space-y-3 font-mono">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-civic-terracotta" />
                <p className="text-xs">
                  {t('common.loading')}
                </p>
              </div>
            ) : signals.length === 0 ? (
              <div className="p-8 text-center rounded-sm border border-ink-border bg-canvas-card shadow-none space-y-4">
                <div className="w-10 h-10 rounded-sm bg-canvas-subtle border border-ink-border text-ink-tertiary mx-auto flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-civic-terracotta" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-ink-primary font-mono uppercase tracking-wider">{t('issues.emptyTitle')}</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed">
                    {t('issues.emptyDesc')}
                  </p>
                </div>
                <Link href="/citizen/report" className="inline-block">
                  <Button variant="primary" size="sm" className="font-mono text-xs">
                    {t('issues.fileFirstReport')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {signals.map((sig) => {
                  const formattedDate = new Date(sig.created_at).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={sig.id}
                      className="p-5 rounded-sm border border-ink-border bg-canvas-card shadow-none space-y-4 hover:border-ink-secondary transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-civic-terracotta">
                              #{sig.id}
                            </span>
                            {sig.problem_status === 'RESOLVED' || sig.problem_status === 'CLOSED' ? (
                              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Work Complete</span>
                              </span>
                            ) : sig.problem_status === 'AWAITING_VERIFICATION' ? (
                              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                                Awaiting Verification
                              </span>
                            ) : sig.problem_status === 'REOPENED' ? (
                              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-300">
                                Reopened
                              </span>
                            ) : sig.problem_status === 'IN_PROGRESS' ? (
                              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-blue-50 text-civic-blue border border-civic-blue/30">
                                In Progress
                              </span>
                            ) : sig.problem_status === 'ASSIGNED' ? (
                              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-blue-50 text-civic-blue border border-civic-blue/30">
                                Officer Dispatched
                              </span>
                            ) : sig.problem_status === 'TRIAGED' ? (
                              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                                Incident Triaged
                              </span>
                            ) : (
                              <span
                                className={`px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold border ${
                                  sig.processing_status === 'COMPLETED'
                                    ? 'bg-slate-50 text-slate-800 border-slate-200'
                                    : 'bg-amber-50 text-amber-900 border-amber-200'
                                }`}
                              >
                                {sig.processing_status === 'COMPLETED' ? 'Report Received' : 'Pending Analysis'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-ink-primary leading-relaxed">
                            {sig.original_text}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-ink-border/50 text-[11px] text-ink-secondary font-mono">
                        <span>
                          {sig.location_reference ||
                            sig.ward_name ||
                            sig.ward_id ||
                            (sig.location ? `${sig.location.lat.toFixed(4)}, ${sig.location.lng.toFixed(4)}` : 'Bhubaneswar')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-ink-tertiary" />
                          <span>{formattedDate}</span>
                        </span>
                      </div>

                      {/* Media indicator */}
                      {sig.media_ids && sig.media_ids.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-canvas-subtle border border-ink-border/50 text-[11px] text-ink-secondary">
                          <Camera className="w-3.5 h-3.5 text-civic-blue shrink-0" />
                          <span>{sig.media_ids.length} verification photograph{sig.media_ids.length > 1 ? 's' : ''} attached</span>
                        </div>
                      )}

                      {/* Progress Milestone Tracker */}
                      <div className="p-3.5 rounded-2xl bg-canvas-subtle border border-ink-border/60 text-xs space-y-2.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary font-medium">
                          Lifecycle Progress
                        </div>

                        {/* Milestone 1: Signal Recorded */}
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-civic-emerald text-white flex items-center justify-center text-[9px] shrink-0">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span className="text-[11px] font-medium text-ink-primary">
                            Signal recorded & PII protected
                          </span>
                        </div>

                        {/* Milestone 2: AI Triage */}
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                              sig.processing_status === 'COMPLETED'
                                ? 'bg-civic-emerald text-white'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {sig.processing_status === 'COMPLETED' ? (
                              <Check className="w-2.5 h-2.5" />
                            ) : (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            )}
                          </div>
                          <span className="text-[11px] text-ink-secondary">
                            {sig.processing_status === 'COMPLETED'
                              ? `AI triage completed${sig.category ? ` (${sig.category})` : ''}`
                              : 'Awaiting AI intelligence pipeline'}
                          </span>
                        </div>

                        {/* Milestone 3: Problem Correlation & Completion Status */}
                        {sig.problem_cluster_id ? (
                          <div className="space-y-2">
                            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/70 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 rounded-full bg-civic-blue text-white flex items-center justify-center text-[9px] shrink-0">
                                    <Check className="w-2.5 h-2.5" />
                                  </div>
                                  <span className="text-[11px] font-semibold text-civic-blueDark">
                                    Community Problem Cluster Correlated
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedProblemId(sig.problem_cluster_id!)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-civic-blue/30 text-civic-blue text-[11px] font-semibold hover:bg-civic-blue hover:text-white transition-colors shadow-xs"
                                >
                                  <span>Track Cluster #{sig.problem_cluster_id.substring(0, 10)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-600 pl-6">
                                This report has been aggregated with other citizen signals for coordinated municipal response.
                              </p>
                            </div>

                            {/* Authoritative State Machine Citizen Banners on the Card */}
                            {sig.problem_status === 'RESOLVED' && (
                              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-emerald-900">Work Complete</div>
                                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                                    The department has verified the submitted resolution.
                                  </p>
                                </div>
                              </div>
                            )}

                            {sig.problem_status === 'CLOSED' && (
                              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-emerald-900">Work Complete</div>
                                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                                    This issue has been completed and closed.
                                  </p>
                                </div>
                              </div>
                            )}

                            {sig.problem_status === 'AWAITING_VERIFICATION' && (
                              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 flex items-start gap-2.5">
                                <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-purple-900">
                                    Work completed by field officer — awaiting verification
                                  </div>
                                  <p className="text-[11px] text-purple-800 leading-relaxed">
                                    Field crew has submitted resolution proof; municipal verification is in progress.
                                  </p>
                                </div>
                              </div>
                            )}

                            {sig.problem_status === 'REOPENED' && (
                              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-2.5">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-amber-900">Issue Reopened</div>
                                  <p className="text-[11px] text-amber-800 leading-relaxed">
                                    This issue has been reopened for further action and remediation.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-canvas-muted text-ink-tertiary border border-ink-border flex items-center justify-center text-[9px] shrink-0">
                              3
                            </div>
                            <span className="text-[11px] text-ink-secondary">
                              Spatial correlation & cluster clustering in progress
                            </span>
                          </div>
                        )}

                        {/* Milestone 4: Municipal Routing */}
                        {sig.recommended_department && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-civic-emerald text-white flex items-center justify-center text-[9px] shrink-0">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-[11px] font-medium text-ink-primary">
                              Routed to: {sig.recommended_department.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* AI Intelligence Inspection Toggle */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedSignalId(expandedSignalId === sig.id ? null : sig.id)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-ink-border bg-canvas-subtle hover:bg-white text-xs font-semibold text-ink-primary transition-colors"
                        >
                          <div className="flex items-center gap-1.5 text-civic-blue">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>
                              {sig.processing_status === 'COMPLETED'
                                ? 'View Gemini AI Analysis'
                                : 'Run Gemini AI Comprehension'}
                            </span>
                          </div>
                          {expandedSignalId === sig.id ? (
                            <ChevronUp className="w-4 h-4 text-ink-secondary" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-ink-secondary" />
                          )}
                        </button>
                      </div>

                      {/* Expanded AI View */}
                      {expandedSignalId === sig.id && (
                        <div className="pt-2">
                          <SignalAIPreview
                            signalId={sig.id}
                            initialProcessingStatus={sig.processing_status}
                            initialAnalysis={sig.ai_analysis}
                            onAnalysisCompleted={(updatedAnalysis) => {
                              setSignals((prev) =>
                                prev.map((s) =>
                                  s.id === sig.id
                                    ? {
                                        ...s,
                                        processing_status: 'COMPLETED',
                                        recommended_department: updatedAnalysis.recommended_department || undefined,
                                        ai_analysis: updatedAnalysis
                                      }
                                    : s
                                )
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Safe Public Problem Tracking Modal */}
        {selectedProblemId && (
          <PublicProblemModal
            problemId={selectedProblemId}
            onClose={() => setSelectedProblemId(null)}
          />
        )}
      </div>
    </CitizenShell>
  );
}
