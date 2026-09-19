import React from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export interface AIBriefProps {
  headline: string;
  summary: string;
  recommendedAction: string;
  confidence?: string;
  sourcesCount?: number;
  problemLink?: string;
}

export function AIBrief({
  headline,
  summary,
  recommendedAction,
  confidence = '94%',
  sourcesCount = 0,
  problemLink,
}: AIBriefProps) {
  return (
    <div className="rounded-sm border border-ink-border bg-canvas-card p-6 shadow-none space-y-4">
      <div className="flex items-center justify-between border-b border-ink-border pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-civic-terracotta" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-civic-terracotta uppercase">
            Executive Intelligence Briefing
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-secondary">
          <ShieldCheck className="w-3.5 h-3.5 text-civic-emerald" />
          <span>{confidence} Confidence</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base sm:text-lg font-bold text-ink-primary leading-snug">
          {headline}
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed font-normal">
          {summary}
        </p>
      </div>

      <div className="p-3.5 rounded-sm bg-canvas-subtle/60 border border-ink-border space-y-1">
        <div className="text-[10px] font-mono uppercase tracking-widest font-semibold text-civic-terracotta">
          Recommended Municipal Action
        </div>
        <p className="text-xs text-ink-primary font-medium leading-relaxed">
          {recommendedAction}
        </p>
      </div>

      <div className="pt-2 border-t border-ink-border flex flex-wrap items-center justify-between text-xs text-ink-tertiary font-mono gap-2">
        <span>Grounded on {sourcesCount} verified citizen signals</span>
        {problemLink && (
          <Link
            href={problemLink}
            className="inline-flex items-center gap-1 text-xs font-mono font-medium text-civic-terracotta hover:text-civic-terracottaDark transition-colors"
          >
            <span>Review Incident Dossier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
