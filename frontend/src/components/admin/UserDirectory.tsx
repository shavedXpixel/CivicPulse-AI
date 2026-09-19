'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Mail,
  UserX,
  UserCheck,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Briefcase,
  User as UserIcon,
  Clock
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import { UserProfile, UserRole, UserStatus, Department } from '@civicpulse/shared';

export interface UserDirectoryProps {
  initialUsers?: UserProfile[];
  initialDepartments?: Department[];
}

export function UserDirectory({ initialUsers = [], initialDepartments = [] }: UserDirectoryProps) {
  const { user: currentAuthUser, getIdToken } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Action state
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
        setUsers(usersRes.data.users);
      }
      if (deptsRes?.data && Array.isArray(deptsRes.data)) {
        setDepartments(deptsRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load user directory.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Resend invitation (INVITED government staff only)
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
        message: res.data?.message || `Invitation resent to ${targetUser.email}.`,
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

  // Disable account (government staff only, not self)
  const handleDisableUser = async (targetUser: UserProfile) => {
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
        message: res.data?.message || `User '${targetUser.email}' disabled successfully.`,
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

  // Enable account (government staff only)
  const handleEnableUser = async (targetUser: UserProfile) => {
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
        message: res.data?.message || `User '${targetUser.email}' re-enabled successfully.`,
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

  // Filter users
  const filteredUsers = users.filter((u) => {
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

      {/* Filter Toolbar */}
      <div className="bg-canvas-card border border-ink-border p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 bg-canvas-elevated border border-ink-border rounded text-xs text-ink-primary focus:outline-none focus:border-ink-primary"
          >
            <option value="ALL">All Roles</option>
            <option value={UserRole.ADMIN}>ADMIN</option>
            <option value={UserRole.DEPARTMENT_OFFICER}>DEPARTMENT_OFFICER</option>
            <option value={UserRole.FIELD_OFFICER}>FIELD_OFFICER</option>
            <option value={UserRole.CITIZEN}>CITIZEN</option>
          </select>

          {/* Status Filter */}
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted font-mono whitespace-nowrap">
            Showing {filteredUsers.length} of {users.length} accounts
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 text-ink-muted hover:text-ink-primary rounded hover:bg-canvas-elevated transition-colors"
            title="Refresh user list"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading && users.length === 0 ? (
        <div className="p-12 text-center text-ink-muted">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-ink-primary" />
          <p className="text-sm">Loading system user directory...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
          <Users className="w-10 h-10 mx-auto mb-2 text-ink-muted/50" />
          <p className="text-sm font-medium text-ink-primary">No users found</p>
          <p className="text-xs mt-1">No user accounts match the selected filters.</p>
        </div>
      ) : (
        <div className="bg-canvas-card border border-ink-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas-elevated/50 text-[11px] font-mono uppercase text-ink-muted border-b border-ink-border">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border/50">
                {filteredUsers.map((u) => {
                  const isCurrentUser = u.id === currentAuthUser?.id;
                  const isGovStaff =
                    u.role === UserRole.DEPARTMENT_OFFICER || u.role === UserRole.FIELD_OFFICER;
                  const isInvited = u.status === UserStatus.INVITED;
                  const isActive = u.status === UserStatus.ACTIVE;
                  const isInactive =
                    u.status === UserStatus.INACTIVE || u.status === UserStatus.SUSPENDED;
                  const isCitizen = u.role === UserRole.CITIZEN;
                  const isAdmin = u.role === UserRole.ADMIN || u.role === UserRole.SYSTEM_ADMIN;
                  const isActionBusy = actionLoadingId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-canvas-elevated/30 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-canvas-elevated border border-ink-border flex items-center justify-center text-xs font-mono text-ink-muted shrink-0">
                            {isGovStaff ? (
                              <Briefcase className="w-3.5 h-3.5" />
                            ) : isAdmin ? (
                              <Shield className="w-3.5 h-3.5" />
                            ) : (
                              <UserIcon className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-ink-primary flex items-center gap-1.5">
                              {u.display_name || 'Unnamed User'}
                              {isCurrentUser && (
                                <span className="text-[10px] bg-ink-primary/10 text-ink-primary px-1.5 py-0.2 rounded font-mono">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-ink-muted font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                            isAdmin
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : u.role === UserRole.DEPARTMENT_OFFICER
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : u.role === UserRole.FIELD_OFFICER
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-canvas-elevated text-ink-muted border border-ink-border'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3 px-4 text-xs text-ink-muted">
                        {isGovStaff ? (
                          <span title={u.department_id}>
                            {getDepartmentName(u.department_id)}
                          </span>
                        ) : (
                          <span className="text-ink-muted/50">—</span>
                        )}
                      </td>

                      {/* Status */}
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

                      {/* Created */}
                      <td className="py-3 px-4 text-xs font-mono text-ink-muted">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions Matrix */}
                      <td className="py-3 px-4 text-right">
                        {isActionBusy ? (
                          <Loader2 className="w-4 h-4 animate-spin text-ink-primary ml-auto" />
                        ) : isGovStaff ? (
                          <div className="flex items-center justify-end gap-2">
                            {/* Resend Invitation (INVITED only) */}
                            {isInvited && (
                              <button
                                onClick={() => handleResendInvite(u)}
                                className="px-2.5 py-1 text-xs border border-ink-border rounded bg-canvas-elevated text-ink-primary hover:bg-canvas-card transition-colors inline-flex items-center gap-1"
                                title="Resend invitation email"
                              >
                                <Mail className="w-3 h-3" />
                                Resend Invite
                              </button>
                            )}

                            {/* Disable Account (Active staff, cannot disable self) */}
                            {isActive && (
                              <button
                                onClick={() => handleDisableUser(u)}
                                disabled={isCurrentUser}
                                className="px-2.5 py-1 text-xs border border-rose-500/30 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center gap-1"
                                title={
                                  isCurrentUser
                                    ? 'Cannot disable your own administrative account'
                                    : 'Disable account'
                                }
                              >
                                <UserX className="w-3 h-3" />
                                Disable
                              </button>
                            )}

                            {/* Enable Account (Inactive staff) */}
                            {isInactive && (
                              <button
                                onClick={() => handleEnableUser(u)}
                                className="px-2.5 py-1 text-xs border border-emerald-500/30 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1"
                                title="Re-enable account"
                              >
                                <UserCheck className="w-3 h-3" />
                                Enable
                              </button>
                            )}
                          </div>
                        ) : isCitizen ? (
                          <span className="text-[11px] text-ink-muted font-mono">
                            Citizen Account
                          </span>
                        ) : isAdmin ? (
                          <span className="text-[11px] text-ink-muted font-mono">
                            System Admin
                          </span>
                        ) : (
                          <span className="text-ink-muted/50">—</span>
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
    </div>
  );
}
