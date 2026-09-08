import {
  SimulationScenarioInput,
  SimulationBaselineState,
  SimulationProjectedState,
  SimulationAIExplanation
} from '@civicpulse/shared';

export interface SimulationExplanationInput {
  scenario: SimulationScenarioInput;
  problem_title: string;
  department: string;
  ward_id: string;
  baseline: SimulationBaselineState;
  projected: SimulationProjectedState;
  assumptions: string[];
}

export interface ISimulationAIProvider {
  explainSimulation(input: SimulationExplanationInput): Promise<SimulationAIExplanation>;
  getModelName(): string;
  getPromptVersion(): string;
}
