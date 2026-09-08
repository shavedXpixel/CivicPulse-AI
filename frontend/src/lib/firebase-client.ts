import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
};

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId
  );
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getClientApp(): FirebaseApp | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!isFirebaseConfigured()) {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  app = initializeApp(firebaseConfig);
  return app;
}

export function getClientAuth(): Auth | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!auth) {
    const clientApp = getClientApp();
    if (clientApp) {
      auth = getAuth(clientApp);
    }
  }

  return auth;
}

export async function signInWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const clientAuth = getClientAuth();
  if (!clientAuth) {
    throw new Error('Firebase Auth is not configured on this client. Please check your NEXT_PUBLIC_FIREBASE_* environment variables.');
  }
  const cred = await signInWithEmailAndPassword(clientAuth, email, pass);
  return cred.user;
}

export async function signUpWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const clientAuth = getClientAuth();
  if (!clientAuth) {
    throw new Error('Firebase Auth is not configured on this client. Please check your NEXT_PUBLIC_FIREBASE_* environment variables.');
  }
  const cred = await createUserWithEmailAndPassword(clientAuth, email, pass);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  const clientAuth = getClientAuth();
  if (clientAuth) {
    await firebaseSignOut(clientAuth);
  }
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  const clientAuth = getClientAuth();
  if (!clientAuth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(clientAuth, callback);
}

export async function getCurrentIdToken(forceRefresh: boolean = false): Promise<string | null> {
  const clientAuth = getClientAuth();
  if (!clientAuth) {
    return null;
  }
  if (!clientAuth.currentUser && typeof clientAuth.authStateReady === 'function') {
    try {
      await clientAuth.authStateReady();
    } catch {
      // Best effort wait for auth initialization
    }
  }
  if (!clientAuth.currentUser) {
    return null;
  }
  try {
    return await clientAuth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}
