import React from 'react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0B0F17] text-gray-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle radial glow background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl w-full text-center relative z-10 space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-surface-100 border border-gray-800 text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>PHASE 0: FOUNDATION ACTIVE</span>
        </div>

        {/* Title & Tagline */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            CivicPulse AI
          </h1>
          <p className="text-lg sm:text-xl text-amber-400/90 font-medium">
            Citizen Signals → Government Intelligence → Public Action
          </p>
          <p className="text-sm text-gray-400 max-w-xl mx-auto">
            AI-powered public-problem intelligence layer for Digital Public Infrastructure (DPI) and governance.
          </p>
        </div>

        {/* System Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="glass-panel p-5 rounded-xl border border-gray-800 bg-[#111827]/80 hover:border-gray-700 transition-all">
            <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider mb-2">Package 01</div>
            <h3 className="text-base font-semibold text-white mb-1">@civicpulse/shared</h3>
            <p className="text-xs text-gray-400">
              Deterministic types, Zod schemas, impact constants, and error codes.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-gray-800 bg-[#111827]/80 hover:border-gray-700 transition-all">
            <div className="text-xs font-mono text-blue-400 uppercase tracking-wider mb-2">Package 02</div>
            <h3 className="text-base font-semibold text-white mb-1">Backend API</h3>
            <p className="text-xs text-gray-400">
              Modular monolith with Express, provider abstraction, and health probes.
            </p>
          </div>

          <div className="glass-panel p-5 rounded-xl border border-gray-800 bg-[#111827]/80 hover:border-gray-700 transition-all">
            <div className="text-xs font-mono text-amber-400 uppercase tracking-wider mb-2">Package 03</div>
            <h3 className="text-base font-semibold text-white mb-1">Next.js Frontend</h3>
            <p className="text-xs text-gray-400">
              Responsive App Router, Tailwind design system, and reverse-proxy routing.
            </p>
          </div>
        </div>

        {/* Foundation Status Footer */}
        <div className="pt-4 border-t border-gray-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Architecture:</span>
            <span className="text-gray-300">Modular Monolith</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Mode:</span>
            <span className="text-emerald-400">DEMO_MODE Ready</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Health Probe:</span>
            <a
              href="/api/v1/health"
              className="text-cyan-400 hover:underline hover:text-cyan-300 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              /api/v1/health →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
