'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { GovernmentShell } from '../../../components/shells/GovernmentShell';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import {
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { apiClient, ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../context/AuthContext';
import {
  InterventionType,
  SimulationResult,
  BudgetAllocationResult,
  SimulationScenarioInput,
  SIMULATION_CONSTANTS,
  ProblemCluster,
} from '@civicpulse/shared';

export default function InterventionSimulatorPage() {
  const { user, userProfile, getIdToken } = useAuth();
  const [queryProblemId, setQueryProblemId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('problemId');
      if (q) setQueryProblemId(q);
    }
  }, []);

  const [mode, setMode] = useState<'PROBLEM' | 'BUDGET'>('PROBLEM');
  const [problems, setProblems] = useState<ProblemCluster[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');

  // Single-Problem Simulation State
  const [scenarioName, setScenarioName] = useState<string>('Accelerated Dual-Crew Repair & Mechanical Sleeve');
  const [interventionType, setInterventionType] = useState<InterventionType>(InterventionType.CAPACITY_BOOST);
  const [budgetInr, setBudgetInr] = useState<number>(420000);
  const [extraCrews, setExtraCrews] = useState<number>(2);
  const [reliefRate, setReliefRate] = useState<number>(0.95);
  const [timeReduction, setTimeReduction] = useState<number>(0);
  const [includeFacility, setIncludeFacility] = useState<boolean>(true);
  const [includeRenewal, setIncludeRenewal] = useState<boolean>(false);

  // Results State
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [budgetResult, setBudgetResult] = useState<BudgetAllocationResult | null>(null);
  const [cityBudgetInput, setCityBudgetInput] = useState<number>(1000000);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCitizenForbidden, setIsCitizenForbidden] = useState<boolean>(false);

  // Fetch available live problems on mount
  useEffect(() => {
    async function loadProblems() {
      try {
        const res = await apiClient.get<{ data: ProblemCluster[] }>('/api/v1/problems');
        const list = res?.data || [];
        setProblems(list);
        if (list.length > 0) {
          if (queryProblemId && list.some((p) => p.id === queryProblemId)) {
            setSelectedProblemId(queryProblemId);
          } else {
            setSelectedProblemId(list[0]!.id);
          }
        }
      } catch (err) {
        console.warn('Could not load problems for simulation:', err);
      }
    }
    loadProblems();
  }, [queryProblemId]);

  const runProblemSimulation = useCallback(async (
    customParams?: Partial<SimulationScenarioInput>
  ) => {
    if (userProfile?.role === 'CITIZEN') {
      setIsCitizenForbidden(true);
      setError('Simulation workspace is restricted to municipal administrators and department officers.');
      return;
    }

    const targetProblemId = customParams?.problem_id || selectedProblemId;
    if (!targetProblemId) {
      setError('Please select an active problem cluster to simulate.');
      return;
    }

    setLoading(true);
    setError(null);
    setIsCitizenForbidden(false);

    const payload: SimulationScenarioInput = {
      problem_id: targetProblemId,
      scenario_name: customParams?.scenario_name || scenarioName,
      intervention_type: customParams?.intervention_type || interventionType,
      additional_budget_inr: customParams?.additional_budget_inr !== undefined ? customParams.additional_budget_inr : budgetInr,
      extra_crews: customParams?.extra_crews !== undefined ? customParams.extra_crews : extraCrews,
      population_relief_rate: customParams?.population_relief_rate !== undefined ? customParams.population_relief_rate : reliefRate,
      response_time_reduction_hours: customParams?.response_time_reduction_hours !== undefined ? customParams.response_time_reduction_hours : timeReduction,
      assumed_baseline_remaining_hours: 24,
      include_facility_mitigation: customParams?.include_facility_mitigation !== undefined ? customParams.include_facility_mitigation : includeFacility,
      include_permanent_renewal: customParams?.include_permanent_renewal !== undefined ? customParams.include_permanent_renewal : includeRenewal
    };

    try {
      const token = await getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const res = await apiClient.post<{ data: SimulationResult }>(
        '/api/v1/simulations/problem',
        payload,
        headers
      );
      setSimulationResult(res.data);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setIsCitizenForbidden(true);
        setError(err.message || 'Access denied: unauthorized for this simulation.');
        setSimulationResult(null);
      } else {
        setError(err?.message || 'Simulation execution failed.');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProblemId, scenarioName, interventionType, budgetInr, extraCrews, reliefRate, timeReduction, includeFacility, includeRenewal, userProfile?.role, getIdToken]);

  const runBudgetAllocation = useCallback(async () => {
    if (userProfile?.role !== 'ADMIN') {
      setError('Citywide budget allocation optimization requires Municipal Administrator credentials.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const res = await apiClient.post<{ data: BudgetAllocationResult }>(
        '/api/v1/simulations/budget-allocation',
        { total_budget_inr: cityBudgetInput },
        headers
      );
      setBudgetResult(res.data);
    } catch (err: any) {
      setError(err?.message || 'Budget allocation simulation failed.');
    } finally {
      setLoading(false);
    }
  }, [cityBudgetInput, userProfile?.role, getIdToken]);

  // Initial simulation run when selected problem changes
  useEffect(() => {
    if (selectedProblemId && userProfile && userProfile.role !== 'CITIZEN') {
      runProblemSimulation();
    }
  }, [selectedProblemId, userProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply Preset Scenario helper
  const applyPreset = (presetLetter: 'A' | 'B' | 'C') => {
    if (presetLetter === 'A') {
      const p = {
        scenario_name: 'Emergency Tanker Surge & Bottled Water Distribution',
        intervention_type: InterventionType.EMERGENCY_DISPATCH,
        additional_budget_inr: 150000,
        extra_crews: 2,
        population_relief_rate: 0.65,
        response_time_reduction_hours: 4,
        include_facility_mitigation: true,
        include_permanent_renewal: false
      };
      setScenarioName(p.scenario_name);
      setInterventionType(p.intervention_type);
      setBudgetInr(p.additional_budget_inr);
      setExtraCrews(p.extra_crews);
      setReliefRate(p.population_relief_rate);
      setTimeReduction(p.response_time_reduction_hours);
      setIncludeFacility(p.include_facility_mitigation);
      setIncludeRenewal(p.include_permanent_renewal);
      runProblemSimulation(p);
    } else if (presetLetter === 'B') {
      const p = {
        scenario_name: 'Accelerated Dual-Crew Repair & Mechanical Sleeve',
        intervention_type: InterventionType.CAPACITY_BOOST,
        additional_budget_inr: 420000,
        extra_crews: 2,
        population_relief_rate: 0.95,
        response_time_reduction_hours: 0,
        include_facility_mitigation: true,
        include_permanent_renewal: false
      };
      setScenarioName(p.scenario_name);
      setInterventionType(p.intervention_type);
      setBudgetInr(p.additional_budget_inr);
      setExtraCrews(p.extra_crews);
      setReliefRate(p.population_relief_rate);
      setTimeReduction(p.response_time_reduction_hours);
      setIncludeFacility(p.include_facility_mitigation);
      setIncludeRenewal(p.include_permanent_renewal);
      runProblemSimulation(p);
    } else if (presetLetter === 'C') {
      const p = {
        scenario_name: 'Resilient Culvert Bypass Loop & Permanent Renewal',
        intervention_type: InterventionType.INFRASTRUCTURE_REPAIR,
        additional_budget_inr: 850000,
        extra_crews: 3,
        population_relief_rate: 1.0,
        response_time_reduction_hours: 0,
        include_facility_mitigation: true,
        include_permanent_renewal: true
      };
      setScenarioName(p.scenario_name);
      setInterventionType(p.intervention_type);
      setBudgetInr(p.additional_budget_inr);
      setExtraCrews(p.extra_crews);
      setReliefRate(p.population_relief_rate);
      setTimeReduction(p.response_time_reduction_hours);
      setIncludeFacility(p.include_facility_mitigation);
      setIncludeRenewal(p.include_permanent_renewal);
      runProblemSimulation(p);
    }
  };

  const currentProblem = problems.find((p) => p.id === selectedProblemId);

  return (
    <GovernmentShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Page Header */}
        <PageHeader
          title="What-If Intervention Simulator"
          description="Read-only deterministic decision-support workspace. Model hypothetical personnel surges, emergency relief packages, and capital renewals without modifying live problem records, SLA states, or municipal budgets."
          breadcrumbs={[
            { label: 'Operations', href: '/dashboard' },
            { label: 'Intervention Simulator' },
          ]}
          badge={
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs text-[10px] font-mono uppercase font-semibold bg-canvas-subtle text-ink-primary border border-ink-border">
              <Sliders className="w-3.5 h-3.5 text-amber-700" />
              <span>SIMULATION / ADVISORY</span>
            </div>
          }
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-ink-border bg-white hover:bg-canvas-subtle text-ink-primary transition-colors"
              >
                <span>Command Center</span>
              </Link>
              {selectedProblemId && (
                <Link
                  href={`/dashboard/problems/${selectedProblemId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-ink-border bg-white hover:bg-canvas-subtle text-ink-primary transition-colors"
                >
                  <span>Problem #{selectedProblemId}</span>
                  <ArrowRight className="w-3 h-3 text-ink-tertiary" />
                </Link>
              )}
              <Link
                href={`/dashboard/ai${selectedProblemId ? `?problemId=${selectedProblemId}` : ''}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-civic-terracotta text-white hover:bg-civic-terracottaDark transition-colors"
              >
                <span>Governance AI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          }
        />

        {/* Advisory Policy Banner */}
        <div className="p-4 border border-amber-300 bg-amber-50/70 text-amber-950 flex items-start gap-3 text-xs leading-relaxed">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold uppercase tracking-wider font-mono">
              Advisory Decision-Support Mode Active:
            </span>
            <p>
              Projections are computed strictly through deterministic mathematical modeling. Projections do not mutate live databases, dispatch physical field crews, approve municipal expenditures, or retroactively reverse existing SLA breaches.
            </p>
          </div>
        </div>

        {/* Authenticated Operator Scope Banner */}
        <div className="p-4 border border-ink-border bg-canvas-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="font-bold text-ink-primary flex items-center gap-2">
                <span>{userProfile?.display_name || user?.email || 'Authenticated Officer'}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-800">
                  {userProfile?.role || 'GOVERNMENT'}
                </span>
                {userProfile?.department_id && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-blue-100 text-blue-800">
                    Dept: {userProfile.department_id}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-ink-secondary font-mono">
                {user?.email} • Live PostgreSQL session token authoritative
              </p>
            </div>
          </div>
          <div className="text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            ✓ Authenticated Session Active
          </div>
        </div>

        {/* Citizen 403 Forbidden Screen */}
        {isCitizenForbidden && (
          <div className="p-8 border border-rose-300 bg-rose-50/50 space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-rose-900">
                    Intervention Simulator Access Restricted
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-200 text-rose-900">
                    HTTP 403 FORBIDDEN
                  </span>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  The What-If Intervention Simulator is restricted to authorized municipal decision-makers and department engineering heads. Citizen accounts are barred from running hypothetical resource allocation models or accessing internal capacity estimates.
                </p>
                <div className="bg-white/80 p-3.5 rounded-lg border border-rose-200 text-xs text-ink-secondary space-y-1.5 font-mono">
                  <div><strong>Current User:</strong> {userProfile?.display_name || user?.email} (Citizen)</div>
                  <div><strong>Authorization Check:</strong> <code>role === UserRole.CITIZEN</code> $\rightarrow$ Blocked</div>
                </div>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href="/dashboard"
                    className="text-xs font-mono text-civic-terracotta hover:underline inline-flex items-center gap-1"
                  >
                    <span>Return to Public Operations Dashboard</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {!isCitizenForbidden && error && (
          <div className="p-4 border border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="font-semibold">Simulation Notice</div>
              <div>{error}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => runProblemSimulation()}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty Problems State */}
        {!isCitizenForbidden && problems.length === 0 && (
          <div className="p-12 border border-ink-border bg-canvas-card text-center space-y-2">
            <Sliders className="w-8 h-8 text-ink-muted mx-auto" />
            <p className="text-sm font-serif font-bold text-ink-primary">No problem clusters available</p>
            <p className="text-xs text-ink-secondary font-mono">
              Intervention simulation requires at least one active problem cluster in the database.
            </p>
          </div>
        )}

        {/* Main Simulator Workspace */}
        {!isCitizenForbidden && problems.length > 0 && (
          <div className="space-y-6">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-between border-b border-ink-border pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode('PROBLEM')}
                  className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 ${
                    mode === 'PROBLEM'
                      ? 'bg-civic-blue text-white shadow-sm'
                      : 'bg-canvas-subtle text-ink-secondary hover:text-ink-primary hover:bg-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Targeted Problem Simulation</span>
                </button>
                <button
                  onClick={() => {
                    setMode('BUDGET');
                    if (!budgetResult && userProfile?.role === 'ADMIN') {
                      runBudgetAllocation();
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-2 ${
                    mode === 'BUDGET'
                      ? 'bg-civic-blue text-white shadow-sm'
                      : 'bg-canvas-subtle text-ink-secondary hover:text-ink-primary hover:bg-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Citywide Budget Optimizer</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-ink-tertiary hidden sm:block">
                All calculations strictly owned by deterministic engine
              </div>
            </div>

            {/* MODE 1: TARGETED PROBLEM INTERVENTION */}
            {mode === 'PROBLEM' && (
              <div className="space-y-6">
                {/* Scenario Presets & Configuration Box */}
                <div className="p-6 border border-ink-border bg-canvas-card space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border/50 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-mono font-bold uppercase tracking-wider text-ink-primary">
                          Target Problem:
                        </label>
                        <select
                          value={selectedProblemId}
                          onChange={(e) => setSelectedProblemId(e.target.value)}
                          className="px-2.5 py-1 text-xs font-mono bg-canvas-subtle border border-ink-border text-ink-primary rounded focus:outline-none"
                        >
                          {problems.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.id} — {p.title || 'Incident'}
                            </option>
                          ))}
                        </select>
                      </div>
                      {currentProblem && (
                        <p className="text-xs text-ink-secondary">
                          {currentProblem.title} • Ward {currentProblem.ward_id} • Impact {currentProblem.impact_score}/100
                        </p>
                      )}
                    </div>

                    {/* Preset Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => applyPreset('A')}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                          scenarioName.includes('Emergency Tanker')
                            ? 'bg-civic-blueLight border-civic-terracotta/40 text-civic-terracottaDark font-bold'
                            : 'bg-canvas-subtle border-ink-border text-ink-secondary hover:text-ink-primary hover:bg-white'
                        }`}
                      >
                        Emergency Relief (₹1.5L)
                      </button>
                      <button
                        onClick={() => applyPreset('B')}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                          scenarioName.includes('Accelerated Dual-Crew')
                            ? 'bg-civic-blueLight border-civic-terracotta/40 text-civic-terracottaDark font-bold'
                            : 'bg-canvas-subtle border-ink-border text-ink-secondary hover:text-ink-primary hover:bg-white'
                        }`}
                      >
                        Dual-Crew Repair (₹4.2L)
                      </button>
                      <button
                        onClick={() => applyPreset('C')}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                          scenarioName.includes('Resilient Culvert')
                            ? 'bg-civic-blueLight border-civic-terracotta/40 text-civic-terracottaDark font-bold'
                            : 'bg-canvas-subtle border-ink-border text-ink-secondary hover:text-ink-primary hover:bg-white'
                        }`}
                      >
                        Permanent Renewal (₹8.5L)
                      </button>
                    </div>
                  </div>

                  {/* Interactive Parameter Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {/* Control 1: Additional Budget */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-canvas-subtle border border-ink-border/60">
                      <div className="flex justify-between font-mono text-[11px] text-ink-secondary font-semibold">
                        <span>ADDITIONAL BUDGET (INR)</span>
                        <span className="text-civic-terracotta font-bold">₹{budgetInr.toLocaleString()}</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={budgetInr}
                        onChange={(e) => setBudgetInr(Math.max(0, Number(e.target.value)))}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-ink-border bg-white font-mono"
                      />
                      <div className="text-[10px] text-ink-tertiary font-mono">
                        Direct intervention expenditure
                      </div>
                    </div>

                    {/* Control 2: Extra Crews */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-canvas-subtle border border-ink-border/60">
                      <div className="flex justify-between font-mono text-[11px] text-ink-secondary font-semibold">
                        <span>EXTRA CREWS (0-5)</span>
                        <span className="text-civic-terracotta font-bold">{extraCrews} crews</span>
                      </div>
                      <input
                        type="range"
                        min={SIMULATION_CONSTANTS.MIN_EXTRA_CREWS}
                        max={SIMULATION_CONSTANTS.MAX_EXTRA_CREWS}
                        step="1"
                        value={extraCrews}
                        onChange={(e) => setExtraCrews(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-[10px] text-ink-tertiary font-mono">
                        Speedup: +{extraCrews * 50}% physical capacity
                      </div>
                    </div>

                    {/* Control 3: Population Relief Rate */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-canvas-subtle border border-ink-border/60">
                      <div className="flex justify-between font-mono text-[11px] text-ink-secondary font-semibold">
                        <span>RELIEF COVERAGE RATE</span>
                        <span className="text-civic-terracotta font-bold">{(reliefRate * 100).toFixed(0)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={SIMULATION_CONSTANTS.MAX_POPULATION_RELIEF_RATE}
                        step="0.05"
                        value={reliefRate}
                        onChange={(e) => setReliefRate(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-[10px] text-ink-tertiary font-mono">
                        Relief target fraction of affected pop
                      </div>
                    </div>

                    {/* Control 4: Response Reduction */}
                    <div className="space-y-1.5 p-3 rounded-lg bg-canvas-subtle border border-ink-border/60">
                      <div className="flex justify-between font-mono text-[11px] text-ink-secondary font-semibold">
                        <span>RESPONSE TIME REDUCTION</span>
                        <span className="text-civic-terracotta font-bold">{timeReduction}h</span>
                      </div>
                      <input
                        type="range"
                        min={SIMULATION_CONSTANTS.MIN_RESPONSE_REDUCTION_HOURS}
                        max={SIMULATION_CONSTANTS.MAX_RESPONSE_REDUCTION_HOURS}
                        step="1"
                        value={timeReduction}
                        onChange={(e) => setTimeReduction(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="text-[10px] text-ink-tertiary font-mono">
                        Deployment staging acceleration
                      </div>
                    </div>
                  </div>

                  {/* Checkbox Toggles & Execution Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-ink-primary">
                        <input
                          type="checkbox"
                          checked={includeFacility}
                          onChange={(e) => setIncludeFacility(e.target.checked)}
                          className="rounded text-civic-terracotta"
                        />
                        <span>Facility Exposure Mitigation</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-ink-primary">
                        <input
                          type="checkbox"
                          checked={includeRenewal}
                          onChange={(e) => setIncludeRenewal(e.target.checked)}
                          className="rounded text-civic-terracotta"
                        />
                        <span>Permanent Renewal (90-Day Planning Horizon)</span>
                      </label>
                    </div>

                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => runProblemSimulation()}
                      disabled={loading || !selectedProblemId}
                      className="shrink-0"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Simulating...</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" />
                          <span>Run Deterministic Simulation</span>
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Simulation Output Cards */}
                {simulationResult && (
                  <div className="space-y-6">
                    {/* Side-by-Side Comparison: Baseline vs Projected */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Left: Authoritative Baseline State */}
                      <div className="p-6 border border-ink-border bg-canvas-card space-y-4">
                        <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-ink-tertiary">
                              SOURCE OF TRUTH
                            </span>
                            <h4 className="text-base font-bold text-ink-primary">
                              Authoritative Baseline State
                            </h4>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-xs font-mono font-semibold border border-slate-200">
                            Live Database Record
                          </span>
                        </div>

                        {/* Baseline Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border/50">
                            <div className="text-ink-tertiary font-mono text-[10px] uppercase font-semibold">
                              Impact Score
                            </div>
                            <div className="text-2xl font-bold text-civic-rose mt-1">
                              {simulationResult.baseline.impact_score} <span className="text-xs text-ink-tertiary font-normal">/ 100</span>
                            </div>
                            <div className="text-[10px] text-rose-700 font-mono mt-0.5">BASELINE PRIORITY</div>
                          </div>

                          <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border/50">
                            <div className="text-ink-tertiary font-mono text-[10px] uppercase font-semibold">
                              Exposed Population
                            </div>
                            <div className="text-2xl font-bold text-ink-primary mt-1">
                              {simulationResult.baseline.affected_population.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">Citizens in Ward</div>
                          </div>

                          <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border/50">
                            <div className="text-ink-tertiary font-mono text-[10px] uppercase font-semibold">
                              Elapsed Age
                            </div>
                            <div className="text-2xl font-bold text-ink-primary mt-1">
                              {simulationResult.baseline.elapsed_problem_hours}h
                            </div>
                            <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">Incident lifetime</div>
                          </div>
                        </div>

                        {/* Baseline SLA Status Alert */}
                        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold font-mono text-rose-900 uppercase tracking-wider text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Current SLA Utilization: {simulationResult.baseline.sla_utilization.toFixed(2)}x</span>
                          </div>
                          <p className="leading-relaxed text-[11px] text-rose-800">
                            Problem duration ({simulationResult.baseline.elapsed_problem_hours}h) baseline against statutory SLA deadline.
                          </p>
                        </div>
                      </div>

                      {/* Right: Projected Simulated State */}
                      <div className="p-6 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-card space-y-4">
                        <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-800">
                              MATHEMATICAL SIMULATION
                            </span>
                            <h4 className="text-base font-bold text-ink-primary">
                              Projected Scenario Outcomes
                            </h4>
                          </div>
                          <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-mono font-bold border border-emerald-300">
                            SIMULATED / ADVISORY
                          </span>
                        </div>

                        {/* Projected Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-lg bg-white border border-emerald-200">
                            <div className="text-ink-tertiary font-mono text-[10px] uppercase font-semibold">
                              Projected Impact
                            </div>
                            <div className="text-2xl font-bold text-emerald-700 mt-1 flex items-baseline gap-1.5">
                              <span>{simulationResult.projected.impact_score}</span>
                              <span className="text-xs font-mono font-bold text-emerald-600">
                                ({simulationResult.projected.impact_delta} pts)
                              </span>
                            </div>
                            <div className="text-[10px] text-emerald-800 font-mono mt-0.5">
                              {simulationResult.projected.impact_score <= 39 ? 'LOW' : simulationResult.projected.impact_score <= 64 ? 'MEDIUM' : 'HIGH'} IMPACT
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-white border border-emerald-200">
                            <div className="text-ink-tertiary font-mono text-[10px] uppercase font-semibold">
                              Relieved Population
                            </div>
                            <div className="text-2xl font-bold text-ink-primary mt-1">
                              {simulationResult.projected.relieved_population.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">
                              Remaining: {simulationResult.projected.remaining_exposed_population.toLocaleString()}
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-white border border-emerald-200">
                            <div className="text-ink-tertiary font-mono text-[10px] uppercase font-semibold">
                              Remaining MTTR
                            </div>
                            <div className="text-2xl font-bold text-ink-primary mt-1 flex items-baseline gap-1.5">
                              <span>{simulationResult.projected.projected_remaining_repair_hours}h</span>
                              {simulationResult.projected.time_saved_hours > 0 && (
                                <span className="text-xs font-mono font-bold text-emerald-600">
                                  (-{simulationResult.projected.time_saved_hours}h)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-ink-tertiary font-mono mt-0.5">
                              Total age: {simulationResult.projected.projected_total_elapsed_hours}h
                            </div>
                          </div>
                        </div>

                        {/* Projected SLA & Delay Mitigation Notice */}
                        <div className="p-3.5 rounded-lg bg-white border border-emerald-200 text-xs text-ink-primary space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="font-bold text-emerald-900">
                              PROJECTED SLA UTILIZATION: {simulationResult.projected.sla_utilization.toFixed(2)}x
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-secondary leading-relaxed">
                            {simulationResult.projected.sla_explanation}
                          </p>
                          <div className="pt-1 flex items-center justify-between font-mono text-[10px] text-ink-tertiary border-t border-ink-border/40 mt-1.5">
                            <span>Cost per citizen relieved:</span>
                            <span className="font-bold text-ink-primary">
                              ₹{simulationResult.projected.cost_per_citizen_relieved_inr.toFixed(2)} / citizen
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 7-Factor Component Breakdown Table */}
                    <div className="p-6 border border-ink-border bg-canvas-card space-y-4">
                      <div className="flex items-center justify-between border-b border-ink-border/60 pb-3">
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-mono font-bold uppercase tracking-wider text-ink-primary">
                            7-Factor Impact Score Component Decomposition
                          </h4>
                          <p className="text-xs text-ink-secondary font-mono">
                            Deterministic Model: Total Score = Severity + Population + Duration + Concentration + Facility + Recurrence + Evidence
                          </p>
                        </div>
                        <div className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200">
                          Sum Identity Verified: {simulationResult.projected.factors.total} === {simulationResult.projected.impact_score}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-canvas-subtle border-y border-ink-border font-mono uppercase text-[10px] text-ink-tertiary">
                            <tr>
                              <th className="py-2.5 px-3">Factor Component</th>
                              <th className="py-2.5 px-3">Max Possible</th>
                              <th className="py-2.5 px-3">Baseline Score</th>
                              <th className="py-2.5 px-3">Projected Score</th>
                              <th className="py-2.5 px-3">Component Delta</th>
                              <th className="py-2.5 px-3">Physical Mitigation Rationale</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-border/50 font-mono">
                            <tr>
                              <td className="py-2 px-3 font-semibold text-ink-primary">1. Severity</td>
                              <td className="py-2 px-3 text-ink-tertiary">25</td>
                              <td className="py-2 px-3 font-bold text-rose-700">{simulationResult.baseline.factors.severity}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{simulationResult.projected.factors.severity}</td>
                              <td className="py-2 px-3 font-bold text-emerald-600">
                                {simulationResult.projected.factors.severity - simulationResult.baseline.factors.severity}
                              </td>
                              <td className="py-2 px-3 font-sans text-ink-secondary text-[11px]">
                                {simulationResult.projected.factors.severity < simulationResult.baseline.factors.severity
                                  ? 'Physical risk isolated or municipal service quality safeguarded.'
                                  : 'Acute condition hazard remains.'}
                              </td>
                            </tr>

                            <tr>
                              <td className="py-2 px-3 font-semibold text-ink-primary">2. Population Affected</td>
                              <td className="py-2 px-3 text-ink-tertiary">20</td>
                              <td className="py-2 px-3 font-bold text-rose-700">{simulationResult.baseline.factors.population}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{simulationResult.projected.factors.population}</td>
                              <td className="py-2 px-3 font-bold text-emerald-600">
                                {simulationResult.projected.factors.population - simulationResult.baseline.factors.population}
                              </td>
                              <td className="py-2 px-3 font-sans text-ink-secondary text-[11px]">
                                Relieved {simulationResult.projected.relieved_population.toLocaleString()} citizens; remaining exposed: {simulationResult.projected.remaining_exposed_population.toLocaleString()}.
                              </td>
                            </tr>

                            <tr>
                              <td className="py-2 px-3 font-semibold text-ink-primary">3. Problem Duration</td>
                              <td className="py-2 px-3 text-ink-tertiary">15</td>
                              <td className="py-2 px-3 font-bold text-rose-700">{simulationResult.baseline.factors.duration}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{simulationResult.projected.factors.duration}</td>
                              <td className="py-2 px-3 font-bold text-slate-500">
                                {simulationResult.projected.factors.duration - simulationResult.baseline.factors.duration}
                              </td>
                              <td className="py-2 px-3 font-sans text-ink-secondary text-[11px]">
                                Total age {simulationResult.projected.projected_total_elapsed_hours}h.
                              </td>
                            </tr>

                            <tr>
                              <td className="py-2 px-3 font-semibold text-ink-primary">4. Concentration</td>
                              <td className="py-2 px-3 text-ink-tertiary">15</td>
                              <td className="py-2 px-3 font-bold text-rose-700">{simulationResult.baseline.factors.concentration}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{simulationResult.projected.factors.concentration}</td>
                              <td className="py-2 px-3 font-bold text-emerald-600">
                                {simulationResult.projected.factors.concentration - simulationResult.baseline.factors.concentration}
                              </td>
                              <td className="py-2 px-3 font-sans text-ink-secondary text-[11px]">
                                Relief mitigates acute citizen signal escalation rate.
                              </td>
                            </tr>

                            <tr>
                              <td className="py-2 px-3 font-semibold text-ink-primary">5. Critical Facility</td>
                              <td className="py-2 px-3 text-ink-tertiary">10</td>
                              <td className="py-2 px-3 font-bold text-rose-700">{simulationResult.baseline.factors.critical_facility}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{simulationResult.projected.factors.critical_facility}</td>
                              <td className="py-2 px-3 font-bold text-emerald-600">
                                {simulationResult.projected.factors.critical_facility - simulationResult.baseline.factors.critical_facility}
                              </td>
                              <td className="py-2 px-3 font-sans text-ink-secondary text-[11px]">
                                {simulationResult.projected.factors.critical_facility < simulationResult.baseline.factors.critical_facility
                                  ? 'Protected facility mitigation deployed.'
                                  : 'Facility exposure remains unmitigated.'}
                              </td>
                            </tr>

                            <tr>
                              <td className="py-2 px-3 font-semibold text-ink-primary">6. Recurrence</td>
                              <td className="py-2 px-3 text-ink-tertiary">10</td>
                              <td className="py-2 px-3 font-bold text-rose-700">{simulationResult.baseline.factors.recurrence}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{simulationResult.projected.factors.recurrence}</td>
                              <td className="py-2 px-3 font-bold text-emerald-600">
                                {simulationResult.projected.factors.recurrence - simulationResult.baseline.factors.recurrence}
                              </td>
                              <td className="py-2 px-3 font-sans text-ink-secondary text-[11px]">
                                {simulationResult.projected.factors.recurrence === 1 ? (
                                  <span className="text-amber-800 font-medium">
                                    Assumed reduced to 1/10 for modeled 90-day planning horizon (simulation assumption).
                                  </span>
                                ) : (
                                  'Standard intervention; regional recurrence risk unchanged.'
                                )}
                              </td>
                            </tr>

                            <tr>
                              <td className="py-2 px-3 font-semibold text-ink-primary">7. Evidence Confidence</td>
                              <td className="py-2 px-3 text-ink-tertiary">5</td>
                              <td className="py-2 px-3 font-bold text-rose-700">{simulationResult.baseline.factors.evidence}</td>
                              <td className="py-2 px-3 font-bold text-emerald-700">{simulationResult.projected.factors.evidence}</td>
                              <td className="py-2 px-3 font-bold text-slate-500">0</td>
                              <td className="py-2 px-3 font-sans text-ink-secondary text-[11px]">
                                Verified baseline records and field media remain auditable.
                              </td>
                            </tr>

                            <tr className="bg-canvas-subtle/70 font-bold border-t-2 border-ink-border">
                              <td className="py-2.5 px-3 uppercase text-ink-primary">TOTAL IMPACT SCORE</td>
                              <td className="py-2.5 px-3 text-ink-tertiary">100</td>
                              <td className="py-2.5 px-3 text-base text-rose-800">{simulationResult.baseline.impact_score}</td>
                              <td className="py-2.5 px-3 text-base text-emerald-800">{simulationResult.projected.impact_score}</td>
                              <td className="py-2.5 px-3 text-base text-emerald-700">
                                {simulationResult.projected.impact_delta} pts
                              </td>
                              <td className="py-2.5 px-3 font-sans text-ink-secondary text-[11px]">
                                Exact mathematical sum: {simulationResult.projected.factors.total} / 100
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* AI Strategic Decision Commentary */}
                    {simulationResult.ai_explanation && (
                      <div className="p-6 rounded-xl border border-civic-terracotta/30 bg-civic-blueLight/10 shadow-card space-y-4">
                        <div className="flex items-center justify-between border-b border-civic-terracotta/20 pb-3">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-civic-terracotta" />
                            <h4 className="text-sm font-mono font-bold uppercase tracking-wider text-civic-terracottaDark">
                              AI Strategic Decision Support Analysis
                            </h4>
                          </div>
                          <span className="text-[10px] font-mono text-ink-tertiary">
                            Grounding constrained strictly to pre-computed metrics
                          </span>
                        </div>

                        <p className="text-xs text-ink-primary leading-relaxed font-medium">
                          {simulationResult.ai_explanation.summary}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
                          <div className="p-3 rounded-lg bg-white border border-ink-border space-y-1.5">
                            <div className="font-mono font-bold uppercase tracking-wider text-[10px] text-ink-secondary">
                              Identified Operational Trade-offs:
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-ink-secondary">
                              {simulationResult.ai_explanation.trade_offs.map((to, idx) => (
                                <li key={idx}>{to}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-3 rounded-lg bg-white border border-ink-border space-y-1.5">
                            <div className="font-mono font-bold uppercase tracking-wider text-[10px] text-ink-secondary">
                              Logistical Feasibility & Constraints:
                            </div>
                            <p className="text-ink-secondary leading-relaxed">
                              {simulationResult.ai_explanation.operational_feasibility}
                            </p>
                          </div>
                        </div>

                        {simulationResult.ai_explanation.risk_considerations.length > 0 && (
                          <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-950 space-y-1 font-mono text-[11px]">
                            <span className="font-bold uppercase tracking-wider text-amber-900">
                              Risk Factors & Environmental Dependencies:
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                              {simulationResult.ai_explanation.risk_considerations.map((r, idx) => (
                                <li key={idx}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assumptions & Limitations Drawer */}
                    <div className="p-4 rounded-xl border border-ink-border/60 bg-canvas-subtle text-[11px] font-mono text-ink-tertiary space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-ink-secondary">
                        <Info className="w-3.5 h-3.5 text-civic-terracotta" />
                        <span>Documented Simulation Assumptions & Bound Constraints:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-ink-secondary">
                        {simulationResult.assumptions.map((a, idx) => (
                          <li key={idx}>{a}</li>
                        ))}
                      </ul>
                      <div className="pt-1 border-t border-ink-border/40 text-[10px] text-ink-tertiary">
                        Uncertainties: {simulationResult.uncertainty_factors.join(' • ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: CITYWIDE BUDGET OPTIMIZER */}
            {mode === 'BUDGET' && (
              <div className="space-y-6">
                <div className="p-6 border border-ink-border bg-canvas-card space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-border/50 pb-3">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-ink-primary flex items-center gap-2">
                        <span>Municipal Contingency Allocation Optimizer</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono font-bold">
                          ADMIN EXCLUSIVE
                        </span>
                      </h3>
                      <p className="text-xs text-ink-secondary">
                        Evaluates live problems across departments using greedy marginal impact reduction per rupee.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-canvas-subtle border border-ink-border px-3 py-1.5 rounded-lg text-xs font-mono font-bold">
                        <span>Budget: ₹</span>
                        <input
                          type="number"
                          step="100000"
                          value={cityBudgetInput}
                          onChange={(e) => setCityBudgetInput(Math.max(100000, Number(e.target.value)))}
                          className="w-28 bg-white border border-ink-border px-1.5 py-0.5 rounded"
                        />
                      </div>
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => runBudgetAllocation()}
                        disabled={loading || userProfile?.role !== 'ADMIN'}
                      >
                        {loading ? 'Optimizing...' : 'Optimize Allocation'}
                      </Button>
                    </div>
                  </div>

                  {userProfile?.role !== 'ADMIN' && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 font-mono">
                      Notice: Citywide multi-department budget optimization requires Municipal Administrator credentials.
                    </div>
                  )}

                  {/* Budget Allocation Summary Cards */}
                  {budgetResult && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border/50 space-y-1">
                          <div className="text-[10px] font-mono uppercase text-ink-tertiary font-bold">Total Budget</div>
                          <div className="text-xl font-bold font-mono text-ink-primary">
                            ₹{(budgetResult.total_budget_inr / 100000).toFixed(1)}L
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
                          <div className="text-[10px] font-mono uppercase text-emerald-800 font-bold">Allocated Funds</div>
                          <div className="text-xl font-bold font-mono text-emerald-700">
                            ₹{(budgetResult.allocated_budget_inr / 100000).toFixed(1)}L
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border/50 space-y-1">
                          <div className="text-[10px] font-mono uppercase text-ink-tertiary font-bold">Contingency Buffer (8%)</div>
                          <div className="text-xl font-bold font-mono text-ink-primary">
                            ₹{(budgetResult.contingency_buffer_inr / 100000).toFixed(1)}L
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-canvas-subtle border border-ink-border/50 space-y-1">
                          <div className="text-[10px] font-mono uppercase text-ink-tertiary font-bold">Citizens Relieved</div>
                          <div className="text-xl font-bold font-mono text-ink-primary">
                            {budgetResult.total_relieved_population.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
                          <div className="text-[10px] font-mono uppercase text-emerald-800 font-bold">Total Impact Reduction</div>
                          <div className="text-xl font-bold font-mono text-emerald-700">
                            -{budgetResult.aggregate_impact_reduction} pts
                          </div>
                        </div>
                      </div>

                      {/* Allocation Items Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-canvas-subtle border-y border-ink-border font-mono uppercase text-[10px] text-ink-tertiary">
                            <tr>
                              <th className="py-2.5 px-3">Problem ID & Title</th>
                              <th className="py-2.5 px-3">Department</th>
                              <th className="py-2.5 px-3">Ward</th>
                              <th className="py-2.5 px-3">Simulated Package</th>
                              <th className="py-2.5 px-3">Allocated Budget</th>
                              <th className="py-2.5 px-3">Baseline $\rightarrow$ Projected</th>
                              <th className="py-2.5 px-3">Citizens Relieved</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-border/50 font-mono">
                            {budgetResult.allocations.map((item) => (
                              <tr key={item.problem_id} className="hover:bg-canvas-subtle/50">
                                <td className="py-2.5 px-3 font-semibold text-ink-primary">
                                  <Link
                                    href={`/dashboard/problems/${item.problem_id}`}
                                    className="text-civic-terracotta hover:underline flex items-center gap-1"
                                  >
                                    <span>{item.problem_id}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </Link>
                                  <div className="text-[11px] font-sans font-normal text-ink-secondary truncate max-w-xs">
                                    {item.title}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-ink-secondary">{item.department}</td>
                                <td className="py-2.5 px-3 text-ink-secondary">{item.ward_id}</td>
                                <td className="py-2.5 px-3 font-sans text-ink-primary font-medium">{item.scenario_name}</td>
                                <td className="py-2.5 px-3 font-bold text-ink-primary">
                                  ₹{item.allocated_budget_inr.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 font-bold text-emerald-700">
                                  {item.baseline_impact} $\rightarrow$ {item.projected_impact} ({item.impact_delta} pts)
                                </td>
                                <td className="py-2.5 px-3 text-ink-primary">
                                  {item.relieved_population.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-3.5 rounded-lg bg-canvas-subtle border border-ink-border/50 text-[11px] font-mono text-ink-tertiary space-y-1">
                        <div><strong>Disclaimer:</strong> {budgetResult.disclaimer}</div>
                        <div><strong>Assumptions:</strong> {budgetResult.assumptions.join(' • ')}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GovernmentShell>
  );
}
