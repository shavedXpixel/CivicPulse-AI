'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { UserRole } from '@civicpulse/shared';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { DevelopmentDemandWorkspace } from '../../../components/governance/DevelopmentDemandWorkspace';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DevelopmentDemandPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();

  const isAuthorized =
    userProfile?.role === UserRole.ADMIN ||
    (userProfile?.role as string) === 'SYSTEM_ADMIN' ||
    userProfile?.role === UserRole.DEPARTMENT_OFFICER;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F4F0EA] flex items-center justify-center font-mono text-xs text-[#5C5852]">
        <div className="p-4 bg-[#FCFAF7] border border-[#DDD7CD] flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-[#C85A32] border-t-transparent animate-spin" />
          <span>Verifying municipal credentials…</span>
        </div>
      </div>
    );
  }

  // Unauthorized State (CITIZEN, FIELD_OFFICER, etc.)
  if (user && !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#F4F0EA] flex items-center justify-center p-6">
        <div
          data-testid="unauthorized-message"
          className="max-w-md w-full border border-[#DDD7CD] bg-[#FCFAF7] p-8 space-y-4 text-center"
        >
          <ShieldAlert className="w-10 h-10 text-[#C85A32] mx-auto" />
          <h2 className="font-mono text-sm uppercase tracking-wider font-bold text-[#1A1816]">
            ACCESS RESTRICTED (403 FORBIDDEN)
          </h2>
          <p className="text-xs text-[#5C5852] leading-relaxed">
            Development Demand Governance Intelligence is restricted to Municipal Administrators and Department Officers.
            Operational field roles and citizens do not have access to macro municipal demand intelligence.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A1816] text-[#FCFAF7] font-mono text-xs uppercase hover:bg-[#C85A32] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GovernmentShell>
      <div data-testid="governance-development-demand-page">
        <DevelopmentDemandWorkspace userRole={userProfile?.role} />
      </div>
    </GovernmentShell>
  );
}
