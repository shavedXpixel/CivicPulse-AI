import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

export interface FilterBarProps {
  ward: string;
  onWardChange: (w: string) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  severity: string;
  onSeverityChange: (s: string) => void;
  department: string;
  onDepartmentChange: (d: string) => void;
  onReset: () => void;
}

export function FilterBar({
  ward,
  onWardChange,
  category,
  onCategoryChange,
  severity,
  onSeverityChange,
  department,
  onDepartmentChange,
  onReset,
}: FilterBarProps) {
  return (
    <div className="p-4 rounded-xl border border-ink-border bg-white shadow-card space-y-3">
      <div className="flex items-center justify-between text-xs font-mono text-ink-secondary">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-civic-blue" />
          <span className="font-semibold uppercase tracking-wider">Operational Filters</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
          <RotateCcw className="w-3 h-3 mr-1" />
          <span>Reset Filters</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          label="Ward"
          value={ward}
          onChange={(e) => onWardChange(e.target.value)}
          options={[
            { value: 'ALL', label: 'All 198 Wards' },
            { value: 'WARD-018', label: 'Ward 18 (Indiranagar)' },
            { value: 'WARD-004', label: 'Ward 04 (Malleshwaram)' },
            { value: 'WARD-022', label: 'Ward 22 (Koramangala)' },
            { value: 'WARD-012', label: 'Ward 12 (Rajajinagar)' },
            { value: 'WARD-009', label: 'Ward 09 (Jayanagar)' },
          ]}
        />

        <Select
          label="Category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Categories' },
            { value: 'WATER_SUPPLY', label: 'Water Supply' },
            { value: 'ELECTRICITY', label: 'Electricity & Power' },
            { value: 'ROADS', label: 'Roads & Traffic' },
            { value: 'SANITATION', label: 'Sanitation & Drains' },
            { value: 'STREETLIGHTS', label: 'Street Lighting' },
          ]}
        />

        <Select
          label="Severity"
          value={severity}
          onChange={(e) => onSeverityChange(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Severities' },
            { value: 'CRITICAL', label: 'Critical (80-100)' },
            { value: 'HIGH', label: 'High (60-79)' },
            { value: 'MEDIUM', label: 'Medium (40-59)' },
            { value: 'LOW', label: 'Low (0-39)' },
          ]}
        />

        <Select
          label="Department"
          value={department}
          onChange={(e) => onDepartmentChange(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Departments' },
            { value: 'BWSSB', label: 'Water Board (BWSSB)' },
            { value: 'BESCOM', label: 'Electricity Supply (BESCOM)' },
            { value: 'BBMP_ROADS', label: 'Roads & Infra (BBMP)' },
            { value: 'BBMP_SWM', label: 'Solid Waste (BBMP)' },
          ]}
        />
      </div>
    </div>
  );
}
