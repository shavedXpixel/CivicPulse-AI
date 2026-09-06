'use client';

import React from 'react';
import { AdminShell } from '../../components/shells/AdminShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Database, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function AdminPage() {
  const dpiConnectors = [
    { name: 'National Grievance Protocol (NGP / Beckn)', status: 'Connected', ping: '24ms', mode: 'DPI Layer 1' },
    { name: 'Google Gemini 1.5 Pro / Flash Model Gateway', status: 'Ready', ping: '110ms', mode: 'Isolated Provider' },
    { name: 'Firestore / BigQuery Dual Pipeline', status: 'Active', ping: '18ms', mode: 'DEMO_MODE Mock Ready' },
    { name: 'Geospatial Ward Boundary GeoJSON Service', status: 'Synced', ping: '12ms', mode: '198 Wards' },
  ];

  return (
    <AdminShell>
      <div className="space-y-8 max-w-6xl mx-auto">
        <PageHeader
          title="System Administration & DPI Infrastructure"
          description="Digital Public Infrastructure connections, privacy redaction gates, and platform security rules."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-purple-100 text-purple-900 border border-purple-200">
              Root Console
            </span>
          }
        />

        {/* DPI Connectors Status */}
        <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-700" />
              <h3 className="text-sm font-bold text-ink-primary">DPI Ingestion Connectors</h3>
            </div>
            <span className="text-xs font-mono text-civic-emerald font-semibold">4 / 4 Healthy</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dpiConnectors.map((c) => (
              <div key={c.name} className="p-4 rounded-lg bg-canvas-subtle border border-ink-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink-primary">{c.name}</span>
                  <span className="flex items-center gap-1 font-mono text-[11px] text-civic-emerald font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{c.status}</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-ink-tertiary font-mono text-[11px]">
                  <span>Mode: {c.mode}</span>
                  <span>Latency: {c.ping}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DPDP Compliance & Privacy Gate */}
        <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
          <div className="flex items-center gap-2 border-b border-ink-border/60 pb-3">
            <ShieldCheck className="w-4 h-4 text-civic-emerald" />
            <h3 className="text-sm font-bold text-ink-primary">
              Data Privacy & DPDP Act Compliance Gates
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-canvas-subtle border border-ink-border">
              <div>
                <div className="font-semibold text-ink-primary">Client-Side PII Redaction Gate</div>
                <p className="text-ink-secondary text-[11px]">
                  Aadhaar, phone numbers, email addresses, and vehicle numbers are stripped before persistence.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-civic-emeraldLight text-emerald-800 font-mono font-bold">
                ENFORCED
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-canvas-subtle border border-ink-border">
              <div>
                <div className="font-semibold text-ink-primary">Deterministic Downstream Seeding Lock</div>
                <p className="text-ink-secondary text-[11px]">
                  Ward 18 scenario is pre-seeded with reproducible downstream impact & verification data.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-civic-blueLight text-civic-blueDark font-mono font-bold">
                ACTIVE
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
