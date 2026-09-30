'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import type { UserProfile } from '@civicpulse/shared';
import {
  signInWithEmail as firebaseSignIn,
  signUpWithEmail as firebaseSignUp,
  signOutUser as firebaseSignOut,
  onAuthChange as firebaseOnAuthChange,
  getCurrentIdToken as firebaseGetToken,
  isFirebaseConfigured
} from '../lib/firebase-client';
import {
  signInWithEmail as supabaseSignIn,
  signUpWithEmail as supabaseSignUp,
  signOutUser as supabaseSignOut,
  onAuthChange as supabaseOnAuthChange,
  getCurrentSessionToken as supabaseGetToken,
  isSupabaseConfigured
} from '../lib/supabase-client';
import { apiClient } from '../lib/api-client';
import {
  isBackendUnreachableError,
  calculateBackoffDelay,
  AUTH_RETRY_CONFIG
} from '../lib/auth-retry';
import { AuthLoadingScreen } from '../components/auth/AuthLoadingScreen';

export interface GenericAuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}

export interface AuthContextType {
  user: any | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isDemoMode: boolean;
  isConfigured: boolean;
  isResolvingProfile: boolean;
  isRetryTimeout: boolean;
  serverError: string | null;
  signIn: (email: string, pass: string) => Promise<{ user: any; profile: UserProfile | null }>;
  signUp: (email: string, pass: string, fullName?: string) => Promise<{ user: any; profile: UserProfile | null; confirmationRequired?: boolean }>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshProfile: () => Promise<UserProfile | null>;
  retryProfileResolution: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  retryConfig
}: {
  children: ReactNode;
  retryConfig?: Partial<typeof AUTH_RETRY_CONFIG>;
}) {
  const isDemoMode = false;
  const useSupabase = isSupabaseConfigured();

  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(
    useSupabase ? isSupabaseConfigured() : isFirebaseConfigured()
  );
  const [isResolvingProfile, setIsResolvingProfile] = useState<boolean>(false);
  const [isRetryTimeout, setIsRetryTimeout] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isRetryingRef = useRef<boolean>(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resolveProfileWithRetry = useCallback(
    async (overrideConfig?: Partial<typeof AUTH_RETRY_CONFIG>): Promise<UserProfile | null> => {
      // Prevent duplicate retry loops if already actively retrying
      if (isRetryingRef.current) {
        return null;
      }

      setServerError(null);
      setIsResolvingProfile(true);
      setIsRetryTimeout(false);

      // Attempt 1: Normal profile request to /api/v1/auth/me
      try {
        const res = await apiClient.get<{ data: { user: UserProfile } }>('/api/v1/auth/me');
        if (res?.data?.user) {
          setUserProfile(res.data.user);
          setIsResolvingProfile(false);
          setIsRetryTimeout(false);
          setServerError(null);
          return res.data.user;
        }
        setIsResolvingProfile(false);
      } catch (err: any) {
        if (!isBackendUnreachableError(err)) {
          // Reachable backend returning 401, 403, 500, etc.
          setIsResolvingProfile(false);
          setIsRetryTimeout(false);
          if (err?.status >= 500) {
            setServerError('CivicPulse server encountered an error while verifying profile.');
          }
          console.warn('Authoritative profile resolution error (backend reachable):', err);
          return null;
        }

        // Temporary backend network failure (e.g. ERR_CONNECTION_REFUSED / fetch failure)
        // Keep normal AUTHENTICATING screen visible while retrying silently
      }

      // Enter retry loop with controlled backoff (silent retry, same AUTHENTICATING screen)
      isRetryingRef.current = true;
      const mergedConfig = { ...AUTH_RETRY_CONFIG, ...retryConfig, ...overrideConfig };
      const initialDelay = mergedConfig.INITIAL_DELAY_MS;
      const maxDelay = mergedConfig.MAX_DELAY_MS;
      const factor = mergedConfig.BACKOFF_FACTOR;
      const maxTotalWait = mergedConfig.MAX_TOTAL_WAIT_MS;

      const startTime = Date.now();
      let currentDelay = initialDelay;

      while (isRetryingRef.current) {
        if (Date.now() - startTime >= maxTotalWait) {
          // Retry window exhausted (~90s): show generic connection error with Try Again / Sign Out
          setIsRetryTimeout(true);
          isRetryingRef.current = false;
          return null;
        }

        await new Promise((resolve) => {
          retryTimeoutRef.current = setTimeout(resolve, currentDelay);
        });

        // Loop cancelled during wait (signout or unmount)
        if (!isRetryingRef.current) {
          break;
        }

        try {
          const res = await apiClient.get<{ data: { user: UserProfile } }>('/api/v1/auth/me');
          if (res?.data?.user) {
            setUserProfile(res.data.user);
            setIsResolvingProfile(false);
            setIsRetryTimeout(false);
            setServerError(null);
            isRetryingRef.current = false;
            return res.data.user;
          }
        } catch (err: any) {
          if (!isBackendUnreachableError(err)) {
            // Reachable backend returning 401/403/500
            setIsResolvingProfile(false);
            setIsRetryTimeout(false);
            isRetryingRef.current = false;
            if (err?.status >= 500) {
              setServerError('CivicPulse server encountered an error while verifying profile.');
            }
            return null;
          }

          // Still unreachable: back off timing (2s -> 2.5s -> 3.1s -> ... up to 5s)
          currentDelay = calculateBackoffDelay(currentDelay, factor, maxDelay);
        }
      }

      return null;
    },
    [retryConfig]
  );

  const fetchProfile = useCallback(async (): Promise<UserProfile | null> => {
    return resolveProfileWithRetry();
  }, [resolveProfileWithRetry]);

  const handleRetryResolution = useCallback(async (): Promise<UserProfile | null> => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    isRetryingRef.current = false;
    setIsRetryTimeout(false);
    return resolveProfileWithRetry();
  }, [resolveProfileWithRetry]);

  useEffect(() => {
    const configured = useSupabase ? isSupabaseConfigured() : isFirebaseConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setLoading(false);
      return;
    }

    if (useSupabase) {
      const unsubscribe = supabaseOnAuthChange(async (sbUser) => {
        if (sbUser) {
          setUser({
            uid: sbUser.id,
            email: sbUser.email,
            displayName: sbUser.user_metadata?.full_name || sbUser.email
          });
          await resolveProfileWithRetry();
        } else {
          setUser(null);
          setUserProfile(null);
          setIsResolvingProfile(false);
          setIsRetryTimeout(false);
          setServerError(null);
        }
        setLoading(false);
      });
      return () => {
        unsubscribe();
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        isRetryingRef.current = false;
      };
    } else {
      const unsubscribe = firebaseOnAuthChange(async (fbUser) => {
        setUser(fbUser);
        if (fbUser) {
          await resolveProfileWithRetry();
        } else {
          setUserProfile(null);
          setIsResolvingProfile(false);
          setIsRetryTimeout(false);
          setServerError(null);
        }
        setLoading(false);
      });
      return () => {
        unsubscribe();
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        isRetryingRef.current = false;
      };
    }
  }, [useSupabase, resolveProfileWithRetry]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      isRetryingRef.current = false;
    };
  }, []);

  const handleSignIn = async (email: string, pass: string): Promise<{ user: any; profile: UserProfile | null }> => {
    if (useSupabase) {
      const { user: sbUser } = await supabaseSignIn(email, pass);
      const adaptedUser = {
        uid: sbUser.id,
        email: sbUser.email,
        displayName: sbUser.user_metadata?.full_name || sbUser.email
      };
      setUser(adaptedUser);
      const profile = await resolveProfileWithRetry();
      return { user: adaptedUser, profile };
    } else {
      const loggedInUser = await firebaseSignIn(email, pass);
      setUser(loggedInUser);
      const profile = await resolveProfileWithRetry();
      return { user: loggedInUser, profile };
    }
  };

  const handleSignUp = async (
    email: string,
    pass: string,
    fullName?: string
  ): Promise<{ user: any; profile: UserProfile | null; confirmationRequired?: boolean }> => {
    if (useSupabase) {
      const { user: sbUser, session } = await supabaseSignUp(email, pass, fullName);
      const adaptedUser = {
        uid: sbUser.id,
        email: sbUser.email,
        displayName: sbUser.user_metadata?.full_name || fullName || sbUser.email
      };

      // When email confirmation is required in Supabase, session is null
      if (!session) {
        return { user: adaptedUser, profile: null, confirmationRequired: true };
      }

      setUser(adaptedUser);

      // Explicit authoritative citizen provisioning call with immediate session
      let profile: UserProfile | null = null;
      try {
        const regRes = await apiClient.post<{ data: { user: UserProfile } }>(
          '/api/v1/auth/register-citizen',
          { display_name: adaptedUser.displayName },
          { Authorization: `Bearer ${session.access_token}` }
        );
        if (regRes?.data?.user) {
          profile = regRes.data.user;
          setUserProfile(profile);
          setIsResolvingProfile(false);
          setIsRetryTimeout(false);
        }
      } catch (regErr) {
        console.warn('Authoritative citizen provisioning error:', regErr);
        profile = await resolveProfileWithRetry();
      }

      return { user: adaptedUser, profile, confirmationRequired: false };
    } else {
      const newUser = await firebaseSignUp(email, pass);
      setUser(newUser);
      const profile = await resolveProfileWithRetry();
      return { user: newUser, profile, confirmationRequired: false };
    }
  };

  const handleSignOut = async (): Promise<void> => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    isRetryingRef.current = false;
    setIsResolvingProfile(false);
    setIsRetryTimeout(false);
    setServerError(null);

    if (useSupabase) {
      await supabaseSignOut();
    } else {
      await firebaseSignOut();
    }
    setUser(null);
    setUserProfile(null);
  };

  const handleGetIdToken = async (_forceRefresh?: boolean): Promise<string | null> => {
    if (useSupabase) {
      return supabaseGetToken();
    } else {
      return firebaseGetToken();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isDemoMode,
        isConfigured,
        isResolvingProfile,
        isRetryTimeout,
        serverError,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        getIdToken: handleGetIdToken,
        refreshProfile: fetchProfile,
        retryProfileResolution: handleRetryResolution
      }}
    >
      {user && isResolvingProfile ? (
        <AuthLoadingScreen
          isTimedOut={isRetryTimeout}
          onRetry={handleRetryResolution}
          onSignOut={handleSignOut}
        />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: null,
      userProfile: null,
      loading: false,
      isDemoMode: false,
      isConfigured: false,
      isResolvingProfile: false,
      isRetryTimeout: false,
      serverError: null,
      signIn: async () => { throw new Error('AuthProvider not mounted'); },
      signUp: async () => { throw new Error('AuthProvider not mounted'); },
      signOut: async () => {},
      getIdToken: async () => null,
      refreshProfile: async () => null,
      retryProfileResolution: async () => null
    };
  }
  return context;
}
