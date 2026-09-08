import {
  ProblemCluster,
  InterventionType,
  SimulationScenarioInput,
  SimulationFactorBreakdown,
  SimulationBaselineState,
  SimulationProjectedState,
  SimulationResult,
  BudgetAllocationResult,
  BudgetAllocationItem,
  SlaStatus,
  SlaRiskBand,
  SIMULATION_CONSTANTS
} from '@civicpulse/shared';

export class SimulationEngine {
  /**
   * Evaluates the authoritative baseline state for a problem cluster.
   */
  public static calculateBaselineState(problem: ProblemCluster): SimulationBaselineState {
    // Authoritative baseline factor components
    const severity = problem.severity_score !== undefined ? problem.severity_score : 24;
    const population = problem.population_score !== undefined ? problem.population_score : 18;
    const duration = problem.duration_score !== undefined ? problem.duration_score : 14;
    const concentration = problem.concentration_score !== undefined ? problem.concentration_score : 14;
    const criticalFacility = problem.critical_exposure_score !== undefined ? problem.critical_exposure_score : 9;
    const recurrence = problem.recurrence_score !== undefined ? problem.recurrence_score : 8;
    const evidence = problem.evidence_score !== undefined ? problem.evidence_score : 5;

    const total = severity + population + duration + concentration + criticalFacility + recurrence + evidence;
    const impact_score = Math.max(0, Math.min(100, total));

    // Calculate elapsed problem age (in hours) - use authoritative duration_days if present
    const createdAt = problem.created_at ? new Date(problem.created_at).getTime() : Date.now() - 72 * 3600 * 1000;
    const now = Date.now();
    const elapsedHours = problem.duration_days
      ? problem.duration_days * 24
      : Math.max(1, Math.round((now - createdAt) / (3600 * 1000)));

    // SLA threshold (e.g. 24 hours for emergency critical water supply)
    const slaThresholdHours = problem.sla_state?.target_hours || (problem as any).sla_hours || 24;
    const slaUtilization = Number((elapsedHours / slaThresholdHours).toFixed(2));

    // SLA status
    let slaStatus = SlaStatus.WITHIN_SLA;
    let slaRiskBand = SlaRiskBand.LOW;

    if (slaUtilization > 1.0) {
      slaStatus = SlaStatus.BREACHED;
      slaRiskBand = slaUtilization > SIMULATION_CONSTANTS.SLA_UTILIZATION_HIGH_MAX ? SlaRiskBand.CRITICAL : SlaRiskBand.HIGH;
    } else if (slaUtilization > SIMULATION_CONSTANTS.SLA_UTILIZATION_LOW_MAX) {
      slaStatus = SlaStatus.NEAR_BREACH;
      slaRiskBand = SlaRiskBand.MEDIUM;
    }

    return {
      impact_score,
      factors: {
        severity,
        population,
        duration,
        concentration,
        critical_facility: criticalFacility,
        recurrence,
        evidence,
        total
      },
      affected_population: problem.estimated_population || 18400,
      elapsed_problem_hours: elapsedHours,
      sla_threshold_hours: slaThresholdHours,
      sla_status: slaStatus,
      sla_utilization: slaUtilization,
      sla_risk_band: slaRiskBand,
      critical_facility_name: 'DAV Public School Nayapalli'
    };
  }

  /**
   * Deterministically calculates projected outcomes for an intervention scenario.
   * Strictly enforces: projected_impact_score = sum(projected factor components)
   */
  public static simulateProblemScenario(
    problem: ProblemCluster,
    input: SimulationScenarioInput
  ): SimulationResult {
    const baseline = this.calculateBaselineState(problem);

    // 1. Bound inputs according to centralized constants
    const extraCrews = Math.max(
      SIMULATION_CONSTANTS.MIN_EXTRA_CREWS,
      Math.min(SIMULATION_CONSTANTS.MAX_EXTRA_CREWS, Math.round(input.extra_crews || 0))
    );
    const reliefRate = Math.max(
      0,
      Math.min(SIMULATION_CONSTANTS.MAX_POPULATION_RELIEF_RATE, input.population_relief_rate || 0)
    );
    const responseReduction = Math.max(
      SIMULATION_CONSTANTS.MIN_RESPONSE_REDUCTION_HOURS,
      Math.min(SIMULATION_CONSTANTS.MAX_RESPONSE_REDUCTION_HOURS, input.response_time_reduction_hours || 0)
    );
    const assumedRemaining = Math.max(
      4,
      input.assumed_baseline_remaining_hours || SIMULATION_CONSTANTS.DEFAULT_ASSUMED_REMAINING_HOURS
    );

    // 2. Population Relief Calculation
    const effectiveReliefRate = Math.min(
      1.0,
      Number((reliefRate + extraCrews * SIMULATION_CONSTANTS.CREW_POPULATION_BOOST_PER_TEAM).toFixed(2))
    );
    const relievedPopulation = Math.min(
      baseline.affected_population,
      Math.round(baseline.affected_population * effectiveReliefRate)
    );
    const remainingExposedPopulation = Math.max(0, baseline.affected_population - relievedPopulation);

    // Recompute Population factor strictly using Phase 2 brackets
    let projectedPopulationFactor = 0;
    if (remainingExposedPopulation >= 15000) projectedPopulationFactor = 18;
    else if (remainingExposedPopulation >= 5000) projectedPopulationFactor = 14;
    else if (remainingExposedPopulation >= 1000) projectedPopulationFactor = 10;
    else if (remainingExposedPopulation > 0) projectedPopulationFactor = 6;
    else projectedPopulationFactor = 0;

    // 3. Duration & MTTR Compression
    let projectedRemainingRepairHours = assumedRemaining;
    if (
      input.intervention_type === InterventionType.CAPACITY_BOOST ||
      input.intervention_type === InterventionType.INFRASTRUCTURE_REPAIR
    ) {
      const speedupMultiplier = 1 + SIMULATION_CONSTANTS.CREW_SPEEDUP_FACTOR * extraCrews;
      const compressedHours = Math.round(assumedRemaining / speedupMultiplier) - responseReduction;
      projectedRemainingRepairHours = Math.max(SIMULATION_CONSTANTS.MIN_PHYSICAL_MTTR_HOURS, compressedHours);
    }

    const timeSavedHours = Math.max(0, assumedRemaining - projectedRemainingRepairHours);
    const projectedTotalElapsedHours = baseline.elapsed_problem_hours + projectedRemainingRepairHours;

    // Recompute Duration factor from Phase 2 duration brackets
    const baselineDays = problem.duration_days || Math.floor(baseline.elapsed_problem_hours / 24);
    const additionalDays = Math.floor(projectedRemainingRepairHours / 24);
    const totalDays = baselineDays + additionalDays;
    let projectedDurationFactor = 14;
    if (totalDays >= 5) projectedDurationFactor = 15;
    else if (totalDays >= 3) projectedDurationFactor = 14;
    else if (totalDays >= 2) projectedDurationFactor = 10;
    else if (totalDays >= 1) projectedDurationFactor = 7;
    else projectedDurationFactor = 3;

    // 4. Critical Facility Factor
    let projectedFacilityFactor = baseline.factors.critical_facility;
    if (input.include_facility_mitigation) {
      if (input.intervention_type === InterventionType.EMERGENCY_DISPATCH) {
        projectedFacilityFactor = 2; // Dedicated mobile water tanker stationed at school
      } else {
        projectedFacilityFactor = 0; // Permanent or restored pipe feed
      }
    }

    // 5. Severity Factor
    let projectedSeverityFactor = baseline.factors.severity;
    if (input.intervention_type === InterventionType.EMERGENCY_DISPATCH) {
      projectedSeverityFactor = 18; // Dehydration crisis averted; physical rupture remains
    } else if (input.intervention_type === InterventionType.CAPACITY_BOOST) {
      projectedSeverityFactor = 10; // Split-sleeve seals break, pressurized water flow restored
    } else if (input.intervention_type === InterventionType.INFRASTRUCTURE_REPAIR) {
      projectedSeverityFactor = 6; // Permanent bypass loop eliminates culvert stress
    }

    // 6. Complaint Concentration Factor
    let projectedConcentrationFactor = baseline.factors.concentration;
    if (input.intervention_type === InterventionType.EMERGENCY_DISPATCH) {
      projectedConcentrationFactor = 12; // Mobile relief slows acute complaint rate
    } else if (input.intervention_type === InterventionType.CAPACITY_BOOST) {
      projectedConcentrationFactor = 6; // Tap water restored, incoming calls diminish
    } else if (input.intervention_type === InterventionType.INFRASTRUCTURE_REPAIR) {
      projectedConcentrationFactor = 4; // Complete stabilization
    }

    // 7. Recurrence Factor
    let projectedRecurrenceFactor = baseline.factors.recurrence;
    if (input.include_permanent_renewal && input.intervention_type === InterventionType.INFRASTRUCTURE_REPAIR) {
      projectedRecurrenceFactor = 1; // Modeled 90-day horizon recurrence elimination assumption
    }

    // 8. Evidence Factor (auditable telemetry and baseline sensor media remain valid)
    const projectedEvidenceFactor = baseline.factors.evidence;

    // 9. Exact Sum Identity: projected_impact_score = sum(projected components)
    const projectedTotal =
      projectedSeverityFactor +
      projectedPopulationFactor +
      projectedDurationFactor +
      projectedConcentrationFactor +
      projectedFacilityFactor +
      projectedRecurrenceFactor +
      projectedEvidenceFactor;

    const projectedImpactScore = Math.max(0, Math.min(100, projectedTotal));
    const impactDelta = projectedImpactScore - baseline.impact_score;

    // 10. SLA Utilization and Breach Reality Check
    const projectedSlaUtilization = Number(
      (projectedTotalElapsedHours / baseline.sla_threshold_hours).toFixed(2)
    );

    // Existing SLA breach cannot be undone
    let projectedSlaStatus = SlaStatus.WITHIN_SLA;
    let projectedSlaRiskBand = SlaRiskBand.LOW;

    if (baseline.sla_status === SlaStatus.BREACHED || projectedSlaUtilization > 1.0) {
      projectedSlaStatus = SlaStatus.BREACHED;
      projectedSlaRiskBand =
        projectedSlaUtilization > SIMULATION_CONSTANTS.SLA_UTILIZATION_HIGH_MAX
          ? SlaRiskBand.CRITICAL
          : SlaRiskBand.HIGH;
    } else if (projectedSlaUtilization > SIMULATION_CONSTANTS.SLA_UTILIZATION_LOW_MAX) {
      projectedSlaStatus = SlaStatus.NEAR_BREACH;
      projectedSlaRiskBand = SlaRiskBand.MEDIUM;
    }

    let slaExplanation = '';
    if (baseline.sla_status === SlaStatus.BREACHED) {
      slaExplanation = `Current SLA is ALREADY BREACHED (elapsed ${baseline.elapsed_problem_hours}h vs ${baseline.sla_threshold_hours}h threshold at ${baseline.sla_utilization.toFixed(2)}x). The simulated intervention compresses remaining repair duration from ${assumedRemaining}h to ${projectedRemainingRepairHours}h (mitigating ${timeSavedHours}h of ongoing breach delay), but cannot retroactively undo the recorded breach. Projected final SLA utilization: ${projectedSlaUtilization.toFixed(2)}x.`;
    } else {
      slaExplanation = `Projected completion in ${projectedRemainingRepairHours}h leaves total elapsed time at ${projectedTotalElapsedHours}h against a ${baseline.sla_threshold_hours}h SLA threshold (${projectedSlaUtilization.toFixed(2)}x utilization, ${projectedSlaRiskBand} risk band).`;
    }

    // 11. Cost per citizen relieved
    const costPerCitizen =
      relievedPopulation > 0
        ? Number((input.additional_budget_inr / relievedPopulation).toFixed(2))
        : 0;

    // 12. Explicit Assumptions & Uncertainty
    const assumptions: string[] = [
      `Assumed baseline remaining physical repair time: ${assumedRemaining} hours (simulation assumption).`,
      `Each additional crew contributes ${SIMULATION_CONSTANTS.CREW_POPULATION_BOOST_PER_TEAM * 100}% coverage boost up to physical fleet limits.`,
      `Physical repair time subject to a strict minimum physical threshold of ${SIMULATION_CONSTANTS.MIN_PHYSICAL_MTTR_HOURS} hours for excavation and welding.`
    ];

    if (input.include_permanent_renewal) {
      assumptions.push(
        `Recurrence reduction to ${projectedRecurrenceFactor}/10 is modeled as a simulation assumption for a ${SIMULATION_CONSTANTS.DEFAULT_RECURRENCE_HORIZON_DAYS}-day planning horizon, not an empirical guarantee.`
      );
    }

    const uncertaintyFactors: string[] = [
      'Projections assume continuous dry weather; heavy rainfall during excavation may delay pipe alignment.',
      'Unmapped subterranean utility crossings (e.g. electrical cables, telecommunications conduit) could require temporary work halts.',
      'Cost estimates reflect standard scheduled municipal contract rates; emergency procurement premiums are not modeled.'
    ];

    const projectedState: SimulationProjectedState = {
      impact_score: projectedImpactScore,
      factors: {
        severity: projectedSeverityFactor,
        population: projectedPopulationFactor,
        duration: projectedDurationFactor,
        concentration: projectedConcentrationFactor,
        critical_facility: projectedFacilityFactor,
        recurrence: projectedRecurrenceFactor,
        evidence: projectedEvidenceFactor,
        total: projectedTotal
      },
      impact_delta: impactDelta,
      relieved_population: relievedPopulation,
      remaining_exposed_population: remainingExposedPopulation,
      effective_relief_rate: effectiveReliefRate,
      assumed_baseline_remaining_hours: assumedRemaining,
      projected_remaining_repair_hours: projectedRemainingRepairHours,
      time_saved_hours: timeSavedHours,
      projected_total_elapsed_hours: projectedTotalElapsedHours,
      sla_status: projectedSlaStatus,
      sla_utilization: projectedSlaUtilization,
      sla_risk_band: projectedSlaRiskBand,
      sla_explanation: slaExplanation,
      cost_per_citizen_relieved_inr: costPerCitizen,
      additional_budget_inr: input.additional_budget_inr
    };

    return {
      problem_id: problem.id,
      problem_title: problem.title,
      scenario_name: input.scenario_name,
      intervention_type: input.intervention_type,
      is_simulated: true,
      disclaimer:
        'SIMULATED / ADVISORY: This projection is computed mathematically from scenario parameters. It does not mutate operational databases, commit municipal funds, or guarantee real-world outcomes.',
      baseline,
      projected: projectedState,
      assumptions,
      uncertainty_factors: uncertaintyFactors,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Pre-configured Golden Demo scenarios for PRB-2026-0819.
   */
  public static getGoldenDemoPresets(problemId: string): SimulationScenarioInput[] {
    return [
      {
        problem_id: problemId,
        scenario_name: 'Scenario A: Emergency Tanker Surge & Bottled Water',
        intervention_type: InterventionType.EMERGENCY_DISPATCH,
        additional_budget_inr: 150000,
        extra_crews: 2,
        population_relief_rate: 0.65,
        response_time_reduction_hours: 4,
        assumed_baseline_remaining_hours: 24,
        include_facility_mitigation: true,
        include_permanent_renewal: false
      },
      {
        problem_id: problemId,
        scenario_name: 'Scenario B: Accelerated Dual-Crew Repair & Mechanical Sleeve',
        intervention_type: InterventionType.CAPACITY_BOOST,
        additional_budget_inr: 420000,
        extra_crews: 2,
        population_relief_rate: 0.95,
        response_time_reduction_hours: 0,
        assumed_baseline_remaining_hours: 24,
        include_facility_mitigation: true,
        include_permanent_renewal: false
      },
      {
        problem_id: problemId,
        scenario_name: 'Scenario C: Resilient Culvert Bypass Loop & Renewal',
        intervention_type: InterventionType.INFRASTRUCTURE_REPAIR,
        additional_budget_inr: 850000,
        extra_crews: 3,
        population_relief_rate: 1.00,
        response_time_reduction_hours: 0,
        assumed_baseline_remaining_hours: 24,
        include_facility_mitigation: true,
        include_permanent_renewal: true
      }
    ];
  }

  /**
   * Citywide budget allocation optimizer over authoritative Phase 1-7 records.
   */
  public static simulateBudgetAllocation(
    problems: ProblemCluster[],
    totalBudget: number
  ): BudgetAllocationResult {
    const contingencyBuffer = Math.round(totalBudget * SIMULATION_CONSTANTS.DEFAULT_CONTINGENCY_BUFFER_RATE);
    const allocatableBudget = totalBudget - contingencyBuffer;

    // Defined synthetic intervention packages for the 4 core problems
    const syntheticPackages: Record<string, { cost: number; name: string; type: InterventionType; popRate: number; crews: number; permanent: boolean }> = {
      'PRB-2026-0819': { cost: 420000, name: 'Accelerated Dual-Crew Repair', type: InterventionType.CAPACITY_BOOST, popRate: 0.95, crews: 2, permanent: false },
      'PRB-2026-0820': { cost: 250000, name: 'Stormwater Culvert Clearing & Sump Pumps', type: InterventionType.EMERGENCY_DISPATCH, popRate: 0.85, crews: 2, permanent: false },
      'PRB-2026-0821': { cost: 180000, name: 'Geotextile Subsurface Void Grouting', type: InterventionType.CAPACITY_BOOST, popRate: 0.80, crews: 1, permanent: false },
      'PRB-2026-0822': { cost: 70000, name: 'LED Driver & Fuse Bank Replacement', type: InterventionType.CAPACITY_BOOST, popRate: 0.90, crews: 1, permanent: false }
    };

    let remainingBudget = allocatableBudget;
    let totalRelievedPop = 0;
    let totalImpactReduction = 0;
    const allocations: BudgetAllocationItem[] = [];

    // Sort by baseline impact score descending
    const sorted = [...problems].sort((a, b) => (b.impact_score || 0) - (a.impact_score || 0));

    for (const prob of sorted) {
      const pkg = syntheticPackages[prob.id];
      if (pkg && remainingBudget >= pkg.cost) {
        // Run single problem simulation
        const sim = this.simulateProblemScenario(prob, {
          problem_id: prob.id,
          scenario_name: pkg.name,
          intervention_type: pkg.type,
          additional_budget_inr: pkg.cost,
          extra_crews: pkg.crews,
          population_relief_rate: pkg.popRate,
          response_time_reduction_hours: 0,
          assumed_baseline_remaining_hours: 24,
          include_facility_mitigation: true,
          include_permanent_renewal: pkg.permanent
        });

        allocations.push({
          problem_id: prob.id,
          title: prob.title,
          ward_id: prob.ward_id || 'WARD-018',
          department: prob.department_id || (prob as any).assigned_department_id || 'WATCO',
          baseline_impact: sim.baseline.impact_score,
          projected_impact: sim.projected.impact_score,
          impact_delta: sim.projected.impact_delta,
          allocated_budget_inr: pkg.cost,
          relieved_population: sim.projected.relieved_population,
          scenario_name: pkg.name,
          is_synthetic_cost: true
        });

        remainingBudget -= pkg.cost;
        totalRelievedPop += sim.projected.relieved_population;
        totalImpactReduction += Math.abs(sim.projected.impact_delta);
      }
    }

    const actualAllocated = allocatableBudget - remainingBudget;
    const totalContingency = contingencyBuffer + remainingBudget;

    return {
      total_budget_inr: totalBudget,
      allocated_budget_inr: actualAllocated,
      contingency_buffer_inr: totalContingency,
      total_relieved_population: totalRelievedPop,
      aggregate_impact_reduction: totalImpactReduction,
      allocations,
      is_simulated: true,
      disclaimer:
        'SIMULATED / ADVISORY: Citywide intervention package costs are synthetic assumptions for planning evaluation. Real municipal procurement requires approved department estimates and formal expenditure authorization.',
      assumptions: [
        'Evaluates top public problem clusters from authoritative Phase 1-7 database records.',
        `Reserves a minimum ${SIMULATION_CONSTANTS.DEFAULT_CONTINGENCY_BUFFER_RATE * 100}% unallocated contingency buffer (₹${contingencyBuffer.toLocaleString()}) for unforeseen emergency works.`,
        'Intervention costs are synthetic benchmarks designed to demonstrate marginal impact optimization per rupee.'
      ]
    };
  }
}
