import React from 'react';
import { ShieldCheck, CheckCircle2, UserCheck } from 'lucide-react';

export interface ConfidenceIndicatorProps {
  score: number; // 0-100
  reviewedBy?: string;
  basedOnCount?: number;
  className?: string;
}

export function ConfidenceIndicator({
  score,
  reviewedBy,
  basedOnCount,
  className = '',
}: ConfidenceIndicatorProps) {
  const getTier = (s: number) => {
    if (s >= 85) return { label: 'High Confidence', color: 'text-emerald-800 bg-civic-emeraldLight border-civic-emerald/20' };
    if (s >= 65) return { label: 'Moderate Confidence', color: 'text-amber-800 bg-civic-amberLight border-civic-amber/20' };
    return { label: 'Low Confidence', color: 'text-rose-800 bg-civic-roseLight border-civic-rose/20' };
  };

  const tier = getTier(score);

  return (
    <div className={`p-4 rounded-xl border bg-white shadow-subtle space-y-2.5 ${tier.color} ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-civic-emerald shrink-0" />
          <span className="text-xs font-mono font-bold tracking-wider uppercase">
            AI Interpretation & Evidence
          </span>
        </div>
        <div className="text-xs font-mono font-bold">
          {score}% Verified
        </div>
      </div>

      <div className="space-y-1 text-xs">
        {basedOnCount !== undefined && (
          <div className="flex items-center gap-1.5 text-ink-secondary">
            <CheckCircle2 className="w-3.5 h-3.5 text-ink-tertiary" />
            <span>Grounded on <strong>{basedOnCount}</strong> correlated citizen & field records</span>
          </div>
        )}
        {reviewedBy && (
          <div className="flex items-center gap-1.5 text-ink-secondary">
            <UserCheck className="w-3.5 h-3.5 text-ink-tertiary" />
            <span>Audited & confirmed by: <strong>{reviewedBy}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
