import React, { ReactNode } from 'react';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  description?: string;
  badge?: ReactNode;
  isCompleted?: boolean;
  isCurrent?: boolean;
}

export interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="p-4 rounded-sm border border-ink-border bg-canvas-subtle/50 text-center text-xs text-ink-secondary font-mono">
        No operational actions or audit trail recorded yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-ink-border">
      {events.map((event) => (
        <div key={event.id} className="relative group">
          {/* Node dot */}
          <div
            className={`absolute -left-6 top-1 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${
              event.isCurrent
                ? 'border-civic-terracotta bg-canvas-card'
                : event.isCompleted
                ? 'border-civic-emerald bg-civic-emerald text-white'
                : 'border-ink-border bg-canvas-subtle'
            }`}
          >
            {event.isCurrent && (
              <span className="w-1.5 h-1.5 rounded-sm bg-civic-terracotta" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-primary">
                  {event.action}
                </span>
                {event.badge}
              </div>
              <span className="text-[11px] font-mono text-ink-tertiary">
                {event.timestamp}
              </span>
            </div>

            <div className="text-xs text-ink-secondary flex items-center gap-1.5">
              <span className="font-mono text-ink-tertiary">Actor:</span>
              <span className="font-medium text-ink-primary">{event.actor}</span>
            </div>

            {event.description && (
              <p className="text-xs text-ink-secondary leading-relaxed pt-0.5">
                {event.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
