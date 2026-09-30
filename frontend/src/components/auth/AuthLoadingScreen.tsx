'use client';

import React from 'react';
import { Shield, Clock, RotateCcw, LogOut } from 'lucide-react';

export interface AuthLoadingScreenProps {
  isTimedOut?: boolean;
  onRetry?: () => void;
  onSignOut?: () => void;
}

export function AuthLoadingScreen({
  isTimedOut = false,
  onRetry,
  onSignOut
}: AuthLoadingScreenProps) {
  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 font-sans selection:bg-civic-terracotta/20 selection:text-civic-terracottaDark">
      <div className="w-full max-w-md bg-canvas-card border border-ink-border rounded-sm shadow-sm p-6 sm:p-8 space-y-6 text-center">
        {/* Editorial Subheadings */}
        <div className="space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-widest text-ink-tertiary block font-semibold">
            CIVICPULSE
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-secondary block font-medium">
            PUBLIC SERVICE AUTHENTICATION
          </span>
        </div>

        <div className="h-px w-full bg-ink-border/60" />

        {!isTimedOut ? (
          /* Normal Authentication Loading State */
          <div className="space-y-5">
            {/* Subtle spinner / shield visual */}
            <div
              className="relative w-12 h-12 mx-auto flex items-center justify-center my-1"
              role="status"
              aria-label="Authenticating CivicPulse account"
            >
              <div className="w-11 h-11 rounded-full border-2 border-civic-terracotta/20 border-t-civic-terracotta animate-spin" />
              <Shield className="w-4 h-4 text-civic-terracotta absolute" />
              <span className="sr-only">Verifying CivicPulse account...</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary font-serif">
              AUTHENTICATING
            </h1>

            <div className="space-y-1 text-xs sm:text-sm text-ink-secondary leading-relaxed font-sans">
              <p>Verifying your CivicPulse account...</p>
              <p>Connecting to CivicPulse services...</p>
            </div>

            {/* Subtle progress animation */}
            <div className="pt-2 px-6">
              <div className="w-full bg-canvas-subtle rounded-full h-1 overflow-hidden border border-ink-border/40">
                <div className="bg-civic-terracotta h-full w-2/3 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full" />
              </div>
            </div>
          </div>
        ) : (
          /* Generic Connection Failure State after retry window is exhausted */
          <div className="space-y-5">
            <div className="w-10 h-10 rounded-sm bg-amber-50 text-amber-900 mx-auto flex items-center justify-center border border-amber-200">
              <Clock className="w-5 h-5 text-civic-terracotta" />
            </div>

            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-ink-primary">
              Unable to connect to CivicPulse services.
            </h1>

            <p className="text-xs text-ink-secondary leading-relaxed font-sans">
              The service is taking longer than expected to respond. Your authenticated session is preserved.
              You may try reconnecting or sign out.
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
                onClick={onSignOut}
                className="w-full sm:w-auto px-4 py-2 rounded-sm text-xs font-semibold bg-canvas-card border border-ink-border text-ink-primary hover:bg-canvas-subtle transition-colors flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5 text-ink-tertiary" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
