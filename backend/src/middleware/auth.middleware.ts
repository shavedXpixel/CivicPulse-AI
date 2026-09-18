import { Request, Response, NextFunction } from 'express';
import { UserProfile, UserRole, UserStatus, ERROR_CODES } from '@civicpulse/shared';
import { AppError } from './error.middleware';
import { env } from '../config/env';
import { getDatabaseProvider, getAuthProvider, SupabaseAuthProvider } from '../providers';

// Augment Express Request interface with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // Reject x-demo-mode immediately in REAL_MODE
  if (!env.DEMO_MODE && (req.headers['x-demo-mode'] === 'true' || req.headers['x-demo-mode'])) {
    return next(
      new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Demo authentication and x-demo-mode headers are strictly forbidden in REAL_MODE. Valid Bearer authentication token required.'
      })
    );
  }

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

  const isExplicitDemoToken =
    token.startsWith('demo-token-') ||
    token.startsWith('usr_') ||
    token === 'citizen' ||
    token === 'officer' ||
    token === 'dept_watco' ||
    token === 'dept_drainage' ||
    token === 'field_drainage' ||
    token === 'admin';

  // Strict REAL_MODE security gate: Demo tokens and x-demo-mode headers are unconditionally rejected in REAL_MODE
  if (!env.DEMO_MODE) {
    if (req.headers['x-demo-mode'] || isExplicitDemoToken) {
      return next(
        new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Demo authentication and x-demo-mode headers are strictly forbidden in REAL_MODE. Valid Bearer authentication token required.'
        })
      );
    }
  }

  // In Demo Mode with an explicit demo token, or if x-demo-mode header is presented, resolve predefined personas
  if (env.DEMO_MODE && (isExplicitDemoToken || req.headers['x-demo-mode'] === 'true')) {
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

  // REAL_MODE: Provider-driven authentication
  try {
    const authProvider = getAuthProvider();
    const payload = await authProvider.verifyToken(token);
    const authUserId = payload.uid;

    let user: UserProfile | null = null;
    const isSupabase = authProvider instanceof SupabaseAuthProvider || env.AUTH_PROVIDER === 'supabase';

    if (isSupabase) {
      // Runtime Rule 2: Strict lookup SELECT * FROM public.users WHERE auth_user_id = sub
      // NEVER fall back to email, display name, client UID, or metadata!
      if (typeof db.getUserByAuthId === 'function') {
        user = await db.getUserByAuthId(authUserId);
      } else {
        user = await db.getUser(authUserId);
      }

      if (!user) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'ACCOUNT_NOT_PROVISIONED: User identity is not linked to an authoritative profile.'
          })
        );
      }
    } else {
      // Rollback Mode (Firebase Auth against Firestore)
      user = await db.getUser(authUserId);

      // Auto-provision first-time citizen profile in Firestore for legacy Firebase Auth
      if (!user) {
        const now = new Date().toISOString();
        const newUser: UserProfile = {
          id: authUserId,
          email: payload.email || `${authUserId}@firebase.civicpulse.local`,
          display_name: payload.name || payload.email?.split('@')[0] || 'Citizen',
          role: UserRole.CITIZEN,
          status: UserStatus.ACTIVE,
          created_at: now,
          updated_at: now
        };
        user = await db.createUser(newUser);

        try {
          await db.createCitizenProfile({
            id: `prof_${authUserId}`,
            user_id: authUserId,
            preferred_language: 'en',
            notification_enabled: true,
            created_at: now,
            updated_at: now
          });
        } catch {
          // Best effort profile creation
        }
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
        statusCode: err.statusCode || 401,
        code: err.code || ERROR_CODES.UNAUTHORIZED,
        message: err.message || 'Authentication failed: Invalid or expired token.'
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
      const authProvider = getAuthProvider();
      const payload = await authProvider.verifyToken(token);
      let user: UserProfile | null = null;
      if (authProvider instanceof SupabaseAuthProvider || env.AUTH_PROVIDER === 'supabase') {
        if (typeof db.getUserByAuthId === 'function') {
          user = await db.getUserByAuthId(payload.uid);
        }
      } else {
        user = await db.getUser(payload.uid);
      }
      if (user) {
        req.user = user;
      }
    }
  } catch {
    // Ignore in optional middleware
  }

  return next();
}
