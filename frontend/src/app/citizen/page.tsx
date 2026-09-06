import React from 'react';
import Link from 'next/link';
import { CitizenShell } from '../../components/shells/CitizenShell';
import { Mic, Camera, FileText, ArrowRight, CheckCircle2, Clock, MapPin } from 'lucide-react';

export default function CitizenHomePage() {
  return (
    <CitizenShell>
      <div className="space-y-8">
        {/* Welcome & Prompt */}
        <div className="space-y-2 text-left">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-civic-blueLight text-civic-blueDark">
            <MapPin className="w-3.5 h-3.5" />
            <span>Ward 18 • Indiranagar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary">
            Report a problem in your neighborhood
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary">
            No department codes or forms required. Speak, take a photo, or write in plain language.
          </p>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/citizen/report?mode=voice"
            className="flex items-center sm:flex-col justify-start sm:justify-center p-4 rounded-xl border border-ink-border bg-white shadow-card hover:border-civic-blue hover:bg-civic-blueLight/20 transition-all gap-3 text-left sm:text-center"
          >
            <div className="w-10 h-10 rounded-full bg-civic-blueLight flex items-center justify-center text-civic-blue">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-primary">Speak in your language</div>
              <div className="text-[11px] text-ink-secondary">Kannada, Hindi, English, etc.</div>
            </div>
          </Link>

          <Link
            href="/citizen/report?mode=photo"
            className="flex items-center sm:flex-col justify-start sm:justify-center p-4 rounded-xl border border-ink-border bg-white shadow-card hover:border-civic-blue hover:bg-civic-blueLight/20 transition-all gap-3 text-left sm:text-center"
          >
            <div className="w-10 h-10 rounded-full bg-civic-blueLight flex items-center justify-center text-civic-blue">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-primary">Take a photo</div>
              <div className="text-[11px] text-ink-secondary">AI detects category & severity</div>
            </div>
          </Link>

          <Link
            href="/citizen/report?mode=text"
            className="flex items-center sm:flex-col justify-start sm:justify-center p-4 rounded-xl border border-ink-border bg-white shadow-card hover:border-civic-blue hover:bg-civic-blueLight/20 transition-all gap-3 text-left sm:text-center"
          >
            <div className="w-10 h-10 rounded-full bg-civic-blueLight flex items-center justify-center text-civic-blue">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-ink-primary">Type description</div>
              <div className="text-[11px] text-ink-secondary">Simple message or WhatsApp text</div>
            </div>
          </Link>
        </div>

        {/* Neighborhood Status Card */}
        <div className="p-5 rounded-xl border border-ink-border bg-white shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-secondary">
              Active Community Incident
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-civic-amberLight text-amber-900">
              Dispatched
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-ink-primary">
              Water supply disruption on 4th Cross
            </h3>
            <p className="text-xs text-ink-secondary leading-relaxed">
              327 neighboring residents have reported this issue. BWSSB repair crew is on-site replacing Valve 4B.
            </p>
          </div>

          <div className="pt-2 border-t border-ink-border/60 flex items-center justify-between text-xs font-medium text-civic-blue">
            <span className="text-ink-tertiary font-mono text-[11px]">Est. water restored: ~3 hours</span>
            <Link href="/citizen/issues" className="hover:underline flex items-center gap-1">
              <span>View details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Recent Citizen Reports */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-primary">Your recent reports</h2>
            <Link href="/citizen/issues" className="text-xs font-semibold text-civic-blue hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-2">
            <div className="p-4 rounded-xl border border-ink-border bg-white shadow-card flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink-primary">Water leak outside gate</span>
                  <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-civic-amberLight text-amber-900">
                    In Progress
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-ink-tertiary">
                  <Clock className="w-3 h-3" />
                  <span>Reported yesterday • Ref #CP-10482</span>
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-civic-emerald" />
            </div>
          </div>
        </div>
      </div>
    </CitizenShell>
  );
}
