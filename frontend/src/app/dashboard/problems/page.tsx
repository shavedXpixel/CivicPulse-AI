'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ProblemList } from '../../../components/domain/ProblemList';
import { DEMO_PROBLEMS } from '../../../lib/mockData';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../context/AuthContext';
import { ProblemCluster } from '@civicpulse/shared';
import { RefreshCw, ShieldAlert } from 'lucide-react';

function ProblemsContent() {
  const { isDemoMode } = useAuth();
  const searchParams = useSearchParams();
  const initialDepartment = searchParams.get('department') || 'ALL';
  const initialStatus = searchParams.get('status') || 'ALL';

  const [problems, setProblems] = useState<any[]>(isDemoMode ? DEMO_PROBLEMS : []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadProblems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: ProblemCluster[] }>('/api/v1/problems');
      if (res?.data) {
        if (res.data.length > 0) {
          const mapped = res.data.map((p) => ({
            id: p.id,
            title: p.title,
            category: (p.category || 'WATER_SUPPLY').toUpperCase(),
            subcategory: p.subcategory || 'Incident Cluster',
            wardId: p.ward_id || 'WARD-018',
            wardName: p.ward_id ? `Ward ${p.ward_id.replace(/\D/g, '') || '18'} (Nayapalli, Bhubaneswar)` : 'Ward 18 (Nayapalli)',
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
              ? { lat: p.location.lat, lng: p.location.lng, address: 'Nayapalli, Bhubaneswar' }
              : { lat: 20.2961, lng: 85.8245, address: 'Nayapalli, Bhubaneswar' },
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
            is_demo: Boolean(p.is_demo),
            supporting_media_count: p.supporting_media_count
          }));
          setProblems(mapped);
        } else {
          // Empty data from API
          if (!isDemoMode) {
            setProblems([]);
          } else {
            setProblems(DEMO_PROBLEMS);
          }
        }
      }
    } catch (err: any) {
      console.warn('Could not fetch live problems:', err);
      if (!isDemoMode) {
        setError(err.message || 'Failed to load problems from municipal database.');
        setProblems([]);
      } else {
        setProblems(DEMO_PROBLEMS);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Problem Directory"
        description="Consolidated public incident clusters dynamically ranked by calculated public impact and deterministic SLA urgency."
        badge={
          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-canvas-subtle border border-ink-border text-ink-secondary">
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-ink-border bg-white hover:bg-canvas-subtle text-ink-primary transition-colors disabled:opacity-50 shadow-subtle"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadProblems()}
            className="px-3 py-1 rounded bg-rose-600 text-white font-semibold hover:bg-rose-700 transition-colors"
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
  );
}

export default function ProblemsPage() {
  return (
    <GovernmentShell>
      <Suspense fallback={<div className="p-12 text-center text-xs text-ink-tertiary">Loading Directory...</div>}>
        <ProblemsContent />
      </Suspense>
    </GovernmentShell>
  );
}
