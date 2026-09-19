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
    <div className="p-5 rounded-sm border border-ink-border bg-canvas-card space-y-2 shadow-none">
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-ink-secondary">
        <span>{label}</span>
        {icon && <span className="text-ink-tertiary">{icon}</span>}
      </div>

      <div className="flex items-baseline justify-between pt-1">
        <div className="text-2xl sm:text-3xl font-extrabold text-ink-primary tracking-tight font-mono">
          {value}
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-[11px] font-mono font-semibold ${getTrendColor()}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span>{trendValue}</span>
          </div>
        )}
      </div>

      {comparison && (
        <div className="text-[11px] text-ink-tertiary font-sans pt-1 border-t border-ink-border/50">
          {comparison}
        </div>
      )}
    </div>
  );
}
