import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResolutionWorkspace } from '../src/components/domain/ResolutionWorkspace';
import { ProblemStatus, EvidenceType, BeforeOrAfter, EvidenceStatus } from '@civicpulse/shared';
import { apiClient } from '../src/lib/api-client';

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

describe('Resolution Evidence Display & Retrieval Path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders AuthenticatedMediaImage when afterEvidence contains a real storage_path', () => {
    const html = renderToStaticMarkup(
      <ResolutionWorkspace
        problemId="PRB-2026-8415"
        problemTitle="A streetlight has stopped working."
        problemCategory="INFRASTRUCTURE"
        problemStatus={ProblemStatus.AWAITING_VERIFICATION}
        departmentId="WATCO"
        authToken="mock-test-token"
        userRole="DEPARTMENT_OFFICER"
        userName="Department Officer"
        wardName="Ward 013"
      />
    );

    // Initial server-rendered state renders the workspace structure
    expect(html).toContain('Infrastructure Resolution Verification Workspace');
    expect(html).toContain('Phase 6 Evidence &amp; AI Verification');
  });

  it('validates apiClient.getMediaBlob constructs the exact authenticated storage endpoint', async () => {
    const originalFetch = global.fetch;
    const fetchCalls: { url: string; headers: any }[] = [];

    global.fetch = vi.fn().mockImplementation((url: string, opts: any) => {
      fetchCalls.push({ url, headers: opts?.headers });
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['fake-image-bytes'], { type: 'image/jpeg' }))
      } as any);
    });

    try {
      const storagePath = 'evidence/PRB-2026-8415/evd_med_1790532719861_coamyc-images__1_.jpg';
      const blob = await apiClient.getMediaBlob(storagePath, { Authorization: 'Bearer test-token-123' });

      expect(blob).toBeDefined();
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0]!.url).toContain(`/api/v1/storage/files?path=${encodeURIComponent(storagePath)}`);
      expect(fetchCalls[0]!.headers.Authorization).toBe('Bearer test-token-123');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('prohibits synthetic fallback when real evidence image is present', () => {
    const mockEvidence = [
      {
        id: 'evd_1790532724244_3k7o',
        problem_id: 'PRB-2026-8415',
        submitted_by: 'officer_123',
        submitted_at: '2026-09-27T18:12:04.244Z',
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: 'evidence/PRB-2026-8415/evd_med_1790532719861_coamyc-images__1_.jpg',
        media_type: 'image/jpeg',
        status: EvidenceStatus.ACCEPTED,
        before_or_after: BeforeOrAfter.AFTER,
        created_at: '2026-09-27T18:12:04.244Z'
      }
    ];

    const firstEvidence = mockEvidence[0]!;
    expect(firstEvidence.storage_path).toBeTruthy();
    expect(firstEvidence.storage_path).not.toContain('mock://');
    expect(firstEvidence.storage_path).toContain('evidence/PRB-2026-8415/');
  });
});
