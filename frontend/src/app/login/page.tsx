'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  User,
  ShieldCheck,
  Briefcase,
  Settings,
  ArrowRight,
  Building2,
  Lock,
  Mail,
  AlertCircle,
  Loader2,
  LogOut,
  CheckCircle2,
  Clock,
  Shield
} from 'lucide-react';
import { UserRole } from '@civicpulse/shared';
import { setAuthToken, apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const explicitRedirect = searchParams.get('redirect');
  const isSessionExpired = searchParams.get('session_expired') === 'true';

  const { user, userProfile, loading: authLoading, isDemoMode, isConfigured, signIn, signUp, signOut } = useAuth();

  // REAL_MODE state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const demoRoles = [
    {
      role: 'Citizen',
      tagline: 'Public reporting, audio intake, instant plain-language comprehension.',
      href: '/citizen',
      icon: User,
      badge: 'Public Portal',
      badgeColor: 'bg-civic-blueLight text-civic-blueDark',
      token: 'demo-token-citizen',
    },
    {
      role: 'Government Official (Admin)',
      tagline: 'Citywide command center, priority queues, impact maps, and Governance AI.',
      href: '/dashboard',
      icon: ShieldCheck,
      badge: 'Operations Command',
      badgeColor: 'bg-civic-emeraldLight text-emerald-800',
      token: 'demo-token-admin',
    },
    {
      role: 'Department Officer (WATCO)',
      tagline: 'Department queue supervision, resolution evidence review, and scoped simulation.',
      href: '/dashboard',
      icon: Building2,
      badge: 'Dept Officer',
      badgeColor: 'bg-civic-blueLight text-civic-blueDark',
      token: 'demo-token-dept-watco',
    },
    {
      role: 'Field Officer (Rajesh K.)',
      tagline: 'Assigned emergency work orders, location navigation, and resolution proof submission.',
      href: '/officer',
      icon: Briefcase,
      badge: 'Field Ops',
      badgeColor: 'bg-civic-amberLight text-amber-900',
      token: 'demo-token-officer',
    },
    {
      role: 'System Administrator',
      tagline: 'DPI connector config, ward partitions, DPDP compliance audit logs.',
      href: '/admin',
      icon: Settings,
      badge: 'Platform Root',
      badgeColor: 'bg-purple-50 text-purple-900',
      token: 'demo-token-admin',
    },
  ];

  const handleSelectPersona = (token: string, href: string) => {
    setAuthToken(token);
    router.push(href);
  };

  const determineDestination = (role?: string): string => {
    if (explicitRedirect) {
      if (role === UserRole.CITIZEN && (explicitRedirect.startsWith('/dashboard') || explicitRedirect.startsWith('/officer'))) {
        return '/citizen';
      }
      return explicitRedirect;
    }

    switch (role) {
      case UserRole.FIELD_OFFICER:
        return '/officer';
      case UserRole.DEPARTMENT_OFFICER:
      case UserRole.ADMIN:
      case UserRole.SYSTEM_ADMIN:
        return '/dashboard';
      case UserRole.CITIZEN:
      default:
        return '/citizen';
    }
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
    try {
      let resolvedRole: string | undefined;

      if (isRegistering) {
        const { profile } = await signUp(email.trim(), password);
        resolvedRole = profile?.role || UserRole.CITIZEN;
      } else {
        const { profile } = await signIn(email.trim(), password);
        resolvedRole = profile?.role;
      }

      // If profile role was not immediate, fetch authoritatively from backend
      if (!resolvedRole) {
        try {
          const meRes = await apiClient.get<{ data: { user: { role: string } } }>('/api/v1/auth/me');
          resolvedRole = meRes?.data?.user?.role;
        } catch {
          // Default fallback if endpoint temporarily unresponsive
        }
      }

      const destination = determineDestination(resolvedRole);
      router.push(destination);
    } catch (err: any) {
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
      }
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const effectiveRole = userProfile?.role || (user ? UserRole.CITIZEN : undefined);
  const activeDestination = determineDestination(effectiveRole);
  const destinationLabel =
    effectiveRole === UserRole.FIELD_OFFICER
      ? 'Go to Field Operations Queue'
      : effectiveRole === UserRole.DEPARTMENT_OFFICER || effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.SYSTEM_ADMIN
      ? 'Go to Operations Command Center'
      : 'Go to Citizen Portal';

  return (
    <div className="min-h-screen bg-canvas flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        <Link href="/" className="inline-flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-ink-primary flex items-center justify-center text-white font-bold text-sm">
            CP
          </div>
          <span className="font-bold text-xl tracking-tight text-ink-primary">
            CivicPulse <span className="text-civic-blue font-mono text-xs">AI</span>
          </span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-ink-primary">
          {isDemoMode
            ? 'Select Demo Persona'
            : isRegistering
            ? 'Create Citizen Account'
            : 'Civic & Operations Authentication'}
        </h2>
        <p className="text-xs text-ink-secondary">
          {isDemoMode
            ? "CivicPulse AI adapts its visual system to the user's governance role. Choose an application shell to explore."
            : 'Authenticate securely. Verified roles (Citizen, Department Officer, Field Operations, Admin) are routed authoritatively.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4">
        {isDemoMode ? (
          /* DEMO_MODE: Existing persona cards unchanged */
          <div className="space-y-3">
            {demoRoles.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.role}
                  onClick={() => handleSelectPersona(r.token, r.href)}
                  className="w-full text-left group flex items-start gap-4 p-5 rounded-xl border border-ink-border bg-white shadow-card hover:border-civic-blue hover:shadow-elevated transition-all"
                >
                  <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border group-hover:bg-civic-blueLight/40 group-hover:border-civic-blue/30 transition-colors">
                    <Icon className="w-5 h-5 text-civic-blue" />
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink-primary group-hover:text-civic-blue transition-colors">
                          {r.role}
                        </span>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-medium ${r.badgeColor}`}>
                          {r.badge}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-ink-tertiary group-hover:text-civic-blue group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {r.tagline}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* REAL_MODE: Authoritative Firebase Authentication Form */
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-ink-border shadow-card space-y-6">
            {!isConfigured ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Firebase Client Not Configured</span>
                </div>
                <p className="leading-relaxed">
                  REAL_MODE is active, but client authentication keys have not been set in this environment. Please configure:
                </p>
                <code className="block bg-amber-100/70 p-2 rounded text-[11px] font-mono text-amber-950">
                  NEXT_PUBLIC_FIREBASE_API_KEY=...<br />
                  NEXT_PUBLIC_FIREBASE_PROJECT_ID=...<br />
                  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
                </code>
              </div>
            ) : user ? (
              /* Already authenticated user view */
              <div className="space-y-5 text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-subtle">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-ink-primary">Currently Authenticated</h3>
                  <p className="text-xs font-semibold text-ink-primary">
                    {userProfile?.display_name || user.displayName || user.email}
                  </p>
                  <p className="text-[11px] text-ink-secondary font-mono">{user.email}</p>
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-civic-blueLight text-civic-blueDark">
                      <Shield className="w-3 h-3 text-civic-blue" />
                      <span>
                        {userProfile?.role === UserRole.ADMIN
                          ? 'MUNICIPAL_ADMIN (Citywide Authority)'
                          : userProfile?.role === UserRole.DEPARTMENT_OFFICER
                          ? `DEPARTMENT_OFFICER (${userProfile.department_id || 'WATCO'})`
                          : userProfile?.role === UserRole.FIELD_OFFICER
                          ? `FIELD_OFFICER (${userProfile.department_id || 'WATCO'})`
                          : userProfile?.role === UserRole.SYSTEM_ADMIN
                          ? 'SYSTEM_ADMIN'
                          : 'VERIFIED_CITIZEN'}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => router.push(activeDestination)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark transition-colors shadow-subtle flex items-center gap-1.5"
                  >
                    <span>{destinationLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={signOut}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle transition-colors flex items-center gap-1.5"
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
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Your session has expired. Please sign in again to continue.</span>
                  </div>
                )}

                {formError && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-primary">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="officer@civicpulse.local or citizen@example.com"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue transition-colors text-ink-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink-primary">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue transition-colors text-ink-primary"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || authLoading}
                  className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark transition-colors shadow-subtle flex items-center justify-center gap-2 disabled:opacity-60"
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
                    }}
                    className="text-xs text-civic-blue hover:underline font-medium"
                  >
                    {isRegistering ? 'Already have an account? Sign in' : "New citizen? Register for public signal intake"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-xs font-medium text-ink-secondary hover:text-ink-primary underline underline-offset-4"
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
