'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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
  signIn: (email: string, pass: string) => Promise<{ user: any; profile: UserProfile | null }>;
  signUp: (email: string, pass: string, fullName?: string) => Promise<{ user: any; profile: UserProfile | null; confirmationRequired?: boolean }>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
  const useSupabase = isSupabaseConfigured();

  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(!isDemoMode);
  const [isConfigured, setIsConfigured] = useState<boolean>(
    useSupabase ? isSupabaseConfigured() : isFirebaseConfigured()
  );

  const fetchProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (isDemoMode) return null;
    try {
      const res = await apiClient.get<{ data: { user: UserProfile } }>('/api/v1/auth/me');
      if (res?.data?.user) {
        setUserProfile(res.data.user);
        return res.data.user;
      }
    } catch (err) {
      console.warn('Could not fetch authoritative user profile:', err);
    }
    return null;
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false);
      return;
    }

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
          await fetchProfile();
        } else {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      const unsubscribe = firebaseOnAuthChange(async (fbUser) => {
        setUser(fbUser);
        if (fbUser) {
          await fetchProfile();
        } else {
          setUserProfile(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [isDemoMode, useSupabase, fetchProfile]);

  const handleSignIn = async (email: string, pass: string): Promise<{ user: any; profile: UserProfile | null }> => {
    if (useSupabase) {
      const { user: sbUser } = await supabaseSignIn(email, pass);
      const adaptedUser = {
        uid: sbUser.id,
        email: sbUser.email,
        displayName: sbUser.user_metadata?.full_name || sbUser.email
      };
      setUser(adaptedUser);
      const profile = await fetchProfile();
      return { user: adaptedUser, profile };
    } else {
      const loggedInUser = await firebaseSignIn(email, pass);
      setUser(loggedInUser);
      const profile = await fetchProfile();
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
        }
      } catch (regErr) {
        console.warn('Authoritative citizen provisioning error:', regErr);
        profile = await fetchProfile();
      }

      return { user: adaptedUser, profile, confirmationRequired: false };
    } else {
      const newUser = await firebaseSignUp(email, pass);
      setUser(newUser);
      const profile = await fetchProfile();
      return { user: newUser, profile, confirmationRequired: false };
    }
  };

  const handleSignOut = async (): Promise<void> => {
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
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        getIdToken: handleGetIdToken,
        refreshProfile: fetchProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
    return {
      user: null,
      userProfile: null,
      loading: false,
      isDemoMode: isDemo,
      isConfigured: false,
      signIn: async () => { throw new Error('AuthProvider not mounted'); },
      signUp: async () => { throw new Error('AuthProvider not mounted'); },
      signOut: async () => {},
      getIdToken: async () => null,
      refreshProfile: async () => null
    };
  }
  return context;
}
