import React from 'react';
import { Users, AlertTriangle, MapPin, Clock, Building2 } from 'lucide-react';

export interface ImpactBreakdownProps {
  population: number; // 0-30
  severity: number;   // 0-25
  spread: number;     // 0-20
  duration: number;   // 0-15
  facilities: number; // 0-10
}

export function ImpactBreakdown({
  population,
  severity,
  spread,
  duration,
  facilities,
}: ImpactBreakdownProps) {
  const factors = [
    {
      label: 'Population Affected',
      weight: '30%',
      value: population,
      max: 30,
      icon: Users,
    },
    {
      label: 'Severity & Urgency',
      weight: '25%',
      value: severity,
      max: 25,
      icon: AlertTriangle,
    },
    {
      label: 'Spatial Spread',
      weight: '20%',
      value: spread,
      max: 20,
      icon: MapPin,
    },
    {
      label: 'Duration & Recurrence',
      weight: '15%',
      value: duration,
      max: 15,
      icon: Clock,
    },
    {
      label: 'Critical Facilities',
      weight: '10%',
      value: facilities,
      max: 10,
      icon: Building2,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs font-mono uppercase tracking-wider text-ink-secondary">
        Impact Factor Breakdown (Section 6.2)
      </div>
      <div className="space-y-2">
        {factors.map((factor) => {
          const Icon = factor.icon;
          const pct = Math.round((factor.value / factor.max) * 100);

          return (
            <div
              key={factor.label}
              className="p-2.5 rounded-lg bg-canvas-subtle/50 border border-ink-border text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-ink-primary">
                  <Icon className="w-3.5 h-3.5 text-ink-tertiary" />
                  <span>{factor.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-ink-tertiary">Max {factor.weight}</span>
                  <span className="font-bold text-ink-primary">
                    {factor.value}/{factor.max}
                  </span>
                </div>
              </div>
              <div className="w-full bg-canvas-muted rounded-full h-1 overflow-hidden">
                <div
                  className="bg-civic-blue h-full rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
