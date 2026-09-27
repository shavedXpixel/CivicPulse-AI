'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OfficerShell } from '../../components/shells/OfficerShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/domain/StatusBadge';
import { MapContainer, MapProblemItem } from '../../components/domain/MapContainer';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import { Assignment, ProblemCluster, UserRole } from '@civicpulse/shared';
import {
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  Navigation,
  AlertTriangle,
  Play,
  RefreshCw,
  ShieldAlert,
  Map as MapIcon,
  ListOrdered,
  RotateCcw,
  X,
  Upload
} from 'lucide-react';

interface AssignmentWithProblem extends Assignment {
  problem?: ProblemCluster;
}

export default function FieldOfficerPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, getIdToken } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Resolution Evidence Submission Modal State
  const [evidenceModalProblem, setEvidenceModalProblem] = useState<AssignmentWithProblem | null>(null);
  const [evidenceNotes, setEvidenceNotes] = useState<string>('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreviewUrl, setEvidencePreviewUrl] = useState<string | null>(null);
  const [evidenceUploading, setEvidenceUploading] = useState<boolean>(false);
  const [evidenceUploadProgress, setEvidenceUploadProgress] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const getHeaders = useCallback(async (): Promise<Record<string, string> | undefined> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [getIdToken]);

  // Auth & Role Guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (userProfile && userProfile.role !== UserRole.FIELD_OFFICER) {
      if (userProfile.role === UserRole.DEPARTMENT_OFFICER) {
        router.replace('/department-officer');
      } else if (userProfile.role === UserRole.CITIZEN) {
        router.replace('/citizen');
      }
      // ADMIN can view the field officer workspace for inspection
    }
  }, [user, userProfile, authLoading, router]);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const headers = await getHeaders();
      const res = await apiClient.get<{ data: AssignmentWithProblem[] }>(
        '/api/v1/assignments?assigned_to=me',
        headers
      );
      if (res?.data && Array.isArray(res.data)) {
        setAssignments(res.data);
      }
    } catch (err: any) {
      console.warn('Could not fetch field officer assignments:', err);
      setActionError(err.message || 'Failed to load assigned queue.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

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
      const headers = await getHeaders();
      await apiClient.post(
        `/api/v1/problems/${problemId}/actions`,
        {
          action: 'STARTED_WORK',
          note: 'Field crew deployed on site and initiated maintenance protocol.',
          expected_status: 'ASSIGNED',
        },
        headers
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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvidenceError(null);
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt =
      fileNameLower.endsWith('.jpg') ||
      fileNameLower.endsWith('.jpeg') ||
      fileNameLower.endsWith('.png') ||
      fileNameLower.endsWith('.webp');
    if (!validMimes.includes(file.type) && !hasValidExt) {
      setEvidenceError('Invalid file format. Only JPG and PNG images are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setEvidenceError('File size exceeds 10 MB limit.');
      return;
    }
    setEvidenceFile(file);
    setEvidencePreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmitEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceModalProblem) return;
    if (!evidenceFile) {
      setEvidenceError('Please select a JPG or PNG resolution photo.');
      return;
    }
    if (!evidenceNotes.trim()) {
      setEvidenceError('Please enter factual field engineering notes.');
      return;
    }
    setEvidenceUploading(true);
    setEvidenceUploadProgress('Requesting secure Cloudflare R2 upload authorization...');
    setEvidenceError(null);
    try {
      const headers = await getHeaders();
      const problemId = evidenceModalProblem.problem_id;
      const mimeType = evidenceFile.type || (evidenceFile.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

      // 1. Presigned R2 upload URL
      const presignedRes = await apiClient.post<{
        data: { media_id: string; upload_url: string; storage_path: string; expires_at: string };
      }>(
        `/api/v1/problems/${problemId}/media`,
        {
          file_name: evidenceFile.name,
          mime_type: mimeType,
          file_size_bytes: evidenceFile.size,
        },
        headers
      );

      const { media_id, upload_url, storage_path } = presignedRes.data;

      // 2. Direct upload to Cloudflare R2
      setEvidenceUploadProgress('Uploading resolution photo to Cloudflare R2...');
      await apiClient.uploadFile(upload_url, evidenceFile, mimeType);

      // 3. Confirm media completion
      setEvidenceUploadProgress('Confirming media registration with backend...');
      await apiClient.post(`/api/v1/problems/${problemId}/media/${media_id}/complete`, {}, headers);

      // 4. Submit resolution evidence (transitions IN_PROGRESS -> AWAITING_VERIFICATION)
      setEvidenceUploadProgress('Recording resolution evidence and triggering advisory AI verification...');
      await apiClient.post(
        `/api/v1/problems/${problemId}/evidence`,
        {
          evidence_type: 'COMPLETION_PHOTO',
          before_or_after: 'AFTER',
          storage_path,
          media_ids: [media_id],
          description: evidenceNotes.trim(),
          expected_status: 'IN_PROGRESS',
        },
        headers
      );

      setActionSuccess(`Resolution evidence submitted for problem ${problemId}! State transitioned to AWAITING_VERIFICATION.`);
      setEvidenceModalProblem(null);
      setEvidenceFile(null);
      setEvidencePreviewUrl(null);
      setEvidenceNotes('');
      await fetchAssignments();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes('409') || err.message?.includes('conflict')) {
        setEvidenceError('The problem state changed concurrently. Please refresh.');
      } else {
        setEvidenceError(err.message || 'Evidence submission failed');
      }
    } finally {
      setEvidenceUploading(false);
      setEvidenceUploadProgress(null);
    }
  };

  // Strict client-side deduplication by problem_id: At most ONE active work order per problem
  const activeWorkOrders = useMemo(() => {
    const seen = new Set<string>();
    const result: AssignmentWithProblem[] = [];
    for (const a of assignments) {
      const pid = a.problem_id;
      if (pid && seen.has(pid)) continue;
      if (pid) seen.add(pid);
      result.push(a);
    }
    return result;
  }, [assignments]);

  // Problems for map rendering
  const assignedProblems = activeWorkOrders
    .map((a) => a.problem)
    .filter((p): p is ProblemCluster => Boolean(p));

  const mapProblems: MapProblemItem[] = useMemo(() => {
    return assignedProblems.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      subcategory: p.subcategory,
      wardId: p.ward_id,
      impactScore: (p as any).impact_score ?? (p as any).impactScore ?? 0,
      severity: (p as any).severity ?? p.impact_level,
      signalCount: (p as any).signal_count ?? (p as any).signalCount ?? 1,
      status: p.status,
      department: p.department_id,
      location: p.location,
      createdAt: p.created_at,
    }));
  }, [assignedProblems]);

  return (
    <OfficerShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader
            title="Field Operations Queue"
            description="Active emergency dispatches and assigned infrastructure work orders (strictly scoped to assigned_to === user.id)."
            badge={
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded font-mono text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {activeWorkOrders.length} Assigned {activeWorkOrders.length === 1 ? 'Task' : 'Tasks'}
                </span>
                <button
                  onClick={fetchAssignments}
                  disabled={loading}
                  className="p-1.5 text-ink-muted hover:text-ink-primary rounded border border-ink-border bg-canvas-card hover:bg-canvas-elevated transition-colors"
                  title="Refresh assigned tasks"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            }
          />

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-canvas-card border border-ink-border p-1 rounded-lg self-start sm:self-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-ink-primary text-canvas-card font-semibold'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              Work Orders
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'map'
                  ? 'bg-ink-primary text-canvas-card font-semibold'
                  : 'text-ink-muted hover:text-ink-primary'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              Field Map
            </button>
          </div>
        </div>

        {/* Action alerts */}
        {actionSuccess && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 font-mono text-xs text-emerald-400 flex items-center gap-2 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 font-mono text-xs text-rose-400 flex items-center gap-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold">{actionError}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && activeWorkOrders.length === 0 ? (
          <div className="p-12 border border-ink-border bg-canvas-card rounded-lg flex flex-col items-center justify-center text-xs text-ink-muted gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-ink-primary" />
            <span>Loading assigned officer tasks...</span>
          </div>
        ) : activeWorkOrders.length === 0 ? (
          <div className="p-12 border border-ink-border bg-canvas-card rounded-lg text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-ink-primary">No Operational Problems Assigned</h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              No active work orders are currently assigned to {userProfile?.display_name || user?.email || 'your officer account'}. As emergency dispatches are assigned by department leadership, they will appear here in real time.
            </p>
          </div>
        ) : viewMode === 'map' ? (
          /* Field Map View */
          <div className="space-y-3">
            <div className="bg-canvas-card border border-ink-border rounded-lg overflow-hidden h-[550px] relative">
              <MapContainer problems={mapProblems} />
            </div>
            <div className="text-xs text-ink-muted font-mono text-right">
              Showing {assignedProblems.length} geo-referenced assignments
            </div>
          </div>
        ) : (
          /* Work Orders List */
          <div className="space-y-6">
            {activeWorkOrders.map((assignment) => {
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
                    isCritical ? 'border-rose-500/30 bg-canvas-card' : 'border-ink-border bg-canvas-card'
                  } space-y-5`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-border/60 pb-4 gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            isCritical ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {isCritical ? 'EMERGENCY DISPATCH' : 'SCHEDULED WORK ORDER'}
                        </span>
                        <span className="text-xs font-mono text-ink-muted">
                          Assignment #{assignment.id} • Problem #{assignment.problem_id}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-ink-primary">
                        {problem?.title || `Problem Incident #${assignment.problem_id}`}
                      </h2>
                    </div>
                    {problem && <StatusBadge status={problem.status} />}
                  </div>

                  {/* Telemetry Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div className="flex items-start gap-2 text-ink-muted">
                      <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-ink-primary">Location & Ward</span>
                        <div className="text-[11px] font-mono text-ink-muted">
                          {problem?.location
                            ? `${problem.location.lat.toFixed(4)}° N, ${problem.location.lng.toFixed(4)}° E`
                            : 'Coordinates registered in problem dossier'}
                        </div>
                        {problem?.ward_id && (
                          <div className="text-[11px] font-mono text-ink-muted">
                            Ward: {problem.ward_id}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 text-ink-muted">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-ink-primary">SLA Target & Countdown</span>
                        <div className="text-[11px] font-mono flex items-center gap-1.5 font-bold">
                          <span className="text-ink-muted">
                            Target: {sla?.target_hours ?? (isCritical ? 24 : 48)}h
                          </span>
                          <span className="text-ink-muted/50">•</span>
                          <span
                            className={
                              riskStatus === 'BREACHED'
                                ? 'text-rose-400'
                                : riskStatus === 'AT_RISK'
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }
                          >
                            {hoursRemaining}h remaining ({riskStatus})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Historical SLA Breach Indicator */}
                    {wasBreached && (
                      <div className="flex items-start gap-2 text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-[11px]">Historical Breach Preserved</span>
                          <p className="text-[10px] text-rose-400/80 leading-tight">
                            Exceeded deadline prior to resolution. Retained for audit reporting.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assignment Instructions */}
                  <div className="p-4 rounded-lg bg-canvas-elevated border border-ink-border text-xs space-y-1">
                    <span className="font-mono text-ink-muted uppercase font-semibold text-[10px]">
                      DISPATCH INSTRUCTIONS & NOTES
                    </span>
                    <p className="text-ink-primary leading-relaxed">
                      {assignment.notes || 'Proceed to coordinates, inspect reported infrastructure disruption, and execute repair protocol.'}
                    </p>
                  </div>

                  {/* Action Workflow Buttons */}
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    {problem?.status === 'ASSIGNED' && (
                      <Button
                        size="md"
                        className="gap-2 bg-ink-primary text-canvas-card hover:bg-ink-secondary font-mono uppercase text-xs"
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
                        onClick={() => {
                          setEvidenceModalProblem(assignment);
                          setEvidenceFile(null);
                          setEvidencePreviewUrl(null);
                          setEvidenceNotes('');
                          setEvidenceError(null);
                        }}
                      >
                        <Camera className="w-4 h-4" />
                        <span>Submit Resolution Evidence</span>
                      </Button>
                    )}

                    {problem?.status === 'AWAITING_VERIFICATION' && (
                      <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Verification Requested — Awaiting Department Supervisory Review</span>
                      </div>
                    )}

                    {problem?.location && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${problem.location.lat},${problem.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 border border-ink-border rounded text-xs text-ink-muted hover:text-ink-primary inline-flex items-center gap-1.5 hover:bg-canvas-elevated transition-colors"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Navigate to Site</span>
                      </a>
                    )}

                    <Link
                      href={`/dashboard/problems/${assignment.problem_id}#evidence-workspace`}
                      className="text-xs font-semibold text-ink-primary hover:underline ml-auto"
                    >
                      Inspect Problem Dossier →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Real R2 Resolution Evidence Submission Modal */}
        {evidenceModalProblem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-canvas-card border border-ink-border rounded-xl max-w-lg w-full p-6 shadow-modal space-y-4 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                  <Camera className="w-4 h-4 text-civic-terracotta" />
                  <span>Submit Resolution Evidence #{evidenceModalProblem.problem_id}</span>
                </h3>
                <button
                  onClick={() => setEvidenceModalProblem(null)}
                  className="text-ink-muted hover:text-ink-primary text-xs font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {evidenceError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{evidenceError}</span>
                </div>
              )}

              {evidenceUploadProgress && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center gap-2 rounded-lg">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                  <span>{evidenceUploadProgress}</span>
                </div>
              )}

              <form onSubmit={handleSubmitEvidence} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-ink-muted font-bold">
                    Real Photo Evidence (Cloudflare R2 Presigned Upload)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-ink-border hover:border-civic-terracotta p-4 rounded-lg text-center cursor-pointer transition-colors bg-canvas-subtle"
                  >
                    {evidencePreviewUrl ? (
                      <div className="space-y-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={evidencePreviewUrl}
                          alt="Evidence Preview"
                          className="max-h-40 mx-auto rounded object-cover"
                        />
                        <span className="text-[10px] text-ink-muted block">
                          {evidenceFile?.name} ({(evidenceFile?.size ? evidenceFile.size / 1024 : 0).toFixed(0)} KB) — Click to replace
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-4">
                        <Upload className="w-6 h-6 mx-auto text-ink-muted" />
                        <span className="font-semibold text-ink-primary block">Click to upload completion photo</span>
                        <span className="text-[10px] text-ink-muted block">JPG or PNG up to 10MB</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-ink-muted font-bold">
                    Factual Field Engineering Notes
                  </label>
                  <textarea
                    rows={3}
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    placeholder="Describe specific repair steps taken, parts replaced, and operational tests performed..."
                    className="w-full p-2.5 rounded-lg border border-ink-border bg-canvas-card text-ink-primary text-xs focus:outline-none focus:border-civic-terracotta"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-ink-border">
                  <button
                    type="button"
                    onClick={() => setEvidenceModalProblem(null)}
                    disabled={evidenceUploading}
                    className="px-3 py-2 border border-ink-border rounded text-ink-muted hover:text-ink-primary uppercase text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={evidenceUploading || !evidenceFile}
                    className="px-4 py-2 bg-civic-terracotta text-white hover:bg-civic-terracottaDark rounded uppercase text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{evidenceUploading ? 'Uploading & Verifying...' : 'Submit Resolution Proof'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </OfficerShell>
  );
}
