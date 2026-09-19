import React from 'react';
import {
  AlertTriangle,
  Users,
  Clock,
  MapPin,
  Building2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

export interface ImpactBreakdownProps {
  severity: number;      // Max 25 (25%)
  population: number;    // Max 20 (20%)
  duration: number;      // Max 15 (15%)
  concentration: number; // Max 15 (15%)
  facilities: number;    // Max 10 (10%)
  recurrence: number;    // Max 10 (10%)
  evidence: number;      // Max 5  (5%)
}

export function ImpactBreakdown({
  severity,
  population,
  duration,
  concentration,
  facilities,
  recurrence,
  evidence,
}: ImpactBreakdownProps) {
  const factors = [
    {
      label: 'Severity & Urgency',
      weight: '25%',
      value: severity,
      max: 25,
      icon: AlertTriangle,
    },
    {
      label: 'Population Affected',
      weight: '20%',
      value: population,
      max: 20,
      icon: Users,
    },
    {
      label: 'Duration',
      weight: '15%',
      value: duration,
      max: 15,
      icon: Clock,
    },
    {
      label: 'Complaint Concentration',
      weight: '15%',
      value: concentration,
      max: 15,
      icon: MapPin,
    },
    {
      label: 'Critical Facility Exposure',
      weight: '10%',
      value: facilities,
      max: 10,
      icon: Building2,
    },
    {
      label: 'Recurrence',
      weight: '10%',
      value: recurrence,
      max: 10,
      icon: RotateCcw,
    },
    {
      label: 'Evidence Confidence',
      weight: '5%',
      value: evidence,
      max: 5,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider font-semibold text-ink-secondary">
        Authoritative 7-Factor Impact Model (Total 100%)
      </div>
      <div className="space-y-2">
        {factors.map((factor) => {
          const Icon = factor.icon;
          const pct = Math.round((factor.value / factor.max) * 100);

          return (
            <div
              key={factor.label}
              className="p-2.5 rounded-sm bg-canvas-subtle/50 border border-ink-border text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium text-ink-primary">
                  <Icon className="w-3.5 h-3.5 text-ink-tertiary" />
                  <span>{factor.label}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-ink-tertiary">Weight {factor.weight}</span>
                  <span className="font-bold text-ink-primary">
                    {factor.value}/{factor.max}
                  </span>
                </div>
              </div>
              <div className="w-full bg-ink-border/50 h-1 overflow-hidden">
                <div
                  className="bg-civic-terracotta h-full transition-all"
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
