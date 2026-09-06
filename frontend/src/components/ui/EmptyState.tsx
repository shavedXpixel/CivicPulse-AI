import React, { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({
  icon = <Inbox className="w-8 h-8 text-ink-tertiary" />,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-ink-border bg-canvas/50 space-y-3">
      <div className="p-3 rounded-full bg-canvas-subtle border border-ink-border">{icon}</div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-semibold text-ink-primary">{title}</h4>
        <p className="text-xs text-ink-secondary leading-relaxed">{description}</p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
