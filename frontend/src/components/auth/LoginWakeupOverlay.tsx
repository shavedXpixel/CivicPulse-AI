'use client';

import React from 'react';
import { Shield, Clock, RotateCcw, Server, CheckCircle2 } from 'lucide-react';

export type LoginWakeupState = 'waking' | 'ready' | 'authenticating' | 'timeout';

export interface LoginWakeupOverlayProps {
  state: LoginWakeupState;
  onRetry: () => void;
  onCancel: () => void;
}

export function LoginWakeupOverlay({
  state,
  onRetry,
  onCancel
}: LoginWakeupOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-canvas/95 backdrop-blur-sm flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 font-sans selection:bg-civic-terracotta/20 selection:text-civic-terracottaDark animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
    >
      <div className="w-full max-w-md bg-canvas-card border border-ink-border rounded-sm shadow-xl p-6 sm:p-8 space-y-6 text-center">
        {/* CivicPulse Architectural Subheadings */}
        <div className="space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-ink-tertiary block font-semibold">
            CIVICPULSE
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary block font-medium">
            PUBLIC SERVICE AUTHENTICATION
          </span>
        </div>

        <div className="h-px w-full bg-ink-border/60" />

        {state === 'waking' && (
          <div className="space-y-5">
            {/* Subtle animated loader consistent with CivicPulse brand */}
            <div
              className="relative w-14 h-14 mx-auto flex items-center justify-center my-2"
              role="status"
              aria-label="Waking up CivicPulse server"
            >
              <div className="w-13 h-13 rounded-full border-2 border-civic-terracotta/20 border-t-civic-terracotta animate-spin" />
              <Server className="w-5 h-5 text-civic-terracotta absolute animate-pulse" />
              <span className="sr-only">Waking up CivicPulse...</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary font-serif">
              Waking up CivicPulse...
            </h1>

            <div className="space-y-1 text-xs sm:text-sm text-ink-secondary leading-relaxed font-sans">
              <p>Starting the CivicPulse server. This may take a few seconds.</p>
              <p className="text-[11px] text-ink-tertiary font-mono">
                Warming up cloud services...
              </p>
            </div>

            {/* Subtle progress animation */}
            <div className="pt-2 px-6">
              <div className="w-full bg-canvas-subtle rounded-full h-1 overflow-hidden border border-ink-border/40">
                <div className="bg-civic-terracotta h-full w-2/3 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full" />
              </div>
            </div>
          </div>
        )}

        {state === 'ready' && (
          <div className="space-y-5">
            <div
              className="relative w-14 h-14 mx-auto flex items-center justify-center my-2"
              role="status"
              aria-label="Server ready"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-600 animate-in zoom-in-75 duration-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary font-serif">
              Server ready
            </h1>

            <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed font-sans">
              Connecting to municipal services...
            </p>

            <div className="pt-2 px-6">
              <div className="w-full bg-canvas-subtle rounded-full h-1 overflow-hidden border border-ink-border/40">
                <div className="bg-emerald-600 h-full w-full rounded-full transition-all duration-300" />
              </div>
            </div>
          </div>
        )}

        {state === 'authenticating' && (
          <div className="space-y-5">
            <div
              className="relative w-14 h-14 mx-auto flex items-center justify-center my-2"
              role="status"
              aria-label="Signing you in"
            >
              <div className="w-13 h-13 rounded-full border-2 border-civic-terracotta/20 border-t-civic-terracotta animate-spin" />
              <Shield className="w-5 h-5 text-civic-terracotta absolute" />
              <span className="sr-only">Signing you in...</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary font-serif">
              Signing you in...
            </h1>

            <div className="space-y-1 text-xs sm:text-sm text-ink-secondary leading-relaxed font-sans">
              <p>Verifying credentials with CivicPulse Authority...</p>
              <p className="text-[11px] text-ink-tertiary font-mono">
                Resolving role-scoped workspace...
              </p>
            </div>

            <div className="pt-2 px-6">
              <div className="w-full bg-canvas-subtle rounded-full h-1 overflow-hidden border border-ink-border/40">
                <div className="bg-civic-terracotta h-full w-4/5 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full" />
              </div>
            </div>
          </div>
        )}

        {state === 'timeout' && (
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-sm bg-amber-50 text-amber-900 mx-auto flex items-center justify-center border border-amber-200 my-1">
              <Clock className="w-6 h-6 text-civic-terracotta" />
            </div>

            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-ink-primary">
              The CivicPulse server is taking longer than expected.
            </h1>

            <p className="text-xs text-ink-secondary leading-relaxed font-sans">
              The cloud backend may still be starting up or under heavy load. Your entered credentials have been preserved.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={onRetry}
                className="w-full sm:w-auto px-4 py-2 rounded-sm text-xs font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-1.5 shadow-none"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-4 py-2 rounded-sm text-xs font-semibold bg-canvas-card border border-ink-border text-ink-primary hover:bg-canvas-subtle transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Back to Login</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
