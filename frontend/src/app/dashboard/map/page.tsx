'use client';

import React from 'react';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { MapContainer } from '../../../components/domain/MapContainer';
import { DEMO_PROBLEMS } from '../../../lib/mockData';

export default function MapWorkspacePage() {
  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Geospatial Problem Workspace"
          description="Interactive map workspace visualizing active public problem clusters, ward boundaries, and critical infrastructure proximity."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Map Workspace' },
          ]}
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-civic-blueLight text-civic-blueDark">
              GIS Telemetry Synced
            </span>
          }
        />

        <div className="space-y-4">
          <MapContainer problems={DEMO_PROBLEMS} height="h-[640px]" />
        </div>
      </div>
    </GovernmentShell>
  );
}
