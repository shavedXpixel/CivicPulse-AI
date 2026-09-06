import React from 'react';

export interface ImpactScoreProps {
  score: number; // 0-100
  showBar?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ImpactScore({
  score,
  showBar = true,
  size = 'md',
  className = '',
}: ImpactScoreProps) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  const getTier = (s: number) => {
    if (s >= 80) return { label: 'CRITICAL', color: 'text-civic-rose', bar: 'bg-civic-rose', bg: 'bg-civic-roseLight' };
    if (s >= 60) return { label: 'HIGH', color: 'text-rose-700', bar: 'bg-rose-600', bg: 'bg-rose-50' };
    if (s >= 40) return { label: 'MEDIUM', color: 'text-civic-amber', bar: 'bg-civic-amber', bg: 'bg-civic-amberLight' };
    return { label: 'LOW', color: 'text-civic-blueDark', bar: 'bg-civic-blue', bg: 'bg-civic-blueLight' };
  };

  const tier = getTier(normalizedScore);

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  }[size];

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div className={`font-mono font-extrabold tracking-tight ${textSizes} ${tier.color}`}>
          {normalizedScore}
          <span className="text-xs font-normal text-ink-secondary ml-1">/100</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${tier.bg} ${tier.color}`}
        >
          {tier.label}
        </span>
      </div>

      {showBar && (
        <div className="w-full bg-canvas-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${tier.bar}`}
            style={{ width: `${normalizedScore}%` }}
          />
        </div>
      )}
    </div>
  );
}
