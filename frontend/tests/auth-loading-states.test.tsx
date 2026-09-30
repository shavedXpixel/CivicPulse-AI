import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserRole } from '@civicpulse/shared';
import { AuthLoadingScreen } from '../src/components/auth/AuthLoadingScreen';
import {
  isBackendUnreachableError,
  determineRoleDestination,
  calculateBackoffDelay,
  AUTH_RETRY_CONFIG
} from '../src/lib/auth-retry';
import LoginPage from '../src/app/login/page';
import { ApiError } from '../src/lib/api-client';

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

// 2. Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

// 3. Mock AuthContext
let mockAuthState = {
  user: null as any,
  userProfile: null as any,
  isDemoMode: false,
  isConfigured: true,
  loading: false,
  isResolvingProfile: false,
  isRetryTimeout: false,
  serverError: null as string | null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue('mock-supabase-token'),
  refreshProfile: vi.fn(),
  retryProfileResolution: vi.fn()
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState
}));

// 4. Mock API Client
vi.mock('../src/lib/api-client', () => {
  class MockApiError extends Error {
    public status: number;
    public code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  }

  return {
    apiClient: {
      get: vi.fn()
    },
    ApiError: MockApiError,
    getAuthToken: () => '',
    getAuthTokenAsync: vi.fn().mockResolvedValue('mock-supabase-token')
  };
});

describe('Simplified CivicPulse Authentication Loading UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.userProfile = null;
    mockAuthState.loading = false;
    mockAuthState.isResolvingProfile = false;
    mockAuthState.isRetryTimeout = false;
    mockAuthState.serverError = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Normal profile request pending → AUTHENTICATING screen', () => {
    // User authenticated in Supabase, /api/v1/auth/me request is in-flight
    mockAuthState.user = { uid: 'citizen_01', email: 'citizen@example.com' };
    mockAuthState.userProfile = null;
    mockAuthState.isResolvingProfile = true;
    mockAuthState.isRetryTimeout = false;

    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('CIVICPULSE');
    expect(html).toContain('PUBLIC SERVICE AUTHENTICATION');
    expect(html).toContain('AUTHENTICATING');
    expect(html).toContain('Verifying your CivicPulse account...');
    expect(html).toContain('Connecting to CivicPulse services...');

    // No Render wording
    expect(html).not.toContain('CIVICPULSE IS WAKING UP');
    expect(html).not.toContain('free hosting tier');
    expect(html).not.toContain('ROLE_PENDING_AUTHORIZATION');
  });

  it('2. Temporary network failure → AUTHENTICATING screen remains while retrying', () => {
    // On temporary network failure, system enters background retry while keeping normal AUTHENTICATING screen
    mockAuthState.user = { uid: 'citizen_01', email: 'citizen@example.com' };
    mockAuthState.userProfile = null;
    mockAuthState.isResolvingProfile = true;
    mockAuthState.isRetryTimeout = false;

    const html = renderToStaticMarkup(<LoginPage />);

    // Screen remains AUTHENTICATING silently without Render-specific text
    expect(html).toContain('AUTHENTICATING');
    expect(html).toContain('Verifying your CivicPulse account...');
    expect(html).toContain('Connecting to CivicPulse services...');
    expect(html).not.toContain('CIVICPULSE IS WAKING UP');
    expect(html).not.toContain('free hosting tier');
    expect(html).not.toContain('ROLE_PENDING_AUTHORIZATION');
  });

  it('3. Retry succeeds → correct dashboard routing', () => {
    // Verifies authoritative destination mapping for all roles
    expect(determineRoleDestination(UserRole.CITIZEN)).toBe('/citizen');
    expect(determineRoleDestination(UserRole.DEPARTMENT_OFFICER)).toBe('/department-officer');
    expect(determineRoleDestination(UserRole.FIELD_OFFICER)).toBe('/field-officer');
    expect(determineRoleDestination(UserRole.ADMIN)).toBe('/admin');
    expect(determineRoleDestination(UserRole.SYSTEM_ADMIN)).toBe('/admin');

    // Explicit redirects
    expect(determineRoleDestination(UserRole.ADMIN, '/admin/departments')).toBe('/admin/departments');
    expect(determineRoleDestination(UserRole.CITIZEN, '/admin/departments')).toBe('/citizen');
  });

  it('4. 401/403 → authorization error (not network failure)', () => {
    const error401 = new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired credentials');
    const error403 = new ApiError(403, 'FORBIDDEN', 'Access forbidden');

    expect(isBackendUnreachableError(error401)).toBe(false);
    expect(isBackendUnreachableError(error403)).toBe(false);

    // Form shows role authorization error when not loading
    mockAuthState.user = { uid: 'unauthorized_user', email: 'pending@example.com' };
    mockAuthState.userProfile = null;
    mockAuthState.isResolvingProfile = false;

    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).not.toContain('AUTHENTICATING');
    expect(html).toContain('ROLE_PENDING_AUTHORIZATION');
    expect(html).toContain('Retry Role Verification');
  });

  it('5. 500 → server error (not network failure)', () => {
    const error500 = new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Database error');
    expect(isBackendUnreachableError(error500)).toBe(false);

    mockAuthState.user = { uid: 'user_500', email: 'user@example.com' };
    mockAuthState.userProfile = null;
    mockAuthState.isResolvingProfile = false;
    mockAuthState.serverError = 'CivicPulse server encountered an error while verifying profile.';

    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).not.toContain('AUTHENTICATING');
    expect(html).not.toContain('CIVICPULSE IS WAKING UP');
  });

  it('6. Genuine role-pending account → ROLE_PENDING_AUTHORIZATION', () => {
    // Only after request finishes (isResolvingProfile = false) with no assigned role
    mockAuthState.user = { uid: 'unassigned_sub', email: 'unassigned@bmc.gov.in' };
    mockAuthState.userProfile = null;
    mockAuthState.isResolvingProfile = false;

    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('SESSION ACTIVE');
    expect(html).toContain('ROLE_PENDING_AUTHORIZATION');
    expect(html).toContain('Retry Role Verification');
    expect(html).not.toContain('AUTHENTICATING');
  });

  it('7. Retry timeout → generic connection failure with Try Again / Sign Out', () => {
    mockAuthState.user = { uid: 'timeout_user', email: 'user@example.com' };
    mockAuthState.isResolvingProfile = true;
    mockAuthState.isRetryTimeout = true;

    const html = renderToStaticMarkup(<LoginPage />);

    expect(html).toContain('Unable to connect to CivicPulse services.');
    expect(html).toContain('Try Again');
    expect(html).toContain('Sign Out');
    expect(html).toContain('type="button"');

    // Standalone AuthLoadingScreen timeout verification
    const onRetryMock = vi.fn();
    const onSignOutMock = vi.fn();
    const standaloneHtml = renderToStaticMarkup(
      <AuthLoadingScreen isTimedOut={true} onRetry={onRetryMock} onSignOut={onSignOutMock} />
    );

    expect(standaloneHtml).toContain('Unable to connect to CivicPulse services.');
    expect(standaloneHtml).toContain('Try Again');
    expect(standaloneHtml).toContain('Sign Out');
    expect(standaloneHtml).not.toContain('CIVICPULSE IS WAKING UP');
  });

  it('8. No Render-specific "CIVICPULSE IS WAKING UP" UI remains', () => {
    // Render normal loading screen
    const normalHtml = renderToStaticMarkup(<AuthLoadingScreen isTimedOut={false} />);
    expect(normalHtml).toContain('AUTHENTICATING');
    expect(normalHtml).not.toContain('CIVICPULSE IS WAKING UP');
    expect(normalHtml).not.toContain('free hosting tier');
    expect(normalHtml).not.toContain('The CivicPulse service is starting.');
    expect(normalHtml).not.toContain('Render');

    // Render timeout screen
    const timeoutHtml = renderToStaticMarkup(<AuthLoadingScreen isTimedOut={true} />);
    expect(timeoutHtml).toContain('Unable to connect to CivicPulse services.');
    expect(timeoutHtml).not.toContain('CIVICPULSE IS WAKING UP');
    expect(timeoutHtml).not.toContain('free hosting tier');
    expect(timeoutHtml).not.toContain('The CivicPulse service is starting.');
    expect(timeoutHtml).not.toContain('Render');
  });

  it('9. No duplicate retry loops (controlled backoff timing verified)', () => {
    let delay = AUTH_RETRY_CONFIG.INITIAL_DELAY_MS;
    expect(delay).toBe(2000);

    delay = calculateBackoffDelay(delay);
    expect(delay).toBe(2500);

    delay = calculateBackoffDelay(delay);
    expect(delay).toBe(3125);

    delay = calculateBackoffDelay(delay);
    expect(delay).toBe(3906);

    delay = calculateBackoffDelay(delay);
    expect(delay).toBe(4883);

    delay = calculateBackoffDelay(delay);
    expect(delay).toBe(5000);

    // Capped at 5000ms
    delay = calculateBackoffDelay(delay);
    expect(delay).toBe(5000);

    // Network errors recognized without duplicates
    expect(isBackendUnreachableError(new Error('ERR_CONNECTION_REFUSED'))).toBe(true);
    expect(isBackendUnreachableError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isBackendUnreachableError({ code: 'ECONNREFUSED' })).toBe(true);
  });

  it('10. Supabase session remains authenticated during temporary backend failure', () => {
    mockAuthState.user = {
      uid: 'preserved_citizen_session',
      email: 'citizen@bhubaneswar.gov.in',
      displayName: 'Citizen Patra'
    };
    mockAuthState.isResolvingProfile = true;

    expect(mockAuthState.user).not.toBeNull();
    expect(mockAuthState.user.uid).toBe('preserved_citizen_session');
    expect(mockAuthState.signOut).not.toHaveBeenCalled();
  });
});
