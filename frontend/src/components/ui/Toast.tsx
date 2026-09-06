import React, { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  type?: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  onDismiss?: () => void;
  action?: ReactNode;
}

export function Toast({
  type = 'info',
  title,
  message,
  onDismiss,
  action,
}: ToastProps) {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-civic-emerald shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-civic-amber shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-civic-rose shrink-0" />,
    info: <Info className="w-4 h-4 text-civic-blue shrink-0" />,
  }[type];

  const borderTints = {
    success: 'border-civic-emerald/20',
    warning: 'border-civic-amber/20',
    error: 'border-civic-rose/20',
    info: 'border-civic-blue/20',
  }[type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl bg-white border ${borderTints} shadow-elevated text-xs max-w-sm w-full`}
    >
      <div className="pt-0.5">{icons}</div>
      <div className="flex-1 space-y-1">
        <div className="font-semibold text-ink-primary">{title}</div>
        {message && <p className="text-ink-secondary leading-relaxed">{message}</p>}
        {action && <div className="pt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-ink-tertiary hover:text-ink-primary p-0.5 rounded transition-colors"
          aria-label="Dismiss toast"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
