import { z } from 'zod';
import { InterventionType } from '../types/simulation';
import { SlaRiskBand, SlaStatus, SIMULATION_CONSTANTS } from '../constants/simulation';

export const InterventionTypeSchema = z.nativeEnum(InterventionType);
export const SlaRiskBandSchema = z.nativeEnum(SlaRiskBand);
export const SlaStatusSchema = z.nativeEnum(SlaStatus);

export const SimulationScenarioInputSchema = z.object({
  problem_id: z.string().min(1, 'Problem ID is required'),
  scenario_name: z.string().min(1, 'Scenario name is required'),
  intervention_type: InterventionTypeSchema,
  additional_budget_inr: z.number().nonnegative(),
  extra_crews: z.number().int().min(SIMULATION_CONSTANTS.MIN_EXTRA_CREWS).max(SIMULATION_CONSTANTS.MAX_EXTRA_CREWS),
  population_relief_rate: z.number().min(0).max(SIMULATION_CONSTANTS.MAX_POPULATION_RELIEF_RATE),
  response_time_reduction_hours: z.number().min(SIMULATION_CONSTANTS.MIN_RESPONSE_REDUCTION_HOURS).max(SIMULATION_CONSTANTS.MAX_RESPONSE_REDUCTION_HOURS),
  assumed_baseline_remaining_hours: z.number().positive().optional(),
  include_facility_mitigation: z.boolean().optional(),
  include_permanent_renewal: z.boolean().optional()
});

export const SimulationFactorBreakdownSchema = z.object({
  severity: z.number(),
  population: z.number(),
  duration: z.number(),
  concentration: z.number(),
  critical_facility: z.number(),
  recurrence: z.number(),
  evidence: z.number(),
  total: z.number()
});

export const SimulationBaselineStateSchema = z.object({
  impact_score: z.number(),
  factors: SimulationFactorBreakdownSchema,
  affected_population: z.number(),
  elapsed_problem_hours: z.number(),
  sla_threshold_hours: z.number(),
  sla_status: SlaStatusSchema,
  sla_utilization: z.number(),
  sla_risk_band: SlaRiskBandSchema,
  critical_facility_name: z.string().optional()
});

export const SimulationProjectedStateSchema = z.object({
  impact_score: z.number(),
  factors: SimulationFactorBreakdownSchema,
  impact_delta: z.number(),
  relieved_population: z.number(),
  remaining_exposed_population: z.number(),
  effective_relief_rate: z.number(),
  assumed_baseline_remaining_hours: z.number(),
  projected_remaining_repair_hours: z.number(),
  time_saved_hours: z.number(),
  projected_total_elapsed_hours: z.number(),
  sla_status: SlaStatusSchema,
  sla_utilization: z.number(),
  sla_risk_band: SlaRiskBandSchema,
  sla_explanation: z.string(),
  cost_per_citizen_relieved_inr: z.number(),
  additional_budget_inr: z.number()
});

export const SimulationAIExplanationSchema = z.object({
  summary: z.string(),
  trade_offs: z.array(z.string()),
  operational_feasibility: z.string(),
  risk_considerations: z.array(z.string())
});

export const SimulationResultSchema = z.object({
  problem_id: z.string(),
  problem_title: z.string(),
  scenario_name: z.string(),
  intervention_type: InterventionTypeSchema,
  is_simulated: z.literal(true),
  disclaimer: z.string(),
  baseline: SimulationBaselineStateSchema,
  projected: SimulationProjectedStateSchema,
  assumptions: z.array(z.string()),
  uncertainty_factors: z.array(z.string()),
  ai_explanation: SimulationAIExplanationSchema.optional(),
  generated_at: z.string()
});

export const BudgetAllocationInputSchema = z.object({
  total_budget_inr: z.number().positive('Total budget must be greater than zero'),
  department_filter: z.string().optional()
});

export const BudgetAllocationItemSchema = z.object({
  problem_id: z.string(),
  title: z.string(),
  ward_id: z.string(),
  department: z.string(),
  baseline_impact: z.number(),
  projected_impact: z.number(),
  impact_delta: z.number(),
  allocated_budget_inr: z.number(),
  relieved_population: z.number(),
  scenario_name: z.string(),
  is_synthetic_cost: z.literal(true)
});

export const BudgetAllocationResultSchema = z.object({
  total_budget_inr: z.number(),
  allocated_budget_inr: z.number(),
  contingency_buffer_inr: z.number(),
  total_relieved_population: z.number(),
  aggregate_impact_reduction: z.number(),
  allocations: z.array(BudgetAllocationItemSchema),
  is_simulated: z.literal(true),
  disclaimer: z.string(),
  assumptions: z.array(z.string())
});
