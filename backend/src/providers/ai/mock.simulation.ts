import {
  ISimulationAIProvider,
  SimulationExplanationInput
} from './simulation.interface';
import { SimulationAIExplanation, InterventionType } from '@civicpulse/shared';

export class MockSimulationAIProvider implements ISimulationAIProvider {
  private shouldFail = false;
  private shouldTimeout = false;

  public simulateFailure(fail: boolean): void {
    this.shouldFail = fail;
  }

  public simulateTimeout(timeout: boolean): void {
    this.shouldTimeout = timeout;
  }

  public getModelName(): string {
    return 'mock-simulation-v1';
  }

  public getPromptVersion(): string {
    return 'intervention_simulation_v1';
  }

  public async explainSimulation(input: SimulationExplanationInput): Promise<SimulationAIExplanation> {
    if (this.shouldFailureCondition()) {
      throw new Error('Simulation AI provider simulated failure');
    }

    if (this.shouldTimeout) {
      await new Promise((_, reject) => setTimeout(() => reject(new Error('Simulation AI provider timeout')), 50));
    }

    const { scenario, baseline, projected } = input;
    const type = scenario.intervention_type;

    let summary = '';
    const trade_offs: string[] = [];
    let operational_feasibility = '';
    const risk_considerations: string[] = [];

    if (type === InterventionType.EMERGENCY_DISPATCH) {
      summary = `Simulated deployment of ${scenario.extra_crews} mobile relief team(s) reduces acute citizen exposure from ${baseline.affected_population.toLocaleString()} to ${projected.remaining_exposed_population.toLocaleString()} residents (relieving ${projected.relieved_population.toLocaleString()} citizens) at ₹${projected.cost_per_citizen_relieved_inr.toFixed(2)} per citizen. Impact score is projected to drop from ${baseline.impact_score} to ${projected.impact_score} (-${Math.abs(projected.impact_delta)} pts).`;
      trade_offs.push(
        'Provides rapid acute relief within hours, but does not repair the underlying pipeline rupture.',
        'Requires continuous operational coordination to sustain mobile tanker routes until physical repair is finalized.'
      );
      operational_feasibility = 'Highly feasible for immediate mobilization. Mobile tanker fleet and bottled water distribution can be deployed within 2 to 4 hours without subterranean excavation permits.';
      risk_considerations.push(
        'Traffic congestion along Nayapalli VIP Road may delay tanker transit cycles.',
        'Interim distribution does not resolve ongoing water loss or subsoil saturation near road foundations.'
      );
    } else if (type === InterventionType.CAPACITY_BOOST) {
      summary = `Deploying ${scenario.extra_crews} specialized engineering crew(s) with pre-ordered mechanical sleeves is projected to compress remaining repair time from ${projected.assumed_baseline_remaining_hours}h to ${projected.projected_remaining_repair_hours}h (saving ${projected.time_saved_hours}h of ongoing repair delay) and restore all ${projected.relieved_population.toLocaleString()} residents. Impact score reduces from ${baseline.impact_score} to ${projected.impact_score} (-${Math.abs(projected.impact_delta)} pts).`;
      trade_offs.push(
        'High capital and personnel efficiency (₹22.83/citizen) achieves full physical resolution.',
        'Existing SLA breach cannot be undone retroactively, but additional ongoing breach delay is compressed by 12 hours.'
      );
      operational_feasibility = 'Feasible with pre-staged 400mm ductile iron split sleeves from central stores. Requires continuous dual-shift dewatering and nighttime lane restriction on VIP Road.';
      risk_considerations.push(
        'Excavation adjacent to high-voltage subterranean cabling requires on-site TPCODL engineering supervision.',
        'Severe monsoon precipitation could flood the excavation trench, slowing sleeve welding.'
      );
    } else if (type === InterventionType.INFRASTRUCTURE_REPAIR) {
      summary = `Commissioning a dedicated HDPE bypass loop around the Nayapalli culvert eliminates structural strain, restoring all ${projected.relieved_population.toLocaleString()} citizens and reducing impact score from ${baseline.impact_score} to ${projected.impact_score} (-${Math.abs(projected.impact_delta)} pts). Recurrence score is assumed reduced from 8/10 to 1/10 for the modeled 90-day planning horizon.`;
      trade_offs.push(
        'Highest overall budget (₹8,50,000 / ₹46.20 per citizen) delivers structural resilience rather than a temporary mechanical patch.',
        'Longer physical commissioning window (16h) compared to emergency tanker dispatch, but provides lasting regional security.'
      );
      operational_feasibility = 'Moderate logistical complexity. Requires horizontal directional drilling (HDD) equipment, pipe fusion technicians, and coordination with BMC Roads for pavement reinstatement.';
      risk_considerations.push(
        'Subsurface geotechnical instability near the stormwater culvert may require additional trench shoring.',
        'Modeled 90-day recurrence reduction is an analytical planning projection dependent on proper road surface sealing.'
      );
    } else {
      summary = `Simulated intervention reduces public impact score from ${baseline.impact_score} to ${projected.impact_score} (-${Math.abs(projected.impact_delta)} pts) relieving ${projected.relieved_population.toLocaleString()} citizens with an additional budget of ₹${projected.additional_budget_inr.toLocaleString()}.`;
      trade_offs.push('Balances resource expenditure against municipal SLA velocity.');
      operational_feasibility = 'Subject to standard departmental equipment availability and crew dispatch schedules.';
      risk_considerations.push('Weather conditions and unmapped utility conflicts may affect physical timeline.');
    }

    return {
      summary,
      trade_offs,
      operational_feasibility,
      risk_considerations
    };
  }

  private shouldFailureCondition(): boolean {
    return this.shouldFail;
  }
}
