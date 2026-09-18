import crypto from 'crypto';
import {
  Signal,
  SignalStatus,
  SignalProcessingStatus,
  ProblemCluster,
  ProblemClusterMember,
  ClusterRelationshipType,
  ProblemStatus,
  ImpactLevel
} from '@civicpulse/shared';
import { getAIProvider } from '../../providers';
import { ProblemRepository } from '../problems/problem.repository';
import { SignalRepository } from '../signals/signal.repository';
import { calculateSignalRelationship, cosineSimilarity } from './similarity.math';
import { impactService } from '../impact/impact.service';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface ClusterMatchResult {
  matched: boolean;
  isNewCluster?: boolean;
  problem?: ProblemCluster;
  member?: ProblemClusterMember;
  relationship?: ClusterRelationshipType;
  score?: number;
  reason?: string;
}

export class ClusteringService {
  constructor(
    private readonly problemRepo: ProblemRepository = new ProblemRepository(),
    private readonly signalRepo: SignalRepository = new SignalRepository()
  ) {}

  private get aiProvider() {
    return getAIProvider();
  }

  /**
   * Evaluates a signal against existing candidate problem clusters using
   * filter-first candidate retrieval and deterministic relationship scoring.
   * If a match (>= 0.70) is found, attaches the signal as an auditable cluster member,
   * updates the signal status to ATTACHED_TO_PROBLEM while preserving all original signal fields.
   * If no match is found and options.autoCreate is true, creates a new ProblemCluster seeded by this signal.
   */
  async clusterSignal(
    signalId: string,
    options?: { autoCreate?: boolean; failOnEmbeddingError?: boolean }
  ): Promise<ClusterMatchResult> {
    const signal = await this.signalRepo.findById(signalId);
    if (!signal) {
      throw new Error(`Signal not found: ${signalId}`);
    }

    if (signal.processing_status !== SignalProcessingStatus.COMPLETED) {
      throw new AppError({
        statusCode: 400,
        code: 'SIGNAL_AI_INCOMPLETE',
        message: `Cannot cluster signal ${signalId}: AI analysis has not completed (status: ${signal.processing_status}).`
      });
    }

    // 1. Generate or retrieve embedding for signal text
    let signalEmbedding: number[];
    try {
      const textToEmbed = signal.normalized_text || signal.original_text || '';
      signalEmbedding = await this.aiProvider.generateEmbedding(
        `${signal.category || ''}: ${textToEmbed}`
      );
    } catch (err: any) {
      if (options?.failOnEmbeddingError) {
        throw new AppError({
          statusCode: 502,
          code: 'EMBEDDING_FAILED',
          message: `Semantic vector embedding generation failed: ${err.message || 'Unknown error'}`
        });
      }
      // Fallback zero vector if embedding service is unavailable and failOnEmbeddingError is not true
      signalEmbedding = [];
    }

    // 2. Filter-first candidate search: retrieve active problems matching category or ward
    const candidateProblems = await this.problemRepo.list({
      category: signal.category || undefined,
      ward_id: signal.ward_id || undefined,
      limit: 20
    });

    // If no exact category/ward candidates, look across recent active clusters
    const candidates = candidateProblems.data.length > 0
      ? candidateProblems.data
      : (await this.problemRepo.list({ limit: 10 })).data;

    let bestMatch: {
      problem: ProblemCluster;
      relationship: ClusterRelationshipType;
      score: number;
      reason: string;
    } | null = null;

    for (const candidate of candidates) {
      const members = await this.problemRepo.getMembers(candidate.id);
      
      // Compare against problem centroid if available, or representative member signals
      if (candidate.centroid_embedding && candidate.centroid_embedding.length > 0 && signalEmbedding.length > 0) {
        const cosSim = cosineSimilarity(signalEmbedding, candidate.centroid_embedding);
        const dummyRefSignal: Signal = {
          ...signal,
          id: `ref_${candidate.id}`,
          category: candidate.category,
          ward_id: candidate.ward_id,
          location: candidate.location
        };
        const rel = calculateSignalRelationship(signal, dummyRefSignal, cosSim);
        if (rel.is_match && (!bestMatch || rel.relationship_score > bestMatch.score)) {
          bestMatch = {
            problem: candidate,
            relationship: rel.relationship,
            score: rel.relationship_score,
            reason: rel.reason
          };
        }
      }

      // Also evaluate against actual member signals in this problem
      const sampleMembers = members.slice(0, 5);
      for (const mem of sampleMembers) {
        let memSignal = mem.signal;
        if (!memSignal) {
          const found = await this.signalRepo.findById(mem.signal_id);
          if (found) memSignal = found;
        }

        if (memSignal) {
          let memEmbedding: number[] = [];
          try {
            memEmbedding = await this.aiProvider.generateEmbedding(
              `${memSignal.category || ''}: ${memSignal.original_text}`
            );
          } catch {
            memEmbedding = [];
          }

          const cosSim = (signalEmbedding.length > 0 && memEmbedding.length > 0)
            ? cosineSimilarity(signalEmbedding, memEmbedding)
            : 0.6; // Baseline if no embeddings

          const rel = calculateSignalRelationship(signal, memSignal, cosSim);
          if (rel.is_match && (!bestMatch || rel.relationship_score > bestMatch.score)) {
            bestMatch = {
              problem: candidate,
              relationship: rel.relationship,
              score: rel.relationship_score,
              reason: rel.reason
            };
          }
        }
      }
    }

    // If no candidate reached the relationship threshold (>= 0.70)
    if (!bestMatch) {
      if (options?.autoCreate) {
        const { problem, member } = await this.createClusterFromSignal(signalId, {
          failOnEmbeddingError: options?.failOnEmbeddingError
        });
        return {
          matched: true,
          isNewCluster: true,
          problem,
          member,
          relationship: ClusterRelationshipType.DUPLICATE,
          score: 1.0,
          reason: 'Created new problem cluster as no existing problem cluster met relationship threshold (>= 0.70).'
        };
      }

      return {
        matched: false,
        reason: 'No existing problem cluster met the relationship threshold (score >= 0.70).'
      };
    }

    // 3. Attach signal as ProblemClusterMember
    const member: ProblemClusterMember = {
      id: `mem_${crypto.randomUUID().substring(0, 8)}`,
      problem_id: bestMatch.problem.id,
      signal_id: signal.id,
      relationship: bestMatch.relationship,
      similarity: bestMatch.score,
      reason: bestMatch.reason,
      created_at: new Date().toISOString()
    };
    await this.problemRepo.addMember(member);

    // 4. CRITICAL: Preserve all original citizen signal data without mutation
    // Only update status and link to problem cluster
    await this.signalRepo.update(signal.id, {
      status: SignalStatus.ATTACHED_TO_PROBLEM,
      problem_cluster_id: bestMatch.problem.id,
      updated_at: new Date().toISOString()
    });

    // 5. Update problem aggregate count and recalculate impact
    const updatedMembers = await this.problemRepo.getMembers(bestMatch.problem.id);
    const derivedFactors = impactService.derive(bestMatch.problem, updatedMembers);
    const impactCalc = impactService.calculate(derivedFactors);

    const updatedProblem = await this.problemRepo.update(bestMatch.problem.id, {
      signal_count: (bestMatch.problem.signal_count || 0) + 1,
      last_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...impactCalc.components,
      impact_score: impactCalc.impact_score,
      impact_level: impactCalc.impact_level,
      impact_explanation: impactCalc.impact_explanation
    });

    return {
      matched: true,
      isNewCluster: false,
      problem: updatedProblem,
      member,
      relationship: bestMatch.relationship,
      score: bestMatch.score,
      reason: bestMatch.reason
    };
  }

  /**
   * Promotes an unattached signal into a new problem cluster in the database.
   * Derives impact and provenance deterministically without inventing data.
   */
  async createClusterFromSignal(
    signalId: string,
    options?: { customTitle?: string; failOnEmbeddingError?: boolean }
  ): Promise<{ problem: ProblemCluster; member: ProblemClusterMember }> {
    const signal = await this.signalRepo.findById(signalId);
    if (!signal) {
      throw new Error(`Signal not found: ${signalId}`);
    }

    if (signal.processing_status !== SignalProcessingStatus.COMPLETED) {
      throw new AppError({
        statusCode: 400,
        code: 'SIGNAL_AI_INCOMPLETE',
        message: `Cannot create cluster from signal ${signalId}: AI analysis has not completed (status: ${signal.processing_status}).`
      });
    }

    const textForEmbedding = signal.normalized_text || signal.original_text || signal.category || 'Civic issue';
    let signalEmbedding: number[];
    try {
      signalEmbedding = await this.aiProvider.generateEmbedding(
        `${signal.category || ''}: ${textForEmbedding}`
      );
    } catch (err: any) {
      if (options?.failOnEmbeddingError) {
        throw new AppError({
          statusCode: 502,
          code: 'EMBEDDING_FAILED',
          message: `Semantic vector embedding generation failed: ${err.message || 'Unknown error'}`
        });
      }
      signalEmbedding = [];
    }

    const now = new Date().toISOString();
    const problemId = `PRB-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const rawText = signal.normalized_text || signal.original_text || 'Reported civic issue';
    const title =
      options?.customTitle ||
      signal.normalized_text ||
      (rawText.length > 80 ? `${rawText.substring(0, 77)}...` : rawText);

    const description = signal.normalized_text || signal.original_text || title;

    const draftCluster: ProblemCluster = {
      id: problemId,
      title,
      description,
      category: signal.category || 'general_infrastructure',
      department_id: signal.recommended_department || undefined,
      ward_id: signal.ward_id || undefined,
      location: signal.location || undefined,
      centroid_embedding: signalEmbedding.length > 0 ? signalEmbedding : undefined,
      status: ProblemStatus.TRIAGED,
      signal_count: 1,
      severity_score: signal.severity === 'CRITICAL' ? 22 : signal.severity === 'HIGH' ? 18 : 12,
      population_score: 8,
      duration_score: 5,
      concentration_score: 3,
      critical_exposure_score: signal.critical_facility ? 8 : 0,
      recurrence_score: 5,
      evidence_score: signal.media_ids && signal.media_ids.length > 0 ? 4 : 2,
      impact_score: 0,
      impact_level: ImpactLevel.LOW,
      first_detected_at: signal.created_at || now,
      last_updated_at: now,
      created_at: now,
      updated_at: now
    };

    // Real-mode reference data enrichment (ward, census population, facilities)
    if (!env.DEMO_MODE) {
      const { getGeographyProvider, getPopulationProvider, getFacilityProvider } = await import(
        '../../providers'
      );

      // 1. Geography lookup if ward_id not yet resolved on signal
      if (!draftCluster.ward_id && draftCluster.location) {
        const geoProv = getGeographyProvider();
        const wardInfo = await geoProv.getWardByCoordinates(
          draftCluster.location.lat,
          draftCluster.location.lng
        );
        if (wardInfo) {
          draftCluster.ward_id = wardInfo.ward_id;
        }
      }

      // 2. Population lookup for ward
      if (draftCluster.ward_id) {
        const popProv = getPopulationProvider();
        const popEstimate = await popProv.getWardPopulation(draftCluster.ward_id);
        if (popEstimate) {
          draftCluster.estimated_population = popEstimate.population;
        }
      }

      // 3. Proximity facilities lookup (500m radius)
      if (draftCluster.location) {
        const facProv = getFacilityProvider();
        const nearbyFacilities = await facProv.getNearbyFacilities(
          draftCluster.location.lat,
          draftCluster.location.lng,
          500
        );
        if (nearbyFacilities.length > 0 && draftCluster.critical_exposure_score === 0) {
          draftCluster.critical_exposure_score = 8;
        }
      }
    }

    // Calculate initial 7-factor impact
    const derivedFactors = impactService.derive(draftCluster, []);
    const impactCalc = impactService.calculate(derivedFactors);
    const provenance = await impactService.deriveProvenance(draftCluster);

    draftCluster.severity_score = impactCalc.components.severity_score;
    draftCluster.population_score = impactCalc.components.population_score;
    draftCluster.duration_score = impactCalc.components.duration_score;
    draftCluster.concentration_score = impactCalc.components.concentration_score;
    draftCluster.critical_exposure_score = impactCalc.components.critical_exposure_score;
    draftCluster.recurrence_score = impactCalc.components.recurrence_score;
    draftCluster.evidence_score = impactCalc.components.evidence_score;
    draftCluster.impact_score = impactCalc.impact_score;
    draftCluster.impact_level = impactCalc.impact_level;
    draftCluster.impact_explanation = impactCalc.impact_explanation;
    draftCluster.data_provenance = provenance;

    const member: ProblemClusterMember = {
      id: `mem_${crypto.randomUUID().substring(0, 8)}`,
      problem_id: draftCluster.id,
      signal_id: signal.id,
      relationship: ClusterRelationshipType.DUPLICATE,
      similarity: 1.0,
      reason: 'Initial seed signal establishing problem cluster.',
      created_at: now
    };

    const { getDatabaseProvider } = await import('../../providers');
    const db = getDatabaseProvider();
    const result = await db.atomicCreateClusterFromSignal(draftCluster, member, signal.id);

    return result;
  }

  /**
   * Preview candidate matches for a signal without attaching or modifying database records.
   */
  async findCandidatesForSignal(signal: Signal): Promise<Array<{
    problem: ProblemCluster;
    relationship: ClusterRelationshipType;
    score: number;
    reason: string;
  }>> {
    let signalEmbedding: number[] = [];
    try {
      signalEmbedding = await this.aiProvider.generateEmbedding(
        `${signal.category || ''}: ${signal.original_text}`
      );
    } catch {
      signalEmbedding = [];
    }

    const candidateProblems = await this.problemRepo.list({
      category: signal.category || undefined,
      limit: 10
    });

    const matches: Array<{
      problem: ProblemCluster;
      relationship: ClusterRelationshipType;
      score: number;
      reason: string;
    }> = [];

    for (const candidate of candidateProblems.data) {
      const members = await this.problemRepo.getMembers(candidate.id);
      let bestCandidateScore = 0;
      let bestCandidateRel = ClusterRelationshipType.SUPPORTING;
      let bestCandidateReason = '';

      for (const mem of members.slice(0, 3)) {
        let memSignal = mem.signal;
        if (!memSignal) {
          const found = await this.signalRepo.findById(mem.signal_id);
          if (found) memSignal = found;
        }

        if (memSignal) {
          let memEmbedding: number[] = [];
          try {
            memEmbedding = await this.aiProvider.generateEmbedding(
              `${memSignal.category || ''}: ${memSignal.original_text}`
            );
          } catch {
            memEmbedding = [];
          }

          const cosSim = (signalEmbedding.length > 0 && memEmbedding.length > 0)
            ? cosineSimilarity(signalEmbedding, memEmbedding)
            : 0.6;

          const rel = calculateSignalRelationship(signal, memSignal, cosSim);
          if (rel.relationship_score > bestCandidateScore) {
            bestCandidateScore = rel.relationship_score;
            bestCandidateRel = rel.relationship;
            bestCandidateReason = rel.reason;
          }
        }
      }

      if (bestCandidateScore >= 0.70) {
        matches.push({
          problem: candidate,
          relationship: bestCandidateRel,
          score: bestCandidateScore,
          reason: bestCandidateReason
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }
}

export const clusteringService = new ClusteringService();
