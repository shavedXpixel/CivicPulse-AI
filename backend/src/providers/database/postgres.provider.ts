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
  ERROR_CODES,
  UserRole,
  UserStatus,
  AdminAuditRecord,
  SignalStatus,
  DemandSignal,
  DemandCluster,
  PublicInvestmentRecord
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
        let sslConfig: any = undefined;
        if (process.env.DATABASE_CA_CERT) {
          try {
            const fs = require('fs');
            if (fs.existsSync(process.env.DATABASE_CA_CERT)) {
              sslConfig = {
                ca: fs.readFileSync(process.env.DATABASE_CA_CERT, 'utf8'),
                rejectUnauthorized: true
              };
            }
          } catch {
            // Ignore error loading custom CA cert
          }
        } else if (
          process.env.DATABASE_SSL === 'true' ||
          connStr.includes('supabase.co') ||
          connStr.includes('supabase.com') ||
          connStr.includes('sslmode=require')
        ) {
          const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true';
          sslConfig = { rejectUnauthorized };
        }

        this.pool = new Pool({
          connectionString: connStr,
          ssl: sslConfig,
          max: config?.maxConnections || 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000
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
      id: isUuid ? String(r.id) : (r.legacy_firebase_uid || String(r.id)),
      canonical_id: String(r.id),
      auth_user_id: r.auth_user_id || undefined,
      legacy_firebase_uid: r.legacy_firebase_uid || undefined,
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
      auth_user_id: r.auth_user_id || undefined,
      legacy_firebase_uid: r.legacy_firebase_uid || undefined,
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
    const authUserId = user.auth_user_id || (user as any).auth_user_id || null;
    const now = new Date().toISOString();

    let sql: string;
    let params: any[];

    if (isUuid) {
      sql = `
        INSERT INTO users (
          id, auth_user_id, legacy_firebase_uid, email, display_name, role, department_id, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (email) DO UPDATE SET
          auth_user_id = COALESCE(users.auth_user_id, EXCLUDED.auth_user_id),
          display_name = COALESCE(EXCLUDED.display_name, users.display_name),
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `;
      params = [
        user.id,
        authUserId,
        legacyUid,
        user.email,
        user.display_name || user.email,
        user.role,
        user.department_id || null,
        user.status || 'ACTIVE',
        user.created_at || now,
        user.updated_at || now
      ];
    } else {
      sql = `
        INSERT INTO users (
          auth_user_id, legacy_firebase_uid, email, display_name, role, department_id, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (email) DO UPDATE SET
          auth_user_id = COALESCE(users.auth_user_id, EXCLUDED.auth_user_id),
          display_name = COALESCE(EXCLUDED.display_name, users.display_name),
          updated_at = EXCLUDED.updated_at
        RETURNING *;
      `;
      params = [
        authUserId,
        legacyUid,
        user.email,
        user.display_name || user.email,
        user.role,
        user.department_id || null,
        user.status || 'ACTIVE',
        user.created_at || now,
        user.updated_at || now
      ];
    }

    const rows = await this.query(sql, params);
    const r = rows[0];
    return {
      ...user,
      id: r.id,
      auth_user_id: r.auth_user_id || undefined,
      role: r.role,
      status: r.status,
      display_name: r.display_name,
      department_id: r.department_id || undefined,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    };
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.display_name !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(updates.display_name);
    }
    if (updates.department_id !== undefined) {
      fields.push(`department_id = $${idx++}`);
      values.push(updates.department_id);
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(updates.role);
    }
    fields.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());

    values.push(id);
    const sql = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id::text = $${idx} OR legacy_firebase_uid = $${idx} OR auth_user_id::text = $${idx}
      RETURNING *;
    `;
    const rows = await this.query(sql, values);
    if (rows.length === 0) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `User '${id}' not found.`
      });
    }
    const r = rows[0];
    return {
      id: r.id,
      auth_user_id: r.auth_user_id || undefined,
      email: r.email,
      display_name: r.display_name,
      role: r.role,
      status: r.status,
      department_id: r.department_id || undefined,
      ward_id: r.ward_id || undefined,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    };
  }

  async createAdminAuditLog(record: AdminAuditRecord): Promise<AdminAuditRecord> {
    const pool = this.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Serializes concurrent audit writes across processes using a PostgreSQL transactional advisory lock
      await client.query('SELECT pg_advisory_xact_lock(155316);');

      // Fetch the latest record_hash atomically under the lock
      const latestRes = await client.query(
        'SELECT record_hash FROM admin_audit_logs ORDER BY created_at DESC, id DESC LIMIT 1;'
      );
      const previousHash = (latestRes.rows.length > 0 && latestRes.rows[0].record_hash)
        ? latestRes.rows[0].record_hash
        : 'GENESIS_CIVICPULSE_ADMIN_AUDIT';

      // Compute cryptographic hash with the authoritative previous_hash
      const hashPayload = [
        previousHash,
        record.id,
        record.actor_user_id,
        record.action,
        record.target_email.toLowerCase(),
        record.target_role,
        record.department_id || 'NONE',
        record.result || 'SUCCESS',
        record.created_at || new Date().toISOString()
      ].join('|');
      const { createHash } = await import('crypto');
      const recordHash = createHash('sha256').update(hashPayload).digest('hex');

      record.previous_hash = previousHash;
      record.record_hash = recordHash;

      const sql = `
        INSERT INTO admin_audit_logs (
          id, actor_user_id, actor_email, action, target_user_id, target_email,
          target_role, department_id, result, details, previous_hash, record_hash, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *;
      `;
      const params = [
        record.id,
        record.actor_user_id,
        record.actor_email || null,
        record.action,
        record.target_user_id || null,
        record.target_email,
        record.target_role,
        record.department_id || null,
        record.result || 'SUCCESS',
        record.details ? JSON.stringify(record.details) : null,
        record.previous_hash,
        record.record_hash,
        record.created_at || new Date().toISOString()
      ];
      await client.query(sql, params);
      await client.query('COMMIT');
      return record;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listAdminAuditLogs(filter?: { target_email?: string; limit?: number }): Promise<AdminAuditRecord[]> {
    let sql = `SELECT * FROM admin_audit_logs`;
    const conditions: string[] = [];
    const params: any[] = [];
    if (filter?.target_email) {
      params.push(filter.target_email);
      conditions.push(`target_email = $${params.length}`);
    }
    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    sql += ` ORDER BY created_at DESC`;
    if (filter?.limit) {
      params.push(filter.limit);
      sql += ` LIMIT $${params.length}`;
    }
    const rows = await this.query(sql, params);
    return rows.map((r) => ({
      id: r.id,
      actor_user_id: r.actor_user_id,
      actor_email: r.actor_email || undefined,
      action: r.action,
      target_user_id: r.target_user_id || undefined,
      target_email: r.target_email,
      target_role: r.target_role,
      department_id: r.department_id || undefined,
      result: r.result,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details || undefined,
      previous_hash: r.previous_hash || undefined,
      record_hash: r.record_hash,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
    }));
  }

  async listUsers(filter?: { role?: UserRole; department_id?: string; status?: UserStatus }): Promise<UserProfile[]> {
    let sql = `SELECT * FROM users`;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.role) {
      params.push(filter.role);
      conditions.push(`role = $${params.length}`);
    }
    if (filter?.department_id) {
      params.push(filter.department_id);
      conditions.push(`department_id = $${params.length}`);
    }
    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    sql += ` ORDER BY created_at DESC;`;

    const rows = await this.query(sql, params);
    return rows.map((r) => ({
      id: r.id,
      auth_user_id: r.auth_user_id || undefined,
      email: r.email,
      display_name: r.display_name,
      role: r.role,
      status: r.status,
      department_id: r.department_id || undefined,
      ward_id: r.ward_id || undefined,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at,
      last_login_at: r.last_login_at?.toISOString ? r.last_login_at.toISOString() : r.last_login_at
    }));
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

    if (citizenInternalUuid) {
      signal.citizen_id = citizenInternalUuid;
    }

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
    if (updates.problem_cluster_id !== undefined) {
      setClauses.push(`problem_cluster_id = $${pIdx++}`);
      params.push(updates.problem_cluster_id);
    }
    if (updates.severity) {
      setClauses.push(`severity = $${pIdx++}`);
      params.push(updates.severity);
    }
    if (updates.language) {
      setClauses.push(`language = $${pIdx++}`);
      params.push(updates.language);
    }
    if (updates.subcategory) {
      setClauses.push(`subcategory = $${pIdx++}`);
      params.push(updates.subcategory);
    }
    if (updates.duration_days !== undefined) {
      setClauses.push(`duration_days = $${pIdx++}`);
      params.push(updates.duration_days);
    }
    if (updates.critical_facility !== undefined) {
      setClauses.push(`critical_facility = $${pIdx++}`);
      params.push(updates.critical_facility);
    }
    if (updates.ai_confidence !== undefined) {
      setClauses.push(`ai_confidence = $${pIdx++}`);
      params.push(updates.ai_confidence);
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
      SELECT s.*, u.legacy_firebase_uid as citizen_legacy_uid, pc.status as problem_status
      FROM signals s
      LEFT JOIN users u ON u.id = s.citizen_id
      LEFT JOIN problem_clusters pc ON pc.id = s.problem_cluster_id
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
      citizen_id: r.citizen_id || undefined,
      citizen_legacy_uid: r.citizen_legacy_uid || undefined,
      source_type: r.source_type,
      original_text: r.original_text,
      normalized_text: r.normalized_text || undefined,
      category: r.category,
      subcategory: r.subcategory || undefined,
      department_id: r.department_id || undefined,
      recommended_department: r.recommended_department || undefined,
      severity: r.severity || undefined,
      language: r.language || 'en',
      status: r.status,
      problem_cluster_id: r.problem_cluster_id || undefined,
      problem_status: r.problem_status || undefined,
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

  async createProblemCluster(problem: ProblemCluster, client?: PoolClient): Promise<ProblemCluster> {
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

    const params = [
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
    ];

    if (client) {
      await client.query(sql, params);
    } else {
      await this.query(sql, params);
    }

    return problem;
  }

  async getProblemCluster(id: string): Promise<ProblemCluster | null> {
    const rows = await this.query(`SELECT * FROM problem_clusters WHERE id = $1;`, [id]);
    if (rows.length === 0) return null;
    const problem = this.mapProblemRow(rows[0]);

    // Backward-compatibility fallback: if assigned_to is not populated on problem_clusters,
    // resolve from the latest active assignment record for this problem.
    if (!problem.assigned_to) {
      const asgnRows = await this.query(
        `SELECT assigned_to, assigned_at FROM assignments WHERE problem_id = $1 AND status != 'CANCELLED' ORDER BY created_at DESC LIMIT 1;`,
        [id]
      );
      if (asgnRows.length > 0 && asgnRows[0].assigned_to) {
        problem.assigned_to = asgnRows[0].assigned_to;
        if (!problem.assigned_at && asgnRows[0].assigned_at) {
          problem.assigned_at = asgnRows[0].assigned_at?.toISOString
            ? asgnRows[0].assigned_at.toISOString()
            : asgnRows[0].assigned_at;
        }
      }
    }

    return problem;
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
    if (updates.assigned_to !== undefined) {
      setClauses.push(`assigned_to = $${pIdx++}`);
      params.push(updates.assigned_to);
    }
    if (updates.assigned_at !== undefined) {
      setClauses.push(`assigned_at = $${pIdx++}`);
      params.push(updates.assigned_at);
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
    if (filter.assigned_to) {
      conditions.push(`assigned_to = $${pIdx++}`);
      params.push(filter.assigned_to);
    }
    if (filter.cursor) {
      conditions.push(`created_at < $${pIdx++}`);
      params.push(filter.cursor);
    }
    if (filter.is_demo !== undefined) {
      conditions.push(`is_demo = $${pIdx++}`);
      params.push(filter.is_demo);
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
      assigned_to: r.assigned_to || undefined,
      assigned_at: r.assigned_at?.toISOString ? r.assigned_at.toISOString() : r.assigned_at || undefined,
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

  async addProblemClusterMember(member: ProblemClusterMember, client?: PoolClient): Promise<ProblemClusterMember> {
    const sql = `
      INSERT INTO cluster_members (id, problem_id, signal_id, relationship, similarity, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const params = [
      member.id || `mem_${member.problem_id}_${member.signal_id}`,
      member.problem_id,
      member.signal_id,
      member.relationship || 'RELATED',
      member.similarity || 0.8,
      member.reason || 'Semantic and geographic proximity',
      member.created_at || new Date().toISOString()
    ];
    if (client) {
      await client.query(sql, params);
    } else {
      await this.query(sql, params);
    }
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

  async createAssignment(assignment: Assignment, client?: PoolClient): Promise<Assignment> {
    const now = new Date().toISOString();
    // Resolve assigned_to UUID if string
    let assignedToUuid: string | null = null;
    if (assignment.assigned_to) {
      if (client) {
        const uRows = await client.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id::text = $1;`, [assignment.assigned_to]);
        if (uRows.rows.length > 0) assignedToUuid = uRows.rows[0].id;
      } else {
        const uRows = await this.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id::text = $1;`, [assignment.assigned_to]);
        if (uRows.length > 0) assignedToUuid = uRows[0].id;
      }
      if (!assignedToUuid && /^[0-9a-fA-F-]{36}$/.test(assignment.assigned_to)) {
        assignedToUuid = assignment.assigned_to;
      }
    }

    // Resolve assigned_by to authoritative public.users.id
    let assignedByUuid: string | null = null;
    if (assignment.assigned_by) {
      if (client) {
        const uByRows = await client.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id::text = $1;`, [assignment.assigned_by]);
        if (uByRows.rows.length > 0) assignedByUuid = uByRows.rows[0].id;
      } else {
        const uByRows = await this.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id::text = $1;`, [assignment.assigned_by]);
        if (uByRows.length > 0) assignedByUuid = uByRows[0].id;
      }
      if (!assignedByUuid && /^[0-9a-fA-F-]{36}$/.test(assignment.assigned_by)) {
        assignedByUuid = assignment.assigned_by;
      }
    }

    if (!assignedByUuid) {
      throw new AppError({
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Assignment assigned_by must resolve to an authoritative public.users.id UUID.'
      });
    }

    const sql = `
      INSERT INTO assignments (
        id, problem_id, department_id, previous_department_id, assigned_to, assigned_by,
        priority, status, notes, assigned_at, due_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;

    const params = [
      assignment.id,
      assignment.problem_id,
      assignment.department_id,
      assignment.previous_department_id || null,
      assignedToUuid,
      assignedByUuid,
      assignment.priority || 'MEDIUM',
      assignment.status || 'PENDING',
      assignment.notes || null,
      assignment.assigned_at || now,
      assignment.due_at || null,
      assignment.created_at || now,
      assignment.updated_at || now
    ];

    if (client) {
      await client.query(sql, params);
    } else {
      await this.query(sql, params);
    }

    return {
      ...assignment,
      assigned_to: assignedToUuid || assignment.assigned_to,
      assigned_by: assignedByUuid || assignment.assigned_by
    };
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
      assigned_to: r.assigned_to ? String(r.assigned_to) : (r.officer_legacy_uid || undefined),
      assigned_by: r.assigned_by ? String(r.assigned_by) : (r.assigned_by_legacy_uid || 'SYSTEM'),
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
      assigned_to: r.assigned_to ? String(r.assigned_to) : (r.officer_legacy_uid || undefined),
      assigned_by: r.assigned_by ? String(r.assigned_by) : (r.assigned_by_legacy_uid || 'SYSTEM'),
      priority: r.priority,
      status: r.status,
      notes: r.notes || undefined,
      assigned_at: r.assigned_at?.toISOString ? r.assigned_at.toISOString() : r.assigned_at,
      due_at: r.due_at?.toISOString ? r.due_at.toISOString() : r.due_at || undefined,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    }));
  }

  async createAction(action: ProblemAction, client?: PoolClient): Promise<ProblemAction> {
    const isSystemActor =
      action.actor_id === 'civicpulse_ai_advisory' ||
      action.actor_id === 'SYSTEM' ||
      action.actor_role === 'SYSTEM';

    let actorType: 'USER' | 'SYSTEM' = isSystemActor ? 'SYSTEM' : 'USER';
    let systemActorId = isSystemActor ? 'CIVICPULSE_AI_ADVISORY' : null;
    let actorUserUuid: string | null = null;

    if (!isSystemActor && action.actor_id) {
      if (client) {
        const uRows = await client.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id::text = $1;`, [action.actor_id]);
        if (uRows.rows.length > 0) actorUserUuid = uRows.rows[0].id;
      } else {
        const uRows = await this.query(`SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id::text = $1;`, [action.actor_id]);
        if (uRows.length > 0) actorUserUuid = uRows[0].id;
      }
      if (!actorUserUuid && /^[0-9a-fA-F-]{36}$/.test(action.actor_id)) {
        actorUserUuid = action.actor_id;
      }
    }

    const sql = `
      INSERT INTO problem_actions (
        id, problem_id, actor_type, actor_user_id, system_actor_id, actor_role,
        action_type, previous_state, new_state, target_department_id, note, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *;
    `;

    const params = [
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
    ];

    if (client) {
      await client.query(sql, params);
    } else {
      await this.query(sql, params);
    }

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
      description: r.description || '',
      lead_officer: r.lead_officer || undefined,
      contact_phone: r.contact_phone || undefined,
      contact_email: r.contact_email || undefined,
      jurisdiction_wards: r.jurisdiction_wards || undefined,
      status: (r.status as any) || 'ACTIVE'
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
      description: r.description || '',
      lead_officer: r.lead_officer || undefined,
      contact_phone: r.contact_phone || undefined,
      contact_email: r.contact_email || undefined,
      jurisdiction_wards: r.jurisdiction_wards || undefined,
      status: (r.status as any) || 'ACTIVE'
    };
  }

  async createDepartment(department: Department): Promise<Department> {
    const now = new Date().toISOString();
    const colCheck = await this.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'status';`
    );
    const hasStatus = colCheck.length > 0;

    let sql: string;
    let params: any[];

    if (hasStatus) {
      sql = `
        INSERT INTO departments (id, name, short_name, description, lead_officer, contact_phone, contact_email, jurisdiction_wards, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *;
      `;
      params = [
        department.id,
        department.name,
        department.short_name || department.id,
        department.description || '',
        department.lead_officer || null,
        department.contact_phone || null,
        department.contact_email || null,
        department.jurisdiction_wards || null,
        department.status || 'ACTIVE',
        now,
        now
      ];
    } else {
      sql = `
        INSERT INTO departments (id, name, short_name, description, lead_officer, contact_phone, contact_email, jurisdiction_wards, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;
      params = [
        department.id,
        department.name,
        department.short_name || department.id,
        department.description || '',
        department.lead_officer || null,
        department.contact_phone || null,
        department.contact_email || null,
        department.jurisdiction_wards || null,
        now,
        now
      ];
    }

    const rows = await this.query(sql, params);
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      short_name: r.short_name,
      description: r.description || '',
      lead_officer: r.lead_officer || undefined,
      contact_phone: r.contact_phone || undefined,
      contact_email: r.contact_email || undefined,
      jurisdiction_wards: r.jurisdiction_wards || undefined,
      status: (r.status as any) || department.status || 'ACTIVE'
    };
  }

  async updateDepartment(id: string, updates: Partial<Department>): Promise<Department> {
    const existing = await this.getDepartment(id);
    if (!existing) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Department ${id} not found.`
      });
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [id];

    if (updates.name !== undefined) {
      params.push(updates.name);
      setClauses.push(`name = $${params.length}`);
    }
    if (updates.short_name !== undefined) {
      params.push(updates.short_name);
      setClauses.push(`short_name = $${params.length}`);
    }
    if (updates.description !== undefined) {
      params.push(updates.description);
      setClauses.push(`description = $${params.length}`);
    }
    if (updates.contact_phone !== undefined) {
      params.push(updates.contact_phone);
      setClauses.push(`contact_phone = $${params.length}`);
    }
    if (updates.contact_email !== undefined) {
      params.push(updates.contact_email);
      setClauses.push(`contact_email = $${params.length}`);
    }
    if (updates.lead_officer !== undefined) {
      params.push(updates.lead_officer);
      setClauses.push(`lead_officer = $${params.length}`);
    }
    if (updates.jurisdiction_wards !== undefined) {
      params.push(updates.jurisdiction_wards);
      setClauses.push(`jurisdiction_wards = $${params.length}`);
    }

    if (updates.status !== undefined) {
      const colCheck = await this.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'status';`
      );
      if (colCheck.length > 0) {
        params.push(updates.status);
        setClauses.push(`status = $${params.length}`);
      }
    }

    const sql = `UPDATE departments SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *;`;
    const rows = await this.query(sql, params);
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      short_name: r.short_name,
      description: r.description || '',
      lead_officer: r.lead_officer || undefined,
      contact_phone: r.contact_phone || undefined,
      contact_email: r.contact_email || undefined,
      jurisdiction_wards: r.jurisdiction_wards || undefined,
      status: (r.status as any) || updates.status || existing.status || 'ACTIVE'
    };
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

    const conditions: string[] = ['department_id = $1'];
    const params: any[] = [id];
    let pIdx = 2;

    if (options?.is_demo !== undefined) {
      conditions.push(`is_demo = $${pIdx++}`);
      params.push(options.is_demo);
    }

    const rows = await this.query(
      `SELECT status, impact_level, sla_state FROM problem_clusters WHERE ${conditions.join(' AND ')};`,
      params
    );

    let totalAssigned = 0;
    let activeInProgress = 0;
    let awaitingVerification = 0;
    let criticalOrHigh = 0;
    let slaBreached = 0;
    let slaAtRisk = 0;

    for (const r of rows) {
      // Phase E: Exclude terminal cases from active workload denominator
      if (r.status === ProblemStatus.RESOLVED || r.status === ProblemStatus.CLOSED) {
        continue;
      }

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

  async listDepartmentOfficers(
    departmentId: string,
    options?: { role?: string; assignable?: boolean }
  ): Promise<UserProfile[]> {
    let sql: string;
    const params: any[] = [departmentId];

    if (options?.assignable) {
      sql = `SELECT * FROM users WHERE department_id = $1 AND role = 'FIELD_OFFICER' AND (status = 'ACTIVE' OR status IS NULL) ORDER BY display_name ASC;`;
    } else if (options?.role) {
      sql = `SELECT * FROM users WHERE department_id = $1 AND role = $2 AND (status = 'ACTIVE' OR status IS NULL) ORDER BY display_name ASC;`;
      params.push(options.role);
    } else {
      sql = `SELECT * FROM users WHERE department_id = $1 AND role IN ('DEPARTMENT_OFFICER', 'FIELD_OFFICER') AND (status = 'ACTIVE' OR status IS NULL) ORDER BY display_name ASC;`;
    }

    const rows = await this.query(sql, params);
    return rows.map((r) => ({
      id: String(r.id),
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
    expectedCurrentStatus?: ProblemStatus,
    supersededAssignmentIds?: string[]
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

      // Resolve assigned_to UUID if provided
      let assignedToUuid: string | null = null;
      if (assignment.assigned_to) {
        const uRows = await client.query(
          `SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id::text = $1;`,
          [assignment.assigned_to]
        );
        if (uRows.rows.length > 0) assignedToUuid = uRows.rows[0].id;
        if (!assignedToUuid && /^[0-9a-fA-F-]{36}$/.test(assignment.assigned_to)) {
          assignedToUuid = assignment.assigned_to;
        }
      }

      const assignedAt = assignment.assigned_at || new Date().toISOString();

      // 1. Update problem
      const updatedRes = await client.query(
        `UPDATE problem_clusters SET status = $1, department_id = $2, assigned_to = $3, assigned_at = $4, updated_at = NOW() WHERE id = $5 RETURNING *;`,
        [nextStatus, assignment.department_id, assignedToUuid, assignedAt, problemId]
      );

      // 2. Atomically supersede any existing active assignments for this problem
      await client.query(
        `UPDATE assignments 
         SET status = 'CANCELLED', 
             completed_at = NOW(), 
             updated_at = NOW() 
         WHERE problem_id = $1 
           AND id != $2 
           AND status IN ('ASSIGNED', 'ACCEPTED');`,
        [problemId, assignment.id]
      );

      // 3. Insert assignment
      const assignmentToInsert: Assignment = {
        ...assignment,
        assigned_to: assignedToUuid || assignment.assigned_to,
        assigned_by: (action.actor_id as string) || assignment.assigned_by
      };
      const createdAssignment = await this.createAssignment(assignmentToInsert, client);

      // 4. Insert action
      await this.createAction(action, client);

      const updatedProblem = (updatedRes.rows && updatedRes.rows.length > 0)
        ? this.mapProblemRow(updatedRes.rows[0])
        : {
            ...this.mapProblemRow(current),
            status: nextStatus,
            department_id: assignment.department_id,
            assigned_to: assignedToUuid || assignment.assigned_to,
            assigned_at: assignedAt,
            updated_at: new Date().toISOString()
          };
      return {
        problem: updatedProblem,
        assignment: createdAssignment,
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

      const setClauses: string[] = ['status = $1', 'updated_at = NOW()'];
      const params: any[] = [nextStatus, problemId];
      let pIdx = 3;

      if (updates) {
        if ('resolved_at' in updates) {
          setClauses.push(`resolved_at = $${pIdx++}`);
          params.splice(params.length - 1, 0, updates.resolved_at || null);
        }
        if ('closed_at' in updates) {
          setClauses.push(`closed_at = $${pIdx++}`);
          params.splice(params.length - 1, 0, updates.closed_at || null);
        }
        if ('assigned_to' in updates) {
          setClauses.push(`assigned_to = $${pIdx++}`);
          params.splice(params.length - 1, 0, updates.assigned_to || null);
        }
        if ('assigned_at' in updates) {
          setClauses.push(`assigned_at = $${pIdx++}`);
          params.splice(params.length - 1, 0, updates.assigned_at || null);
        }
      }

      if (nextStatus === ProblemStatus.REOPENED) {
        if (!updates || !('assigned_to' in updates)) {
          setClauses.push(`assigned_to = NULL`);
        }
        if (!updates || !('assigned_at' in updates)) {
          setClauses.push(`assigned_at = NULL`);
        }
      }

      const updateSql = `UPDATE problem_clusters SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *;`;
      const updatedRes = await client.query(updateSql, params);

      // If nextStatus is REOPENED, cancel all active assignments for this problem
      if (nextStatus === ProblemStatus.REOPENED) {
        await client.query(
          `UPDATE assignments 
           SET status = 'CANCELLED', completed_at = NOW(), updated_at = NOW() 
           WHERE problem_id = $1 AND status IN ('ASSIGNED', 'ACCEPTED');`,
          [problemId]
        );
      }

      await this.createAction(action, client);
      const updatedProblem = (updatedRes.rows && updatedRes.rows.length > 0)
        ? this.mapProblemRow(updatedRes.rows[0])
        : {
            ...this.mapProblemRow(current),
            status: nextStatus,
            updated_at: new Date().toISOString()
          };

      return {
        problem: updatedProblem,
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
      const sRes = await client.query(`SELECT id FROM signals WHERE id = $1 FOR UPDATE;`, [signalId]);
      if (sRes.rows.length === 0) {
        throw new AppError({
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND,
          message: `Signal ${signalId} not found during cluster creation.`
        });
      }
      await this.createProblemCluster(problem, client);
      await this.addProblemClusterMember(member, client);
      await client.query(
        `UPDATE signals SET status = $1, problem_cluster_id = $2, updated_at = NOW() WHERE id = $3;`,
        [SignalStatus.ATTACHED_TO_PROBLEM, problem.id, signalId]
      );
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
      const current = pRes.rows[0];

      const nextStatus: ProblemStatus = decision === 'ACCEPT' ? ProblemStatus.RESOLVED : ProblemStatus.IN_PROGRESS;
      let updatedRes;
      if (decision === 'ACCEPT') {
        updatedRes = await client.query(
          `UPDATE problem_clusters SET status = $1, resolved_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *;`,
          [nextStatus, problemId]
        );
      } else {
        updatedRes = await client.query(
          `UPDATE problem_clusters SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`,
          [nextStatus, problemId]
        );
      }

      // Update resolution evidence records
      if (evidenceIds.length > 0) {
        const nextEvidenceStatus = decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
        await client.query(
          `UPDATE resolution_evidence SET status = $1, updated_at = NOW() WHERE problem_id = $2 AND id = ANY($3::text[]);`,
          [nextEvidenceStatus, problemId, evidenceIds]
        );
      }

      await this.createAction(action, client);
      const updatedProblem = (updatedRes.rows && updatedRes.rows.length > 0)
        ? this.mapProblemRow(updatedRes.rows[0])
        : {
            ...this.mapProblemRow(current),
            status: nextStatus,
            resolved_at: decision === 'ACCEPT' ? new Date().toISOString() : current.resolved_at,
            updated_at: new Date().toISOString()
          };
      return {
        problem: updatedProblem,
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
    let uploadedByUuid = media.uploaded_by;
    if (uploadedByUuid && !/^[0-9a-fA-F-]{36}$/.test(uploadedByUuid)) {
      const uRows = await this.query(
        `SELECT id FROM users WHERE id::text = $1 OR legacy_firebase_uid = $1 OR auth_user_id::text = $1;`,
        [uploadedByUuid]
      );
      if (uRows.length > 0) uploadedByUuid = uRows[0].id;
    }

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
      uploadedByUuid,
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

  async getResolutionEvidence(problemId: string, options?: { is_demo?: boolean }): Promise<ResolutionEvidence[]> {
    const conditions: string[] = ['re.problem_id = $1'];
    const params: any[] = [problemId];
    let pIdx = 2;

    if (options?.is_demo !== undefined) {
      conditions.push(`re.is_demo = $${pIdx++}`);
      params.push(options.is_demo);
    }

    const sql = `
      SELECT re.*, u.legacy_firebase_uid as officer_legacy_uid
      FROM resolution_evidence re
      LEFT JOIN users u ON u.id = re.submitted_by
      WHERE ${conditions.join(' AND ')}
      ORDER BY re.created_at DESC;
    `;
    const rows = await this.query(sql, params);
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

    // Persist failure_reason inside JSONB before_after_comparison to preserve without table migration
    const comparisonPayload = result.before_after_comparison
      ? { ...result.before_after_comparison, ...(result.failure_reason ? { failure_reason: result.failure_reason } : {}) }
      : (result.failure_reason ? { failure_reason: result.failure_reason } : null);

    await this.query(sql, [
      result.id,
      result.problem_id,
      result.evidence_id,
      result.verification_result,
      result.confidence,
      result.observed_conditions || [],
      result.evidence_summary || '',
      comparisonPayload ? JSON.stringify(comparisonPayload) : null,
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
    return rows.map((r) => {
      const compRaw = r.before_after_comparison;
      const failureReason = compRaw?.failure_reason || undefined;
      const cleanComparison = (compRaw && typeof compRaw === 'object' && 'improved' in compRaw)
        ? {
            improved: compRaw.improved,
            summary: compRaw.summary,
            changes_observed: compRaw.changes_observed || [],
            limitations: compRaw.limitations || []
          }
        : undefined;

      return {
        id: r.id,
        problem_id: r.problem_id,
        evidence_id: r.evidence_id,
        verification_result: r.verification_result,
        failure_reason: failureReason,
        confidence: Number(r.confidence),
        observed_conditions: r.observed_conditions || [],
        evidence_summary: r.evidence_summary,
        before_after_comparison: cleanComparison,
        inconsistencies: r.inconsistencies || [],
        explanation: r.explanation,
        recommended_review_reason: r.recommended_review_reason || undefined,
        limitations: r.limitations || [],
        review_required: r.review_required,
        model: r.model,
        prompt_version: r.prompt_version,
        created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at
      };
    });
  }

  async getLatestVerification(evidenceId: string): Promise<VerificationResult | null> {
    const rows = await this.query(
      `SELECT * FROM verification_results WHERE evidence_id = $1 ORDER BY created_at DESC LIMIT 1;`,
      [evidenceId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    const compRaw = r.before_after_comparison;
    const failureReason = compRaw?.failure_reason || undefined;
    const cleanComparison = (compRaw && typeof compRaw === 'object' && 'improved' in compRaw)
      ? {
          improved: compRaw.improved,
          summary: compRaw.summary,
          changes_observed: compRaw.changes_observed || [],
          limitations: compRaw.limitations || []
        }
      : undefined;

    return {
      id: r.id,
      problem_id: r.problem_id,
      evidence_id: r.evidence_id,
      verification_result: r.verification_result,
      failure_reason: failureReason,
      confidence: Number(r.confidence),
      observed_conditions: r.observed_conditions || [],
      evidence_summary: r.evidence_summary,
      before_after_comparison: cleanComparison,
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

  // ============================================================================
  // Development Demand Intelligence (Phase 15B Real Data Activation)
  // ============================================================================

  async createDemandSignal(signal: DemandSignal): Promise<DemandSignal> {
    const embeddingStr = signal.embedding && signal.embedding.length > 0
      ? `[${signal.embedding.join(',')}]`
      : null;

    const rows = await this.query(
      `INSERT INTO demand_signals (
        id, citizen_id, source_channel, original_language, original_text,
        normalized_language, normalized_text, normalization_confidence,
        detected_category, detected_urgency, ward_id, locality_name,
        embedding, demand_cluster_id, is_demo, submitted_at, ingested_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        NOW(), NOW()
      )
      RETURNING *;`,
      [
        signal.id,
        signal.citizen_id || null,
        signal.source_channel,
        signal.original_language,
        signal.original_text,
        signal.normalized_language,
        signal.normalized_text,
        signal.normalization_confidence,
        signal.detected_category,
        signal.detected_urgency,
        signal.ward_id,
        signal.locality_name || null,
        embeddingStr,
        signal.demand_cluster_id || null,
        signal.is_demo ?? false,
        signal.submitted_at || new Date().toISOString(),
        signal.ingested_at || new Date().toISOString()
      ]
    );

    return this.mapDemandSignal(rows[0]);
  }

  async getDemandSignal(id: string): Promise<DemandSignal | null> {
    const rows = await this.query(`SELECT * FROM demand_signals WHERE id = $1;`, [id]);
    if (rows.length === 0) return null;
    return this.mapDemandSignal(rows[0]);
  }

  async listDemandSignals(filter?: {
    ward_id?: string;
    category?: string;
    is_demo?: boolean;
    limit?: number;
  }): Promise<DemandSignal[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter?.is_demo !== undefined) {
      conditions.push(`is_demo = $${idx++}`);
      params.push(filter.is_demo);
    }
    if (filter?.ward_id) {
      conditions.push(`ward_id = $${idx++}`);
      params.push(filter.ward_id);
    }
    if (filter?.category) {
      conditions.push(`detected_category = $${idx++}`);
      params.push(filter.category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filter?.limit ? `LIMIT ${filter.limit}` : '';

    const rows = await this.query(
      `SELECT * FROM demand_signals ${whereClause} ORDER BY submitted_at DESC ${limitClause};`,
      params
    );

    return rows.map((r: any) => this.mapDemandSignal(r));
  }

  async updateDemandSignal(id: string, updates: Partial<DemandSignal>): Promise<DemandSignal> {
    const fields: string[] = [];
    const params: any[] = [id];
    let idx = 2;

    if (updates.demand_cluster_id !== undefined) {
      fields.push(`demand_cluster_id = $${idx++}`);
      params.push(updates.demand_cluster_id);
    }
    if (updates.detected_category !== undefined) {
      fields.push(`detected_category = $${idx++}`);
      params.push(updates.detected_category);
    }
    if (updates.detected_urgency !== undefined) {
      fields.push(`detected_urgency = $${idx++}`);
      params.push(updates.detected_urgency);
    }
    if (updates.embedding !== undefined) {
      fields.push(`embedding = $${idx++}`);
      params.push(updates.embedding ? `[${updates.embedding.join(',')}]` : null);
    }

    fields.push(`updated_at = NOW()`);

    const rows = await this.query(
      `UPDATE demand_signals SET ${fields.join(', ')} WHERE id = $1 RETURNING *;`,
      params
    );

    if (rows.length === 0) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Demand signal '${id}' not found.`
      });
    }

    return this.mapDemandSignal(rows[0]);
  }

  async createDemandCluster(cluster: DemandCluster): Promise<DemandCluster> {
    const rows = await this.query(
      `INSERT INTO demand_clusters (
        id, title, category, subcategory, ward_ids, locality_names,
        centroid_lat, centroid_lng, signal_count, first_signal_at,
        last_signal_at, duration_days, composite_demand_index,
        priority_band, metrics, is_demo, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, NOW(), NOW()
      )
      RETURNING *;`,
      [
        cluster.id,
        cluster.title,
        cluster.category,
        cluster.subcategory || null,
        cluster.ward_ids || [],
        cluster.locality_names || [],
        cluster.centroid?.lat || null,
        cluster.centroid?.lng || null,
        cluster.signal_count || 1,
        cluster.first_signal_at,
        cluster.last_signal_at,
        cluster.duration_days || 1,
        cluster.composite_demand_index || 0,
        cluster.priority_band || 'MEDIUM',
        cluster.metrics ? JSON.stringify(cluster.metrics) : null,
        cluster.is_demo ?? false
      ]
    );

    return this.mapDemandCluster(rows[0]);
  }

  async getDemandCluster(id: string): Promise<DemandCluster | null> {
    const rows = await this.query(`SELECT * FROM demand_clusters WHERE id = $1;`, [id]);
    if (rows.length === 0) return null;
    return this.mapDemandCluster(rows[0]);
  }

  async listDemandClusters(filter?: {
    ward_id?: string;
    category?: string;
    priority_band?: string;
    is_demo?: boolean;
    limit?: number;
  }): Promise<DemandCluster[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter?.is_demo !== undefined) {
      conditions.push(`is_demo = $${idx++}`);
      params.push(filter.is_demo);
    }
    if (filter?.ward_id) {
      conditions.push(`$${idx++} = ANY(ward_ids)`);
      params.push(filter.ward_id);
    }
    if (filter?.category) {
      conditions.push(`category = $${idx++}`);
      params.push(filter.category);
    }
    if (filter?.priority_band) {
      conditions.push(`priority_band = $${idx++}`);
      params.push(filter.priority_band);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filter?.limit ? `LIMIT ${filter.limit}` : '';

    const rows = await this.query(
      `SELECT * FROM demand_clusters ${whereClause} ORDER BY composite_demand_index DESC, created_at DESC ${limitClause};`,
      params
    );

    return rows.map((r: any) => this.mapDemandCluster(r));
  }

  async updateDemandCluster(id: string, updates: Partial<DemandCluster>): Promise<DemandCluster> {
    const fields: string[] = [];
    const params: any[] = [id];
    let idx = 2;

    if (updates.title !== undefined) {
      fields.push(`title = $${idx++}`);
      params.push(updates.title);
    }
    if (updates.signal_count !== undefined) {
      fields.push(`signal_count = $${idx++}`);
      params.push(updates.signal_count);
    }
    if (updates.ward_ids !== undefined) {
      fields.push(`ward_ids = $${idx++}`);
      params.push(updates.ward_ids);
    }
    if (updates.last_signal_at !== undefined) {
      fields.push(`last_signal_at = $${idx++}`);
      params.push(updates.last_signal_at);
    }
    if (updates.duration_days !== undefined) {
      fields.push(`duration_days = $${idx++}`);
      params.push(updates.duration_days);
    }
    if (updates.composite_demand_index !== undefined) {
      fields.push(`composite_demand_index = $${idx++}`);
      params.push(updates.composite_demand_index);
    }
    if (updates.priority_band !== undefined) {
      fields.push(`priority_band = $${idx++}`);
      params.push(updates.priority_band);
    }
    if (updates.metrics !== undefined) {
      fields.push(`metrics = $${idx++}`);
      params.push(JSON.stringify(updates.metrics));
    }

    fields.push(`updated_at = NOW()`);

    const rows = await this.query(
      `UPDATE demand_clusters SET ${fields.join(', ')} WHERE id = $1 RETURNING *;`,
      params
    );

    if (rows.length === 0) {
      throw new AppError({
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND,
        message: `Demand cluster '${id}' not found.`
      });
    }

    return this.mapDemandCluster(rows[0]);
  }

  async addDemandClusterMember(clusterId: string, signalId: string, similarityScore?: number): Promise<void> {
    await this.query(
      `INSERT INTO demand_cluster_members (cluster_id, signal_id, similarity_score, joined_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (cluster_id, signal_id) DO UPDATE SET
         similarity_score = EXCLUDED.similarity_score;`,
      [clusterId, signalId, similarityScore || null]
    );

    await this.query(
      `UPDATE demand_signals SET demand_cluster_id = $1, updated_at = NOW() WHERE id = $2;`,
      [clusterId, signalId]
    );
  }

  async getDemandClusterMembers(clusterId: string): Promise<{ signal_id: string; similarity_score?: number }[]> {
    const rows = await this.query(
      `SELECT signal_id, similarity_score FROM demand_cluster_members WHERE cluster_id = $1 ORDER BY joined_at ASC;`,
      [clusterId]
    );
    return rows.map((r: any) => ({
      signal_id: r.signal_id,
      similarity_score: r.similarity_score !== null ? Number(r.similarity_score) : undefined
    }));
  }

  async listPublicInvestments(filter?: {
    ward_id?: string;
    category?: string;
    is_demo?: boolean;
  }): Promise<PublicInvestmentRecord[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filter?.is_demo !== undefined) {
      conditions.push(`is_demo = $${idx++}`);
      params.push(filter.is_demo);
    }
    if (filter?.ward_id) {
      conditions.push(`$${idx++} = ANY(ward_ids)`);
      params.push(filter.ward_id);
    }
    if (filter?.category) {
      conditions.push(`LOWER(category) = LOWER($${idx++})`);
      params.push(filter.category);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await this.query(
      `SELECT * FROM public_investment_projects ${whereClause} ORDER BY documented_budget DESC;`,
      params
    );

    return rows.map((r: any) => ({
      id: r.id,
      project_id: r.project_id,
      plan_name: r.plan_name,
      category: r.category,
      ward_ids: r.ward_ids || [],
      status: r.status,
      documented_budget: Number(r.documented_budget),
      currency: r.currency,
      announcement_date: r.announcement_date,
      source_agency: r.source_agency,
      source_url: r.source_url,
      provenance: r.provenance || {},
      is_demo: r.is_demo
    }));
  }

  async recordDemandAnalysisRun(run: {
    id: string;
    cluster_id: string;
    executed_at?: string;
    model_name: string;
    prompt_version: string;
    analysis_response: any;
    is_demo: boolean;
  }): Promise<void> {
    await this.query(
      `INSERT INTO demand_analysis_runs (
        id, cluster_id, executed_at, model_name, prompt_version, analysis_response, is_demo
      ) VALUES ($1, $2, COALESCE($3, NOW()), $4, $5, $6, $7);`,
      [
        run.id,
        run.cluster_id,
        run.executed_at || null,
        run.model_name,
        run.prompt_version,
        JSON.stringify(run.analysis_response),
        run.is_demo
      ]
    );
  }

  async getDemandAnalysisRuns(clusterId: string): Promise<any[]> {
    const rows = await this.query(
      `SELECT * FROM demand_analysis_runs WHERE cluster_id = $1 ORDER BY executed_at DESC;`,
      [clusterId]
    );
    return rows.map((r: any) => ({
      id: r.id,
      cluster_id: r.cluster_id,
      executed_at: r.executed_at?.toISOString ? r.executed_at.toISOString() : r.executed_at,
      model_name: r.model_name,
      prompt_version: r.prompt_version,
      analysis_response: r.analysis_response,
      is_demo: r.is_demo
    }));
  }

  private mapDemandSignal(r: any): DemandSignal {
    return {
      id: r.id,
      citizen_id: r.citizen_id || undefined,
      demand_cluster_id: r.demand_cluster_id || undefined,
      source_channel: r.source_channel,
      original_language: r.original_language,
      original_text: r.original_text,
      normalized_language: r.normalized_language,
      normalized_text: r.normalized_text,
      normalization_confidence: Number(r.normalization_confidence),
      detected_category: r.detected_category,
      detected_urgency: r.detected_urgency,
      ward_id: r.ward_id,
      locality_name: r.locality_name || undefined,
      is_demo: r.is_demo,
      submitted_at: r.submitted_at?.toISOString ? r.submitted_at.toISOString() : r.submitted_at,
      ingested_at: r.ingested_at?.toISOString ? r.ingested_at.toISOString() : r.ingested_at
    };
  }

  private mapDemandCluster(r: any): DemandCluster {
    return {
      id: r.id,
      title: r.title,
      category: r.category,
      subcategory: r.subcategory || undefined,
      ward_ids: r.ward_ids || [],
      locality_names: r.locality_names || [],
      centroid: r.centroid_lat && r.centroid_lng
        ? { lat: Number(r.centroid_lat), lng: Number(r.centroid_lng) }
        : undefined,
      signal_count: Number(r.signal_count),
      first_signal_at: r.first_signal_at?.toISOString ? r.first_signal_at.toISOString() : r.first_signal_at,
      last_signal_at: r.last_signal_at?.toISOString ? r.last_signal_at.toISOString() : r.last_signal_at,
      duration_days: Number(r.duration_days),
      composite_demand_index: r.composite_demand_index !== null ? Number(r.composite_demand_index) : undefined,
      priority_band: r.priority_band || undefined,
      metrics: r.metrics || undefined,
      is_demo: r.is_demo,
      created_at: r.created_at?.toISOString ? r.created_at.toISOString() : r.created_at,
      updated_at: r.updated_at?.toISOString ? r.updated_at.toISOString() : r.updated_at
    };
  }
}
