'use client';

import React from 'react';
import { AdminShell } from '../../../components/shells/AdminShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { UserDirectory } from '../../../components/admin/UserDirectory';
import { Users } from 'lucide-react';

export default function AdminUsersPage() {
  return (
    <AdminShell>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Users & Access Directory"
          description="Complete registry of system administrators, department officers, field officers, and citizens with role-specific action availability."
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 text-xs font-mono">
              <Users className="w-3.5 h-3.5" />
              RBAC PROTECTED
            </span>
          }
        />

        <UserDirectory />
      </div>
    </AdminShell>
  );
}
