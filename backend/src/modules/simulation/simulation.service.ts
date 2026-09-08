import {
  UserProfile,
  UserRole,
  SimulationScenarioInput,
  SimulationResult,
  BudgetAllocationResult,
  ERROR_CODES,
  AIOperationType,
  AIOperationStatus,
  AIOperationRecord,
  SlaStatus
} from '@civicpulse/shared';
import { getDatabaseProvider, getSimulationProvider } from '../../providers';
import { SimulationEngine } from './simulation.engine';
import { AppError } from '../../middleware/error.middleware';

export class SimulationService {
  /**
   * Enforces server-side RBAC scoping for simulation access.
   */
  private checkAuthorization(user: UserProfile, departmentId?: string): void {
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Simulation workspace is restricted to municipal administrators and department officers. Citizen access is prohibited.'
      });
    }

    if (user.role === UserRole.DEPARTMENT_OFFICER && departmentId) {
      const userDept = (user.department_id || (user as any).department || '').toLowerCase();
      const targetDept = departmentId.toLowerCase();
      // Allow if matches department code or name
      const isMatch =
        userDept === targetDept ||
        targetDept.includes(userDept) ||
        (userDept === 'watco' && targetDept.includes('watco')) ||
        (userDept.includes('drainage') && targetDept.includes('drainage'));

      if (!isMatch) {
        throw new AppError({
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN,
          message: `Department officer (${user.department_id || (user as any).department}) is not authorized to simulate interventions for department "${departmentId}".`
        });
      }
    }
  }

  /**
   * Simulates an intervention scenario on a specific problem cluster.
   * Strictly READ-ONLY with respect to operational databases.
   */
  public async simulateProblem(
    input: SimulationScenarioInput,
    user: UserProfile
  ): Promise<SimulationResult> {
    const startTime = Date.now();
    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(input.problem_id);

    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Problem cluster with ID "${input.problem_id}" was not found.`
      });
    }

    // Verify RBAC access
    this.checkAuthorization(user, problem.department_id || (problem as any).assigned_department_id || (problem as any).recommended_department);

    // 1. Run deterministic mathematical simulation
    const result = SimulationEngine.simulateProblemScenario(problem, input);

    // 2. Obtain qualitative AI strategic commentary (with graceful fallback)
    let aiStatus = AIOperationStatus.SUCCESS;
    try {
      const aiProvider = getSimulationProvider();
      const explanation = await aiProvider.explainSimulation({
        scenario: input,
        problem_title: problem.title,
        department: problem.department_id || (problem as any).assigned_department_id || 'WATCO',
        ward_id: problem.ward_id || 'WARD-018',
        baseline: result.baseline,
        projected: result.projected,
        assumptions: result.assumptions
      });
      result.ai_explanation = explanation;
    } catch (aiErr: any) {
      aiStatus = AIOperationStatus.FAILED;
      // Graceful fallback to deterministic advisory note
      result.ai_explanation = {
        summary: `Deterministic simulation projects impact score reduction from ${result.baseline.impact_score} to ${result.projected.impact_score} (-${Math.abs(result.projected.impact_delta)} points), relieving ${result.projected.relieved_population.toLocaleString('en-IN')} citizens at ₹${result.projected.cost_per_citizen_relieved_inr.toFixed(2)}/citizen.`,
        operational_feasibility: 'Calculated using deterministic simulation parameters.',
        trade_offs: [
          `Estimated expenditure: ₹${result.projected.additional_budget_inr.toLocaleString('en-IN')}`,
          `Population relieved: ${result.projected.relieved_population.toLocaleString('en-IN')} citizens`
        ],
        risk_considerations: [
          result.projected.sla_status === SlaStatus.BREACHED
            ? 'Problem remains in SLA BREACH status; intervention saves ongoing delay hours.'
            : 'Remains within modeled operational limits.'
        ]
      };
    }

    // 3. Record non-mutating AI operation audit record (Phase 7 & 8 requirement)
    try {
      const durationMs = Date.now() - startTime;
      const aiRecord: AIOperationRecord = {
        id: `AI-OP-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        operation_type: AIOperationType.INTERVENTION_SIMULATION,
        entity_id: problem.id,
        entity_type: 'intervention_simulation',
        model: 'gemini-1.5-flash',
        prompt_version: 'intervention_simulation_v1',
        status: aiStatus,
        latency_ms: durationMs,
        created_at: new Date().toISOString()
      };
      await db.createAIOperation(aiRecord);
    } catch (auditErr) {
      // Non-blocking for simulation read response
      console.warn('Simulation AI audit record non-blocking error:', auditErr);
    }

    return result;
  }

  /**
   * Retrieves preset Golden Demo scenarios for a problem.
   */
  public async getPresets(
    problemId: string,
    user: UserProfile
  ): Promise<{ problem: { id: string; title: string; baseline_impact: number }; presets: SimulationScenarioInput[] }> {
    const db = getDatabaseProvider();
    const problem = await db.getProblemCluster(problemId);

    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Problem cluster with ID "${problemId}" was not found.`
      });
    }

    this.checkAuthorization(user, problem.department_id || (problem as any).assigned_department_id || (problem as any).recommended_department);

    const presets = SimulationEngine.getGoldenDemoPresets(problemId);
    return {
      problem: {
        id: problem.id,
        title: problem.title,
        baseline_impact: problem.impact_score || 92
      },
      presets
    };
  }

  /**
   * Simulates citywide budget allocation over active problem clusters.
   */
  public async simulateBudgetAllocation(
    totalBudget: number,
    user: UserProfile
  ): Promise<BudgetAllocationResult> {
    // Citywide budget optimization requires administrator access
    if (user.role !== UserRole.ADMIN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citywide budget allocation simulation requires Municipal Administrator credentials.'
      });
    }

    const db = getDatabaseProvider();
    const { data: problems } = await db.listProblemClusters({});

    return SimulationEngine.simulateBudgetAllocation(problems, totalBudget);
  }
}

export const simulationService = new SimulationService();
