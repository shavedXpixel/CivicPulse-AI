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

// Import components to test
import { ProblemList } from '../src/components/domain/ProblemList';
import { KPIStat } from '../src/components/domain/KPIStat';
import { DEMO_PROBLEMS } from '../src/lib/mockData';

describe('Phase 11 Real Government Operations Console Component Tests', () => {
  beforeEach(() => {
    currentPathname = '/dashboard/problems';
    mockAuthState = {
      user: { id: 'usr_admin', email: 'admin@bmc.gov.in', role: 'ADMIN', display_name: 'Commissioner' },
      isDemoMode: true,
      loading: false,
      signOut: vi.fn(),
      signInWithDemoRole: vi.fn(),
      signInWithEmail: vi.fn(),
    };
  });

  describe('1. Problem Directory & Dense Operations Table', () => {
    it('renders dense table view with canonical columns', () => {
      const html = renderToStaticMarkup(
        <ProblemList problems={DEMO_PROBLEMS} isLoading={false} />
      );

      // Verify table headers
      expect(html).toContain('ID');
      expect(html).toContain('Problem Cluster');
      expect(html).toContain('Ward');
      expect(html).toContain('Impact Score');
      expect(html).toContain('Status');
      expect(html).toContain('Department');
      expect(html).toContain('SLA State');
      expect(html).toContain('Signals');
      expect(html).toContain('Action');

      // Verify incident row renders with Manage link
      expect(html).toContain('PRB-2026-0819');
      expect(html).toContain('Manage');
      expect(html).toContain('/dashboard/problems/PRB-2026-0819');
    });

    it('renders filter controls for Impact, Status, Department, and SLA', () => {
      const html = renderToStaticMarkup(
        <ProblemList problems={DEMO_PROBLEMS} isLoading={false} />
      );

      expect(html).toContain('Impact: All');
      expect(html).toContain('Status: All');
      expect(html).toContain('Dept: All');
      expect(html).toContain('SLA: All');
      expect(html).toContain('Search problems by ID, title, category, ward...');
    });

    it('renders empty state when problems list is empty', () => {
      const html = renderToStaticMarkup(
        <ProblemList problems={[]} isLoading={false} />
      );

      expect(html).toContain('No problem clusters found');
    });

    it('renders skeleton loading state when isLoading is true', () => {
      const html = renderToStaticMarkup(
        <ProblemList problems={[]} isLoading={true} />
      );

      expect(html).toContain('animate-pulse');
    });
  });

  describe('2. Operational KPI Stats Rendering', () => {
    it('renders KPI card with title, formatted value, and comparison', () => {
      const html = renderToStaticMarkup(
        <KPIStat
          label="Citizen Signals"
          value="1,420"
          comparison="+384 today"
          trend="up"
          trendValue="+12%"
          isPositive={false}
        />
      );

      expect(html).toContain('Citizen Signals');
      expect(html).toContain('1,420');
      expect(html).toContain('+384 today');
      expect(html).toContain('+12%');
    });

    it('renders SLA Compliance KPI with target comparison', () => {
      const html = renderToStaticMarkup(
        <KPIStat
          label="SLA Compliance"
          value="88%"
          comparison="2 SLA breached"
          trend="up"
          isPositive={true}
        />
      );

      expect(html).toContain('SLA Compliance');
      expect(html).toContain('88%');
      expect(html).toContain('2 SLA breached');
    });
  });
});
