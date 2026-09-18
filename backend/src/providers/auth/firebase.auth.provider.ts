import { IAuthProvider, AuthTokenPayload } from './auth.interface';
import { getFirebaseAuth } from '../../infrastructure/firebase/firebase-admin';
import { AppError } from '../../middleware/error.middleware';
import { ERROR_CODES, UserProfile } from '@civicpulse/shared';

export class FirebaseAuthProvider implements IAuthProvider {
  public async verifyToken(token: string): Promise<AuthTokenPayload> {
    if (!token || typeof token !== 'string') {
      throw new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication failed: Missing or invalid token format.'
      });
    }

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();

    try {
      const auth = getFirebaseAuth();
      const decoded = await auth.verifyIdToken(cleanToken);

      return {
        uid: decoded.uid,
        email: decoded.email,
        name: (decoded as any).name || (decoded as any).displayName,
        role: (decoded as any).role,
        aud: decoded.aud,
        iss: decoded.iss,
        app_metadata: (decoded as any).app_metadata,
        user_metadata: (decoded as any).user_metadata
      };
    } catch (err: any) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError({
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED,
        message: `Authentication failed: ${err.message || 'Invalid or expired Firebase ID token.'}`
      });
    }
  }

  public async getUserById(uid: string): Promise<UserProfile | null> {
    try {
      const auth = getFirebaseAuth();
      const user = await auth.getUser(uid);
      return {
        id: user.uid,
        email: user.email || `${user.uid}@firebase.civicpulse.local`,
        display_name: user.displayName || user.email?.split('@')[0] || 'User',
        role: (user.customClaims?.role as any) || 'CITIZEN',
        status: user.disabled ? ('SUSPENDED' as any) : ('ACTIVE' as any),
        created_at: user.metadata.creationTime,
        updated_at: user.metadata.lastSignInTime || user.metadata.creationTime
      };
    } catch {
      return null;
    }
  }
}
