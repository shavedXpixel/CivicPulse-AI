'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  AlertCircle,
  Loader2,
  Search,
  Phone,
  Mail,
  X
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import { Department, UserProfile } from '@civicpulse/shared';

export interface DepartmentManagerProps {
  initialDepartments?: Department[];
}

export function DepartmentManager({ initialDepartments = [] }: DepartmentManagerProps) {
  const { getIdToken } = useAuth();
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [officers, setOfficers] = useState<UserProfile[]>([]);
  const [workloads, setWorkloads] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createCode, setCreateCode] = useState<string>('');
  const [createName, setCreateName] = useState<string>('');
  const [createDesc, setCreateDesc] = useState<string>('');
  const [createEmail, setCreateEmail] = useState<string>('');
  const [createPhone, setCreatePhone] = useState<string>('');
  const [createStatus, setCreateStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  // Edit Modal
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editShortName, setEditShortName] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const getHeaders = useCallback(async (): Promise<Record<string, string> | undefined> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [getIdToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const [deptsRes, usersRes] = await Promise.all([
        apiClient.get<{ data: Department[] }>('/api/v1/departments', headers),
        apiClient.get<{ data: { users: UserProfile[] } }>('/api/v1/admin/users', headers).catch(() => null)
      ]);

      const deptList = deptsRes?.data && Array.isArray(deptsRes.data) ? deptsRes.data : [];
      setDepartments(deptList);

      if (usersRes?.data?.users) {
        setOfficers(usersRes.data.users);
      }

      // Fetch workloads per department
      const workloadMap: Record<string, any> = {};
      await Promise.all(
        deptList.map(async (d) => {
          try {
            const wlRes = await apiClient.get<{ data: any }>(`/api/v1/departments/${d.id}/workload`, headers);
            if (wlRes?.data) {
              workloadMap[d.id] = wlRes.data;
            }
          } catch {
            // Ignore individual department workload failures
          }
        })
      );
      setWorkloads(workloadMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load department registry.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);

    if (!createName.trim()) {
      setCreateError('Department name is required.');
      setCreateLoading(false);
      return;
    }

    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { department: Department; message?: string } }>(
        '/api/v1/admin/departments',
        {
          code: createCode.trim() || undefined,
          name: createName.trim(),
          description: createDesc.trim() || undefined,
          contact_email: createEmail.trim() || undefined,
          contact_phone: createPhone.trim() || undefined,
          status: createStatus
        },
        headers
      );

      const created = res.data?.department;
      setCreateSuccess(`Department '${created?.name || createName}' created successfully.`);
      setCreateCode('');
      setCreateName('');
      setCreateDesc('');
      setCreateEmail('');
      setCreatePhone('');
      setCreateStatus('ACTIVE');
      setShowCreateModal(false);
      await loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create department.');
    } finally {
      setCreateLoading(false);
    }
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setEditName(dept.name || '');
    setEditShortName(dept.short_name || dept.id || '');
    setEditDesc(dept.description || '');
    setEditEmail(dept.contact_email || '');
    setEditPhone(dept.contact_phone || '');
    setEditStatus((dept.status as any) || 'ACTIVE');
    setEditError(null);
    setEditSuccess(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    setEditLoading(true);
    setEditError(null);
    setEditSuccess(null);

    try {
      const headers = await getHeaders();
      await apiClient.patch<{ data: { department: Department; message?: string } }>(
        `/api/v1/admin/departments/${editingDept.id}`,
        {
          name: editName.trim(),
          short_name: editShortName.trim() || undefined,
          description: editDesc.trim() || undefined,
          contact_email: editEmail.trim() || undefined,
          contact_phone: editPhone.trim() || undefined,
          status: editStatus
        },
        headers
      );

      setEditSuccess(`Department '${editingDept.id}' updated successfully.`);
      setEditingDept(null);
      await loadData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update department.');
    } finally {
      setEditLoading(false);
    }
  };

  const filteredDepts = departments.filter((d) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.id?.toLowerCase().includes(q) ||
      d.short_name?.toLowerCase().includes(q) ||
      d.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Action Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-canvas-card border border-ink-border p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search departments by code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
            />
          </div>
          <span className="text-xs text-ink-muted font-mono whitespace-nowrap">
            {filteredDepts.length} of {departments.length} departments
          </span>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-ink-primary text-canvas-card font-medium text-sm rounded hover:bg-ink-secondary transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Department
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-sm text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && departments.length === 0 ? (
        <div className="p-12 text-center text-ink-muted">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-ink-primary" />
          <p className="text-sm">Loading departmental registry...</p>
        </div>
      ) : filteredDepts.length === 0 ? (
        <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
          <Building2 className="w-10 h-10 mx-auto mb-2 text-ink-muted/50" />
          <p className="text-sm font-medium text-ink-primary">No departments found</p>
          <p className="text-xs mt-1">No municipal departments match the current filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDepts.map((d) => {
            const deptOfficers = officers.filter((u) => u.department_id === d.id);
            const wl = workloads[d.id];
            const isInactive = d.status === 'INACTIVE';

            return (
              <div
                key={d.id}
                className={`p-5 rounded-lg border transition-all ${
                  isInactive
                    ? 'bg-canvas-card/40 border-amber-500/20 opacity-80'
                    : 'bg-canvas-card border-ink-border hover:border-ink-muted'
                } flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink-muted uppercase">
                          {d.short_name || d.id}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                            isInactive
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {d.status || 'ACTIVE'}
                        </span>
                      </div>
                      <h4 className="font-semibold text-ink-primary text-base mt-0.5">{d.name}</h4>
                    </div>

                    <button
                      onClick={() => openEditModal(d)}
                      className="p-1.5 text-ink-muted hover:text-ink-primary rounded hover:bg-canvas-elevated transition-colors"
                      title="Edit department"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>

                  {d.description && (
                    <p className="text-xs text-ink-muted line-clamp-2 mb-3">{d.description}</p>
                  )}

                  <div className="space-y-1 text-xs text-ink-muted border-t border-ink-border/50 pt-2 mb-3">
                    {d.contact_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-ink-muted/70" />
                        <span className="truncate">{d.contact_email}</span>
                      </div>
                    )}
                    {d.contact_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-ink-muted/70" />
                        <span>{d.contact_phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Telemetry & Metrics */}
                <div className="border-t border-ink-border/50 pt-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-canvas-elevated p-2 rounded border border-ink-border/40">
                      <div className="text-[10px] text-ink-muted font-mono uppercase">Staff</div>
                      <div className="text-sm font-semibold text-ink-primary mt-0.5">
                        {deptOfficers.length}
                      </div>
                    </div>
                    <div className="bg-canvas-elevated p-2 rounded border border-ink-border/40">
                      <div className="text-[10px] text-ink-muted font-mono uppercase">Active</div>
                      <div className="text-sm font-semibold text-ink-primary mt-0.5">
                        {wl?.active_in_progress ?? 0}
                      </div>
                    </div>
                    <div className="bg-canvas-elevated p-2 rounded border border-ink-border/40">
                      <div className="text-[10px] text-ink-muted font-mono uppercase">Breached</div>
                      <div
                        className={`text-sm font-semibold mt-0.5 ${
                          (wl?.sla_breached ?? 0) > 0 ? 'text-rose-400' : 'text-ink-primary'
                        }`}
                      >
                        {wl?.sla_breached ?? 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-canvas-card border border-ink-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <Building2 className="w-5 h-5 text-ink-primary" />
              <h3 className="text-lg font-semibold text-ink-primary">Register Municipal Department</h3>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400">
                  {createError}
                </div>
              )}
              {createSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-400">
                  {createSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Department Identifier / Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. BMC_ROADS, WATCO, SWM"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary font-mono uppercase"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Department Full Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Roads & Infrastructure Management"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Operational Description
                </label>
                <textarea
                  placeholder="Responsibilities, jurisdiction, and maintenance scopes..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="dept@bmc.gov.in"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 674..."
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Operational Status
                </label>
                <select
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                >
                  <option value="ACTIVE">ACTIVE (Ready for staff assignments)</option>
                  <option value="INACTIVE">INACTIVE (Registry only, unassignable)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ink-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-ink-border text-ink-muted rounded text-sm hover:text-ink-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 bg-ink-primary text-canvas-card font-medium text-sm rounded hover:bg-ink-secondary transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Register Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-canvas-card border border-ink-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setEditingDept(null)}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <Edit2 className="w-5 h-5 text-ink-primary" />
              <h3 className="text-lg font-semibold text-ink-primary">
                Update Department: {editingDept.id}
              </h3>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              {editError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400">
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-400">
                  {editSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Department Full Title *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Short Name
                </label>
                <input
                  type="text"
                  value={editShortName}
                  onChange={(e) => setEditShortName(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Operational Description
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Operational Status *
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                >
                  <option value="ACTIVE">ACTIVE (Accepts new staff & workflow assignments)</option>
                  <option value="INACTIVE">INACTIVE (Frozen: Cannot be selected for new staff)</option>
                </select>
                <p className="text-[11px] text-ink-muted mt-1">
                  Inactive departments remain visible in registry. Existing staff keep current assignments.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ink-border">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="px-4 py-2 border border-ink-border text-ink-muted rounded text-sm hover:text-ink-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-ink-primary text-canvas-card font-medium text-sm rounded hover:bg-ink-secondary transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
