import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { getDatabaseProvider, getAuthProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserRole, UserStatus, UserProfile } from '@civicpulse/shared';

export class AuthController {
  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'User is not authenticated.'
          })
        );
      }

      const db = getDatabaseProvider();
      let citizenProfile = null;

      if (req.user.role === UserRole.CITIZEN) {
        citizenProfile = await db.getCitizenProfile(req.user.id);
      }

      res.status(200).json({
        data: {
          user: req.user,
          citizen_profile: citizenProfile
        }
      });
    } catch (err) {
      next(err);
    }
  }

  public static async registerCitizen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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

      // Strictly reject demo tokens and x-demo-mode headers in REAL_MODE
      if (!env.DEMO_MODE && (token.startsWith('demo-token-') || token.startsWith('usr_') || req.headers['x-demo-mode'])) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Demo authentication and x-demo-mode headers are strictly forbidden in REAL_MODE.'
          })
        );
      }

      // Verify token via AuthProvider (ES256 JWKS via Supabase in REAL_MODE)
      const authProvider = getAuthProvider();
      const payload = await authProvider.verifyToken(token);

      const authUserId = payload.uid;
      const authenticatedEmail = payload.email;

      if (!authUserId || !authenticatedEmail) {
        return next(
          new AppError({
            statusCode: 401,
            code: ERROR_CODES.UNAUTHORIZED,
            message: 'Verified token missing authenticated subject or email claim.'
          })
        );
      }

      const db = getDatabaseProvider();

      // Rule: Server-side authoritative role derivation. The only role allowed through public registration is CITIZEN.
      // Ignore any client-supplied role!
      const authoritativeRole = UserRole.CITIZEN;

      // Extract display name from token user_metadata or request body
      const userMeta = payload.user_metadata as Record<string, any> | undefined;
      const metaName = userMeta?.full_name || userMeta?.name;
      const displayName = (metaName || req.body?.display_name || authenticatedEmail.split('@')[0] || 'Citizen').trim();

      // Idempotently check if user profile exists
      let user: UserProfile | null = null;
      if (typeof db.getUserByAuthId === 'function') {
        user = await db.getUserByAuthId(authUserId);
      } else {
        user = await db.getUser(authUserId);
      }

      const now = new Date().toISOString();

      if (!user) {
        const newUser: UserProfile = {
          id: authUserId,
          auth_user_id: authUserId,
          email: authenticatedEmail,
          display_name: displayName,
          role: authoritativeRole,
          status: UserStatus.ACTIVE,
          created_at: now,
          updated_at: now
        };
        user = await db.createUser(newUser);
      }

      // Idempotently ensure citizen profile exists
      let citizenProfile = await db.getCitizenProfile(user.id);
      if (!citizenProfile) {
        try {
          citizenProfile = await db.createCitizenProfile({
            id: `prof_${user.id}`,
            user_id: user.id,
            preferred_language: (req.body?.preferred_language || 'en').trim(),
            notification_enabled: true,
            created_at: now,
            updated_at: now
          });
        } catch {
          citizenProfile = await db.getCitizenProfile(user.id);
        }
      }

      res.status(200).json({
        data: {
          user,
          citizen_profile: citizenProfile,
          message: 'Citizen profile provisioned authoritatively.'
        }
      });
    } catch (err) {
      next(err);
    }
  }

  public static async switchDemoPersona(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Strictly disabled when DEMO_MODE is false
      if (!env.DEMO_MODE) {
        return next(
          new AppError({
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND,
            message: 'Endpoint not available outside of demo mode.'
          })
        );
      }

      const { role } = req.body;
      const db = getDatabaseProvider();
      let targetUserId = 'usr_citizen_01';
      let token = 'demo-token-citizen';

      if (role === 'FIELD_OFFICER' || role === 'OFFICER') {
        targetUserId = 'usr_officer_01';
        token = 'demo-token-officer';
      } else if (role === 'ADMIN' || role === 'SYSTEM_ADMIN') {
        targetUserId = 'usr_admin_01';
        token = 'demo-token-admin';
      } else if (role === 'CITIZEN_2') {
        targetUserId = 'usr_citizen_02';
        token = 'demo-token-citizen-2';
      }

      const user = await db.getUser(targetUserId);
      if (!user) {
        return next(
          new AppError({
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND,
            message: `Demo persona for role ${role} not found.`
          })
        );
      }

      res.status(200).json({
        data: {
          token,
          user
        }
      });
    } catch (err) {
      next(err);
    }
  }
}
