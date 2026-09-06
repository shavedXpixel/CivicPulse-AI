'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { OfficerShell } from '../../components/shells/OfficerShell';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/domain/StatusBadge';
import {
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  Navigation,
  FileCheck,
} from 'lucide-react';

export default function OfficerPage() {
  const [activeTask] = useState({
    id: 'WO-402',
    problemId: 'PRB-2026-0819',
    title: 'Ward 18 Main Distribution Rupture & Submersion',
    location: '4th Cross, 100ft Road, Indiranagar',
    coordinates: '12.9784° N, 77.6408° E',
    impactScore: 92,
    severity: 'CRITICAL',
    status: 'IN_PROGRESS',
    assignedAt: 'Today, 07:30 AM',
    slaDeadline: 'Today, 04:00 PM (3h 15m remaining)',
    instructions:
      'Excavate damaged 300mm cast iron main, isolate auxiliary valve 4B, and fit new ductile iron coupling. Submit geotagged post-repair photo upon pressure restoration.',
  });

  const [evidenceSubmitted, setEvidenceSubmitted] = useState(false);

  return (
    <OfficerShell>
      <div className="space-y-6">
        <PageHeader
          title="Field Operations Queue"
          description="Active emergency dispatches and assigned infrastructure work orders."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-civic-amberLight text-amber-900">
              1 Critical Active
            </span>
          }
        />

        {/* Urgent Task Card */}
        <div className="p-6 rounded-xl border border-civic-rose/30 bg-white shadow-card space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-ink-border/60 pb-4 gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-civic-roseLight text-civic-rose">
                  EMERGENCY DISPATCH
                </span>
                <span className="text-xs font-mono text-ink-tertiary">Work Order #{activeTask.id}</span>
              </div>
              <h2 className="text-lg font-bold text-ink-primary">{activeTask.title}</h2>
            </div>
            <StatusBadge status={activeTask.status} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="flex items-start gap-2 text-ink-secondary">
              <MapPin className="w-4 h-4 text-civic-rose shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-ink-primary">{activeTask.location}</span>
                <div className="text-[11px] font-mono text-ink-tertiary">{activeTask.coordinates}</div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-ink-secondary">
              <Clock className="w-4 h-4 text-civic-amber shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-ink-primary">SLA Countdown</span>
                <div className="text-[11px] font-mono text-civic-amber font-bold">{activeTask.slaDeadline}</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-canvas-subtle border border-ink-border text-xs space-y-1">
            <span className="font-mono text-ink-tertiary uppercase font-semibold text-[10px]">
              ENGINEERING INSTRUCTIONS
            </span>
            <p className="text-ink-secondary leading-relaxed">{activeTask.instructions}</p>
          </div>

          {/* Resolution Submission Box */}
          {evidenceSubmitted ? (
            <div className="p-4 rounded-xl border border-civic-emerald/30 bg-civic-emeraldLight/20 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-civic-emerald shrink-0" />
                <div>
                  <span className="font-bold text-ink-primary">Resolution Evidence Uploaded</span>
                  <p className="text-ink-secondary text-[11px]">
                    Photo match validated at 8.4m radius. AI verification score: 91%.
                  </p>
                </div>
              </div>
              <span className="font-mono text-civic-emerald font-bold text-xs">Awaiting Approval</span>
            </div>
          ) : (
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="md"
                className="gap-2"
                onClick={() => setEvidenceSubmitted(true)}
              >
                <Camera className="w-4 h-4" />
                <span>Submit Resolution Proof & Photo</span>
              </Button>
              <Button variant="outline" size="md" className="gap-2">
                <Navigation className="w-4 h-4" />
                <span>Navigate to Coordinates</span>
              </Button>
              <Link
                href={`/dashboard/problems/${activeTask.problemId}`}
                className="text-xs font-semibold text-civic-blue hover:underline ml-auto"
              >
                Inspect Problem Dossier →
              </Link>
            </div>
          )}
        </div>

        {/* Completed History List */}
        <div className="space-y-3 pt-4">
          <h3 className="text-sm font-bold text-ink-primary font-mono uppercase tracking-wider">
            Completed Tasks Today
          </h3>
          <div className="p-4 rounded-xl border border-ink-border bg-white shadow-card flex items-center justify-between text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink-primary">Valve Pressure Check #WO-398</span>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-civic-emeraldLight text-emerald-800 font-semibold">
                  Verified Closed
                </span>
              </div>
              <div className="text-[11px] text-ink-tertiary font-mono">100ft Road • Completed 08:30 AM</div>
            </div>
            <FileCheck className="w-5 h-5 text-civic-emerald" />
          </div>
        </div>
      </div>
    </OfficerShell>
  );
}
