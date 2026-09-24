'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Info,
  Sparkles,
  Filter,
  RefreshCw
} from 'lucide-react';
import type {
  DevelopmentDemandOverviewResponse,
  DevelopmentDemandClustersResponse,
  DevelopmentDemandClusterDetailResponse,
  DevelopmentDemandMapResponse,
  DevelopmentDemandIndicatorsResponse,
  DevelopmentDemandInvestmentContextResponse,
  DevelopmentDemandAnalysisResponse,
  DemandCluster,
  DeterministicDemandMetrics
} from '@civicpulse/shared';

import { apiClient } from '../../lib/api-client';
import { DevelopmentDemandMap } from '../domain/DevelopmentDemandMap';

export interface DevelopmentDemandWorkspaceProps {
  userRole?: string;
  initialOverview?: DevelopmentDemandOverviewResponse;
  initialClusters?: DemandCluster[];
}

export function DevelopmentDemandWorkspace({
  userRole,
  initialOverview,
  initialClusters
}: DevelopmentDemandWorkspaceProps) {
  // State
  const [overview, setOverview] = useState<DevelopmentDemandOverviewResponse | null>(initialOverview || null);
  const [clusters, setClusters] = useState<DemandCluster[]>(initialClusters || []);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    initialClusters && initialClusters.length > 0 ? initialClusters[0]?.id ?? null : null
  );


  const [clusterDetail, setClusterDetail] = useState<DevelopmentDemandClusterDetailResponse | null>(null);
  const [mapData, setMapData] = useState<DevelopmentDemandMapResponse | null>(null);
  const [indicatorsData, setIndicatorsData] = useState<DevelopmentDemandIndicatorsResponse | null>(null);
  const [investmentsData, setInvestmentsData] = useState<DevelopmentDemandInvestmentContextResponse | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<DevelopmentDemandAnalysisResponse | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWard, setSelectedWard] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');

  // Loading & Error States
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(true);
  const [isLoadingClusters, setIsLoadingClusters] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Fetch Overview, Map, and Initial Clusters
  const fetchWorkspaceData = useCallback(async () => {
    setIsLoadingOverview(true);
    setIsLoadingClusters(true);
    setGlobalError(null);

    try {
      const [overviewRes, mapRes, clustersRes] = await Promise.all([
        apiClient.get<{ data: DevelopmentDemandOverviewResponse }>('/api/v1/governance/development-demand/overview'),
        apiClient.get<{ data: DevelopmentDemandMapResponse }>('/api/v1/governance/development-demand/map'),
        apiClient.get<{ data: DevelopmentDemandClustersResponse }>('/api/v1/governance/development-demand/clusters')
      ]);

      if (overviewRes?.data) setOverview(overviewRes.data);
      if (mapRes?.data) setMapData(mapRes.data);
      if (clustersRes?.data) {
        setClusters(clustersRes.data.clusters || []);
        // Auto-select first cluster if available
        if (clustersRes.data.clusters && clustersRes.data.clusters.length > 0 && !selectedClusterId) {
          const firstCluster = clustersRes.data.clusters[0];
          if (firstCluster?.id) {
            setSelectedClusterId(firstCluster.id);
          }
        }
      }

    } catch (err: any) {
      console.error('Failed to load governance development demand data:', err);
      setGlobalError(err?.message || 'Failed to load governance workspace data.');
    } finally {
      setIsLoadingOverview(false);
      setIsLoadingClusters(false);
    }
  }, [selectedClusterId]);

  useEffect(() => {
    fetchWorkspaceData();
  }, [fetchWorkspaceData]);

  // Load Cluster Detail whenever selectedClusterId changes
  useEffect(() => {
    if (!selectedClusterId) return;

    let active = true;
    setIsLoadingDetail(true);
    setAiAnalysis(null);
    setAnalysisError(null);

    Promise.all([
      apiClient.get<{ data: DevelopmentDemandClusterDetailResponse }>(
        `/api/v1/governance/development-demand/clusters/${selectedClusterId}`
      ),
      apiClient.get<{ data: DevelopmentDemandIndicatorsResponse }>(
        `/api/v1/governance/development-demand/indicators`
      ),
      apiClient.get<{ data: DevelopmentDemandInvestmentContextResponse }>(
        `/api/v1/governance/development-demand/investment-context`
      )
    ])
      .then(([clusterRes, indRes, invRes]) => {
        if (!active) return;
        if (clusterRes?.data) setClusterDetail(clusterRes.data);
        if (indRes?.data) setIndicatorsData(indRes.data);
        if (invRes?.data) setInvestmentsData(invRes.data);
      })
      .catch((err) => {
        if (!active) return;
        console.warn(`Could not load full detail for cluster ${selectedClusterId}:`, err);
      })
      .finally(() => {
        if (active) setIsLoadingDetail(false);
      });

    return () => {
      active = false;
    };
  }, [selectedClusterId]);

  // Request Governance AI Interpretation
  const handleRequestAnalysis = async () => {
    if (!selectedClusterId) return;

    setIsLoadingAnalysis(true);
    setAnalysisError(null);

    try {
      const res = await apiClient.post<any>('/api/v1/governance/development-demand/analyze', {
        cluster_id: selectedClusterId
      });

      const analysisResult = res?.analysis || res?.data || res;
      if (analysisResult && analysisResult.observed_facts) {
        setAiAnalysis(analysisResult);
      } else {
        setAnalysisError('Governance AI returned an incomplete analysis response.');
      }
    } catch (err: any) {
      console.error('Governance AI analysis request failed:', err);
      setAnalysisError('Governance analysis unavailable. Deterministic evidence remains available.');
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // Filtered Clusters List
  const filteredClusters = useMemo(() => {
    return clusters.filter((c) => {
      if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
      if (selectedWard !== 'ALL' && !c.ward_ids.includes(selectedWard)) return false;
      if (selectedPriority !== 'ALL') {
        const opp = clusterDetail?.opportunities?.find((o) => o.demand_cluster_id === c.id);
        if (opp && opp.priority_band !== selectedPriority) return false;
      }
      return true;
    });
  }, [clusters, selectedCategory, selectedWard, selectedPriority, clusterDetail]);


  // Selected Cluster Object
  const selectedCluster = useMemo(() => {
    return clusters.find((c) => c.id === selectedClusterId) || clusterDetail?.cluster || null;
  }, [clusters, selectedClusterId, clusterDetail]);

  // Deterministic Metrics (from opportunities in cluster detail)
  const currentMetrics: DeterministicDemandMetrics | null = useMemo(() => {
    if (clusterDetail?.opportunities && clusterDetail.opportunities.length > 0) {
      return clusterDetail.opportunities[0]?.metrics ?? null;
    }
    return null;
  }, [clusterDetail]);


  const isDemo = overview?.is_demo ?? false;

  return (
    <div className="min-h-screen bg-[#F4F0EA] text-[#1A1816] font-sans">
      {/* ========================================================================= */}
      {/* SECTION A: HEADER & MONOSPACE METADATA                                  */}
      {/* ========================================================================= */}
      <header className="border-b border-[#DDD7CD] bg-[#FCFAF7] px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs uppercase tracking-widest text-[#C85A32] font-semibold">
                CIVICPULSE GOVERNANCE
              </span>
              <span className="text-[#DDD7CD]">/</span>
              <span className="font-mono text-xs uppercase tracking-wider text-[#5C5852]">
                URBAN REINVESTMENT INTELLIGENCE
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1816]">
              DEVELOPMENT DEMAND INTELLIGENCE
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {isDemo ? (
              <span
                data-testid="demo-mode-badge"
                className="px-2.5 py-1 bg-[#1A1816] text-[#FCFAF7] border border-[#DDD7CD] font-bold flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-[#C85A32] animate-pulse" />
                DEMO MODE
              </span>
            ) : (
              <span
                data-testid="real-mode-badge"
                className="px-2.5 py-1 bg-[#FCFAF7] text-[#2E6F40] border border-[#2E6F40] font-bold flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-[#2E6F40]" />
                REAL PRODUCTION MODE
              </span>
            )}

            <div className="bg-[#ECE7DF] px-3 py-1 border border-[#DDD7CD] text-[#5C5852]">
              PROVENANCE: <span className="text-[#1A1816] font-semibold">AUTHORITATIVE BMC SPATIAL</span>
            </div>

            <div className="bg-[#ECE7DF] px-3 py-1 border border-[#DDD7CD] text-[#5C5852]">
              TIMESTAMP:{' '}
              <span className="text-[#1A1816]">
                {overview?.generated_at ? new Date(overview.generated_at).toLocaleTimeString() : 'LIVE'}
              </span>
            </div>

            {userRole && (
              <div className="bg-[#ECE7DF] px-3 py-1 border border-[#DDD7CD] text-[#5C5852]">
                ROLE: <span className="text-[#1A1816] font-semibold">{userRole}</span>
              </div>
            )}
          </div>
        </div>
      </header>


      {/* Global Alert / Notice */}
      {isDemo && (
        <div className="bg-[#FCFAF7] border-b border-[#DDD7CD] px-6 py-2 text-xs font-mono text-[#5C5852] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#C85A32]" />
            <span>
              SYNTHETIC SCENARIO DATASET ACTIVE — Grounded in official Bhubaneswar ward geography & HF7.5 deterministic scoring.
            </span>
          </div>
          <span className="text-[#948F86]">ZERO CITIZEN PII • ZERO HOUSEHOLD GPS</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {globalError && (
          <div className="p-3 bg-[#FCFAF7] border border-[#DDD7CD] border-l-4 border-l-[#C85A32] text-xs font-mono text-[#5C5852] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#C85A32] shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION B: DEMAND OVERVIEW METRICS                                      */}
        {/* ========================================================================= */}

        <section aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="sr-only">Demand Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 border border-[#DDD7CD] bg-[#FCFAF7] divide-y md:divide-y-0 md:divide-x divide-[#DDD7CD]">
            {/* Total Demand Signals */}
            <div className="p-4" data-testid="kpi-total-signals">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#5C5852] mb-1">
                Total Demand Signals
              </div>
              <div className="text-2xl font-bold font-mono text-[#1A1816]">
                {isLoadingOverview ? '…' : overview?.total_demand_signals ?? 0}
              </div>
              <div className="text-[10px] font-mono text-[#948F86] mt-0.5">Multilingual Ingested</div>
            </div>

            {/* Active Clusters */}
            <div className="p-4" data-testid="kpi-active-clusters">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#5C5852] mb-1">
                Active Clusters
              </div>
              <div className="text-2xl font-bold font-mono text-[#C85A32]">
                {isLoadingOverview ? '…' : overview?.total_active_demands ?? 0}
              </div>
              <div className="text-[10px] font-mono text-[#948F86] mt-0.5">Spatial-Semantic Formed</div>
            </div>

            {/* Wards Represented */}
            <div className="p-4" data-testid="kpi-wards-represented">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#5C5852] mb-1">
                Wards Represented
              </div>
              <div className="text-2xl font-bold font-mono text-[#1A1816]">
                {isLoadingOverview ? '…' : overview?.ward_demand_summary?.length ?? 0}
                <span className="text-xs font-normal text-[#948F86] ml-1">/ 67</span>
              </div>
              <div className="text-[10px] font-mono text-[#948F86] mt-0.5">BMC Municipal Boundary</div>
            </div>

            {/* Highest Composite Demand Index */}
            <div className="p-4" data-testid="kpi-highest-cdi">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#5C5852] mb-1">
                Peak Demand Index
              </div>
              <div className="text-2xl font-bold font-mono text-[#1A1816]">
                {isLoadingOverview
                  ? '…'
                  : overview?.top_sectors?.[0]?.composite_index_avg ?? 0}
                <span className="text-xs font-normal text-[#948F86] ml-1">/ 100</span>
              </div>
              <div className="text-[10px] font-mono text-[#948F86] mt-0.5">HF7.5 Deterministic</div>
            </div>

            {/* Data Coverage & Uncertainty */}
            <div className="p-4 col-span-2 md:col-span-1" data-testid="kpi-coverage">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#5C5852] mb-1">
                Data Coverage
              </div>
              <div className="text-sm font-bold font-mono text-[#2E6F40] mt-1">
                {isLoadingOverview ? '…' : `${overview?.top_sectors?.length ?? 0} Sectors`}
              </div>
              <div className="text-[10px] font-mono text-[#948F86] mt-1">
                {isDemo ? 'Reference Scenarios' : 'Live Municipal Pipeline'}
              </div>
            </div>
          </div>
        </section>

        {/* REAL_MODE Honest Empty State */}
        {!isDemo && clusters.length === 0 && !isLoadingClusters && (
          <div
            data-testid="real-mode-empty-state"
            className="border border-[#DDD7CD] bg-[#FCFAF7] p-8 text-center space-y-3"
          >
            <ShieldCheck className="w-8 h-8 text-[#5C5852] mx-auto" />
            <h3 className="font-mono text-sm uppercase tracking-wider font-bold text-[#1A1816]">
              No development-demand records are currently available.
            </h3>
            <p className="text-xs text-[#5C5852] max-w-md mx-auto">
              Real Mode operates strictly on verified citizen demand signals and official BMC infrastructure datasets.
              No synthetic records or fabricated numbers are displayed.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION C & SECTION D: MAP + CLUSTERS SPLIT VIEW                        */}
        {/* ========================================================================= */}
        {(isDemo || clusters.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT: DEMAND MAP (Section C) */}
            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between border-b border-[#DDD7CD] pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase font-bold text-[#1A1816]">
                    BMC WARD DEMAND SPATIAL MAP
                  </span>
                  <span className="text-xs font-mono text-[#948F86]">(67 Official Wards)</span>
                </div>
                <div className="text-xs font-mono text-[#C85A32]">
                  {selectedCluster ? selectedCluster.title : 'Select Cluster'}
                </div>
              </div>

              <DevelopmentDemandMap
                mapData={mapData}
                selectedClusterId={selectedClusterId || undefined}
                onSelectCluster={(id) => setSelectedClusterId(id)}
                selectedWardId={selectedWard !== 'ALL' ? selectedWard : undefined}
                onSelectWard={(w) => setSelectedWard(w)}
                height="h-[520px]"
                isLoading={isLoadingClusters}
              />
            </div>

            {/* RIGHT: CLUSTERS LIST / TABLE (Section D) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="border border-[#DDD7CD] bg-[#FCFAF7] p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-[#DDD7CD] pb-2">
                  <span className="font-mono text-xs uppercase font-bold text-[#1A1816] flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#C85A32]" /> FILTER DEMAND CLUSTERS
                  </span>
                  <span className="font-mono text-xs text-[#5C5852]">
                    {filteredClusters.length} Active
                  </span>
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-[#5C5852] block mb-1">SECTOR</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full bg-[#F4F0EA] border border-[#DDD7CD] px-2 py-1 text-xs text-[#1A1816] focus:outline-none focus:border-[#C85A32]"
                    >
                      <option value="ALL">All Sectors</option>
                      <option value="drinking_water">Drinking Water</option>
                      <option value="drainage_flood_stormwater">Drainage & Stormwater</option>
                      <option value="healthcare_accessibility">Healthcare Accessibility</option>
                      <option value="educational_facilities">Educational Facilities</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#5C5852] block mb-1">WARD</label>
                    <select
                      value={selectedWard}
                      onChange={(e) => setSelectedWard(e.target.value)}
                      className="w-full bg-[#F4F0EA] border border-[#DDD7CD] px-2 py-1 text-xs text-[#1A1816] focus:outline-none focus:border-[#C85A32]"
                    >
                      <option value="ALL">All Wards</option>
                      <option value="WARD-018">Ward 18 (Khandagiri)</option>
                      <option value="WARD-027">Ward 27 (Nayapalli)</option>
                      <option value="WARD-052">Ward 52 (Old Town)</option>
                      <option value="WARD-041">Ward 41 (Patia)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#5C5852] block mb-1">PRIORITY BAND</label>
                    <select
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                      className="w-full bg-[#F4F0EA] border border-[#DDD7CD] px-2 py-1 text-xs text-[#1A1816] focus:outline-none focus:border-[#C85A32]"
                    >
                      <option value="ALL">All Bands</option>
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>
              </div>


              {/* Clusters List */}
              <div
                className="border border-[#DDD7CD] bg-[#FCFAF7] max-h-[420px] overflow-y-auto divide-y divide-[#DDD7CD]"
                data-testid="cluster-list"
              >
                {filteredClusters.map((cluster) => {
                  const isSelected = cluster.id === selectedClusterId;
                  const cdi = clusterDetail?.opportunities?.[0]?.demand_cluster_id === cluster.id
                    ? clusterDetail.opportunities[0]?.metrics?.composite_demand_index ?? null
                    : null;


                  return (
                    <div
                      key={cluster.id}
                      onClick={() => setSelectedClusterId(cluster.id)}
                      data-testid={`cluster-row-${cluster.id}`}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#ECE7DF] border-l-4 border-l-[#C85A32]' : 'hover:bg-[#F4F0EA]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[11px] font-bold text-[#1A1816]">
                          {cluster.id}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-[#1A1816] text-[#FCFAF7]">
                          {cluster.category.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-[#1A1816] line-clamp-1 mb-1">
                        {cluster.title}
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-[#5C5852]">
                        <span>{cluster.ward_ids.join(', ')}</span>
                        <span>{cluster.signal_count} signals</span>
                        {cdi !== null && (
                          <span className="font-bold text-[#C85A32]">CDI: {cdi}/100</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredClusters.length === 0 && (
                  <div className="p-6 text-center text-xs font-mono text-[#5C5852]">
                    No clusters match the selected filter criteria.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION E: CLUSTER DETAIL DRAWER / 5-TIER PANEL                         */}
        {/* ========================================================================= */}
        {selectedCluster && (
          <section
            aria-labelledby="cluster-detail-heading"
            className="border border-[#DDD7CD] bg-[#FCFAF7] p-6 space-y-6"
            data-testid="cluster-detail-panel"
          >
            {/* Header of Detail Panel */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#DDD7CD] pb-4 gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs uppercase px-2 py-0.5 bg-[#C85A32] text-white font-bold">
                    CLUSTER DETAIL & EVIDENCE
                  </span>
                  <span className="font-mono text-xs text-[#5C5852]">{selectedCluster.id}</span>
                </div>
                <h3 id="cluster-detail-heading" className="text-lg font-bold text-[#1A1816]">
                  {selectedCluster.title}
                </h3>
              </div>

              {/* Action Button: Trigger Governance Analysis */}
              <button
                type="button"
                onClick={handleRequestAnalysis}
                disabled={isLoadingAnalysis}
                data-testid="btn-request-governance-analysis"
                className="px-4 py-2 bg-[#1A1816] hover:bg-[#C85A32] text-[#FCFAF7] font-mono text-xs uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isLoadingAnalysis ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Compiling Governance AI…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
                    <span>Request Governance Analysis</span>
                  </>
                )}
              </button>
            </div>

            {/* Error in Analysis */}
            {analysisError && (
              <div
                data-testid="analysis-error-banner"
                className="p-3 bg-[#FCFAF7] border border-[#DDD7CD] border-l-4 border-l-[#C85A32] text-xs font-mono text-[#5C5852] flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-[#C85A32] shrink-0" />
                <span>{analysisError}</span>
              </div>
            )}

            {/* Loading Cluster Detail Evidence */}
            {isLoadingDetail && (
              <div
                data-testid="loading-evidence-state"
                className="p-3 bg-[#ECE7DF] border border-[#DDD7CD] font-mono text-xs text-[#5C5852] flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#C85A32] animate-spin" />
                <span>Compiling municipal demand evidence…</span>
              </div>
            )}

            {/* 5-TIER ARCHITECTURAL DISTINCTION */}
            <div className="space-y-6">

              {/* TIER 1: VERIFIED FACTS */}
              <div className="border border-[#DDD7CD] p-4 bg-[#F4F0EA]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 bg-[#2E6F40]" />
                  <h4 className="font-mono text-xs uppercase font-bold text-[#1A1816] tracking-wider">
                    VERIFIED STRUCTURED FACTS
                  </h4>
                  <span className="text-[10px] font-mono text-[#2E6F40] bg-[#FCFAF7] px-2 py-0.5 border border-[#DDD7CD]">
                    SYSTEM VERIFIED
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[#5C5852] block">Total Ingested Signals</span>
                    <span className="text-base font-bold text-[#1A1816]">
                      {selectedCluster.signal_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5C5852] block">First Registered</span>
                    <span className="text-[#1A1816]">
                      {new Date(selectedCluster.first_signal_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5C5852] block">Last Registered</span>
                    <span className="text-[#1A1816]">
                      {new Date(selectedCluster.last_signal_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5C5852] block">Geographic Ward Scope</span>
                    <span className="text-[#1A1816] font-bold">
                      {selectedCluster.ward_ids.join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* TIER 2: UNTRUSTED CITIZEN NARRATIVES */}
              <div className="border border-[#DDD7CD] p-4 bg-[#FCFAF7]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#D97706]" />
                    <h4 className="font-mono text-xs uppercase font-bold text-[#1A1816] tracking-wider">
                      UNTRUSTED CITIZEN NARRATIVES
                    </h4>
                  </div>
                  <span
                    data-testid="trust-badge-untrusted"
                    className="text-[10px] font-mono text-[#B26A00] bg-[#ECE7DF] px-2 py-0.5 border border-[#DDD7CD]"
                  >
                    untrusted_user_content
                  </span>
                </div>

                <div className="text-[11px] font-mono text-[#5C5852] mb-3">
                  Direct citizen submissions sanitized for privacy. Subject to municipal verification; zero PII retained.
                </div>

                <div className="space-y-2">
                  {clusterDetail?.signals && clusterDetail.signals.length > 0 ? (
                    clusterDetail.signals.map((sig, idx) => (
                      <div
                        key={sig.id || idx}
                        data-testid={`signal-narrative-${idx}`}
                        className="p-3 bg-[#F4F0EA] border border-[#DDD7CD] text-xs font-mono text-[#1A1816] flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#5C5852]">
                          <span>Signal ID: {sig.id}</span>
                          <span>Channel: {sig.source_channel || (sig as any).channel}</span>
                        </div>
                        <div className="text-[#1A1816]">{sig.normalized_text}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs font-mono text-[#948F86] italic">
                      No citizen narratives compiled for this cluster.
                    </div>
                  )}
                </div>
              </div>

              {/* TIER 3 & SECTION F: DETERMINISTIC METRICS (HF7.5) */}
              <div className="border border-[#DDD7CD] p-4 bg-[#FCFAF7]" data-testid="deterministic-metrics-section">
                <div className="flex items-center justify-between mb-4 border-b border-[#DDD7CD] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#1A1816]" />
                    <h4 className="font-mono text-xs uppercase font-bold text-[#1A1816] tracking-wider">
                      DETERMINISTIC DEMAND METRICS (HF7.5)
                    </h4>
                  </div>
                  <div className="font-mono text-xs text-[#5C5852]">
                    SOVEREIGN ENGINE COMPUTATION • ZERO AI SCORING
                  </div>
                </div>

                {currentMetrics ? (
                  <div className="space-y-4">
                    {/* Six Component Bars */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Demand Volume /25 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-[#5C5852]">1. Demand Volume</span>
                          <span className="font-bold text-[#1A1816]">
                            {currentMetrics.demand_volume_score} / 25
                          </span>
                        </div>
                        <div className="w-full bg-[#ECE7DF] h-2">
                          <div
                            className="bg-[#C85A32] h-2 transition-all"
                            style={{ width: `${(currentMetrics.demand_volume_score / 25) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Recurrence /20 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-[#5C5852]">2. Recurrence / Duration</span>
                          <span className="font-bold text-[#1A1816]">
                            {currentMetrics.recurrence_score} / 20
                          </span>
                        </div>
                        <div className="w-full bg-[#ECE7DF] h-2">
                          <div
                            className="bg-[#C85A32] h-2 transition-all"
                            style={{ width: `${(currentMetrics.recurrence_score / 20) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Geographic Concentration /15 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-[#5C5852]">3. Geographic Concentration</span>
                          <span className="font-bold text-[#1A1816]">
                            {currentMetrics.geographic_concentration_score} / 15
                          </span>
                        </div>
                        <div className="w-full bg-[#ECE7DF] h-2">
                          <div
                            className="bg-[#C85A32] h-2 transition-all"
                            style={{ width: `${(currentMetrics.geographic_concentration_score / 15) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Population Exposure /15 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-[#5C5852]">4. Population Exposure</span>
                          <span className="font-bold text-[#1A1816]">
                            {currentMetrics.population_exposure_score} / 15
                          </span>
                        </div>
                        <div className="w-full bg-[#ECE7DF] h-2">
                          <div
                            className="bg-[#C85A32] h-2 transition-all"
                            style={{ width: `${(currentMetrics.population_exposure_score / 15) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Infrastructure Deficit /15 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-[#5C5852]">5. Infrastructure Deficit</span>
                          <span className="font-bold text-[#1A1816]">
                            {currentMetrics.infrastructure_deficit_score} / 15
                          </span>
                        </div>
                        <div className="w-full bg-[#ECE7DF] h-2">
                          <div
                            className="bg-[#C85A32] h-2 transition-all"
                            style={{ width: `${(currentMetrics.infrastructure_deficit_score / 15) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Investment Gap /10 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-[#5C5852]">6. Investment Gap</span>
                          <span className="font-bold text-[#1A1816]">
                            {currentMetrics.investment_gap_score} / 10
                          </span>
                        </div>
                        <div className="w-full bg-[#ECE7DF] h-2">
                          <div
                            className="bg-[#C85A32] h-2 transition-all"
                            style={{ width: `${(currentMetrics.investment_gap_score / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Total Composite Demand Index */}
                    <div className="pt-3 border-t border-[#DDD7CD] flex items-center justify-between">
                      <div className="font-mono text-sm font-bold text-[#1A1816]">
                        COMPOSITE DEMAND INDEX (CDI)
                      </div>
                      <div
                        data-testid="composite-demand-index-score"
                        className="font-mono text-2xl font-bold text-[#C85A32]"
                      >
                        {currentMetrics.composite_demand_index}
                        <span className="text-sm font-normal text-[#5C5852] ml-1">/ 100</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-[#5C5852]">
                    Compiling deterministic demand metrics…
                  </div>
                )}
              </div>

              {/* TIER 4: ADVISORY AI INTERPRETATION */}
              {aiAnalysis && (
                <div
                  data-testid="governance-ai-interpretation"
                  className="border border-[#DDD7CD] p-4 bg-[#FCFAF7] space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-[#DDD7CD] pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#C85A32]" />
                      <h4 className="font-mono text-xs uppercase font-bold text-[#1A1816] tracking-wider">
                        ADVISORY GOVERNANCE AI INTERPRETATION
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-[#5C5852] bg-[#ECE7DF] px-2 py-0.5 border border-[#DDD7CD]">
                      CONSULTATIVE ONLY • NON-OPERATIONAL
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="space-y-1">
                    <span className="font-mono text-[11px] font-bold text-[#5C5852] uppercase">
                      Executive Summary
                    </span>
                    <p className="text-xs text-[#1A1816] leading-relaxed">
                      {aiAnalysis.advisory_interpretation.summary}
                    </p>
                  </div>

                  {/* Need Justification */}
                  <div className="space-y-1">
                    <span className="font-mono text-[11px] font-bold text-[#5C5852] uppercase">
                      Need Justification
                    </span>
                    <p className="text-xs text-[#1A1816] leading-relaxed">
                      {aiAnalysis.advisory_interpretation.need_justification}
                    </p>
                  </div>

                  {/* Tradeoffs and Considerations */}
                  {aiAnalysis.advisory_interpretation.tradeoffs_and_considerations?.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-mono text-[11px] font-bold text-[#5C5852] uppercase">
                        Tradeoffs & Municipal Considerations
                      </span>
                      <ul className="list-disc list-inside text-xs text-[#5C5852] space-y-0.5">
                        {aiAnalysis.advisory_interpretation.tradeoffs_and_considerations.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* TIER 5: UNCERTAINTY & LIMITATIONS */}
              <div className="border border-[#DDD7CD] p-4 bg-[#F4F0EA] space-y-3" data-testid="uncertainty-limitations">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#C85A32]" />
                  <h4 className="font-mono text-xs uppercase font-bold text-[#1A1816] tracking-wider">
                    UNCERTAINTY & LIMITATIONS
                  </h4>
                </div>

                <div className="text-xs font-mono text-[#5C5852] space-y-1">
                  <div>
                    • Confidence Level:{' '}
                    <span className="font-bold text-[#1A1816]">
                      {aiAnalysis?.uncertainty?.confidence ?? 'HIGH'}
                    </span>
                  </div>
                  {aiAnalysis?.uncertainty?.limitations?.map((lim, idx) => (
                    <div key={idx}>• {lim}</div>
                  ))}
                  {(!investmentsData || investmentsData.investments.length === 0) && (
                    <div className="text-[#C85A32] font-semibold" data-testid="missing-investment-notice">
                      • No verified public investment context available for this ward.
                    </div>
                  )}
                  <div>
                    • Advisory boundary: Demand clustering reflects citizen-reported signals and census benchmarks; does not constitute project approval.
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* SECTION G: EVIDENCE & LINEAGE PROVENANCE CHAIN                           */}
        {/* ========================================================================= */}
        <section aria-labelledby="lineage-heading" className="border border-[#DDD7CD] bg-[#FCFAF7] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDD7CD] pb-2">
            <h3 id="lineage-heading" className="font-mono text-xs uppercase font-bold text-[#1A1816] tracking-wider">
              EVIDENCE PROVENANCE & LINEAGE CHAIN
            </h3>
            <span className="text-[10px] font-mono text-[#5C5852]">
              END-TO-END TRACEABILITY
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs font-mono">
            <div className="p-2.5 bg-[#F4F0EA] border border-[#DDD7CD]">
              <span className="text-[10px] text-[#5C5852] block">STEP 1</span>
              <span className="font-bold text-[#1A1816]">Citizen Demand</span>
            </div>
            <div className="p-2.5 bg-[#F4F0EA] border border-[#DDD7CD]">
              <span className="text-[10px] text-[#5C5852] block">STEP 2</span>
              <span className="font-bold text-[#1A1816]">Normalization</span>
            </div>
            <div className="p-2.5 bg-[#F4F0EA] border border-[#DDD7CD]">
              <span className="text-[10px] text-[#5C5852] block">STEP 3</span>
              <span className="font-bold text-[#1A1816]">Clustering</span>
            </div>
            <div className="p-2.5 bg-[#F4F0EA] border border-[#DDD7CD]">
              <span className="text-[10px] text-[#5C5852] block">STEP 4</span>
              <span className="font-bold text-[#1A1816]">Indicators</span>
            </div>
            <div className="p-2.5 bg-[#F4F0EA] border border-[#DDD7CD]">
              <span className="text-[10px] text-[#5C5852] block">STEP 5</span>
              <span className="font-bold text-[#1A1816]">HF7.5 Metrics</span>
            </div>
            <div className="p-2.5 bg-[#1A1816] text-[#FCFAF7] border border-[#DDD7CD]">
              <span className="text-[10px] text-[#DDD7CD] block">STEP 6</span>
              <span className="font-bold">Governance AI</span>
            </div>
          </div>

          {/* Traceable Citations Breakdown */}
          {aiAnalysis?.evidence_citations && (
            <div className="p-3 bg-[#F4F0EA] border border-[#DDD7CD] text-xs font-mono space-y-1">
              <div className="font-bold text-[#1A1816] mb-1">CITED EVIDENCE REFERENCES:</div>
              <div>
                • Signal IDs: {aiAnalysis.evidence_citations.signal_ids.join(', ') || 'N/A'}
              </div>
              <div>
                • Indicator Sources: {aiAnalysis.evidence_citations.indicator_sources.join(', ') || 'BMC GIS'}
              </div>
              <div>
                • Investment Records: {aiAnalysis.evidence_citations.investment_references.join(', ') || 'None Documented'}
              </div>
              {indicatorsData?.indicators && indicatorsData.indicators.length > 0 && (
                <div>
                  • Verified Ward Indicators: {indicatorsData.indicators.map((i: any) => i.name || i.metric_name).join(', ')}
                </div>
              )}
            </div>
          )}
        </section>


        {/* ========================================================================= */}
        {/* SECTION H: CANDIDATE DEVELOPMENT OPPORTUNITIES                            */}
        {/* ========================================================================= */}
        <section aria-labelledby="opportunity-heading" className="border border-[#DDD7CD] bg-[#FCFAF7] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#DDD7CD] pb-2">
            <h3 id="opportunity-heading" className="font-mono text-xs uppercase font-bold text-[#1A1816] tracking-wider">
              CANDIDATE DEVELOPMENT OPPORTUNITIES
            </h3>
            <span className="text-[10px] font-mono text-[#5C5852] bg-[#ECE7DF] px-2 py-0.5 border border-[#DDD7CD]">
              ADVISORY ONLY • AVAILABLE FOR MUNICIPAL REVIEW
            </span>
          </div>

          {clusterDetail?.opportunities && clusterDetail.opportunities.length > 0 ? (
            <div className="space-y-4">
              {clusterDetail.opportunities.map((opp) => (
                <div
                  key={opp.id}
                  data-testid={`opportunity-card-${opp.id}`}
                  className="border border-[#DDD7CD] p-4 bg-[#F4F0EA] space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 bg-[#C85A32] text-white">
                          CANDIDATE OPPORTUNITY
                        </span>
                        <span className="font-mono text-xs text-[#5C5852]">{opp.id}</span>
                      </div>
                      <h4 className="font-bold text-sm text-[#1A1816]">{opp.title}</h4>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-[#5C5852]">PRIORITY BAND:</span>
                      <span className="font-bold text-[#C85A32]">{opp.priority_band}</span>
                      <span className="text-[#948F86]">|</span>
                      <span className="text-[#5C5852]">CDI:</span>
                      <span className="font-bold text-[#1A1816]">
                        {opp.metrics.composite_demand_index} / 100
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#5C5852] leading-relaxed">
                    {opp.narrative_justification}
                  </p>

                  <div className="pt-2 border-t border-[#DDD7CD] text-[11px] font-mono text-[#5C5852] flex flex-wrap items-center justify-between gap-2">
                    <span>Supported by available evidence • Available for municipal review</span>
                    <span className="text-[#948F86]">STATUS: {opp.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs font-mono text-[#5C5852]">
              Select a cluster to inspect candidate development opportunities.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
