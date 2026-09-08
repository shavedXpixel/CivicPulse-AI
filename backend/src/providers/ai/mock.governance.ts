import {
  IGovernanceAIProvider,
  GovernanceAIInput
} from './governance.interface';
import {
  GovernanceQueryIntent,
  GovernanceQueryResponse,
  GovernanceSourceType
} from '@civicpulse/shared';
import { PROMPT_VERSION_GOVERNANCE_INTELLIGENCE } from '../../infrastructure/ai/prompts/governance_intelligence_v1';

export class MockGovernanceAIProvider implements IGovernanceAIProvider {
  private _simulateFailure = false;
  private _simulateTimeout = false;
  private _simulateMalformed = false;

  public simulateFailure(val: boolean = true) {
    this._simulateFailure = val;
  }

  public simulateTimeout(val: boolean = true) {
    this._simulateTimeout = val;
  }

  public simulateMalformed(val: boolean = true) {
    this._simulateMalformed = val;
  }

  public getModelName(): string {
    return 'mock-governance-v1';
  }

  public getPromptVersion(): string {
    return PROMPT_VERSION_GOVERNANCE_INTELLIGENCE;
  }

  async answerGovernanceQuestion(input: GovernanceAIInput): Promise<GovernanceQueryResponse> {
    if (this._simulateTimeout) {
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }

    if (this._simulateFailure) {
      throw new Error('Simulated Mock Governance AI Provider failure for resilience testing');
    }

    if (this._simulateMalformed) {
      return {
        invalid_structure: true
      } as any;
    }

    const nowIso = new Date().toISOString();
    const qLower = input.question.toLowerCase();
    const intent = input.intent;
    const data = input.retrieved_data;

    // Clean intent-based routing
    switch (intent) {
      case GovernanceQueryIntent.UNSUPPORTED: {
        return {
          answer: 'This question cannot be answered using the currently authorized municipal infrastructure and civic operations dataset. CivicPulse AI operates strictly as a grounded intelligence system and will not extrapolate or invent unverified governance statistics.',
          confidence: 0.95,
          confidence_level: 'HIGH',
          intent: GovernanceQueryIntent.UNSUPPORTED,
          evidence_labels: [],
          insights: ['Query falls outside authorized municipal infrastructure telemetry and workflow schemas.'],
          metrics: [],
          facts: [],
          sources: [],
          supporting_problems: [],
          recommendations: [
            'Submit questions related to public problem clusters, ward impacts, department backlogs, or resolution verification.'
          ],
          limitations: [
            'Grounded retrieval only indexes active problem clusters, verified signals, department workload, and resolution evidence.'
          ],
          is_demo: false,
          generated_at: nowIso,
          model: this.getModelName(),
          prompt_version: this.getPromptVersion()
        };
      }

      case GovernanceQueryIntent.WHY_RANKED: {
        const topProblem: any = (data.problems as any[])?.[0] || data.problem;
        const secondProblem: any = (data.problems as any[])?.[1];

        const p1Score = topProblem?.impact_score || 92;
        const p1Sev = topProblem?.severity_score || 24;
        const p1Pop = topProblem?.population_score || 18;
        const p1PopEst = topProblem?.estimated_population ? topProblem.estimated_population.toLocaleString() : '18,400';
        const p1Dur = topProblem?.duration_score || 14;
        const p1DurDays = topProblem?.duration_days || 3;
        const p1Facility = topProblem?.critical_exposure_score || 9;

        const p2Score = secondProblem?.impact_score || 86;
        const p2Sev = secondProblem?.severity_score || 22;
        const p2Pop = secondProblem?.population_score || 16;
        const p2PopEst = secondProblem?.estimated_population ? secondProblem.estimated_population.toLocaleString() : '12,500';

        return {
          answer: `Water Supply Disruption (#PRB-2026-0819) ranks highest with a composite impact score of ${p1Score}/100 (CRITICAL), surpassing the Stormwater Drain Collapse (#PRB-2026-0820) at ${p2Score}/100. This prioritization is mathematically driven by three primary factors: higher physical severity (${p1Sev}/25 vs ${p2Sev}/25), broader population exposure affecting ${p1PopEst} residents (${p1Pop}/20 vs ${p2Pop}/20), and multi-day duration (${p1DurDays} days active, ${p1Dur}/15). Furthermore, the water rupture directly impairs critical civic infrastructure near DAV Public School (${p1Facility}/10).`,
          confidence: 0.94,
          confidence_level: 'HIGH',
          intent: GovernanceQueryIntent.WHY_RANKED,
          evidence_labels: ['Problem Details', 'Problem Ranking'],
          insights: [
            `PRB-2026-0819 holds the city's highest impact score at ${p1Score}/100.`,
            `Physical severity (${p1Sev}/25) and population affected (${p1PopEst} residents) are the dominant drivers.`
          ],
          metrics: [
            { label: 'PRB-2026-0819 Impact Score', value: p1Score, unit: '/100' },
            { label: 'PRB-2026-0820 Impact Score', value: p2Score, unit: '/100' },
            { label: 'Water Severity vs Drainage', value: `${p1Sev} vs ${p2Sev}`, unit: 'pts' },
            { label: 'Population Affected', value: `${p1PopEst} vs ${p2PopEst}`, unit: 'citizens' }
          ],
          facts: [
            { statement: `PRB-2026-0819 has an impact score of ${p1Score} with severity factor ${p1Sev}/25.`, source_type: 'DATABASE_METRIC', entity_id: 'PRB-2026-0819' },
            { statement: `PRB-2026-0820 has an impact score of ${p2Score} with severity factor ${p2Sev}/25.`, source_type: 'DATABASE_METRIC', entity_id: 'PRB-2026-0820' },
            { statement: `PRB-2026-0819 affects an estimated ${p1PopEst} residents near DAV Public School.`, source_type: 'VERIFIED_RECORD', entity_id: 'PRB-2026-0819' }
          ],
          sources: [
            { source_type: GovernanceSourceType.PROBLEM_CLUSTER, entity_id: 'PRB-2026-0819', label: 'Problem #PRB-2026-0819 (Score: 92)', url: '/dashboard/problems/PRB-2026-0819' },
            { source_type: GovernanceSourceType.PROBLEM_CLUSTER, entity_id: 'PRB-2026-0820', label: 'Problem #PRB-2026-0820 (Score: 86)', url: '/dashboard/problems/PRB-2026-0820' }
          ],
          supporting_problems: ['PRB-2026-0819', 'PRB-2026-0820'],
          recommendations: [
            'Maintain highest engineering response priority on PRB-2026-0819 due to combined critical school exposure and high population density.'
          ],
          limitations: [
            'Calculated from authoritative 7-factor impact engine scores. Does not infer unmeasured structural pipe deterioration beyond the reported junction.'
          ],
          is_demo: true,
          generated_at: nowIso,
          model: this.getModelName(),
          prompt_version: this.getPromptVersion()
        };
      }

      case GovernanceQueryIntent.TOP_PROBLEMS:
      case GovernanceQueryIntent.WARD_IMPACT: {
        const problems: any[] = (data.problems as any[]) || [];
        const top3 = problems.slice(0, 3);
        const topProblem = top3[0] || {};
        const secondProblem = top3[1] || {};
        const thirdProblem = top3[2] || {};

        const p1Title = topProblem.title || 'Water Supply Disruption — Nayapalli Ward 18';
        const p1Score = topProblem.impact_score || 92;
        const p1Signals = topProblem.signal_count || 327;
        const p1Pop = topProblem.estimated_population ? topProblem.estimated_population.toLocaleString() : '18,400';

        const p2Title = secondProblem.title || 'Primary Stormwater Drain Collapse & Backflow';
        const p2Score = secondProblem.impact_score || 86;

        const p3Title = thirdProblem.title || 'Subsurface Road Cavity & Subsidence — Khandagiri';
        const p3Score = thirdProblem.impact_score || 81;

        return {
          answer: `In Ward 18 and across the municipal corridor, the highest unresolved public impact problem is "${p1Title}" (#PRB-2026-0819) with an impact score of ${p1Score}/100 (CRITICAL), comprising ${p1Signals} citizen signals and affecting an estimated ${p1Pop} residents. Citywide, this is followed by "${p2Title}" (#PRB-2026-0820) with a score of ${p2Score}/100, and "${p3Title}" (#PRB-2026-0821) with a score of ${p3Score}/100.`,
          confidence: 0.96,
          confidence_level: 'HIGH',
          intent: intent,
          evidence_labels: ['Problem Ranking', 'Ward Analytics'],
          insights: [
            `Ward 18 has the single highest-impact problem cluster in the city (#PRB-2026-0819, Score: ${p1Score}).`,
            `Water supply disruption accounts for ${p1Signals} synthesized citizen signals.`
          ],
          metrics: [
            { label: 'Top Problem Impact', value: p1Score, unit: '/100' },
            { label: 'Correlated Signals', value: p1Signals, unit: 'reports' },
            { label: 'Population Affected', value: p1Pop, unit: 'citizens' },
            { label: 'Secondary Issue Score', value: p2Score, unit: '/100' }
          ],
          facts: [
            { statement: `PRB-2026-0819 in Ward 18 has an impact score of ${p1Score} and level CRITICAL.`, source_type: 'DATABASE_METRIC', entity_id: 'PRB-2026-0819' },
            { statement: `PRB-2026-0819 consolidates ${p1Signals} signals from Ward 18 residents.`, source_type: 'VERIFIED_RECORD', entity_id: 'PRB-2026-0819' }
          ],
          sources: [
            { source_type: GovernanceSourceType.PROBLEM_CLUSTER, entity_id: 'PRB-2026-0819', label: `Problem #PRB-2026-0819 (Score: ${p1Score})`, url: '/dashboard/problems/PRB-2026-0819' },
            { source_type: GovernanceSourceType.WARD, entity_id: 'WARD-018', label: 'Ward 18 (Nayapalli)' },
            { source_type: GovernanceSourceType.DEPARTMENT, entity_id: 'WATCO', label: 'WATCO Engineering Division' }
          ],
          supporting_problems: ['PRB-2026-0819', 'PRB-2026-0820', 'PRB-2026-0821'],
          recommendations: [
            'Ensure rapid dispatch coordination between WATCO and BMC Roads for post-excavation pavement reinstatement.'
          ],
          limitations: [
            'Signal count reflects synthetic multi-channel aggregated signals pre-seeded for Golden Demo evaluation.'
          ],
          is_demo: true,
          generated_at: nowIso,
          model: this.getModelName(),
          prompt_version: this.getPromptVersion()
        };
      }

      case GovernanceQueryIntent.SLA_RISK: {
        const workloads: any[] = (data.workloads as any[]) || [];
        const watco = workloads.find((w) => w.department_id === 'WATCO') || { total_assigned: 1, active_in_progress: 1, critical_or_high: 1, sla_breached: 0 };
        const drainage = workloads.find((w) => w.department_id === 'BMC_DRAINAGE') || { total_assigned: 1, active_in_progress: 0, critical_or_high: 1, sla_breached: 0 };

        return {
          answer: `Departmental workload analysis indicates that WATCO currently carries the highest operational priority, with ${watco.active_in_progress} active critical problem in progress (#PRB-2026-0819) with high public exposure. BMC Drainage carries ${drainage.total_assigned} assigned critical/high incident (#PRB-2026-0820). No department has currently breached statutory SLA thresholds, though WATCO's 24-hour critical remediation target requires prompt supervisory closure.`,
          confidence: 0.92,
          confidence_level: 'HIGH',
          intent: GovernanceQueryIntent.SLA_RISK,
          evidence_labels: ['SLA Risk', 'Department Workload'],
          insights: [
            'Zero statutory SLA breaches recorded across departments.',
            'WATCO has highest active severity workload with 1 active critical case.'
          ],
          metrics: [
            { label: 'WATCO Active Critical', value: watco.critical_or_high, unit: 'incidents' },
            { label: 'WATCO SLA Breaches', value: watco.sla_breached, unit: 'breaches' },
            { label: 'BMC Drainage Assigned', value: drainage.total_assigned, unit: 'incidents' }
          ],
          facts: [
            { statement: `WATCO has ${watco.total_assigned} assigned problem with ${watco.active_in_progress} in progress.`, source_type: 'DATABASE_METRIC', entity_id: 'WATCO' },
            { statement: 'Zero SLA breaches recorded across active municipal problem clusters.', source_type: 'DATABASE_METRIC' }
          ],
          sources: [
            { source_type: GovernanceSourceType.DEPARTMENT, entity_id: 'WATCO', label: 'WATCO Department Workload' },
            { source_type: GovernanceSourceType.DEPARTMENT, entity_id: 'BMC_DRAINAGE', label: 'BMC Drainage Department Workload' },
            { source_type: GovernanceSourceType.SLA_RECORD, entity_id: 'SLA_METRICS', label: 'Municipal SLA Performance Ledger' }
          ],
          supporting_problems: ['PRB-2026-0819', 'PRB-2026-0820'],
          recommendations: [
            'Prioritize field sign-off for WATCO incident to maintain 100% municipal SLA compliance.'
          ],
          limitations: [
            'Workload metrics reflect active assignments in the current demonstration session.'
          ],
          is_demo: true,
          generated_at: nowIso,
          model: this.getModelName(),
          prompt_version: this.getPromptVersion()
        };
      }

      case GovernanceQueryIntent.RESOLUTION_PERFORMANCE: {
        const evidenceList: any[] = (data.evidence as any[]) || [];
        const verResult: any = data.verification || {};
        const verStatus = verResult.verification_result || 'VERIFIED';
        const verConfidence = verResult.confidence || 0.93;

        return {
          answer: `Resolution of problem #PRB-2026-0819 is supported by physical completion proof and AI advisory analysis. Field Officer Rajesh K. submitted photographic proof (#evd_demo_0819_after) showing replacement of the fractured main with a high-pressure 250mm DI flange assembly bolted to engineering spec, confirmed with a 3.8 bar hydrostatic test gauge and asphalt pavement cleared of standing water. AI advisory verification evaluated the before vs after evidence and returned [${verStatus}] with ${(verConfidence * 100).toFixed(0)}% confidence. Final case resolution remains subject to human supervisory approval.`,
          confidence: 0.95,
          confidence_level: 'HIGH',
          intent: GovernanceQueryIntent.RESOLUTION_PERFORMANCE,
          evidence_labels: ['Resolution Evidence', 'Problem Details'],
          insights: [
            `Physical proof includes 250mm DI flange replacement and 3.8 bar pressure gauge log.`,
            `AI advisory verification completed: [${verStatus}] (${(verConfidence * 100).toFixed(0)}% confidence).`,
            'Authoritative closure requires human supervisory approval.'
          ],
          metrics: [
            { label: 'AI Verification Status', value: verStatus },
            { label: 'Verification Confidence', value: `${(verConfidence * 100).toFixed(0)}%` },
            { label: 'Hydrostatic Pressure', value: '3.8', unit: 'bar' },
            { label: 'Flange Diameter', value: '250', unit: 'mm' }
          ],
          facts: [
            { statement: 'Resolution proof evd_demo_0819_after confirms replacement of ruptured water main.', source_type: 'VERIFIED_RECORD', entity_id: 'evd_demo_0819_after' },
            { statement: `AI advisory verification returned ${verStatus} with ${(verConfidence * 100).toFixed(0)}% confidence.`, source_type: 'CALCULATED_INSIGHT', entity_id: 'PRB-2026-0819' }
          ],
          sources: [
            { source_type: GovernanceSourceType.EVIDENCE_RECORD, entity_id: 'evd_demo_0819_after', label: 'Completion Photo & Telemetry (#evd_demo_0819_after)', url: '/dashboard/problems/PRB-2026-0819' },
            { source_type: GovernanceSourceType.PROBLEM_CLUSTER, entity_id: 'PRB-2026-0819', label: 'Problem #PRB-2026-0819', url: '/dashboard/problems/PRB-2026-0819' }
          ],
          supporting_problems: ['PRB-2026-0819'],
          recommendations: [
            'Department Officer should perform supervisory review on the Resolution Workspace.'
          ],
          limitations: [
            'Visual inspection proof is advisory only and cannot test subterranean pipe lifespan beyond the junction.'
          ],
          is_demo: true,
          generated_at: nowIso,
          model: this.getModelName(),
          prompt_version: this.getPromptVersion()
        };
      }

      case GovernanceQueryIntent.PROBLEM_DETAILS: {
        const problem: any = data.problem || (data.problems as any[])?.[0] || {};
        const pTitle = problem.title || 'Water Supply Disruption — Nayapalli Ward 18';
        const pStatus = problem.status || 'IN_PROGRESS';
        const pOfficer = problem.assigned_to === 'usr_officer_01' ? 'Rajesh K. (Field Officer)' : problem.assigned_to || 'Assigned Officer';
        const pScore = problem.impact_score || 92;

        return {
          answer: `Problem #PRB-2026-0819 ("${pTitle}") currently has an operational status of [${pStatus}]. It is assigned to ${pOfficer} under WATCO. The case carries an impact score of ${pScore}/100 (CRITICAL) in Ward 18. Emergency excavation and pipeline replacement have been completed, and resolution proof has been submitted awaiting supervisory sign-off.`,
          confidence: 0.95,
          confidence_level: 'HIGH',
          intent: GovernanceQueryIntent.PROBLEM_DETAILS,
          evidence_labels: ['Problem Details', 'Audit History'],
          insights: [
            `Current lifecycle state: ${pStatus}.`,
            `Assigned to ${pOfficer} under WATCO dispatch.`
          ],
          metrics: [
            { label: 'Current Status', value: pStatus },
            { label: 'Impact Score', value: pScore, unit: '/100' },
            { label: 'Department', value: 'WATCO' }
          ],
          facts: [
            { statement: `PRB-2026-0819 status is ${pStatus}.`, source_type: 'DATABASE_METRIC', entity_id: 'PRB-2026-0819' },
            { statement: `Assigned to ${pOfficer} on 2026-09-04.`, source_type: 'VERIFIED_RECORD', entity_id: 'PRB-2026-0819' }
          ],
          sources: [
            { source_type: GovernanceSourceType.PROBLEM_CLUSTER, entity_id: 'PRB-2026-0819', label: `Problem #PRB-2026-0819 (${pStatus})`, url: '/dashboard/problems/PRB-2026-0819' }
          ],
          supporting_problems: ['PRB-2026-0819'],
          recommendations: [
            'Verify that water pressure telemetry is logged before official case closure.'
          ],
          limitations: [
            'Operational status updates in real-time following officer and supervisor actions.'
          ],
          is_demo: true,
          generated_at: nowIso,
          model: this.getModelName(),
          prompt_version: this.getPromptVersion()
        };
      }

      default: {
        const problemsList: any[] = (data.problems as any[]) || [];
        return {
          answer: `Analysis of authorized municipal records indicates ${problemsList.length} relevant problem cluster(s) within the query scope. The primary incident is "${problemsList[0]?.title || 'Water Supply Disruption'}" with an impact score of ${problemsList[0]?.impact_score || 92}/100 in Ward 18.`,
          confidence: 0.88,
          confidence_level: 'HIGH',
          intent: intent || GovernanceQueryIntent.GENERAL_GOVERNANCE_SUMMARY,
          evidence_labels: input.evidence_labels.length > 0 ? input.evidence_labels : ['Problem Ranking'],
          insights: [
            `Retrieved ${problemsList.length} problem cluster(s) matching scope.`
          ],
          metrics: [
            { label: 'Matching Problems', value: problemsList.length, unit: 'clusters' }
          ],
          facts: [
            { statement: `Identified ${problemsList.length} problem cluster(s) within authorized municipal scope.`, source_type: 'DATABASE_METRIC' }
          ],
          sources: problemsList.slice(0, 3).map((p) => ({
            source_type: GovernanceSourceType.PROBLEM_CLUSTER,
            entity_id: p.id,
            label: `${p.title} (Score: ${p.impact_score})`,
            url: `/dashboard/problems/${p.id}`
          })),
          supporting_problems: problemsList.slice(0, 3).map((p) => p.id),
          recommendations: ['Monitor active clusters for changes in SLA velocity.'],
          limitations: ['Grounded strictly in records accessible under current user role.'],
          is_demo: true,
          generated_at: nowIso,
          model: this.getModelName(),
          prompt_version: this.getPromptVersion()
        };
      }
    }
  }
}
