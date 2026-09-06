import React from 'react';
import { Check, Loader2 } from 'lucide-react';

export interface LoadingStep {
  id: string;
  label: string;
  status: 'complete' | 'current' | 'pending';
}

export interface LoadingStateProps {
  title?: string;
  steps?: LoadingStep[];
}

export function LoadingState({
  title = 'Processing civic intelligence…',
  steps = [
    { id: '1', label: 'Understanding issue & intent', status: 'complete' },
    { id: '2', label: 'Scanning related reports in ward', status: 'current' },
    { id: '3', label: 'Calculating public impact weight', status: 'pending' },
  ],
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-ink-border bg-white shadow-card max-w-md mx-auto space-y-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
        <Loader2 className="w-4 h-4 animate-spin text-civic-blue" />
        <span>{title}</span>
      </div>

      <div className="w-full space-y-3 pt-2 text-xs">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between">
            <span
              className={
                step.status === 'complete'
                  ? 'text-ink-primary font-medium'
                  : step.status === 'current'
                  ? 'text-civic-blue font-medium'
                  : 'text-ink-tertiary'
              }
            >
              {step.label}
            </span>
            {step.status === 'complete' && (
              <span className="w-5 h-5 rounded-full bg-civic-emeraldLight text-civic-emerald flex items-center justify-center">
                <Check className="w-3 h-3" />
              </span>
            )}
            {step.status === 'current' && (
              <Loader2 className="w-4 h-4 animate-spin text-civic-blue" />
            )}
            {step.status === 'pending' && (
              <span className="w-2 h-2 rounded-full bg-canvas-muted" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
