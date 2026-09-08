import { ProblemCluster, ProblemClusterMember } from '@civicpulse/shared';
import { getDatabaseProvider, ProblemFilterCriteria } from '../../providers';

export class ProblemRepository {
  private get db() {
    return getDatabaseProvider();
  }

  async create(problem: ProblemCluster): Promise<ProblemCluster> {
    return this.db.createProblemCluster(problem);
  }

  async findById(id: string): Promise<ProblemCluster | null> {
    return this.db.getProblemCluster(id);
  }

  async update(id: string, updates: Partial<ProblemCluster>): Promise<ProblemCluster> {
    return this.db.updateProblemCluster(id, updates);
  }

  async list(filter: ProblemFilterCriteria): Promise<{ data: ProblemCluster[]; nextCursor?: string }> {
    return this.db.listProblemClusters(filter);
  }

  async addMember(member: ProblemClusterMember): Promise<ProblemClusterMember> {
    return this.db.addProblemClusterMember(member);
  }

  async getMembers(problemId: string): Promise<ProblemClusterMember[]> {
    return this.db.getProblemClusterMembers(problemId);
  }

  async getSignalMemberships(signalId: string): Promise<ProblemClusterMember[]> {
    return this.db.getSignalClusterMemberships(signalId);
  }
}
