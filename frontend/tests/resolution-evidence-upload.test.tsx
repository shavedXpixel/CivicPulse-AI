import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResolutionWorkspace } from '../src/components/domain/ResolutionWorkspace';
import { ProblemStatus, EvidenceType, BeforeOrAfter } from '@civicpulse/shared';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/problems/PRB-2026-8415',
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

vi.mock('../src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    uploadFile: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('Resolution Evidence Photo Upload & Modal UX Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. renders Submit Resolution Proof action button for Field Officer in IN_PROGRESS', () => {
    const html = renderToStaticMarkup(
      <ResolutionWorkspace
        problemId="PRB-2026-8415"
        problemTitle="Street light stopped working"
        problemCategory="INFRASTRUCTURE"
        problemStatus={ProblemStatus.IN_PROGRESS}
        authToken=""
        userRole="FIELD_OFFICER"
        userName="Field Officer Patel"
        wardId="013"
        wardName="Nayapalli"
      />
    );

    expect(html).toContain('Submit Resolution Proof');
    expect(html).toContain('Infrastructure Resolution Verification Workspace');
    expect(html).toContain('Street light stopped working');
  });

  it('2. renders "Start Work (IN_PROGRESS)" banner when problem is in ASSIGNED state', () => {
    const html = renderToStaticMarkup(
      <ResolutionWorkspace
        problemId="PRB-2026-8415"
        problemTitle="Street light stopped working"
        problemCategory="INFRASTRUCTURE"
        problemStatus={ProblemStatus.ASSIGNED}
        authToken=""
        userRole="FIELD_OFFICER"
        userName="Field Officer Patel"
      />
    );

    expect(html).toContain('Incident Status: ASSIGNED');
    expect(html).toContain('Start Work (IN_PROGRESS)');
    expect(html).toContain('Site intervention has not commenced');
  });

  it('3. does not display Submit Proof button to CITIZEN users (RBAC protection)', () => {
    const html = renderToStaticMarkup(
      <ResolutionWorkspace
        problemId="PRB-2026-8415"
        problemTitle="Street light stopped working"
        problemCategory="INFRASTRUCTURE"
        problemStatus={ProblemStatus.IN_PROGRESS}
        authToken=""
        userRole="CITIZEN"
        userName="Citizen User"
      />
    );

    expect(html).not.toContain('Submit Resolution Proof');
    expect(html).not.toContain('Trigger AI Verification');
  });

  it('4. displays supervisory review actions when problem is AWAITING_VERIFICATION for department officer', () => {
    const html = renderToStaticMarkup(
      <ResolutionWorkspace
        problemId="PRB-2026-8415"
        problemTitle="Street light stopped working"
        problemCategory="INFRASTRUCTURE"
        problemStatus={ProblemStatus.AWAITING_VERIFICATION}
        authToken=""
        userRole="DEPARTMENT_OFFICER"
        userName="Supervisor Dash"
        departmentId="WATCO"
      />
    );

    expect(html).toContain('Supervisory Decision Required');
    expect(html).toContain('Accept Resolution (RESOLVED)');
    expect(html).toContain('Reject Proof &amp; Reopen (IN_PROGRESS)');
  });
});
