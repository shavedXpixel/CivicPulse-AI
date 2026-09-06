'use client';

import React from 'react';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DEMO_DEPARTMENTS } from '../../../lib/mockData';
import { Building2 } from 'lucide-react';

export default function DepartmentsPage() {
  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Department Operations & SLA"
          description="Cross-departmental workload distribution, active critical incidents, and resolution time performance."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Departments' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO_DEPARTMENTS.map((dept) => (
            <div
              key={dept.name}
              className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4"
            >
              <div className="flex items-start justify-between border-b border-ink-border/60 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-civic-blue" />
                    <h3 className="text-sm font-bold text-ink-primary">{dept.name}</h3>
                  </div>
                  <span className="text-[11px] font-mono text-ink-tertiary">BBMP Municipal Tier 1</span>
                </div>
                {dept.slaRisk > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-civic-amberLight text-amber-900">
                    {dept.slaRisk} SLA At Risk
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                  <div className="text-[10px] font-mono text-ink-tertiary">ACTIVE PROBLEMS</div>
                  <div className="text-lg font-bold font-mono text-ink-primary">{dept.active}</div>
                </div>

                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                  <div className="text-[10px] font-mono text-ink-tertiary">HIGH IMPACT</div>
                  <div className="text-lg font-bold font-mono text-civic-rose">{dept.highImpact}</div>
                </div>

                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                  <div className="text-[10px] font-mono text-ink-tertiary">MEDIAN TIME</div>
                  <div className="text-lg font-bold font-mono text-ink-primary">{dept.medianResolution}</div>
                </div>

                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-0.5">
                  <div className="text-[10px] font-mono text-ink-tertiary">ON-TIME RATE</div>
                  <div className="text-lg font-bold font-mono text-civic-emerald">91.4%</div>
                </div>
              </div>

              <div className="pt-2 border-t border-ink-border/60 flex items-center justify-between text-xs font-semibold text-civic-blue">
                <span>View Department Queue</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GovernmentShell>
  );
}
