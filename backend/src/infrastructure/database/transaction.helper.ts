import { Pool, PoolClient } from 'pg';
import { ProblemStatus, EvidenceStatus, SignalStatus, AppError, ERROR_CODES } from '@civicpulse/shared';

/**
 * Phase 15B.1 — PostgreSQL Transaction Foundation
 * Establishes pessimistic row-locking semantics (SELECT ... FOR UPDATE) inside
 * strict ACID transaction blocks (BEGIN ... COMMIT/ROLLBACK) for CivicPulse AI.
 */
export class PostgresTransactionHelper {
  /**
   * Executes a callback within a managed PostgreSQL transaction with automatic rollback on error.
   */
  public static async withTransaction<T>(
    pool: Pool,
    operation: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Template for atomicAssignProblem:
   * Acquires row-level lock on problem_clusters, verifies expected status,
   * updates problem, inserts assignment, and inserts problem_action.
   */
  public static async executeAtomicAssignProblem(
    client: PoolClient,
    params: {
      problemId: string;
      expectedCurrentStatus?: ProblemStatus;
      nextStatus: ProblemStatus;
      departmentId: string;
      assignedTo?: string;
      assignmentRecord: any;
      actionRecord: any;
    }
  ): Promise<void> {
    const { rows } = await client.query(
      'SELECT id, status FROM problem_clusters WHERE id = $1 FOR UPDATE',
      [params.problemId]
    );

    if (rows.length === 0) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${params.problemId} not found.`
      });
    }

    const current = rows[0];
    if (params.expectedCurrentStatus && current.status !== params.expectedCurrentStatus) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `Assignment state transition conflict: expected ${params.expectedCurrentStatus}, but persisted state is ${current.status}.`
      });
    }

    const now = new Date().toISOString();
    await client.query(
      `UPDATE problem_clusters 
       SET department_id = $1, assigned_to = $2, assigned_at = $3, status = $4, updated_at = $5
       WHERE id = $6`,
      [params.departmentId, params.assignedTo || null, now, params.nextStatus, now, params.problemId]
    );

    // Insert assignment and action in the same atomic transaction
    await client.query(
      `INSERT INTO assignments (id, problem_id, department_id, assigned_to, assigned_by, priority, status, notes, assigned_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        params.assignmentRecord.id,
        params.problemId,
        params.departmentId,
        params.assignmentRecord.assigned_to || null,
        params.assignmentRecord.assigned_by,
        params.assignmentRecord.priority,
        params.assignmentRecord.status,
        params.assignmentRecord.notes || null,
        params.assignmentRecord.assigned_at || now,
        now,
        now
      ]
    );

    await client.query(
      `INSERT INTO problem_actions (id, problem_id, actor_type, actor_user_id, system_actor_id, actor_role, action_type, previous_state, new_state, target_department_id, target_officer_id, note, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        params.actionRecord.id,
        params.problemId,
        params.actionRecord.actor_type || 'USER',
        params.actionRecord.actor_user_id || null,
        params.actionRecord.system_actor_id || null,
        params.actionRecord.actor_role,
        params.actionRecord.action_type,
        params.actionRecord.previous_state || null,
        params.actionRecord.new_state || null,
        params.actionRecord.target_department_id || null,
        params.actionRecord.target_officer_id || null,
        params.actionRecord.note || null,
        params.actionRecord.metadata ? JSON.stringify(params.actionRecord.metadata) : null,
        now
      ]
    );
  }

  /**
   * Template for atomicTransitionStatus:
   * Acquires row-level lock on problem_clusters, verifies expectedCurrentStatus,
   * updates status & timestamp, and inserts problem_action.
   */
  public static async executeAtomicTransitionStatus(
    client: PoolClient,
    params: {
      problemId: string;
      expectedCurrentStatus: ProblemStatus;
      nextStatus: ProblemStatus;
      actionRecord: any;
      updates?: Record<string, any>;
    }
  ): Promise<void> {
    const { rows } = await client.query(
      'SELECT id, status FROM problem_clusters WHERE id = $1 FOR UPDATE',
      [params.problemId]
    );

    if (rows.length === 0) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${params.problemId} not found.`
      });
    }

    const current = rows[0];
    if (current.status !== params.expectedCurrentStatus) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `State transition conflict: expected current state is ${params.expectedCurrentStatus}, but persisted state is ${current.status}.`
      });
    }

    const now = new Date().toISOString();
    const resolvedAt = params.nextStatus === ProblemStatus.RESOLVED ? now : null;
    const closedAt = params.nextStatus === ProblemStatus.CLOSED ? now : null;

    await client.query(
      `UPDATE problem_clusters 
       SET status = $1, updated_at = $2,
           resolved_at = COALESCE($3, resolved_at),
           closed_at = COALESCE($4, closed_at)
       WHERE id = $5`,
      [params.nextStatus, now, resolvedAt, closedAt, params.problemId]
    );

    await client.query(
      `INSERT INTO problem_actions (id, problem_id, actor_type, actor_user_id, system_actor_id, actor_role, action_type, previous_state, new_state, note, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        params.actionRecord.id,
        params.problemId,
        params.actionRecord.actor_type || 'USER',
        params.actionRecord.actor_user_id || null,
        params.actionRecord.system_actor_id || null,
        params.actionRecord.actor_role,
        params.actionRecord.action_type,
        params.expectedCurrentStatus,
        params.nextStatus,
        params.actionRecord.note || null,
        params.actionRecord.metadata ? JSON.stringify(params.actionRecord.metadata) : null,
        now
      ]
    );
  }

  /**
   * Template for atomicCreateClusterFromSignal:
   * Acquires row-level lock on signal, creates problem_cluster, inserts cluster_member,
   * and updates signal status to ATTACHED_TO_PROBLEM.
   */
  public static async executeAtomicCreateClusterFromSignal(
    client: PoolClient,
    params: {
      problemRecord: any;
      memberRecord: any;
      signalId: string;
    }
  ): Promise<void> {
    const { rows } = await client.query(
      'SELECT id, status FROM signals WHERE id = $1 FOR UPDATE',
      [params.signalId]
    );

    if (rows.length === 0) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Signal ${params.signalId} not found.`
      });
    }

    const now = new Date().toISOString();

    // Insert problem cluster
    await client.query(
      `INSERT INTO problem_clusters (id, title, description, category, subcategory, department_id, ward_id, latitude, longitude, status, signal_count, impact_score, impact_level, first_detected_at, last_updated_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        params.problemRecord.id,
        params.problemRecord.title,
        params.problemRecord.description || null,
        params.problemRecord.category,
        params.problemRecord.subcategory || null,
        params.problemRecord.department_id || null,
        params.problemRecord.ward_id || null,
        params.problemRecord.latitude || null,
        params.problemRecord.longitude || null,
        params.problemRecord.status || ProblemStatus.NEW,
        1,
        params.problemRecord.impact_score || 0.0,
        params.problemRecord.impact_level || 'LOW',
        now,
        now,
        now,
        now
      ]
    );

    // Insert cluster member
    await client.query(
      `INSERT INTO cluster_members (id, problem_id, signal_id, relationship, similarity, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.memberRecord.id,
        params.problemRecord.id,
        params.signalId,
        params.memberRecord.relationship || 'SUPPORTING',
        params.memberRecord.similarity || 1.0,
        params.memberRecord.reason || null,
        now
      ]
    );

    // Update signal status
    await client.query(
      `UPDATE signals 
       SET status = $1, problem_cluster_id = $2, updated_at = $3
       WHERE id = $4`,
      [SignalStatus.ATTACHED_TO_PROBLEM, params.problemRecord.id, now, params.signalId]
    );
  }

  /**
   * Template for atomicReviewResolution:
   * Acquires row-level lock on problem_clusters, verifies AWAITING_VERIFICATION,
   * updates status to RESOLVED/IN_PROGRESS, updates associated evidence, and records action.
   */
  public static async executeAtomicReviewResolution(
    client: PoolClient,
    params: {
      problemId: string;
      decision: 'ACCEPT' | 'REJECT';
      actionRecord: any;
      evidenceIds: string[];
    }
  ): Promise<void> {
    const { rows } = await client.query(
      'SELECT id, status FROM problem_clusters WHERE id = $1 FOR UPDATE',
      [params.problemId]
    );

    if (rows.length === 0) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `ProblemCluster ${params.problemId} not found.`
      });
    }

    const current = rows[0];
    if (current.status !== ProblemStatus.AWAITING_VERIFICATION) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.INVALID_STATE_TRANSITION,
        message: `State transition conflict: expected AWAITING_VERIFICATION, but problem is currently in ${current.status}.`
      });
    }

    const now = new Date().toISOString();
    const nextStatus = params.decision === 'ACCEPT' ? ProblemStatus.RESOLVED : ProblemStatus.IN_PROGRESS;
    const evidenceTargetStatus = params.decision === 'ACCEPT' ? EvidenceStatus.ACCEPTED : EvidenceStatus.REJECTED;

    await client.query(
      `UPDATE problem_clusters
       SET status = $1, updated_at = $2, resolved_at = $3
       WHERE id = $4`,
      [nextStatus, now, params.decision === 'ACCEPT' ? now : null, params.problemId]
    );

    if (params.evidenceIds && params.evidenceIds.length > 0) {
      await client.query(
        `UPDATE resolution_evidence
         SET status = $1, updated_at = $2
         WHERE id = ANY($3::varchar[])`,
        [evidenceTargetStatus, now, params.evidenceIds]
      );
    }

    await client.query(
      `INSERT INTO problem_actions (id, problem_id, actor_type, actor_user_id, system_actor_id, actor_role, action_type, previous_state, new_state, note, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        params.actionRecord.id,
        params.problemId,
        params.actionRecord.actor_type || 'USER',
        params.actionRecord.actor_user_id || null,
        params.actionRecord.system_actor_id || null,
        params.actionRecord.actor_role,
        params.actionRecord.action_type,
        ProblemStatus.AWAITING_VERIFICATION,
        nextStatus,
        params.actionRecord.note || null,
        params.actionRecord.metadata ? JSON.stringify(params.actionRecord.metadata) : null,
        now
      ]
    );
  }
}
