import {
  ISimulationAIProvider,
  SimulationExplanationInput
} from './simulation.interface';
import {
  SimulationAIExplanation,
  SimulationAIExplanationSchema
} from '@civicpulse/shared';
import { INTERVENTION_SIMULATION_V1_PROMPT } from '../../infrastructure/ai/prompts/intervention_simulation_v1';

export class GeminiSimulationAIProvider implements ISimulationAIProvider {
  private apiKey: string;
  private modelName: string;

  constructor(apiKey: string, modelName = 'gemini-3.5-flash') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  public getModelName(): string {
    return this.modelName;
  }

  public getPromptVersion(): string {
    return 'intervention_simulation_v1';
  }

  public async explainSimulation(input: SimulationExplanationInput): Promise<SimulationAIExplanation> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured for simulation explanations.');
    }

    const systemPrompt = INTERVENTION_SIMULATION_V1_PROMPT;
    const userPrompt = `
Analyze the following mathematically computed intervention simulation and provide executive municipal decision-support commentary:

PROBLEM: "${input.problem_title}" (Ward: ${input.ward_id}, Department: ${input.department})
SCENARIO: "${input.scenario.scenario_name}" (${input.scenario.intervention_type})
ADDITIONAL BUDGET: ₹${input.projected.additional_budget_inr.toLocaleString()}
EXTRA CREWS: ${input.scenario.extra_crews}

PRE-COMPUTED DETERMINISTIC METRICS:
- Baseline Impact Score: ${input.baseline.impact_score}/100 -> Projected: ${input.projected.impact_score}/100 (Delta: ${input.projected.impact_delta})
- Affected Population: ${input.baseline.affected_population.toLocaleString()} -> Remaining Exposed: ${input.projected.remaining_exposed_population.toLocaleString()} (Relieved: ${input.projected.relieved_population.toLocaleString()} citizens)
- Cost Per Citizen Relieved: ₹${input.projected.cost_per_citizen_relieved_inr.toFixed(2)}
- Elapsed Problem Hours: ${input.baseline.elapsed_problem_hours}h (SLA Threshold: ${input.baseline.sla_threshold_hours}h)
- Baseline SLA Status: ${input.baseline.sla_status} (${input.baseline.sla_utilization.toFixed(2)}x utilization)
- Projected Remaining Repair Time: ${input.projected.projected_remaining_repair_hours}h (Assumed Baseline Remaining: ${input.projected.assumed_baseline_remaining_hours}h, Saved: ${input.projected.time_saved_hours}h)
- Projected SLA Status: ${input.projected.sla_status} (${input.projected.sla_utilization.toFixed(2)}x utilization - Delay compressed by ${input.projected.time_saved_hours}h)
- Critical Facility Provisioning: ${input.scenario.include_facility_mitigation ? 'Yes (DAV Public School protected)' : 'No'}
- Permanent Renewal: ${input.scenario.include_permanent_renewal ? 'Yes (Recurrence assumed reduced to 1/10 for modeled 90-day horizon)' : 'No'}

FACTOR BREAKDOWN (Exact Sum):
- Severity: ${input.baseline.factors.severity} -> ${input.projected.factors.severity}
- Population: ${input.baseline.factors.population} -> ${input.projected.factors.population}
- Duration: ${input.baseline.factors.duration} -> ${input.projected.factors.duration}
- Concentration: ${input.baseline.factors.concentration} -> ${input.projected.factors.concentration}
- Facility: ${input.baseline.factors.critical_facility} -> ${input.projected.factors.critical_facility}
- Recurrence: ${input.baseline.factors.recurrence} -> ${input.projected.factors.recurrence}
- Evidence: ${input.baseline.factors.evidence} -> ${input.projected.factors.evidence}
- Total: ${input.baseline.factors.total} -> ${input.projected.factors.total}

REMINDER: DO NOT alter these numbers. Provide executive analysis strictly explaining these pre-computed results.
`.trim();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as any;
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini simulation explainer.');
      }

      const parsed = JSON.parse(rawText);
      const validated = SimulationAIExplanationSchema.parse(parsed);
      return validated;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
