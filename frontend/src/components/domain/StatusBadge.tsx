import React from 'react';
import {
  AlertCircle,
  Clock,
  UserCheck,
  Wrench,
  FileCheck2,
  CheckCircle2,
  Archive,
  RotateCcw,
} from 'lucide-react';

export type ProblemStatusType =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'AWAITING_VERIFICATION'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export interface StatusBadgeProps {
  status: ProblemStatusType | string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = (() => {
    switch (status) {
      case 'NEW':
        return {
          label: 'New Signal',
          icon: AlertCircle,
          color: 'text-rose-900 bg-civic-roseLight border-civic-rose/30',
        };
      case 'TRIAGED':
        return {
          label: 'Triaged',
          icon: Clock,
          color: 'text-amber-950 bg-civic-amberLight border-civic-amber/30',
        };
      case 'ASSIGNED':
        return {
          label: 'Assigned',
          icon: UserCheck,
          color: 'text-ink-primary bg-civic-blueLight border-civic-blue/30',
        };
      case 'IN_PROGRESS':
        return {
          label: 'In Progress',
          icon: Wrench,
          color: 'text-ink-primary bg-canvas-subtle border-ink-border',
        };
      case 'AWAITING_VERIFICATION':
        return {
          label: 'Awaiting Verification',
          icon: FileCheck2,
          color: 'text-amber-950 bg-amber-50 border-amber-300',
        };
      case 'RESOLVED':
        return {
          label: 'Resolved',
          icon: CheckCircle2,
          color: 'text-emerald-950 bg-civic-emeraldLight border-civic-emerald/30',
        };
      case 'CLOSED':
        return {
          label: 'Closed',
          icon: Archive,
          color: 'text-ink-secondary bg-canvas-subtle border-ink-border',
        };
      case 'REOPENED':
        return {
          label: 'Reopened',
          icon: RotateCcw,
          color: 'text-rose-950 bg-rose-50 border-rose-300',
        };
      default:
        return {
          label: status,
          icon: AlertCircle,
          color: 'text-ink-secondary bg-canvas-subtle border-ink-border',
        };
    }
  })();

  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1 font-mono' : 'text-[11px] px-2 py-0.5 gap-1.5 font-mono';

  return (
    <span
      className={`inline-flex items-center rounded-sm font-medium border ${sizeClasses} ${config.color}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}
