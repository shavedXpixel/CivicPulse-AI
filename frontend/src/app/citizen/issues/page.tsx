import React from 'react';
import Link from 'next/link';
import { CitizenShell } from '../../../components/shells/CitizenShell';
import { Check, ArrowLeft, Building2 } from 'lucide-react';

export default function CitizenIssuesPage() {
  const steps = [
    { label: 'Report received & PII redacted', status: 'done', time: 'Yesterday, 06:40 AM' },
    { label: 'Grouped with 326 related reports in Ward 18', status: 'done', time: 'Yesterday, 07:15 AM' },
    { label: 'Assigned to Water Board (BWSSB)', status: 'done', time: 'Yesterday, 08:30 AM' },
    { label: 'Excavation & valve replacement in progress', status: 'current', time: 'Today, 10:00 AM' },
    { label: 'Field officer verification & photo proof', status: 'pending', time: 'Estimated 2 hours' },
    { label: 'Citizen re-confirmation & closure', status: 'pending', time: 'Pending completion' },
  ];

  return (
    <CitizenShell>
      <div className="space-y-6 max-w-xl mx-auto">
        <Link
          href="/citizen"
          className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-civic-blue">REPORT #CP-10482</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-civic-amberLight text-amber-900 font-semibold">
              Work In Progress
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
            Drinking Water Pipe Rupture
          </h1>
          <p className="text-xs text-ink-secondary">
            4th Cross, 100ft Road, Indiranagar (Ward 18)
          </p>
        </div>

        {/* Reassuring Collective Banner */}
        <div className="p-4 rounded-xl border border-ink-border bg-white shadow-card flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-civic-blue" />
            <div>
              <div className="font-semibold text-ink-primary">BWSSB Emergency Crew #402</div>
              <div className="text-[11px] text-ink-secondary">Valve replacement unit on-site</div>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-civic-blue">327 Reports</span>
        </div>

        {/* Plain Language Progress Timeline */}
        <div className="p-6 rounded-2xl border border-ink-border bg-white shadow-card space-y-4">
          <h3 className="text-sm font-bold text-ink-primary">Resolution Timeline</h3>

          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-ink-border">
            {steps.map((s, idx) => (
              <div key={idx} className="relative flex items-start gap-3 pl-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                    s.status === 'done'
                      ? 'bg-civic-emerald text-white'
                      : s.status === 'current'
                      ? 'bg-civic-blue text-white ring-4 ring-civic-blue/20'
                      : 'bg-canvas-subtle border border-ink-border text-ink-tertiary'
                  }`}
                >
                  {s.status === 'done' ? <Check className="w-3 h-3" /> : idx + 1}
                </div>

                <div className="flex-1 space-y-0.5 pt-0.5">
                  <div
                    className={`text-xs ${
                      s.status === 'current'
                        ? 'font-bold text-civic-blue'
                        : s.status === 'done'
                        ? 'font-medium text-ink-primary'
                        : 'text-ink-tertiary'
                    }`}
                  >
                    {s.label}
                  </div>
                  <div className="text-[10px] font-mono text-ink-tertiary">
                    {s.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CitizenShell>
  );
}
