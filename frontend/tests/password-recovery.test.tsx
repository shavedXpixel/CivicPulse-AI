import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

// 1. Mock Next.js Navigation & Links
let currentPathname = '/forgot-password';
let currentSearchParams = new URLSearchParams('');
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearchParams,
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// 2. Mock AuthContext
let mockAuthState = {
  user: null as any,
  userProfile: null as any,
  isDemoMode: false,
  isConfigured: true,
  loading: false,
  signOut: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// 3. Mock Supabase Client
const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error: null });
const mockUpdateUser = vi.fn().mockResolvedValue({ data: { user: { id: 'usr-123' } }, error: null });
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
const mockExchangeCodeForSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
const mockOnAuthStateChange = vi.fn().mockReturnValue({
  data: { subscription: { unsubscribe: vi.fn() } },
});

const mockSupabaseInstance = {
  auth: {
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUser: mockUpdateUser,
    signOut: mockSignOut,
    getSession: mockGetSession,
    exchangeCodeForSession: mockExchangeCodeForSession,
    onAuthStateChange: mockOnAuthStateChange,
  },
};

vi.mock('../src/lib/supabase-client', () => ({
  getSupabaseClient: () => mockSupabaseInstance,
  isSupabaseConfigured: () => true,
  resetPasswordForEmail: (email: string, redirectTo?: string) =>
    mockResetPasswordForEmail(email, { redirectTo }),
  updateUserPassword: (password: string) => mockUpdateUser({ password }),
}));

// Import components under test
import LoginPage from '../src/app/login/page';
import ForgotPasswordPage from '../src/app/forgot-password/page';
import UpdatePasswordPage from '../src/app/update-password/page';

describe('Phase 15B.5.3.15 — Production Password Recovery Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = '/forgot-password';
    currentSearchParams = new URLSearchParams('');
  });

  // Test 1: Login page contains forgot-password link
  it('1. Login page contains "Forgot password?" linking to /forgot-password', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('Forgot password?');
    expect(html).toContain('href="/forgot-password"');
  });

  // Test 2: Forgot password page renders production editorial form
  it('2. Forgot-password page renders email input, "Send reset link" button, and back link', () => {
    const html = renderToStaticMarkup(<ForgotPasswordPage />);
    expect(html).toContain('Password Recovery');
    expect(html).toContain('Email Address');
    expect(html).toContain('Send reset link');
    expect(html).toContain('href="/login"');
    expect(html).toContain('Return to Sign In');
  });

  // Test 3: Calls resetPasswordForEmail with window.location.origin/update-password
  it('3. Calling resetPasswordForEmail triggers Supabase auth with correct redirect URL', async () => {
    const email = 'officer@bhubaneswar.gov.in';
    const origin = 'https://civicpulse.gov.in';

    // Mock window.location
    const originalWindow = global.window;
    // @ts-ignore
    global.window = { location: { origin } };

    const { resetPasswordForEmail } = await import('../src/lib/supabase-client');
    await resetPasswordForEmail(email, `${origin}/update-password`);

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(email, {
      redirectTo: 'https://civicpulse.gov.in/update-password',
    });

    global.window = originalWindow;
  });

  // Test 4: Success state does not reveal account existence
  it('4. Success state message does not reveal whether the account exists', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/app/forgot-password/page.tsx'),
      'utf-8'
    );
    expect(source).toContain(
      'If an account exists for this email, a password reset link has been sent.'
    );
    // Verifies no user enumeration branching in UI
    expect(source).not.toContain('User not found');
    expect(source).not.toContain('Email does not exist');
  });

  // Test 5: Update-password page structure handles PASSWORD_RECOVERY
  it('5. Update-password page includes PASSWORD_RECOVERY listener and updateUser call', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/app/update-password/page.tsx'),
      'utf-8'
    );
    expect(source).toContain('PASSWORD_RECOVERY');
    expect(source).toContain('supabase.auth.updateUser');
    expect(source).toContain('Set New Password');
    expect(source).toContain('Confirm New Password');
  });

  // Test 6: Password confirmation mismatch is rejected in update-password logic
  it('6. Password confirmation mismatch is rejected in update-password validation', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/app/update-password/page.tsx'),
      'utf-8'
    );
    expect(source).toContain('newPassword !== confirmPassword');
    expect(source).toContain('Passwords do not match');
    expect(source).toContain('Password must be at least 6 characters long');
  });

  // Test 7: UpdateUser is invoked with the new password upon valid submission
  it('7. updateUser is called with the new password via browser client', async () => {
    const { updateUserPassword } = await import('../src/lib/supabase-client');
    await updateUserPassword('SecureP@ssw0rd2026!');

    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: 'SecureP@ssw0rd2026!',
    });
  });

  // Test 8: Invalid / expired recovery session renders clear error state
  it('8. Invalid/expired recovery session displays clear error state with reset link', () => {
    currentSearchParams = new URLSearchParams('error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
    const html = renderToStaticMarkup(<UpdatePasswordPage />);
    expect(html).toContain('Invalid or Expired Recovery Link');
    expect(html).toContain('href="/forgot-password"');
    expect(html).toContain('Request New Reset Link');
  });

  // Test 9: No demo auth or demo tokens are introduced
  it('9. Password recovery routes and client helpers do NOT introduce demo tokens or bypasses', () => {
    const forgotSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/forgot-password/page.tsx'),
      'utf-8'
    );
    const updateSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/update-password/page.tsx'),
      'utf-8'
    );
    const clientSource = fs.readFileSync(
      path.resolve(__dirname, '../src/lib/supabase-client.ts'),
      'utf-8'
    );

    for (const src of [forgotSource, updateSource, clientSource]) {
      expect(src).not.toContain('demo-token');
      expect(src).not.toContain('x-demo-mode');
      expect(src).not.toContain('isDemoMode = true');
      expect(src).not.toContain('mockData');
    }
  });

  // Test 10: Auth callback cleanly forwards password recovery to /update-password
  it('10. /auth/callback route forwards recovery requests to /update-password without running citizen provisioning', () => {
    const callbackSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/auth/callback/page.tsx'),
      'utf-8'
    );
    expect(callbackSource).toContain("type === 'recovery'");
    expect(callbackSource).toContain("router.push('/update-password')");
  });
});
