'use client';

import React, { useEffect, useState } from 'react';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ProblemList } from '../../../components/domain/ProblemList';
import { DEMO_PROBLEMS, MockProblem } from '../../../lib/mockData';
import { apiClient } from '../../../lib/api-client';
import { ProblemCluster } from '@civicpulse/shared';

export default function ProblemsPage() {
  const [problems, setProblems] = useState<MockProblem[]>(DEMO_PROBLEMS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function loadProblems() {
      try {
        const res = await apiClient.get<{ data: ProblemCluster[] }>('/api/v1/problems');
        if (mounted && res && res.data && res.data.length > 0) {
          const mapped: MockProblem[] = res.data.map((p) => ({
            id: p.id,
            title: p.title,
            category: (p.category || 'WATER_SUPPLY').toUpperCase(),
            subcategory: p.subcategory || 'Incident Cluster',
            wardId: p.ward_id || 'WARD-018',
            wardName: p.ward_id ? `Ward ${p.ward_id.replace(/\D/g, '') || '18'} (Nayapalli, Bhubaneswar)` : 'Ward 18 (Nayapalli)',
            impactScore: p.impact_score,
            severity: (p.impact_level || 'HIGH') as any,
            signalCount: p.signal_count,
            status: p.status as any,
            department: p.department_id || 'Municipal Operations',
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            location: p.location
              ? { lat: p.location.lat, lng: p.location.lng, address: 'VIP Road, Jayadev Vihar Crossing, Nayapalli, Bhubaneswar' }
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
            whyThisMatters: [
              'Systemic infrastructure disruption impacting local residents and institutions.',
              'Prioritized deterministically using the canonical 7-factor civic impact formula.'
            ],
            isDemo: Boolean(p.is_demo),
            is_demo: Boolean(p.is_demo),
            supporting_media_count: p.supporting_media_count
          }));
          setProblems(mapped);
        }
      } catch (err) {
        console.warn('Could not fetch live problems, using fallback demo data:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadProblems();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Problem Directory"
          description="Consolidated public incident clusters dynamically ranked by calculated public impact."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-canvas-subtle border border-ink-border text-ink-secondary">
              {problems.length} Active Incidents
            </span>
          }
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Problems' },
          ]}
        />

        <ProblemList problems={problems} isLoading={isLoading} />
      </div>
    </GovernmentShell>
  );
}
