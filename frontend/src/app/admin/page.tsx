'use client';

import React from 'react';
import { AdminShell } from '../../components/shells/AdminShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Database, ShieldCheck, Clock } from 'lucide-react';

export default function AdminPage() {
  const plannedConnectors = [
    {
      name: 'Google Gemini Multimodal Intelligence Gateway',
      phase: 'Phases 3, 6, 7 (AI & Verification)',
      specRef: 'docs/05_AI_SPEC.md § 2',
      status: 'Active (Multimodal / Grounded)',
    },
    {
      name: 'Geospatial Ward Boundary GeoJSON Registry',
      phase: 'Phases 4, 7, 8 (Municipal GIS)',
      specRef: 'docs/02_PRODUCT_SCOPE.md § 3',
      status: 'Active (Nayapalli Ward 18)',
    },
    {
      name: 'National Grievance Protocol (NGP / Beckn)',
      phase: 'Roadmap (Protocol Integration)',
      specRef: 'docs/03_ARCHITECTURE.md § 4.1',
      status: 'Roadmap Specification',
    },
    {
      name: 'BigQuery Analytical Warehouse Export',
      phase: 'Roadmap (Data Platform)',
      specRef: 'docs/06_DATA_MODEL.md § 5',
      status: 'Roadmap Specification',
    },
  ];

  return (
    <AdminShell>
      <div className="space-y-8 max-w-6xl mx-auto">
        <PageHeader
          title="System Administration & Infrastructure Blueprint"
          description="Administrative shell, roadmap architecture specifications, and authoritative server-side security policies."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-900 border border-purple-200">
              Admin Shell
            </span>
          }
        />

        {/* Informational Scope Notice */}
        <div className="p-4 rounded-xl border border-civic-blue/30 bg-civic-blueLight/20 text-xs text-ink-primary space-y-1">
          <div className="font-semibold text-civic-blueDark flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-civic-blue" />
            <span>Active System Architecture & Platform State</span>
          </div>
          <p className="text-ink-secondary leading-relaxed">
            Per <code className="text-civic-blue font-mono">docs/09_PHASES.md</code>, Phases 1–8 are implemented and operational, providing signal ingestion, Gemini multimodal intelligence, clustering, deterministic impact scoring, SLA &amp; workflow management, AI resolution verification, Governance AI, and intervention simulation.
          </p>
        </div>

        {/* Planned DPI Ingestion Connectors (Placeholder / Spec Representation) */}
        <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-700" />
              <h3 className="text-sm font-bold text-ink-primary">
                Planned DPI Ingestion Connectors (Roadmap Architecture)
              </h3>
            </div>
            <span className="text-xs font-medium text-ink-secondary">
              Phase 3–4 Milestones
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {plannedConnectors.map((c) => (
              <div
                key={c.name}
                className="p-4 rounded-lg bg-canvas-subtle border border-ink-border space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink-primary">{c.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-canvas border border-ink-border text-ink-secondary shrink-0">
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-ink-secondary text-[11px] pt-1 border-t border-ink-border/40">
                  <span>Target: {c.phase}</span>
                  <span className="font-mono text-ink-tertiary">{c.specRef}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Authoritative Server-Side Security & DPDP Policy Architecture */}
        <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-civic-emerald" />
              <h3 className="text-sm font-bold text-ink-primary">
                Authoritative Security & DPDP Compliance Architecture
              </h3>
            </div>
            <span className="text-xs font-mono text-ink-tertiary">docs/08_SECURITY.md</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-primary">
                  Server-Side PII Redaction Pipeline
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-civic-blueLight text-civic-blueDark">
                  Backend Enforcement
                </span>
              </div>
              <p className="text-ink-secondary text-[11px] leading-relaxed">
                In strict adherence to the DPDP Act and Section 3 of docs/08_SECURITY.md, redaction of Aadhaar numbers, phone numbers, email addresses, and vehicle registration numbers is executed in server-side ingest pipelines prior to storage. No client-side checks are relied upon as authoritative protection.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-primary">
                  Role-Based Access Control (RBAC) & Principle of Least Privilege
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-canvas border border-ink-border text-ink-secondary">
                  Server-Side Claims
                </span>
              </div>
              <p className="text-ink-secondary text-[11px] leading-relaxed">
                Authorization boundaries across Citizen, Field Officer, Department Commissioner, and System Administrator personas are enforced via cryptographically verified server-side JWT claims and Firestore Security Rules.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink-primary">
                  Tamper-Evident Operational Audit Trail
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-canvas border border-ink-border text-ink-secondary">
                  Immutable Event Log
                </span>
              </div>
              <p className="text-ink-secondary text-[11px] leading-relaxed">
                All lifecycle state transitions (ASSIGNED → IN_PROGRESS → AWAITING_VERIFICATION → RESOLVED) and evidence submissions are logged with immutable timestamps, actor IDs, and cryptographic hashes in server audit logs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
