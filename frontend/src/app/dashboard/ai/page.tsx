'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Search, ShieldCheck, Database, FileText, CheckCircle2 } from 'lucide-react';

export default function GovernanceAIPage() {
  const [query, setQuery] = useState('Which wards have the highest unresolved water supply impact this week?');

  const suggestedQuestions = [
    'Which wards have the highest unresolved water supply impact this week?',
    'What are the top three systemic problem clusters citywide?',
    'Why are water problems increasing in the Eastern Division?',
    'Which municipal departments face the highest SLA compliance risk?',
  ];

  return (
    <GovernmentShell>
      <div className="space-y-8 max-w-5xl mx-auto">
        <PageHeader
          title="Governance AI Research Workspace"
          description="Ask complex policy questions, query incident trends, and receive grounded answers backed by auditable database citations."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Governance AI' },
          ]}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-civic-blueLight text-civic-blueDark">
              Grounded Model Active
            </span>
          }
        />

        {/* Analytical Query Box */}
        <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-secondary">
              Natural Language Governance Query
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  prefixIcon={<Search className="w-4 h-4 text-civic-blue" />}
                  placeholder="Ask about public problems, impact, or SLA velocity..."
                />
              </div>
              <Button variant="primary" size="md">
                <span>Analyze</span>
              </Button>
            </div>
          </div>

          {/* Suggested Questions */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-mono text-ink-tertiary">Suggested Questions:</div>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  className={`text-xs text-left px-3 py-1.5 rounded-lg border transition-colors ${
                    query === q
                      ? 'bg-civic-blueLight border-civic-blue/40 text-civic-blueDark font-medium'
                      : 'bg-canvas-subtle border-ink-border text-ink-secondary hover:text-ink-primary hover:bg-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grounded Synthesized Response Box */}
        <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-6">
          <div className="flex items-center justify-between border-b border-ink-border/60 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-civic-emerald" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink-primary">
                Synthesized Answer & Supporting Intelligence
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-civic-emeraldLight text-emerald-800 text-xs font-mono font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>96% Evidence Grounding</span>
            </div>
          </div>

          {/* 1. Natural Language Answer */}
          <div className="space-y-3 text-sm text-ink-primary leading-relaxed bg-canvas-subtle/50 p-5 rounded-xl border border-ink-border/50">
            <p>
              <strong>Ward 18 (Indiranagar)</strong> currently accounts for <strong>61% of all active drinking water impact</strong> in the eastern municipal division. The core failure is an unresolved main transmission rupture on 4th Cross affecting approximately <strong>14,200 residents</strong> and approaching St. Mary&apos;s District Clinic.
            </p>
            <p>
              The secondary hotspot is <strong>Ward 22 (Koramangala)</strong> with 3 localized low-pressure pipe failures affecting 2,800 residents. All other wards report normal seasonal distribution metrics.
            </p>
          </div>

          {/* 2. Calculated Supporting Metrics */}
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider font-semibold text-ink-secondary">
              Calculated Quantitative Metrics
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-white border border-ink-border space-y-1">
                <div className="text-ink-tertiary">WARD 18 IMPACT</div>
                <div className="text-xl font-bold text-civic-rose">92 / 100</div>
                <div className="text-[11px] text-ink-secondary">327 correlated signals</div>
              </div>
              <div className="p-3.5 rounded-lg bg-white border border-ink-border space-y-1">
                <div className="text-ink-tertiary">POPULATION EXPOSURE</div>
                <div className="text-xl font-bold text-ink-primary">14,200 residents</div>
                <div className="text-[11px] text-ink-secondary">Across 4 neighborhood blocks</div>
              </div>
              <div className="p-3.5 rounded-lg bg-white border border-ink-border space-y-1">
                <div className="text-ink-tertiary">REPAIR VELOCITY</div>
                <div className="text-xl font-bold text-civic-amber">28 hrs active</div>
                <div className="text-[11px] text-ink-secondary">BWSSB SLA at 82% elapsed</div>
              </div>
            </div>
          </div>

          {/* 3. Actionable Policy Recommendation */}
          <div className="p-4 rounded-lg bg-civic-blueLight/20 border border-civic-blue/30 space-y-1">
            <div className="text-xs font-mono uppercase tracking-wider font-bold text-civic-blueDark">
              Recommended Municipal Action
            </div>
            <p className="text-xs text-ink-primary font-medium leading-relaxed">
              Expedite BWSSB Valve 4B replacement in Ward 18 and coordinate with BESCOM to safeguard subterranean electrical transformers from basement flooding.
            </p>
          </div>

          {/* 4. Auditable Citations */}
          <div className="space-y-2 pt-2 border-t border-ink-border/60">
            <div className="text-xs font-mono text-ink-tertiary">
              Auditable Database Records & Citations:
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <Link
                href="/dashboard/problems/PRB-2026-0819"
                className="inline-flex items-center gap-1 px-3 py-1 rounded bg-canvas-subtle border border-ink-border hover:border-civic-blue text-ink-primary transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-civic-blue" />
                <span>Problem #PRB-2026-0819 (Impact: 92)</span>
              </Link>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-canvas-subtle border border-ink-border text-ink-secondary">
                <Database className="w-3.5 h-3.5 text-ink-tertiary" />
                <span>Firestore Signal Batch #W18-994 (327 Records)</span>
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded bg-canvas-subtle border border-ink-border text-ink-secondary">
                <CheckCircle2 className="w-3.5 h-3.5 text-civic-emerald" />
                <span>BWSSB Dispatch Order #WO-402</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </GovernmentShell>
  );
}
