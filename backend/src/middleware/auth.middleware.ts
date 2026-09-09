import { Request, Response, NextFunction } from 'express';
import { UserProfile, UserRole, UserStatus, ERROR_CODES } from '@civicpulse/shared';
import { AppError } from './error.middleware';
import { env } from '../config/env';
import { getDatabaseProvider } from '../providers';

// Augment Express Request interface with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required. Missing Bearer token in Authorization header.'
      })
    );
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return next(
      new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Empty authentication token provided.'
      })
    );
  }

  const db = getDatabaseProvider();

  // In Demo Mode or if demo persona token is presented, resolve predefined personas
  if (env.DEMO_MODE || token.startsWith('demo-token-') || req.headers['x-demo-mode'] === 'true') {
    let resolvedUserId: string | null = null;

    if (token === 'demo-token-citizen' || token === 'citizen') {
      resolvedUserId = 'usr_citizen_01';
    } else if (token === 'demo-token-officer' || token === 'officer') {
      resolvedUserId = 'usr_officer_01';
    } else if (token === 'demo-token-dept-watco' || token === 'dept_watco') {
      resolvedUserId = 'usr_dept_watco';
    } else if (token === 'demo-token-dept-drainage' || token === 'dept_drainage') {
      resolvedUserId = 'usr_dept_drainage';
    } else if (token === 'demo-token-field-drainage' || token === 'field_drainage') {
      resolvedUserId = 'usr_field_drainage';
    } else if (token === 'demo-token-admin' || token === 'admin') {
      resolvedUserId = 'usr_admin_01';
    } else if (token === 'demo-token-citizen-2') {
      resolvedUserId = 'usr_citizen_02';
    } else if (token.startsWith('usr_')) {
      resolvedUserId = token;
    }

    if (resolvedUserId) {
      let user = await db.getUser(resolvedUserId);
      if (!user) {
        // Fallback demo user profile for government/officer access in real mode
        const isAdmin = resolvedUserId === 'usr_admin_01';
        const isFieldOfficer = resolvedUserId === 'usr_officer_01' || resolvedUserId === 'usr_field_drainage';
        const role = isAdmin
          ? UserRole.ADMIN
          : isFieldOfficer
          ? UserRole.FIELD_OFFICER
          : resolvedUserId.includes('dept')
          ? UserRole.DEPARTMENT_OFFICER
          : UserRole.CITIZEN;

        user = {
          id: resolvedUserId,
          email: `${resolvedUserId}@civicpulse.gov.in`,
          display_name: isAdmin ? 'Municipal Administrator' : 'Department Officer',
          role,
          status: UserStatus.ACTIVE,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      req.user = user;
      return next();
    }

    // Default fallback demo citizen if a generic test token is used
    let defaultCitizen = await db.getUser('usr_citizen_01');
    if (!defaultCitizen) {
      defaultCitizen = {
        id: 'usr_citizen_01',
        email: 'citizen@civicpulse.gov.in',
        display_name: 'Demo Citizen',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    req.user = defaultCitizen;
    return next();
  }

  // REAL_MODE: Verify Firebase ID token using Firebase Admin Auth
  try {
    const { getFirebaseAuth } = await import('../infrastructure/firebase/firebase-admin');
    const auth = getFirebaseAuth();
    const decoded = await auth.verifyIdToken(token);
    const userId = decoded.uid;

    let user = await db.getUser(userId);

    // Auto-provision first-time citizen profile in Firestore
    if (!user) {
      const now = new Date().toISOString();
      const newUser: UserProfile = {
        id: userId,
        email: decoded.email || `${userId}@firebase.civicpulse.local`,
        display_name: decoded.name || decoded.email?.split('@')[0] || 'Citizen',
        role: UserRole.CITIZEN,
        status: UserStatus.ACTIVE,
        created_at: now,
        updated_at: now
      };
      user = await db.createUser(newUser);

      try {
        await db.createCitizenProfile({
          id: `prof_${userId}`,
          user_id: userId,
          preferred_language: 'en',
          notification_enabled: true,
          created_at: now,
          updated_at: now
        });
      } catch {
        // Best effort profile creation
      }
    }

    if (user.status === UserStatus.SUSPENDED) {
      return next(
        new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: 'User account is suspended.'
        })
      );
    }

    req.user = user;
    return next();
  } catch (err: any) {
    if (err instanceof AppError && err.statusCode >= 500) {
      return next(err);
    }
    return next(
      new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: `Authentication failed: ${err.message || 'Invalid or expired Firebase ID token.'}`
      })
    );
  }
}

// Optional auth middleware: extracts user if token present, but does not block if missing
export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7).trim();
  if (!token) return next();

  try {
    const db = getDatabaseProvider();
    if (env.DEMO_MODE) {
      let resolvedUserId = 'usr_citizen_01';
      if (token === 'demo-token-officer' || token === 'officer') resolvedUserId = 'usr_officer_01';
      if (token === 'demo-token-dept-watco' || token === 'dept_watco') resolvedUserId = 'usr_dept_watco';
      if (token === 'demo-token-dept-drainage' || token === 'dept_drainage') resolvedUserId = 'usr_dept_drainage';
      if (token === 'demo-token-field-drainage' || token === 'field_drainage') resolvedUserId = 'usr_field_drainage';
      if (token === 'demo-token-admin' || token === 'admin') resolvedUserId = 'usr_admin_01';
      if (token === 'demo-token-citizen-2') resolvedUserId = 'usr_citizen_02';
      if (token.startsWith('usr_')) resolvedUserId = token;

      const user = await db.getUser(resolvedUserId);
      if (user) {
        req.user = user;
      }
    } else {
      const { getFirebaseAuth } = await import('../infrastructure/firebase/firebase-admin');
      const auth = getFirebaseAuth();
      const decoded = await auth.verifyIdToken(token);
      const user = await db.getUser(decoded.uid);
      if (user) {
        req.user = user;
      }
    }
  } catch {
    // Ignore in optional middleware
  }

  return next();
}
