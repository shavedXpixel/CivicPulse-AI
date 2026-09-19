'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { MapContainer, MapProblemItem } from '../../../components/domain/MapContainer';
import { apiClient } from '../../../lib/api-client';
import { ProblemCluster } from '@civicpulse/shared';
import { StatusBadge } from '../../../components/domain/StatusBadge';
import { ImpactScore } from '../../../components/domain/ImpactScore';
import { Filter, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const DEPARTMENTS = [
  { id: '', label: 'All Departments' },
  { id: 'WATCO', label: 'WATCO (Water & Sewerage)' },
  { id: 'BMC_ROADS', label: 'BMC Engineering (Roads)' },
  { id: 'BMC_SANITATION', label: 'BMC Sanitation' },
  { id: 'TPCODL', label: 'TPCODL (Power Distribution)' },
  { id: 'BSCL', label: 'Smart City Infrastructure' },
];

const SEVERITIES = [
  { id: '', label: 'All Severities' },
  { id: 'CRITICAL', label: 'Critical (80+)' },
  { id: 'HIGH', label: 'High (60-79)' },
  { id: 'MEDIUM', label: 'Medium (40-59)' },
  { id: 'LOW', label: 'Low (<40)' },
];

const STATUSES = [
  { id: '', label: 'All Statuses' },
  { id: 'NEW', label: 'New / Ingested' },
  { id: 'TRIAGED', label: 'Triaged' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'RESOLVED', label: 'Resolved' },
];

export default function MapWorkspacePage() {
  const [problems, setProblems] = useState<MapProblemItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Selected Problem on Rail
  const [selectedProblemId, setSelectedProblemId] = useState<string | undefined>(undefined);

  const fetchMapProblems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (departmentFilter) params.set('department_id', departmentFilter);
      if (severityFilter) params.set('impact_level', severityFilter);
      if (statusFilter) params.set('status', statusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiClient.get<{ data: ProblemCluster[] }>(`/api/v1/dashboard/map${qs}`);

      if (res?.data) {
        // Map only genuine records that possess valid numeric coordinates
        const mapped: MapProblemItem[] = res.data
          .filter((p) => p.location && typeof p.location.lat === 'number' && typeof p.location.lng === 'number')
          .map((p) => ({
            id: p.id,
            title: p.title,
            category: p.category,
            subcategory: p.subcategory,
            wardId: p.ward_id,
            wardName: p.ward_id ? `Ward ${p.ward_id.replace(/\D/g, '') || p.ward_id}` : undefined,
            impactScore: p.impact_score || 0,
            severity: p.impact_level || 'LOW',
            signalCount: p.signal_count || 1,
            status: p.status,
            department: p.department_id,
            location: p.location,
            createdAt: p.created_at,
          }));

        setProblems(mapped);
        if (mapped.length > 0 && !selectedProblemId) {
          setSelectedProblemId(mapped[0]!.id);
        } else if (mapped.length === 0) {
          setSelectedProblemId(undefined);
        }
      } else {
        setProblems([]);
        setSelectedProblemId(undefined);
      }
    } catch (err: any) {
      console.warn('Failed to load operational map data:', err);
      setError(err.message || 'Failed to connect to operations telemetry service.');
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, [departmentFilter, severityFilter, statusFilter, selectedProblemId]);

  useEffect(() => {
    fetchMapProblems();
  }, [fetchMapProblems]);

  const selectedProblem = problems.find((p) => p.id === selectedProblemId) || problems[0] || null;

  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* MASTHEAD HEADER */}
        <PageHeader
          title="Geospatial Problem Workspace"
          description="Operational intelligence GIS layer visualizing active municipal problem clusters, geographic distribution, and ward infrastructure boundaries."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Geospatial Workspace' },
          ]}
          badge={
            <span className="px-2.5 py-0.5 rounded-xs text-[10px] font-mono uppercase bg-canvas-subtle border border-ink-border text-ink-primary">
              Live GIS Telemetry ({problems.length} Geolocated Incidents)
            </span>
          }
        />

        {/* 12-COLUMN EDITORIAL GEOSPATIAL LAYOUT (8 COLS MAP / 4 COLS RAIL) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* MAP WORKSPACE (~70% ON DESKTOP) */}
          <div className="lg:col-span-8 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  onClick={fetchMapProblems}
                  className="font-mono uppercase underline hover:text-rose-950 text-[11px]"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="bg-canvas-card border border-ink-border divide-y divide-ink-border shadow-xs">
              <div className="p-3 bg-canvas-subtle flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-ink-muted">
                  <span className="w-2 h-2 rounded-full bg-civic-emerald" />
                  <span className="uppercase text-[10px] tracking-widest font-bold text-ink-primary">
                    GIS WORKSPACE CANVAS
                  </span>
                  <span>{'//'}</span>
                  <span>OpenStreetMap HTTPS Raster Stream</span>
                </div>

                <button
                  type="button"
                  onClick={fetchMapProblems}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] uppercase border border-ink-border bg-canvas-card hover:bg-canvas-subtle text-ink-primary transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 text-ink-muted ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh Map</span>
                </button>
              </div>

              {/* REAL MAP COMPONENT */}
              <div className="p-2 sm:p-3">
                <MapContainer
                  problems={problems}
                  selectedProblemId={selectedProblemId}
                  onSelectProblem={(id) => setSelectedProblemId(id)}
                  height="h-[520px] sm:h-[620px]"
                  showDetailDrawer={false}
                />
              </div>
            </div>
          </div>

          {/* OPERATIONAL FILTER & DETAIL RAIL (~30% ON DESKTOP) */}
          <div className="lg:col-span-4 space-y-5">

            {/* REAL FILTER SUITE */}
            <div className="bg-canvas-card border border-ink-border divide-y divide-ink-border shadow-xs">
              <div className="p-3.5 bg-canvas-subtle flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-ink-primary">
                <Filter className="w-3.5 h-3.5 text-civic-terracotta" />
                <span>Geospatial Filters</span>
              </div>

              <div className="p-4 space-y-3 text-xs">
                {/* Department Filter */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-secondary">
                    Department Authority
                  </label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="w-full text-xs font-mono p-2 border border-ink-border bg-canvas-card text-ink-primary focus:outline-none focus:border-civic-terracotta"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Severity Filter */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-secondary">
                    Impact Severity Level
                  </label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full text-xs font-mono p-2 border border-ink-border bg-canvas-card text-ink-primary focus:outline-none focus:border-civic-terracotta"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-ink-secondary">
                    Operational Lifecycle Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full text-xs font-mono p-2 border border-ink-border bg-canvas-card text-ink-primary focus:outline-none focus:border-civic-terracotta"
                  >
                    {STATUSES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SELECTED INCIDENT DOSSIER RAIL PANEL */}
            <div className="bg-canvas-card border border-ink-border divide-y divide-ink-border shadow-xs">
              <div className="p-3.5 bg-canvas-subtle flex items-center justify-between text-xs font-mono">
                <span className="font-bold uppercase tracking-wider text-ink-primary">
                  Incident Intelligence
                </span>
                {selectedProblem && (
                  <span className="text-[10px] text-ink-muted">REF: {selectedProblem.id}</span>
                )}
              </div>

              {selectedProblem ? (
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta font-semibold">
                      {selectedProblem.category}
                    </span>
                    <StatusBadge status={selectedProblem.status as any} size="sm" />
                  </div>

                  <h3 className="text-base font-serif font-bold text-ink-primary leading-snug">
                    {selectedProblem.title}
                  </h3>

                  <div className="space-y-2 pt-2 border-t border-ink-border text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-secondary">Impact Score:</span>
                      <ImpactScore score={selectedProblem.impactScore} size="sm" showBar={false} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-secondary">Department:</span>
                      <span className="font-semibold text-ink-primary">{selectedProblem.department || 'Unassigned'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-secondary">Ward:</span>
                      <span className="font-semibold text-ink-primary">{selectedProblem.wardName || selectedProblem.wardId || 'BMC Area'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-ink-secondary">Correlated Signals:</span>
                      <span className="font-semibold text-ink-primary">{selectedProblem.signalCount} reports</span>
                    </div>

                    {selectedProblem.location && (
                      <div className="flex items-center justify-between">
                        <span className="text-ink-secondary">Coordinates:</span>
                        <span className="font-mono text-ink-primary">
                          {selectedProblem.location.lat.toFixed(4)}°, {selectedProblem.location.lng.toFixed(4)}°
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3">
                    <Link
                      href={`/dashboard/problems/${selectedProblem.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-mono uppercase bg-civic-terracotta hover:bg-civic-terracottaDark text-white transition-colors font-bold shadow-none"
                    >
                      <span>Open Problem Dossier</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center space-y-2 text-ink-secondary">
                  <p className="text-xs font-mono uppercase font-bold text-ink-primary">
                    {problems.length === 0
                      ? '0 operational problem locations matching active filters.'
                      : 'Select a marker on the map'}
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    {problems.length === 0
                      ? 'Empty operational state. Real database query returned zero records with geographic coordinates.'
                      : 'Click an incident pin on the map to inspect its municipal dossier, SLA trajectory, and correlated evidence.'}
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </GovernmentShell>
  );
}
