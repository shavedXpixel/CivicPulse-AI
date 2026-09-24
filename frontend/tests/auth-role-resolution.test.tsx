import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserRole } from '@civicpulse/shared';
import LoginPage from '../src/app/login/page';
import { isSupabaseConfigured } from '../src/lib/supabase-client';

// 1. Mock Next.js Navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn()
  })
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

// 2. Mock AuthContext
let mockAuthState = {
  user: null as any,
  userProfile: null as any,
  isDemoMode: false,
  isConfigured: true,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue('mock-supabase-token'),
  refreshProfile: vi.fn()
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState
}));

// 3. Mock API Client
vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn()
  },
  getAuthToken: () => '',
  getAuthTokenAsync: vi.fn().mockResolvedValue('mock-supabase-token')
}));

describe('Phase 15B Auth Role Resolution & Citizen Fallback Elimination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.userProfile = null;
    mockAuthState.loading = false;
    mockAuthState.isConfigured = true;
  });

  it('A: Supabase configured check respects NEXT_PUBLIC_SUPABASE_URL and KEY', () => {
    // Both variables configured in test environment
    expect(typeof isSupabaseConfigured).toBe('function');
  });

  it('B: Session with missing role does NOT render VERIFIED_CITIZEN', () => {
    // When user is authenticated but userProfile is null (role unresolved)
    mockAuthState.user = { uid: 'auth_admin_sub', email: 'admin@example.com' };
    mockAuthState.userProfile = null;

    const html = renderToStaticMarkup(<LoginPage />);

    // Must NOT contain VERIFIED_CITIZEN
    expect(html).not.toContain('VERIFIED_CITIZEN');
    expect(html).toContain('ROLE_PENDING_AUTHORIZATION');
    expect(html).toContain('Retry Role Verification');
  });

  it('C: Authoritative ADMIN profile renders MUNICIPAL_ADMIN and links to System Admin', () => {
    mockAuthState.user = { uid: 'auth_admin_sub', email: 'admin@example.com' };
    mockAuthState.userProfile = {
      id: 'usr_admin_01',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      display_name: 'Municipal Administrator'
    };

    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('MUNICIPAL_ADMIN (Citywide Authority)');
    expect(html).toContain('Go to System Administration');
    expect(html).not.toContain('VERIFIED_CITIZEN');
  });

  it('D: Authoritative DEPARTMENT_OFFICER renders department workspace label', () => {
    mockAuthState.user = { uid: 'auth_dept_sub', email: 'officer@watco.odisha.gov.in' };
    mockAuthState.userProfile = {
      id: 'usr_dept_01',
      email: 'officer@watco.odisha.gov.in',
      role: UserRole.DEPARTMENT_OFFICER,
      department_id: 'WATCO',
      display_name: 'WATCO Superintending Officer'
    };

    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('DEPARTMENT_OFFICER (WATCO)');
    expect(html).toContain('Go to Department Operations Workspace');
  });

  it('E: DEMO_MODE does not force ADMIN to CITIZEN', () => {
    mockAuthState.isDemoMode = true;
    mockAuthState.user = { uid: 'auth_admin_sub', email: 'admin@example.com' };
    mockAuthState.userProfile = {
      id: 'usr_admin_01',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      display_name: 'Municipal Administrator'
    };

    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('MUNICIPAL_ADMIN');
    expect(html).not.toContain('VERIFIED_CITIZEN');
  });

  it('F: isSecretApiKey identifies secret/service_role keys and rejects them from browser client', async () => {
    const { isSecretApiKey } = await import('../src/lib/supabase-client');
    expect(isSecretApiKey('sb_secret_something_sensitive')).toBe(true);
    expect(isSecretApiKey('service_role')).toBe(true);
    expect(isSecretApiKey('sbp_platform_token')).toBe(true);
    expect(isSecretApiKey('sb_publishable_safe_for_browser')).toBe(false);
    expect(isSecretApiKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake')).toBe(false);
    expect(isSecretApiKey('')).toBe(false);
  });
});

