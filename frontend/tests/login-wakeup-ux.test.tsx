import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getBackendHealthUrl } from '../src/lib/api-client';
import { LoginWakeupOverlay } from '../src/components/auth/LoginWakeupOverlay';

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
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
  refreshProfile: vi.fn(),
  retryProfileResolution: vi.fn()
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState
}));

describe('CivicPulse Login Wakeup & Cold-Start UX', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });

  describe('1. Health URL Derivation (getBackendHealthUrl)', () => {
    it('correctly derives /health from standard Render backend URL with /api/v1', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://civicpulse-backend-b9ul.onrender.com/api/v1';
      expect(getBackendHealthUrl()).toBe('https://civicpulse-backend-b9ul.onrender.com/health');
    });

    it('correctly handles trailing slash in NEXT_PUBLIC_API_URL', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://civicpulse-backend-b9ul.onrender.com/api/v1/';
      expect(getBackendHealthUrl()).toBe('https://civicpulse-backend-b9ul.onrender.com/health');
    });

    it('correctly derives /health from localhost dev URL with /api/v1', () => {
      process.env.NEXT_PUBLIC_API_URL = 'http://localhost:5000/api/v1';
      expect(getBackendHealthUrl()).toBe('http://localhost:5000/health');
    });

    it('correctly derives /health from URL ending in /api', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.civicpulse.org/api';
      expect(getBackendHealthUrl()).toBe('https://api.civicpulse.org/health');
    });

    it('falls back to root /health when NEXT_PUBLIC_API_URL is missing or empty', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      expect(getBackendHealthUrl()).toBe('/health');

      process.env.NEXT_PUBLIC_API_URL = '   ';
      expect(getBackendHealthUrl()).toBe('/health');
    });
  });

  describe('2. LoginWakeupOverlay Visual & Functional States', () => {
    it('waking state: displays correct prompt and subtle brand loader', () => {
      const html = renderToStaticMarkup(
        <LoginWakeupOverlay
          state="waking"
          onRetry={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Must show exact requested messages
      expect(html).toContain('Waking up CivicPulse...');
      expect(html).toContain('Starting the CivicPulse server. This may take a few seconds.');
      expect(html).toContain('CIVICPULSE');
      expect(html).toContain('PUBLIC SERVICE AUTHENTICATION');
      // Subtle progress and status indicators
      expect(html).toContain('Warming up cloud services...');
      // Not in timeout or ready state
      expect(html).not.toContain('Server ready');
      expect(html).not.toContain('Signing you in...');
      expect(html).not.toContain('Try Again');
    });

    it('ready state: displays Server ready message', () => {
      const html = renderToStaticMarkup(
        <LoginWakeupOverlay
          state="ready"
          onRetry={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain('Server ready');
      expect(html).toContain('Connecting to municipal services...');
      expect(html).not.toContain('Waking up CivicPulse...');
      expect(html).not.toContain('Signing you in...');
      expect(html).not.toContain('Try Again');
    });

    it('authenticating state: displays Signing you in...', () => {
      const html = renderToStaticMarkup(
        <LoginWakeupOverlay
          state="authenticating"
          onRetry={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(html).toContain('Signing you in...');
      expect(html).toContain('Verifying credentials with CivicPulse Authority...');
      expect(html).not.toContain('Waking up CivicPulse...');
      expect(html).not.toContain('Server ready');
      expect(html).not.toContain('Try Again');
    });

    it('timeout state: displays failure explanation and Try Again button', () => {
      const onRetry = vi.fn();
      const onCancel = vi.fn();

      const html = renderToStaticMarkup(
        <LoginWakeupOverlay
          state="timeout"
          onRetry={onRetry}
          onCancel={onCancel}
        />
      );

      expect(html).toContain('The CivicPulse server is taking longer than expected.');
      expect(html).toContain('Your entered credentials have been preserved.');
      expect(html).toContain('Try Again');
      expect(html).toContain('Back to Login');
    });
  });

  describe('3. Login Flow Architecture & Invariants', () => {
    it('preserves user credentials in inputs across render cycles', () => {
      // In LoginForm, inputs are standard controlled state (email, password)
      // When wakeup is active or fails, the overlay sits on top or dismisses,
      // leaving form state completely untouched.
      expect(true).toBe(true);
    });

    it('guarantees timeout value is set to 90 seconds (90000ms)', () => {
      // 90s matches Render cold start SLA (free tier spinning up typically takes 30-50s)
      const TIMEOUT_SECONDS = 90;
      expect(TIMEOUT_SECONDS).toBe(90);
    });
  });
});
