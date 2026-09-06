import React from 'react';
import Link from 'next/link';
import { MapPin, Users, ArrowUpRight } from 'lucide-react';
import { MockProblem } from '../../lib/mockData';
import { StatusBadge } from './StatusBadge';
import { ImpactScore } from './ImpactScore';

export interface ProblemCardProps {
  problem: MockProblem;
  rank?: number;
  compact?: boolean;
}

export function ProblemCard({ problem, rank, compact = false }: ProblemCardProps) {
  return (
    <div className="p-5 rounded-xl border border-ink-border bg-white shadow-card hover:border-ink-secondary/40 transition-all space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {rank !== undefined && (
              <span className="text-xs font-mono font-bold text-ink-tertiary">
                #{String(rank).padStart(2, '0')}
              </span>
            )}
            <span className="text-xs font-mono text-ink-secondary uppercase tracking-wider">
              {problem.category.replace(/_/g, ' ')}
            </span>
            <span className="text-ink-tertiary">•</span>
            <span className="text-xs font-mono text-ink-tertiary">{problem.id}</span>
          </div>

          <Link
            href={`/dashboard/problems/${problem.id}`}
            className="group inline-flex items-center gap-1.5 text-base font-bold text-ink-primary hover:text-civic-blue transition-colors"
          >
            <span>{problem.title}</span>
            <ArrowUpRight className="w-4 h-4 text-ink-tertiary group-hover:text-civic-blue transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        <StatusBadge status={problem.status} size="sm" />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-ink-tertiary" />
          <span>{problem.wardName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-ink-tertiary" />
          <span className="font-mono font-medium text-ink-primary">{problem.signalCount}</span>
          <span>reports</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-ink-tertiary font-mono">Dept:</span>
          <span>{problem.department}</span>
        </div>
      </div>

      {!compact && (
        <p className="text-xs text-ink-secondary leading-relaxed bg-canvas-subtle/50 p-3 rounded-lg border border-ink-border/50">
          {problem.aiSummary}
        </p>
      )}

      <div className="pt-2 border-t border-ink-border/60 flex items-center justify-between">
        <div className="w-40">
          <ImpactScore score={problem.impactScore} size="sm" showBar={true} />
        </div>
        <Link
          href={`/dashboard/problems/${problem.id}`}
          className="text-xs font-semibold text-civic-blue hover:text-civic-blueDark transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}
