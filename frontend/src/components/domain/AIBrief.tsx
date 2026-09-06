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
  sourcesCount = 327,
  problemLink,
}: AIBriefProps) {
  return (
    <div className="rounded-xl border border-civic-blue/30 bg-gradient-to-br from-white via-white to-civic-blueLight/20 p-6 shadow-card space-y-4">
      <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-civic-blue" />
          <span className="text-xs font-mono font-bold tracking-wider text-civic-blue uppercase">
            Executive AI Briefing Note
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono text-ink-secondary">
          <ShieldCheck className="w-3.5 h-3.5 text-civic-emerald" />
          <span>{confidence} Confidence</span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-base font-bold text-ink-primary leading-snug">
          {headline}
        </h3>
        <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
          {summary}
        </p>
      </div>

      <div className="p-3.5 rounded-lg bg-white border border-ink-border space-y-1">
        <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-civic-blue">
          Recommended Municipal Action
        </div>
        <p className="text-xs text-ink-primary font-medium">
          {recommendedAction}
        </p>
      </div>

      <div className="pt-2 border-t border-ink-border/60 flex items-center justify-between text-xs text-ink-tertiary font-mono">
        <span>Grounded on {sourcesCount} verified citizen signals</span>
        {problemLink && (
          <Link
            href={problemLink}
            className="inline-flex items-center gap-1 text-civic-blue font-semibold hover:text-civic-blueDark transition-colors"
          >
            <span>Review Incident Dossier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
