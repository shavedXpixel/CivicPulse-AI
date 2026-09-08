import { App, initializeApp, cert, applicationDefault, getApps, Credential } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES } from '@civicpulse/shared';

let firebaseApp: App | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;

export interface FirebaseAdminOptions {
  projectId?: string;
  credentialsPath?: string;
}

/**
 * Initializes or returns the singleton Firebase Admin App instance.
 * Strictly checks for configuration in REAL_MODE (DEMO_MODE=false).
 */
export function getFirebaseAdminApp(options?: FirebaseAdminOptions): App {
  if (firebaseApp) {
    return firebaseApp;
  }

  // If already initialized globally by Firebase Admin
  const existingApps = getApps();
  if (existingApps.length > 0 && existingApps[0]) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  const projectId = options?.projectId || env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const credentialsPath = options?.credentialsPath || env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId && !credentialsPath) {
    throw new AppError({
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message:
        '[CivicPulse Firebase] REAL_MODE is active (DEMO_MODE=false), but Firebase configuration is missing. ' +
        'Please set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS in your environment.'
    });
  }

  let credentialConfig: Credential | undefined;

  if (credentialsPath) {
    let resolvedPath = path.isAbsolute(credentialsPath)
      ? credentialsPath
      : path.resolve(process.cwd(), credentialsPath);

    if (!fs.existsSync(resolvedPath) && !path.isAbsolute(credentialsPath)) {
      const parentResolved = path.resolve(process.cwd(), '..', credentialsPath);
      if (fs.existsSync(parentResolved)) {
        resolvedPath = parentResolved;
      }
    }

    if (fs.existsSync(resolvedPath)) {
      try {
        const rawJson = fs.readFileSync(resolvedPath, 'utf8');
        const serviceAccount = JSON.parse(rawJson);
        credentialConfig = cert(serviceAccount);
      } catch (err: any) {
        throw new AppError({
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `[CivicPulse Firebase] Failed to parse service account credentials at "${resolvedPath}": ${err.message}`
        });
      }
    } else {
      throw new AppError({
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_ERROR,
        message: `[CivicPulse Firebase] Credentials file not found at path: "${resolvedPath}".`
      });
    }
  } else {
    // Attempt Application Default Credentials if running inside GCP / Cloud Run
    try {
      credentialConfig = applicationDefault();
    } catch {
      credentialConfig = undefined;
    }
  }

  try {
    firebaseApp = initializeApp({
      credential: credentialConfig,
      projectId: projectId || undefined
    });
    return firebaseApp;
  } catch (err: any) {
    throw new AppError({
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: `[CivicPulse Firebase] Failed to initialize Firebase Admin SDK: ${err.message}`
    });
  }
}

/**
 * Returns the singleton Firestore instance.
 */
export function getFirestoreDb(options?: FirebaseAdminOptions): Firestore {
  if (firestoreDb) {
    return firestoreDb;
  }
  const app = getFirebaseAdminApp(options);
  firestoreDb = getFirestore(app);
  try {
    firestoreDb.settings({ ignoreUndefinedProperties: true });
  } catch {
    // Ignore if settings already locked
  }
  return firestoreDb;
}

/**
 * Returns the singleton Firebase Auth instance.
 */
export function getFirebaseAuth(options?: FirebaseAdminOptions): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }
  const app = getFirebaseAdminApp(options);
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

/**
 * Reset helper for test suites.
 */
export function resetFirebaseAdmin(): void {
  firebaseApp = null;
  firestoreDb = null;
  firebaseAuth = null;
}
