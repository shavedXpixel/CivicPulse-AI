'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { ProblemCard } from './ProblemCard';
import { StatusBadge } from './StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { Input } from '../ui/Input';

export interface ProblemListProps {
  problems: any[];
  isLoading?: boolean;
  initialDepartment?: string;
  initialStatus?: string;
}

export function ProblemList({
  problems,
  isLoading = false,
  initialDepartment = 'ALL',
  initialStatus = 'ALL',
}: ProblemListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImpact, setSelectedImpact] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(initialDepartment);
  const [selectedSla, setSelectedSla] = useState<string>('ALL');
  const [selectedWard, setSelectedWard] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'impact' | 'sla' | 'newest' | 'oldest'>('impact');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Extract unique departments and wards for filter dropdowns
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => {
      const dept = p.department_id || p.department;
      if (dept) set.add(dept);
    });
    return ['ALL', ...Array.from(set)];
  }, [problems]);

  const availableWards = useMemo(() => {
    const set = new Set<string>();
    problems.forEach((p) => {
      const ward = p.ward_id || p.wardId;
      if (ward) set.add(ward);
    });
    return ['ALL', ...Array.from(set)];
  }, [problems]);

  // Filtering
  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      const title = (p.title || '').toLowerCase();
      const id = (p.id || '').toLowerCase();
      const wardName = (p.wardName || p.ward_id || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      if (q && !title.includes(q) && !id.includes(q) && !wardName.includes(q) && !cat.includes(q)) {
        return false;
      }

      const pImpact = (p.impact_level || p.severity || '').toUpperCase();
      if (selectedImpact !== 'ALL' && pImpact !== selectedImpact) {
        return false;
      }

      const pStatus = (p.status || '').toUpperCase();
      if (selectedStatus !== 'ALL' && pStatus !== selectedStatus) {
        return false;
      }

      const pDept = (p.department_id || p.department || '').toUpperCase();
      if (selectedDepartment !== 'ALL' && pDept !== selectedDepartment.toUpperCase()) {
        return false;
      }

      const pSla = (p.sla_state?.status || '').toUpperCase();
      if (selectedSla !== 'ALL' && pSla !== selectedSla) {
        return false;
      }

      const pWard = (p.ward_id || p.wardId || '').toUpperCase();
      if (selectedWard !== 'ALL' && pWard !== selectedWard.toUpperCase()) {
        return false;
      }

      return true;
    });
  }, [problems, searchQuery, selectedImpact, selectedStatus, selectedDepartment, selectedSla, selectedWard]);

  // Sorting
  const sortedProblems = useMemo(() => {
    return [...filteredProblems].sort((a, b) => {
      if (sortBy === 'impact') {
        const scoreA = a.impact_score ?? a.impactScore ?? 0;
        const scoreB = b.impact_score ?? b.impactScore ?? 0;
        return scoreB - scoreA;
      }
      if (sortBy === 'sla') {
        const slaWeight = (status?: string) => {
          if (status === 'BREACHED') return 3;
          if (status === 'AT_RISK') return 2;
          if (status === 'ON_TRACK') return 1;
          return 0;
        };
        const weightA = slaWeight(a.sla_state?.status);
        const weightB = slaWeight(b.sla_state?.status);
        if (weightB !== weightA) return weightB - weightA;
        return (b.impact_score ?? 0) - (a.impact_score ?? 0);
      }
      if (sortBy === 'newest') {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
        const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
        return dateA - dateB;
      }
      return 0;
    });
  }, [filteredProblems, sortBy]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedProblems.length / pageSize));
  const effectivePage = Math.min(currentPage, totalPages);
  const paginatedProblems = sortedProblems.slice(
    (effectivePage - 1) * pageSize,
    effectivePage * pageSize
  );

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedImpact('ALL');
    setSelectedStatus('ALL');
    setSelectedDepartment('ALL');
    setSelectedSla('ALL');
    setSelectedWard('ALL');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedImpact !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedDepartment !== 'ALL' ||
    selectedSla !== 'ALL' ||
    selectedWard !== 'ALL';

  return (
    <div className="space-y-4">
      {/* Search & Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-lg relative">
          <Input
            placeholder="Search problems by ID, title, category, ward..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            prefixIcon={<Search className="w-4 h-4 text-ink-tertiary" />}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-sm border border-ink-border bg-canvas-card p-0.5 shadow-none">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-sm text-xs font-mono font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'table'
                  ? 'bg-civic-terracotta text-white shadow-none'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-sm text-xs font-mono font-semibold flex items-center gap-1 transition-colors ${
                viewMode === 'cards'
                  ? 'bg-civic-terracotta text-white shadow-none'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cards</span>
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-canvas-card border border-ink-border rounded-sm px-2.5 py-1.5 shadow-none text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-ink-tertiary shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none text-ink-primary font-mono text-[11px] focus:outline-none cursor-pointer"
            >
              <option value="impact">Highest Impact</option>
              <option value="sla">SLA Urgency</option>
              <option value="newest">Newest Detected</option>
              <option value="oldest">Oldest Active</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter Chips / Dropdowns Strip */}
      <div className="p-3 rounded-sm bg-canvas-card border border-ink-border shadow-none flex flex-wrap items-center gap-2.5 text-xs">
        <div className="flex items-center gap-1 text-ink-secondary font-mono text-[11px] uppercase tracking-wider font-semibold mr-1">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {/* Impact Level */}
        <select
          value={selectedImpact}
          onChange={(e) => {
            setSelectedImpact(e.target.value);
            setCurrentPage(1);
          }}
          className="p-1.5 rounded-lg border border-ink-border bg-canvas-subtle text-ink-primary font-medium focus:ring-1 focus:ring-civic-blue"
        >
          <option value="ALL">Impact: All</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        {/* Status */}
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
          className="p-1.5 rounded-lg border border-ink-border bg-canvas-subtle text-ink-primary font-medium focus:ring-1 focus:ring-civic-blue"
        >
          <option value="ALL">Status: All</option>
          <option value="NEW">New</option>
          <option value="TRIAGED">Triaged</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        {/* Department */}
        <select
          value={selectedDepartment}
          onChange={(e) => {
            setSelectedDepartment(e.target.value);
            setCurrentPage(1);
          }}
          className="p-1.5 rounded-lg border border-ink-border bg-canvas-subtle text-ink-primary font-medium focus:ring-1 focus:ring-civic-blue"
        >
          <option value="ALL">Dept: All</option>
          {availableDepartments.filter((d) => d !== 'ALL').map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>

        {/* SLA State */}
        <select
          value={selectedSla}
          onChange={(e) => {
            setSelectedSla(e.target.value);
            setCurrentPage(1);
          }}
          className="p-1.5 rounded-lg border border-ink-border bg-canvas-subtle text-ink-primary font-medium focus:ring-1 focus:ring-civic-blue"
        >
          <option value="ALL">SLA: All</option>
          <option value="BREACHED">Breached</option>
          <option value="AT_RISK">At Risk</option>
          <option value="ON_TRACK">On Track</option>
          <option value="MET">Met</option>
        </select>

        {/* Ward */}
        {availableWards.length > 2 && (
          <select
            value={selectedWard}
            onChange={(e) => {
              setSelectedWard(e.target.value);
              setCurrentPage(1);
            }}
            className="p-1.5 rounded-lg border border-ink-border bg-canvas-subtle text-ink-primary font-medium focus:ring-1 focus:ring-civic-blue"
          >
            <option value="ALL">Ward: All</option>
            {availableWards.filter((w) => w !== 'ALL').map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs font-semibold text-civic-rose hover:underline ml-auto flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Results Count Banner */}
      <div className="flex items-center justify-between text-xs text-ink-secondary px-1">
        <span>
          Showing <strong>{sortedProblems.length}</strong> {sortedProblems.length === 1 ? 'incident' : 'incidents'}
          {hasActiveFilters ? ' (filtered)' : ''}
        </span>
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-white border border-ink-border rounded px-1.5 py-0.5 text-xs font-semibold"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Content Rendering: Loading / List / Empty */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-16 rounded-xl bg-canvas-muted animate-pulse" />
          ))}
        </div>
      ) : paginatedProblems.length === 0 ? (
        <EmptyState
          title="No problem clusters found"
          description={
            hasActiveFilters
              ? 'No active incidents match your current search and filter criteria.'
              : 'The municipal problems directory currently has no active incidents recorded.'
          }
          action={
            hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="text-xs font-semibold text-civic-blue hover:underline"
              >
                Reset All Filters
              </button>
            ) : undefined
          }
        />
      ) : viewMode === 'table' ? (
        /* Dense Enterprise Operations Table */
        <div className="overflow-x-auto rounded-sm border border-ink-border bg-canvas-card shadow-none">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-ink-border bg-canvas-subtle text-ink-secondary uppercase tracking-widest text-[10px] font-mono font-bold">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Problem Cluster</th>
                <th className="py-3 px-4">Ward</th>
                <th className="py-3 px-4">Impact Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">SLA State</th>
                <th className="py-3 px-4 text-center">Signals</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-border">
              {paginatedProblems.map((p) => {
                const impactScore = p.impact_score ?? p.impactScore ?? 50;
                const impactLevel = p.impact_level || p.severity || 'MEDIUM';
                const wardName = p.wardName || (p.ward_id ? `Ward ${p.ward_id.replace(/\D/g, '') || p.ward_id}` : 'Bhubaneswar');
                const dept = p.department_id || p.department || 'Unassigned';
                const sla = p.sla_state;
                const signalCount = p.signal_count ?? p.signalCount ?? 1;

                return (
                  <tr
                    key={p.id}
                    className="hover:bg-canvas-subtle/70 transition-colors group cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-ink-primary whitespace-nowrap">
                      <Link href={`/dashboard/problems/${p.id}`} className="hover:text-civic-terracotta">
                        {p.id}
                      </Link>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <Link href={`/dashboard/problems/${p.id}`} className="block">
                        <span className="font-semibold text-ink-primary group-hover:text-civic-terracotta transition-colors line-clamp-1">
                          {p.title}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-ink-tertiary">
                          {(p.category || 'CIVIC').replace(/_/g, ' ')}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary whitespace-nowrap">
                      {wardName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            impactLevel === 'CRITICAL'
                              ? 'bg-civic-rose'
                              : impactLevel === 'HIGH'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-mono font-bold text-ink-primary">{impactScore}</span>
                        <span className="text-[10px] font-mono text-ink-tertiary">({impactLevel})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-3 px-4 text-ink-secondary whitespace-nowrap font-medium">
                      {dept}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {sla ? (
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold flex items-center gap-1 w-fit ${
                            sla.status === 'BREACHED'
                              ? 'bg-rose-100 text-rose-800'
                              : sla.status === 'AT_RISK'
                              ? 'bg-amber-100 text-amber-900'
                              : sla.status === 'MET'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{sla.status}</span>
                        </span>
                      ) : (
                        <span className="text-ink-tertiary text-[11px] font-mono">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-ink-primary whitespace-nowrap">
                      {signalCount}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        href={`/dashboard/problems/${p.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-canvas-subtle border border-ink-border hover:bg-canvas-card hover:border-ink-secondary text-ink-primary font-mono font-medium text-[11px] transition-colors"
                      >
                        <span>Manage</span>
                        <ExternalLink className="w-3 h-3 text-ink-tertiary" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card Grid View */
        <div className="space-y-3">
          {paginatedProblems.map((problem, idx) => (
            <ProblemCard
              key={problem.id}
              problem={problem}
              rank={(effectivePage - 1) * pageSize + idx + 1}
            />
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs">
          <div className="text-ink-secondary">
            Page <strong>{effectivePage}</strong> of <strong>{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={effectivePage <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-ink-border bg-white text-ink-primary hover:bg-canvas-subtle disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={effectivePage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-ink-border bg-white text-ink-primary hover:bg-canvas-subtle disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
