import { Pool, PoolClient } from 'pg';
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
  ProblemStatus,
  ImpactLevel,
  ResolutionEvidence,
  VerificationResult,
  AppError,
  ERROR_CODES
} from '@civicpulse/shared';
import {
  IDatabaseProvider,
  SignalFilterCriteria,
  ProblemFilterCriteria
} from './database.interface';
import { env } from '../../config/env';

export interface PostgresProviderConfig {
  connectionString?: string;
  pool?: Pool;
  maxConnections?: number;
}

export class PostgresDatabaseProvider implements IDatabaseProvider {
  private pool: Pool | null = null;
  private isExternalPool = false;

  constructor(config?: PostgresProviderConfig) {
    if (config?.pool) {
      this.pool = config.pool;
      this.isExternalPool = true;
    } else {
      const connStr = config?.connectionString || env.DATABASE_URL || process.env.DATABASE_URL;
      if (connStr) {
        this.pool = new Pool({
          connectionString: connStr,
          max: config?.maxConnections || 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000
        });
      }
    }
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new AppError({
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_ERROR,
        message: '[PostgresDatabaseProvider] DATABASE_URL is not configured.'
      });
    }
    return this.pool;
  }

  public async close(): Promise<void> {
    if (this.pool && !this.isExternalPool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const pool = this.getPool();
    const res = await pool.query(sql, params);
    return res.rows;
  }

  /**
   * Helper to execute a callback inside a PostgreSQL transaction.
   */
  public async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Users & Profiles
  // ---------------------------------------------------------------------------

  async getUser(id: string): Promise<UserProfile | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const sql = isUuid
      ? `SELECT * FROM users WHERE id = $1`
      : `SELECT * FROM users WHERE legacy_firebase_uid = $1 OR id::text = $1`;

    const rows = await this.query(sql, [id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.legacy_firebase_uid || r.id,
      email: r.email,
      display_name: r.display_name,
      role: r.role,
      department_id: r.department_id || undefined,
      status: r.status,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    };
  }

  async getUserByAuthId(authUserId: string): Promise<UserProfile | null> {
    const sql = `SELECT * FROM users WHERE auth_user_id = $1`;
    const rows = await this.query(sql, [authUserId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id, // Internal CivicPulse UUID
      email: r.email,
      display_name: r.display_name,
      role: r.role,
      department_id: r.department_id || undefined,
      status: r.status,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    };
  }

  async createUser(user: UserProfile): Promise<UserProfile> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    const legacyUid = isUuid ? null : user.id;
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO users (
        legacy_firebase_uid, email, display_name, role, department_id, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;

    const rows = await this.query(sql, [
      legacyUid,
      user.email,
      user.display_name || user.email,
      user.role,
      user.department_id || null,
      user.status || 'ACTIVE',
      user.created_at || now,
      user.updated_at || now
    ]);

    const r = rows[0];
    return {
      ...user,
      id: r.legacy_firebase_uid || r.id
    };
  }

  async getCitizenProfile(userId: string): Promise<CitizenProfile | null> {
    const sql = `
      SELECT cp.* FROM citizen_profiles cp
      JOIN users u ON u.id = cp.user_id
      WHERE u.id::text = $1 OR u.legacy_firebase_uid = $1;
    `;
    const rows = await this.query(sql, [userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      user_id: userId,
      preferred_language: r.preferred_language,
      notification_enabled: r.notification_enabled,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    };
  }

  async createCitizenProfile(profile: CitizenProfile): Promise<CitizenProfile> {
    // Resolve user's internal UUID
    const uRows = await this.query(
      `SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1;`,
      [profile.user_id]
    );
    if (uRows.length === 0) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `User ${profile.user_id} not found to attach citizen profile.`
      });
    }
    const internalUserId = uRows[0].id;
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO citizen_profiles (
        id, user_id, preferred_language, notification_enabled, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;

    await this.query(sql, [
      profile.id || `prof_${profile.user_id}`,
      internalUserId,
      profile.preferred_language || 'en',
      profile.notification_enabled !== false,
      profile.created_at || now,
      profile.updated_at || now
    ]);

    return profile;
  }

  // ---------------------------------------------------------------------------
  // 2. Signals
  // ---------------------------------------------------------------------------

  async createSignal(signal: Signal): Promise<Signal> {
    const now = new Date().toISOString();
    // Resolve citizen UUID if present
    let citizenInternalUuid = null;
    if (signal.citizen_id) {
      const uRows = await this.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1;`, [signal.citizen_id]);
      if (uRows.length > 0) citizenInternalUuid = uRows[0].id;
    }

    const sql = `
      INSERT INTO signals (
        id, citizen_id, source_type, original_text, normalized_text, category, subcategory,
        recommended_department, severity, language, status, processing_status,
        latitude, longitude, location_reference, ward_id, ai_confidence, ai_analysis,
        geography_provenance, media_ids, legacy_embedding, created_at, submitted_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      ) RETURNING *;
    `;

    await this.query(sql, [
      signal.id,
      citizenInternalUuid,
      signal.source_type || 'CITIZEN',
      signal.original_text,
      signal.normalized_text || null,
      signal.category || 'OTHER',
      signal.subcategory || null,
      signal.recommended_department || null,
      signal.severity || null,
      signal.language || 'en',
      signal.status || 'INGESTED',
      signal.processing_status || 'PENDING',
      signal.location?.lat ?? null,
      signal.location?.lng ?? null,
      signal.location_reference || null,
      signal.ward_id || null,
      signal.ai_confidence || null,
      signal.ai_analysis ? JSON.stringify(signal.ai_analysis) : null,
      signal.geography_provenance ? JSON.stringify(signal.geography_provenance) : null,
      signal.media_ids || [],
      (signal as any).centroid_embedding || (signal as any).embedding || null,
      signal.created_at || now,
      signal.submitted_at || signal.created_at || now,
      signal.updated_at || now
    ]);

    return signal;
  }

  async getSignal(id: string): Promise<Signal | null> {
    const rows = await this.query(
      `SELECT s.*, u.legacy_firebase_uid as citizen_legacy_uid FROM signals s LEFT JOIN users u ON u.id = s.citizen_id WHERE s.id = $1;`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapSignalRow(rows[0]);
  }

  async updateSignal(id: string, updates: Partial<Signal>): Promise<Signal> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let pIdx = 2;

    if (updates.status) {
      setClauses.push(`status = $${pIdx++}`);
      params.push(updates.status);
    }
    if (updates.processing_status) {
      setClauses.push(`processing_status = $${pIdx++}`);
      params.push(updates.processing_status);
    }
    if (updates.category) {
      setClauses.push(`category = $${pIdx++}`);
      params.push(updates.category);
    }
    if (updates.recommended_department) {
      setClauses.push(`recommended_department = $${pIdx++}`);
      params.push(updates.recommended_department);
    }
    if (updates.normalized_text) {
      setClauses.push(`normalized_text = $${pIdx++}`);
      params.push(updates.normalized_text);
    }
    if (updates.ai_analysis) {
      setClauses.push(`ai_analysis = $${pIdx++}`);
      params.push(JSON.stringify(updates.ai_analysis));
    }

    const sql = `UPDATE signals SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *;`;
    const rows = await this.query(sql, params);
    if (rows.length === 0) {
      throw new AppError({ statusCode: 404, code: ERROR_CODES.NOT_FOUND, message: `Signal ${id} not found.` });
    }
    return this.getSignal(id) as Promise<Signal>;
  }

  async listSignals(filter: SignalFilterCriteria): Promise<{ data: Signal[]; nextCursor?: string }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filter.status) {
      conditions.push(`s.status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter.category) {
      conditions.push(`s.category = $${pIdx++}`);
      params.push(filter.category);
    }
    if (filter.department_id) {
      conditions.push(`s.recommended_department = $${pIdx++}`);
      params.push(filter.department_id);
    }
    if (filter.citizen_id) {
      conditions.push(`(u.legacy_firebase_uid = $${pIdx} OR s.citizen_id::text = $${pIdx})`);
      pIdx++;
      params.push(filter.citizen_id);
    }
    if (filter.cursor) {
      conditions.push(`s.created_at < $${pIdx++}`);
      params.push(filter.cursor);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit || 50;
    params.push(limit + 1);

    const sql = `
      SELECT s.*, u.legacy_firebase_uid as citizen_legacy_uid
      FROM signals s
      LEFT JOIN users u ON u.id = s.citizen_id
      ${where}
      ORDER BY s.created_at DESC
      LIMIT $${pIdx};
    `;

    const rows = await this.query(sql, params);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const extra = rows.pop();
      nextCursor = extra.created_at?.toISOString ? extra.created_at.toISOString() : extra.created_at;
    }

    return {
      data: rows.map((r) => this.mapSignalRow(r)),
      nextCursor
    };
  }

  private mapSignalRow(r: any): Signal {
    return {
      id: r.id,
      citizen_id: r.citizen_legacy_uid || r.citizen_id || undefined,
      source_type: r.source_type,
      original_text: r.original_text,
      normalized_text: r.normalized_text || undefined,
      category: r.category,
      subcategory: r.subcategory || undefined,
      recommended_department: r.recommended_department || undefined,
      severity: r.severity || undefined,
      language: r.language || 'en',
      status: r.status,
      processing_status: r.processing_status,
      location: (r.latitude !== null && r.longitude !== null && r.latitude !== undefined && r.longitude !== undefined)
        ? { lat: Number(r.latitude), lng: Number(r.longitude) }
        : undefined,
      location_reference: r.location_reference || undefined,
      ward_id: r.ward_id || undefined,
      ai_confidence: r.ai_confidence || undefined,
      ai_analysis: r.ai_analysis || undefined,
      geography_provenance: r.geography_provenance || undefined,
      media_ids: r.media_ids || [],
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      submitted_at: r.submitted_at?.toISOString ? r.submitted_at.toISOString() : r.submitted_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Problem Clusters
  // ---------------------------------------------------------------------------

  async createProblemCluster(problem: ProblemCluster): Promise<ProblemCluster> {
    const now = new Date().toISOString();
    const sql = `
      INSERT INTO problem_clusters (
        id, title, description, category, subcategory, department_id, ward_id,
        latitude, longitude, status, signal_count, estimated_population, duration_days,
        impact_score, impact_level, impact_explanation, confidence, legacy_embedding,
        severity_score, population_score, duration_score, concentration_score,
        critical_exposure_score, recurrence_score, evidence_score, is_demo,
        first_detected_at, last_updated_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
      ) RETURNING *;
    `;

    await this.query(sql, [
      problem.id,
      problem.title,
      problem.description || null,
      problem.category,
      problem.subcategory || null,
      problem.department_id || null,
      problem.ward_id || null,
      problem.location?.lat ?? null,
      problem.location?.lng ?? null,
      problem.status || 'NEW',
      problem.signal_count || 1,
      problem.estimated_population || null,
      problem.duration_days || null,
      problem.impact_score || 0,
      problem.impact_level || 'LOW',
      problem.impact_explanation || null,
      problem.confidence || null,
      (problem as any).centroid_embedding || (problem as any).legacy_embedding || null,
      problem.severity_score ?? (problem as any).impact_factors?.severity_score ?? null,
      problem.population_score ?? (problem as any).impact_factors?.population_score ?? null,
      problem.duration_score ?? (problem as any).impact_factors?.duration_score ?? null,
      problem.concentration_score ?? (problem as any).impact_factors?.concentration_score ?? null,
      problem.critical_exposure_score ?? (problem as any).impact_factors?.critical_exposure_score ?? null,
      problem.recurrence_score ?? (problem as any).impact_factors?.recurrence_score ?? null,
      problem.evidence_score ?? (problem as any).impact_factors?.evidence_score ?? null,
      problem.is_demo || false,
      problem.first_detected_at || now,
      problem.last_updated_at || now,
      problem.created_at || now,
      problem.updated_at || now
    ]);

    return problem;
  }

  async getProblemCluster(id: string): Promise<ProblemCluster | null> {
    const rows = await this.query(`SELECT * FROM problem_clusters WHERE id = $1;`, [id]);
    if (rows.length === 0) return null;
    return this.mapProblemRow(rows[0]);
  }

  async updateProblemCluster(id: string, updates: Partial<ProblemCluster>): Promise<ProblemCluster> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let pIdx = 2;

    if (updates.status) {
      setClauses.push(`status = $${pIdx++}`);
      params.push(updates.status);
    }
    if (updates.signal_count !== undefined) {
      setClauses.push(`signal_count = $${pIdx++}`);
      params.push(updates.signal_count);
    }
    if (updates.impact_score !== undefined) {
      setClauses.push(`impact_score = $${pIdx++}`);
      params.push(updates.impact_score);
    }
    if (updates.impact_level) {
      setClauses.push(`impact_level = $${pIdx++}`);
      params.push(updates.impact_level);
    }
    if (updates.department_id !== undefined) {
      setClauses.push(`department_id = $${pIdx++}`);
      params.push(updates.department_id);
    }
    if (updates.resolved_at) {
      setClauses.push(`resolved_at = $${pIdx++}`);
      params.push(updates.resolved_at);
    }
    if (updates.closed_at) {
      setClauses.push(`closed_at = $${pIdx++}`);
      params.push(updates.closed_at);
    }

    const sql = `UPDATE problem_clusters SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *;`;
    const rows = await this.query(sql, params);
    if (rows.length === 0) {
      throw new AppError({ statusCode: 404, code: ERROR_CODES.NOT_FOUND, message: `Problem ${id} not found.` });
    }
    return this.mapProblemRow(rows[0]);
  }

  async listProblemClusters(filter: ProblemFilterCriteria): Promise<{ data: ProblemCluster[]; nextCursor?: string }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filter.status) {
      conditions.push(`status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter.department_id) {
      conditions.push(`department_id = $${pIdx++}`);
      params.push(filter.department_id);
    }
    if (filter.category) {
      conditions.push(`category = $${pIdx++}`);
      params.push(filter.category);
    }
    if (filter.ward_id) {
      conditions.push(`ward_id = $${pIdx++}`);
      params.push(filter.ward_id);
    }
    if (filter.impact_level) {
      conditions.push(`impact_level = $${pIdx++}`);
      params.push(filter.impact_level);
    }
    if (filter.cursor) {
      conditions.push(`created_at < $${pIdx++}`);
      params.push(filter.cursor);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filter.limit || 50;
    params.push(limit + 1);

    const sql = `
      SELECT * FROM problem_clusters
      ${where}
      ORDER BY created_at DESC
      LIMIT $${pIdx};
    `;

    const rows = await this.query(sql, params);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const extra = rows.pop();
      nextCursor = extra.created_at?.toISOString ? extra.created_at.toISOString() : extra.created_at;
    }

    return {
      data: rows.map((r) => this.mapProblemRow(r)),
      nextCursor
    };
  }

  private mapProblemRow(r: any): ProblemCluster {
    return {
      id: r.id,
      title: r.title,
      description: r.description || undefined,
      category: r.category,
      subcategory: r.subcategory || undefined,
      department_id: r.department_id || undefined,
      ward_id: r.ward_id || undefined,
      location: (r.latitude !== null && r.longitude !== null && r.latitude !== undefined && r.longitude !== undefined)
        ? { lat: Number(r.latitude), lng: Number(r.longitude) }
        : undefined,
      status: r.status,
      signal_count: r.signal_count || 1,
      estimated_population: r.estimated_population || undefined,
      duration_days: r.duration_days || undefined,
      impact_score: Number(r.impact_score) || 0,
      impact_level: r.impact_level || 'LOW',
      impact_explanation: r.impact_explanation || undefined,
      confidence: r.confidence || undefined,
      centroid_embedding: r.legacy_embedding || undefined,
      severity_score: Number(r.severity_score) || 0,
      population_score: Number(r.population_score) || 0,
      duration_score: Number(r.duration_score) || 0,
      concentration_score: Number(r.concentration_score) || 0,
      critical_exposure_score: Number(r.critical_exposure_score) || 0,
      recurrence_score: Number(r.recurrence_score) || 0,
      evidence_score: Number(r.evidence_score) || 0,
      is_demo: r.is_demo || false,
      first_detected_at: r.first_detected_at?.toISOString ? r.first_detected_at.toISOString() : r.first_detected_at,
      last_updated_at: r.last_updated_at?.toISOString ? r.last_updated_at.toISOString() : r.last_updated_at,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at,
      resolved_at: r.resolved_at?.toISOString ? r.resolved_at.toISOString() : r.resolved_at || undefined,
      closed_at: r.closed_at?.toISOString ? r.closed_at.toISOString() : r.closed_at || undefined
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Cluster Members
  // ---------------------------------------------------------------------------

  async addProblemClusterMember(member: ProblemClusterMember): Promise<ProblemClusterMember> {
    const sql = `
      INSERT INTO cluster_members (id, problem_id, signal_id, relationship, similarity, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    await this.query(sql, [
      member.id || `mem_${member.problem_id}_${member.signal_id}`,
      member.problem_id,
      member.signal_id,
      member.relationship || 'RELATED',
      member.similarity || 0.8,
      member.reason || 'Semantic and geographic proximity',
      member.created_at || new Date().toISOString()
    ]);
    return member;
  }

  async getProblemClusterMembers(problemId: string): Promise<ProblemClusterMember[]> {
    const rows = await this.query(`SELECT * FROM cluster_members WHERE problem_id = $1;`, [problemId]);
    return rows.map((r) => ({
      id: r.id,
      problem_id: r.problem_id,
      signal_id: r.signal_id,
      relationship: r.relationship,
      similarity: Number(r.similarity),
      reason: r.reason,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    }));
  }

  async getSignalClusterMemberships(signalId: string): Promise<ProblemClusterMember[]> {
    const rows = await this.query(`SELECT * FROM cluster_members WHERE signal_id = $1;`, [signalId]);
    return rows.map((r) => ({
      id: r.id,
      problem_id: r.problem_id,
      signal_id: r.signal_id,
      relationship: r.relationship,
      similarity: Number(r.similarity),
      reason: r.reason,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    }));
  }

  // ---------------------------------------------------------------------------
  // 5. Workflow, Assignments & Actions
  // ---------------------------------------------------------------------------

  async createAssignment(assignment: Assignment): Promise<Assignment> {
    const now = new Date().toISOString();
    // Resolve assigned_to UUID if string
    let assignedToUuid = null;
    if (assignment.assigned_to) {
      const uRows = await this.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1;`, [assignment.assigned_to]);
      if (uRows.length > 0) assignedToUuid = uRows[0].id;
    }

    const sql = `
      INSERT INTO assignments (
        id, problem_id, department_id, previous_department_id, assigned_to,
        priority, status, notes, assigned_at, due_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;

    await this.query(sql, [
      assignment.id,
      assignment.problem_id,
      assignment.department_id,
      assignment.previous_department_id || null,
      assignedToUuid,
      assignment.priority || 'MEDIUM',
      assignment.status || 'PENDING',
      assignment.notes || null,
      assignment.assigned_at || now,
      assignment.due_at || null,
      assignment.created_at || now,
      assignment.updated_at || now
    ]);

    return assignment;
  }

  async getAssignments(problemId: string): Promise<Assignment[]> {
    const sql = `
      SELECT a.*,
             u.legacy_firebase_uid as officer_legacy_uid,
             u_by.legacy_firebase_uid as assigned_by_legacy_uid
      FROM assignments a
      LEFT JOIN users u ON u.id = a.assigned_to
      LEFT JOIN users u_by ON u_by.id = a.assigned_by
      WHERE a.problem_id = $1
      ORDER BY a.created_at DESC;
    `;
    const rows = await this.query(sql, [problemId]);
    return rows.map((r) => ({
      id: r.id,
      problem_id: r.problem_id,
      department_id: r.department_id,
      previous_department_id: r.previous_department_id || undefined,
      assigned_to: r.officer_legacy_uid || r.assigned_to || undefined,
      assigned_by: r.assigned_by_legacy_uid || (r.assigned_by ? String(r.assigned_by) : 'SYSTEM'),
      priority: r.priority,
      status: r.status,
      notes: r.notes || undefined,
      assigned_at: r.assigned_at?.toISOString ? r.assigned_at.toISOString() : r.assigned_at,
      due_at: r.due_at?.toISOString ? r.due_at.toISOString() : r.due_at || undefined,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    }));
  }

  async listAssignments(filter: { department_id?: string; assigned_to?: string; status?: string }): Promise<Assignment[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filter.department_id) {
      conditions.push(`a.department_id = $${pIdx++}`);
      params.push(filter.department_id);
    }
    if (filter.status) {
      conditions.push(`a.status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter.assigned_to) {
      conditions.push(`(u.legacy_firebase_uid = $${pIdx} OR a.assigned_to::text = $${pIdx})`);
      pIdx++;
      params.push(filter.assigned_to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT a.*,
             u.legacy_firebase_uid as officer_legacy_uid,
             u_by.legacy_firebase_uid as assigned_by_legacy_uid
      FROM assignments a
      LEFT JOIN users u ON u.id = a.assigned_to
      LEFT JOIN users u_by ON u_by.id = a.assigned_by
      ${where}
      ORDER BY a.created_at DESC;
    `;

    const rows = await this.query(sql, params);
    return rows.map((r) => ({
      id: r.id,
      problem_id: r.problem_id,
      department_id: r.department_id,
      previous_department_id: r.previous_department_id || undefined,
      assigned_to: r.officer_legacy_uid || r.assigned_to || undefined,
      assigned_by: r.assigned_by_legacy_uid || (r.assigned_by ? String(r.assigned_by) : 'SYSTEM'),
      priority: r.priority,
      status: r.status,
      notes: r.notes || undefined,
      assigned_at: r.assigned_at?.toISOString ? r.assigned_at.toISOString() : r.assigned_at,
      due_at: r.due_at?.toISOString ? r.due_at.toISOString() : r.due_at || undefined,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    }));
  }

  async createAction(action: ProblemAction): Promise<ProblemAction> {
    const isSystemActor =
      action.actor_id === 'civicpulse_ai_advisory' ||
      action.actor_id === 'SYSTEM' ||
      action.actor_role === 'SYSTEM';

    let actorType: 'USER' | 'SYSTEM' = isSystemActor ? 'SYSTEM' : 'USER';
    let systemActorId = isSystemActor ? 'CIVICPULSE_AI_ADVISORY' : null;
    let actorUserUuid: string | null = null;

    if (!isSystemActor && action.actor_id) {
      const uRows = await this.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1;`, [action.actor_id]);
      if (uRows.length > 0) actorUserUuid = uRows[0].id;
    }

    const sql = `
      INSERT INTO problem_actions (
        id, problem_id, actor_type, actor_user_id, system_actor_id, actor_role,
        action_type, previous_state, new_state, target_department_id, note, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;

    await this.query(sql, [
      action.id,
      action.problem_id,
      actorType,
      actorUserUuid,
      systemActorId,
      action.actor_role,
      action.action_type,
      action.previous_state || null,
      action.new_state,
      action.target_department_id || null,
      action.note || null,
      action.created_at || new Date().toISOString()
    ]);

    return action;
  }

  async getActions(problemId: string): Promise<ProblemAction[]> {
    const sql = `
      SELECT pa.*, u.legacy_firebase_uid as actor_legacy_uid
      FROM problem_actions pa
      LEFT JOIN users u ON u.id = pa.actor_user_id
      WHERE pa.problem_id = $1
      ORDER BY pa.created_at ASC;
    `;
    const rows = await this.query(sql, [problemId]);
    return rows.map((r) => ({
      id: r.id,
      problem_id: r.problem_id,
      actor_id: r.actor_type === 'SYSTEM' ? 'civicpulse_ai_advisory' : (r.actor_legacy_uid || r.actor_user_id),
      actor_role: r.actor_role,
      action_type: r.action_type,
      previous_state: r.previous_state || undefined,
      new_state: r.new_state,
      target_department_id: r.target_department_id || undefined,
      note: r.note || undefined,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    }));
  }

  // ---------------------------------------------------------------------------
  // 6. Departments & Workload
  // ---------------------------------------------------------------------------

  async listDepartments(): Promise<Department[]> {
    const rows = await this.query(`SELECT * FROM departments ORDER BY name ASC;`);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      short_name: r.short_name,
      description: r.description || ''
    }));
  }

  async getDepartment(id: string): Promise<Department | null> {
    const rows = await this.query(`SELECT * FROM departments WHERE id = $1;`, [id]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      short_name: r.short_name,
      description: r.description || ''
    };
  }

  async getDepartmentWorkload(id: string): Promise<DepartmentWorkload> {
    const dept = await this.getDepartment(id);
    if (!dept) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Department ${id} not found.`
      });
    }

    const rows = await this.query(
      `SELECT status, impact_level, sla_state FROM problem_clusters WHERE department_id = $1;`,
      [id]
    );

    let totalAssigned = 0;
    let activeInProgress = 0;
    let awaitingVerification = 0;
    let criticalOrHigh = 0;
    let slaBreached = 0;
    let slaAtRisk = 0;

    for (const r of rows) {
      totalAssigned++;
      if (r.status === ProblemStatus.IN_PROGRESS) activeInProgress++;
      if (r.status === ProblemStatus.AWAITING_VERIFICATION) awaitingVerification++;
      if (r.impact_level === ImpactLevel.CRITICAL || r.impact_level === ImpactLevel.HIGH) {
        criticalOrHigh++;
      }
      const sla = r.sla_state;
      if (sla?.is_breached || sla?.status === 'BREACHED') {
        slaBreached++;
      } else if (sla?.is_at_risk || sla?.status === 'AT_RISK') {
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
      sla_at_risk: slaAtRisk
    };
  }

  async listDepartmentOfficers(departmentId: string): Promise<UserProfile[]> {
    const rows = await this.query(
      `SELECT * FROM users WHERE department_id = $1 AND role IN ('DEPARTMENT_OFFICER', 'FIELD_OFFICER') ORDER BY display_name ASC;`,
      [departmentId]
    );
    return rows.map((r) => ({
      id: r.legacy_firebase_uid || r.id,
      email: r.email,
      display_name: r.display_name,
      role: r.role,
      department_id: r.department_id || undefined,
      status: r.status,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    }));
  }

  // ---------------------------------------------------------------------------
  // 7. Atomic Mutations (Concurrency & State Integrity)
  // ---------------------------------------------------------------------------

  async atomicAssignProblem(
    problemId: string,
    assignment: Assignment,
    nextStatus: ProblemStatus,
    action: ProblemAction,
    expectedCurrentStatus?: ProblemStatus
  ): Promise<{ problem: ProblemCluster; assignment: Assignment; action: ProblemAction }> {
    return this.withTransaction(async (client) => {
      // Row lock
      const pRes = await client.query(`SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE;`, [problemId]);
      if (pRes.rows.length === 0) {
        throw new AppError({ statusCode: 404, code: ERROR_CODES.NOT_FOUND, message: `Problem ${problemId} not found.` });
      }
      const current = pRes.rows[0];
      if (expectedCurrentStatus && current.status !== expectedCurrentStatus) {
        throw new AppError({
          statusCode: 409,
          code: ERROR_CODES.CONFLICT,
          message: `Expected problem ${problemId} to have status ${expectedCurrentStatus}, found ${current.status}.`
        });
      }

      // 1. Update problem
      await client.query(
        `UPDATE problem_clusters SET status = $1, department_id = $2, updated_at = NOW() WHERE id = $3;`,
        [nextStatus, assignment.department_id, problemId]
      );

      // 2. Insert assignment
      await this.createAssignment(assignment);

      // 3. Insert action
      await this.createAction(action);

      const updatedProblem = await this.getProblemCluster(problemId);
      return {
        problem: updatedProblem!,
        assignment,
        action
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
    return this.withTransaction(async (client) => {
      const pRes = await client.query(`SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE;`, [problemId]);
      if (pRes.rows.length === 0) {
        throw new AppError({ statusCode: 404, code: ERROR_CODES.NOT_FOUND, message: `Problem ${problemId} not found.` });
      }
      const current = pRes.rows[0];
      if (current.status !== expectedCurrentStatus) {
        throw new AppError({
          statusCode: 409,
          code: ERROR_CODES.CONFLICT,
          message: `Expected problem ${problemId} to have status ${expectedCurrentStatus}, found ${current.status}.`
        });
      }

      await client.query(
        `UPDATE problem_clusters SET status = $1, updated_at = NOW() WHERE id = $2;`,
        [nextStatus, problemId]
      );

      await this.createAction(action);
      const updated = await this.getProblemCluster(problemId);
      return {
        problem: updated!,
        action
      };
    });
  }

  async atomicCreateClusterFromSignal(
    problem: ProblemCluster,
    member: ProblemClusterMember,
    signalId: string
  ): Promise<{ problem: ProblemCluster; member: ProblemClusterMember }> {
    return this.withTransaction(async (client) => {
      await client.query(`SELECT * FROM signals WHERE id = $1 FOR UPDATE;`, [signalId]);
      await this.createProblemCluster(problem);
      await this.addProblemClusterMember(member);
      await client.query(`UPDATE signals SET status = 'NORMALIZED', updated_at = NOW() WHERE id = $1;`, [signalId]);
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
    return this.withTransaction(async (client) => {
      const pRes = await client.query(`SELECT * FROM problem_clusters WHERE id = $1 FOR UPDATE;`, [problemId]);
      if (pRes.rows.length === 0) {
        throw new AppError({ statusCode: 404, code: ERROR_CODES.NOT_FOUND, message: `Problem ${problemId} not found.` });
      }

      const nextStatus = decision === 'ACCEPT' ? 'RESOLVED' : 'IN_PROGRESS';
      await client.query(`UPDATE problem_clusters SET status = $1, updated_at = NOW() WHERE id = $2;`, [nextStatus, problemId]);
      await this.createAction(action);
      const updated = await this.getProblemCluster(problemId);
      return {
        problem: updated!,
        action,
        decision
      };
    });
  }

  // ---------------------------------------------------------------------------
  // 8. Readiness Check
  // ---------------------------------------------------------------------------

  async checkReadiness(): Promise<{ ready: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.query('SELECT 1;');
      return { ready: true, latencyMs: Date.now() - start };
    } catch {
      return { ready: false, latencyMs: Date.now() - start };
    }
  }

  // ---------------------------------------------------------------------------
  // 9. Signal Media, Evidence & Verifications
  // ---------------------------------------------------------------------------

  async createSignalMedia(media: SignalMediaItem): Promise<SignalMediaItem> {
    const sql = `
      INSERT INTO signal_media (
        id, signal_id, storage_path, media_type, mime_type, file_size_bytes, uploaded_by, analysis_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
    `;
    await this.query(sql, [
      media.id,
      media.signal_id || null,
      media.storage_path,
      media.media_type || 'IMAGE',
      media.mime_type,
      media.file_size_bytes,
      media.uploaded_by,
      media.analysis_status || 'NOT_ANALYZED',
      media.created_at || new Date().toISOString()
    ]);
    return media;
  }

  async getSignalMedia(signalId: string): Promise<SignalMediaItem[]> {
    const rows = await this.query(`SELECT * FROM signal_media WHERE signal_id = $1;`, [signalId]);
    return rows.map((r) => ({
      id: r.id,
      signal_id: r.signal_id,
      storage_path: r.storage_path,
      media_type: r.media_type,
      mime_type: r.mime_type,
      file_size_bytes: Number(r.file_size_bytes),
      uploaded_by: r.uploaded_by,
      analysis_status: r.analysis_status,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    }));
  }

  async getSignalMediaByPath(storagePath: string): Promise<SignalMediaItem | null> {
    const rows = await this.query(`SELECT * FROM signal_media WHERE storage_path = $1;`, [storagePath]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      signal_id: r.signal_id,
      storage_path: r.storage_path,
      media_type: r.media_type,
      mime_type: r.mime_type,
      file_size_bytes: Number(r.file_size_bytes),
      uploaded_by: r.uploaded_by,
      analysis_status: r.analysis_status,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    };
  }

  async attachMediaToSignal(signalId: string, mediaId: string): Promise<void> {
    await this.query(`UPDATE signal_media SET signal_id = $1 WHERE id = $2;`, [signalId, mediaId]);
  }

  async createAIOperation(op: AIOperationRecord): Promise<AIOperationRecord> {
    const sql = `
      INSERT INTO ai_operations (
        id, operation_type, entity_id, entity_type, model, prompt_version, status, latency_ms, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
    `;
    await this.query(sql, [
      op.id,
      op.operation_type,
      op.entity_id,
      op.entity_type,
      op.model,
      op.prompt_version,
      op.status,
      op.latency_ms || 0,
      op.created_at || new Date().toISOString()
    ]);
    return op;
  }

  async getAIOperations(entityId: string): Promise<AIOperationRecord[]> {
    const rows = await this.query(`SELECT * FROM ai_operations WHERE entity_id = $1 ORDER BY created_at DESC;`, [entityId]);
    return rows.map((r) => ({
      id: r.id,
      operation_type: r.operation_type,
      entity_id: r.entity_id,
      entity_type: r.entity_type,
      model: r.model,
      prompt_version: r.prompt_version,
      status: r.status,
      latency_ms: r.latency_ms,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    }));
  }

  private mapEvidenceRow(r: any): ResolutionEvidence {
    return {
      id: r.id,
      problem_id: r.problem_id,
      submitted_by: r.officer_legacy_uid || (r.submitted_by ? String(r.submitted_by) : ''),
      submitted_at: r.submitted_at?.toISOString ? r.submitted_at.toISOString() : r.submitted_at || r.created_at,
      evidence_type: r.evidence_type,
      storage_path: r.storage_path,
      media_type: r.media_type || undefined,
      media_ids: r.media_ids || [],
      file_size_bytes: r.file_size_bytes !== null && r.file_size_bytes !== undefined ? Number(r.file_size_bytes) : undefined,
      sha256_hash: r.sha256_hash || undefined,
      description: r.description || undefined,
      location: (r.latitude !== null && r.longitude !== null && r.latitude !== undefined && r.longitude !== undefined)
        ? { lat: Number(r.latitude), lng: Number(r.longitude), reference: r.location_reference || undefined }
        : undefined,
      observed_at: r.observed_at?.toISOString ? r.observed_at.toISOString() : r.observed_at || undefined,
      before_or_after: r.before_or_after || undefined,
      verification_id: r.verification_id || undefined,
      status: r.status,
      is_demo: r.is_demo || false,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    };
  }

  async createResolutionEvidence(evidence: ResolutionEvidence): Promise<ResolutionEvidence> {
    let officerUuid = null;
    if (evidence.submitted_by) {
      const uRows = await this.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1;`, [evidence.submitted_by]);
      if (uRows.length > 0) officerUuid = uRows[0].id;
    }

    const now = new Date().toISOString();
    const sql = `
      INSERT INTO resolution_evidence (
        id, problem_id, submitted_by, evidence_type, storage_path,
        media_type, media_ids, file_size_bytes, sha256_hash, description,
        latitude, longitude, location_reference, observed_at, before_or_after,
        verification_id, status, is_demo, submitted_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *;
    `;

    await this.query(sql, [
      evidence.id,
      evidence.problem_id,
      officerUuid,
      evidence.evidence_type || 'COMPLETION_PHOTO',
      evidence.storage_path,
      evidence.media_type || 'IMAGE',
      evidence.media_ids || [],
      evidence.file_size_bytes || 0,
      evidence.sha256_hash || null,
      evidence.description || null,
      evidence.location?.lat ?? null,
      evidence.location?.lng ?? null,
      evidence.location?.reference || null,
      evidence.observed_at || null,
      evidence.before_or_after || 'AFTER',
      evidence.verification_id || null,
      evidence.status || 'SUBMITTED',
      evidence.is_demo || false,
      evidence.submitted_at || evidence.created_at || now,
      evidence.created_at || now,
      evidence.updated_at || now
    ]);

    return evidence;
  }

  async getResolutionEvidence(problemId: string): Promise<ResolutionEvidence[]> {
    const sql = `
      SELECT re.*, u.legacy_firebase_uid as officer_legacy_uid
      FROM resolution_evidence re
      LEFT JOIN users u ON u.id = re.submitted_by
      WHERE re.problem_id = $1
      ORDER BY re.created_at DESC;
    `;
    const rows = await this.query(sql, [problemId]);
    return rows.map((r) => this.mapEvidenceRow(r));
  }

  async getResolutionEvidenceByPath(storagePath: string): Promise<ResolutionEvidence | null> {
    const sql = `
      SELECT re.*, u.legacy_firebase_uid as officer_legacy_uid
      FROM resolution_evidence re
      LEFT JOIN users u ON u.id = re.submitted_by
      WHERE re.storage_path = $1;
    `;
    const rows = await this.query(sql, [storagePath]);
    if (rows.length === 0) return null;
    return this.mapEvidenceRow(rows[0]);
  }

  async getEvidenceById(id: string): Promise<ResolutionEvidence | null> {
    const sql = `
      SELECT re.*, u.legacy_firebase_uid as officer_legacy_uid
      FROM resolution_evidence re
      LEFT JOIN users u ON u.id = re.submitted_by
      WHERE re.id = $1;
    `;
    const rows = await this.query(sql, [id]);
    if (rows.length === 0) return null;
    return this.mapEvidenceRow(rows[0]);
  }

  async updateResolutionEvidence(
    id: string,
    updates: Partial<ResolutionEvidence>
  ): Promise<ResolutionEvidence> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];
    let pIdx = 2;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${pIdx++}`);
      params.push(updates.status);
    }
    if (updates.verification_id !== undefined) {
      setClauses.push(`verification_id = $${pIdx++}`);
      params.push(updates.verification_id);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${pIdx++}`);
      params.push(updates.description);
    }

    await this.query(`UPDATE resolution_evidence SET ${setClauses.join(', ')} WHERE id = $1;`, params);

    const updated = await this.getEvidenceById(id);
    if (!updated) {
      throw new AppError({ statusCode: 404, code: ERROR_CODES.NOT_FOUND, message: `Evidence ${id} not found.` });
    }
    return updated;
  }

  async createVerificationResult(result: VerificationResult): Promise<VerificationResult> {
    const sql = `
      INSERT INTO verification_results (
        id, problem_id, evidence_id, verification_result, confidence,
        observed_conditions, evidence_summary, before_after_comparison,
        inconsistencies, explanation, recommended_review_reason, limitations,
        review_required, model, prompt_version, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;

    await this.query(sql, [
      result.id,
      result.problem_id,
      result.evidence_id,
      result.verification_result,
      result.confidence,
      result.observed_conditions || [],
      result.evidence_summary || '',
      result.before_after_comparison ? JSON.stringify(result.before_after_comparison) : null,
      result.inconsistencies || [],
      result.explanation,
      result.recommended_review_reason || null,
      result.limitations || [],
      result.review_required,
      result.model,
      result.prompt_version,
      result.created_at || new Date().toISOString()
    ]);

    return result;
  }

  async getVerificationHistory(problemId: string): Promise<VerificationResult[]> {
    const rows = await this.query(
      `SELECT * FROM verification_results WHERE problem_id = $1 ORDER BY created_at DESC;`,
      [problemId]
    );
    return rows.map((r) => ({
      id: r.id,
      problem_id: r.problem_id,
      evidence_id: r.evidence_id,
      verification_result: r.verification_result,
      confidence: Number(r.confidence),
      observed_conditions: r.observed_conditions || [],
      evidence_summary: r.evidence_summary,
      before_after_comparison: r.before_after_comparison || undefined,
      inconsistencies: r.inconsistencies || [],
      explanation: r.explanation,
      recommended_review_reason: r.recommended_review_reason || undefined,
      limitations: r.limitations || [],
      review_required: r.review_required,
      model: r.model,
      prompt_version: r.prompt_version,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    }));
  }

  async getLatestVerification(evidenceId: string): Promise<VerificationResult | null> {
    const rows = await this.query(
      `SELECT * FROM verification_results WHERE evidence_id = $1 ORDER BY created_at DESC LIMIT 1;`,
      [evidenceId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      problem_id: r.problem_id,
      evidence_id: r.evidence_id,
      verification_result: r.verification_result,
      confidence: Number(r.confidence),
      observed_conditions: r.observed_conditions || [],
      evidence_summary: r.evidence_summary,
      before_after_comparison: r.before_after_comparison || undefined,
      inconsistencies: r.inconsistencies || [],
      explanation: r.explanation,
      recommended_review_reason: r.recommended_review_reason || undefined,
      limitations: r.limitations || [],
      review_required: r.review_required,
      model: r.model,
      prompt_version: r.prompt_version,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    };
  }
}
