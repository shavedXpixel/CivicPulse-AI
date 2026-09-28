import { Firestore, Query, DocumentSnapshot, Transaction } from 'firebase-admin/firestore';
import {
  UserProfile,
  UserRole,
  CitizenProfile,
  Signal,
  SignalMediaItem,
  AIOperationRecord,
  ProblemCluster,
  ProblemClusterMember,
  Assignment,
  AssignmentStatus,
  ProblemAction,
  Department,
  DepartmentWorkload,
  ProblemStatus,
  ImpactLevel,
  ResolutionEvidence,
  VerificationResult,
  SignalStatus,
  EvidenceStatus,
  ERROR_CODES,
  AdminAuditRecord
} from '@civicpulse/shared';
import { IDatabaseProvider, SignalFilterCriteria, ProblemFilterCriteria } from './database.interface';
import { AppError } from '../../middleware/error.middleware';
import { getFirestoreDb } from '../../infrastructure/firebase/firebase-admin';

/**
 * Production Firestore database provider for REAL_MODE.
 * Interacts with Firestore collections:
 * - /users
 * - /citizen_profiles
 * - /signals
 * - /signal_media
 * - /ai_operations
 * - /problem_clusters
 * - /cluster_members
 * - /assignments
 * - /problem_actions
 * - /departments
 * - /resolution_evidence
 * - /verification_results
 */
export class FirestoreDatabaseProvider implements IDatabaseProvider {
  private firestoreInstance: Firestore | null = null;

  constructor(firestore?: Firestore) {
    if (firestore) {
      this.firestoreInstance = firestore;
    }
  }

  private get db(): Firestore {
    if (!this.firestoreInstance) {
      this.firestoreInstance = getFirestoreDb();
    }
    return this.firestoreInstance;
  }

  // Users & Profiles
  async getUser(id: string): Promise<UserProfile | null> {
    const snap = await this.db.collection('users').doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as UserProfile;
  }

  async getUserByAuthId(authUserId: string): Promise<UserProfile | null> {
    const snap = await this.db.collection('users').doc(authUserId).get();
    if (!snap.exists) return null;
    return snap.data() as UserProfile;
  }

  async createUser(user: UserProfile): Promise<UserProfile> {
    await this.db.collection('users').doc(user.id).set(user);
    return user;
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const docRef = this.db.collection('users').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `User '${id}' not found.`
      });
    }
    const existing = snap.data() as UserProfile;
    const updated: UserProfile = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString()
    };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  async createAdminAuditLog(record: AdminAuditRecord): Promise<AdminAuditRecord> {
    await this.db.collection('admin_audit_logs').doc(record.id).set(record);
    return record;
  }

  async listAdminAuditLogs(filter?: { target_email?: string; limit?: number }): Promise<AdminAuditRecord[]> {
    let query: Query = this.db.collection('admin_audit_logs');
    if (filter?.target_email) {
      query = query.where('target_email', '==', filter.target_email);
    }
    query = query.orderBy('created_at', 'desc');
    if (filter?.limit) {
      query = query.limit(filter.limit);
    }
    const snap = await query.get();
    return snap.docs.map((doc: DocumentSnapshot) => doc.data() as AdminAuditRecord);
  }

  async listUsers(filter?: { role?: UserRole; department_id?: string }): Promise<UserProfile[]> {
    let query: Query = this.db.collection('users');
    if (filter?.role) {
      query = query.where('role', '==', filter.role);
    }
    if (filter?.department_id) {
      query = query.where('department_id', '==', filter.department_id);
    }
    const snap = await query.get();
    return snap.docs.map((doc: DocumentSnapshot) => doc.data() as UserProfile);
  }

  async getCitizenProfile(userId: string): Promise<CitizenProfile | null> {
    const snap = await this.db.collection('citizen_profiles').doc(userId).get();
    if (!snap.exists) return null;
    return snap.data() as CitizenProfile;
  }

  async createCitizenProfile(profile: CitizenProfile): Promise<CitizenProfile> {
    await this.db.collection('citizen_profiles').doc(profile.user_id).set(profile);
    return profile;
  }

  // Signals
  async createSignal(signal: Signal): Promise<Signal> {
    await this.db.collection('signals').doc(signal.id).set(signal);
    return signal;
  }

  async getSignal(id: string): Promise<Signal | null> {
    const snap = await this.db.collection('signals').doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as Signal;
  }

  async updateSignal(id: string, updates: Partial<Signal>): Promise<Signal> {
    const docRef = this.db.collection('signals').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Signal ${id} not found.`
      });
    }
    const current = snap.data() as Signal;
    const updated: Signal = {
      ...current,
      ...updates,
      updated_at: updates.updated_at || new Date().toISOString()
    };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  async listSignals(filter: SignalFilterCriteria): Promise<{ data: Signal[]; nextCursor?: string }> {
    let query: Query = this.db.collection('signals');

    if (filter.citizen_id) {
      query = query.where('citizen_id', '==', filter.citizen_id);
    }
    if (filter.department_id) {
      query = query.where('department_id', '==', filter.department_id);
    }
    if (filter.ward_id) {
      query = query.where('ward_id', '==', filter.ward_id);
    }
    if (filter.status) {
      query = query.where('status', '==', filter.status);
    }
    if (filter.category) {
      query = query.where('category', '==', filter.category);
    }

    query = query.orderBy('created_at', 'desc');

    if (filter.cursor) {
      const cursorDoc = await this.db.collection('signals').doc(filter.cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    const limit = Math.min(filter.limit || 20, 100);
    query = query.limit(limit + 1);

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (err: any) {
      if (err.message && (err.message.includes('requires an index') || err.code === 9)) {
        let fallbackQuery: Query = this.db.collection('signals');
        if (filter.citizen_id) fallbackQuery = fallbackQuery.where('citizen_id', '==', filter.citizen_id);
        if (filter.department_id) fallbackQuery = fallbackQuery.where('department_id', '==', filter.department_id);
        if (filter.ward_id) fallbackQuery = fallbackQuery.where('ward_id', '==', filter.ward_id);
        if (filter.status) fallbackQuery = fallbackQuery.where('status', '==', filter.status);
        if (filter.category) fallbackQuery = fallbackQuery.where('category', '==', filter.category);
        const fallbackSnap = await fallbackQuery.get();
        const allDocs = fallbackSnap.docs.map((d: DocumentSnapshot) => d.data() as Signal);
        allDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const hasMore = allDocs.length > limit;
        const resultData = hasMore ? allDocs.slice(0, limit) : allDocs;
        const nextCursor = hasMore && resultData.length > 0 ? resultData[resultData.length - 1]!.id : undefined;
        return { data: resultData, nextCursor };
      }
      throw err;
    }

    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;
    const data = resultDocs.map((d: DocumentSnapshot) => d.data() as Signal);
    const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1]!.id : undefined;

    return { data, nextCursor };
  }

  // Signal Media
  async createSignalMedia(media: SignalMediaItem): Promise<SignalMediaItem> {
    await this.db.collection('signal_media').doc(media.id).set(media);
    return media;
  }

  async getSignalMedia(signalId: string): Promise<SignalMediaItem[]> {
    const snap = await this.db.collection('signal_media').where('signal_id', '==', signalId).get();
    return snap.docs.map((d: DocumentSnapshot) => d.data() as SignalMediaItem);
  }

  async getSignalMediaByPath(storagePath: string): Promise<SignalMediaItem | null> {
    const snap = await this.db.collection('signal_media').where('storage_path', '==', storagePath).limit(1).get();
    if (snap.empty || !snap.docs[0]) return null;
    return snap.docs[0].data() as SignalMediaItem;
  }

  async attachMediaToSignal(signalId: string, mediaId: string): Promise<void> {
    const mediaDoc = await this.db.collection('signal_media').doc(mediaId).get();
    if (mediaDoc.exists) {
      await this.db.collection('signal_media').doc(mediaId).set({ signal_id: signalId }, { merge: true });
    }
    const signalDoc = await this.db.collection('signals').doc(signalId).get();
    if (signalDoc.exists) {
      const currentMediaIds: string[] = (signalDoc.data()?.media_ids as string[]) || [];
      if (!currentMediaIds.includes(mediaId)) {
        await this.db.collection('signals').doc(signalId).set(
          { media_ids: [...currentMediaIds, mediaId], updated_at: new Date().toISOString() },
          { merge: true }
        );
      }
    }
  }

  // AI Operations
  async createAIOperation(op: AIOperationRecord): Promise<AIOperationRecord> {
    await this.db.collection('ai_operations').doc(op.id).set(op);
    return op;
  }

  async getAIOperations(entityId: string): Promise<AIOperationRecord[]> {
    const snap = await this.db.collection('ai_operations').where('entity_id', '==', entityId).get();
    return snap.docs
      .map((d: DocumentSnapshot) => d.data() as AIOperationRecord)
      .sort((a: AIOperationRecord, b: AIOperationRecord) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  // Problem Clusters
  async createProblemCluster(problem: ProblemCluster): Promise<ProblemCluster> {
    await this.db.collection('problem_clusters').doc(problem.id).set(problem);
    return problem;
  }

  async getProblemCluster(id: string): Promise<ProblemCluster | null> {
    const snap = await this.db.collection('problem_clusters').doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as ProblemCluster;
  }

  async updateProblemCluster(id: string, updates: Partial<ProblemCluster>): Promise<ProblemCluster> {
    const docRef = this.db.collection('problem_clusters').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${id} not found.`
      });
    }
    const current = snap.data() as ProblemCluster;
    const updated: ProblemCluster = {
      ...current,
      ...updates,
      updated_at: updates.updated_at || new Date().toISOString()
    };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  async listProblemClusters(filter: ProblemFilterCriteria): Promise<{ data: ProblemCluster[]; nextCursor?: string }> {
    const limit = filter.limit || 50;
    let query: Query = this.db.collection('problem_clusters');

    if (filter.status) {
      query = query.where('status', '==', filter.status);
    }
    if (filter.impact_level) {
      query = query.where('impact_level', '==', filter.impact_level);
    }
    if (filter.category) {
      query = query.where('category', '==', filter.category);
    }
    if (filter.department_id) {
      query = query.where('department_id', '==', filter.department_id);
    }
    if (filter.ward_id) {
      query = query.where('ward_id', '==', filter.ward_id);
    }
    if (filter.is_demo !== undefined) {
      query = query.where('is_demo', '==', filter.is_demo);
    }

    if (filter.sort === 'impact_asc') {
      query = query.orderBy('impact_score', 'asc');
    } else if (filter.sort === 'created_desc') {
      query = query.orderBy('created_at', 'desc');
    } else if (filter.sort === 'updated_desc') {
      query = query.orderBy('updated_at', 'desc');
    } else {
      query = query.orderBy('impact_score', 'desc');
    }

    if (filter.cursor) {
      const cursorDoc = await this.db.collection('problem_clusters').doc(filter.cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(limit + 1);

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (err: any) {
      if (err.message && (err.message.includes('requires an index') || err.code === 9)) {
        let fallbackQuery: Query = this.db.collection('problem_clusters');
        if (filter.status) fallbackQuery = fallbackQuery.where('status', '==', filter.status);
        if (filter.impact_level) fallbackQuery = fallbackQuery.where('impact_level', '==', filter.impact_level);
        if (filter.category) fallbackQuery = fallbackQuery.where('category', '==', filter.category);
        if (filter.department_id) fallbackQuery = fallbackQuery.where('department_id', '==', filter.department_id);
        if (filter.ward_id) fallbackQuery = fallbackQuery.where('ward_id', '==', filter.ward_id);

        const fallbackSnap = await fallbackQuery.get();
        let allDocs = fallbackSnap.docs.map((d: DocumentSnapshot) => d.data() as ProblemCluster);

        if (filter.sort === 'impact_asc') {
          allDocs.sort((a, b) => a.impact_score - b.impact_score);
        } else if (filter.sort === 'created_desc') {
          allDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        } else if (filter.sort === 'updated_desc') {
          allDocs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        } else {
          allDocs.sort((a, b) => b.impact_score - a.impact_score);
        }

        if (filter.min_impact !== undefined) {
          allDocs = allDocs.filter((p: ProblemCluster) => p.impact_score >= filter.min_impact!);
        }
        if (filter.max_impact !== undefined) {
          allDocs = allDocs.filter((p: ProblemCluster) => p.impact_score <= filter.max_impact!);
        }
        if (filter.search) {
          const term = filter.search.toLowerCase();
          allDocs = allDocs.filter((p: ProblemCluster) =>
            p.title?.toLowerCase().includes(term) ||
            p.description?.toLowerCase().includes(term) ||
            p.id.toLowerCase().includes(term)
          );
        }

        const hasMore = allDocs.length > limit;
        const resultDocs = hasMore ? allDocs.slice(0, limit) : allDocs;
        const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1]!.id : undefined;

        return { data: resultDocs, nextCursor };
      }
      throw err;
    }

    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    let data = resultDocs.map((d: DocumentSnapshot) => d.data() as ProblemCluster);

    if (filter.min_impact !== undefined) {
      data = data.filter((p: ProblemCluster) => p.impact_score >= filter.min_impact!);
    }
    if (filter.max_impact !== undefined) {
      data = data.filter((p: ProblemCluster) => p.impact_score <= filter.max_impact!);
    }
    if (filter.search) {
      const term = filter.search.toLowerCase();
      data = data.filter((p: ProblemCluster) =>
        p.title?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    }

    const nextCursor = hasMore && resultDocs.length > 0 ? resultDocs[resultDocs.length - 1]!.id : undefined;

    return { data, nextCursor };
  }

  // Cluster Members
  async addProblemClusterMember(member: ProblemClusterMember): Promise<ProblemClusterMember> {
    await this.db.collection('cluster_members').doc(member.id).set(member);
    return member;
  }

  async getProblemClusterMembers(problemId: string): Promise<ProblemClusterMember[]> {
    const snap = await this.db.collection('cluster_members').where('problem_id', '==', problemId).get();
    const members = snap.docs.map((d: DocumentSnapshot) => d.data() as ProblemClusterMember);

    const populated = await Promise.all(
      members.map(async (m: ProblemClusterMember) => {
        if (m.signal_id) {
          const sig = await this.getSignal(m.signal_id);
          return { ...m, signal: sig || undefined };
        }
        return m;
      })
    );
    return populated;
  }

  async getSignalClusterMemberships(signalId: string): Promise<ProblemClusterMember[]> {
    const snap = await this.db.collection('cluster_members').where('signal_id', '==', signalId).get();
    return snap.docs.map((d: DocumentSnapshot) => d.data() as ProblemClusterMember);
  }

  // Workflow, Assignments & Actions
  async createAssignment(assignment: Assignment): Promise<Assignment> {
    await this.db.collection('assignments').doc(assignment.id).set(assignment);
    return assignment;
  }

  async getAssignments(problemId: string): Promise<Assignment[]> {
    const snap = await this.db.collection('assignments').where('problem_id', '==', problemId).get();
    return snap.docs
      .map((d: DocumentSnapshot) => d.data() as Assignment)
      .sort((a: Assignment, b: Assignment) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async listAssignments(filter: { department_id?: string; assigned_to?: string; status?: string }): Promise<Assignment[]> {
    let query: Query = this.db.collection('assignments');
    if (filter.department_id) {
      query = query.where('department_id', '==', filter.department_id);
    }
    if (filter.assigned_to) {
      query = query.where('assigned_to', '==', filter.assigned_to);
    }
    if (filter.status) {
      query = query.where('status', '==', filter.status);
    }
    const snap = await query.get();
    return snap.docs.map((d: DocumentSnapshot) => d.data() as Assignment);
  }

  async createAction(action: ProblemAction): Promise<ProblemAction> {
    await this.db.collection('problem_actions').doc(action.id).set(action);
    return action;
  }

  async getActions(problemId: string): Promise<ProblemAction[]> {
    const snap = await this.db.collection('problem_actions').where('problem_id', '==', problemId).get();
    return snap.docs
      .map((d: DocumentSnapshot) => d.data() as ProblemAction)
      .sort((a: ProblemAction, b: ProblemAction) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  // Departments & Workload
  async listDepartments(): Promise<Department[]> {
    const snap = await this.db.collection('departments').get();
    return snap.docs.map((d: DocumentSnapshot) => d.data() as Department);
  }

  async getDepartment(id: string): Promise<Department | null> {
    const snap = await this.db.collection('departments').doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as Department;
  }

  async createDepartment(department: Department): Promise<Department> {
    await this.db.collection('departments').doc(department.id).set(department);
    return department;
  }

  async getDepartmentWorkload(id: string, options?: { is_demo?: boolean }): Promise<DepartmentWorkload> {
    const dept = await this.getDepartment(id);
    if (!dept) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Department ${id} not found.`
      });
    }

    let query: Query = this.db.collection('problem_clusters').where('department_id', '==', id);
    if (options?.is_demo !== undefined) {
      query = query.where('is_demo', '==', options.is_demo);
    }
    const snap = await query.get();
    const problems = snap.docs.map((d: DocumentSnapshot) => d.data() as ProblemCluster);

    let totalAssigned = 0;
    let activeInProgress = 0;
    let awaitingVerification = 0;
    let criticalOrHigh = 0;
    let slaBreached = 0;
    let slaAtRisk = 0;

    for (const p of problems) {
      // Exclude terminal cases from active workload denominator
      if (p.status === ProblemStatus.RESOLVED || p.status === ProblemStatus.CLOSED) {
        continue;
      }

      totalAssigned++;
      if (p.status === ProblemStatus.IN_PROGRESS) activeInProgress++;
      if (p.status === ProblemStatus.AWAITING_VERIFICATION) awaitingVerification++;
      if (p.impact_level === ImpactLevel.CRITICAL || p.impact_level === ImpactLevel.HIGH) {
        criticalOrHigh++;
      }
      if (p.sla_state?.is_breached || p.sla_state?.status === 'BREACHED') {
        slaBreached++;
      } else if (p.sla_state?.is_at_risk || p.sla_state?.status === 'AT_RISK') {
        slaAtRisk++;
      }
    }

    return {
      department_id: id,
      department_name: dept.name,
      total_assigned: totalAssigned,
      active_in_progress: activeInProgress,
      awaiting_verification: awaitingVerification,
      critical_or_high: criticalOrHigh,
      sla_breached: slaBreached,
      sla_at_risk: slaAtRisk,
      capacity_rating: activeInProgress > 10 ? 'CONGESTED' : activeInProgress > 5 ? 'MODERATE' : 'OPTIMAL'
    };
  }

  async listDepartmentOfficers(departmentId: string): Promise<UserProfile[]> {
    const snap = await this.db
      .collection('users')
      .where('department_id', '==', departmentId)
      .get();
    return snap.docs
      .map((d: DocumentSnapshot) => d.data() as UserProfile)
      .filter((u) => u.role === UserRole.FIELD_OFFICER || u.role === UserRole.DEPARTMENT_OFFICER);
  }

  // Atomic Workflow Mutations
  async atomicAssignProblem(
    problemId: string,
    assignment: Assignment,
    nextStatus: ProblemStatus,
    action: ProblemAction,
    expectedCurrentStatus?: ProblemStatus,
    supersededAssignmentIds?: string[]
  ): Promise<{ problem: ProblemCluster; assignment: Assignment; action: ProblemAction }> {
    const problemRef = this.db.collection('problem_clusters').doc(problemId);
    const assignmentRef = this.db.collection('assignments').doc(assignment.id);
    const actionRef = this.db.collection('problem_actions').doc(action.id);

    return await this.db.runTransaction(async (transaction: Transaction) => {
      const snap = await transaction.get(problemRef);
      if (!snap.exists) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: `ProblemCluster ${problemId} not found.`
        });
      }

      const existing = snap.data() as ProblemCluster;

      // Concurrency precondition check: prevent stale concurrent assignment overwrites
      if (expectedCurrentStatus && existing.status !== expectedCurrentStatus) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.INVALID_STATE_TRANSITION,
          message: `Assignment state transition conflict: expected current state is ${expectedCurrentStatus}, but persisted state is ${existing.status}.`
        });
      }

      // Read any superseded assignments in the transaction (all reads must be before writes)
      const supersededDocs: { ref: any; data: Assignment }[] = [];
      if (supersededAssignmentIds && supersededAssignmentIds.length > 0) {
        for (const supId of supersededAssignmentIds) {
          if (supId !== assignment.id) {
            const supRef = this.db.collection('assignments').doc(supId);
            const supSnap = await transaction.get(supRef);
            if (supSnap.exists) {
              supersededDocs.push({ ref: supRef, data: supSnap.data() as Assignment });
            }
          }
        }
      }

      const now = new Date().toISOString();
      const updatedProblem: ProblemCluster = {
        ...existing,
        department_id: assignment.department_id,
        assigned_to: assignment.assigned_to,
        assigned_at: assignment.assigned_at || now,
        status: nextStatus,
        updated_at: now
      };

      // Supersede prior active assignments
      for (const supDoc of supersededDocs) {
        transaction.set(
          supDoc.ref,
          {
            ...supDoc.data,
            status: AssignmentStatus.CANCELLED,
            completed_at: now,
            ended_at: now,
            updated_at: now,
            notes: supDoc.data.notes
              ? `${supDoc.data.notes} [Superseded by assignment ${assignment.id}]`
              : `Superseded by assignment ${assignment.id}`
          },
          { merge: true }
        );
      }

      transaction.set(problemRef, updatedProblem, { merge: true });
      transaction.set(assignmentRef, assignment);
      transaction.set(actionRef, action);

      return {
        problem: updatedProblem,
        assignment,
        action
      };
    });
  }

  async atomicCreateClusterFromSignal(
    problem: ProblemCluster,
    member: ProblemClusterMember,
    signalId: string
  ): Promise<{ problem: ProblemCluster; member: ProblemClusterMember }> {
    const problemRef = this.db.collection('problem_clusters').doc(problem.id);
    const memberRef = this.db.collection('cluster_members').doc(member.id);
    const signalRef = this.db.collection('signals').doc(signalId);

    return await this.db.runTransaction(async (transaction: Transaction) => {
      const signalSnap = await transaction.get(signalRef);
      if (!signalSnap.exists) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: `Signal ${signalId} not found during cluster creation.`
        });
      }

      const existingSignal = signalSnap.data() as Signal;
      const now = new Date().toISOString();
      const updatedSignal: Signal = {
        ...existingSignal,
        status: SignalStatus.ATTACHED_TO_PROBLEM,
        problem_cluster_id: problem.id,
        updated_at: now
      };

      transaction.set(problemRef, problem);
      transaction.set(memberRef, member);
      transaction.set(signalRef, updatedSignal, { merge: true });

      return { problem, member };
    });
  }

  async atomicReviewResolution(
    problemId: string,
    decision: 'ACCEPT' | 'REJECT',
    action: ProblemAction,
    evidenceIds: string[],
    notes?: string
  ): Promise<{ problem: ProblemCluster; action: ProblemAction; decision: string }> {
    const problemRef = this.db.collection('problem_clusters').doc(problemId);
    const actionRef = this.db.collection('problem_actions').doc(action.id);

    return await this.db.runTransaction(async (transaction: Transaction) => {
      const snap = await transaction.get(problemRef);
      if (!snap.exists) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: `ProblemCluster ${problemId} not found.`
        });
      }

      const existing = snap.data() as ProblemCluster;
      if (existing.status !== ProblemStatus.AWAITING_VERIFICATION) {
        throw new AppError({
          statusCode: 400,
          code: ERROR_CODES.INVALID_STATE_TRANSITION,
          message: `State transition conflict: expected AWAITING_VERIFICATION, but problem is currently in ${existing.status}.`
        });
      }

      const now = new Date().toISOString();
      const nextStatus = decision === 'ACCEPT' ? ProblemStatus.RESOLVED : ProblemStatus.IN_PROGRESS;
      const evidenceTargetStatus = decision === 'ACCEPT' ? EvidenceStatus.ACCEPTED : EvidenceStatus.REJECTED;

      const updatedProblem: ProblemCluster = {
        ...existing,
        status: nextStatus,
        updated_at: now,
        ...(decision === 'ACCEPT' ? { resolved_at: now } : {})
      };

      // Atomically update all associated evidence documents in the same transaction
      for (const evId of evidenceIds) {
        const evRef = this.db.collection('resolution_evidence').doc(evId);
        transaction.set(evRef, { status: evidenceTargetStatus, updated_at: now }, { merge: true });
      }

      transaction.set(problemRef, updatedProblem, { merge: true });
      transaction.set(actionRef, action);

      return {
        problem: updatedProblem,
        action,
        decision
      };
    });
  }

  async atomicTransitionStatus(
    problemId: string,
    expectedCurrentStatus: ProblemStatus,
    nextStatus: ProblemStatus,
    action: ProblemAction,
    updates?: Partial<ProblemCluster>
  ): Promise<{ problem: ProblemCluster; action: ProblemAction }> {
    const problemRef = this.db.collection('problem_clusters').doc(problemId);
    const actionRef = this.db.collection('problem_actions').doc(action.id);

    return await this.db.runTransaction(async (transaction: Transaction) => {
      const snap = await transaction.get(problemRef);
      if (!snap.exists) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: `ProblemCluster ${problemId} not found.`
        });
      }

      const existing = snap.data() as ProblemCluster;
      if (existing.status !== expectedCurrentStatus) {
        throw new AppError({
          statusCode: 409,
          code: ERROR_CODES.CONFLICT,
          message: `State transition conflict: expected current state is ${expectedCurrentStatus}, but persisted state is ${existing.status}.`
        });
      }

      const now = new Date().toISOString();
      const updatedProblem: ProblemCluster = {
        ...existing,
        ...updates,
        status: nextStatus,
        updated_at: now
      };

      if (nextStatus === ProblemStatus.RESOLVED && !updatedProblem.resolved_at) {
        updatedProblem.resolved_at = now;
      }
      if (nextStatus === ProblemStatus.CLOSED && !updatedProblem.closed_at) {
        updatedProblem.closed_at = now;
      }

      transaction.set(problemRef, updatedProblem, { merge: true });
      transaction.set(actionRef, action);

      return {
        problem: updatedProblem,
        action
      };
    });
  }

  // Resolution Evidence & Verification
  async createResolutionEvidence(evidence: ResolutionEvidence): Promise<ResolutionEvidence> {
    await this.db.collection('resolution_evidence').doc(evidence.id).set(evidence);
    return evidence;
  }

  async getResolutionEvidence(problemId: string, options?: { is_demo?: boolean }): Promise<ResolutionEvidence[]> {
    let query: Query = this.db.collection('resolution_evidence').where('problem_id', '==', problemId);
    if (options?.is_demo !== undefined) {
      query = query.where('is_demo', '==', options.is_demo);
    }
    const snap = await query.get();
    return snap.docs.map((d: DocumentSnapshot) => d.data() as ResolutionEvidence);
  }

  async getResolutionEvidenceByPath(storagePath: string): Promise<ResolutionEvidence | null> {
    const snap = await this.db.collection('resolution_evidence').where('storage_path', '==', storagePath).limit(1).get();
    if (snap.empty || !snap.docs[0]) return null;
    return snap.docs[0].data() as ResolutionEvidence;
  }

  async getEvidenceById(id: string): Promise<ResolutionEvidence | null> {
    const snap = await this.db.collection('resolution_evidence').doc(id).get();
    if (!snap.exists) return null;
    return snap.data() as ResolutionEvidence;
  }

  async updateResolutionEvidence(id: string, updates: Partial<ResolutionEvidence>): Promise<ResolutionEvidence> {
    const docRef = this.db.collection('resolution_evidence').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ResolutionEvidence ${id} not found.`
      });
    }
    const current = snap.data() as ResolutionEvidence;
    const updated: ResolutionEvidence = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString()
    };
    await docRef.set(updated, { merge: true });
    return updated;
  }

  async createVerificationResult(result: VerificationResult): Promise<VerificationResult> {
    await this.db.collection('verification_results').doc(result.id).set(result);
    return result;
  }

  async getVerificationHistory(problemId: string): Promise<VerificationResult[]> {
    const snap = await this.db.collection('verification_results').where('problem_id', '==', problemId).get();
    return snap.docs
      .map((d: DocumentSnapshot) => d.data() as VerificationResult)
      .sort((a: VerificationResult, b: VerificationResult) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async getLatestVerification(evidenceId: string): Promise<VerificationResult | null> {
    const snap = await this.db
      .collection('verification_results')
      .where('evidence_id', '==', evidenceId)
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();
    if (snap.empty || !snap.docs[0]) return null;
    return snap.docs[0].data() as VerificationResult;
  }

  async checkReadiness(): Promise<{ ready: boolean; latencyMs: number }> {
    const start = Date.now();
    await this.db.collection('departments').limit(1).get();
    return {
      ready: true,
      latencyMs: Date.now() - start
    };
  }
}
