import {
  UserProfile,
  CitizenProfile,
  Signal,
  SignalMediaItem,
  AIOperationRecord,
  ProblemCluster,
  ProblemClusterMember,
  Assignment,
  ProblemAction,
  Department,
  DepartmentWorkload,
  ProblemStatus
} from '@civicpulse/shared';

export interface SignalFilterCriteria {
  citizen_id?: string;
  department_id?: string;
  ward_id?: string;
  status?: string;
  category?: string;
  limit: number;
  cursor?: string;
}

export interface ProblemFilterCriteria {
  limit?: number;
  cursor?: string;
  status?: string;
  impact_level?: string;
  min_impact?: number;
  max_impact?: number;
  category?: string;
  department_id?: string;
  ward_id?: string;
  sort?: string;
  search?: string;
}

export interface IDatabaseProvider {
  // Users & Profiles
  getUser(id: string): Promise<UserProfile | null>;
  createUser(user: UserProfile): Promise<UserProfile>;
  getCitizenProfile(userId: string): Promise<CitizenProfile | null>;
  createCitizenProfile(profile: CitizenProfile): Promise<CitizenProfile>;

  // Signals
  createSignal(signal: Signal): Promise<Signal>;
  getSignal(id: string): Promise<Signal | null>;
  updateSignal(id: string, updates: Partial<Signal>): Promise<Signal>;
  listSignals(filter: SignalFilterCriteria): Promise<{ data: Signal[]; nextCursor?: string }>;

  // Signal Media
  createSignalMedia(media: SignalMediaItem): Promise<SignalMediaItem>;
  getSignalMedia(signalId: string): Promise<SignalMediaItem[]>;
  attachMediaToSignal(signalId: string, mediaId: string): Promise<void>;

  // AI Operations
  createAIOperation(op: AIOperationRecord): Promise<AIOperationRecord>;
  getAIOperations(entityId: string): Promise<AIOperationRecord[]>;

  // Problem Clusters
  createProblemCluster(problem: ProblemCluster): Promise<ProblemCluster>;
  getProblemCluster(id: string): Promise<ProblemCluster | null>;
  updateProblemCluster(id: string, updates: Partial<ProblemCluster>): Promise<ProblemCluster>;
  listProblemClusters(filter: ProblemFilterCriteria): Promise<{ data: ProblemCluster[]; nextCursor?: string }>;

  // Cluster Members
  addProblemClusterMember(member: ProblemClusterMember): Promise<ProblemClusterMember>;
  getProblemClusterMembers(problemId: string): Promise<ProblemClusterMember[]>;
  getSignalClusterMemberships(signalId: string): Promise<ProblemClusterMember[]>;

  // Workflow, Assignments & Actions
  createAssignment(assignment: Assignment): Promise<Assignment>;
  getAssignments(problemId: string): Promise<Assignment[]>;
  listAssignments(filter: { department_id?: string; assigned_to?: string; status?: string }): Promise<Assignment[]>;
  createAction(action: ProblemAction): Promise<ProblemAction>;
  getActions(problemId: string): Promise<ProblemAction[]>;

  // Departments & Workload
  listDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | null>;
  getDepartmentWorkload(id: string): Promise<DepartmentWorkload>;
  listDepartmentOfficers(departmentId: string): Promise<UserProfile[]>;

  // Atomic Workflow Mutations (Concurrency & State Integrity)
  atomicAssignProblem(
    problemId: string,
    assignment: Assignment,
    nextStatus: ProblemStatus,
    action: ProblemAction
  ): Promise<{ problem: ProblemCluster; assignment: Assignment; action: ProblemAction }>;

  atomicTransitionStatus(
    problemId: string,
    expectedCurrentStatus: ProblemStatus,
    nextStatus: ProblemStatus,
    action: ProblemAction,
    updates?: Partial<ProblemCluster>
  ): Promise<{ problem: ProblemCluster; action: ProblemAction }>;

  // Resolution Evidence & Verification (Phase 6)
  createResolutionEvidence(evidence: import('@civicpulse/shared').ResolutionEvidence): Promise<import('@civicpulse/shared').ResolutionEvidence>;
  getResolutionEvidence(problemId: string): Promise<import('@civicpulse/shared').ResolutionEvidence[]>;
  getEvidenceById(id: string): Promise<import('@civicpulse/shared').ResolutionEvidence | null>;
  updateResolutionEvidence(
    id: string,
    updates: Partial<import('@civicpulse/shared').ResolutionEvidence>
  ): Promise<import('@civicpulse/shared').ResolutionEvidence>;
  createVerificationResult(result: import('@civicpulse/shared').VerificationResult): Promise<import('@civicpulse/shared').VerificationResult>;
  getVerificationHistory(problemId: string): Promise<import('@civicpulse/shared').VerificationResult[]>;
  getLatestVerification(evidenceId: string): Promise<import('@civicpulse/shared').VerificationResult | null>;
}



