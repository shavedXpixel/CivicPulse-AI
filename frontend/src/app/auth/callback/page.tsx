'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '../../../lib/supabase-client';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../context/AuthContext';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { UserProfile } from '@civicpulse/shared';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();

  const [status, setStatus] = useState<'verifying' | 'provisioning' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function handleAuthCallback() {
      // 1. Clean URL immediately to never expose hash tokens or code in browser bar
      if (typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch {
          // Ignore history state errors in restricted contexts
        }
      }

      // Check if URL originally had error params
      const urlError = searchParams.get('error') || searchParams.get('error_code');
      const urlErrorDesc = searchParams.get('error_description');
      if (urlError) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(urlErrorDesc || `Authentication confirmation error (${urlError}). The link may have expired or is invalid.`);
        }
        return;
      }

      const client = getSupabaseClient();
      if (!client) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage('Supabase client is not configured in this environment.');
        }
        return;
      }

      try {
        // Exchange code if PKCE code parameter was passed
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (isMounted) {
              setStatus('error');
              setErrorMessage(exchangeError.message || 'Failed to exchange confirmation code.');
            }
            return;
          }
        }

        // Obtain active session
        const { data: sessionData, error: sessionError } = await client.auth.getSession();
        if (sessionError || !sessionData.session) {
          if (isMounted) {
            setStatus('error');
            setErrorMessage(sessionError?.message || 'No active session found. The confirmation link may have expired or already been used.');
          }
          return;
        }

        const session = sessionData.session;
        if (isMounted) {
          setStatus('provisioning');
        }

        // Authoritative explicit citizen provisioning
        const displayName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Citizen';
        const res = await apiClient.post<{ data: { user: UserProfile } }>(
          '/api/v1/auth/register-citizen',
          { display_name: displayName },
          { Authorization: `Bearer ${session.access_token}` }
        );

        if (!res?.data?.user) {
          throw new Error('Authoritative citizen registration failed: No user profile returned.');
        }

        await refreshProfile();

        if (isMounted) {
          setStatus('success');
          setTimeout(() => {
            router.push('/citizen');
          }, 800);
        }
      } catch (err: any) {
        if (isMounted) {
          setStatus('error');
          setErrorMessage(err.message || 'Failed to complete authoritative citizen account provisioning.');
        }
      }
    }

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [searchParams, router, refreshProfile]);

  return (
    <div className="bg-white p-8 rounded-2xl border border-ink-border shadow-card max-w-md w-full text-center space-y-6">
      {status === 'verifying' && (
        <div className="space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-civic-blue mx-auto" />
          <h2 className="text-base font-bold text-ink-primary">Confirming Identity</h2>
          <p className="text-xs text-ink-secondary">Verifying your email confirmation credentials...</p>
        </div>
      )}

      {status === 'provisioning' && (
        <div className="space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-civic-emerald mx-auto" />
          <h2 className="text-base font-bold text-ink-primary">Activating Citizen Account</h2>
          <p className="text-xs text-ink-secondary">Provisioning municipal public intake credentials...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-subtle">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-ink-primary">Account Activated</h2>
          <p className="text-xs text-ink-secondary">Redirecting to citizen dashboard...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-ink-primary">Confirmation Failed</h2>
            <p className="text-xs text-rose-800 leading-relaxed bg-rose-50 border border-rose-200 p-3 rounded-lg">
              {errorMessage || 'Your confirmation link could not be verified or has expired.'}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark transition-colors shadow-subtle w-full"
            >
              <span>Return to Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="bg-white p-8 rounded-2xl border border-ink-border shadow-card max-w-md w-full text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-civic-blue mx-auto" />
            <p className="text-xs text-ink-secondary">Loading authentication callback...</p>
          </div>
        }
      >
        <CallbackContent />
      </Suspense>
    </div>
  );
}
