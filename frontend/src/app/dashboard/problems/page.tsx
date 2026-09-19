'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ProblemList } from '../../../components/domain/ProblemList';
import { apiClient } from '../../../lib/api-client';
import { ProblemCluster } from '@civicpulse/shared';
import { RefreshCw, ShieldAlert } from 'lucide-react';

function ProblemsContent() {
  const searchParams = useSearchParams();
  const initialDepartment = searchParams.get('department') || 'ALL';
  const initialStatus = searchParams.get('status') || 'ALL';

  const [problems, setProblems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProblems = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await apiClient.get<{ data: ProblemCluster[] }>('/api/v1/problems');
      if (res?.data && res.data.length > 0) {
        const WARD_LABELS: Record<string, string> = {
          'WARD-018': 'Ward 18 (Nayapalli, Bhubaneswar)',
          'WARD-004': 'Ward 04 (Saheed Nagar, Bhubaneswar)',
          'WARD-022': 'Ward 22 (Patia, Bhubaneswar)',
          'WARD-012': 'Ward 12 (Old Town, Bhubaneswar)',
          'WARD-009': 'Ward 09 (Khandagiri, Bhubaneswar)',
          'WARD-031': 'Ward 31 (Chandrasekharpur, Bhubaneswar)',
        };

        const mapped = res.data.map((p) => {
          const wardName = p.ward_id
            ? (WARD_LABELS[p.ward_id] || `Ward ${p.ward_id.replace(/\D/g, '') || p.ward_id}`)
            : 'Bhubaneswar Municipal Area';

          const locationAddress = p.ward_id && WARD_LABELS[p.ward_id] ? WARD_LABELS[p.ward_id] : 'Bhubaneswar';

          return {
            id: p.id,
            title: p.title,
            category: (p.category || 'WATER_SUPPLY').toUpperCase(),
            subcategory: p.subcategory || 'Incident Cluster',
            wardId: p.ward_id || 'WARD-GEN',
            wardName,
            impactScore: p.impact_score,
            impact_score: p.impact_score,
            severity: p.impact_level || 'HIGH',
            impact_level: p.impact_level || 'HIGH',
            signalCount: p.signal_count,
            signal_count: p.signal_count,
            status: p.status,
            department: p.department_id || 'Municipal Operations',
            department_id: p.department_id,
            createdAt: p.created_at,
            created_at: p.created_at,
            updatedAt: p.updated_at,
            updated_at: p.updated_at,
            sla_state: p.sla_state,
            location: p.location
              ? { lat: p.location.lat, lng: p.location.lng, address: locationAddress }
              : { lat: 20.2961, lng: 85.8245, address: locationAddress },
            impactBreakdown: {
              severity: p.severity_score ?? 24,
              population: p.population_score ?? 18,
              duration: p.duration_score ?? 14,
              concentration: p.concentration_score ?? 14,
              facilities: p.critical_exposure_score ?? 9,
              recurrence: p.recurrence_score ?? 8,
              evidence: p.evidence_score ?? 5,
              total: p.impact_score
            },
            aiSummary: p.impact_explanation || p.description || 'Public service incident prioritized by CivicPulse intelligence engine.',
            isDemo: Boolean(p.is_demo),
            supporting_media_count: p.supporting_media_count,
          };
        });
        setProblems(mapped);
      } else {
        setProblems([]);
      }
    } catch (err: any) {
      console.warn('Could not fetch live problems:', err);
      setError(err.message || 'Failed to load problems from municipal database.');
      setProblems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  const authoritativeProblemCount = problems.length;

  return (
    <GovernmentShell problemCount={authoritativeProblemCount}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Problem Directory"
          description="Consolidated public incident clusters dynamically ranked by calculated public impact and deterministic SLA urgency."
          badge={
            <span className="px-2.5 py-0.5 rounded-xs text-[10px] font-mono uppercase bg-canvas-subtle border border-ink-border text-ink-secondary">
              {problems.length} Incidents Available
            </span>
          }
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Problems' },
          ]}
          actions={
            <button
              onClick={() => loadProblems()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase border border-ink-border bg-canvas-card hover:bg-canvas-subtle text-ink-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          }
        />

        {error && (
          <div className="p-4 border border-rose-300 bg-rose-50 text-rose-900 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadProblems()}
              className="px-3 py-1 bg-rose-700 text-white uppercase text-[10px] hover:bg-rose-800 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <ProblemList
          problems={problems}
          isLoading={isLoading}
          initialDepartment={initialDepartment}
          initialStatus={initialStatus}
        />
      </div>
    </GovernmentShell>
  );
}

export default function ProblemsPage() {
  return (
    <Suspense fallback={
      <GovernmentShell>
        <div className="p-12 text-center text-xs text-ink-tertiary">Loading Directory...</div>
      </GovernmentShell>
    }>
      <ProblemsContent />
    </Suspense>
  );
}
