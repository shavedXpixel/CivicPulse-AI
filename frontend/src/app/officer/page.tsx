'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Compatibility alias / redirect:
 * /officer -> /field-officer
 */
export default function OfficerCompatibilityRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/field-officer');
  }, [router]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center text-ink-muted">
      <p className="text-sm font-mono">Redirecting to /field-officer...</p>
    </div>
  );
}
