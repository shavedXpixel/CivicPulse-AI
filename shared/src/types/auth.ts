export enum UserRole {
  CITIZEN = 'CITIZEN',
  FIELD_OFFICER = 'FIELD_OFFICER',
  DEPARTMENT_OFFICER = 'DEPARTMENT_OFFICER',
  ADMIN = 'ADMIN',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN'
}

export enum UserStatus {
  INVITED = 'INVITED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED'
}

export interface AdminAuditRecord {
  id: string;
  actor_user_id: string;
  actor_email?: string;
  action: string;
  target_user_id?: string;
  target_email: string;
  target_role: string;
  department_id?: string;
  result: string;
  details?: Record<string, any>;
  previous_hash?: string;
  record_hash: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  auth_user_id?: string;
  legacy_firebase_uid?: string;
  email?: string;
  display_name: string;
  photo_url?: string;
  role: UserRole;
  status: UserStatus;
  department_id?: string;
  ward_id?: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

export interface CitizenProfile {
  id: string;
  user_id: string;
  preferred_language: 'en' | 'hi' | 'od' | string;
  default_ward_id?: string;
  notification_enabled: boolean;
  created_at: string;
  updated_at: string;
}
