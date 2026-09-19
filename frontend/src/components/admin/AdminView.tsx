'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminShell } from '../shells/AdminShell';
import { PageHeader } from '../ui/PageHeader';
import {
  Database,
  ShieldCheck,
  UserPlus,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Search,
  ShieldAlert,
  Lock,
  Mail,
  UserX,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api-client';
import { UserRole, UserStatus, UserProfile, Department } from '@civicpulse/shared';

export interface AdminViewProps {
  initialUsers?: UserProfile[];
  initialDepartments?: Department[];
}

export function AdminView({
  initialUsers = [],
  initialDepartments = [],
}: AdminViewProps = {}) {
  const { user, userProfile, loading: authLoading, getIdToken } = useAuth();

  const [activeTab, setActiveTab] = useState<'staff' | 'departments' | 'users' | 'specs'>('staff');

  // Directory state
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Staff creation form toggle & state
  const [showCreateStaff, setShowCreateStaff] = useState<boolean>(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>(UserRole.DEPARTMENT_OFFICER);
  const [staffDept, setStaffDept] = useState('');
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Department creation state
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptSubmitting, setDeptSubmitting] = useState(false);
  const [deptSuccess, setDeptSuccess] = useState<string | null>(null);
  const [deptError, setDeptError] = useState<string | null>(null);

  // Action status (resend, disable, enable)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; isError: boolean } | null>(null);

  // User search filter
  const [userSearch, setUserSearch] = useState('');

  const getHeaders = useCallback(async (): Promise<Record<string, string> | undefined> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [getIdToken]);

  const loadDirectoryData = useCallback(async () => {
    setLoadingData(true);
    setDataError(null);
    try {
      const headers = await getHeaders();

      const [usersRes, deptsRes] = await Promise.all([
        apiClient.get<{ data: { users: UserProfile[] } }>('/api/v1/admin/users', headers).catch((err) => {
          console.warn('Could not fetch admin users:', err);
          return null;
        }),
        apiClient.get<{ data: Department[] }>('/api/v1/departments', headers).catch((err) => {
          console.warn('Could not fetch departments:', err);
          return null;
        }),
      ]);

      if (usersRes?.data?.users) {
        setUsers(usersRes.data.users);
      }
      if (deptsRes?.data && Array.isArray(deptsRes.data)) {
        setDepartments(deptsRes.data);
        if (deptsRes.data.length > 0 && !staffDept && deptsRes.data[0]?.id) {
          setStaffDept(deptsRes.data[0].id);
        }
      }
    } catch (err: any) {
      setDataError(err.message || 'Failed to load administrative directory data.');
    } finally {
      setLoadingData(false);
    }
  }, [getHeaders, staffDept]);

  useEffect(() => {
    loadDirectoryData();
  }, [loadDirectoryData]);

  // Handle Department Creation
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptSubmitting(true);
    setDeptSuccess(null);
    setDeptError(null);

    if (!deptName.trim()) {
      setDeptError('Department name is required.');
      setDeptSubmitting(false);
      return;
    }

    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { department: Department; message?: string } }>(
        '/api/v1/admin/departments',
        {
          code: deptCode.trim() || undefined,
          name: deptName.trim(),
          description: deptDesc.trim(),
        },
        headers
      );

      const createdDept = res.data?.department;
      setDeptSuccess(`Department '${createdDept?.name || deptName}' created successfully.`);
      setDeptCode('');
      setDeptName('');
      setDeptDesc('');
      if (createdDept?.id && !staffDept) {
        setStaffDept(createdDept.id);
      }
      await loadDirectoryData();
    } catch (err: any) {
      setDeptError(err.message || 'Failed to create department.');
    } finally {
      setDeptSubmitting(false);
    }
  };

  // Handle Government Staff Provisioning
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffSubmitting(true);
    setStaffSuccess(null);
    setStaffError(null);
    setActionNotice(null);

    if (!staffEmail.trim() || !staffEmail.includes('@')) {
      setStaffError('Valid email address is required.');
      setStaffSubmitting(false);
      return;
    }

    if (!staffName.trim()) {
      setStaffError('Full Name is required.');
      setStaffSubmitting(false);
      return;
    }

    if (!staffDept) {
      setStaffError('Please select a municipal department.');
      setStaffSubmitting(false);
      return;
    }

    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{
        data: {
          user: UserProfile;
          message?: string;
          notice?: string;
        };
      }>(
        '/api/v1/admin/users/government',
        {
          email: staffEmail.trim(),
          full_name: staffName.trim(),
          role: staffRole,
          department_id: staffDept,
        },
        headers
      );

      const created = res.data?.user;
      setStaffSuccess(
        `Official invitation sent to ${created?.email || staffEmail} (${staffRole}). Initial status is INVITED until worker accepts invitation and establishes a password.`
      );
      setStaffEmail('');
      setStaffName('');
      setShowCreateStaff(false);
      await loadDirectoryData();
    } catch (err: any) {
      setStaffError(err.message || 'Failed to provision government staff account.');
    } finally {
      setStaffSubmitting(false);
    }
  };

  // Handle Resending Invitation
  const handleResendInvite = async (userId: string, userEmail: string) => {
    setActionLoadingId(userId);
    setActionNotice(null);
    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { message: string } }>(
        `/api/v1/admin/users/${userId}/resend-invite`,
        {},
        headers
      );
      setActionNotice({
        message: res.data?.message || `Official invitation resent to ${userEmail}.`,
        isError: false,
      });
      await loadDirectoryData();
    } catch (err: any) {
      setActionNotice({
        message: err.message || `Failed to resend invitation to ${userEmail}.`,
        isError: true,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Disabling User
  const handleDisableUser = async (userId: string, userEmail: string) => {
    setActionLoadingId(userId);
    setActionNotice(null);
    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { message: string } }>(
        `/api/v1/admin/users/${userId}/disable`,
        {},
        headers
      );
      setActionNotice({
        message: res.data?.message || `Staff account ${userEmail} disabled successfully.`,
        isError: false,
      });
      await loadDirectoryData();
    } catch (err: any) {
      setActionNotice({
        message: err.message || `Failed to disable account ${userEmail}.`,
        isError: true,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Enabling User
  const handleEnableUser = async (userId: string, userEmail: string) => {
    setActionLoadingId(userId);
    setActionNotice(null);
    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{ data: { message: string } }>(
        `/api/v1/admin/users/${userId}/enable`,
        {},
        headers
      );
      setActionNotice({
        message: res.data?.message || `Staff account ${userEmail} re-enabled successfully.`,
        isError: false,
      });
      await loadDirectoryData();
    } catch (err: any) {
      setActionNotice({
        message: err.message || `Failed to re-enable account ${userEmail}.`,
        isError: true,
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Check RBAC permission
  const isAuthorizedAdmin =
    userProfile?.role === UserRole.ADMIN ||
    userProfile?.role === UserRole.SYSTEM_ADMIN;

  // Filter staff specifically for Government Staff view
  const staffUsers = users.filter(
    (u) => u.role === UserRole.DEPARTMENT_OFFICER || u.role === UserRole.FIELD_OFFICER
  );

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      (u.display_name && u.display_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.department_id && u.department_id.toLowerCase().includes(q))
    );
  });

  return (
    <AdminShell>
      <div className="space-y-8 max-w-6xl mx-auto pb-16">
        <PageHeader
          title="System Administration & Municipal Authority"
          description="Authoritative government identity provisioning, municipal department registry, and platform compliance."
          badge={
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-100 text-purple-900 border border-purple-200">
              LIVE AUTHORITY
            </span>
          }
          actions={
            <button
              onClick={() => loadDirectoryData()}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-ink-border text-ink-primary hover:bg-canvas-subtle transition-colors shadow-subtle"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-ink-tertiary ${loadingData ? 'animate-spin' : ''}`} />
              <span>Refresh Directory</span>
            </button>
          }
        />

        {/* RBAC Gate Warning in REAL_MODE */}
        {!authLoading && !isAuthorizedAdmin && (
          <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
            <div className="flex items-center gap-2.5 font-bold text-rose-900 text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Restricted Administration Console (HTTP 403)</span>
            </div>
            <p className="text-xs leading-relaxed">
              Your authenticated session (<code className="font-mono">{userProfile?.email || user?.email}</code>) holds the{' '}
              <strong className="font-semibold">{userProfile?.role || 'CITIZEN'}</strong> role. Government user provisioning and department creation are strictly restricted to verified Municipal Administrators.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-300 text-rose-900 hover:bg-rose-100 transition-colors"
              >
                <span>Return to Operations Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {dataError && (
          <div className="p-3 bg-rose-50 border border-rose-300 font-mono text-xs text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{dataError}</span>
          </div>
        )}

        {/* Action Notice (Resend, Disable, Enable feedback) */}
        {actionNotice && (
          <div
            className={`p-3 font-mono text-xs flex items-start gap-2 border ${
              actionNotice.isError
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            {actionNotice.isError ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <span>{actionNotice.message}</span>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-ink-border pb-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2 font-mono uppercase text-xs transition-colors flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'bg-ink-primary text-white shadow-subtle'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Government Staff ({staffUsers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 font-mono uppercase text-xs transition-colors flex items-center gap-2 ${
              activeTab === 'departments'
                ? 'bg-ink-primary text-white shadow-subtle'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments Registry ({departments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-mono uppercase text-xs transition-colors flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-ink-primary text-white shadow-subtle'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>All Users Directory ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`px-4 py-2 font-mono uppercase text-xs transition-colors flex items-center gap-2 ${
              activeTab === 'specs'
                ? 'bg-ink-primary text-white shadow-subtle'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Compliance & Connectors</span>
          </button>
        </div>

        {/* TAB 1: GOVERNMENT STAFF */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            {/* GOVERNMENT STAFF SECTION HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-canvas-card p-5 border border-ink-border">
              <div>
                <h2 className="text-base font-bold text-ink-primary font-mono uppercase tracking-wide">
                  GOVERNMENT STAFF
                </h2>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Authoritative municipal officer lifecycle: provisioning, invitations, department assignment, and status controls.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateStaff((prev) => !prev)}
                disabled={!isAuthorizedAdmin}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors font-mono uppercase shadow-subtle disabled:opacity-50 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>{showCreateStaff ? 'Cancel' : '+ Create Staff Account'}</span>
              </button>
            </div>

            {/* CREATE STAFF ACCOUNT FORM */}
            {showCreateStaff && (
              <div className="bg-canvas-card p-6 border border-ink-border space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-ink-border">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink-primary">Provision Government Staff Account</h3>
                    <p className="text-[11px] text-ink-secondary">
                      Create officer record in PostgreSQL and dispatch Supabase Auth invitation
                    </p>
                  </div>
                </div>

                {staffSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 font-mono text-xs text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{staffSuccess}</span>
                  </div>
                )}

                {staffError && (
                  <div className="p-3 bg-rose-50 border border-rose-300 font-mono text-xs text-rose-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{staffError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateStaff} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-semibold text-ink-primary">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="Er. Rajesh Kumar"
                        className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-terracotta text-ink-primary transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-semibold text-ink-primary">Email *</label>
                      <input
                        type="email"
                        required
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                        placeholder="officer@civicpulse.gov.in"
                        className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-terracotta text-ink-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-ink-primary">Role *</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setStaffRole(UserRole.DEPARTMENT_OFFICER)}
                        className={`p-3 rounded-lg border text-left font-semibold transition-all ${
                          staffRole === UserRole.DEPARTMENT_OFFICER
                            ? 'border-civic-terracotta bg-civic-blueLight/40 text-civic-terracottaDark ring-1 ring-civic-blue'
                            : 'border-ink-border bg-canvas-subtle text-ink-secondary hover:bg-white'
                        }`}
                      >
                        <div className="text-xs">DEPARTMENT_OFFICER</div>
                        <div className="text-[10px] text-ink-secondary font-normal mt-0.5">
                          Supervisory &amp; Review Authority
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStaffRole(UserRole.FIELD_OFFICER)}
                        className={`p-3 rounded-lg border text-left font-semibold transition-all ${
                          staffRole === UserRole.FIELD_OFFICER
                            ? 'border-civic-terracotta bg-civic-blueLight/40 text-civic-terracottaDark ring-1 ring-civic-blue'
                            : 'border-ink-border bg-canvas-subtle text-ink-secondary hover:bg-white'
                        }`}
                      >
                        <div className="text-xs">FIELD_OFFICER</div>
                        <div className="text-[10px] text-ink-secondary font-normal mt-0.5">
                          Assigned Work &amp; Evidence Submission
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-ink-primary">Department *</label>
                    {departments.length > 0 ? (
                      <select
                        value={staffDept}
                        onChange={(e) => setStaffDept(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-terracotta text-ink-primary transition-colors"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.id})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                        No departments registered yet. Please create a department in Departments Registry first.
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border text-[11px] text-ink-secondary space-y-1">
                    <div className="font-semibold text-ink-primary flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-civic-terracotta" />
                      <span>Zero-Knowledge Password Policy</span>
                    </div>
                    <p>
                      Administrators never supply, store, or view passwords. The government worker will receive an authoritative invitation link to verify identity and establish their password directly. Newly provisioned accounts start in <span className="font-mono font-bold text-amber-700">INVITED</span> status until activated.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateStaff(false)}
                      className="px-4 py-2 rounded-lg font-semibold text-ink-secondary hover:text-ink-primary transition-colors font-mono uppercase text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={staffSubmitting || !isAuthorizedAdmin || departments.length === 0}
                      className="py-2.5 px-5 rounded-lg font-semibold bg-purple-700 text-white hover:bg-purple-800 transition-colors shadow-subtle flex items-center justify-center gap-2 disabled:opacity-60 font-mono uppercase text-xs"
                    >
                      {staffSubmitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending Invitation...</span>
                        </>
                      ) : (
                        <span>Send Invitation</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STAFF TABLE */}
            <div className="bg-canvas-card border border-ink-border p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-3">
                <h3 className="text-sm font-bold text-ink-primary font-mono uppercase">
                  Staff Directory ({staffUsers.length})
                </h3>
                <span className="text-[11px] text-ink-secondary">
                  Only ACTIVE government staff may access operational municipal endpoints
                </span>
              </div>

              {loadingData ? (
                <div className="py-12 text-center text-ink-secondary space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-civic-terracotta mx-auto" />
                  <p className="text-xs">Loading government staff records...</p>
                </div>
              ) : staffUsers.length === 0 ? (
                <div className="py-12 text-center text-ink-secondary space-y-2">
                  <Users className="w-8 h-8 text-ink-tertiary mx-auto" />
                  <p className="text-xs font-semibold text-ink-primary">
                    No government staff accounts have been provisioned.
                  </p>
                  <p className="text-[11px]">
                    Use the &quot;+ Create Staff Account&quot; button above to invite municipal department officers and field workers.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-ink-border text-ink-secondary uppercase font-mono text-[10px]">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Created</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-border/50">
                      {staffUsers.map((u) => {
                        const dept = departments.find((d) => d.id === u.department_id);
                        const isActionLoading = actionLoadingId === u.id;
                        const status = (u.status || UserStatus.ACTIVE) as UserStatus;

                        return (
                          <tr key={u.id} className="hover:bg-canvas-subtle/50 transition-colors">
                            <td className="py-3 px-3 font-semibold text-ink-primary">
                              {u.display_name || 'Staff Member'}
                            </td>
                            <td className="py-3 px-3 text-ink-secondary font-mono text-[11px]">
                              {u.email}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  u.role === UserRole.DEPARTMENT_OFFICER
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-ink-secondary">
                              {dept ? `${dept.name} (${dept.id})` : u.department_id || '—'}
                            </td>
                            <td className="py-3 px-3">
                              {status === UserStatus.INVITED && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                  INVITED
                                </span>
                              )}
                              {status === UserStatus.ACTIVE && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ACTIVE
                                </span>
                              )}
                              {status === UserStatus.INACTIVE && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                                  INACTIVE
                                </span>
                              )}
                              {status === UserStatus.SUSPENDED && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  SUSPENDED
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-ink-secondary text-[11px]">
                              {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {status === UserStatus.INVITED && (
                                <button
                                  onClick={() => handleResendInvite(u.id, u.email || '')}
                                  disabled={isActionLoading || !isAuthorizedAdmin}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Mail className="w-3 h-3" />
                                  )}
                                  <span>Resend Invitation</span>
                                </button>
                              )}
                              {status === UserStatus.ACTIVE && (
                                <button
                                  onClick={() => handleDisableUser(u.id, u.email || '')}
                                  disabled={isActionLoading || !isAuthorizedAdmin}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <UserX className="w-3 h-3" />
                                  )}
                                  <span>Disable</span>
                                </button>
                              )}
                              {(status === UserStatus.INACTIVE || status === UserStatus.SUSPENDED) && (
                                <button
                                  onClick={() => handleEnableUser(u.id, u.email || '')}
                                  disabled={isActionLoading || !isAuthorizedAdmin}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                >
                                  {isActionLoading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <UserCheck className="w-3 h-3" />
                                  )}
                                  <span>Re-enable</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DEPARTMENTS REGISTRY */}
        {activeTab === 'departments' && (
          <div className="space-y-6">
            <div className="bg-canvas-card p-6 border border-ink-border space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-ink-border">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-civic-terracotta flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">Create Municipal Department</h3>
                  <p className="text-[11px] text-ink-secondary">Register an authoritative division in PostgreSQL</p>
                </div>
              </div>

              {deptSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 font-mono text-xs text-emerald-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{deptSuccess}</span>
                </div>
              )}

              {deptError && (
                <div className="p-3 bg-rose-50 border border-rose-300 font-mono text-xs text-rose-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{deptError}</span>
                </div>
              )}

              <form onSubmit={handleCreateDepartment} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block font-semibold text-ink-primary">
                    Department Code / Identifier <span className="text-ink-tertiary">(e.g. BMC_ROADS)</span>
                  </label>
                  <input
                    type="text"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="BMC_ROADS"
                    className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-terracotta uppercase font-mono text-ink-primary transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-ink-primary">Department Full Name *</label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="BMC Roads & Infrastructure Division"
                    className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-terracotta text-ink-primary transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block font-semibold text-ink-primary">Description / Scope</label>
                  <textarea
                    rows={3}
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                    placeholder="Citywide municipal road maintenance, pothole repairs, and asphalt engineering."
                    className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-terracotta text-ink-primary transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={deptSubmitting || !isAuthorizedAdmin}
                  className="w-full py-2.5 px-4 rounded-lg font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors font-mono uppercase text-xs flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deptSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Department...</span>
                    </>
                  ) : (
                    <span>Create Department</span>
                  )}
                </button>
              </form>
            </div>

            <div className="bg-canvas-card border border-ink-border p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-ink-border pb-4">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">Registered Municipal Departments</h3>
                  <p className="text-xs text-ink-secondary">Live department entities used for incident routing and SLA assignment</p>
                </div>
              </div>

              {loadingData ? (
                <div className="py-12 text-center text-ink-secondary space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-civic-terracotta mx-auto" />
                  <p className="text-xs">Loading department registry...</p>
                </div>
              ) : departments.length === 0 ? (
                <div className="py-12 text-center text-ink-secondary space-y-2">
                  <Building2 className="w-8 h-8 text-ink-tertiary mx-auto" />
                  <p className="text-xs font-semibold text-ink-primary">No departments registered</p>
                  <p className="text-[11px]">Use the form above to register municipal departments.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {departments.map((d) => (
                    <div key={d.id} className="p-4 rounded-xl border border-ink-border bg-canvas-subtle space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-ink-border text-civic-terracotta">
                          {d.id}
                        </span>
                        {d.short_name && (
                          <span className="text-[11px] text-ink-secondary font-medium">
                            Short: {d.short_name}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-ink-primary">{d.name}</h4>
                      {d.description && (
                        <p className="text-xs text-ink-secondary leading-relaxed">{d.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div className="bg-canvas-card border border-ink-border p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-ink-primary">Registered Users &amp; Identities</h3>
                <p className="text-xs text-ink-secondary">Live authoritative user records queried from PostgreSQL</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-ink-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name, email..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-ink-border bg-canvas-subtle text-xs focus:bg-white focus:outline-none focus:border-civic-terracotta transition-colors"
                />
              </div>
            </div>

            {loadingData ? (
              <div className="py-12 text-center text-ink-secondary space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-civic-terracotta mx-auto" />
                <p className="text-xs">Querying authoritative user records...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-ink-secondary space-y-2">
                <Users className="w-8 h-8 text-ink-tertiary mx-auto" />
                <p className="text-xs font-semibold text-ink-primary">No users found</p>
                <p className="text-[11px]">No users match the search filter or exist in the operational database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-ink-border text-ink-secondary uppercase font-mono text-[10px]">
                      <th className="py-2.5 px-3">Officer / Citizen</th>
                      <th className="py-2.5 px-3">Email Address</th>
                      <th className="py-2.5 px-3">Role Authority</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Registered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-border/50">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-canvas-subtle/50 transition-colors">
                        <td className="py-3 px-3 font-semibold text-ink-primary">
                          {u.display_name || 'Anonymous User'}
                        </td>
                        <td className="py-3 px-3 text-ink-secondary font-mono text-[11px]">
                          {u.email || 'No email attached'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              u.role === UserRole.ADMIN || u.role === UserRole.SYSTEM_ADMIN
                                ? 'bg-purple-100 text-purple-800'
                                : u.role === UserRole.DEPARTMENT_OFFICER
                                ? 'bg-blue-100 text-blue-800'
                                : u.role === UserRole.FIELD_OFFICER
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-ink-secondary">
                          {u.department_id || '—'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
                              u.status === UserStatus.INVITED
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : u.status === UserStatus.ACTIVE || !u.status
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : u.status === UserStatus.INACTIVE
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {u.status || 'ACTIVE'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-ink-secondary text-[11px]">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: COMPLIANCE & SPECIFICATIONS */}
        {activeTab === 'specs' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-ink-border bg-white shadow-card space-y-4">
              <div className="flex items-center gap-2 border-b border-ink-border pb-3">
                <ShieldCheck className="w-5 h-5 text-civic-emerald" />
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">
                    Authoritative Security &amp; DPDP Compliance Architecture
                  </h3>
                  <p className="text-[11px] text-ink-secondary">Server-enforced privacy and access boundaries</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-primary">
                      Role-Based Access Control (RBAC) &amp; Principle of Least Privilege
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      PostgreSQL &amp; Backend Enforcement
                    </span>
                  </div>
                  <p className="text-ink-secondary text-[11px] leading-relaxed">
                    Authorization boundaries across Citizen, Field Officer, Department Officer, and Municipal Administrator roles are verified via ES256 Supabase JWT claims and server-side RBAC middleware. Public self-registration only grants the CITIZEN role.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-primary">
                      Staff Lifecycle &amp; Activation Integrity
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      INVITED &rarr; ACTIVE
                    </span>
                  </div>
                  <p className="text-ink-secondary text-[11px] leading-relaxed">
                    Newly invited government officers start strictly in INVITED status. Only upon accepting their Supabase invitation and setting an authoritative password is their status transitioned to ACTIVE. Only ACTIVE staff may access operational endpoints.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-primary">
                      Password Privacy &amp; Credential Isolation
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                      Zero-Knowledge Administration
                    </span>
                  </div>
                  <p className="text-ink-secondary text-[11px] leading-relaxed">
                    Administrators cannot set, view, retrieve, or store passwords for other accounts. Account provisioning generates cryptographically secure invitation links through Supabase Auth for direct password creation by the officer.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ink-primary">
                      Cryptographic Administrative Audit Trail
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      SHA-256 Hash Chain
                    </span>
                  </div>
                  <p className="text-ink-secondary text-[11px] leading-relaxed">
                    Every administrative action (staff provisioning, resending invitations, disabling/enabling accounts, department creation) is recorded to an append-only audit ledger with cryptographic hash chaining (previous_hash, record_hash).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
