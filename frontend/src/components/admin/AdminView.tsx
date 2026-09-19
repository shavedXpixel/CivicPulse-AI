'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AdminShell } from '../shells/AdminShell';
import { PageHeader } from '../ui/PageHeader';
import {
  Database,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Users,
  CheckCircle2,
  ArrowRight,
  Server,
  Lock,
  FileText
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../lib/api-client';
import { AuditLogView } from './AuditLogView';
import { StaffDirectory } from './StaffDirectory';
import { Department, UserProfile, UserRole } from '@civicpulse/shared';

export interface AdminViewProps {
  initialUsers?: UserProfile[];
  initialDepartments?: Department[];
}

export function AdminView({ initialUsers = [], initialDepartments = [] }: AdminViewProps = {}) {
  const { user, userProfile, loading: authLoading, getIdToken } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'staff' | 'overview' | 'audit'>('staff');

  const isAuthorizedAdmin =
    userProfile?.role === UserRole.ADMIN || userProfile?.role === UserRole.SYSTEM_ADMIN;

  const getHeaders = useCallback(async (): Promise<Record<string, string> | undefined> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [getIdToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getHeaders();
      const [usersRes, deptsRes, healthRes] = await Promise.all([
        apiClient.get<{ data: { users: UserProfile[] } }>('/api/v1/admin/users', headers).catch(() => null),
        apiClient.get<{ data: Department[] }>('/api/v1/departments', headers).catch(() => null),
        apiClient.get<{ data: any }>('/api/v1/health').catch(() => null)
      ]);

      if (usersRes?.data?.users) {
        setUsers(usersRes.data.users);
      }
      if (deptsRes?.data && Array.isArray(deptsRes.data)) {
        setDepartments(deptsRes.data);
      }
      if (healthRes?.data) {
        setHealth(healthRes.data);
      }
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pendingInvites = users.filter((u) => u.status === 'INVITED').length;
  const activeStaff = users.filter(
    (u) => (u.role === 'DEPARTMENT_OFFICER' || u.role === 'FIELD_OFFICER') && u.status === 'ACTIVE'
  ).length;
  const activeDepts = departments.filter((d) => (d.status as any) !== 'INACTIVE').length;

  return (
    <AdminShell>
      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <PageHeader
          title="System Administration & Municipal Authority"
          description="Platform operational controls, governance compliance, staff provisioning, and immutable audit logs."
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono">
              <ShieldCheck className={`w-3.5 h-3.5 ${loading ? 'animate-pulse' : ''}`} />
              {loading ? 'SYNCING ENGINE...' : 'SYSTEM AUTHORITATIVE'}
            </span>
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-ink-border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-ink-primary text-ink-primary'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <Server className="w-4 h-4" />
            Platform Health & Overview
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'staff'
                ? 'border-ink-primary text-ink-primary'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            Government Staff Provisioning
            {pendingInvites > 0 && (
              <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 rounded-full text-[10px] font-mono">
                {pendingInvites}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'audit'
                ? 'border-ink-primary text-ink-primary'
                : 'border-transparent text-ink-muted hover:text-ink-primary'
            }`}
          >
            <FileText className="w-4 h-4" />
            Cryptographic Audit Log
          </button>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Quick Directory Jump Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/admin/departments"
                className="p-5 bg-canvas-card border border-ink-border rounded-lg hover:border-ink-muted transition-all group flex items-start justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-5 h-5 text-ink-primary" />
                    <h3 className="font-semibold text-ink-primary text-base">
                      Department Registry
                    </h3>
                  </div>
                  <p className="text-xs text-ink-muted mb-3">
                    View, register, and manage municipal departments, active jurisdictions, and live workload telemetry.
                  </p>
                  <div className="text-xs font-mono text-ink-primary">
                    {departments.length} registered ({activeDepts} active)
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-ink-primary group-hover:translate-x-1 transition-all" />
              </Link>

              <Link
                href="/admin/users"
                className="p-5 bg-canvas-card border border-ink-border rounded-lg hover:border-ink-muted transition-all group flex items-start justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-ink-primary" />
                    <h3 className="font-semibold text-ink-primary text-base">
                      User & Access Directory
                    </h3>
                  </div>
                  <p className="text-xs text-ink-muted mb-3">
                    Directory of administrators, department officers, field officers, and registered citizens with role management.
                  </p>
                  <div className="text-xs font-mono text-ink-primary">
                    {users.length} total users ({activeStaff} active staff)
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-ink-muted group-hover:text-ink-primary group-hover:translate-x-1 transition-all" />
              </Link>
            </div>

            {/* Platform Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-canvas-card border border-ink-border rounded-lg">
                <div className="text-xs font-mono uppercase text-ink-muted">Backend Service</div>
                <div className="text-lg font-bold text-ink-primary mt-1 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  {health?.status || 'OPERATIONAL'}
                </div>
                <div className="text-[11px] text-ink-muted mt-1 font-mono">
                  Uptime: {health?.uptime ? `${Math.round(health.uptime)}s` : 'Active'}
                </div>
              </div>

              <div className="p-4 bg-canvas-card border border-ink-border rounded-lg">
                <div className="text-xs font-mono uppercase text-ink-muted">Database Engine</div>
                <div className="text-lg font-bold text-ink-primary mt-1 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  PostgreSQL
                </div>
                <div className="text-[11px] text-ink-muted mt-1 font-mono">
                  Schema Version: 0009
                </div>
              </div>

              <div className="p-4 bg-canvas-card border border-ink-border rounded-lg">
                <div className="text-xs font-mono uppercase text-ink-muted">Active Staff</div>
                <div className="text-lg font-bold text-ink-primary mt-1 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  {activeStaff}
                </div>
                <div className="text-[11px] text-ink-muted mt-1 font-mono">
                  {pendingInvites} invitation{pendingInvites === 1 ? '' : 's'} pending
                </div>
              </div>

              <div className="p-4 bg-canvas-card border border-ink-border rounded-lg">
                <div className="text-xs font-mono uppercase text-ink-muted">Audit Hash Chain</div>
                <div className="text-lg font-bold text-ink-primary mt-1 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  VERIFIED
                </div>
                <div className="text-[11px] text-ink-muted mt-1 font-mono">
                  SHA-256 Chained Integrity
                </div>
              </div>
            </div>

            {/* Compliance & Security Callout */}
            <div className="p-5 bg-canvas-card border border-ink-border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-ink-primary" />
                <h4 className="text-sm font-semibold text-ink-primary">
                  Production Security & Privacy Invariants
                </h4>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-ink-muted">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Zero admin password handling — officers set passwords via official email links.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Strict server-side scoping — Department & Field Officer boundaries enforced.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Frozen inactive departments — cannot be selected for new staff provisioning.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Tamper-evident audit trail — all administrative actions hashed and chained.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <StaffDirectory initialStaff={users} initialDepartments={departments} />
        )}

        {activeTab === 'audit' && <AuditLogView />}
      </div>
    </AdminShell>
  );
}
