'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CitizenShell } from '../../../components/shells/CitizenShell';
import { Mic, Camera, MapPin, CheckCircle2, ArrowLeft, Send } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';

export default function CitizenReportPage() {
  const [description, setDescription] = useState(
    'Huge water pipeline burst outside 4th cross road, water is flowing into basements and roads are completely flooded.'
  );
  const [isSubmitted, setIsSubmitted] = useState(false);

  return (
    <CitizenShell>
      <div className="space-y-6 max-w-xl mx-auto">
        <Link
          href="/citizen"
          className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </Link>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
            Report a public problem
          </h1>
          <p className="text-xs text-ink-secondary">
            Provide details in any format. Our intelligence layer standardizes and routes your signal.
          </p>
        </div>

        {isSubmitted ? (
          <div className="p-6 rounded-2xl border border-civic-emerald/30 bg-white shadow-card space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-civic-emeraldLight text-civic-emerald mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-ink-primary">Report Received</h3>
              <p className="text-xs text-ink-secondary">
                Your report has been received and joined with 326 neighboring reports in Ward 18.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-canvas-subtle border border-ink-border text-left text-xs font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-tertiary">Incident Reference:</span>
                <span className="font-bold text-ink-primary">#CP-10482</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-tertiary">Assigned Department:</span>
                <span className="font-bold text-civic-blue">Water Board (BWSSB)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-tertiary">Initial Severity:</span>
                <span className="font-bold text-civic-rose">High</span>
              </div>
            </div>
            <Link href="/citizen/issues" className="block w-full">
              <Button variant="primary" className="w-full">
                Track Report Status
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Input choices */}
            <div className="flex items-center gap-2">
              <button className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-ink-border bg-white hover:bg-canvas-subtle text-xs font-medium text-ink-primary transition-colors">
                <Mic className="w-4 h-4 text-civic-blue" />
                <span>Record Voice</span>
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-ink-border bg-white hover:bg-canvas-subtle text-xs font-medium text-ink-primary transition-colors">
                <Camera className="w-4 h-4 text-civic-blue" />
                <span>Attach Photo</span>
              </button>
            </div>

            {/* Description Area */}
            <div className="space-y-2">
              <Textarea
                label="What happened?"
                placeholder="Describe what you see, hear, or experience..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            {/* Location selector */}
            <div className="p-3.5 rounded-xl border border-ink-border bg-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <MapPin className="w-4 h-4 text-civic-rose shrink-0" />
                <div>
                  <span className="font-medium text-ink-primary">4th Cross, 100ft Road</span>
                  <span className="text-ink-tertiary ml-1.5 font-mono text-[11px]">(Ward 18 Indiranagar)</span>
                </div>
              </div>
              <button className="text-xs font-semibold text-civic-blue hover:underline">
                Change
              </button>
            </div>

            {/* AI Real-time Comprehension Card */}
            <div className="p-4 rounded-xl border border-civic-blue/30 bg-civic-blueLight/20 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-civic-blue" />
                <span className="text-xs font-bold text-ink-primary">
                  AI Understood Your Report
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-ink-border space-y-0.5">
                  <div className="text-[10px] font-mono text-ink-tertiary">CATEGORY</div>
                  <div className="font-medium text-ink-primary">Water Supply Interruption</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-ink-border space-y-0.5">
                  <div className="text-[10px] font-mono text-ink-tertiary">SEVERITY</div>
                  <div className="font-medium text-civic-rose">High (Basement Inundation)</div>
                </div>
              </div>

              <div className="text-[11px] text-ink-secondary">
                Your report will be clustered with other reports in Ward 18 to trigger emergency municipal dispatch.
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex gap-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full gap-2"
                onClick={() => setIsSubmitted(true)}
              >
                <Send className="w-4 h-4" />
                <span>Submit Report</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </CitizenShell>
  );
}
