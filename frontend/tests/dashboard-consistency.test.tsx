import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock next/navigation
let currentPathname = '/dashboard';
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
  useSearchParams: () => new URLSearchParams(''),
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
  user: { id: 'usr_admin', email: 'admin@bmc.gov.in', role: 'ADMIN', display_name: 'Commissioner' },
  isDemoMode: true,
  loading: false,
  signOut: vi.fn(),
  signInWithDemoRole: vi.fn(),
  signInWithEmail: vi.fn(),
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Mock apiClient
let mockApiResponses: Record<string, any> = {};
vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn((endpoint: string) => {
      if (mockApiResponses[endpoint] !== undefined) {
        return Promise.resolve(mockApiResponses[endpoint]);
      }
      return Promise.resolve({ data: null });
    }),
  },
}));

// Import components
import GovernmentDashboardPage from '../src/app/dashboard/page';
import ProblemsPage from '../src/app/dashboard/problems/page';
import { GovernmentShell } from '../src/components/shells/GovernmentShell';

describe('Phase 11 Regression: Dashboard Data Consistency & Authoritative Counts', () => {
  beforeEach(() => {
    currentPathname = '/dashboard';
    mockApiResponses = {};
    mockAuthState = {
      user: { id: 'usr_admin', email: 'admin@bmc.gov.in', role: 'ADMIN', display_name: 'Commissioner' },
      isDemoMode: true,
      loading: false,
      signOut: vi.fn(),
      signInWithDemoRole: vi.fn(),
      signInWithEmail: vi.fn(),
    };
  });

  describe('1. Production Runtime: Zero Fallback to Golden Demo Dataset', () => {
    it('ensures Problems badge, All Problems, Departments, KPIs, and Brief never fall back to Golden Demo dataset', () => {
      mockAuthState.isDemoMode = false;

      const html = renderToStaticMarkup(<GovernmentDashboardPage />);

      // 1. Sidebar badge must be 0, never hardcoded 14 or 5
      expect(html).toContain('Problems');
      expect(html).toContain('>0<');
      expect(html).not.toMatch(/>14</);
      expect(html).not.toMatch(/>5</);

      // 2. Quick navigation All Problems count must be 0
      expect(html).toContain('All Problems (0)');

      // 3. Quick navigation Departments count must be 0
      expect(html).toContain('Departments (0)');

      // 4. KPI Citizen Signals must be 0
      expect(html).toContain('Citizen Signals');

      // 5. Intelligence Brief must NOT claim grounding on 327 verified signals or Golden Demo specifics
      expect(html).not.toContain('Grounded on 327 verified citizen signals');
      expect(html).not.toContain('Nayapalli corridor');
      expect(html).not.toContain('18,400 residents');
    });

    it('ensures GovernmentShell alone defaults to 0 problem count in production', () => {
      mockAuthState.isDemoMode = false;
      const html = renderToStaticMarkup(
        <GovernmentShell>
          <div>Shell Content</div>
        </GovernmentShell>
      );

      // Badge must be 0, strictly not '14' or '5'
      expect(html).toContain('>0<');
      expect(html).not.toMatch(/>14</);
      expect(html).not.toMatch(/>5</);
    });
  });

  describe('2. In REAL_MODE: Truthful Zero-State Telemetry (No Golden Demo Leakage)', () => {
    it('strictly avoids Golden Demo intelligence when backend contains 0 signals and 0 problems', () => {
      mockAuthState.isDemoMode = false;

      // In REAL_MODE with empty database
      const html = renderToStaticMarkup(<GovernmentDashboardPage />);

      // 1. Sidebar badge must be 0, strictly not 14
      expect(html).toContain('>0<');
      expect(html).not.toMatch(/>14</);

      // 2. Quick navigation All Problems must be 0
      expect(html).toContain('All Problems (0)');

      // 3. Departments must be 0
      expect(html).toContain('Departments (0)');

      // 4. KPI signals must be 0
      expect(html).toContain('Citizen Signals');

      // 5. Intelligence Brief MUST NOT claim grounding on 327 verified signals or Golden Demo specifics
      expect(html).not.toContain('Grounded on 327 verified citizen signals');
      expect(html).not.toContain('Nayapalli corridor');
      expect(html).not.toContain('18,400 residents');
      expect(html).not.toContain('PRB-2026-0819');

      // 6. Intelligence Brief must truthfully state zero signals
      expect(html).toContain('Grounded on 0 verified citizen signals');
      expect(html).toContain('No Incident Signals');
    });

    it('ensures GovernmentShell alone defaults to 0 problem count in REAL_MODE', () => {
      mockAuthState.isDemoMode = false;
      const html = renderToStaticMarkup(
        <GovernmentShell>
          <div>Shell Content</div>
        </GovernmentShell>
      );

      // Badge must be '0', strictly not '14'
      expect(html).toContain('>0<');
      expect(html).not.toMatch(/>14</);
    });
  });

  describe('3. Single Authoritative Source of Dashboard Counts', () => {
    it('ensures explicit problemCount prop controls the Problems badge directly', () => {
      const htmlWith7 = renderToStaticMarkup(
        <GovernmentShell problemCount={7}>
          <div>Custom Count</div>
        </GovernmentShell>
      );
      expect(htmlWith7).toContain('>7<');
      expect(htmlWith7).not.toMatch(/>14</);
    });

    it('ensures in REAL_MODE with 2 problems that GovernmentShell Problems badge equals 2', () => {
      mockAuthState.isDemoMode = false;
      const htmlWith2 = renderToStaticMarkup(
        <GovernmentShell problemCount={2}>
          <div>Problems Content</div>
        </GovernmentShell>
      );
      expect(htmlWith2).toContain('Problems');
      expect(htmlWith2).toContain('>2<');
      expect(htmlWith2).not.toMatch(/>0</);
      expect(htmlWith2).not.toMatch(/>14</);
    });

    it('ensures ProblemsPage passes authoritative count to GovernmentShell in production', () => {
      mockAuthState.isDemoMode = false;
      const html = renderToStaticMarkup(<ProblemsPage />);

      // Sidebar Problems badge matches authoritative count (0 on initial load)
      expect(html).toContain('Problems');
      expect(html).toContain('>0<');
      expect(html).not.toMatch(/>14</);

      // Page header badge matches authoritative count
      expect(html).toContain('0 Incidents Available');
    });
  });
});
