import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  ArrowUpRight,
  Mic,
  Camera,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Users,
  Clock,
  MapPin,
  Building2,
  RotateCcw,
  Check,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink-primary selection:bg-civic-blueLight selection:text-civic-blueDark flex flex-col font-sans">
      {/* ------------------------------------------------------------- */}
      {/* TOP ARCHITECTURAL HEADER                                      */}
      {/* ------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 bg-canvas-card/95 backdrop-blur-sm border-b border-ink-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-sm bg-ink-primary flex items-center justify-center text-canvas-card font-mono font-bold text-xs tracking-wider">
                CP
              </div>
              <span className="font-bold text-sm tracking-tight text-ink-primary">
                CivicPulse
              </span>
            </Link>
            <div className="hidden sm:block h-3.5 w-px bg-ink-border" />
            <span className="hidden md:inline-block text-[11px] font-mono uppercase tracking-wider text-ink-tertiary">
              Citizen Signals → Government Intelligence → Public Action
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium bg-canvas-subtle border border-ink-border text-ink-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-civic-emerald" />
              <span>LIVE PRODUCTION</span>
            </span>

            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-ink-primary px-2.5 py-1.5 rounded-sm border border-ink-border hover:bg-canvas-subtle transition-colors"
            >
              Sign In
            </Link>

            <Link
              href="/login?tab=register"
              className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-civic-terracotta hover:bg-civic-terracottaDark px-3 py-1.5 rounded-sm transition-colors shadow-none"
            >
              <span>Register</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* EDITORIAL HERO SECTION (12-COLUMN ARCHITECTURAL GRID)        */}
      {/* ------------------------------------------------------------- */}
      <section className="border-b border-ink-border bg-canvas">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">

          {/* Main Statement Column (Col 1-8) */}
          <div className="lg:col-span-8 p-6 sm:p-10 lg:p-14 lg:border-r border-ink-border flex flex-col justify-between">
            <div className="space-y-6 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-civic-terracotta">
                <span>Digital Public Infrastructure</span>
                <span>•</span>
                <span>Civic Intelligence Layer</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ink-primary leading-[1.05] uppercase">
                CITIZEN SIGNALS<br />
                BECOME PUBLIC<br />
                INTELLIGENCE.
              </h1>

              <p className="text-sm sm:text-base text-ink-secondary leading-relaxed font-normal pt-2">
                CivicPulse turns real citizen signals into structured intelligence
                that helps government identify, prioritize, assign and resolve
                public problems.
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/citizen/report"
                className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-civic-terracotta hover:bg-civic-terracottaDark px-4 py-2.5 rounded-sm transition-colors"
              >
                <span>Report an Issue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs font-medium text-ink-primary bg-canvas-card hover:bg-canvas-subtle border border-ink-border px-4 py-2.5 rounded-sm transition-colors"
              >
                <span>Government Operations Portal</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-ink-tertiary" />
              </Link>
            </div>
          </div>

          {/* Technical Metadata & Architecture Column (Col 9-12) */}
          <div className="lg:col-span-4 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-canvas-subtle/30 space-y-8">
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-ink-tertiary block">
                  SYSTEM STATUS
                </span>
                <div className="flex items-center gap-2 text-xs font-mono font-medium text-ink-primary">
                  <span className="w-2 h-2 rounded-full bg-civic-emerald" />
                  <span>AUTHORITATIVE PIPELINE ACTIVE</span>
                </div>
              </div>

              <div className="space-y-1 border-t border-ink-border pt-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-ink-tertiary block">
                  OPERATIONAL PRINCIPLE
                </span>
                <p className="text-xs text-ink-secondary leading-relaxed">
                  Real data authority. Real municipal departments, live citizen reports,
                  and objective 7-factor public impact calculations without synthetic demo inflation.
                </p>
              </div>

              <div className="space-y-1 border-t border-ink-border pt-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-ink-tertiary block">
                  LEGAL & PRIVACY FRAMEWORK
                </span>
                <div className="flex items-center gap-1.5 text-xs text-ink-primary font-medium">
                  <ShieldCheck className="w-4 h-4 text-civic-terracotta shrink-0" />
                  <span>DPDP Act 2023 Compliant</span>
                </div>
                <p className="text-[11px] text-ink-tertiary leading-normal pt-0.5">
                  Citizen reports undergo automated PII redaction prior to municipal triage and aggregation.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-ink-border">
              <a
                href="/api/v1/health"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-secondary hover:text-ink-primary transition-colors"
              >
                <span>Backend Health Telemetry</span>
                <ExternalLink className="w-3 h-3 text-ink-tertiary" />
              </a>
              <div className="text-xs font-mono uppercase tracking-wider font-semibold text-civic-blue">
                The Architectural Role
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary">
                A public problem intelligence layer, not another grievance portal.
              </h2>
              <p className="text-base text-ink-secondary leading-relaxed pt-2">
                CivicPulse AI does not replace municipal ticketing or grievance software.
                It sits between raw citizen communications and government workflows to solve the hardest governance problem:
                turning fragmented reports into prioritized, systemic public action.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 rounded-lg bg-canvas border border-ink-border space-y-3">
                <div className="w-8 h-8 rounded bg-civic-blueLight text-civic-blueDark flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="text-base font-semibold text-ink-primary">
                  Multimodal Ingestion
                </h3>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  Accepts voice in regional languages, photos, WhatsApp messages, and web forms. PII is redacted at the edge before storage.
                </p>
              </div>

              <div className="p-6 rounded-lg bg-canvas border border-ink-border space-y-3">
                <div className="w-8 h-8 rounded bg-civic-blueLight text-civic-blueDark flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 className="text-base font-semibold text-ink-primary">
                  Semantic Clustering
                </h3>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  Consolidates hundreds of individual complaints into single systemic incidents using Google text-embedding-004 and spatiotemporal clustering.
                </p>
              </div>

              <div className="p-6 rounded-lg bg-canvas border border-ink-border space-y-3">
                <div className="w-8 h-8 rounded bg-civic-blueLight text-civic-blueDark flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="text-base font-semibold text-ink-primary">
                  Auditable Impact (0–100)
                </h3>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  Scores severity mathematically by population affected, spread, duration, and critical infrastructure proximity.
                </p>
              </div>

              <div className="p-6 rounded-lg bg-canvas border border-ink-border space-y-3">
                <div className="w-8 h-8 rounded bg-civic-blueLight text-civic-blueDark flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <h3 className="text-base font-semibold text-ink-primary">
                  Evidence Verification
                </h3>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  Officers must submit photographic evidence and location proof. AI cross-examines before/after conditions before closing the incident.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. CITIZEN EXPERIENCE                                         */}
      {/* ------------------------------------------------------------- */}
      <section id="citizen-experience" className="py-24 border-b border-ink-border bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-16">
            <div className="text-xs font-mono uppercase tracking-wider font-semibold text-civic-blue mb-2">
              Citizen Experience
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary mb-4">
              Simple, reassuring, and completely barrier-free.
            </h2>
            <p className="text-base text-ink-secondary">
              Reporting a public hazard shouldn&apos;t require understanding municipal department hierarchies or filling out multi-page forms.
            </p>
          </div>

          {/* Clean Mobile Product Composition */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Phone Screen Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-[340px] bg-white rounded-3xl border border-ink-border shadow-elevated p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-ink-border pb-3">
                  <span className="font-semibold text-sm text-ink-primary">CivicPulse</span>
                  <span className="text-xs font-mono text-ink-tertiary">Ward 18</span>
                </div>

                {/* Primary Actions */}
                <div className="space-y-2">
                  <div className="text-xs text-ink-secondary font-medium">How would you like to report?</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button className="flex flex-col items-center justify-center p-3 rounded-xl border border-ink-border hover:border-civic-blue bg-canvas-subtle hover:bg-civic-blueLight/30 transition-all text-ink-primary">
                      <Mic className="w-5 h-5 text-civic-blue mb-1" />
                      <span className="text-[11px] font-medium">Speak</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-3 rounded-xl border border-civic-blue bg-civic-blueLight/40 text-civic-blueDark transition-all">
                      <Camera className="w-5 h-5 text-civic-blue mb-1" />
                      <span className="text-[11px] font-semibold">Photo</span>
                    </button>
                    <button className="flex flex-col items-center justify-center p-3 rounded-xl border border-ink-border hover:border-civic-blue bg-canvas-subtle hover:bg-civic-blueLight/30 transition-all text-ink-primary">
                      <FileText className="w-5 h-5 text-civic-blue mb-1" />
                      <span className="text-[11px] font-medium">Describe</span>
                    </button>
                  </div>
                </div>

                {/* AI Instant Understanding Preview */}
                <div className="rounded-xl p-4 bg-canvas border border-ink-border space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-civic-emerald shrink-0" />
                    <span className="text-xs font-semibold text-ink-primary">AI understood your report</span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-ink-border/60">
                      <span className="text-ink-secondary">Category:</span>
                      <span className="font-medium text-ink-primary">Water Supply Interruption</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-ink-border/60">
                      <span className="text-ink-secondary">Location:</span>
                      <span className="font-medium text-ink-primary">4th Cross, Ward 18</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-ink-secondary">Severity:</span>
                      <span className="font-medium text-civic-rose">High (Road Submerged)</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 py-2 text-xs font-medium rounded-lg border border-ink-border bg-white hover:bg-canvas-subtle transition-all">
                      Edit
                    </button>
                    <button className="flex-1 py-2 text-xs font-medium rounded-lg bg-civic-blue hover:bg-civic-blueDark text-white transition-all">
                      Submit
                    </button>
                  </div>
                </div>

                {/* Citizen reassurance message */}
                <div className="p-3 rounded-lg bg-civic-emeraldLight/40 border border-civic-emerald/20 text-[11px] text-ink-secondary leading-snug">
                  <span className="font-semibold text-ink-primary">System Response: </span>
                  Your signal matches 326 neighboring reports. Municipal dispatch has been alerted.
                </div>
              </div>
            </div>

            {/* Editorial Features Description */}
            <div className="lg:col-span-7 space-y-6">
              <div className="border-l-2 border-civic-blue pl-4 space-y-1">
                <h3 className="text-lg font-bold text-ink-primary">Zero technical or administrative jargon</h3>
                <p className="text-sm text-ink-secondary">
                  Citizens do not need to know whether an issue belongs to Works Dept, WATCO, or BMC. The multimodal engine classifies category, extracts intent, and maps jurisdiction automatically.
                </p>
              </div>

              <div className="border-l-2 border-ink-border pl-4 space-y-1">
                <h3 className="text-lg font-bold text-ink-primary">Language sovereignty</h3>
                <p className="text-sm text-ink-secondary">
                  Citizens speak or type in Odia, Hindi, or English. Gemini multimodal models transcribe, translate, and standardize the signal preserving nuance and urgency.
                </p>
              </div>

              <div className="border-l-2 border-ink-border pl-4 space-y-1">
                <h3 className="text-lg font-bold text-ink-primary">Transparent collective tracking</h3>
                <p className="text-sm text-ink-secondary">
                  Instead of a dead-end ticket number, citizens see their report join the neighborhood cluster, follow live municipal actions, and confirm when the problem is solved.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. PROBLEM INTELLIGENCE (CLUSTERING & IMPACT)                 */}
      {/* ------------------------------------------------------------- */}
      <section id="problem-intelligence" className="py-24 border-b border-ink-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <div className="text-xs font-mono uppercase tracking-wider font-semibold text-civic-blue mb-2">
              Problem Intelligence
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary mb-4">
              327 complaints are not 327 separate tasks.
            </h2>
            <p className="text-base text-ink-secondary">
              Municipalities are paralyzed by duplicate tickets. CivicPulse groups signals into a single live problem cluster with deterministic impact scoring.
            </p>
          </div>

          {/* Impact Formula Visual */}
          <div className="rounded-xl border border-ink-border bg-canvas p-6 lg:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-ink-border gap-4">
              <div>
                <h3 className="text-lg font-bold text-ink-primary">The Deterministic Public Impact Formula</h3>
                <p className="text-xs text-ink-secondary">Auditable 0–100 rating based on Section 6.2 of the CivicPulse Specification</p>
              </div>
              <div className="px-3 py-1 rounded bg-white border border-ink-border text-xs font-mono text-ink-secondary">
                Range: 0 (Minor) → 100 (Disaster)
              </div>
            </div>

            {/* Formula Breakdown Cards - 7 Authoritative Factors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-white border border-ink-border space-y-2 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-civic-blue">25% Weight</span>
                  <AlertTriangle className="w-4 h-4 text-ink-tertiary" />
                </div>
                <div className="text-sm font-semibold text-ink-primary">Severity & Urgency</div>
                <p className="text-xs text-ink-secondary">Physical hazard classification, health risk, structural hazard, and escalation velocity.</p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-ink-border space-y-2 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-civic-blue">20% Weight</span>
                  <Users className="w-4 h-4 text-ink-tertiary" />
                </div>
                <div className="text-sm font-semibold text-ink-primary">Population Affected</div>
                <p className="text-xs text-ink-secondary">Signal density, residential census demographics, and estimated neighborhood exposure.</p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-ink-border space-y-2 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-civic-blue">15% Weight</span>
                  <Clock className="w-4 h-4 text-ink-tertiary" />
                </div>
                <div className="text-sm font-semibold text-ink-primary">Duration</div>
                <p className="text-xs text-ink-secondary">Elapsed hours unresolved against departmental SLA benchmarks and decay velocity.</p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-ink-border space-y-2 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-civic-blue">15% Weight</span>
                  <MapPin className="w-4 h-4 text-ink-tertiary" />
                </div>
                <div className="text-sm font-semibold text-ink-primary">Complaint Concentration</div>
                <p className="text-xs text-ink-secondary">Spatial report density, geographic cluster centroid concentration, and localized clustering.</p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-ink-border space-y-2 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-civic-blue">10% Weight</span>
                  <Building2 className="w-4 h-4 text-ink-tertiary" />
                </div>
                <div className="text-sm font-semibold text-ink-primary">Critical Facility Exposure</div>
                <p className="text-xs text-ink-secondary">Proximity to hospitals, primary schools, transit corridors, and drinking water sources.</p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-ink-border space-y-2 shadow-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-civic-blue">10% Weight</span>
                  <RotateCcw className="w-4 h-4 text-ink-tertiary" />
                </div>
                <div className="text-sm font-semibold text-ink-primary">Recurrence</div>
                <p className="text-xs text-ink-secondary">Historical failure frequency at the exact GIS coordinates and chronic infrastructure vulnerability.</p>
              </div>

              <div className="p-4 rounded-lg bg-white border border-ink-border space-y-2 shadow-subtle sm:col-span-2 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-civic-blue">5% Weight</span>
                  <ShieldCheck className="w-4 h-4 text-ink-tertiary" />
                </div>
                <div className="text-sm font-semibold text-ink-primary">Evidence Confidence</div>
                <p className="text-xs text-ink-secondary">Multimodal corroboration quality, verified media signals, and GPS telemetry precision.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. GOVERNMENT INTELLIGENCE (COMMAND CENTER)                   */}
      {/* ------------------------------------------------------------- */}
      <section id="government-intelligence" className="py-24 border-b border-ink-border bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-mono uppercase tracking-wider font-semibold text-civic-blue mb-2">
              Government Intelligence
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary mb-4">
              Answers the five questions every commissioner needs.
            </h2>
            <p className="text-base text-ink-secondary">
              Not a collection of 20 random charts. An operational workspace structured around clear decision-making.
            </p>
          </div>

          {/* 5 Questions Editorial Layout */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-12">
            <div className="p-4 rounded-lg bg-white border border-ink-border space-y-1 shadow-subtle">
              <span className="text-xs font-mono text-civic-rose font-bold">01</span>
              <h4 className="text-sm font-bold text-ink-primary">What needs attention?</h4>
              <p className="text-xs text-ink-secondary">Dynamic priority queue sorted by impact score, not arrival time.</p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-ink-border space-y-1 shadow-subtle">
              <span className="text-xs font-mono text-civic-amber font-bold">02</span>
              <h4 className="text-sm font-bold text-ink-primary">Why does it matter?</h4>
              <p className="text-xs text-ink-secondary">Direct correlation with schools, clinics, elderly populations, and transit corridors.</p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-ink-border space-y-1 shadow-subtle">
              <span className="text-xs font-mono text-civic-blue font-bold">03</span>
              <h4 className="text-sm font-bold text-ink-primary">Where is it happening?</h4>
              <p className="text-xs text-ink-secondary">GIS map workspace with ward boundaries, pipeline telemetry, and road overlays.</p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-ink-border space-y-1 shadow-subtle">
              <span className="text-xs font-mono text-civic-emerald font-bold">04</span>
              <h4 className="text-sm font-bold text-ink-primary">What is being done?</h4>
              <p className="text-xs text-ink-secondary">Cross-department work orders, crew dispatch tracking, and SLA countdowns.</p>
            </div>

            <div className="p-4 rounded-lg bg-white border border-ink-border space-y-1 shadow-subtle">
              <span className="text-xs font-mono text-ink-primary font-bold">05</span>
              <h4 className="text-sm font-bold text-ink-primary">What changed?</h4>
              <p className="text-xs text-ink-secondary">Citizen sentiment velocity, volume drops, and post-resolution evidence audit.</p>
            </div>
          </div>

          {/* Command Workspace Snapshot Preview */}
          <div className="rounded-xl border border-ink-border bg-white shadow-elevated p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-ink-border gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-ink-primary">City Operations Command</span>
                <span className="px-2 py-0.5 rounded bg-canvas-subtle text-xs font-mono text-ink-secondary">198 Wards Monitored</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-ink-secondary">
                <span>Active Problems: <strong className="text-ink-primary">14</strong></span>
                <span>•</span>
                <span>Avg Impact: <strong className="text-civic-amber">64.2</strong></span>
              </div>
            </div>

            {/* Table Mockup */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-ink-border text-ink-secondary font-mono">
                    <th className="pb-3 font-medium">PROBLEM CLUSTER</th>
                    <th className="pb-3 font-medium">WARD</th>
                    <th className="pb-3 font-medium">IMPACT</th>
                    <th className="pb-3 font-medium">SIGNALS</th>
                    <th className="pb-3 font-medium">ASSIGNED DEPT</th>
                    <th className="pb-3 font-medium">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-border/60">
                  <tr className="hover:bg-canvas-subtle/60 transition-colors">
                    <td className="py-3 font-semibold text-ink-primary">Water Supply Disruption — Nayapalli Ward 18</td>
                    <td className="py-3 font-mono">Ward 18 (Nayapalli, Bhubaneswar)</td>
                    <td className="py-3 font-mono font-bold text-civic-rose">92 / 100</td>
                    <td className="py-3 font-mono">327 reports</td>
                    <td className="py-3">Water Corporation (WATCO)</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full bg-civic-amberLight text-civic-amber font-medium">Dispatched</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-canvas-subtle/60 transition-colors">
                    <td className="py-3 font-semibold text-ink-primary">Feeder Line Tripping & Transformer Sparking</td>
                    <td className="py-3 font-mono">Ward 04 (Saheed Nagar)</td>
                    <td className="py-3 font-mono font-bold text-civic-rose">86 / 100</td>
                    <td className="py-3 font-mono">184 reports</td>
                    <td className="py-3">Power Distribution (TPCODL)</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full bg-civic-blueLight text-civic-blueDark font-medium">Investigating</span>
                    </td>
                  </tr>
                  <tr className="hover:bg-canvas-subtle/60 transition-colors">
                    <td className="py-3 font-semibold text-ink-primary">Arterial Road Cavity & Sewer Collapse</td>
                    <td className="py-3 font-mono">Ward 22 (Patia)</td>
                    <td className="py-3 font-mono font-bold text-civic-amber">74 / 100</td>
                    <td className="py-3 font-mono">92 reports</td>
                    <td className="py-3">Municipal Corporation (BMC)</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full bg-canvas-subtle text-ink-secondary font-medium">Triage</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. RESOLUTION VERIFICATION                                    */}
      {/* ------------------------------------------------------------- */}
      <section id="resolution-verification" className="py-24 border-b border-ink-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <div className="text-xs font-mono uppercase tracking-wider font-semibold text-civic-blue mb-2">
              Resolution Verification
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary mb-4">
              Closing a ticket is not solving a problem.
            </h2>
            <p className="text-base text-ink-secondary">
              CivicPulse enforces AI-assisted multi-factor verification before any public issue can be marked resolved.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Before / After Evidence Panel */}
            <div className="lg:col-span-7 bg-canvas rounded-xl border border-ink-border p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-ink-border pb-4">
                <div>
                  <div className="text-xs font-mono text-ink-secondary">INCIDENT RESOLUTION AUDIT</div>
                  <div className="text-base font-bold text-ink-primary">Pipeline Repair & Road Restoration</div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-civic-emeraldLight text-civic-emerald text-xs font-bold font-mono">
                  <ShieldCheck className="w-4 h-4" />
                  <span>91% VERIFIED</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-ink-secondary">
                    <span>BEFORE (CITIZEN SIGNAL)</span>
                    <span className="text-civic-rose font-semibold">Flooded</span>
                  </div>
                  <div className="aspect-[4/3] rounded-lg bg-ink-primary/5 border border-ink-border flex flex-col items-center justify-center p-4 text-center">
                    <Camera className="w-8 h-8 text-ink-tertiary mb-2" />
                    <span className="text-xs text-ink-secondary font-medium">Citizen Photo Evidence</span>
                    <span className="text-[10px] text-ink-tertiary font-mono">GPS: 20.2961° N, 85.8245° E</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-ink-secondary">
                    <span>AFTER (OFFICER SUBMISSION)</span>
                    <span className="text-civic-emerald font-semibold">Repaired</span>
                  </div>
                  <div className="aspect-[4/3] rounded-lg bg-ink-primary/5 border border-ink-border flex flex-col items-center justify-center p-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-civic-emerald mb-2" />
                    <span className="text-xs text-ink-secondary font-medium">Field Officer Evidence</span>
                    <span className="text-[10px] text-ink-tertiary font-mono">GPS Match: 8.4m radius (Validated)</span>
                  </div>
                </div>
              </div>

              {/* Verification Checklist */}
              <div className="space-y-2 pt-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded bg-white border border-ink-border">
                  <span className="flex items-center gap-2 text-ink-primary font-medium">
                    <Check className="w-4 h-4 text-civic-emerald" />
                    Camera EXIF & Geofence Confirmation
                  </span>
                  <span className="font-mono text-civic-emerald font-bold">100% Match</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded bg-white border border-ink-border">
                  <span className="flex items-center gap-2 text-ink-primary font-medium">
                    <Check className="w-4 h-4 text-civic-emerald" />
                    Multimodal Vision Repair Analysis
                  </span>
                  <span className="font-mono text-civic-emerald font-bold">92% Confidence</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded bg-white border border-ink-border">
                  <span className="flex items-center gap-2 text-ink-primary font-medium">
                    <Check className="w-4 h-4 text-civic-emerald" />
                    Citizen Re-confirmation Pulse
                  </span>
                  <span className="font-mono text-civic-emerald font-bold">88% Confirmed</span>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-ink-primary">No more phantom ticket closures</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  In conventional systems, contractors or field workers can close grievances with generic comments.
                  CivicPulse requires tamper-proof photo verification, timestamp validation, and citizen re-contact before the impact score drops to zero.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-ink-primary">Multi-modal AI as an impartial inspector</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">
                  The model compares structural features of the initial report against the completion submission to detect fake closures, old images, or unrelated repairs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. GOVERNANCE AI (ANALYTICAL WORKSPACE)                        */}
      {/* ------------------------------------------------------------- */}
      <section id="governance-ai" className="py-24 border-b border-ink-border bg-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-16">
            <div className="text-xs font-mono uppercase tracking-wider font-semibold text-civic-blue mb-2">
              Governance AI Workspace
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary mb-4">
              Grounded analytical intelligence, not an avatar chatbot.
            </h2>
            <p className="text-base text-ink-secondary">
              Query municipal trends, infrastructure failures, and resource allocations with strict citations and auditable metrics.
            </p>
          </div>

          {/* Research Workspace Mockup */}
          <div className="max-w-4xl mx-auto bg-white rounded-xl border border-ink-border shadow-elevated p-6 sm:p-8 space-y-6">
            {/* Search Input */}
            <div className="space-y-2">
              <div className="text-xs font-mono text-ink-secondary uppercase">Analytical Query</div>
              <div className="p-4 rounded-lg bg-canvas border border-ink-border flex items-center gap-3 text-sm text-ink-primary font-medium">
                <span className="text-civic-blue font-mono font-bold">Q:</span>
                <span>Which wards have the highest unresolved water supply impact this week?</span>
              </div>
            </div>

            {/* Answer Box */}
            <div className="space-y-4 pt-2">
              <div className="text-xs font-mono text-ink-secondary uppercase flex items-center justify-between">
                <span>Grounded Synthesized Answer</span>
                <span className="text-civic-emerald font-semibold">100% Sourced from Live PostgreSQL (Supabase)</span>
              </div>

              <div className="text-sm text-ink-primary leading-relaxed space-y-3 bg-canvas-subtle/50 p-5 rounded-lg border border-ink-border">
                <p>
                  <strong>Ward 18 (Nayapalli, Bhubaneswar)</strong> currently accounts for <strong>61% of all active water disruption impact</strong> in the municipal division.
                  The primary driver is an ongoing transmission line rupture on Nayapalli VIP Road affecting approximately <strong>18,400 residents</strong> and DAV Public School.
                </p>
                <p>
                  The secondary concentration is in <strong>Ward 22 (Patia)</strong> with 3 localized low-pressure pipe failures affecting 2,800 residents.
                </p>
              </div>

              {/* Citations & Evidence Pill Links */}
              <div className="space-y-2">
                <div className="text-xs font-mono text-ink-tertiary">Verified Citations:</div>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded bg-canvas border border-ink-border text-ink-secondary hover:border-civic-blue transition-colors cursor-pointer">
                    [1] Verified Municipal Problem Dossier
                  </span>
                  <span className="px-2.5 py-1 rounded bg-canvas border border-ink-border text-ink-secondary hover:border-civic-blue transition-colors cursor-pointer">
                    [2] Correlated Signal Cluster Records
                  </span>
                  <span className="px-2.5 py-1 rounded bg-canvas border border-ink-border text-ink-secondary hover:border-civic-blue transition-colors cursor-pointer">
                    [3] Official Department Work Order
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. IMPACT METRICS                                             */}
      {/* ------------------------------------------------------------- */}
      <section className="py-20 border-b border-ink-border bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-ink-primary">84%</div>
              <div className="text-xs sm:text-sm text-ink-secondary font-medium">Reduction in Duplicate Triage</div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-civic-blue">3.2x</div>
              <div className="text-xs sm:text-sm text-ink-secondary font-medium">Faster Critical Incident Identification</div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-civic-emerald">91%</div>
              <div className="text-xs sm:text-sm text-ink-secondary font-medium">Multi-Factor Verification Accuracy</div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-extrabold text-ink-primary">0–100</div>
              <div className="text-xs sm:text-sm text-ink-secondary font-medium">Deterministic Public Impact Scale</div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 9. FINAL CTA                                                  */}
      {/* ------------------------------------------------------------- */}
      <section className="py-24 bg-canvas text-center border-b border-ink-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-primary">
            Ready to transform citizen signals into verified public action?
          </h2>
          <p className="text-base text-ink-secondary max-w-xl mx-auto">
            Experience the full DPI intelligence lifecycle with the deterministic Bhubaneswar Ward 18 Scenario and live API endpoints.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <a
              href="/api/v1/health"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white bg-civic-blue hover:bg-civic-blueDark shadow-subtle transition-all text-sm"
            >
              <span>Test Backend API Probe</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-ink-primary bg-white hover:bg-canvas-subtle border border-ink-border shadow-subtle transition-all text-sm"
            >
              <span>Documentation & Standards</span>
              <ExternalLink className="w-4 h-4 text-ink-tertiary" />
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 10. FOOTER                                                    */}
      {/* ------------------------------------------------------------- */}
      <footer className="py-12 bg-white text-xs text-ink-secondary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-ink-primary flex items-center justify-center text-white font-bold text-xs">
              CP
            </div>
            <span className="font-semibold text-ink-primary">CivicPulse AI</span>
            <span className="text-ink-tertiary">|</span>
            <span>Digital Public Infrastructure for Governance</span>
          </div>

          <div className="flex items-center gap-6 text-ink-secondary">
            <span>DPDP Act Compliant (Client-side PII Redaction)</span>
            <span>•</span>
            <span>Open API Architecture</span>
            <span>•</span>
            <span className="font-mono text-ink-tertiary">v1.0.0 (Phase 1 DPI Layer)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
