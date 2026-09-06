'use client';

import React from 'react';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { ProblemList } from '../../../components/domain/ProblemList';
import { DEMO_PROBLEMS } from '../../../lib/mockData';

export default function ProblemsPage() {
  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Problem Directory"
          description="Consolidated public incident clusters dynamically ranked by calculated public impact."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-canvas-subtle border border-ink-border text-ink-secondary">
              {DEMO_PROBLEMS.length} Active Incidents
            </span>
          }
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Problems' },
          ]}
        />

        <ProblemList problems={DEMO_PROBLEMS} />
      </div>
    </GovernmentShell>
  );
}
