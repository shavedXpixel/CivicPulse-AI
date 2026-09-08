import crypto from 'crypto';
import {
  UserProfile,
  UserRole,
  ProblemCluster,
  ProblemClusterDetail,
  ProblemClusterMember,
  ProblemStatus,
  ProblemFilterQuery,
  CreateProblemClusterInput,
  ERROR_CODES,
  AppError,
  SignalStatus,
  ClusterRelationshipType
} from '@civicpulse/shared';
import { ProblemRepository } from './problem.repository';
import { SignalRepository } from '../signals/signal.repository';
import { impactService } from '../impact/impact.service';
import { clusteringService } from '../clustering/clustering.service';
import { calculateSignalRelationship } from '../clustering/similarity.math';

export class ProblemService {
  constructor(
    private readonly problemRepo: ProblemRepository = new ProblemRepository(),
    private readonly signalRepo: SignalRepository = new SignalRepository()
  ) {}

  async listProblems(
    _user: UserProfile,
    query: ProblemFilterQuery
  ): Promise<{ data: ProblemCluster[]; nextCursor?: string }> {
    return this.problemRepo.list(query);
  }

  async getProblem(_user: UserProfile, id: string): Promise<ProblemCluster> {
    const problem = await this.problemRepo.findById(id);
    if (!problem) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Problem cluster not found: ${id}`
      });
    }
    return problem;
  }

  async getProblemDetails(_user: UserProfile, id: string): Promise<ProblemClusterDetail> {
    const problem = await this.getProblem(_user, id);
    const members = await this.problemRepo.getMembers(id);

    // Hydrate member signals if not already present
    const hydratedMembers: ProblemClusterMember[] = await Promise.all(
      members.map(async (m) => {
        if (!m.signal) {
          const signal = await this.signalRepo.findById(m.signal_id);
          if (signal) {
            return { ...m, signal };
          }
        }
        return m;
      })
    );

    // Build timeline milestones
    const timeline: NonNullable<ProblemClusterDetail['timeline']> = [
      {
        id: 'tl_1',
        timestamp: problem.first_detected_at,
        action: 'Incident Clustering',
        actor: 'Civic Intelligence Engine',
        description: `Correlated citizen signals into cluster ${problem.id} based on spatial & semantic similarity.`,
        isCompleted: true,
        isCurrent: false
      },
      {
        id: 'tl_2',
        timestamp: problem.created_at,
        action: 'Impact Assessed',
        actor: 'CivicPulse Impact Engine',
        description: problem.impact_explanation || `Calculated 7-factor impact score of ${problem.impact_score}/100 (${problem.impact_level}).`,
        isCompleted: true,
        isCurrent: false
      }
    ];

    if (problem.status !== ProblemStatus.NEW) {
      timeline.push({
        id: 'tl_3',
        timestamp: problem.last_updated_at,
        action: 'Incident Status',
        actor: problem.department_id ? `${problem.department_id} Control Room` : 'Operations Hub',
        description: `Current operational status: ${problem.status}.`,
        isCompleted: problem.status === ProblemStatus.RESOLVED || problem.status === ProblemStatus.CLOSED,
        isCurrent: problem.status === ProblemStatus.IN_PROGRESS || problem.status === ProblemStatus.TRIAGED
      });
    }

    return {
      ...problem,
      members: hydratedMembers,
      timeline
    };
  }

  async getProblemSignals(
    _user: UserProfile,
    id: string
  ): Promise<ProblemClusterMember[]> {
    await this.getProblem(_user, id); // verify exists
    const members = await this.problemRepo.getMembers(id);

    return Promise.all(
      members.map(async (m) => {
        if (!m.signal) {
          const signal = await this.signalRepo.findById(m.signal_id);
          if (signal) {
            return { ...m, signal };
          }
        }
        return m;
      })
    );
  }

  async createProblem(
    user: UserProfile,
    input: CreateProblemClusterInput
  ): Promise<ProblemCluster> {
    // CRITICAL GUARDRAIL: Citizens cannot create official ProblemCluster records
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not authorized to create official government problem clusters.'
      });
    }

    const now = new Date().toISOString();
    const problemId = `PRB-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    // Initial draft cluster
    const clusterDraft: ProblemCluster = {
      id: problemId,
      title: input.title,
      description: input.description,
      category: input.category,
      department_id: input.department_id, // Pre-seeded reference metadata if provided
      ward_id: input.ward_id,
      location: input.location,
      status: ProblemStatus.TRIAGED,
      signal_count: input.signal_ids?.length || 0,
      severity_score: 15,
      population_score: 10,
      duration_score: 5,
      concentration_score: input.signal_ids && input.signal_ids.length > 5 ? 10 : 5,
      critical_exposure_score: 0,
      recurrence_score: 5,
      evidence_score: 3,
      impact_score: 48,
      impact_level: impactService.calculate({
        severity_score: 15,
        population_score: 10,
        duration_score: 5,
        concentration_score: input.signal_ids && input.signal_ids.length > 5 ? 10 : 5,
        critical_exposure_score: 0,
        recurrence_score: 5,
        evidence_score: 3
      }).impact_level,
      first_detected_at: now,
      last_updated_at: now,
      created_at: now,
      updated_at: now
    };

    const created = await this.problemRepo.create(clusterDraft);

    // Link any initial member signals
    if (input.signal_ids && input.signal_ids.length > 0) {
      for (const sigId of input.signal_ids) {
        const signal = await this.signalRepo.findById(sigId);
        if (signal) {
          const member: ProblemClusterMember = {
            id: `mem_${crypto.randomUUID().substring(0, 8)}`,
            problem_id: created.id,
            signal_id: signal.id,
            relationship: ClusterRelationshipType.DUPLICATE,
            similarity: 0.90,
            reason: 'Explicit initial signal cluster assignment.',
            created_at: now
          };
          await this.problemRepo.addMember(member);
          // Preserve original signal data, only update status & link
          await this.signalRepo.update(signal.id, {
            status: SignalStatus.ATTACHED_TO_PROBLEM,
            problem_cluster_id: created.id,
            updated_at: now
          });
        }
      }

      // Re-derive impact after adding members
      const members = await this.problemRepo.getMembers(created.id);
      const derived = impactService.derive(created, members);
      const calc = impactService.calculate(derived);

      return this.problemRepo.update(created.id, {
        signal_count: members.length,
        ...calc.components,
        impact_score: calc.impact_score,
        impact_level: calc.impact_level,
        impact_explanation: calc.impact_explanation
      });
    }

    return created;
  }

  async recalculateImpact(
    user: UserProfile,
    problemId: string
  ): Promise<ProblemCluster> {
    // Both government officers and admins can trigger recalculation
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not authorized to trigger government impact recalculation.'
      });
    }

    const problem = await this.getProblem(user, problemId);
    const members = await this.problemRepo.getMembers(problemId);

    // SECURITY: Factors are derived purely from stored database records
    const derivedFactors = impactService.derive(problem, members);
    const impactResult = impactService.calculate(derivedFactors);

    const updated = await this.problemRepo.update(problemId, {
      ...impactResult.components,
      impact_score: impactResult.impact_score,
      impact_level: impactResult.impact_level,
      impact_explanation: impactResult.impact_explanation,
      last_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return updated;
  }

  async clusterSignal(
    user: UserProfile,
    problemId: string,
    signalId: string
  ): Promise<{ problem: ProblemCluster; member: ProblemClusterMember }> {
    if (user.role === UserRole.CITIZEN) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Citizens are not authorized to manually cluster signals.'
      });
    }

    const problem = await this.getProblem(user, problemId);
    const signal = await this.signalRepo.findById(signalId);
    if (!signal) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Signal not found: ${signalId}`
      });
    }

    const rel = calculateSignalRelationship(signal, {
      ...signal,
      category: problem.category,
      ward_id: problem.ward_id,
      location: problem.location
    }, 0.85);

    const now = new Date().toISOString();
    const member: ProblemClusterMember = {
      id: `mem_${crypto.randomUUID().substring(0, 8)}`,
      problem_id: problem.id,
      signal_id: signal.id,
      relationship: rel.relationship,
      similarity: rel.relationship_score,
      reason: rel.reason,
      created_at: now
    };

    await this.problemRepo.addMember(member);

    // Preserve original signal data untouched
    await this.signalRepo.update(signal.id, {
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      problem_cluster_id: problem.id,
      updated_at: now
    });

    const members = await this.problemRepo.getMembers(problem.id);
    const derived = impactService.derive(problem, members);
    const calc = impactService.calculate(derived);

    const updatedProblem = await this.problemRepo.update(problem.id, {
      signal_count: (problem.signal_count || 0) + 1,
      last_updated_at: now,
      updated_at: now,
      ...calc.components,
      impact_score: calc.impact_score,
      impact_level: calc.impact_level,
      impact_explanation: calc.impact_explanation
    });

    return { problem: updatedProblem, member };
  }
}

export const problemService = new ProblemService();
