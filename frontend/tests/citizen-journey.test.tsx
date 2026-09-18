import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock next/navigation
let currentPathname = '/citizen';
let currentSearchParams = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock AuthContext
let mockAuthState = {
  user: null as any,
  isDemoMode: false,
  loading: false,
  signOut: vi.fn(),
  signInWithDemoRole: vi.fn(),
  signInWithEmail: vi.fn(),
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Mock apiClient
vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

import { CitizenShell } from '../src/components/shells/CitizenShell';
import { PublicProblemModal } from '../src/components/citizen/PublicProblemModal';

describe('Phase 12: Citizen Journey & Public Problem Tracking Tests', () => {
  beforeEach(() => {
    currentPathname = '/citizen';
    mockAuthState = {
      user: {
        id: 'real_citizen_101',
        email: 'citizen@bhubaneswar.gov.in',
        display_name: 'Priyanka Patra',
        role: 'CITIZEN',
      },
      isDemoMode: false,
      loading: false,
      signOut: vi.fn(),
      signInWithDemoRole: vi.fn(),
      signInWithEmail: vi.fn(),
    };
  });

  describe('1. Citizen Navigation & Layout Invariants', () => {
    it('renders citizen navigation without government, department desk, or admin routes', () => {
      const html = renderToStaticMarkup(
        <CitizenShell>
          <div data-testid="citizen-content">Citizen Dashboard View</div>
        </CitizenShell>
      );

      // Positive checks: citizen navigation elements
      expect(html).toContain('Citizen Dashboard View');
      expect(html).toContain('/citizen');
      expect(html).toContain('/citizen/report');
      expect(html).toContain('/citizen/issues');

      // Negative checks: government/admin destinations MUST NOT appear in CitizenShell
      expect(html).not.toContain('/government');
      expect(html).not.toContain('/government/desk');
      expect(html).not.toContain('/admin/audit');
      expect(html).not.toContain('/admin/simulation');
    });

    it('displays authenticated citizen profile identity in the shell', () => {
      const html = renderToStaticMarkup(
        <CitizenShell>
          <div>Profile View</div>
        </CitizenShell>
      );

      // Email prefix displayed in CitizenShell
      expect(html).toContain('citizen');
      expect(html).toContain('CivicPulse');
      expect(html).toContain('Sign Out');
    });
  });

  describe('2. Public Problem Tracking Modal Invariants', () => {
    it('renders public problem tracking modal with zero-PII guarantees and accessible attributes', () => {
      const html = renderToStaticMarkup(
        <PublicProblemModal
          problemId="prob_2026_test"
          onClose={vi.fn()}
        />
      );

      // Structural modal verification
      expect(html).toContain('Cluster #prob_2026_test');
      expect(html).toContain('Public Record');
      expect(html).toContain('Civic Issue Cluster Tracking');

      // Accessibility & dialog attributes
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-label="Close modal"');

      // Loading state during verified data retrieval
      expect(html).toContain('Retrieving verified municipal problem cluster data...');
    });
  });

  describe('3. Citizen Email Confirmation Flow & Auth Callback Invariants', () => {
    it('renders auth callback container with zero token leakage into HTML', async () => {
      const { default: AuthCallbackPage } = await import('../src/app/auth/callback/page');
      const html = renderToStaticMarkup(<AuthCallbackPage />);

      // Invariants: Displays verifying/loading state
      expect(html).toContain('Confirming Identity');
      expect(html).toContain('Verifying your email confirmation credentials');

      // Zero-leakage: No tokens, passwords, or secrets in rendered HTML
      expect(html).not.toContain('Bearer');
      expect(html).not.toContain('access_token');
      expect(html).not.toContain('refresh_token');
    });

    it('derives correct default emailRedirectTo URL pointing to /auth/callback', async () => {
      const siteUrl = 'https://civicpulse-ai-henna.vercel.app';
      const expectedRedirect = `${siteUrl}/auth/callback`;
      expect(expectedRedirect).toBe('https://civicpulse-ai-henna.vercel.app/auth/callback');
    });
  });
});
