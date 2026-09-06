import React from 'react';
import {
  AlertCircle,
  Clock,
  UserCheck,
  Wrench,
  FileCheck,
  CheckCircle2,
  Archive,
} from 'lucide-react';

export type ProblemStatusType =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLUTION_SUBMITTED'
  | 'VERIFIED_RESOLVED'
  | 'CLOSED';

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
          color: 'text-rose-800 bg-civic-roseLight border-civic-rose/20',
        };
      case 'TRIAGED':
        return {
          label: 'Triaged',
          icon: Clock,
          color: 'text-amber-900 bg-civic-amberLight border-civic-amber/20',
        };
      case 'ASSIGNED':
        return {
          label: 'Assigned',
          icon: UserCheck,
          color: 'text-blue-900 bg-civic-blueLight border-civic-blue/20',
        };
      case 'IN_PROGRESS':
        return {
          label: 'In Progress',
          icon: Wrench,
          color: 'text-blue-900 bg-blue-100 border-blue-200',
        };
      case 'RESOLUTION_SUBMITTED':
        return {
          label: 'Verification Pending',
          icon: FileCheck,
          color: 'text-purple-900 bg-purple-100 border-purple-200',
        };
      case 'VERIFIED_RESOLVED':
        return {
          label: 'Verified Resolved',
          icon: CheckCircle2,
          color: 'text-emerald-900 bg-civic-emeraldLight border-civic-emerald/20',
        };
      case 'CLOSED':
        return {
          label: 'Closed',
          icon: Archive,
          color: 'text-ink-secondary bg-canvas-subtle border-ink-border',
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
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-medium border ${sizeClasses} ${config.color}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}
