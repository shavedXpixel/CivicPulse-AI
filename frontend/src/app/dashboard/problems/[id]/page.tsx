'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../../components/ui/PageHeader';
import { ImpactScore } from '../../../../components/domain/ImpactScore';
import { ImpactBreakdown } from '../../../../components/domain/ImpactBreakdown';
import { StatusBadge } from '../../../../components/domain/StatusBadge';
import { EvidenceCard } from '../../../../components/domain/EvidenceCard';
import { Timeline } from '../../../../components/domain/Timeline';
import { AIInsight } from '../../../../components/domain/AIInsight';
import { DEMO_PROBLEMS } from '../../../../lib/mockData';
import { MapPin, ArrowLeft } from 'lucide-react';

export default function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const problem = DEMO_PROBLEMS.find((p) => p.id === id) || DEMO_PROBLEMS[0]!;

  const timelineEvents = [
    {
      id: '1',
      timestamp: 'Sep 5, 06:30 AM',
      actor: 'Ingestion Engine',
      action: 'Cluster Created from Citizen Signals',
      description: 'Initial cluster established with 18 signals reporting high-pressure pipe rupture.',
      isCompleted: true,
    },
    {
      id: '2',
      timestamp: 'Sep 5, 08:45 AM',
      actor: 'Impact Engine',
      action: 'Public Impact Score Escalated to 92',
      description: 'Impact recalculation triggered due to St. Mary\'s Clinic proximity and basement flooding.',
      isCompleted: true,
    },
    {
      id: '3',
      timestamp: 'Sep 5, 10:15 AM',
      actor: 'BWSSB Dispatcher',
      action: 'Emergency Work Order #WO-402 Dispatched',
      description: 'Crew #12 assigned for main valve isolation and pipe excavation.',
      isCompleted: true,
    },
    {
      id: '4',
      timestamp: 'Sep 6, 10:00 AM',
      actor: 'Field Crew #12',
      action: 'Excavation & Valve Replacement Underway',
      description: 'Ruptured section isolated. Valve 4B replacement in progress.',
      isCurrent: true,
    },
    {
      id: '5',
      timestamp: 'Pending',
      actor: 'AI Verification System',
      action: 'Resolution Photographic Audit',
      description: 'Awaiting field crew completion photos and pressure restoration telemetry.',
      isCompleted: false,
    },
  ];

  return (
    <GovernmentShell>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Navigation Breadcrumb */}
        <Link
          href="/dashboard/problems"
          className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Problem Directory</span>
        </Link>

        {/* Problem Header */}
        <PageHeader
          title={problem.title}
          description={`Incident ID: ${problem.id} • Assigned to ${problem.department}`}
          badge={<StatusBadge status={problem.status} />}
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Problems', href: '/dashboard/problems' },
            { label: problem.id },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <button className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle shadow-subtle transition-colors">
                Reassign Department
              </button>
              <button className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark shadow-subtle transition-colors">
                Dispatch Status Update
              </button>
            </div>
          }
        />

        {/* Two-Column Problem Operations Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Column (8 cols) */}
          <div className="lg:col-span-8 space-y-8">
            {/* Why This Matters Section */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono">
                  Why This Matters
                </h3>
                <span className="text-xs font-mono text-civic-rose font-bold">
                  High Systemic Urgency
                </span>
              </div>

              <div className="space-y-2">
                {problem.whyThisMatters.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-ink-primary">
                    <span className="w-1.5 h-1.5 rounded-full bg-civic-rose mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{point}</span>
                  </div>
                ))}
              </div>

              <AIInsight
                title="Socio-Technical Context"
                confidence="High"
                citations={[`Signal Batch #${problem.id}`, 'BWSSB GIS Pipeline Layer #04']}
              >
                Inundation rate is currently stable following valve isolation, but uninterrupted water cutoff exceeds 28 hours for 14,200 residents. Rapid restoration prevents secondary tanker price gouging and clinic operations disruption.
              </AIInsight>
            </div>

            {/* Evidence Comparison Section */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono">
                    Incident Evidence & Field Proof
                  </h3>
                  <p className="text-xs text-ink-secondary">Before / after photographic records and telemetry</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-canvas-subtle text-xs font-mono text-ink-secondary">
                  2 Records
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EvidenceCard
                  type="CITIZEN_REPORT"
                  title="Initial Inundation & Fractured Main"
                  timestamp="Sep 5, 06:42 AM"
                  source="Citizen Signal #SIG-8821 (Kannada Audio + Photo)"
                  location="4th Cross Road, Indiranagar"
                  coordinates="12.9784° N, 77.6408° E"
                  notes="Basement flooded with high pressure clean drinking water."
                  isVerified={true}
                />

                <EvidenceCard
                  type="RESOLUTION_PROOF"
                  title="Field Excavation & Valve 4B Replacement"
                  timestamp="Sep 6, 11:30 AM"
                  source="BWSSB Field Ops (Engineer Subhash N.)"
                  location="4th Cross Junction, Indiranagar"
                  coordinates="12.9783° N, 77.6407° E (8.4m radius match)"
                  confidence={91}
                  notes="Old cast iron pipe section cut out. New ductile iron valve coupling being bolted."
                  isVerified={true}
                />
              </div>
            </div>

            {/* Related Citizen Signals Batch */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono">
                    Clustered Citizen Signals ({problem.signalCount})
                  </h3>
                  <p className="text-xs text-ink-secondary">Unified by semantic embedding and spatiotemporal radius</p>
                </div>
                <span className="text-xs font-mono text-civic-blue">96% Semantic Similarity</span>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-ink-primary">Signal #SIG-8821 • Voice in Kannada</div>
                    <p className="text-ink-secondary">&ldquo;High pressure water pipe burst near 4th Cross. Flooding basement parking.&rdquo;</p>
                  </div>
                  <span className="text-[11px] font-mono text-ink-tertiary">4m ago</span>
                </div>

                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-ink-primary">Signal #SIG-8819 • Photo Upload</div>
                    <p className="text-ink-secondary">&ldquo;No water in taps across blocks C and D since 6 AM. Road submerged.&rdquo;</p>
                  </div>
                  <span className="text-[11px] font-mono text-ink-tertiary">12m ago</span>
                </div>

                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-ink-primary">Signal #SIG-8814 • WhatsApp Message</div>
                    <p className="text-ink-secondary">&ldquo;Water supply contaminated with mud on 100ft road Indiranagar.&rdquo;</p>
                  </div>
                  <span className="text-[11px] font-mono text-ink-tertiary">28m ago</span>
                </div>
              </div>
            </div>

            {/* Operational Event Timeline */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-4">
              <h3 className="text-sm font-bold text-ink-primary uppercase tracking-wider font-mono border-b border-ink-border/60 pb-3">
                Operational Event Timeline
              </h3>
              <Timeline events={timelineEvents} />
            </div>
          </div>

          {/* Right Rail Details (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Impact Rating Card */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-ink-secondary font-semibold">
                  Public Impact Rating
                </span>
                <span className="text-xs font-mono text-civic-rose font-bold">Section 6.2</span>
              </div>

              <ImpactScore score={problem.impactScore} size="lg" />

              <ImpactBreakdown
                population={problem.impactBreakdown.population}
                severity={problem.impactBreakdown.severity}
                spread={problem.impactBreakdown.spread}
                duration={problem.impactBreakdown.duration}
                facilities={problem.impactBreakdown.facilities}
              />
            </div>

            {/* Location & GIS Card */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-3 text-xs">
              <div className="flex items-center justify-between font-mono text-ink-secondary">
                <span className="uppercase font-semibold tracking-wider">Location & GIS</span>
                <span>{problem.wardId}</span>
              </div>

              <div className="flex items-start gap-2 text-ink-primary font-medium">
                <MapPin className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
                <span>{problem.location.address}</span>
              </div>

              <div className="h-32 rounded-lg bg-canvas-subtle border border-ink-border flex flex-col items-center justify-center p-3 text-center text-ink-tertiary">
                <MapPin className="w-6 h-6 text-civic-rose mb-1" />
                <span className="font-mono text-[11px] text-ink-secondary">
                  Lat: {problem.location.lat} • Lng: {problem.location.lng}
                </span>
                <span className="text-[10px]">Indiranagar Ward 18 Corridor</span>
              </div>
            </div>

            {/* Municipal Action Dispatch Card */}
            <div className="p-6 rounded-xl border border-ink-border bg-white shadow-card space-y-3 text-xs">
              <span className="font-mono text-ink-secondary uppercase font-semibold tracking-wider">
                Assigned Team & SLA
              </span>

              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border space-y-1">
                  <div className="font-semibold text-ink-primary">BWSSB Emergency Work Order #WO-402</div>
                  <div className="text-ink-secondary">Lead Engineer: Subhash N.</div>
                  <div className="text-[11px] font-mono text-civic-amber font-semibold">
                    SLA Deadline: In 4 hours (Today, 04:00 PM)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GovernmentShell>
  );
}
