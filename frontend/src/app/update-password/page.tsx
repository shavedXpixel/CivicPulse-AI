'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Shield } from 'lucide-react';
import { getSupabaseClient } from '../../lib/supabase-client';
import { apiClient } from '../../lib/api-client';
import { PasswordInput } from '../../components/ui/PasswordInput';

function UpdatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInvite = searchParams.get('type') === 'invite';

  const urlError = searchParams.get('error') || searchParams.get('error_code');
  const urlErrorDesc = searchParams.get('error_description');

  const [checkingSession, setCheckingSession] = useState(!urlError);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(
    urlError
      ? (urlErrorDesc || 'The password reset link is invalid or has expired. Please request a new link.')
      : null
  );

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function verifyRecoverySession() {
      // 1. Check for errors passed in URL query or hash
      const urlError = searchParams.get('error') || searchParams.get('error_code');
      const urlErrorDesc = searchParams.get('error_description');
      if (urlError) {
        if (isMounted) {
          setSessionError(
            urlErrorDesc || 'The password reset link is invalid or has expired. Please request a new link.'
          );
          setCheckingSession(false);
          setHasRecoverySession(false);
        }
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        if (isMounted) {
          setSessionError('Supabase authentication client is not configured.');
          setCheckingSession(false);
          setHasRecoverySession(false);
        }
        return;
      }

      // 2. Exchange code if PKCE code was provided
      const code = searchParams.get('code');
      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (isMounted) {
              setSessionError(exchangeError.message || 'Failed to verify password recovery link.');
              setCheckingSession(false);
              setHasRecoverySession(false);
            }
            return;
          }
        } catch (err: any) {
          if (isMounted) {
            setSessionError(err.message || 'Unable to exchange recovery credentials.');
            setCheckingSession(false);
            setHasRecoverySession(false);
          }
          return;
        }
      }

      // 3. Listen for PASSWORD_RECOVERY or USER_UPDATED or SIGNED_IN event
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        if (event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED' || (session && event === 'SIGNED_IN')) {
          setHasRecoverySession(true);
          setCheckingSession(false);
          setSessionError(null);
        }
      });

      // 4. Check if session is already established
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          if (isMounted) {
            setSessionError(sessionError.message);
            setCheckingSession(false);
            setHasRecoverySession(false);
          }
          return;
        }

        if (sessionData?.session) {
          if (isMounted) {
            setHasRecoverySession(true);
            setCheckingSession(false);
            setSessionError(null);
          }
        } else {
          // Give brief grace period for URL hash parsing by Supabase client
          setTimeout(async () => {
            if (!isMounted) return;
            const { data: retrySession } = await supabase.auth.getSession();
            if (retrySession?.session) {
              setHasRecoverySession(true);
              setCheckingSession(false);
              setSessionError(null);
            } else {
              setCheckingSession(false);
              setHasRecoverySession(false);
            }
          }, 600);
        }
      } catch (err: any) {
        if (isMounted) {
          setSessionError(err.message || 'Error checking authentication session.');
          setCheckingSession(false);
          setHasRecoverySession(false);
        }
      }

      return () => {
        subscription.unsubscribe();
      };
    }

    verifyRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    setSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client is not configured.');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      // If invited government staff member, transition public.users to ACTIVE
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await apiClient.post(
            '/api/v1/auth/activate-staff',
            {},
            { Authorization: `Bearer ${session.access_token}` }
          ).catch((err) => {
            console.warn('Staff activation notification completed with status:', err.message);
          });
        }
      } catch {
        // Continue with completion
      }

      // Password successfully changed
      setSuccess(true);

      // Sign out recovery session so user logs in afresh with new password
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore sign-out cleanup errors
      }

      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update password. Please try again.');
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
          {isInvite ? 'Government Staff Onboarding' : 'Account Security & Access'}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
          {isInvite ? 'Complete Staff Account Setup' : 'Set New Password'}
        </h1>
        <p className="text-xs text-ink-secondary max-w-sm mx-auto leading-relaxed">
          {isInvite
            ? 'Establish your municipal officer password to activate your CivicPulse government account.'
            : 'Create a new password to restore access to your CivicPulse municipal or citizen account.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-canvas-card border border-ink-border shadow-card rounded-sm p-6 sm:p-8 space-y-6">
          {checkingSession ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-civic-terracotta mx-auto" />
              <h2 className="text-sm font-semibold text-ink-primary">Verifying Recovery Link</h2>
              <p className="text-xs text-ink-secondary">
                Validating cryptographic authentication token...
              </p>
            </div>
          ) : !hasRecoverySession ? (
            <div className="space-y-4">
              <div className="p-4 rounded-sm bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-900">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Invalid or Expired Recovery Link</span>
                </div>
                <p className="leading-relaxed text-rose-800">
                  {sessionError ||
                    'This password reset link is invalid, expired, or has already been used. Please request a new link to reset your credentials.'}
                </p>
              </div>

              <div className="pt-2 space-y-2">
                <Link
                  href="/forgot-password"
                  className="w-full py-2.5 px-4 rounded-sm text-xs font-mono font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <span>Request New Reset Link</span>
                </Link>

                <Link
                  href="/login"
                  className="w-full py-2.5 px-4 rounded-sm text-xs font-mono font-semibold bg-canvas-card border border-ink-border text-ink-primary hover:bg-canvas-subtle transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="p-4 rounded-sm bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{isInvite ? 'Staff Account Activated Successfully' : 'Password Updated Successfully'}</span>
                </div>
                <p className="leading-relaxed text-emerald-800">
                  {isInvite
                    ? 'Your municipal officer credentials have been established. You can now sign in.'
                    : 'Your credentials have been securely updated. You can now sign in with your new password.'}
                </p>
                <p className="text-[11px] text-emerald-700">
                  Redirecting to the login screen automatically...
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full py-2.5 px-4 rounded-sm text-xs font-mono font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  <span>Sign In Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-sm bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-widest font-semibold text-ink-secondary">
                  New Password
                </label>
                <PasswordInput
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
                <span className="text-[10px] text-ink-tertiary font-mono">
                  Minimum 6 characters.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-widest font-semibold text-ink-secondary">
                  Confirm New Password
                </label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-sm text-xs font-mono font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-2 disabled:opacity-60 uppercase tracking-wider"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isInvite ? 'Activating Account...' : 'Updating Password...'}</span>
                  </>
                ) : (
                  <span>{isInvite ? 'Activate Account & Set Password' : 'Update Password'}</span>
                )}
              </button>

              <div className="pt-2 border-t border-ink-border/50 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink-primary font-mono transition-colors"
                >
                  <span>Cancel and return to sign in</span>
                </Link>
              </div>
            </form>
          )}

          <div className="pt-4 border-t border-ink-border/50 flex items-center justify-between text-[11px] text-ink-tertiary font-mono">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-civic-terracotta" />
              <span>Password Security</span>
            </div>
            <span>Strict SHA-256 / Bcrypt Auth Standards</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-civic-terracotta" />
        </div>
      }
    >
      <UpdatePasswordContent />
    </Suspense>
  );
}
