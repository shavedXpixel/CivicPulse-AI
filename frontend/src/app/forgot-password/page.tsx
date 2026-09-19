'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2, Shield } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFormError('Please enter your email address.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client is not configured in this environment.');
      }

      const redirectTo = `${window.location.origin}/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      // To prevent email enumeration, do not reveal user existence errors
      if (error) {
        // If it's a rate limit or network error, inform the user generically without exposing account existence
        if (error.message?.toLowerCase().includes('rate limit') || error.status === 429) {
          setFormError('Too many password reset requests. Please wait a few moments before trying again.');
          setSubmitting(false);
          return;
        }
        // Log client debug info silently in development
        console.warn('Password reset request completed with status:', error.message);
      }

      // Always show identical success state to prevent account discovery
      setSubmitted(true);
    } catch (err: any) {
      if (err.message?.includes('Supabase client is not configured')) {
        setFormError(err.message);
      } else {
        // For standard errors, preserve security by showing the uniform confirmation
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-sm bg-ink-primary flex items-center justify-center text-canvas-card font-mono font-bold text-xs tracking-wider">
            CP
          </div>
          <span className="font-bold text-lg tracking-tight text-ink-primary">
            CivicPulse
          </span>
        </Link>
        <div className="text-[10px] font-mono uppercase tracking-widest text-civic-terracotta font-semibold">
          Account Security & Access
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
          Password Recovery
        </h1>
        <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
          Municipal operators, field officers, and citizens can securely reset their credentials using their verified account email.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-canvas-card border border-ink-border shadow-card rounded-sm p-6 sm:p-8 space-y-6">
          {submitted ? (
            <div className="space-y-5">
              <div className="p-4 rounded-sm bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Recovery Link Dispatched</span>
                </div>
                <p className="leading-relaxed text-emerald-800">
                  If an account exists for this email, a password reset link has been sent.
                </p>
                <p className="text-[11px] text-emerald-700 leading-relaxed pt-1">
                  Please check your inbox (and spam folder) for instructions to update your password. The link will remain valid for a limited time.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full py-2.5 px-4 rounded-sm text-xs font-mono font-semibold bg-canvas-card border border-ink-border text-ink-primary hover:bg-canvas-subtle transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-ink-tertiary" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-sm bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-widest font-semibold text-ink-secondary">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@civicpulse.local or citizen@example.com"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-sm border border-ink-border bg-canvas-subtle/50 focus:bg-canvas-card focus:outline-none focus:border-civic-terracotta transition-colors text-ink-primary font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-sm text-xs font-mono font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-2 disabled:opacity-60 uppercase tracking-wider"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Recovery Link...</span>
                  </>
                ) : (
                  <span>Send reset link</span>
                )}
              </button>

              <div className="pt-2 border-t border-ink-border/50 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-mono transition-colors"
                >
                  <ArrowLeft className="w-3 h-3 text-ink-tertiary" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-ink-border/50 flex items-center justify-between text-[11px] text-ink-tertiary font-mono">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-civic-terracotta" />
              <span>Identity Verification</span>
            </div>
            <span>End-to-End Cryptographic Protection</span>
          </div>
        </div>
      </div>
    </div>
  );
}
