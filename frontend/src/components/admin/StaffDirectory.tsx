'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  Mail,
  UserX,
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Search,
  Clock,
  X
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import { UserProfile, UserRole, UserStatus, Department } from '@civicpulse/shared';

export interface StaffDirectoryProps {
  initialStaff?: UserProfile[];
  initialDepartments?: Department[];
}

export function StaffDirectory({ initialStaff = [], initialDepartments = [] }: StaffDirectoryProps) {
  const { user: currentAuthUser, getIdToken } = useAuth();
  const [staff, setStaff] = useState<UserProfile[]>(initialStaff);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Provisioning Modal State
  const [showProvisionModal, setShowProvisionModal] = useState<boolean>(false);
  const [provEmail, setProvEmail] = useState<string>('');
  const [provName, setProvName] = useState<string>('');
  const [provRole, setProvRole] = useState<UserRole>(UserRole.DEPARTMENT_OFFICER);
  const [provDept, setProvDept] = useState<string>('');
  const [provLoading, setProvLoading] = useState<boolean>(false);
  const [provError, setProvError] = useState<string | null>(null);
  const [provSuccess, setProvSuccess] = useState<string | null>(null);

  // Action status
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; isError: boolean } | null>(null);

  const getHeaders = useCallback(async (): Promise<Record<string, string> | undefined> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [getIdToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const [usersRes, deptsRes] = await Promise.all([
        apiClient.get<{ data: { users: UserProfile[] } }>('/api/v1/admin/users', headers),
        apiClient.get<{ data: Department[] }>('/api/v1/departments', headers).catch(() => null)
      ]);

      if (usersRes?.data?.users) {
        // Filter to government personnel only (DEPARTMENT_OFFICER, FIELD_OFFICER)
        const govStaff = usersRes.data.users.filter(
          (u) => u.role === UserRole.DEPARTMENT_OFFICER || u.role === UserRole.FIELD_OFFICER
        );
        setStaff(govStaff);
      }

      if (deptsRes?.data && Array.isArray(deptsRes.data)) {
        setDepartments(deptsRes.data);
        const firstActive = deptsRes.data.find((d) => (d.status as any) !== 'INACTIVE');
        if (firstActive && !provDept) {
          setProvDept(firstActive.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load government staff directory.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, provDept]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Provisioning Submission
  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvLoading(true);
    setProvError(null);
    setProvSuccess(null);

    if (!provEmail.trim() || !provName.trim()) {
      setProvError('Official email and full name are required.');
      setProvLoading(false);
      return;
    }

    if (!provDept) {
      setProvError('Please select a department.');
      setProvLoading(false);
      return;
    }

    const selectedDept = departments.find((d) => d.id === provDept);
    if (selectedDept && selectedDept.status === 'INACTIVE') {
      setProvError(`Department '${selectedDept.name}' is inactive and cannot accept new staff assignments.`);
      setProvLoading(false);
      return;
    }

    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { user: UserProfile; message?: string } }>(
        '/api/v1/admin/users/government',
        {
          email: provEmail.trim().toLowerCase(),
          full_name: provName.trim(),
          role: provRole,
          department_id: provDept
        },
        headers
      );

      const created = res.data?.user;
      setProvSuccess(`Invitation dispatched to ${created?.email || provEmail}. Staff member created in INVITED status.`);
      setProvEmail('');
      setProvName('');
      setShowProvisionModal(false);
      await loadData();
    } catch (err: any) {
      setProvError(err.message || 'Failed to provision government staff member.');
    } finally {
      setProvLoading(false);
    }
  };

  // Resend Invite
  const handleResendInvite = async (targetUser: UserProfile) => {
    if (targetUser.status !== UserStatus.INVITED) return;
    setActionLoadingId(targetUser.id);
    setActionNotice(null);

    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { success: boolean; message: string } }>(
        `/api/v1/admin/users/${targetUser.id}/resend-invite`,
        {},
        headers
      );

      setActionNotice({
        message: res.data?.message || `Invitation successfully resent to ${targetUser.email}.`,
        isError: false
      });
      await loadData();
    } catch (err: any) {
      setActionNotice({
        message: err.message || `Failed to resend invitation to ${targetUser.email}.`,
        isError: true
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Disable Staff
  const handleDisable = async (targetUser: UserProfile) => {
    if (targetUser.id === currentAuthUser?.id) return;
    setActionLoadingId(targetUser.id);
    setActionNotice(null);

    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { user: UserProfile; message: string } }>(
        `/api/v1/admin/users/${targetUser.id}/disable`,
        {},
        headers
      );

      setActionNotice({
        message: res.data?.message || `Account for '${targetUser.email}' disabled successfully.`,
        isError: false
      });
      await loadData();
    } catch (err: any) {
      setActionNotice({
        message: err.message || `Failed to disable ${targetUser.email}.`,
        isError: true
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Enable Staff
  const handleEnable = async (targetUser: UserProfile) => {
    setActionLoadingId(targetUser.id);
    setActionNotice(null);

    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { user: UserProfile; message: string } }>(
        `/api/v1/admin/users/${targetUser.id}/enable`,
        {},
        headers
      );

      setActionNotice({
        message: res.data?.message || `Account for '${targetUser.email}' re-enabled successfully.`,
        isError: false
      });
      await loadData();
    } catch (err: any) {
      setActionNotice({
        message: err.message || `Failed to enable ${targetUser.email}.`,
        isError: true
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredStaff = staff.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = u.display_name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchDept = u.department_id?.toLowerCase().includes(q);
      return matchName || matchEmail || matchDept;
    }
    return true;
  });

  const getDepartmentName = (deptId?: string) => {
    if (!deptId) return '—';
    const dept = departments.find((d) => d.id === deptId);
    return dept ? dept.name : deptId;
  };

  const activeDepartments = departments.filter((d) => (d.status as any) !== 'INACTIVE');
  const inactiveDepartments = departments.filter((d) => (d.status as any) === 'INACTIVE');

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      {actionNotice && (
        <div
          className={`p-3 rounded-lg border text-sm flex items-center justify-between gap-2 ${
            actionNotice.isError
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.isError ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs hover:underline opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-sm text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold font-mono tracking-tight text-ink-primary">
            GOVERNMENT STAFF
          </h2>
          <p className="text-xs text-ink-muted">
            Manage municipal department and field officers, dispatch official invitations, and control credentials.
          </p>
        </div>
      </div>

      {/* Action Header & Filters */}
      <div className="bg-canvas-card border border-ink-border p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 bg-canvas-elevated border border-ink-border rounded text-xs text-ink-primary focus:outline-none focus:border-ink-primary"
          >
            <option value="ALL">All Roles</option>
            <option value={UserRole.DEPARTMENT_OFFICER}>DEPARTMENT_OFFICER</option>
            <option value={UserRole.FIELD_OFFICER}>FIELD_OFFICER</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-canvas-elevated border border-ink-border rounded text-xs text-ink-primary focus:outline-none focus:border-ink-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value={UserStatus.INVITED}>INVITED</option>
            <option value={UserStatus.ACTIVE}>ACTIVE</option>
            <option value={UserStatus.INACTIVE}>INACTIVE</option>
            <option value={UserStatus.SUSPENDED}>SUSPENDED</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted font-mono whitespace-nowrap">
            {filteredStaff.length} of {staff.length} staff members
          </span>
          <button
            onClick={() => setShowProvisionModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink-primary text-canvas-card font-medium text-sm rounded hover:bg-ink-secondary transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            + Create Staff Account
          </button>
        </div>
      </div>

      {/* Staff Table */}
      {loading && staff.length === 0 ? (
        <div className="p-12 text-center text-ink-muted">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-ink-primary" />
          <p className="text-sm">Loading government staff roster...</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
          <Briefcase className="w-10 h-10 mx-auto mb-2 text-ink-muted/50" />
          <p className="text-sm font-medium text-ink-primary">No government staff accounts have been provisioned.</p>
          <p className="text-xs mt-1">Use the provision button above to create official municipal staff accounts.</p>
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
          <Briefcase className="w-10 h-10 mx-auto mb-2 text-ink-muted/50" />
          <p className="text-sm font-medium text-ink-primary">No staff members found</p>
          <p className="text-xs mt-1">No government officers match your search or filter criteria.</p>
        </div>
      ) : (
        <div className="bg-canvas-card border border-ink-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas-elevated/50 text-[11px] font-mono uppercase text-ink-muted border-b border-ink-border">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border/50">
                {filteredStaff.map((u) => {
                  const isCurrentUser = u.id === currentAuthUser?.id;
                  const isInvited = u.status === UserStatus.INVITED;
                  const isActive = u.status === UserStatus.ACTIVE;
                  const isInactive =
                    u.status === UserStatus.INACTIVE || u.status === UserStatus.SUSPENDED;
                  const isActionBusy = actionLoadingId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-canvas-elevated/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-ink-primary flex items-center gap-1.5">
                          {u.display_name || 'Unnamed Officer'}
                          {isCurrentUser && (
                            <span className="text-[10px] bg-ink-primary/10 text-ink-primary px-1.5 py-0.2 rounded font-mono">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs text-ink-muted font-mono">
                        {u.email}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                            u.role === UserRole.DEPARTMENT_OFFICER
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-ink-muted">
                        <span title={u.department_id}>{getDepartmentName(u.department_id)}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-medium inline-flex items-center gap-1 ${
                            isInvited
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isInvited && <Clock className="w-3 h-3" />}
                          {isActive && <CheckCircle2 className="w-3 h-3" />}
                          {isInactive && <UserX className="w-3 h-3" />}
                          {u.status || 'ACTIVE'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs font-mono text-ink-muted">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isActionBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin text-ink-primary ml-auto" />
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {isInvited && (
                              <button
                                onClick={() => handleResendInvite(u)}
                                className="px-2.5 py-1 text-xs border border-ink-border rounded bg-canvas-elevated text-ink-primary hover:bg-canvas-card transition-colors inline-flex items-center gap-1"
                                title="Resend official invitation email"
                              >
                                <Mail className="w-3 h-3" />
                                Resend Invitation
                              </button>
                            )}

                            {isActive && (
                              <button
                                onClick={() => handleDisable(u)}
                                disabled={isCurrentUser}
                                className="px-2.5 py-1 text-xs border border-rose-500/30 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                title={
                                  isCurrentUser
                                    ? 'Cannot disable your own administrative account'
                                    : 'Disable staff account'
                                }
                              >
                                <UserX className="w-3 h-3" />
                                Disable
                              </button>
                            )}

                            {isInactive && (
                              <button
                                onClick={() => handleEnable(u)}
                                className="px-2.5 py-1 text-xs border border-emerald-500/30 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1"
                                title="Re-enable staff account"
                              >
                                <UserCheck className="w-3 h-3" />
                                Re-enable
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Provision Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-canvas-card border border-ink-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setShowProvisionModal(false)}
              className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <UserPlus className="w-5 h-5 text-ink-primary" />
              <h3 className="text-lg font-semibold text-ink-primary">Provision Government Officer</h3>
            </div>
            <p className="text-xs text-ink-muted mb-4">
              Admin never sees, sets, or handles passwords. Official government invitation with account activation instructions will be delivered via email.
            </p>

            <form onSubmit={handleProvision} className="space-y-4">
              {provError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400">
                  {provError}
                </div>
              )}
              {provSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-400">
                  {provSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="Officer Rajesh Kumar"
                  value={provName}
                  onChange={(e) => setProvName(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                  Official Email *
                </label>
                <input
                  type="email"
                  placeholder="rajesh.kumar@bmc.gov.in"
                  value={provEmail}
                  onChange={(e) => setProvEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                    Role *
                  </label>
                  <select
                    value={provRole}
                    onChange={(e) => setProvRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                  >
                    <option value={UserRole.DEPARTMENT_OFFICER}>DEPARTMENT_OFFICER</option>
                    <option value={UserRole.FIELD_OFFICER}>FIELD_OFFICER</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase font-mono text-ink-muted mb-1">
                    Department *
                  </label>
                  <select
                    value={provDept}
                    onChange={(e) => setProvDept(e.target.value)}
                    className="w-full px-3 py-2 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
                    required
                  >
                    <optgroup label="Active Departments">
                      {activeDepartments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.id})
                        </option>
                      ))}
                    </optgroup>
                    {inactiveDepartments.length > 0 && (
                      <optgroup label="Inactive Departments (Unassignable)">
                        {inactiveDepartments.map((d) => (
                          <option key={d.id} value={d.id} disabled>
                            {d.name} ({d.id}) — Inactive
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-ink-border">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 border border-ink-border text-ink-muted rounded text-sm hover:text-ink-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provLoading || !provDept}
                  className="px-5 py-2 bg-ink-primary text-canvas-card font-medium text-sm rounded hover:bg-ink-secondary transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {provLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Dispatch Official Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
