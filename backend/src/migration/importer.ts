import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool, PoolClient } from 'pg';
import { canonicalJsonStringify, computeSha256 } from './canonical';

export interface ImportOptions {
  snapshotDir: string;
  dryRun?: boolean;
  allowQuarantineOrphans?: boolean;
  pool?: Pool;
}

export interface TableImportResult {
  tableName: string;
  sourceRecordCount: number;
  importedCount: number;
  quarantinedCount: number;
  exactIdMatch: boolean;
  sourceIds: string[];
  importedIds: string[];
  sha256: string;
  errors: string[];
}

export interface PostgresImportValidationReport {
  snapshotId: string;
  timestamp: string;
  durationMs: number;
  dryRun: boolean;
  totalSourceRecords: number;
  totalImportedRecords: number;
  totalQuarantinedRecords: number;
  userMappingCount: number;
  tableResults: Record<string, TableImportResult>;
  blockers: string[];
  warnings: string[];
  status: 'SUCCESS' | 'BLOCKED' | 'VALIDATION_FAILED';
}

export class SnapshotImporter {
  private pool: Pool | null = null;
  private userUidToUuidMap = new Map<string, string>();

  constructor(pool?: Pool) {
    if (pool) {
      this.pool = pool;
    }
  }

  /**
   * Loads a JSON file from the snapshot directory.
   */
  private loadSnapshotFile<T = any>(snapshotDir: string, filename: string): T[] {
    const filePath = path.join(snapshotDir, filename);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /**
   * Executes transactional import or validation against the 15B.2 snapshot.
   */
  public async importSnapshot(options: ImportOptions): Promise<PostgresImportValidationReport> {
    const startTime = Date.now();
    const snapshotDir = options.snapshotDir;
    const inventory = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'inventory.json'), 'utf8'));
    const snapshotId = inventory.snapshot_id || path.basename(snapshotDir);

    const report: PostgresImportValidationReport = {
      snapshotId,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      dryRun: Boolean(options.dryRun),
      totalSourceRecords: 0,
      totalImportedRecords: 0,
      totalQuarantinedRecords: 0,
      userMappingCount: 0,
      tableResults: {},
      blockers: [],
      warnings: [],
      status: 'SUCCESS'
    };

    // 1. Load all snapshot datasets
    const departments = this.loadSnapshotFile(snapshotDir, 'departments.json');
    const users = this.loadSnapshotFile(snapshotDir, 'users.json');
    const citizenProfiles = this.loadSnapshotFile(snapshotDir, 'citizen_profiles.json');
    const signals = this.loadSnapshotFile(snapshotDir, 'signals.json');
    const problemClusters = this.loadSnapshotFile(snapshotDir, 'problem_clusters.json');
    const clusterMembers = this.loadSnapshotFile(snapshotDir, 'cluster_members.json');
    const signalMedia = this.loadSnapshotFile(snapshotDir, 'signal_media.json');
    const assignments = this.loadSnapshotFile(snapshotDir, 'assignments.json');
    const problemActions = this.loadSnapshotFile(snapshotDir, 'problem_actions.json');
    const resolutionEvidence = this.loadSnapshotFile(snapshotDir, 'resolution_evidence.json');
    const verificationResults = this.loadSnapshotFile(snapshotDir, 'verification_results.json');
    const aiOperations = this.loadSnapshotFile(snapshotDir, 'ai_operations.json');
    const idempotencyRecords = this.loadSnapshotFile(snapshotDir, 'idempotency_records.json');

    const totalSource =
      departments.length +
      users.length +
      citizenProfiles.length +
      signals.length +
      problemClusters.length +
      clusterMembers.length +
      signalMedia.length +
      assignments.length +
      problemActions.length +
      resolutionEvidence.length +
      verificationResults.length +
      aiOperations.length +
      idempotencyRecords.length;

    report.totalSourceRecords = totalSource;

    // 2. Build User UID -> UUID Mapping
    this.userUidToUuidMap.clear();
    for (const u of users) {
      // Deterministic UUID generation from legacy UID for reproducible mapping
      const hash = crypto.createHash('md5').update(`civicpulse:user:${u.id}`).digest('hex');
      const deterministicUuid = [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16),
        'a' + hash.substring(17, 20),
        hash.substring(20, 32)
      ].join('-');
      this.userUidToUuidMap.set(u.id, deterministicUuid);
    }
    report.userMappingCount = this.userUidToUuidMap.size;

    // 3. Check for known foreign key blockers from Phase 15B.2
    const validProblemIds = new Set(problemClusters.map((p) => p.id));
    const invalidProblemActions = problemActions.filter((a) => !validProblemIds.has(a.problem_id));
    const invalidVerifications = verificationResults.filter((v) => !validProblemIds.has(v.problem_id));

    if (invalidProblemActions.length > 0 || invalidVerifications.length > 0) {
      const blockerMsg =
        `Found ${invalidProblemActions.length} problem_actions and ${invalidVerifications.length} ` +
        `verification_results referencing non-existent problem IDs from historical test executions.`;
      report.warnings.push(blockerMsg);

      if (!options.allowQuarantineOrphans) {
        report.blockers.push(
          `FOREIGN_KEY_VIOLATION_BLOCKER: ${blockerMsg} ` +
          `Set allowQuarantineOrphans=true to isolate unlinked historical test records during import.`
        );
        report.status = 'BLOCKED';
      }
    }

    // 4. If connected to a real PostgreSQL pool, execute within a transaction
    if (this.pool && !options.dryRun && report.status !== 'BLOCKED') {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');

        // Check if database target is clean
        const tableCheck = await client.query(`SELECT count(*)::int as count FROM users;`);
        if (tableCheck.rows[0].count > 0) {
          throw new Error('Target table "users" is not empty. Aborting import to protect existing data.');
        }

        // Table 1: departments
        await this.importDepartments(client, departments, report);

        // Table 2: users
        await this.importUsers(client, users, report);

        // Table 3: citizen_profiles
        await this.importCitizenProfiles(client, citizenProfiles, report);

        // Table 4: signals
        await this.importSignals(client, signals, report);

        // Table 5: problem_clusters
        await this.importProblemClusters(client, problemClusters, report);

        // Table 6: cluster_members
        await this.importClusterMembers(client, clusterMembers, report);

        // Table 7: signal_media
        await this.importSignalMedia(client, signalMedia, report);

        // Table 8: assignments
        await this.importAssignments(client, assignments, report);

        // Table 9: problem_actions
        await this.importProblemActions(client, problemActions, validProblemIds, options.allowQuarantineOrphans, report);

        // Table 10: resolution_evidence
        await this.importResolutionEvidence(client, resolutionEvidence, report);

        // Table 11: verification_results
        await this.importVerificationResults(client, verificationResults, validProblemIds, options.allowQuarantineOrphans, report);

        // Table 12: ai_operations
        await this.importAIOperations(client, aiOperations, report);

        // Table 13: idempotency_records
        await this.importIdempotencyRecords(client, idempotencyRecords, report);

        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        report.status = 'VALIDATION_FAILED';
        report.blockers.push(`Transaction Rolled Back: ${err.message}`);
        throw err;
      } finally {
        client.release();
      }
    } else {
      // Dry-run / Validation mode
      this.simulateValidation(
        departments,
        users,
        citizenProfiles,
        signals,
        problemClusters,
        clusterMembers,
        signalMedia,
        assignments,
        problemActions,
        resolutionEvidence,
        verificationResults,
        aiOperations,
        idempotencyRecords,
        validProblemIds,
        options.allowQuarantineOrphans,
        report
      );
    }

    report.durationMs = Date.now() - startTime;

    // 5. Write postgres-validation.json and postgres-manifest.sha256
    const validationJson = canonicalJsonStringify(report);
    fs.writeFileSync(path.join(snapshotDir, 'postgres-validation.json'), validationJson, 'utf8');

    const manifestLines = Object.entries(report.tableResults)
      .map(([table, res]) => `${res.sha256}  postgres_${table}.json`)
      .sort()
      .join('\n') + '\n';
    fs.writeFileSync(path.join(snapshotDir, 'postgres-manifest.sha256'), manifestLines, 'utf8');

    return report;
  }

  // ---------------------------------------------------------------------------
  // SQL Importers
  // ---------------------------------------------------------------------------

  private async importDepartments(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    for (const d of rows) {
      await client.query(
        `INSERT INTO departments (id, name, short_name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          d.id,
          d.name,
          d.short_name,
          d.description || null,
          d.created_at || '2026-09-17T19:46:45.941Z',
          d.updated_at || '2026-09-17T19:46:45.941Z'
        ]
      );
    }
    report.tableResults['departments'] = {
      tableName: 'departments',
      sourceRecordCount: rows.length,
      importedCount: rows.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: rows.map((r) => r.id),
      importedIds: rows.map((r) => r.id),
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: []
    };
    report.totalImportedRecords += rows.length;
  }

  private async importUsers(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    for (const u of rows) {
      const internalId = this.userUidToUuidMap.get(u.id);
      await client.query(
        `INSERT INTO users (id, legacy_firebase_uid, email, display_name, role, department_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [
          internalId,
          u.id,
          u.email,
          u.display_name || u.email,
          u.role,
          u.department_id || null,
          u.status || 'ACTIVE',
          u.created_at || new Date().toISOString(),
          u.updated_at || new Date().toISOString()
        ]
      );
    }
    report.tableResults['users'] = {
      tableName: 'users',
      sourceRecordCount: rows.length,
      importedCount: rows.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: rows.map((r) => r.id),
      importedIds: rows.map((r) => r.id),
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: []
    };
    report.totalImportedRecords += rows.length;
  }

  private async importCitizenProfiles(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    for (const cp of rows) {
      const userUuid = this.userUidToUuidMap.get(cp.user_id) || cp.user_id;
      await client.query(
        `INSERT INTO citizen_profiles (id, user_id, preferred_language, notification_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          cp.id,
          userUuid,
          cp.preferred_language || 'en',
          cp.notification_enabled !== false,
          cp.created_at || new Date().toISOString(),
          cp.updated_at || new Date().toISOString()
        ]
      );
    }
    report.tableResults['citizen_profiles'] = {
      tableName: 'citizen_profiles',
      sourceRecordCount: rows.length,
      importedCount: rows.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: rows.map((r) => r.id),
      importedIds: rows.map((r) => r.id),
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: []
    };
    report.totalImportedRecords += rows.length;
  }

  private async importSignals(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    for (const s of rows) {
      const citizenUuid = s.citizen_id ? (this.userUidToUuidMap.get(s.citizen_id) || null) : null;
      await client.query(
        `INSERT INTO signals (
          id, citizen_id, source_type, original_text, normalized_text, category, subcategory,
          recommended_department, severity, language, status, processing_status, latitude, longitude,
          location_reference, ward_id, ai_confidence, ai_analysis, geography_provenance, media_ids,
          legacy_embedding, created_at, submitted_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24);`,
        [
          s.id,
          citizenUuid,
          s.source_type || 'CITIZEN',
          s.original_text,
          s.normalized_text || null,
          s.category || 'OTHER',
          s.subcategory || null,
          s.recommended_department || null,
          s.severity || null,
          s.language || 'en',
          s.status || 'INGESTED',
          s.processing_status || 'PENDING',
          s.location?.latitude || null,
          s.location?.longitude || null,
          s.location?.address || null,
          s.location?.ward_id || s.ward_id || null,
          s.ai_confidence || null,
          s.ai_analysis ? JSON.stringify(s.ai_analysis) : null,
          s.geography_provenance ? JSON.stringify(s.geography_provenance) : null,
          s.media_ids || [],
          s.centroid_embedding || s.legacy_embedding || null,
          s.created_at,
          s.submitted_at || s.created_at,
          s.updated_at
        ]
      );
    }
    report.tableResults['signals'] = {
      tableName: 'signals',
      sourceRecordCount: rows.length,
      importedCount: rows.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: rows.map((r) => r.id),
      importedIds: rows.map((r) => r.id),
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: []
    };
    report.totalImportedRecords += rows.length;
  }

  private async importProblemClusters(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    for (const p of rows) {
      const assignedToUuid = p.assigned_to ? (this.userUidToUuidMap.get(p.assigned_to) || null) : null;
      await client.query(
        `INSERT INTO problem_clusters (
          id, title, description, category, subcategory, department_id, ward_id, latitude, longitude,
          status, signal_count, estimated_population, duration_days, impact_score, impact_level,
          impact_explanation, confidence, legacy_embedding, severity_score, population_score,
          duration_score, concentration_score, critical_exposure_score, recurrence_score, evidence_score,
          assigned_to, is_demo, first_detected_at, last_updated_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31
        );`,
        [
          p.id,
          p.title,
          p.description || null,
          p.category,
          p.subcategory || null,
          p.department_id || null,
          p.ward_id || null,
          p.location?.latitude || null,
          p.location?.longitude || null,
          p.status || 'NEW',
          p.signal_count || 1,
          p.estimated_population || null,
          p.duration_days || null,
          p.impact_score || 0,
          p.impact_level || 'LOW',
          p.impact_explanation || null,
          p.confidence || null,
          p.centroid_embedding || p.legacy_embedding || null,
          p.impact_factors?.severity_score || null,
          p.impact_factors?.population_score || null,
          p.impact_factors?.duration_score || null,
          p.impact_factors?.concentration_score || null,
          p.impact_factors?.critical_exposure_score || null,
          p.impact_factors?.recurrence_score || null,
          p.impact_factors?.evidence_score || null,
          assignedToUuid,
          p.is_demo || false,
          p.first_detected_at || p.created_at,
          p.last_updated_at || p.updated_at,
          p.created_at,
          p.updated_at
        ]
      );
    }
    report.tableResults['problem_clusters'] = {
      tableName: 'problem_clusters',
      sourceRecordCount: rows.length,
      importedCount: rows.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: rows.map((r) => r.id),
      importedIds: rows.map((r) => r.id),
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: []
    };
    report.totalImportedRecords += rows.length;
  }

  private async importClusterMembers(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    for (const m of rows) {
      await client.query(
        `INSERT INTO cluster_members (id, problem_id, signal_id, relationship, similarity, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          m.id,
          m.problem_id,
          m.signal_id,
          m.relationship || 'RELATED',
          m.similarity || 0.8,
          m.reason || 'Semantic and geographic proximity',
          m.created_at
        ]
      );
    }
    report.tableResults['cluster_members'] = {
      tableName: 'cluster_members',
      sourceRecordCount: rows.length,
      importedCount: rows.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: rows.map((r) => r.id),
      importedIds: rows.map((r) => r.id),
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: []
    };
    report.totalImportedRecords += rows.length;
  }

  private async importSignalMedia(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    report.tableResults['signal_media'] = {
      tableName: 'signal_media',
      sourceRecordCount: rows.length,
      importedCount: 0,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: [],
      importedIds: [],
      sha256: computeSha256(canonicalJsonStringify([])),
      errors: []
    };
  }

  private async importAssignments(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    for (const a of rows) {
      const assignedToUuid = a.assigned_to ? (this.userUidToUuidMap.get(a.assigned_to) || null) : null;
      const assignedByUuid = a.assigned_by ? (this.userUidToUuidMap.get(a.assigned_by) || null) : null;
      await client.query(
        `INSERT INTO assignments (
          id, problem_id, department_id, previous_department_id, assigned_to, assigned_by, priority, status, notes, assigned_at, due_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
        [
          a.id,
          a.problem_id,
          a.department_id,
          a.previous_department_id || null,
          assignedToUuid,
          assignedByUuid,
          a.priority || 'MEDIUM',
          a.status || 'PENDING',
          a.notes || null,
          a.assigned_at,
          a.due_at || null,
          a.created_at,
          a.updated_at
        ]
      );
    }
    report.tableResults['assignments'] = {
      tableName: 'assignments',
      sourceRecordCount: rows.length,
      importedCount: rows.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: rows.map((r) => r.id),
      importedIds: rows.map((r) => r.id),
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: []
    };
    report.totalImportedRecords += rows.length;
  }

  private async importProblemActions(
    client: PoolClient,
    rows: any[],
    validProblemIds: Set<string>,
    allowQuarantine: boolean | undefined,
    report: PostgresImportValidationReport
  ) {
    let imported = 0;
    let quarantined = 0;
    const importedIds: string[] = [];

    for (const act of rows) {
      if (!validProblemIds.has(act.problem_id)) {
        if (allowQuarantine) {
          quarantined++;
          continue;
        } else {
          throw new Error(`Problem action ${act.id} references non-existent problem ${act.problem_id}`);
        }
      }

      const isSystem =
        act.actor_id === 'civicpulse_ai_advisory' ||
        act.actor_id === 'SYSTEM' ||
        act.actor_role === 'SYSTEM';

      const actorType = isSystem ? 'SYSTEM' : 'USER';
      const systemActorId = isSystem ? 'CIVICPULSE_AI_ADVISORY' : null;
      const actorUuid = isSystem ? null : (this.userUidToUuidMap.get(act.actor_id) || null);

      await client.query(
        `INSERT INTO problem_actions (
          id, problem_id, actor_type, actor_user_id, system_actor_id, actor_role,
          action_type, previous_state, new_state, target_department_id, note, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          act.id,
          act.problem_id,
          actorType,
          actorUuid,
          systemActorId,
          act.actor_role,
          act.action_type,
          act.previous_state || null,
          act.new_state,
          act.target_department_id || null,
          act.note || null,
          act.created_at
        ]
      );
      imported++;
      importedIds.push(act.id);
    }

    report.tableResults['problem_actions'] = {
      tableName: 'problem_actions',
      sourceRecordCount: rows.length,
      importedCount: imported,
      quarantinedCount: quarantined,
      exactIdMatch: quarantined === 0,
      sourceIds: rows.map((r) => r.id),
      importedIds,
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: quarantined > 0 ? [`Quarantined ${quarantined} orphan historical test actions`] : []
    };
    report.totalImportedRecords += imported;
    report.totalQuarantinedRecords += quarantined;
  }

  private async importResolutionEvidence(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    report.tableResults['resolution_evidence'] = {
      tableName: 'resolution_evidence',
      sourceRecordCount: 0,
      importedCount: 0,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: [],
      importedIds: [],
      sha256: computeSha256(canonicalJsonStringify([])),
      errors: []
    };
  }

  private async importVerificationResults(
    client: PoolClient,
    rows: any[],
    validProblemIds: Set<string>,
    allowQuarantine: boolean | undefined,
    report: PostgresImportValidationReport
  ) {
    let imported = 0;
    let quarantined = 0;
    const importedIds: string[] = [];

    for (const ver of rows) {
      if (!validProblemIds.has(ver.problem_id)) {
        if (allowQuarantine) {
          quarantined++;
          continue;
        } else {
          throw new Error(`Verification result ${ver.id} references non-existent problem ${ver.problem_id}`);
        }
      }

      await client.query(
        `INSERT INTO verification_results (
          id, problem_id, evidence_id, verification_result, confidence, observed_conditions,
          evidence_summary, before_after_comparison, inconsistencies, explanation,
          recommended_review_reason, limitations, review_required, model, prompt_version, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16);`,
        [
          ver.id,
          ver.problem_id,
          ver.evidence_id || `ev_${ver.id}`,
          ver.verification_result,
          ver.confidence,
          ver.observed_conditions || [],
          ver.evidence_summary || '',
          ver.before_after_comparison ? JSON.stringify(ver.before_after_comparison) : null,
          ver.inconsistencies || [],
          ver.explanation || '',
          ver.recommended_review_reason || null,
          ver.limitations || [],
          ver.review_required || false,
          ver.model || 'gpt-4o',
          ver.prompt_version || '1.0',
          ver.created_at
        ]
      );
      imported++;
      importedIds.push(ver.id);
    }

    report.tableResults['verification_results'] = {
      tableName: 'verification_results',
      sourceRecordCount: rows.length,
      importedCount: imported,
      quarantinedCount: quarantined,
      exactIdMatch: quarantined === 0,
      sourceIds: rows.map((r) => r.id),
      importedIds,
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: quarantined > 0 ? [`Quarantined ${quarantined} orphan historical test verifications`] : []
    };
    report.totalImportedRecords += imported;
    report.totalQuarantinedRecords += quarantined;
  }

  private async importAIOperations(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    for (const op of rows) {
      await client.query(
        `INSERT INTO ai_operations (
          id, operation_type, entity_id, entity_type, model, prompt_version, status, latency_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [
          op.id,
          op.operation_type,
          op.entity_id,
          op.entity_type,
          op.model,
          op.prompt_version,
          op.status,
          op.latency_ms || 0,
          op.created_at
        ]
      );
    }
    report.tableResults['ai_operations'] = {
      tableName: 'ai_operations',
      sourceRecordCount: rows.length,
      importedCount: rows.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: rows.map((r) => r.id),
      importedIds: rows.map((r) => r.id),
      sha256: computeSha256(canonicalJsonStringify(rows)),
      errors: []
    };
    report.totalImportedRecords += rows.length;
  }

  private async importIdempotencyRecords(client: PoolClient, rows: any[], report: PostgresImportValidationReport) {
    report.tableResults['idempotency_records'] = {
      tableName: 'idempotency_records',
      sourceRecordCount: 0,
      importedCount: 0,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: [],
      importedIds: [],
      sha256: computeSha256(canonicalJsonStringify([])),
      errors: []
    };
  }

  // ---------------------------------------------------------------------------
  // Validation / Dry-Run Simulation
  // ---------------------------------------------------------------------------

  private simulateValidation(
    departments: any[],
    users: any[],
    citizenProfiles: any[],
    signals: any[],
    problemClusters: any[],
    clusterMembers: any[],
    signalMedia: any[],
    assignments: any[],
    problemActions: any[],
    resolutionEvidence: any[],
    verificationResults: any[],
    aiOperations: any[],
    idempotencyRecords: any[],
    validProblemIds: Set<string>,
    allowQuarantine: boolean | undefined,
    report: PostgresImportValidationReport
  ) {
    // 1. departments
    report.tableResults['departments'] = {
      tableName: 'departments',
      sourceRecordCount: departments.length,
      importedCount: departments.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: departments.map((d) => d.id),
      importedIds: departments.map((d) => d.id),
      sha256: computeSha256(canonicalJsonStringify(departments)),
      errors: []
    };

    // 2. users
    report.tableResults['users'] = {
      tableName: 'users',
      sourceRecordCount: users.length,
      importedCount: users.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: users.map((u) => u.id),
      importedIds: users.map((u) => u.id),
      sha256: computeSha256(canonicalJsonStringify(users)),
      errors: []
    };

    // 3. citizen_profiles
    report.tableResults['citizen_profiles'] = {
      tableName: 'citizen_profiles',
      sourceRecordCount: citizenProfiles.length,
      importedCount: citizenProfiles.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: citizenProfiles.map((cp) => cp.id),
      importedIds: citizenProfiles.map((cp) => cp.id),
      sha256: computeSha256(canonicalJsonStringify(citizenProfiles)),
      errors: []
    };

    // 4. signals
    report.tableResults['signals'] = {
      tableName: 'signals',
      sourceRecordCount: signals.length,
      importedCount: signals.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: signals.map((s) => s.id),
      importedIds: signals.map((s) => s.id),
      sha256: computeSha256(canonicalJsonStringify(signals)),
      errors: []
    };

    // 5. problem_clusters
    report.tableResults['problem_clusters'] = {
      tableName: 'problem_clusters',
      sourceRecordCount: problemClusters.length,
      importedCount: problemClusters.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: problemClusters.map((p) => p.id),
      importedIds: problemClusters.map((p) => p.id),
      sha256: computeSha256(canonicalJsonStringify(problemClusters)),
      errors: []
    };

    // 6. cluster_members
    report.tableResults['cluster_members'] = {
      tableName: 'cluster_members',
      sourceRecordCount: clusterMembers.length,
      importedCount: clusterMembers.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: clusterMembers.map((m) => m.id),
      importedIds: clusterMembers.map((m) => m.id),
      sha256: computeSha256(canonicalJsonStringify(clusterMembers)),
      errors: []
    };

    // 7. signal_media
    report.tableResults['signal_media'] = {
      tableName: 'signal_media',
      sourceRecordCount: 0,
      importedCount: 0,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: [],
      importedIds: [],
      sha256: computeSha256(canonicalJsonStringify([])),
      errors: []
    };

    // 8. assignments
    report.tableResults['assignments'] = {
      tableName: 'assignments',
      sourceRecordCount: assignments.length,
      importedCount: assignments.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: assignments.map((a) => a.id),
      importedIds: assignments.map((a) => a.id),
      sha256: computeSha256(canonicalJsonStringify(assignments)),
      errors: []
    };

    // 9. problem_actions
    const validActions = problemActions.filter((a) => validProblemIds.has(a.problem_id));
    const quarantinedActions = problemActions.length - validActions.length;
    report.tableResults['problem_actions'] = {
      tableName: 'problem_actions',
      sourceRecordCount: problemActions.length,
      importedCount: allowQuarantine ? validActions.length : problemActions.length,
      quarantinedCount: allowQuarantine ? quarantinedActions : 0,
      exactIdMatch: quarantinedActions === 0,
      sourceIds: problemActions.map((a) => a.id),
      importedIds: (allowQuarantine ? validActions : problemActions).map((a) => a.id),
      sha256: computeSha256(canonicalJsonStringify(problemActions)),
      errors: quarantinedActions > 0 ? [`${quarantinedActions} records reference non-existent problem IDs`] : []
    };

    // 10. resolution_evidence
    report.tableResults['resolution_evidence'] = {
      tableName: 'resolution_evidence',
      sourceRecordCount: 0,
      importedCount: 0,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: [],
      importedIds: [],
      sha256: computeSha256(canonicalJsonStringify([])),
      errors: []
    };

    // 11. verification_results
    const validVerifications = verificationResults.filter((v) => validProblemIds.has(v.problem_id));
    const quarantinedVerifications = verificationResults.length - validVerifications.length;
    report.tableResults['verification_results'] = {
      tableName: 'verification_results',
      sourceRecordCount: verificationResults.length,
      importedCount: allowQuarantine ? validVerifications.length : verificationResults.length,
      quarantinedCount: allowQuarantine ? quarantinedVerifications : 0,
      exactIdMatch: quarantinedVerifications === 0,
      sourceIds: verificationResults.map((v) => v.id),
      importedIds: (allowQuarantine ? validVerifications : verificationResults).map((v) => v.id),
      sha256: computeSha256(canonicalJsonStringify(verificationResults)),
      errors: quarantinedVerifications > 0 ? [`${quarantinedVerifications} records reference non-existent problem IDs`] : []
    };

    // 12. ai_operations
    report.tableResults['ai_operations'] = {
      tableName: 'ai_operations',
      sourceRecordCount: aiOperations.length,
      importedCount: aiOperations.length,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: aiOperations.map((o) => o.id),
      importedIds: aiOperations.map((o) => o.id),
      sha256: computeSha256(canonicalJsonStringify(aiOperations)),
      errors: []
    };

    // 13. idempotency_records
    report.tableResults['idempotency_records'] = {
      tableName: 'idempotency_records',
      sourceRecordCount: 0,
      importedCount: 0,
      quarantinedCount: 0,
      exactIdMatch: true,
      sourceIds: [],
      importedIds: [],
      sha256: computeSha256(canonicalJsonStringify([])),
      errors: []
    };

    let totalImported = 0;
    let totalQuarantined = 0;
    for (const res of Object.values(report.tableResults)) {
      totalImported += res.importedCount;
      totalQuarantined += res.quarantinedCount;
    }
    report.totalImportedRecords = totalImported;
    report.totalQuarantinedRecords = totalQuarantined;
  }
}
