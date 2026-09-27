'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CitizenShell } from '../../../components/shells/CitizenShell';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Layers,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Textarea } from '../../../components/ui/Textarea';
import { Input } from '../../../components/ui/Input';
import { apiClient } from '../../../lib/api-client';
import { useAuth } from '../../../context/AuthContext';

// Common Bhubaneswar municipal wards for quick selection
const BHUBANESWAR_WARDS = [
  { id: 'WARD-018', name: 'Ward 18 — Nayapalli / Behera Sahi' },
  { id: 'WARD-030', name: 'Ward 30 — Shaheed Nagar / Janpath' },
  { id: 'WARD-034', name: 'Ward 34 — Ashok Nagar / Master Canteen' },
  { id: 'WARD-035', name: 'Ward 35 — Bapuji Nagar' },
  { id: 'WARD-012', name: 'Ward 12 — Chandrasekharpur / Sailashree Vihar' },
  { id: 'WARD-014', name: 'Ward 14 — Damana / Patia' },
  { id: 'WARD-025', name: 'Ward 25 — Rasulgarh / Palasuni' },
  { id: 'WARD-041', name: 'Ward 41 — Old Town / Lingaraj' },
  { id: 'WARD-047', name: 'Ward 47 — Khandagiri / Baramunda' },
  { id: 'WARD-052', name: 'Ward 52 — Pokhariput / Jagamara' }
];

const SECTOR_OPTIONS = [
  { value: 'AUTO', label: 'Auto-detect via Gemini AI' },
  { value: 'ROADS', label: 'Roads & Mobility Infrastructure' },
  { value: 'DRAINAGE', label: 'Stormwater Drainage & Flood Control' },
  { value: 'WATER', label: 'Water Supply & Drinking Water (WATCO)' },
  { value: 'SANITATION', label: 'Sanitation & Solid Waste Management' },
  { value: 'LIGHTING', label: 'Public & Street Lighting' },
  { value: 'PARKS', label: 'Parks, Green Spaces & Recreation' },
  { value: 'FACILITIES', label: 'Municipal Facilities & Civic Centers' },
  { value: 'HEALTHCARE', label: 'Public Health Centers' },
  { value: 'EDUCATION', label: 'Civic Schools & Skill Centers' }
];

export default function CitizenDemandPage() {
  const { loading: authLoading } = useAuth();

  const [demandText, setDemandText] = useState('');
  const [wardId, setWardId] = useState('WARD-018');
  const [customWard, setCustomWard] = useState('');
  const [localityName, setLocalityName] = useState('Nayapalli');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState('AUTO');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const activeWard = wardId === 'CUSTOM' ? customWard.trim() : wardId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demandText.trim() || demandText.trim().length < 10) {
      setError('Please provide a detailed proposal description (at least 10 characters).');
      return;
    }

    if (!activeWard) {
      setError('Please select or enter a valid BMC Ward ID.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.post<any>('/api/v1/governance/development-demand/intake', {
        demand_text: demandText.trim(),
        ward_id: activeWard,
        locality_name: localityName.trim() || undefined,
        original_language: language,
        category: category !== 'AUTO' ? category : undefined,
        source_channel: 'WEB_FORM'
      });

      setResult(res?.data || res);
    } catch (err: any) {
      console.error('Failed to submit development demand:', err);
      setError(err?.message || 'Failed to submit development demand. Please verify authentication and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CitizenShell>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/citizen"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-secondary hover:text-ink-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Citizen Portal</span>
          </Link>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-100 text-amber-900 border border-amber-300">
            <Building2 className="w-3 h-3 text-amber-700" />
            <span>Development Demand Intelligence</span>
          </div>
        </div>

        {/* Header */}
        <div className="space-y-2 text-left">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary">
            Propose Neighborhood Infrastructure Development
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">
            Submit public capital improvement proposals directly to the Bhubaneswar Development Demand Intelligence pipeline.
            Submissions are normalized into canonical representations, mapped to BMC wards, and clustered for municipal resource allocation.
          </p>
        </div>

        {/* Real Mode Privacy Guarantee Alert */}
        <div className="p-4 rounded-sm border border-emerald-300 bg-emerald-50/70 text-xs text-emerald-950 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Production Real Data Mode & DPDP Privacy Protection</span>
          </div>
          <p className="text-[11px] text-emerald-900/90 leading-relaxed font-mono">
            Every submission is processed in REAL_MODE (is_demo=false). Personal identifiers (phones, emails, residential coordinates) are deterministically redacted before Governance AI analysis. Coarse ward-level geography is preserved.
          </p>
        </div>

        {/* Success Result View */}
        {result ? (
          <div className="space-y-6 p-6 rounded-sm border border-ink-border bg-canvas-card">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <h2 className="text-base font-bold text-ink-primary">Development Demand Ingested & Processed</h2>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-sm bg-canvas-subtle border border-ink-border">
                <div>
                  <span className="text-[10px] font-mono text-ink-secondary block uppercase">Signal ID</span>
                  <span className="font-mono font-bold text-ink-primary">{result.signal?.id}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-ink-secondary block uppercase">Ward / Locality</span>
                  <span className="font-semibold text-ink-primary">
                    {result.signal?.ward_id} {result.signal?.locality_name ? `(${result.signal.locality_name})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-ink-secondary block uppercase">Detected Category</span>
                  <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-blue-100 text-blue-800 font-semibold">
                    {result.signal?.detected_category}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-ink-secondary block uppercase">Urgency</span>
                  <span className="font-mono font-semibold text-ink-primary">
                    {result.signal?.detected_urgency}
                  </span>
                </div>
              </div>

              {result.cluster && (
                <div className="p-4 rounded-sm border border-ink-border bg-amber-50/50 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                    <Layers className="w-4 h-4 text-amber-700" />
                    <span>Correlated Demand Cluster</span>
                  </div>
                  <p className="text-xs font-semibold text-ink-primary">{result.cluster.title}</p>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-ink-secondary">
                    <span>Cluster ID: {result.cluster.id}</span>
                    <span>Signals in Cluster: {result.cluster.signal_count}</span>
                    {result.cluster.composite_demand_index !== undefined && (
                      <span className="font-bold text-amber-900">
                        Composite Demand Index: {result.cluster.composite_demand_index} / 100
                      </span>
                    )}
                  </div>
                </div>
              )}

              {result.metrics && (
                <div className="p-4 rounded-sm border border-ink-border bg-canvas-subtle space-y-2">
                  <div className="flex items-center gap-2 text-ink-primary font-semibold text-xs">
                    <BarChart3 className="w-4 h-4 text-civic-terracotta" />
                    <span>HF7.5 Deterministic Metrics</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                    <div>Volume: {result.metrics.demand_volume_score} / 25</div>
                    <div>Recurrence: {result.metrics.recurrence_score} / 20</div>
                    <div>Geo Focus: {result.metrics.geographic_concentration_score} / 15</div>
                    <div>Exposure: {result.metrics.population_exposure_score} / 15</div>
                    <div>Deficit: {result.metrics.infrastructure_deficit_score} / 15</div>
                    <div>Gap: {result.metrics.investment_gap_score} / 10</div>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-sm bg-canvas-card border border-ink-border space-y-1">
                <span className="text-[10px] font-mono text-ink-secondary uppercase block">
                  Canonical English Representation (Normalized via Gemini AI)
                </span>
                <p className="text-xs text-ink-primary leading-relaxed font-sans">
                  {result.signal?.normalized_text}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setDemandText('');
                }}
              >
                Submit Another Proposal
              </Button>
              <Link href="/governance/development-demand">
                <Button variant="primary" size="sm" className="gap-1.5">
                  <span>View Governance Demand Workspace</span>
                  <Sparkles className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Submission Form */
          <form onSubmit={handleSubmit} className="space-y-6 p-6 rounded-sm border border-ink-border bg-canvas-card">
            {error && (
              <div className="p-3 rounded-sm border border-red-200 bg-red-50 text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Ward Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-primary">
                Municipal Ward (Bhubaneswar Municipal Corporation) *
              </label>
              <select
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 border border-ink-border rounded-sm bg-canvas-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-civic-blue"
              >
                {BHUBANESWAR_WARDS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
                <option value="CUSTOM">Other BMC Ward (Enter number 1–67)...</option>
              </select>
            </div>

            {wardId === 'CUSTOM' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-mono text-ink-secondary">
                  Enter Ward Number or ID (e.g. WARD-022) *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. WARD-022"
                  value={customWard}
                  onChange={(e) => setCustomWard(e.target.value)}
                  className="text-xs font-mono"
                  required
                />
              </div>
            )}

            {/* Locality / Landmark */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-primary">
                Neighborhood / Locality Name
              </label>
              <Input
                type="text"
                placeholder="e.g. Nayapalli Behera Sahi, IRC Village, Patia Square"
                value={localityName}
                onChange={(e) => setLocalityName(e.target.value)}
                className="text-xs"
              />
              <span className="text-[10px] text-ink-secondary">
                Coarse locality only. Do not provide specific house or plot numbers.
              </span>
            </div>

            {/* Language & Category Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-semibold text-ink-primary">
                  Original Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-ink-border rounded-sm bg-canvas-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-civic-blue"
                >
                  <option value="en">English</option>
                  <option value="or">Odia (ଓଡ଼ିଆ)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="mixed">Code-mixed / Multilingual</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-semibold text-ink-primary">
                  Infrastructure Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs font-mono px-3 py-2 border border-ink-border rounded-sm bg-canvas-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-civic-blue"
                >
                  {SECTOR_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Demand Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-mono font-semibold text-ink-primary">
                Detailed Infrastructure Proposal / Development Demand *
              </label>
              <Textarea
                rows={5}
                placeholder="Describe the public infrastructure requirement in detail. You can type in Odia, Hindi, or English. Example: Proposal for masonry drain lining and stormwater outfall improvement along Nayapalli canal road to prevent annual waterlogging during monsoons."
                value={demandText}
                onChange={(e) => setDemandText(e.target.value)}
                className="text-xs leading-relaxed"
                required
              />
              <div className="flex items-center justify-between text-[10px] text-ink-secondary font-mono">
                <span>Minimum 10 characters</span>
                <span>{demandText.length} characters</span>
              </div>
            </div>

            {/* Submission Action */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting || authLoading || !demandText.trim()}
                className="w-full gap-2 text-xs font-mono font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Demand Pipeline (Normalization, Embedding & Clustering)...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit to Development Demand Intelligence Pipeline</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </CitizenShell>
  );
}
