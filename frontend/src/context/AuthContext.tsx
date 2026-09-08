'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  onAuthChange,
  getCurrentIdToken,
  isFirebaseConfigured
} from '../lib/firebase-client';

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isDemoMode: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<FirebaseUser>;
  signUp: (email: string, pass: string) => Promise<FirebaseUser>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(!isDemoMode);
  const [isConfigured, setIsConfigured] = useState<boolean>(isFirebaseConfigured);

  useEffect(() => {
    // Only subscribe to Firebase Auth in REAL_MODE on the browser
    if (isDemoMode) {
      setLoading(false);
      return;
    }

    const configured = isFirebaseConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemoMode]);

  const handleSignIn = async (email: string, pass: string): Promise<FirebaseUser> => {
    const loggedInUser = await signInWithEmail(email, pass);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const handleSignUp = async (email: string, pass: string): Promise<FirebaseUser> => {
    const newUser = await signUpWithEmail(email, pass);
    setUser(newUser);
    return newUser;
  };

  const handleSignOut = async (): Promise<void> => {
    await signOutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode,
        isConfigured,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        getIdToken: getCurrentIdToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    // Return safe fallback for components rendered outside AuthProvider
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';
    return {
      user: null,
      loading: false,
      isDemoMode: isDemo,
      isConfigured: false,
      signIn: async () => { throw new Error('AuthProvider not mounted'); },
      signUp: async () => { throw new Error('AuthProvider not mounted'); },
      signOut: async () => {},
      getIdToken: async () => null
    };
  }
  return context;
}
