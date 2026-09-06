import React, { ReactNode } from 'react';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  badge,
  actions,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-ink-border/70 gap-3 ${className}`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink-primary">
            {title}
          </h2>
          {badge}
        </div>
        {description && <p className="text-xs text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
