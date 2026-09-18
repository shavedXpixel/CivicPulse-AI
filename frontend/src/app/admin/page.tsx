'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminShell } from '../../components/shells/AdminShell';
import { PageHeader } from '../../components/ui/PageHeader';
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
  Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api-client';
import { UserRole, UserProfile, Department } from '@civicpulse/shared';

export default function AdminPage() {
  const { user, userProfile, loading: authLoading, isDemoMode, getIdToken } = useAuth();

  const [activeTab, setActiveTab] = useState<'provisioning' | 'users' | 'departments' | 'specs'>('provisioning');

  // Directory state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form 1: Create Department State
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptSubmitting, setDeptSubmitting] = useState(false);
  const [deptSuccess, setDeptSuccess] = useState<string | null>(null);
  const [deptError, setDeptError] = useState<string | null>(null);

  // Form 2: Create Officer State
  const [officerEmail, setOfficerEmail] = useState('');
  const [officerName, setOfficerName] = useState('');
  const [officerRole, setOfficerRole] = useState<string>(UserRole.DEPARTMENT_OFFICER);
  const [officerDept, setOfficerDept] = useState('');
  const [officerSubmitting, setOfficerSubmitting] = useState(false);
  const [officerSuccess, setOfficerSuccess] = useState<string | null>(null);
  const [officerError, setOfficerError] = useState<string | null>(null);

  // User search filter
  const [userSearch, setUserSearch] = useState('');

  const getHeaders = useCallback(async (): Promise<Record<string, string> | undefined> => {
    if (isDemoMode) {
      return { Authorization: 'Bearer demo-token-admin' };
    }
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [isDemoMode, getIdToken]);

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
        if (deptsRes.data.length > 0 && !officerDept && deptsRes.data[0]?.id) {
          setOfficerDept(deptsRes.data[0].id);
        }
      }
    } catch (err: any) {
      setDataError(err.message || 'Failed to load administrative directory data.');
    } finally {
      setLoadingData(false);
    }
  }, [getHeaders, officerDept]);

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

      setDeptSuccess(`Department '${res.data?.department?.name || deptName}' created successfully.`);
      setDeptCode('');
      setDeptName('');
      setDeptDesc('');
      await loadDirectoryData();
    } catch (err: any) {
      setDeptError(err.message || 'Failed to create department.');
    } finally {
      setDeptSubmitting(false);
    }
  };

  // Handle Government Officer Provisioning
  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfficerSubmitting(true);
    setOfficerSuccess(null);
    setOfficerError(null);

    if (!officerEmail.trim() || !officerEmail.includes('@')) {
      setOfficerError('Valid email address is required.');
      setOfficerSubmitting(false);
      return;
    }

    if (!officerName.trim()) {
      setOfficerError('Officer display name is required.');
      setOfficerSubmitting(false);
      return;
    }

    if (!officerDept) {
      setOfficerError('Please select an active municipal department.');
      setOfficerSubmitting(false);
      return;
    }

    try {
      const headers = await getHeaders();
      const res = await apiClient.post<{
        data: {
          user: UserProfile;
          invite_sent?: boolean;
          invite_link?: string;
          notice?: string;
        };
      }>(
        '/api/v1/admin/users/government',
        {
          email: officerEmail.trim(),
          display_name: officerName.trim(),
          role: officerRole,
          department_id: officerDept,
        },
        headers
      );

      const created = res.data?.user;
      setOfficerSuccess(
        `Official government invitation dispatched to ${created?.email || officerEmail} (${officerRole}). The officer will receive an email to establish their password and activate their account.`
      );
      setOfficerEmail('');
      setOfficerName('');
      await loadDirectoryData();
    } catch (err: any) {
      setOfficerError(err.message || 'Failed to provision government officer.');
    } finally {
      setOfficerSubmitting(false);
    }
  };

  // Check RBAC permission in REAL_MODE
  const isAuthorizedAdmin =
    isDemoMode ||
    userProfile?.role === UserRole.ADMIN ||
    userProfile?.role === UserRole.SYSTEM_ADMIN;

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
              {isDemoMode ? 'ADMIN_SHELL' : 'LIVE AUTHORITY'}
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
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{dataError}</span>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-ink-border pb-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('provisioning')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'provisioning'
                ? 'bg-ink-primary text-white shadow-subtle'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Account & Department Provisioning</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-ink-primary text-white shadow-subtle'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users Directory ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'departments'
                ? 'bg-ink-primary text-white shadow-subtle'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Departments Registry ({departments.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'specs'
                ? 'bg-ink-primary text-white shadow-subtle'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-canvas-subtle'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Compliance & Connectors</span>
          </button>
        </div>

        {/* TAB 1: PROVISIONING */}
        {activeTab === 'provisioning' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form 1: Create Department */}
              <div className="bg-white p-6 rounded-2xl border border-ink-border shadow-card space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-ink-border">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-civic-blue flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink-primary">Create Municipal Department</h3>
                    <p className="text-[11px] text-ink-secondary">Register an authoritative division in PostgreSQL</p>
                  </div>
                </div>

                {deptSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{deptSuccess}</span>
                  </div>
                )}

                {deptError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
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
                      className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue uppercase font-mono text-ink-primary transition-colors"
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
                      className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue text-ink-primary transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-ink-primary">Description / Scope</label>
                    <textarea
                      rows={3}
                      value={deptDesc}
                      onChange={(e) => setDeptDesc(e.target.value)}
                      placeholder="Citywide municipal road maintenance, pothole repairs, and asphalt engineering."
                      className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue text-ink-primary transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={deptSubmitting || !isAuthorizedAdmin}
                    className="w-full py-2.5 px-4 rounded-lg font-semibold bg-civic-blue text-white hover:bg-civic-blueDark transition-colors shadow-subtle flex items-center justify-center gap-2 disabled:opacity-60"
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

              {/* Form 2: Provision Government Officer */}
              <div className="bg-white p-6 rounded-2xl border border-ink-border shadow-card space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-ink-border">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink-primary">Provision Government Officer</h3>
                    <p className="text-[11px] text-ink-secondary">Create authoritative Department or Field Officer account</p>
                  </div>
                </div>

                {officerSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{officerSuccess}</span>
                  </div>
                )}


                {officerError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{officerError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateOfficer} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-ink-primary">Officer Role *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOfficerRole(UserRole.DEPARTMENT_OFFICER)}
                        className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                          officerRole === UserRole.DEPARTMENT_OFFICER
                            ? 'border-civic-blue bg-civic-blueLight/40 text-civic-blueDark ring-1 ring-civic-blue'
                            : 'border-ink-border bg-canvas-subtle text-ink-secondary hover:bg-white'
                        }`}
                      >
                        <div className="text-xs">Department Officer</div>
                        <div className="text-[10px] text-ink-secondary font-normal">Supervisory &amp; Review Authority</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOfficerRole(UserRole.FIELD_OFFICER)}
                        className={`p-2 rounded-lg border text-left font-semibold transition-all ${
                          officerRole === UserRole.FIELD_OFFICER
                            ? 'border-civic-blue bg-civic-blueLight/40 text-civic-blueDark ring-1 ring-civic-blue'
                            : 'border-ink-border bg-canvas-subtle text-ink-secondary hover:bg-white'
                        }`}
                      >
                        <div className="text-xs">Field Officer</div>
                        <div className="text-[10px] text-ink-secondary font-normal">Assigned Work &amp; Evidence Submission</div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-ink-primary">Officer Email Address *</label>
                    <input
                      type="email"
                      required
                      value={officerEmail}
                      onChange={(e) => setOfficerEmail(e.target.value)}
                      placeholder="officer@civicpulse.gov.in"
                      className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue text-ink-primary transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-ink-primary">Display Name / Title *</label>
                    <input
                      type="text"
                      required
                      value={officerName}
                      onChange={(e) => setOfficerName(e.target.value)}
                      placeholder="Er. Rajesh Kumar"
                      className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue text-ink-primary transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-ink-primary">Assigned Department *</label>
                    {departments.length > 0 ? (
                      <select
                        value={officerDept}
                        onChange={(e) => setOfficerDept(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-ink-border bg-canvas-subtle focus:bg-white focus:outline-none focus:border-civic-blue text-ink-primary transition-colors"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.id})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                        No departments registered yet. Please create a department first.
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border text-[11px] text-ink-secondary space-y-1">
                    <div className="font-semibold text-ink-primary flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-civic-blue" />
                      <span>Password Privacy Protocol</span>
                    </div>
                    <p>
                      In compliance with security rules, administrators cannot set or store passwords. The user will receive an invitation link to establish their password authoritatively.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={officerSubmitting || !isAuthorizedAdmin || departments.length === 0}
                    className="w-full py-2.5 px-4 rounded-lg font-semibold bg-purple-700 text-white hover:bg-purple-800 transition-colors shadow-subtle flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {officerSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Provisioning Officer...</span>
                      </>
                    ) : (
                      <span>Provision Government Account</span>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl border border-ink-border shadow-card p-6 space-y-4">
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
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-ink-border bg-canvas-subtle text-xs focus:bg-white focus:outline-none focus:border-civic-blue transition-colors"
                />
              </div>
            </div>

            {loadingData ? (
              <div className="py-12 text-center text-ink-secondary space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-civic-blue mx-auto" />
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
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
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

        {/* TAB 3: DEPARTMENTS REGISTRY */}
        {activeTab === 'departments' && (
          <div className="bg-white rounded-2xl border border-ink-border shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-ink-border pb-4">
              <div>
                <h3 className="text-sm font-bold text-ink-primary">Registered Municipal Departments</h3>
                <p className="text-xs text-ink-secondary">Live department entities used for incident routing and SLA assignment</p>
              </div>
              <button
                onClick={() => setActiveTab('provisioning')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-civic-blue text-white hover:bg-civic-blueDark transition-colors"
              >
                + Add Department
              </button>
            </div>

            {loadingData ? (
              <div className="py-12 text-center text-ink-secondary space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-civic-blue mx-auto" />
                <p className="text-xs">Loading department registry...</p>
              </div>
            ) : departments.length === 0 ? (
              <div className="py-12 text-center text-ink-secondary space-y-2">
                <Building2 className="w-8 h-8 text-ink-tertiary mx-auto" />
                <p className="text-xs font-semibold text-ink-primary">No departments registered</p>
                <p className="text-[11px]">Use the provisioning form to register municipal departments.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {departments.map((d) => (
                  <div key={d.id} className="p-4 rounded-xl border border-ink-border bg-canvas-subtle space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white border border-ink-border text-civic-blue">
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
                      Server-Side PII Redaction Pipeline
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-civic-blueLight text-civic-blueDark">
                      DPDP Act Compliance
                    </span>
                  </div>
                  <p className="text-ink-secondary text-[11px] leading-relaxed">
                    Aadhaar numbers, phone numbers, email addresses, and vehicle registration numbers are sanitized in server-side ingest pipelines prior to storage. No client-side checks are relied upon as authoritative protection.
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
