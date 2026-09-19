'use client';

import React from 'react';
import { AdminShell } from '../../../components/shells/AdminShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { DepartmentManager } from '../../../components/admin/DepartmentManager';
import { Building2 } from 'lucide-react';

export default function AdminDepartmentsPage() {
  return (
    <AdminShell>
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Department Registry"
          description="Authoritative municipal departments directory, operational status, contact metadata, and live workload telemetry."
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-mono">
              <Building2 className="w-3.5 h-3.5" />
              LIVE POSTGRES REGISTRY
            </span>
          }
        />

        <DepartmentManager />
      </div>
    </AdminShell>
  );
}
