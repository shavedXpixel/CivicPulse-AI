import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  errorCode?: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({
  title = "We couldn't load this information.",
  message = "The service encountered a temporary problem. Please check your connection and try again.",
  errorCode,
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-civic-rose/20 bg-civic-roseLight/20 space-y-3">
      <div className="p-3 rounded-full bg-white border border-civic-rose/30 text-civic-rose">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="space-y-1 max-w-sm">
        <h4 className="text-sm font-semibold text-ink-primary">{title}</h4>
        <p className="text-xs text-ink-secondary leading-relaxed">{message}</p>
        {errorCode && (
          <p className="text-[11px] font-mono text-ink-tertiary pt-1">
            Reference code: {errorCode}
          </p>
        )}
      </div>
      <div className="pt-2 flex items-center gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Try Again</span>
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
