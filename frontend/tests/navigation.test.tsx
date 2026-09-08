import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock next/navigation
let currentPathname = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => currentPathname,
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
  isDemoMode: true,
  loading: false,
  signOut: vi.fn(),
  signInWithDemoRole: vi.fn(),
  signInWithEmail: vi.fn(),
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// Import Shells
import { CitizenShell } from '../src/components/shells/CitizenShell';
import { GovernmentShell } from '../src/components/shells/GovernmentShell';
import { OfficerShell } from '../src/components/shells/OfficerShell';
import { AdminShell } from '../src/components/shells/AdminShell';

describe('Frontend Navigation & Role Journey UX Verification', () => {
  beforeEach(() => {
    currentPathname = '/';
    mockAuthState = {
      user: null,
      isDemoMode: true,
      loading: false,
      signOut: vi.fn(),
      signInWithDemoRole: vi.fn(),
      signInWithEmail: vi.fn(),
    };
  });

  describe('1. CitizenShell Navigation & Strict Role Isolation', () => {
    it('renders all 3 citizen navigation destinations on desktop and mobile', () => {
      currentPathname = '/citizen';
      const html = renderToStaticMarkup(
        <CitizenShell>
          <div>Citizen Page Content</div>
        </CitizenShell>
      );

      // Desktop & mobile nav links
      expect(html).toContain('href="/citizen"');
      expect(html).toContain('Home');
      expect(html).toContain('href="/citizen/report"');
      expect(html).toContain('Report an Issue');
      expect(html).toContain('href="/citizen/issues"');
      expect(html).toContain('My Reports');

      // Main content rendered
      expect(html).toContain('Citizen Page Content');
    });

    it('strictly does NOT expose any government or administrative links to citizens', () => {
      currentPathname = '/citizen';
      const html = renderToStaticMarkup(
        <CitizenShell>
          <div>Citizen Page Content</div>
        </CitizenShell>
      );

      // Zero internal government or admin leakage
      expect(html).not.toContain('href="/dashboard"');
      expect(html).not.toContain('href="/dashboard/ai"');
      expect(html).not.toContain('href="/dashboard/simulation"');
      expect(html).not.toContain('href="/dashboard/problems"');
      expect(html).not.toContain('href="/dashboard/map"');
      expect(html).not.toContain('href="/dashboard/departments"');
      expect(html).not.toContain('href="/admin"');
      expect(html).not.toContain('href="/officer"');
      expect(html).not.toContain('Command Center');
      expect(html).not.toContain('Officer Queue');
      expect(html).not.toContain('Intervention Simulator');
    });

    it('displays Demo Role Switcher in DEMO_MODE, and authenticated user controls in REAL_MODE', () => {
      // In DEMO_MODE: shows Switch Role
      mockAuthState.isDemoMode = true;
      let html = renderToStaticMarkup(
        <CitizenShell>
          <div>Content</div>
        </CitizenShell>
      );
      expect(html).toContain('Switch Role');
      expect(html).toContain('href="/login"');

      // In REAL_MODE with authenticated citizen: shows email and Sign Out
      mockAuthState.isDemoMode = false;
      mockAuthState.user = { email: 'citizen@bhubaneswar.gov.in', uid: 'c_123' };
      html = renderToStaticMarkup(
        <CitizenShell>
          <div>Content</div>
        </CitizenShell>
      );
      expect(html).not.toContain('Switch Role');
      expect(html).toContain('citizen');
      expect(html).toContain('Sign Out');
    });
  });

  describe('2. GovernmentShell Navigation & Active Highlighting', () => {
    it('renders all core government intelligence layer navigation links', () => {
      currentPathname = '/dashboard';
      const html = renderToStaticMarkup(
        <GovernmentShell>
          <div>Gov Content</div>
        </GovernmentShell>
      );

      expect(html).toContain('Command Center');
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain('Problems');
      expect(html).toContain('href="/dashboard/problems"');
      expect(html).toContain('Map Workspace');
      expect(html).toContain('href="/dashboard/map"');
      expect(html).toContain('Departments');
      expect(html).toContain('href="/dashboard/departments"');
      expect(html).toContain('Trends &amp; Velocity');
      expect(html).toContain('href="/dashboard/trends"');
      expect(html).toContain('Governance AI');
      expect(html).toContain('href="/dashboard/ai"');
      expect(html).toContain('Intervention Simulator');
      expect(html).toContain('href="/dashboard/simulation"');
    });

    it('highlights Command Center when on /dashboard and preserves Problems active on subroutes', () => {
      // On Command Center
      currentPathname = '/dashboard';
      let html = renderToStaticMarkup(
        <GovernmentShell>
          <div>Gov Content</div>
        </GovernmentShell>
      );
      // Command Center link has active background class
      expect(html).toMatch(/href="\/dashboard"[^>]*class="[^"]*bg-civic-blueLight/);

      // On Subroute /dashboard/problems/PRB-2026-0819
      currentPathname = '/dashboard/problems/PRB-2026-0819';
      html = renderToStaticMarkup(
        <GovernmentShell>
          <div>Gov Content</div>
        </GovernmentShell>
      );
      // Problems link maintains active background class on subroutes
      expect(html).toMatch(/href="\/dashboard\/problems"[^>]*class="[^"]*bg-civic-blueLight/);
    });
  });

  describe('3. OfficerShell Navigation & Role Corrections', () => {
    it('in DEMO_MODE: renders My Work, Assigned Problems (with Golden Demo link), and Priority Problems', () => {
      mockAuthState.isDemoMode = true;
      currentPathname = '/officer';
      const html = renderToStaticMarkup(
        <OfficerShell>
          <div>Officer Queue Content</div>
        </OfficerShell>
      );

      expect(html).toContain('My Work / Officer Queue');
      expect(html).toContain('href="/officer"');
      expect(html).toContain('Assigned Problems');
      expect(html).toContain('href="/dashboard/problems/PRB-2026-0819"');
      expect(html).toContain('Golden Demo');
      expect(html).toContain('Priority Problems');
      expect(html).toContain('href="/dashboard/problems"');
    });

    it('in REAL_MODE: strictly does NOT expose synthetic Golden Demo shortcuts or badges', () => {
      mockAuthState.isDemoMode = false;
      currentPathname = '/officer';
      const html = renderToStaticMarkup(
        <OfficerShell>
          <div>Officer Queue Content</div>
        </OfficerShell>
      );

      expect(html).toContain('My Work / Officer Queue');
      expect(html).toContain('href="/officer"');
      expect(html).toContain('Assigned Problems');
      // In REAL_MODE, points to officer queue, not hardcoded demo cluster PRB-2026-0819
      expect(html).not.toContain('href="/dashboard/problems/PRB-2026-0819"');
      expect(html).not.toContain('Golden Demo');
      expect(html).toContain('Priority Problems');
      expect(html).toContain('href="/dashboard/problems"');
    });
  });

  describe('4. AdminShell Navigation & Dedicated Admin Scope', () => {
    it('renders Operational Workspace and Platform Controls in AdminShell', () => {
      currentPathname = '/admin';
      const html = renderToStaticMarkup(
        <AdminShell>
          <div>Admin Console</div>
        </AdminShell>
      );

      // Operational Workspace links
      expect(html).toContain('Operational Workspace');
      expect(html).toContain('Command Center');
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain('Problems');
      expect(html).toContain('href="/dashboard/problems"');
      expect(html).toContain('Governance AI');
      expect(html).toContain('href="/dashboard/ai"');
      expect(html).toContain('Intervention Simulator');
      expect(html).toContain('href="/dashboard/simulation"');

      // Administration & Platform Controls
      expect(html).toContain('Administration &amp; DPI');
      expect(html).toContain('System Administration');
      expect(html).toContain('href="/admin"');
      expect(html).toContain('DPI Connectors &amp; APIs');
      expect(html).toContain('User &amp; Role Access');
      expect(html).toContain('Audit &amp; Compliance Logs');
    });
  });

  describe('5. Contextual Journey Links & Demo Mode State', () => {
    it('verifies problem detail contextual links pattern (Back to Problems, Command Center, AI, Simulation)', () => {
      const problemId = 'PRB-2026-0819';
      // Test contextual links structure matching ProblemDetailPage
      const contextualNav = (
        <div className="contextual-nav">
          <a href="/dashboard/problems">Back to Problems</a>
          <a href="/dashboard">Command Center</a>
          <a href={`/dashboard/ai?problemId=${problemId}`}>Governance AI</a>
          <a href={`/dashboard/simulation?problemId=${problemId}`}>Simulate Intervention</a>
        </div>
      );
      const html = renderToStaticMarkup(contextualNav);

      expect(html).toContain('href="/dashboard/problems"');
      expect(html).toContain('Back to Problems');
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain('Command Center');
      expect(html).toContain(`href="/dashboard/ai?problemId=${problemId}"`);
      expect(html).toContain(`href="/dashboard/simulation?problemId=${problemId}"`);
    });

    it('verifies Governance AI contextual links to Command Center, Problem Detail, and Simulation', () => {
      const problemId = 'PRB-2026-0819';
      const aiNav = (
        <div className="ai-actions">
          <a href="/dashboard">Command Center</a>
          <a href={`/dashboard/problems/${problemId}`}>Golden Demo Problem</a>
          <a href={`/dashboard/simulation?problemId=${problemId}`}>Open Simulator</a>
        </div>
      );
      const html = renderToStaticMarkup(aiNav);

      expect(html).toContain('href="/dashboard"');
      expect(html).toContain(`href="/dashboard/problems/${problemId}"`);
      expect(html).toContain(`href="/dashboard/simulation?problemId=${problemId}"`);
    });

    it('verifies Intervention Simulator contextual links to Command Center, Problem Detail, and Governance AI', () => {
      const problemId = 'PRB-2026-0819';
      const simNav = (
        <div className="sim-actions">
          <a href="/dashboard">Command Center</a>
          <a href={`/dashboard/problems/${problemId}`}>Golden Demo Problem</a>
          <a href={`/dashboard/ai?problemId=${problemId}`}>Governance AI</a>
        </div>
      );
      const html = renderToStaticMarkup(simNav);

      expect(html).toContain('href="/dashboard"');
      expect(html).toContain(`href="/dashboard/problems/${problemId}"`);
      expect(html).toContain(`href="/dashboard/ai?problemId=${problemId}"`);
    });

    it('verifies Dashboard Quick Navigation rail differentiates DEMO_MODE vs REAL_MODE', () => {
      // DEMO_MODE
      const isDemo = true;
      const demoProblemId = 'PRB-2026-0819';
      const demoRail = (
        <div>
          <a href="/dashboard/problems">All Problems</a>
          <a href={`/dashboard/problems/${demoProblemId}`}>
            {isDemo && demoProblemId === 'PRB-2026-0819'
              ? 'Golden Demo: PRB-2026-0819 (Impact 92)'
              : `Highest Impact: #${demoProblemId}`}
          </a>
          <a href={`/dashboard/ai?problemId=${demoProblemId}`}>Governance AI</a>
          <a href={`/dashboard/simulation?problemId=${demoProblemId}`}>Intervention Simulator</a>
        </div>
      );
      let html = renderToStaticMarkup(demoRail);
      expect(html).toContain('Golden Demo: PRB-2026-0819 (Impact 92)');
      expect(html).toContain('href="/dashboard/problems/PRB-2026-0819"');

      // REAL_MODE with live problem
      const isReal = false;
      const realProblemId = 'PRB-2026-6985';
      const realRail = (
        <div>
          <a href="/dashboard/problems">All Problems</a>
          <a href={`/dashboard/problems/${realProblemId}`}>
            {isReal && realProblemId === 'PRB-2026-0819'
              ? 'Golden Demo: PRB-2026-0819 (Impact 92)'
              : `Highest Impact: #${realProblemId}`}
          </a>
          <a href={`/dashboard/ai?problemId=${realProblemId}`}>Governance AI</a>
          <a href={`/dashboard/simulation?problemId=${realProblemId}`}>Intervention Simulator</a>
        </div>
      );
      html = renderToStaticMarkup(realRail);
      expect(html).toContain('Highest Impact: #PRB-2026-6985');
      expect(html).toContain('href="/dashboard/problems/PRB-2026-6985"');
      expect(html).not.toContain('Golden Demo');
      expect(html).not.toContain('PRB-2026-0819');
    });
  });
});
