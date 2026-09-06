'use client';

import React from 'react';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function TrendsPage() {
  const trends = [
    {
      category: 'Water Supply Disruption',
      delta: '+31%',
      direction: 'up',
      worsening: true,
      description: 'Spike driven by Ward 18 transmission fracture and Ward 22 low-pressure complaints.',
      activeProblems: 82,
      signalVelocity: '42 signals/hr',
    },
    {
      category: 'Road Cavities & Sinkholes',
      delta: '+14%',
      direction: 'up',
      worsening: true,
      description: 'Heavy weekend rain revealed 3 severe underground storm sewer cavities.',
      activeProblems: 114,
      signalVelocity: '18 signals/hr',
    },
    {
      category: 'Streetlight Outages',
      delta: '-18%',
      direction: 'down',
      worsening: false,
      description: 'Rapid feeder line repairs in Ward 04 and Ward 12 reduced active outages.',
      activeProblems: 48,
      signalVelocity: '4 signals/hr',
    },
    {
      category: 'Solid Waste Accumulation',
      delta: '-9%',
      direction: 'down',
      worsening: false,
      description: 'Special morning clearance drives in commercial corridors cleared 12 backlogs.',
      activeProblems: 52,
      signalVelocity: '8 signals/hr',
    },
  ];

  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Problem Trends & Velocity"
          description="Track weekly signal volume shifts, escalating problem categories, and ward-level velocity patterns."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Trends' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {trends.map((t) => (
            <div
              key={t.category}
              className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4"
            >
              <div className="flex items-start justify-between border-b border-ink-border/60 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">{t.category}</h3>
                  <span className="text-[11px] font-mono text-ink-tertiary">7-Day Moving Window</span>
                </div>
                <div
                  className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    t.worsening
                      ? 'bg-civic-roseLight text-civic-rose'
                      : 'bg-civic-emeraldLight text-emerald-800'
                  }`}
                >
                  {t.direction === 'up' ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  <span>{t.delta}</span>
                </div>
              </div>

              <p className="text-xs text-ink-secondary leading-relaxed">
                {t.description}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-canvas-subtle border border-ink-border">
                  <div className="text-[10px] text-ink-tertiary">ACTIVE CLUSTERS</div>
                  <div className="font-bold text-ink-primary">{t.activeProblems}</div>
                </div>
                <div className="p-2.5 rounded bg-canvas-subtle border border-ink-border">
                  <div className="text-[10px] text-ink-tertiary">SIGNAL VELOCITY</div>
                  <div className="font-bold text-ink-primary">{t.signalVelocity}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GovernmentShell>
  );
}
