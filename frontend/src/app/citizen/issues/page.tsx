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
  RefreshCw
} from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../../components/ui/Button';
import { SignalAIPreview, SignalAIPreviewData } from '../../../components/citizen/SignalAIPreview';
import { useAuth } from '../../../context/AuthContext';

interface CitizenSignal {
  id: string;
  original_text?: string;
  category?: string;
  ward_id?: string;
  ward_name?: string;
  location_reference?: string;
  location?: { lat: number; lng: number };
  status: string;
  processing_status: string;
  created_at: string;
  media_ids?: string[];
  recommended_department?: string;
  problem_cluster_id?: string;
  ai_analysis?: SignalAIPreviewData;
}

export default function CitizenIssuesPage() {
  const { user, isDemoMode, loading: authLoading } = useAuth();

  const [signals, setSignals] = useState<CitizenSignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);

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

    // In REAL_MODE: if user is not signed in, stop loading and prompt login
    if (!isDemoMode && !user) {
      setIsLoading(false);
      return;
    }

    // In DEMO_MODE or authenticated REAL_MODE, load citizen reports
    loadReports();
  }, [isDemoMode, authLoading, user, loadReports]);

  return (
    <CitizenShell>
      <div className="space-y-6 max-w-xl mx-auto">
        <div className="flex items-center justify-between">
          <Link
            href="/citizen"
            className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>

          <Link href="/citizen/report">
            <Button variant="primary" size="sm" className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>New Report</span>
            </Button>
          </Link>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
            My Submitted Reports
          </h1>
          <p className="text-xs text-ink-secondary">
            {isDemoMode
              ? 'Personal signal records tracked securely under your citizen profile.'
              : 'Real reports submitted by your authenticated citizen profile, persisted in Firestore.'}
          </p>
        </div>

        {/* REAL_MODE unauthenticated state */}
        {!isDemoMode && !authLoading && !user ? (
          <div className="p-8 text-center rounded-2xl border border-ink-border bg-white shadow-card space-y-4">
            <div className="w-12 h-12 rounded-full bg-canvas-subtle text-ink-tertiary mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6 text-civic-blue" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink-primary">Authentication Required</h3>
              <p className="text-xs text-ink-secondary max-w-sm mx-auto">
                Sign in with your citizen account to securely view and track the status of your submitted municipal reports.
              </p>
            </div>
            <Link href="/login" className="inline-block pt-1">
              <Button variant="primary" size="sm">
                Sign In as Citizen
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-4 rounded-xl border border-civic-rose/30 bg-rose-50 text-xs text-rose-900 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadReports}
                    className="text-xs font-semibold text-civic-blue hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                  {!isDemoMode && !user && (
                    <Link href="/login" className="text-xs font-semibold text-civic-rose hover:underline">
                      Sign In
                    </Link>
                  )}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="p-12 text-center text-ink-secondary space-y-3">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-civic-blue" />
                <p className="text-xs">
                  {isDemoMode ? 'Loading demo reports from server...' : 'Retrieving your reports from Firestore...'}
                </p>
              </div>
            ) : signals.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-ink-border bg-white shadow-card space-y-4">
                <div className="w-12 h-12 rounded-full bg-canvas-subtle text-ink-tertiary mx-auto flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-ink-primary">No Reports Yet</h3>
                  <p className="text-xs text-ink-secondary">
                    {isDemoMode
                      ? 'You have not submitted any municipal signals under this profile.'
                      : 'You have not submitted any municipal signals under this citizen account.'}
                  </p>
                </div>
                <Link href="/citizen/report" className="inline-block">
                  <Button variant="primary" size="sm">
                    Submit a Report
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
                      className="p-5 rounded-2xl border border-ink-border bg-white shadow-card space-y-4 hover:border-civic-blue/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-civic-blue">
                              #{sig.id}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                sig.processing_status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                              }`}
                            >
                              {sig.processing_status === 'COMPLETED' ? 'Processed' : 'Pending Analysis'}
                            </span>
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

                      {/* Progress Milestone Tracker */}
                      <div className="p-3 rounded-xl bg-canvas-subtle border border-ink-border/60 text-xs space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-civic-emerald text-white flex items-center justify-center text-[9px]">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                          <span className="text-[11px] font-medium text-ink-primary">
                            Signal recorded & PII protected
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${
                              sig.processing_status === 'COMPLETED'
                                ? 'bg-civic-emerald text-white'
                                : 'bg-canvas-muted text-ink-tertiary border border-ink-border'
                            }`}
                          >
                            {sig.processing_status === 'COMPLETED' ? <Check className="w-2.5 h-2.5" /> : '2'}
                          </div>
                          <span className="text-[11px] text-ink-secondary">
                            {sig.processing_status === 'COMPLETED'
                              ? 'AI structured extraction completed'
                              : 'Awaiting AI intelligence pipeline'}
                          </span>
                        </div>

                        {sig.problem_cluster_id && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full bg-civic-blue text-white flex items-center justify-center text-[9px]">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                            <span className="text-[11px] font-medium text-civic-blueDark">
                              Public Problem Correlated: <span className="font-mono font-bold">#{sig.problem_cluster_id}</span>
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
      </div>
    </CitizenShell>
  );
}
