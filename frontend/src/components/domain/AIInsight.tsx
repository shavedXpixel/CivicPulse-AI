import React, { ReactNode } from 'react';
import { Info, ShieldCheck } from 'lucide-react';

export interface AIInsightProps {
  title?: string;
  children: ReactNode;
  confidence?: 'High' | 'Medium' | 'Low';
  citations?: string[];
}

export function AIInsight({
  title = 'AI Systemic Insight',
  children,
  confidence = 'High',
  citations = [],
}: AIInsightProps) {
  const confStyles = {
    High: 'text-emerald-800 bg-civic-emeraldLight',
    Medium: 'text-amber-800 bg-civic-amberLight',
    Low: 'text-rose-800 bg-civic-roseLight',
  }[confidence];

  return (
    <div className="rounded-sm border border-ink-border bg-canvas-subtle/40 p-4 space-y-2.5 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-ink-primary">
          <Info className="w-3.5 h-3.5 text-civic-terracotta" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <ShieldCheck className="w-3 h-3 text-ink-tertiary" />
          <span className={`px-1.5 py-0.5 rounded-sm font-medium ${confStyles}`}>
            {confidence} Confidence
          </span>
        </div>
      </div>

      <div className="text-ink-secondary leading-relaxed font-sans">
        {children}
      </div>

      {citations.length > 0 && (
        <div className="pt-2 border-t border-ink-border/50 flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] font-mono text-ink-tertiary">Sources:</span>
          {citations.map((cite, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-sm bg-canvas-card border border-ink-border text-[10px] font-mono text-ink-secondary"
            >
              {cite}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
