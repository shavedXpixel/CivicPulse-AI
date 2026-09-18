import { UserProfile } from '@civicpulse/shared';

export interface AuthTokenPayload {
  uid: string; // Supabase Auth UUID (sub claim)
  email?: string;
  name?: string;
  role?: string;
  aud?: string;
  iss?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface IAuthProvider {
  verifyToken(token: string): Promise<AuthTokenPayload>;
  getUserById?(uid: string): Promise<UserProfile | null>;
}
