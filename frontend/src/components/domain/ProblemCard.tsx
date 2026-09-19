import React from 'react';
import Link from 'next/link';
import { MapPin, Users, ArrowUpRight, Clock } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { ImpactScore } from './ImpactScore';

export interface ProblemCardProps {
  problem: any;
  rank?: number;
  compact?: boolean;
}

export function ProblemCard({ problem, rank, compact = false }: ProblemCardProps) {
  const wardDisplay =
    problem.wardName ||
    (problem.ward_id ? `Ward ${problem.ward_id.replace(/\D/g, '') || problem.ward_id}` : 'Bhubaneswar');
  const deptDisplay = problem.department || problem.department_id || 'Unassigned';
  const signalCount = problem.signalCount ?? problem.signal_count ?? 1;
  const impactScore = problem.impactScore ?? problem.impact_score ?? 50;
  const summary = problem.aiSummary || problem.impact_explanation || problem.description || '';
  const isDemo = problem.isDemo || problem.is_demo;
  const sla = problem.sla_state;

  return (
    <div className="p-5 rounded-sm border border-ink-border bg-canvas-card shadow-none hover:border-ink-secondary transition-colors space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {rank !== undefined && (
              <span className="text-[11px] font-mono font-bold text-ink-tertiary">
                #{String(rank).padStart(2, '0')}
              </span>
            )}
            <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-civic-terracotta">
              {(problem.category || 'CIVIC').replace(/_/g, ' ')}
            </span>
            <span className="text-ink-border">•</span>
            <span className="text-[11px] font-mono text-ink-tertiary">{problem.id}</span>
            {isDemo && (
              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
                SYNTHETIC DEMO
              </span>
            )}
            {sla && (
              <span
                className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold flex items-center gap-1 ${
                  sla.status === 'BREACHED'
                    ? 'bg-rose-100 text-rose-800'
                    : sla.status === 'AT_RISK'
                    ? 'bg-amber-100 text-amber-900'
                    : sla.status === 'MET'
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>
                  SLA {sla.status}
                  {sla.status !== 'MET' ? ` (${sla.hours_remaining}h)` : sla.was_breached ? ' (Post-breach)' : ''}
                </span>
              </span>
            )}
          </div>

          <Link
            href={`/dashboard/problems/${problem.id}`}
            className="group inline-flex items-center gap-1.5 text-base font-bold text-ink-primary hover:text-civic-terracotta transition-colors"
          >
            <span>{problem.title}</span>
            <ArrowUpRight className="w-4 h-4 text-ink-tertiary group-hover:text-civic-terracotta transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        <StatusBadge status={problem.status} size="sm" />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-ink-tertiary" />
          <span className="font-medium">{wardDisplay}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <Users className="w-3.5 h-3.5 text-ink-tertiary" />
          <span className="font-bold text-ink-primary">{signalCount}</span>
          <span className="text-ink-secondary">reports</span>
          {isDemo && (
            <span className="text-[10px] text-amber-700 italic">(synthetic aggregate)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-ink-tertiary text-[11px] font-mono uppercase tracking-wider">Dept:</span>
          <span className="font-semibold text-ink-primary text-xs">{deptDisplay}</span>
        </div>
      </div>

      {!compact && summary && (
        <p className="text-xs text-ink-secondary leading-relaxed bg-canvas-subtle/50 p-3 rounded-sm border border-ink-border">
          {summary}
        </p>
      )}

      <div className="pt-2 border-t border-ink-border flex items-center justify-between">
        <div className="w-40">
          <ImpactScore score={impactScore} size="sm" showBar={true} />
        </div>
        <Link
          href={`/dashboard/problems/${problem.id}`}
          className="text-xs font-mono font-semibold text-civic-terracotta hover:text-civic-terracottaDark transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}
