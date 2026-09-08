import React, { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KPIStatProps {
  label: string;
  value: string | number;
  comparison?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  isPositive?: boolean; // If true, up is good; if false, up is negative/worsening
  icon?: ReactNode;
}

export function KPIStat({
  label,
  value,
  comparison,
  trend,
  trendValue,
  isPositive = true,
  icon,
}: KPIStatProps) {
  const getTrendColor = () => {
    if (!trend || trend === 'neutral') return 'text-ink-tertiary';
    if (trend === 'up') {
      return isPositive ? 'text-civic-emerald' : 'text-civic-rose';
    }
    return isPositive ? 'text-civic-rose' : 'text-civic-emerald';
  };

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  }[trend || 'neutral'];

  return (
    <div className="p-5 rounded-xl border border-ink-border bg-white shadow-card space-y-2">
      <div className="flex items-center justify-between text-xs text-ink-secondary font-medium">
        <span>{label}</span>
        {icon && <span className="text-ink-tertiary">{icon}</span>}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-2xl sm:text-3xl font-extrabold text-ink-primary tracking-tight">
          {value}
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${getTrendColor()}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      {comparison && (
        <div className="text-[11px] text-ink-tertiary pt-1">
          {comparison}
        </div>
      )}
    </div>
  );
}
