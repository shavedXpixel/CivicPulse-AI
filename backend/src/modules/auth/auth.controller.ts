import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { getDatabaseProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserRole } from '@civicpulse/shared';

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
