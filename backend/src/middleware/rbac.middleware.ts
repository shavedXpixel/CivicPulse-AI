import { Request, Response, NextFunction } from 'express';
import { UserRole, ERROR_CODES } from '@civicpulse/shared';
import { AppError } from './error.middleware';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(
        new AppError({
          statusCode: 401,
          code: ERROR_CODES.UNAUTHORIZED,
          message: 'Authentication required prior to role verification.'
        })
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Access denied. Role '${req.user.role}' lacks sufficient privileges for this resource.`
        })
      );
    }

    next();
  };
}
