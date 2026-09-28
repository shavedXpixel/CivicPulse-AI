import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getDatabaseProvider, ProviderContainer, MockSimulationAIProvider } from '../src/providers';
import { InterventionType, SlaStatus, SlaRiskBand, ProblemStatus, ImpactLevel } from '@civicpulse/shared';
import { SimulationEngine } from '../src/modules/simulation/simulation.engine';

describe('Phase 8: Intervention Simulator (Read-Only Civic Intelligence)', () => {
  const app = createApp();

  beforeEach(() => {
    // Reset any mock overrides
    const mockAI = new MockSimulationAIProvider();
    ProviderContainer.setSimulationProvider(mockAI);
  });

  describe('1. Deterministic Simulation Engine & Factor Sum Identity', () => {
    it('guarantees projected_impact_score strictly equals the sum of its factor components for Scenario A', async () => {
      const db = getDatabaseProvider();
      const problem = (await db.getProblemCluster('PRB-2026-0819'))!;
      expect(problem).toBeDefined();

      const result = SimulationEngine.simulateProblemScenario(problem, {
        problem_id: problem.id,
        scenario_name: 'Scenario A: Emergency Tanker Surge',
        intervention_type: InterventionType.EMERGENCY_DISPATCH,
        additional_budget_inr: 150000,
        extra_crews: 2,
        population_relief_rate: 0.65,
        response_time_reduction_hours: 4,
        assumed_baseline_remaining_hours: 24,
        include_facility_mitigation: true,
        include_permanent_renewal: false
      });

      const { factors, impact_score } = result.projected;
      const computedSum =
        factors.severity +
        factors.population +
        factors.duration +
        factors.concentration +
        factors.critical_facility +
        factors.recurrence +
        factors.evidence;

      // Exact mathematical identity
      expect(factors.total).toBe(computedSum);
      expect(impact_score).toBe(computedSum);
      expect(impact_score).toBe(69);

      // Verify individual factor components: 18 + 10 + 14 + 12 + 2 + 8 + 5 = 69
      expect(factors.severity).toBe(18);
      expect(factors.population).toBe(10);
      expect(factors.duration).toBe(14);
      expect(factors.concentration).toBe(12);
      expect(factors.critical_facility).toBe(2);
      expect(factors.recurrence).toBe(8);
      expect(factors.evidence).toBe(5);

      // Verify population relief: 18400 * 0.75 = 13800 relieved, 4600 remaining
      expect(result.projected.relieved_population).toBe(13800);
      expect(result.projected.remaining_exposed_population).toBe(4600);
      expect(result.projected.cost_per_citizen_relieved_inr).toBe(10.87);
    });

    it('guarantees projected_impact_score strictly equals the sum of its factor components for Scenario B', async () => {
      const db = getDatabaseProvider();
      const problem = (await db.getProblemCluster('PRB-2026-0819'))!;

      const result = SimulationEngine.simulateProblemScenario(problem, {
        problem_id: problem.id,
        scenario_name: 'Scenario B: Accelerated Dual-Crew Repair',
        intervention_type: InterventionType.CAPACITY_BOOST,
        additional_budget_inr: 420000,
        extra_crews: 2,
        population_relief_rate: 0.95,
        response_time_reduction_hours: 0,
        assumed_baseline_remaining_hours: 24,
        include_facility_mitigation: true,
        include_permanent_renewal: false
      });

      const { factors, impact_score } = result.projected;
      const computedSum =
        factors.severity +
        factors.population +
        factors.duration +
        factors.concentration +
        factors.critical_facility +
        factors.recurrence +
        factors.evidence;

      expect(factors.total).toBe(computedSum);
      expect(impact_score).toBe(computedSum);
      expect(impact_score).toBe(43);

      // Verify individual factor components: 10 + 0 + 14 + 6 + 0 + 8 + 5 = 43
      expect(factors.severity).toBe(10);
      expect(factors.population).toBe(0);
      expect(factors.duration).toBe(14);
      expect(factors.concentration).toBe(6);
      expect(factors.critical_facility).toBe(0);
      expect(factors.recurrence).toBe(8);
      expect(factors.evidence).toBe(5);

      // Verify 100% population restored: 18400 relieved, 0 remaining
      expect(result.projected.relieved_population).toBe(18400);
      expect(result.projected.remaining_exposed_population).toBe(0);
      expect(result.projected.time_saved_hours).toBe(12);
      expect(result.projected.projected_remaining_repair_hours).toBe(12);
    });

    it('guarantees projected_impact_score strictly equals the sum of its factor components for Scenario C', async () => {
      const db = getDatabaseProvider();
      const problem = (await db.getProblemCluster('PRB-2026-0819'))!;

      const result = SimulationEngine.simulateProblemScenario(problem, {
        problem_id: problem.id,
        scenario_name: 'Scenario C: Resilient Culvert Bypass Loop',
        intervention_type: InterventionType.INFRASTRUCTURE_REPAIR,
        additional_budget_inr: 850000,
        extra_crews: 3,
        population_relief_rate: 1.0,
        response_time_reduction_hours: 0,
        assumed_baseline_remaining_hours: 24,
        include_facility_mitigation: true,
        include_permanent_renewal: true
      });

      const { factors, impact_score } = result.projected;
      const computedSum =
        factors.severity +
        factors.population +
        factors.duration +
        factors.concentration +
        factors.critical_facility +
        factors.recurrence +
        factors.evidence;

      expect(factors.total).toBe(computedSum);
      expect(impact_score).toBe(computedSum);
      expect(impact_score).toBe(30);

      // Verify individual factor components: 6 + 0 + 14 + 4 + 0 + 1 + 5 = 30
      expect(factors.severity).toBe(6);
      expect(factors.population).toBe(0);
      expect(factors.duration).toBe(14);
      expect(factors.concentration).toBe(4);
      expect(factors.critical_facility).toBe(0);
      expect(factors.recurrence).toBe(1); // Modeled 90-day horizon assumption
      expect(factors.evidence).toBe(5);
    });

    it('guarantees factor sum identity holds for arbitrary custom parameters', async () => {
      const db = getDatabaseProvider();
      const problem = (await db.getProblemCluster('PRB-2026-0819'))!;

      // Test with custom parameter combinations
      const customInputs = [
        { extra_crews: 1, rate: 0.30, type: InterventionType.EMERGENCY_DISPATCH },
        { extra_crews: 4, rate: 0.80, type: InterventionType.CAPACITY_BOOST },
        { extra_crews: 5, rate: 1.00, type: InterventionType.INFRASTRUCTURE_REPAIR }
      ];

      for (const ci of customInputs) {
        const res = SimulationEngine.simulateProblemScenario(problem, {
          problem_id: problem.id,
          scenario_name: 'Custom Parameter Test',
          intervention_type: ci.type,
          additional_budget_inr: 300000,
          extra_crews: ci.extra_crews,
          population_relief_rate: ci.rate,
          response_time_reduction_hours: 2,
          assumed_baseline_remaining_hours: 20,
          include_facility_mitigation: true,
          include_permanent_renewal: ci.type === InterventionType.INFRASTRUCTURE_REPAIR
        });

        const { factors, impact_score } = res.projected;
        const sum =
          factors.severity +
          factors.population +
          factors.duration +
          factors.concentration +
          factors.critical_facility +
          factors.recurrence +
          factors.evidence;

        expect(factors.total).toBe(sum);
        expect(impact_score).toBe(sum);
      }
    });
  });

  describe('2. SLA Breach Protection & Separation of Problem Age from MTTR', () => {
    it('verifies baseline SLA is ALREADY BREACHED and projected state remains BREACHED without claiming breach reversal', async () => {
      const db = getDatabaseProvider();
      const problem = (await db.getProblemCluster('PRB-2026-0819'))!;

      const result = SimulationEngine.simulateProblemScenario(problem, {
        problem_id: problem.id,
        scenario_name: 'Scenario B: Accelerated Dual-Crew Repair',
        intervention_type: InterventionType.CAPACITY_BOOST,
        additional_budget_inr: 420000,
        extra_crews: 2,
        population_relief_rate: 0.95,
        response_time_reduction_hours: 0,
        assumed_baseline_remaining_hours: 24,
        include_facility_mitigation: true,
        include_permanent_renewal: false
      });

      // Baseline SLA check: 72h elapsed vs 24h threshold
      expect(result.baseline.sla_status).toBe(SlaStatus.BREACHED);
      expect(result.baseline.sla_risk_band).toBe(SlaRiskBand.CRITICAL);
      expect(result.baseline.sla_utilization).toBeGreaterThanOrEqual(3.0);

      // Projected SLA check: still BREACHED
      expect(result.projected.sla_status).toBe(SlaStatus.BREACHED);
      expect(result.projected.sla_risk_band).toBe(SlaRiskBand.CRITICAL);
      expect(result.projected.sla_utilization).toBe(3.5);

      // Clear explanation verifying no retroactive breach reversal
      expect(result.projected.sla_explanation).toContain('ALREADY BREACHED');
      expect(result.projected.sla_explanation).toContain('cannot retroactively undo');
      expect(result.projected.time_saved_hours).toBe(12);
    });

    it('strictly separates elapsed problem age from assumed remaining repair hours', async () => {
      const db = getDatabaseProvider();
      const problem = (await db.getProblemCluster('PRB-2026-0819'))!;

      const result = SimulationEngine.simulateProblemScenario(problem, {
        problem_id: problem.id,
        scenario_name: 'Temporal Separation Test',
        intervention_type: InterventionType.CAPACITY_BOOST,
        additional_budget_inr: 200000,
        extra_crews: 1,
        population_relief_rate: 0.5,
        response_time_reduction_hours: 0,
        assumed_baseline_remaining_hours: 24
      });

      expect(result.baseline.elapsed_problem_hours).toBeGreaterThanOrEqual(72);
      expect(result.projected.assumed_baseline_remaining_hours).toBe(24);
      expect(result.projected.projected_total_elapsed_hours).toBe(
        result.baseline.elapsed_problem_hours + result.projected.projected_remaining_repair_hours
      );
    });
  });

  describe('3. Recurrence Modeled as a Qualified Simulation Assumption', () => {
    it('labels recurrence reduction in Scenario C as an assumed 90-day planning horizon rather than a guarantee', async () => {
      const db = getDatabaseProvider();
      const problem = (await db.getProblemCluster('PRB-2026-0819'))!;

      const result = SimulationEngine.simulateProblemScenario(problem, {
        problem_id: problem.id,
        scenario_name: 'Scenario C: Resilient Culvert Bypass Loop',
        intervention_type: InterventionType.INFRASTRUCTURE_REPAIR,
        additional_budget_inr: 850000,
        extra_crews: 3,
        population_relief_rate: 1.0,
        response_time_reduction_hours: 0,
        assumed_baseline_remaining_hours: 24,
        include_facility_mitigation: true,
        include_permanent_renewal: true
      });

      expect(result.projected.factors.recurrence).toBe(1);
      const recurrenceAssumption = result.assumptions.find((a) => a.includes('90-day planning horizon'));
      expect(recurrenceAssumption).toBeDefined();
      expect(recurrenceAssumption).toContain('not an empirical guarantee');
    });
  });

  describe('4. Strict Read-Only Database Verification', () => {
    it('guarantees that running simulations never mutates the underlying problem record in the database', async () => {
      const db = getDatabaseProvider();
      const beforeProblem = JSON.parse(JSON.stringify(await db.getProblemCluster('PRB-2026-0819')));

      // Execute simulation via API as Admin
      const res = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          problem_id: 'PRB-2026-0819',
          scenario_name: 'Mutate Attempt Test',
          intervention_type: InterventionType.INFRASTRUCTURE_REPAIR,
          additional_budget_inr: 850000,
          extra_crews: 3,
          population_relief_rate: 1.0,
          response_time_reduction_hours: 0,
          include_facility_mitigation: true,
          include_permanent_renewal: true
        });

      expect(res.status).toBe(200);

      // Re-fetch problem directly from database
      const afterProblem = JSON.parse(JSON.stringify(await db.getProblemCluster('PRB-2026-0819')));

      // Assert all operational fields remain 100% untouched
      expect(afterProblem.impact_score).toBe(beforeProblem.impact_score);
      expect(afterProblem.impact_score).toBe(92);
      expect(afterProblem.status).toBe(beforeProblem.status);
      expect(afterProblem.assigned_department_id).toBe(beforeProblem.assigned_department_id);
      expect(afterProblem.assigned_officer_id).toBe(beforeProblem.assigned_officer_id);
      expect(afterProblem.estimated_population).toBe(beforeProblem.estimated_population);
      expect(afterProblem.severity_score).toBe(beforeProblem.severity_score);
      expect(afterProblem.population_score).toBe(beforeProblem.population_score);
      expect(afterProblem.duration_score).toBe(beforeProblem.duration_score);
    });

    it('strictly enforces centralized bounds for custom slider inputs', async () => {
      // Negative budget rejected by schema
      const negBudgetRes = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          problem_id: 'PRB-2026-0819',
          scenario_name: 'Negative Budget Test',
          intervention_type: InterventionType.CAPACITY_BOOST,
          additional_budget_inr: -50000,
          extra_crews: 2,
          population_relief_rate: 0.5,
          response_time_reduction_hours: 0
        });
      expect(negBudgetRes.status).toBe(400);

      // Population relief rate > 1.0 rejected by schema
      const excessReliefRes = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          problem_id: 'PRB-2026-0819',
          scenario_name: 'Excess Relief Test',
          intervention_type: InterventionType.CAPACITY_BOOST,
          additional_budget_inr: 100000,
          extra_crews: 2,
          population_relief_rate: 1.5,
          response_time_reduction_hours: 0
        });
      expect(excessReliefRes.status).toBe(400);

      // Extra crews > MAX_EXTRA_CREWS (10) rejected by schema
      const excessCrewsRes = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          problem_id: 'PRB-2026-0819',
          scenario_name: 'Excess Crews Test',
          intervention_type: InterventionType.CAPACITY_BOOST,
          additional_budget_inr: 100000,
          extra_crews: 15,
          population_relief_rate: 0.5,
          response_time_reduction_hours: 0
        });
      expect(excessCrewsRes.status).toBe(400);
    });
  });

  describe('5. RBAC & Department Scoping', () => {
    it('blocks Citizen users with HTTP 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-citizen')
        .send({
          problem_id: 'PRB-2026-0819',
          scenario_name: 'Citizen Attempt',
          intervention_type: InterventionType.EMERGENCY_DISPATCH,
          additional_budget_inr: 100000,
          extra_crews: 1,
          population_relief_rate: 0.5,
          response_time_reduction_hours: 0
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows WATCO Department Officer to simulate WATCO problems', async () => {
      const res = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          problem_id: 'PRB-2026-0819', // WATCO problem
          scenario_name: 'WATCO Officer Scenario',
          intervention_type: InterventionType.CAPACITY_BOOST,
          additional_budget_inr: 200000,
          extra_crews: 2,
          population_relief_rate: 0.8,
          response_time_reduction_hours: 2
        });

      expect(res.status).toBe(200);
      expect(res.body.data.is_simulated).toBe(true);
      expect(res.body.data.problem_id).toBe('PRB-2026-0819');
    });

    it('blocks WATCO Department Officer from simulating cross-department problems', async () => {
      const db = getDatabaseProvider();
      await db.createProblemCluster({
        id: 'PRB-SIM-EXTERNAL-01',
        title: 'External Department Test Incident',
        description: 'Test incident under external jurisdiction',
        category: 'sanitation',
        department_id: 'EXTERNAL_DEPT',
        ward_id: 'WARD-001',
        location: { lat: 20.2961, lng: 85.8245 },
        status: ProblemStatus.NEW,
        signal_count: 5,
        supporting_media_count: 1,
        estimated_population: 500,
        duration_days: 1,
        severity_score: 10,
        population_score: 10,
        duration_score: 10,
        concentration_score: 10,
        critical_exposure_score: 5,
        recurrence_score: 5,
        evidence_score: 5,
        impact_score: 40,
        impact_level: ImpactLevel.MEDIUM,
        confidence: 0.9,
        first_detected_at: '2026-09-01T00:00:00Z',
        last_updated_at: '2026-09-01T00:00:00Z',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z'
      });

      const res = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-dept-watco')
        .send({
          problem_id: 'PRB-SIM-EXTERNAL-01',
          scenario_name: 'Cross Dept Attempt',
          intervention_type: InterventionType.CAPACITY_BOOST,
          additional_budget_inr: 200000,
          extra_crews: 2,
          population_relief_rate: 0.8,
          response_time_reduction_hours: 2
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('not authorized to simulate interventions for department');
    });

    it('allows Admin to simulate any problem and citywide budget allocations', async () => {
      const res = await request(app)
        .post('/api/v1/simulations/budget-allocation')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          total_budget_inr: 1000000
        });

      expect(res.status).toBe(200);
      expect(res.body.data.is_simulated).toBe(true);
      expect(res.body.data.total_budget_inr).toBe(1000000);
      expect(res.body.data.contingency_buffer_inr).toBe(80000); // 8% buffer
      expect(res.body.data.allocations.length).toBeGreaterThanOrEqual(1);
    });

    it('verifies exact mathematical properties of the ₹10,00,000 citywide budget optimizer with 8% buffer', async () => {
      const res = await request(app)
        .post('/api/v1/simulations/budget-allocation')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          total_budget_inr: 1000000
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.is_simulated).toBe(true);
      expect(data.total_budget_inr).toBe(1000000);
      expect(data.contingency_buffer_inr).toBe(80000); // exactly 8% of 10L
      const allocatable = data.total_budget_inr - data.contingency_buffer_inr; // 9,20,000
      expect(allocatable).toBe(920000);
      expect(data.allocated_budget_inr).toBeLessThanOrEqual(allocatable);

      let sumAllocated = 0;
      for (const item of data.allocations) {
        expect(item.is_synthetic_cost).toBe(true);
        expect(item.allocated_budget_inr).toBeGreaterThan(0);
        expect(item.relieved_population).toBeGreaterThan(0);
        expect(item.impact_delta).toBeLessThan(0);
        sumAllocated += item.allocated_budget_inr;
      }
      expect(data.allocated_budget_inr).toBe(sumAllocated);
      expect(data.assumptions.length).toBeGreaterThan(0);
    });
  });

  describe('6. Preset Scenarios API Endpoint', () => {
    it('returns the three Golden Demo presets for PRB-2026-0819', async () => {
      const res = await request(app)
        .get('/api/v1/simulations/presets/PRB-2026-0819')
        .set('Authorization', 'Bearer demo-token-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.problem.id).toBe('PRB-2026-0819');
      expect(res.body.data.presets).toHaveLength(3);
      expect(res.body.data.presets[0].scenario_name).toContain('Scenario A');
      expect(res.body.data.presets[1].scenario_name).toContain('Scenario B');
      expect(res.body.data.presets[2].scenario_name).toContain('Scenario C');
    });
  });

  describe('7. AI Provider Fallback', () => {
    it('returns valid deterministic simulation even if the AI explanation provider fails', async () => {
      const mockAI = new MockSimulationAIProvider();
      mockAI.simulateFailure(true);
      ProviderContainer.setSimulationProvider(mockAI);

      const res = await request(app)
        .post('/api/v1/simulations/problem')
        .set('Authorization', 'Bearer demo-token-admin')
        .send({
          problem_id: 'PRB-2026-0819',
          scenario_name: 'Fallback Test',
          intervention_type: InterventionType.CAPACITY_BOOST,
          additional_budget_inr: 420000,
          extra_crews: 2,
          population_relief_rate: 0.95,
          response_time_reduction_hours: 0,
          include_facility_mitigation: true
        });

      expect(res.status).toBe(200);
      expect(res.body.data.is_simulated).toBe(true);
      expect(res.body.data.projected.impact_score).toBe(43);
      expect(res.body.data.ai_explanation).toBeDefined();
      expect(res.body.data.ai_explanation.summary).toContain('Deterministic simulation projects');
    });
  });
});
