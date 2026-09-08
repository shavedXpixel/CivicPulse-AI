import { SlaRiskBand, SlaStatus } from '../constants/simulation';

export enum InterventionType {
  EMERGENCY_DISPATCH = 'EMERGENCY_DISPATCH',
  CAPACITY_BOOST = 'CAPACITY_BOOST',
  INFRASTRUCTURE_REPAIR = 'INFRASTRUCTURE_REPAIR',
  PREVENTIVE_MAINTENANCE = 'PREVENTIVE_MAINTENANCE'
}

export interface SimulationScenarioInput {
  problem_id: string;
  scenario_name: string;
  intervention_type: InterventionType;
  additional_budget_inr: number;
  extra_crews: number;
  population_relief_rate: number;
  response_time_reduction_hours: number;
  assumed_baseline_remaining_hours?: number;
  include_facility_mitigation?: boolean;
  include_permanent_renewal?: boolean;
}

export interface SimulationFactorBreakdown {
  severity: number;
  population: number;
  duration: number;
  concentration: number;
  critical_facility: number;
  recurrence: number;
  evidence: number;
  total: number;
}

export interface SimulationBaselineState {
  impact_score: number;
  factors: SimulationFactorBreakdown;
  affected_population: number;
  elapsed_problem_hours: number;
  sla_threshold_hours: number;
  sla_status: SlaStatus;
  sla_utilization: number;
  sla_risk_band: SlaRiskBand;
  critical_facility_name?: string;
}

export interface SimulationProjectedState {
  impact_score: number;
  factors: SimulationFactorBreakdown;
  impact_delta: number;
  relieved_population: number;
  remaining_exposed_population: number;
  effective_relief_rate: number;
  assumed_baseline_remaining_hours: number;
  projected_remaining_repair_hours: number;
  time_saved_hours: number;
  projected_total_elapsed_hours: number;
  sla_status: SlaStatus;
  sla_utilization: number;
  sla_risk_band: SlaRiskBand;
  sla_explanation: string;
  cost_per_citizen_relieved_inr: number;
  additional_budget_inr: number;
}

export interface SimulationAIExplanation {
  summary: string;
  trade_offs: string[];
  operational_feasibility: string;
  risk_considerations: string[];
}

export interface SimulationResult {
  problem_id: string;
  problem_title: string;
  scenario_name: string;
  intervention_type: InterventionType;
  is_simulated: true;
  disclaimer: string;
  baseline: SimulationBaselineState;
  projected: SimulationProjectedState;
  assumptions: string[];
  uncertainty_factors: string[];
  ai_explanation?: SimulationAIExplanation;
  generated_at: string;
}

export interface BudgetAllocationItem {
  problem_id: string;
  title: string;
  ward_id: string;
  department: string;
  baseline_impact: number;
  projected_impact: number;
  impact_delta: number;
  allocated_budget_inr: number;
  relieved_population: number;
  scenario_name: string;
  is_synthetic_cost: true;
}

export interface BudgetAllocationResult {
  total_budget_inr: number;
  allocated_budget_inr: number;
  contingency_buffer_inr: number;
  total_relieved_population: number;
  aggregate_impact_reduction: number;
  allocations: BudgetAllocationItem[];
  is_simulated: true;
  disclaimer: string;
  assumptions: string[];
}
