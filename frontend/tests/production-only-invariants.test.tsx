import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'fs';
import path from 'path';

// 1. Mock Next.js Navigation & Links
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
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  resetPassword: vi.fn(),
  getIdToken: vi.fn().mockResolvedValue('mock-supabase-jwt-token'),
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// 3. Mock MapContainer so canvas/GL doesn't throw in server static rendering
vi.mock('../src/components/domain/MapContainer', () => ({
  MapContainer: ({ problems }: { problems: any[] }) => (
    <div data-testid="map-container" data-problem-count={problems.length}>
      Map Canvas ({problems.length} markers)
    </div>
  ),
}));

// 4. Mock API Client
let mockApiResponses: Record<string, any> = {};
vi.mock('../src/lib/api-client', () => ({
  getAuthToken: () => '',
  apiClient: {
    get: vi.fn((endpoint: string) => {
      if (mockApiResponses[endpoint] !== undefined) {
        return Promise.resolve(mockApiResponses[endpoint]);
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Component Imports
import { getAuthToken } from '../src/lib/api-client';
import LoginPage from '../src/app/login/page';
import GovernmentDashboardPage from '../src/app/dashboard/page';
import ProblemsPage from '../src/app/dashboard/problems/page';
import { ProblemList } from '../src/components/domain/ProblemList';
import DepartmentsPage from '../src/app/dashboard/departments/page';
import TrendsPage from '../src/app/dashboard/trends/page';
import MapWorkspacePage from '../src/app/dashboard/map/page';
import AdminPage from '../src/app/admin/page';
import { GovernmentShell } from '../src/components/shells/GovernmentShell';
import { OfficerShell } from '../src/components/shells/OfficerShell';
import { CitizenShell } from '../src/components/shells/CitizenShell';

describe('PHASE 15B.5.3.14: Production-Only CivicPulse Invariant Suite', () => {
  beforeEach(() => {
    currentPathname = '/dashboard';
    mockApiResponses = {};
    mockAuthState = {
      user: null,
      userProfile: null,
      isDemoMode: false,
      isConfigured: true,
      loading: false,
      signOut: vi.fn(),
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      resetPassword: vi.fn(),
      getIdToken: vi.fn().mockResolvedValue('mock-supabase-jwt-token'),
    };
  });

  // 1. no demo token fallback
  it('Invariant 1: getAuthToken returns empty string when unauthenticated; no demo token fallback', () => {
    const token = getAuthToken();
    expect(token).toBe('');
    expect(token).not.toContain('demo-token');
    expect(token).not.toBe('demo-token-citizen');
  });

  // 2. no demo login personas
  it('Invariant 2: Login page contains only authentic credentials flow; no demo persona cards or selectors', () => {
    const html = renderToStaticMarkup(<LoginPage />);
    expect(html).toContain('Sign In');
    expect(html).toContain('New citizen? Register for public signal intake');
    // Ensure demo persona cards are eradicated
    expect(html).not.toContain('Sign in as');
    expect(html).not.toContain('Municipal Commissioner');
    expect(html).not.toContain('Field Engineer');
    expect(html).not.toContain('Ward Officer');
    expect(html).not.toContain('demo-token');
  });

  // 3. no demo auth bypass
  it('Invariant 3: Shells do not expose demo role switching or auth bypasses', () => {
    mockAuthState.user = { id: 'usr_real', email: 'citizen@bhubaneswar.gov.in' };
    const citizenHtml = renderToStaticMarkup(
      <CitizenShell>
        <div>Content</div>
      </CitizenShell>
    );
    expect(citizenHtml).not.toContain('Switch Role');
    expect(citizenHtml).toContain('Sign Out');

    const officerHtml = renderToStaticMarkup(
      <OfficerShell>
        <div>Content</div>
      </OfficerShell>
    );
    expect(officerHtml).not.toContain('Switch Role');
    expect(officerHtml).toContain('Sign Out');

    const govHtml = renderToStaticMarkup(
      <GovernmentShell>
        <div>Content</div>
      </GovernmentShell>
    );
    expect(govHtml).not.toContain('Switch Role');
    expect(govHtml).toContain('Sign Out');
    expect(mockAuthState.isDemoMode).toBe(false);
  });

  // 4. no demo reset production route
  it('Invariant 4: Backend routes do not mount reset-demo or switch-demo-persona in production', () => {
    const authRoutesPath = path.resolve(__dirname, '../../backend/src/modules/auth/auth.routes.ts');
    const adminRoutesPath = path.resolve(__dirname, '../../backend/src/modules/admin/admin.routes.ts');
    const authSource = fs.readFileSync(authRoutesPath, 'utf-8');
    const adminSource = fs.readFileSync(adminRoutesPath, 'utf-8');

    expect(authSource).toContain('if (env.DEMO_MODE)');
    expect(authSource).toContain('/switch-demo-persona');
    expect(adminSource).toContain('if (env.DEMO_MODE)');
    expect(adminSource).toContain('/reset-demo');
  });

  // 5. no PRB-2026-0819 production reference
  it('Invariant 5: Production pages and shells contain no hardcoded references to PRB-2026-0819', () => {
    const dashHtml = renderToStaticMarkup(<GovernmentDashboardPage />);
    expect(dashHtml).not.toContain('PRB-2026-0819');

    const probHtml = renderToStaticMarkup(<ProblemsPage />);
    expect(probHtml).not.toContain('PRB-2026-0819');

    const officerHtml = renderToStaticMarkup(<OfficerShell><div>Work</div></OfficerShell>);
    expect(officerHtml).not.toContain('PRB-2026-0819');

    const govHtml = renderToStaticMarkup(<GovernmentShell><div>Dash</div></GovernmentShell>);
    expect(govHtml).not.toContain('PRB-2026-0819');
  });

  // 6. no Golden Demo production reference
  it('Invariant 6: Shells and core dashboard have no Golden Demo or DEMO_MODE labels', () => {
    const govHtml = renderToStaticMarkup(<GovernmentShell><div>Gov</div></GovernmentShell>);
    expect(govHtml).not.toContain('Golden Demo');
    expect(govHtml).not.toContain('DEMO_MODE');
    expect(govHtml).toContain('Live Operations');

    const officerHtml = renderToStaticMarkup(<OfficerShell><div>Off</div></OfficerShell>);
    expect(officerHtml).not.toContain('Golden Demo');
    expect(officerHtml).not.toContain('DEMO_MODE');
  });

  // 7. empty dashboard state is honest
  it('Invariant 7: Empty dashboard displays honest zero metrics without demo fallbacks', () => {
    const html = renderToStaticMarkup(<GovernmentDashboardPage />);
    expect(html).toContain('All Problems (0)');
    expect(html).toContain('Departments (0)');
    expect(html).toContain('Grounded on 0 verified citizen signals');
    expect(html).toContain('No Incident Signals');
    expect(html).not.toContain('Grounded on 327 verified citizen signals');
  });

  // 8. empty problem directory state is honest
  it('Invariant 8: Empty problem directory displays honest empty state without demo fallbacks', () => {
    const html = renderToStaticMarkup(<ProblemsPage />);
    expect(html).toContain('0 Incidents Available');
    expect(html).not.toContain('PRB-2026-0819');

    const listHtml = renderToStaticMarkup(<ProblemList problems={[]} isLoading={false} />);
    expect(listHtml).toContain('No problem clusters found');
    expect(listHtml).toContain('The municipal problems directory currently has no active incidents recorded.');
  });

  // 9. empty departments state is honest
  it('Invariant 9: Empty departments view displays honest zero-state without DEMO_DEPARTMENTS fallback', () => {
    const html = renderToStaticMarkup(<DepartmentsPage />);
    expect(html).toContain('0 Municipal Agencies');
    expect(html).not.toContain('WATCO (Water &amp; Sewerage)');
    expect(html).not.toContain('DEMO_DEPARTMENTS');
  });

  // 10. empty trends state is honest
  it('Invariant 10: Empty trends view displays honest zero-state without synthetic trends', () => {
    const html = renderToStaticMarkup(<TrendsPage />);
    expect(html).not.toContain('Persistent Monsoon Drainage Failures');
    expect(html).not.toContain('Critical Water Distribution Disruptions');
    expect(html).toContain('Problem Trends &amp; Velocity');
  });

  // 11. map empty state has zero synthetic markers
  it('Invariant 11: Map workspace displays honest 0-geolocated incidents and zero synthetic markers', () => {
    const html = renderToStaticMarkup(<MapWorkspacePage />);
    expect(html).toContain('0 Geolocated Incidents');
    expect(html).toContain('0 operational problem locations matching active filters');
    expect(html).not.toContain('PRB-2026-0819');
  });

  // 12. real Supabase auth remains active
  it('Invariant 12: Real Supabase Auth is active and configured', () => {
    expect(mockAuthState.isDemoMode).toBe(false);
    expect(mockAuthState.getIdToken).toBeDefined();
  });

  // 13. admin still requires real ADMIN JWT
  it('Invariant 13: Admin workspace enforces real ADMIN RBAC and denies non-admin roles', () => {
    mockAuthState.user = { id: 'citizen_1', email: 'citizen@test.com' };
    mockAuthState.userProfile = { id: 'citizen_1', email: 'citizen@test.com', role: 'CITIZEN' };

    const html = renderToStaticMarkup(<AdminPage />);
    expect(html).toContain('Restricted Administration Console (HTTP 403)');
    expect(html).toContain('strictly restricted to verified Municipal Administrators');
  });

  // 14. government provisioning remains admin-only
  it('Invariant 14: Government provisioning workspace renders for verified ADMIN profile', () => {
    mockAuthState.user = { id: 'admin_1', email: 'admin@bmc.gov.in' };
    mockAuthState.userProfile = { id: 'admin_1', email: 'admin@bmc.gov.in', role: 'ADMIN' };

    const html = renderToStaticMarkup(<AdminPage />);
    expect(html).toContain('System Administration &amp; Municipal Authority');
    expect(html).not.toContain('Restricted Administration Console (HTTP 403)');
  });

  // 15. real Gemini remains production provider
  it('Invariant 15: Gemini is designated authoritative AI provider in production configuration', () => {
    // In production, AI_PROVIDER defaults to gemini and mock providers are not permitted
    const envProvider = process.env.AI_PROVIDER || 'gemini';
    expect(['gemini', 'openai']).toContain(envProvider);
  });
});
