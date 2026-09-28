import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicProblemModal } from '../src/components/citizen/PublicProblemModal';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/citizen',
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

// Mock apiClient
vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('Citizen Completion Status & Assignment Dropdown Filtering', () => {
  const CANONICAL_FIELD_UUID = '10000000-0000-4000-8000-000000000003';
  const CANONICAL_DEPT_UUID = '10000000-0000-4000-8000-000000000002';
  const CANONICAL_ADMIN_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const CANONICAL_WRONG_DEPT_UUID = 'f9e8d7c6-b5a4-4321-9876-543210fedcba';
  const CANONICAL_INACTIVE_UUID = '11112222-3333-4444-5555-666677778888';

  // =========================================================================
  // 1. CITIZEN COMPLETION MESSAGING
  // =========================================================================
  describe('1. Citizen Completion Messaging across Lifecycle States', () => {
    it('AWAITING_VERIFICATION shows "Work completed by field officer — awaiting verification" and does NOT show "Work Complete"', () => {
      const html = renderToStaticMarkup(
        <PublicProblemModal
          problemId="PRB-2026-TEST-01"
          onClose={vi.fn()}
          initialProblem={{
            id: 'PRB-2026-TEST-01',
            title: 'Water Pipe Rupture',
            description: 'Major leak in Nayapalli',
            status: 'AWAITING_VERIFICATION',
            category: 'water_supply',
            created_at: new Date().toISOString()
          }}
        />
      );

      // Positive check: Must display the awaiting verification message
      expect(html).toContain('Work completed by field officer — awaiting verification');

      // Negative check: Must NOT display "Work Complete"
      expect(html).not.toContain('Work Complete');
      expect(html).not.toContain('The department has verified the submitted resolution');
    });

    it('RESOLVED shows "Work Complete" with secondary text "The department has verified the submitted resolution."', () => {
      const html = renderToStaticMarkup(
        <PublicProblemModal
          problemId="PRB-2026-TEST-02"
          onClose={vi.fn()}
          initialProblem={{
            id: 'PRB-2026-TEST-02',
            title: 'Water Pipe Rupture',
            description: 'Major leak in Nayapalli',
            status: 'RESOLVED',
            category: 'water_supply',
            created_at: new Date().toISOString()
          }}
        />
      );

      expect(html).toContain('Work Complete');
      expect(html).toContain('The department has verified the submitted resolution.');
    });

    it('CLOSED shows "Work Complete" with secondary text "This issue has been completed and closed."', () => {
      const html = renderToStaticMarkup(
        <PublicProblemModal
          problemId="PRB-2026-TEST-03"
          onClose={vi.fn()}
          initialProblem={{
            id: 'PRB-2026-TEST-03',
            title: 'Water Pipe Rupture',
            description: 'Major leak in Nayapalli',
            status: 'CLOSED',
            category: 'water_supply',
            created_at: new Date().toISOString()
          }}
        />
      );

      expect(html).toContain('Work Complete');
      expect(html).toContain('This issue has been completed and closed.');
    });

    it('REOPENED removes completion message and displays "Issue Reopened"', () => {
      const html = renderToStaticMarkup(
        <PublicProblemModal
          problemId="PRB-2026-TEST-04"
          onClose={vi.fn()}
          initialProblem={{
            id: 'PRB-2026-TEST-04',
            title: 'Water Pipe Rupture',
            description: 'Major leak in Nayapalli',
            status: 'REOPENED',
            category: 'water_supply',
            created_at: new Date().toISOString()
          }}
        />
      );

      expect(html).toContain('Issue Reopened');
      expect(html).toContain('This issue has been reopened for further action and remediation.');
      expect(html).not.toContain('Work Complete');
    });

    it('Evidence upload alone does not show final completion when problem is IN_PROGRESS', () => {
      const html = renderToStaticMarkup(
        <PublicProblemModal
          problemId="PRB-2026-TEST-05"
          onClose={vi.fn()}
          initialProblem={{
            id: 'PRB-2026-TEST-05',
            title: 'Water Pipe Rupture',
            description: 'Major leak in Nayapalli',
            status: 'IN_PROGRESS',
            category: 'water_supply',
            created_at: new Date().toISOString()
          }}
        />
      );

      expect(html).not.toContain('Work Complete');
      expect(html).not.toContain('Work completed by field officer — awaiting verification');
      expect(html).toContain('IN PROGRESS');
    });
  });

  // =========================================================================
  // 2. ASSIGNMENT DROPDOWN FILTERING
  // =========================================================================
  describe('2. Department Officer Assignment Dropdown Filtering', () => {
    // Replicates the strict frontend filtering logic from problems/[id]/page.tsx
    function filterEligibleFieldOfficers(rawOfficers: any[], targetDeptId: string) {
      return rawOfficers.filter(
        (o) =>
          o.role === 'FIELD_OFFICER' &&
          (o.status === 'ACTIVE' || !o.status) &&
          (o.department_id === targetDeptId || o.department_id === 'WATCO')
      );
    }

    const testStaffRoster = [
      {
        id: CANONICAL_FIELD_UUID,
        display_name: 'Priyanshu Dash',
        email: 'field@example.com',
        role: 'FIELD_OFFICER',
        department_id: 'WATCO',
        status: 'ACTIVE'
      },
      {
        id: CANONICAL_DEPT_UUID,
        display_name: 'Priyanshu Dept Officer',
        email: 'officer@example.com',
        role: 'DEPARTMENT_OFFICER',
        department_id: 'WATCO',
        status: 'ACTIVE'
      },
      {
        id: CANONICAL_ADMIN_UUID,
        display_name: 'Commissioner',
        email: 'admin@bmc.gov.in',
        role: 'ADMIN',
        department_id: 'WATCO',
        status: 'ACTIVE'
      },
      {
        id: CANONICAL_WRONG_DEPT_UUID,
        display_name: 'Bikram Rout',
        email: 'bikram@bmc.gov.in',
        role: 'FIELD_OFFICER',
        department_id: 'BMC_DRAINAGE',
        status: 'ACTIVE'
      },
      {
        id: CANONICAL_INACTIVE_UUID,
        display_name: 'Inactive Crew',
        email: 'inactive@watco.gov.in',
        role: 'FIELD_OFFICER',
        department_id: 'WATCO',
        status: 'SUSPENDED'
      }
    ];

    it('assignment dropdown contains only FIELD_OFFICER users', () => {
      const eligible = filterEligibleFieldOfficers(testStaffRoster, 'WATCO');
      expect(eligible.length).toBe(1);
      expect(eligible[0].role).toBe('FIELD_OFFICER');
    });

    it('DEPARTMENT_OFFICER cannot appear in eligible field officers', () => {
      const eligible = filterEligibleFieldOfficers(testStaffRoster, 'WATCO');
      const deptOfficer = eligible.find((o) => o.id === CANONICAL_DEPT_UUID);
      expect(deptOfficer).toBeUndefined();
    });

    it('ADMIN cannot appear in eligible field officers', () => {
      const eligible = filterEligibleFieldOfficers(testStaffRoster, 'WATCO');
      const admin = eligible.find((o) => o.id === CANONICAL_ADMIN_UUID);
      expect(admin).toBeUndefined();
    });

    it('officer from wrong department cannot appear in eligible field officers', () => {
      const eligible = filterEligibleFieldOfficers(testStaffRoster, 'WATCO');
      const wrongDept = eligible.find((o) => o.id === CANONICAL_WRONG_DEPT_UUID);
      expect(wrongDept).toBeUndefined();
    });

    it('inactive officer cannot appear in eligible field officers', () => {
      const eligible = filterEligibleFieldOfficers(testStaffRoster, 'WATCO');
      const inactive = eligible.find((o) => o.id === CANONICAL_INACTIVE_UUID);
      expect(inactive).toBeUndefined();
    });

    it('selected officer uses canonical public.users.id UUID', () => {
      const eligible = filterEligibleFieldOfficers(testStaffRoster, 'WATCO');
      expect(eligible[0].id).toBe(CANONICAL_FIELD_UUID);
      // Validates UUID format
      expect(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eligible[0].id)).toBe(true);
    });
  });
});
