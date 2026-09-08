'use client';

import React, { useEffect, useState } from 'react';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { MapContainer } from '../../../components/domain/MapContainer';
import { DEMO_PROBLEMS, MockProblem } from '../../../lib/mockData';
import { apiClient } from '../../../lib/api-client';
import { ProblemCluster } from '@civicpulse/shared';

export default function MapWorkspacePage() {
  const [problems, setProblems] = useState<MockProblem[]>(DEMO_PROBLEMS);

  useEffect(() => {
    let mounted = true;
    async function loadProblems() {
      try {
        const res = await apiClient.get<{ data: ProblemCluster[] }>('/api/v1/problems');
        if (mounted && res?.data && res.data.length > 0) {
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
              ? { lat: p.location.lat, lng: p.location.lng, address: 'VIP Road, Nayapalli, Bhubaneswar' }
              : { lat: 20.2961, lng: 85.8245, address: 'Nayapalli, Bhubaneswar' },
            impactBreakdown: {
              severity: p.severity_score ?? 24,
              population: p.population_score ?? 18,
              duration: p.duration_score ?? 14,
              concentration: p.concentration_score ?? 14,
              facilities: p.critical_exposure_score ?? 9,
              recurrence: p.recurrence_score ?? 8,
              evidence: p.evidence_score ?? 5,
              total: p.impact_score,
            },
            aiSummary: p.impact_explanation || p.description || 'Public service incident prioritized by CivicPulse intelligence engine.',
            whyThisMatters: [
              'Systemic infrastructure disruption impacting local residents and institutions.',
              'Prioritized deterministically using the canonical 7-factor civic impact formula.',
            ],
            isDemo: Boolean(p.is_demo),
            is_demo: Boolean(p.is_demo),
            supporting_media_count: p.supporting_media_count,
          }));
          setProblems(mapped);
        }
      } catch (err) {
        console.warn('Could not fetch map problems from API, rendering demo fixtures:', err);
      }
    }

    loadProblems();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Geospatial Problem Workspace"
          description="Interactive map workspace visualizing active public problem clusters, ward boundaries, and critical infrastructure proximity."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Map Workspace' },
          ]}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-civic-blueLight text-civic-blueDark">
              GIS Telemetry Synced ({problems.length} Clusters)
            </span>
          }
        />

        <div className="space-y-4">
          <MapContainer problems={problems} height="h-[640px]" />
        </div>
      </div>
    </GovernmentShell>
  );
}
