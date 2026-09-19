'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import { AdminAuditRecord } from '@civicpulse/shared';

export function AuditLogView() {
  const { getIdToken } = useAuth();
  const [logs, setLogs] = useState<AdminAuditRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');

  const getHeaders = useCallback(async (): Promise<Record<string, string> | undefined> => {
    const token = await getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [getIdToken]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getHeaders();
      const res = await apiClient.get<{ data: { logs: AdminAuditRecord[] } }>(
        '/api/v1/admin/audit-logs?limit=50',
        headers
      );
      if (res?.data?.logs) {
        setLogs(res.data.logs);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load administrative audit logs.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.actor_email?.toLowerCase().includes(q) ||
      l.target_email?.toLowerCase().includes(q) ||
      l.action?.toLowerCase().includes(q) ||
      l.record_hash?.toLowerCase().includes(q) ||
      l.department_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-canvas-card border border-ink-border p-4 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-ink-primary text-sm">
              Cryptographic Audit Chain Active
            </h4>
            <p className="text-xs text-ink-muted">
              Every staff provisioning, lifecycle state change, and invite event is hashed with SHA-256 and chained to prior records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Search by actor, target, action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-canvas-elevated border border-ink-border rounded text-sm text-ink-primary focus:outline-none focus:border-ink-primary"
            />
          </div>
          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-1.5 text-ink-muted hover:text-ink-primary rounded hover:bg-canvas-elevated transition-colors"
            title="Refresh logs"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-sm text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && logs.length === 0 ? (
        <div className="p-12 text-center text-ink-muted">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-ink-primary" />
          <p className="text-sm">Verifying audit log cryptographic hashes...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center bg-canvas-card border border-ink-border rounded-lg text-ink-muted">
          <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-ink-muted/50" />
          <p className="text-sm font-medium text-ink-primary">No audit records</p>
          <p className="text-xs mt-1">No administrative events have been recorded matching this query.</p>
        </div>
      ) : (
        <div className="bg-canvas-card border border-ink-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas-elevated/50 text-[11px] font-mono uppercase text-ink-muted border-b border-ink-border">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Target & Role</th>
                  <th className="py-3 px-4">Result</th>
                  <th className="py-3 px-4 font-mono text-right">Cryptographic Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border/50 font-mono text-xs">
                {filteredLogs.map((log) => {
                  const isSuccess = log.result === 'SUCCESS';
                  return (
                    <tr key={log.id} className="hover:bg-canvas-elevated/30 transition-colors">
                      <td className="py-3 px-4 text-ink-muted whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded font-medium bg-canvas-elevated text-ink-primary border border-ink-border">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-ink-primary">
                        {log.actor_email || log.actor_user_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-ink-primary">{log.target_email || '—'}</div>
                        <div className="text-[10px] text-ink-muted">
                          {log.target_role || ''} {log.department_id ? `(${log.department_id})` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {log.result}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-[11px] text-ink-muted truncate max-w-xs ml-auto" title={log.record_hash}>
                          {log.record_hash ? `${log.record_hash.slice(0, 16)}...` : '—'}
                        </div>
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
