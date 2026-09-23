import {
  UserProfile,
  UserRole,
  GovernanceQueryResponse,
  GovernanceQueryIntent,
  AIOperationRecord,
  AIOperationType,
  AIOperationStatus,
  ERROR_CODES,
  GovernanceQueryInput
} from '@civicpulse/shared';
import { getDatabaseProvider, getGovernanceProvider } from '../../providers';
import { AppError } from '../../middleware/error.middleware';
import { env } from '../../config/env';
import { GovernanceTools } from './governance.tools';
import { GovernanceClassifier } from './governance.classifier';

export class GovernanceService {
  /**
   * Executes a grounded governance intelligence query.
   * RBAC:
   * - Citizen: 403 Forbidden.
   * - Field Officer: Limited operational scope.
   * - Department Officer: Department scope.
   * - Admin: Cross-department global scope.
   */
  public static async executeGovernanceQuery(
    user: UserProfile,
    input: GovernanceQueryInput
  ): Promise<GovernanceQueryResponse> {
    const startTime = Date.now();

    // 1. RBAC Guard: Citizen is strictly forbidden
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Governance intelligence is restricted to municipal administrators and department officers.'
      });
    }

    // 2. Classify Intent & Permitted Tools
    const plan = GovernanceClassifier.classify(input.question, input.context);
    const retrievedData: Record<string, unknown> = {};
    const evidenceLabelsSet = new Set<string>();

    // 3. Controlled Tool Execution based on Intent & Scope
    if (plan.intent !== GovernanceQueryIntent.UNSUPPORTED) {
      // Execute each permitted tool safely
      for (const toolName of plan.tools) {
        try {
          if (toolName === 'getTopProblems') {
            const res = await GovernanceTools.getTopProblems(user, {
              ward_id: plan.extracted_entities.ward_id,
              department_id: plan.extracted_entities.department_id,
              category: plan.extracted_entities.category,
              limit: 5
            });
            retrievedData.problems = res.problems;
            evidenceLabelsSet.add(res.evidence_label);
          } else if (toolName === 'getProblemDetails') {
            const probId = plan.extracted_entities.problem_id || (env.DEMO_MODE ? 'PRB-2026-0819' : undefined);
            if (probId) {
              const res = await GovernanceTools.getProblemDetails(user, { problem_id: probId });
              retrievedData.problem = res.problem;
              evidenceLabelsSet.add(res.evidence_label);
            }
          } else if (toolName === 'getWardImpact') {
            const res = await GovernanceTools.getWardImpact(user, {
              ward_id: plan.extracted_entities.ward_id
            });
            retrievedData.ward_metrics = res.ward_metrics;
            evidenceLabelsSet.add(res.evidence_label);
          } else if (toolName === 'getDepartmentBacklog') {
            const res = await GovernanceTools.getDepartmentBacklog(user, {
              department_id: plan.extracted_entities.department_id
            });
            retrievedData.workloads = res.workloads;
            evidenceLabelsSet.add(res.evidence_label);
          } else if (toolName === 'getDepartmentPerformance') {
            const res = await GovernanceTools.getDepartmentPerformance(user, {
              department_id: plan.extracted_entities.department_id
            });
            retrievedData.performance = res.performance;
            evidenceLabelsSet.add(res.evidence_label);
          } else if (toolName === 'getTrend') {
            const res = await GovernanceTools.getTrend(user, {
              category: plan.extracted_entities.category,
              ward_id: plan.extracted_entities.ward_id
            });
            retrievedData.trend = res.trend;
            evidenceLabelsSet.add(res.evidence_label);
          } else if (toolName === 'getSlaRisk') {
            const res = await GovernanceTools.getSlaRisk(user, {
              department_id: plan.extracted_entities.department_id
            });
            retrievedData.at_risk_problems = res.at_risk_problems;
            evidenceLabelsSet.add(res.evidence_label);
          } else if (toolName === 'getProblemsNearFacility') {
            const res = await GovernanceTools.getProblemsNearFacility(user, {});
            retrievedData.facility_problems = res.facility_problems;
            evidenceLabelsSet.add(res.evidence_label);
          } else if (toolName === 'getResolutionPerformance') {
            const probId = plan.extracted_entities.problem_id || (env.DEMO_MODE ? 'PRB-2026-0819' : undefined);
            if (probId) {
              const res = await GovernanceTools.getResolutionPerformance(user, { problem_id: probId });
              retrievedData.evidence = res.evidence;
              retrievedData.verification = res.verification;
              evidenceLabelsSet.add(res.evidence_label);
            }
          } else if (toolName === 'getProblemTimeline') {
            const probId = plan.extracted_entities.problem_id || (env.DEMO_MODE ? 'PRB-2026-0819' : undefined);
            if (probId) {
              const res = await GovernanceTools.getProblemTimeline(user, { problem_id: probId });
              retrievedData.actions = res.actions;
              evidenceLabelsSet.add(res.evidence_label);
            }
          }
        } catch (err) {
          // If a scoped query fails (e.g. Department Officer query on another department), bubble 403
          if (err instanceof AppError && err.statusCode === 403) {
            throw err;
          }
          console.warn(`Tool execution warning for ${toolName}:`, err);
        }
      }
    }

    const evidenceLabels = Array.from(evidenceLabelsSet);

    // 4. Invoke AI Governance Provider
    const provider = getGovernanceProvider();
    let response: GovernanceQueryResponse;
    let opStatus = AIOperationStatus.SUCCESS;

    try {
      response = await provider.answerGovernanceQuestion({
        question: input.question,
        intent: plan.intent,
        user,
        retrieved_data: retrievedData,
        evidence_labels: evidenceLabels
      });
    } catch (err: any) {
      opStatus = AIOperationStatus.FAILED;
      // Safe fallback on provider error/timeout
      response = {
        answer: 'The governance intelligence system encountered a temporary analytical processing error. Case records and database operations remain unaffected.',
        confidence: 0.5,
        confidence_level: 'LOW',
        intent: plan.intent,
        evidence_labels: evidenceLabels.length > 0 ? evidenceLabels : ['Problem Details'],
        insights: ['AI processing temporarily degraded; manual inspection available on problem dashboard.'],
        metrics: [],
        facts: [],
        sources: [],
        supporting_problems: plan.extracted_entities.problem_id ? [plan.extracted_entities.problem_id] : [],
        recommendations: ['Check the operations dashboard for direct telemetry.'],
        limitations: [err.message || 'Governance provider timeout or unavailable.'],
        is_demo: false,
        generated_at: new Date().toISOString(),
        model: provider.getModelName(),
        prompt_version: provider.getPromptVersion()
      };
    }

    // 5. Immutable Audit Log
    const db = getDatabaseProvider();
    const aiOp: AIOperationRecord = {
      id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      operation_type: AIOperationType.GOVERNANCE_QUERY,
      entity_type: 'governance_query',
      entity_id: user.id,
      model: provider.getModelName(),
      prompt_version: provider.getPromptVersion(),
      status: opStatus,
      confidence: response.confidence,
      latency_ms: Date.now() - startTime,
      created_at: new Date().toISOString()
    };
    await db.createAIOperation(aiOp);

    return response;
  }

  /**
   * Retrieves executive AI brief grounded in current top problem.
   */
  public static async getAIBrief(user: UserProfile) {
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Executive brief restricted to government personnel.'
      });
    }

    const db = getDatabaseProvider();
    const isDemoFilter = env.DEMO_MODE ? undefined : false;
    const { data: rawProblems } = await db.listProblemClusters({
      limit: 5,
      is_demo: isDemoFilter
    });
    const problems = isDemoFilter !== undefined
      ? rawProblems.filter((p) => (p.is_demo || false) === isDemoFilter)
      : rawProblems;

    if (problems.length === 0) {
      if (env.DEMO_MODE) {
        const top = {
          id: 'PRB-2026-0819',
          title: 'Water Supply Disruption — Nayapalli Ward 18',
          impact_score: 92,
          ward_id: 'WARD-018',
          signal_count: 327
        };
        return {
          title: 'MUNICIPAL EXECUTIVE INTELLIGENCE BRIEF',
          summary: `Water supply is currently the largest unresolved public-impact disruption (#${top.id}, Impact: ${top.impact_score}/100). The strongest concentration is localized along the Nayapalli Ward 18 transit corridor.`,
          top_problem_id: top.id,
          priority_ward: top.ward_id,
          impact_score: top.impact_score,
          sources_count: top.signal_count,
          evidence_label: 'Problem Ranking',
          generated_at: new Date().toISOString()
        };
      }

      return {
        title: 'MUNICIPAL EXECUTIVE INTELLIGENCE BRIEF',
        summary: 'No active problem clusters or citizen disruptions currently recorded in the municipal database.',
        top_problem_id: null,
        priority_ward: null,
        impact_score: 0,
        sources_count: 0,
        evidence_label: 'Zero Disruption Telemetry',
        generated_at: new Date().toISOString()
      };
    }

    const top = problems[0]!;
    const wardLabel = top.ward_id ? `in ${top.ward_id}` : 'citywide';
    return {
      title: 'MUNICIPAL EXECUTIVE INTELLIGENCE BRIEF',
      summary: `${top.title} is currently the highest-impact unresolved disruption (#${top.id}, Impact: ${top.impact_score}/100) ${wardLabel}. Operational triage and department dispatch are active.`,
      top_problem_id: top.id,
      priority_ward: top.ward_id || null,
      impact_score: top.impact_score,
      sources_count: top.signal_count || 1,
      evidence_label: 'Problem Ranking',
      generated_at: new Date().toISOString()
    };
  }
}
