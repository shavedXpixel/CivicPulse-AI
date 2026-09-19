'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CitizenShell } from '../../components/shells/CitizenShell';
import {
  Mic,
  Camera,
  FileText,
  ArrowRight,
  Clock,
  MapPin,
  AlertCircle,
  Loader2,
  Lock,
  PlusCircle,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';

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
  problem_cluster_id?: string;
  ai_analysis?: any;
}

export default function CitizenHomePage() {
  const { user, loading: authLoading } = useAuth();

  const [signals, setSignals] = useState<CitizenSignal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await apiClient.get<{ data: CitizenSignal[] }>('/api/v1/signals/me');
      setSignals(res.data || []);
    } catch (err: any) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        setLoadError('Session expired or authentication required. Please sign in to view your reports.');
      } else {
        setLoadError(err.message || 'Unable to fetch citizen reports from server.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsLoading(false);
      return;
    }
    loadData();
  }, [user, authLoading, loadData]);

  // Derived real metrics
  const totalReports = signals.length;
  const inProgressReports = signals.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'ATTACHED_TO_PROBLEM'
  ).length;
  const resolvedReports = signals.filter(
    (s) => s.status === 'RESOLVED' || s.status === 'CLOSED'
  ).length;
  const correlatedProblems = signals.filter((s) => Boolean(s.problem_cluster_id)).length;

  const citizenName =
    user?.displayName ||
    (user?.email ? user.email.split('@')[0] : 'Citizen');

  return (
    <CitizenShell>
      <div className="space-y-8 max-w-2xl mx-auto">
        {/* Citizen Identity & Header */}
        <div className="space-y-2 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-civic-blueLight text-civic-blueDark">
              <ShieldCheck className="w-3.5 h-3.5 text-civic-blue" />
              <span>Verified Citizen Portal</span>
            </div>
            {user && (
              <span className="text-xs text-ink-secondary font-mono">
                {user.email}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary">
            {user ? `Welcome, ${citizenName}` : 'Civic Problem Reporting'}
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Report civic issues in your neighborhood. CivicPulse analyzes plain language, detects categories, correlates public problems, and routes actions to municipal authorities.
          </p>
        </div>

        {/* Unauthenticated Notice */}
        {!authLoading && !user && (
          <div className="p-6 rounded-2xl border border-amber-200 bg-amber-50/70 text-xs text-amber-950 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Sign In to Track Your Neighborhood Reports</span>
            </div>
            <p className="leading-relaxed text-xs text-amber-900/90">
              Sign in with your citizen profile to file verified civic reports, receive real-time updates on municipal triage, and track resolution timelines with DPDP privacy protections.
            </p>
            <div className="pt-1 flex items-center gap-3">
              <Link href="/login">
                <Button variant="primary" size="sm" className="text-xs gap-1.5">
                  <span>Sign In as Citizen</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
              <Link href="/citizen/report">
                <Button variant="secondary" size="sm" className="text-xs">
                  File a Report
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Quick Report Intake Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/citizen/report?mode=voice"
            className="flex items-center sm:flex-col justify-start sm:justify-center p-4 rounded-sm border border-ink-border bg-canvas-card shadow-none hover:border-ink-secondary transition-all gap-3 text-left sm:text-center group"
          >
            <div className="w-9 h-9 rounded-sm bg-canvas-subtle border border-ink-border flex items-center justify-center text-civic-terracotta group-hover:border-ink-primary transition-colors">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-primary">Speak description</div>
              <div className="text-[10px] font-mono text-ink-secondary">Odia (ଓଡ଼ିଆ), Hindi, English</div>
            </div>
          </Link>

          <Link
            href="/citizen/report?mode=photo"
            className="flex items-center sm:flex-col justify-start sm:justify-center p-4 rounded-sm border border-ink-border bg-canvas-card shadow-none hover:border-ink-secondary transition-all gap-3 text-left sm:text-center group"
          >
            <div className="w-9 h-9 rounded-sm bg-canvas-subtle border border-ink-border flex items-center justify-center text-civic-terracotta group-hover:border-ink-primary transition-colors">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-primary">Attach photo</div>
              <div className="text-[10px] font-mono text-ink-secondary">Up to 10 MB with GPS</div>
            </div>
          </Link>

          <Link
            href="/citizen/report?mode=text"
            className="flex items-center sm:flex-col justify-start sm:justify-center p-4 rounded-sm border border-ink-border bg-canvas-card shadow-none hover:border-ink-secondary transition-all gap-3 text-left sm:text-center group"
          >
            <div className="w-9 h-9 rounded-sm bg-canvas-subtle border border-ink-border flex items-center justify-center text-civic-terracotta group-hover:border-ink-primary transition-colors">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-primary">Type description</div>
              <div className="text-[10px] font-mono text-ink-secondary">Plain-language civic text</div>
            </div>
          </Link>
        </div>

        {/* Primary Call to Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 rounded-sm bg-canvas-card border border-ink-border shadow-none">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta font-semibold block">
              PUBLIC ACTION DESK
            </span>
            <h3 className="text-sm font-bold text-ink-primary flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-civic-terracotta" />
              <span>Have a new civic problem to report?</span>
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              Instant AI structuring, GIS ward localization, and public correlation.
            </p>
          </div>
          <Link href="/citizen/report" className="shrink-0">
            <Button variant="primary" size="sm" className="w-full sm:w-auto text-xs font-mono font-semibold">
              Report a Public Issue
            </Button>
          </Link>
        </div>

        {/* Real Reports & Telemetry Section */}
        {isLoading ? (
          <div className="p-12 text-center text-ink-secondary space-y-3 bg-canvas-card rounded-sm border border-ink-border">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-civic-terracotta" />
            <p className="text-xs font-mono">Loading citizen dashboard data from server...</p>
          </div>
        ) : loadError ? (
          <div className="p-4 rounded-sm border border-civic-rose/30 bg-rose-50 text-xs text-rose-900 flex items-start justify-between gap-3 font-mono">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
              <span>{loadError}</span>
            </div>
            <button
              onClick={loadData}
              className="text-xs font-semibold text-civic-terracotta hover:underline shrink-0"
            >
              Retry
            </button>
          </div>
        ) : totalReports === 0 ? (
          /* Honest Empty State */
          <div className="p-8 text-center rounded-sm border border-ink-border bg-canvas-card shadow-none space-y-4">
            <div className="w-10 h-10 rounded-sm bg-canvas-subtle border border-ink-border text-ink-tertiary mx-auto flex items-center justify-center">
              <Building2 className="w-5 h-5 text-civic-terracotta" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink-primary">No reports yet</h3>
              <p className="text-xs text-ink-secondary max-w-md mx-auto leading-relaxed">
                You have not submitted any civic reports yet. When you report public issues in your area, your reports and correlated government progress will appear here.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/citizen/report">
                <Button variant="primary" size="sm" className="text-xs gap-1.5 font-mono">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Report a Public Issue</span>
                </Button>
              </Link>
              <Link href="/citizen/issues">
                <Button variant="secondary" size="sm" className="text-xs font-mono">
                  Track My Reports
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Authoritative Dashboard with Real Counts & Recent Reports */
          <div className="space-y-6">
            {/* Real Authoritative Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-sm border border-ink-border bg-canvas-card shadow-none space-y-1">
                <span className="text-[10px] font-mono font-semibold text-ink-secondary uppercase tracking-widest block">
                  Total Reports
                </span>
                <span className="text-2xl font-bold font-mono text-ink-primary">
                  {totalReports}
                </span>
              </div>

              <div className="p-4 rounded-sm border border-ink-border bg-canvas-card shadow-none space-y-1">
                <span className="text-[10px] font-mono font-semibold text-ink-secondary uppercase tracking-widest block">
                  In Progress
                </span>
                <span className="text-2xl font-bold font-mono text-civic-amber">
                  {inProgressReports}
                </span>
              </div>

              <div className="p-4 rounded-sm border border-ink-border bg-canvas-card shadow-none space-y-1">
                <span className="text-[10px] font-mono font-semibold text-ink-secondary uppercase tracking-widest block">
                  Resolved
                </span>
                <span className="text-2xl font-bold font-mono text-civic-emerald">
                  {resolvedReports}
                </span>
              </div>

              <div className="p-4 rounded-sm border border-ink-border bg-canvas-card shadow-none space-y-1">
                <span className="text-[10px] font-mono font-semibold text-ink-secondary uppercase tracking-widest block">
                  Correlated
                </span>
                <span className="text-2xl font-bold font-mono text-civic-terracotta">
                  {correlatedProblems}
                </span>
              </div>
            </div>

            {/* Recent Citizen Reports */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-ink-border pb-2">
                <h2 className="text-sm font-mono font-bold text-ink-primary uppercase tracking-wider flex items-center gap-2">
                  <span>Your recent reports</span>
                  <span className="text-xs font-mono font-normal text-ink-tertiary">
                    ({signals.length})
                  </span>
                </h2>
                <Link
                  href="/citizen/issues"
                  className="text-xs font-mono font-medium text-civic-terracotta hover:underline flex items-center gap-1"
                >
                  <span>Track My Reports</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-2.5">
                {signals.slice(0, 3).map((sig) => {
                  const formattedDate = new Date(sig.created_at).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={sig.id}
                      className="p-4 rounded-sm border border-ink-border bg-canvas-card shadow-none hover:border-ink-secondary transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-civic-terracotta">
                              #{sig.id}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold border ${
                                sig.processing_status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-900 border-amber-200'
                              }`}
                            >
                              {sig.processing_status === 'COMPLETED' ? 'Processed' : 'Pending Analysis'}
                            </span>
                            {sig.problem_cluster_id && (
                              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-canvas-subtle text-ink-primary border border-ink-border">
                                Correlated: #{sig.problem_cluster_id}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-ink-primary line-clamp-2 leading-relaxed">
                            {sig.original_text}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-[11px] text-ink-secondary border-t border-ink-border">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <MapPin className="w-3 h-3 text-ink-tertiary" />
                          <span>
                            {sig.location_reference ||
                              sig.ward_name ||
                              sig.ward_id ||
                              (sig.location ? `${sig.location.lat.toFixed(4)}, ${sig.location.lng.toFixed(4)}` : 'Bhubaneswar')}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-mono text-ink-tertiary">
                          <Clock className="w-3 h-3" />
                          <span>{formattedDate}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Navigation Footer */}
            <div className="pt-2 flex items-center justify-between border-t border-ink-border text-xs font-mono">
              <Link href="/citizen/report" className="text-civic-terracotta hover:underline font-semibold flex items-center gap-1">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Report another issue</span>
              </Link>
              <Link href="/citizen/issues" className="text-ink-secondary hover:text-ink-primary font-medium flex items-center gap-1">
                <span>View all reports ({signals.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </CitizenShell>
  );
}
