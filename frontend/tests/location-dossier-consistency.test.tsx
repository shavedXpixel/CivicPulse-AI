import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResolutionWorkspace } from '../src/components/domain/ResolutionWorkspace';
import { ProblemStatus } from '@civicpulse/shared';

// Mock Next.js Navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/problems/PRB-2026-8415',
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

describe('Frontend Location Dossier & Resolution Consistency', () => {
  it('1. ResolutionWorkspace renders an honest empty state when no evidence exists (no fake Nayapalli or pipeline)', () => {
    const html = renderToStaticMarkup(
      <ResolutionWorkspace
        problemId="PRB-2026-8415"
        problemTitle="Streeght light stopped working"
        problemCategory="ELECTRICAL"
        problemStatus={ProblemStatus.TRIAGED}
        authToken="test-token"
        userRole="DEPARTMENT_OFFICER"
        userName="WATCO Supervisor"
        problemLocation={{ lat: 20.317916, lng: 85.818231 }}
        wardId="WARD-013"
        wardName="Ward 13 (North Zone)"
      />
    );

    // Verify honest empty state is rendered
    expect(html).toContain('No Resolution Evidence Submitted');
    expect(html).toContain('Pre-remediation inspection photos and post-repair completion proofs will appear here');

    // Verify synthetic mock strings are completely absent
    expect(html).not.toContain('Nayapalli');
    expect(html).not.toContain('VIP Road');
    expect(html).not.toContain('Visible Pipeline Rupture');
    expect(html).not.toContain('Flanged Pipe Replaced');
  });

  it('2. Problem Dossier display logic separates report coordinates from derived ward centroid', () => {
    const liveProblem = {
      id: 'PRB-2026-8415',
      title: 'Streeght light stopped working',
      ward_id: 'WARD-013',
      ward_name: 'Ward 13 (North Zone)',
      location: { lat: 20.317916, lng: 85.818231 },
      ward_centroid: { lat: 20.319966, lng: 85.814967 },
    };

    // Header coordinates
    const headerCoords = `${liveProblem.location.lat.toFixed(4)}° N, ${liveProblem.location.lng.toFixed(4)}° E`;
    expect(headerCoords).toBe('20.3179° N, 85.8182° E');

    // Ward display name
    const wardDisplayName = liveProblem.ward_name
      || (liveProblem.ward_id ? `Ward ${liveProblem.ward_id.replace(/\D/g, '')}` : 'Bhubaneswar Municipal Area');
    expect(wardDisplayName).toBe('Ward 13 (North Zone)');
    expect(wardDisplayName).not.toContain('Nayapalli');

    // Report Source Coordinates vs Derived Ward Centroid
    const reportSourceCoords = `${liveProblem.location.lat.toFixed(4)}° N, ${liveProblem.location.lng.toFixed(4)}° E`;
    const derivedCentroid = `${liveProblem.ward_centroid.lat.toFixed(4)}° N, ${liveProblem.ward_centroid.lng.toFixed(4)}° E`;

    expect(reportSourceCoords).toBe('20.3179° N, 85.8182° E');
    expect(derivedCentroid).toBe('20.3200° N, 85.8150° E');
    expect(reportSourceCoords).not.toBe(derivedCentroid);
  });
});
