'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User,
  ArrowRight,
  Mail,
  AlertCircle,
  Loader2,
  LogOut,
  CheckCircle2,
  Clock,
  Shield
} from 'lucide-react';
import { UserRole } from '@civicpulse/shared';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { AuthLoadingScreen } from '../../components/auth/AuthLoadingScreen';
import { isBackendUnreachableError, determineRoleDestination } from '../../lib/auth-retry';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitRedirect = searchParams.get('redirect');
  const isSessionExpired = searchParams.get('session_expired') === 'true';

  const {
    user,
    userProfile,
    loading: authLoading,
    isConfigured,
    isResolvingProfile,
    isRetryTimeout,
    serverError,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    retryProfileResolution
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegistering, setIsRegistering] = useState(searchParams.get('tab') === 'register');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);

  const wasResolvingRef = useRef<boolean>(false);

  useEffect(() => {
    if (isResolvingProfile) {
      wasResolvingRef.current = true;
    }
  }, [isResolvingProfile]);

  useEffect(() => {
    if (userProfile?.role && wasResolvingRef.current) {
      wasResolvingRef.current = false;
      const destination = determineRoleDestination(userProfile.role, explicitRedirect);
      if (destination) {
        router.push(destination);
      }
    }
  }, [userProfile, explicitRedirect, router]);

  const determineDestination = (role?: string): string | null => {
    return determineRoleDestination(role, explicitRedirect);
  };

  const handleRealAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim() || !password.trim()) {
      setFormError('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    setConfirmationNotice(null);
    try {
      let resolvedRole: string | undefined;

      if (isRegistering) {
        const result = await signUp(email.trim(), password, fullName.trim() || undefined);
        if (result.confirmationRequired) {
          setConfirmationNotice(
            `Verification email sent to ${email.trim()}. Please check your inbox and click the confirmation link to complete account activation.`
          );
          setSubmitting(false);
          return;
        }
        resolvedRole = result.profile?.role || UserRole.CITIZEN;
      } else {
        const { profile } = await signIn(email.trim(), password);
        resolvedRole = profile?.role;
      }

      // If backend network failure occurred, signIn entered background retry with AUTHENTICATING screen
      if (!resolvedRole) {
        if (isResolvingProfile) {
          wasResolvingRef.current = true;
          setSubmitting(false);
          return;
        }

        try {
          const meRes = await apiClient.get<{ data: { user: { role: string } } }>('/api/v1/auth/me');
          resolvedRole = meRes?.data?.user?.role;
        } catch (meErr: any) {
          if (isBackendUnreachableError(meErr)) {
            wasResolvingRef.current = true;
            if (retryProfileResolution) {
              retryProfileResolution();
            }
            setSubmitting(false);
            return;
          }
          if (meErr?.status >= 500) {
            setFormError('CivicPulse server encountered an error while verifying profile. Please try again shortly.');
            setSubmitting(false);
            return;
          }
          console.warn('[CivicPulse Login] Authoritative profile resolution error');
        }
      }

      if (!resolvedRole) {
        if (!isResolvingProfile) {
          if (serverError) {
            setFormError(serverError);
          } else {
            setFormError('Unable to resolve account role. Profile authorization could not be verified by the backend. Please retry or contact municipal IT administration.');
          }
        }
        setSubmitting(false);
        return;
      }

      const destination = determineDestination(resolvedRole);
      if (!destination) {
        setFormError('Unrecognized user role. Access cannot be granted.');
        setSubmitting(false);
        return;
      }

      router.push(destination);
    } catch (err: any) {
      if (isBackendUnreachableError(err)) {
        wasResolvingRef.current = true;
        if (retryProfileResolution) {
          retryProfileResolution();
        }
        setSubmitting(false);
        return;
      }

      let msg = err.message || 'Authentication failed. Please check your credentials.';
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential'
      ) {
        msg = 'Invalid email or password. Please verify your credentials.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address format.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network failure. Please verify your internet connection and retry.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Account access is temporarily throttled. Please try again shortly.';
      } else if (err.status >= 500) {
        msg = 'CivicPulse server encountered an error while verifying profile. Please try again shortly.';
      }
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Normal profile resolution or background retry state (shows normal AUTHENTICATING screen, or timeout screen)
  if (user && isResolvingProfile) {
    return (
      <AuthLoadingScreen
        isTimedOut={isRetryTimeout}
        onRetry={retryProfileResolution || refreshProfile}
        onSignOut={signOut}
      />
    );
  }

  const effectiveRole = userProfile?.role;
  const activeDestination = determineDestination(effectiveRole);
  const destinationLabel =
    effectiveRole === UserRole.FIELD_OFFICER
      ? 'Go to Field Operations Workspace'
      : effectiveRole === UserRole.DEPARTMENT_OFFICER
      ? 'Go to Department Operations Workspace'
      : effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.SYSTEM_ADMIN
      ? 'Go to System Administration'
      : 'Go to Citizen Reporting Portal';

  return (
    <div className="min-h-screen bg-canvas text-ink-primary flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-civic-blueLight selection:text-civic-blueDark">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Architectural Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-ink-primary flex items-center justify-center text-canvas-card font-mono font-bold text-sm tracking-wider">
              CP
            </div>
            <span className="font-bold text-lg tracking-tight text-ink-primary">
              CivicPulse AI
            </span>
          </Link>
          <div className="flex items-center justify-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-ink-tertiary">
              Public Service Authentication
            </span>
          </div>
        </div>

        <div className="mt-8 bg-canvas-card py-8 px-6 shadow-card border border-ink-border sm:rounded-sm sm:px-10">
          <div className="mb-6 border-b border-ink-border/50 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-ink-primary">
                {user ? 'Active Session' : isRegistering ? 'Citizen Registration' : 'Account Access'}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-ink-secondary bg-canvas-subtle px-2 py-0.5 rounded-sm border border-ink-border">
                <span className="w-1.5 h-1.5 rounded-full bg-civic-emerald" />
                <span>REAL_MODE</span>
              </div>
            </div>
            <p className="text-xs text-ink-secondary mt-1">
              {user
                ? 'Your authenticated government or citizen credentials.'
                : isRegistering
                ? 'Register for public signal intake and civic grievance filing.'
                : 'Sign in to access your role-specific municipal workspace.'}
            </p>
          </div>

          {!isConfigured ? (
            /* Warning if authentication client is unconfigured */
            <div className="p-4 rounded-sm bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Authentication Client Not Configured</span>
              </div>
              <p className="leading-relaxed">
                REAL_MODE is active, but client authentication keys have not been set in this environment. Please configure:
              </p>
              <code className="block bg-amber-100/70 p-2 rounded-sm text-[11px] font-mono text-amber-950">
                NEXT_PUBLIC_SUPABASE_URL=...<br />
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
              </code>
            </div>
          ) : user ? (
            /* Already authenticated user view (shown ONLY after profile resolution finishes) */
            <div className="space-y-5 text-center py-4">
              <div className="w-10 h-10 rounded-sm bg-civic-emeraldLight text-emerald-800 mx-auto flex items-center justify-center border border-emerald-300">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-ink-tertiary block">
                  SESSION ACTIVE
                </span>
                <h3 className="text-sm font-bold text-ink-primary">Currently Authenticated</h3>
                <p className="text-xs font-semibold text-ink-primary">
                  {userProfile?.display_name || user.displayName || user.email}
                </p>
                <p className="text-[11px] text-ink-secondary font-mono">{user.email}</p>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[11px] font-mono font-medium bg-canvas-subtle border border-ink-border text-ink-primary">
                    <Shield className="w-3 h-3 text-civic-terracotta" />
                    <span>
                      {userProfile?.role === UserRole.ADMIN
                        ? 'MUNICIPAL_ADMIN (Citywide Authority)'
                        : userProfile?.role === UserRole.DEPARTMENT_OFFICER
                        ? `DEPARTMENT_OFFICER (${userProfile.department_id || 'WATCO'})`
                        : userProfile?.role === UserRole.FIELD_OFFICER
                        ? `FIELD_OFFICER (${userProfile.department_id || 'WATCO'})`
                        : userProfile?.role === UserRole.SYSTEM_ADMIN
                        ? 'SYSTEM_ADMIN'
                        : userProfile?.role === UserRole.CITIZEN
                        ? 'VERIFIED_CITIZEN'
                        : 'ROLE_PENDING_AUTHORIZATION'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                {activeDestination ? (
                  <button
                    type="button"
                    onClick={() => router.push(activeDestination)}
                    className="px-4 py-2 rounded-sm text-xs font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center gap-1.5"
                  >
                    <span>{destinationLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const prof = await refreshProfile();
                      if (prof?.role) {
                        const dest = determineDestination(prof.role);
                        if (dest) router.push(dest);
                      }
                    }}
                    className="px-4 py-2 rounded-sm text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-1.5"
                  >
                    <span>Retry Role Verification</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={signOut}
                  className="px-4 py-2 rounded-sm text-xs font-semibold bg-canvas-card border border-ink-border text-ink-primary hover:bg-canvas-subtle transition-colors flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5 text-ink-tertiary" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            /* Sign In / Register Form */
            <form onSubmit={handleRealAuth} className="space-y-4">
              {isSessionExpired && (
                <div className="p-3 rounded-sm bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Your session has expired. Please sign in again to continue.</span>
                </div>
              )}

              {confirmationNotice && (
                <div className="p-3.5 rounded-sm bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Verification Email Dispatched</span>
                  </div>
                  <p className="leading-relaxed text-emerald-800">{confirmationNotice}</p>
                  <p className="text-[11px] text-emerald-700">
                    Click the link in the email to activate your account and access the citizen portal.
                  </p>
                </div>
              )}

              {formError && (
                <div className="p-3 rounded-sm bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {isRegistering && (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-mono uppercase tracking-widest font-semibold text-ink-secondary">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Aarav Patnaik"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-sm border border-ink-border bg-canvas-subtle/50 focus:bg-canvas-card focus:outline-none focus:border-civic-terracotta transition-colors text-ink-primary font-mono"
                    />
                  </div>
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="officer@civicpulse.local or citizen@example.com"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-sm border border-ink-border bg-canvas-subtle/50 focus:bg-canvas-card focus:outline-none focus:border-civic-terracotta transition-colors text-ink-primary font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-mono uppercase tracking-widest font-semibold text-ink-secondary">
                    Password
                  </label>
                  {!isRegistering && (
                    <Link
                      href="/forgot-password"
                      className="text-[11px] font-medium text-civic-terracotta hover:text-civic-terracottaDark transition-colors font-mono"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || authLoading}
                className="w-full py-2.5 px-4 rounded-sm text-xs font-mono font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors flex items-center justify-center gap-2 disabled:opacity-60 uppercase tracking-wider"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isRegistering ? 'Creating Citizen Account...' : 'Authenticating...'}</span>
                  </>
                ) : (
                  <span>{isRegistering ? 'Register as Citizen' : 'Sign In'}</span>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setFormError(null);
                    setConfirmationNotice(null);
                  }}
                  className="text-xs text-civic-terracotta hover:underline font-mono font-medium"
                >
                  {isRegistering ? 'Already have an account? Sign in' : "New citizen? Register for public signal intake"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-xs font-mono text-ink-secondary hover:text-ink-primary underline underline-offset-4"
          >
            ← Back to Editorial Overview
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-civic-blue" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
