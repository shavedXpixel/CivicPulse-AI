'use client';

import React, { useEffect, useState } from 'react';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { apiClient } from '../../../lib/api-client';
import { ProblemCluster } from '@civicpulse/shared';
import { TrendingUp, RefreshCw, BarChart2 } from 'lucide-react';

interface CategoryTrend {
  category: string;
  activeProblems: number;
  totalSignals: number;
  description: string;
}

export default function TrendsPage() {
  const [trends, setTrends] = useState<CategoryTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ data: ProblemCluster[] }>('/api/v1/problems');
      const problems = res?.data || [];
      if (problems.length === 0) {
        setTrends([]);
      } else {
        const catMap = new Map<string, { count: number; signals: number }>();
        for (const p of problems) {
          const cat = p.category ? p.category.replace(/_/g, ' ') : 'General Municipal';
          const entry = catMap.get(cat) || { count: 0, signals: 0 };
          entry.count += 1;
          entry.signals += (p.signal_count || 1);
          catMap.set(cat, entry);
        }
        const calculated: CategoryTrend[] = Array.from(catMap.entries()).map(([cat, data]) => ({
          category: cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase(),
          activeProblems: data.count,
          totalSignals: data.signals,
          description: `Live incident cluster activity aggregated from verified citizen signals in ${cat}.`,
        }));
        setTrends(calculated);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load live problem trends.');
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, []);

  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <PageHeader
          title="Problem Trends & Velocity"
          description="Track active problem categories and verified citizen signal velocity computed from live civic data."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Trends' },
          ]}
          actions={
            <button
              onClick={fetchTrends}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-ink-border bg-white hover:bg-canvas-subtle text-ink-primary transition-colors disabled:opacity-50 shadow-subtle"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          }
        />

        {loading ? (
          <div className="p-12 border border-ink-border bg-canvas-card flex items-center justify-center text-xs font-mono text-ink-muted gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-civic-terracotta" />
            <span>Computing live category trends...</span>
          </div>
        ) : error ? (
          <div className="p-6 border border-rose-200 bg-rose-50 text-rose-900 text-xs font-mono">
            {error}
          </div>
        ) : trends.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trends.map((t) => (
              <div
                key={t.category}
                className="p-6 border border-ink-border bg-canvas-card space-y-4"
              >
                <div className="flex items-start justify-between border-b border-ink-border pb-3">
                  <div>
                    <h3 className="text-base font-serif font-bold text-ink-primary capitalize">{t.category}</h3>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">Live PostgreSQL Data</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-xs bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Active</span>
                  </div>
                </div>

                <p className="text-xs text-ink-secondary leading-relaxed">
                  {t.description}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono">
                  <div className="p-3 bg-canvas-subtle border border-ink-border">
                    <div className="text-[10px] text-ink-muted uppercase">ACTIVE CLUSTERS</div>
                    <div className="text-base font-bold text-ink-primary mt-0.5">{t.activeProblems}</div>
                  </div>
                  <div className="p-3 bg-canvas-subtle border border-ink-border">
                    <div className="text-[10px] text-ink-muted uppercase">VERIFIED SIGNALS</div>
                    <div className="text-base font-bold text-ink-primary mt-0.5">{t.totalSignals}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 border border-ink-border bg-canvas-card text-center space-y-2">
            <BarChart2 className="w-8 h-8 text-ink-muted mx-auto" />
            <p className="text-sm font-serif font-bold text-ink-primary">No trend data recorded</p>
            <p className="text-xs text-ink-secondary font-mono">
              Insufficient problem cluster history to calculate directional shifts or category velocity.
            </p>
          </div>
        )}
      </div>
    </GovernmentShell>
  );
}
