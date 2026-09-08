import React, { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'neutral' | 'purple';
  size?: 'sm' | 'md';
  hasDot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  hasDot = false,
  className = '',
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  }[size];

  const variantStyles = {
    blue: 'bg-civic-blueLight text-civic-blueDark border-civic-blue/20',
    emerald: 'bg-civic-emeraldLight text-emerald-800 border-civic-emerald/20',
    amber: 'bg-civic-amberLight text-amber-900 border-civic-amber/20',
    rose: 'bg-civic-roseLight text-rose-800 border-civic-rose/20',
    neutral: 'bg-canvas-subtle text-ink-secondary border-ink-border',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
  }[variant];

  const dotColors = {
    blue: 'bg-civic-blue',
    emerald: 'bg-civic-emerald',
    amber: 'bg-civic-amber',
    rose: 'bg-civic-rose',
    neutral: 'bg-ink-tertiary',
    purple: 'bg-purple-600',
  }[variant];

  return (
    <span
      className={`inline-flex items-center rounded-md border ${sizeStyles} ${variantStyles} ${className}`}
    >
      {hasDot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors}`} />}
      {children}
    </span>
  );
}
