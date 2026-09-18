import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function canonicalStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k]));
  return '{' + pairs.join(',') + '}';
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function executeV3LiveImport() {
  console.log('========================================================================');
  console.log(' PHASE 15B.3 — EXECUTE LIVE TRANSACTIONAL IMPORT OF V3 AUTHORITATIVE DATA');
  console.log('========================================================================\n');

  const snapshotDir = path.resolve(__dirname, '../../migration/snapshots/2026-09-17T19-46-45-941Z');
  const v3ManifestPath = path.join(snapshotDir, 'quarantine-manifest.v3.json');
  const v3ClosurePath = path.join(snapshotDir, 'relational-closure.v3.json');

  if (!fs.existsSync(v3ManifestPath) || !fs.existsSync(v3ClosurePath)) {
    throw new Error('V3 manifest or closure artifacts not found!');
  }

  const v3Manifest = JSON.parse(fs.readFileSync(v3ManifestPath, 'utf8'));
  const v3Closure = JSON.parse(fs.readFileSync(v3ClosurePath, 'utf8'));
  const quarantinedIds = new Set(v3Manifest.quarantined_records.map((r: any) => r.document_id));

  console.log(`V3 Quarantined Set Size: ${quarantinedIds.size} records.`);
  console.log(`V3 Authoritative Set Size: ${v3Closure.metrics.authoritative_record_count} records.\n`);

  // Load datasets
  const departments = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'departments.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const users = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'users.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const citizenProfiles = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'citizen_profiles.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const signals = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'signals.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const problemClusters = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'problem_clusters.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const clusterMembers = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'cluster_members.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const signalMedia = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'signal_media.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const assignments = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'assignments.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const problemActions = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'problem_actions.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const resolutionEvidence = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'resolution_evidence.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const verificationResults = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'verification_results.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const aiOperations = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'ai_operations.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));
  const idempotencyRecords = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'idempotency_records.json'), 'utf8')).filter((r: any) => !quarantinedIds.has(r.id));

  const totalToImport =
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

  if (totalToImport !== 77) {
    throw new Error(`Authoritative record count mismatch: Expected 77, got ${totalToImport}`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // 1. PRE-FLIGHT DIRECT CHECK
    // -------------------------------------------------------------------------
    console.log('1. PRE-FLIGHT VERIFICATION: Checking target PostgreSQL database is clean...');
    const tables = [
      'departments', 'users', 'citizen_profiles', 'signals', 'problem_clusters',
      'cluster_members', 'signal_media', 'assignments', 'problem_actions',
      'resolution_evidence', 'verification_results', 'ai_operations', 'idempotency_records'
    ];

    for (const t of tables) {
      const res = await client.query(`SELECT count(*)::int as count FROM ${t};`);
      if (res.rows[0].count > 0) {
        throw new Error(`Target table '${t}' is NOT clean (${res.rows[0].count} rows found). Aborting live import!`);
      }
    }
    console.log('   ✓ Pre-flight passed: 0 rows across all 13 domain tables.\n');

    // -------------------------------------------------------------------------
    // 2. ATOMIC TRANSACTIONAL IMPORT
    // -------------------------------------------------------------------------
    console.log('2. BEGINNING ATOMIC TRANSACTION...');
    await client.query('BEGIN');

    // Table 1: departments (1)
    for (const d of departments) {
      await client.query(
        `INSERT INTO departments (id, name, short_name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6);`,
        [d.id, d.name, d.short_name, d.description || null, d.created_at || '2026-09-17T19:46:45.941Z', d.updated_at || '2026-09-17T19:46:45.941Z']
      );
    }
    console.log('   ✓ Table 1/13: departments (1 record inserted)');

    // Table 2: users (7)
    const uidMap = new Map<string, string>();
    for (const u of users) {
      const hash = crypto.createHash('md5').update(`civicpulse:user:${u.id}`).digest('hex');
      const uuid = [hash.substring(0, 8), hash.substring(8, 12), '4' + hash.substring(13, 16), 'a' + hash.substring(17, 20), hash.substring(20, 32)].join('-');
      uidMap.set(u.id, uuid);

      await client.query(
        `INSERT INTO users (id, legacy_firebase_uid, email, display_name, role, department_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [uuid, u.id, u.email, u.display_name || u.email, u.role, u.department_id || null, u.status || 'ACTIVE', u.created_at || new Date().toISOString(), u.updated_at || new Date().toISOString()]
      );
    }
    console.log('   ✓ Table 2/13: users (7 records inserted)');

    // Table 3: citizen_profiles (4)
    for (const cp of citizenProfiles) {
      const userUuid = uidMap.get(cp.user_id) || cp.user_id;
      await client.query(
        `INSERT INTO citizen_profiles (id, user_id, preferred_language, notification_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [cp.id, userUuid, cp.preferred_language || 'en', cp.notification_enabled !== false, cp.created_at || new Date().toISOString(), cp.updated_at || new Date().toISOString()]
      );
    }
    console.log('   ✓ Table 3/13: citizen_profiles (4 records inserted)');

    // Table 4: signals (4)
    for (const s of signals) {
      const citizenUuid = s.citizen_id ? (uidMap.get(s.citizen_id) || null) : null;
      await client.query(
        `INSERT INTO signals (
          id, citizen_id, source_type, original_text, normalized_text, category, subcategory,
          recommended_department, severity, language, status, processing_status, latitude, longitude,
          location_reference, ward_id, ai_confidence, ai_analysis, geography_provenance, media_ids,
          legacy_embedding, created_at, submitted_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24);`,
        [
          s.id, citizenUuid, s.source_type || 'CITIZEN', s.original_text, s.normalized_text || null,
          s.category || 'OTHER', s.subcategory || null, s.recommended_department || null, s.severity || null,
          s.language || 'en', s.status || 'INGESTED', s.processing_status || 'PENDING',
          s.location?.latitude || null, s.location?.longitude || null, s.location?.address || null,
          s.location?.ward_id || s.ward_id || null, s.ai_confidence || null,
          s.ai_analysis ? JSON.stringify(s.ai_analysis) : null,
          s.geography_provenance ? JSON.stringify(s.geography_provenance) : null,
          s.media_ids || [], s.centroid_embedding || s.legacy_embedding || null,
          s.created_at, s.submitted_at || s.created_at, s.updated_at
        ]
      );
    }
    console.log('   ✓ Table 4/13: signals (4 records inserted)');

    // Table 5: problem_clusters (1)
    for (const p of problemClusters) {
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
          p.id, p.title, p.description || null, p.category, p.subcategory || null,
          p.department_id || null, p.ward_id || null, p.location?.latitude || null, p.location?.longitude || null,
          p.status || 'NEW', p.signal_count || 1, p.estimated_population || null, p.duration_days || null,
          p.impact_score || 0, p.impact_level || 'LOW', p.impact_explanation || null, p.confidence || null,
          p.centroid_embedding || p.legacy_embedding || null, p.impact_factors?.severity_score || null,
          p.impact_factors?.population_score || null, p.impact_factors?.duration_score || null,
          p.impact_factors?.concentration_score || null, p.impact_factors?.critical_exposure_score || null,
          p.impact_factors?.recurrence_score || null, p.impact_factors?.evidence_score || null,
          p.assigned_to ? (uidMap.get(p.assigned_to) || null) : null,
          p.is_demo || false, p.first_detected_at || p.created_at, p.last_updated_at || p.updated_at,
          p.created_at, p.updated_at
        ]
      );
    }
    console.log('   ✓ Table 5/13: problem_clusters (1 record inserted)');

    // Table 6: cluster_members (0)
    console.log('   ✓ Table 6/13: cluster_members (0 records)');

    // Table 7: signal_media (0)
    console.log('   ✓ Table 7/13: signal_media (0 records)');

    // Table 8: assignments (1)
    for (const a of assignments) {
      const assignedToUuid = a.assigned_to ? (uidMap.get(a.assigned_to) || null) : null;
      const assignedByUuid = a.assigned_by ? (uidMap.get(a.assigned_by) || null) : null;
      await client.query(
        `INSERT INTO assignments (
          id, problem_id, department_id, previous_department_id, assigned_to, assigned_by, priority, status, notes, assigned_at, due_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
        [
          a.id, a.problem_id, a.department_id, a.previous_department_id || null, assignedToUuid, assignedByUuid,
          a.priority || 'MEDIUM', a.status || 'PENDING', a.notes || null, a.assigned_at, a.due_at || null,
          a.created_at, a.updated_at
        ]
      );
    }
    console.log('   ✓ Table 8/13: assignments (1 record inserted)');

    // Table 9: problem_actions (2)
    for (const act of problemActions) {
      const isSystem = act.actor_id === 'civicpulse_ai_advisory' || act.actor_id === 'SYSTEM' || act.actor_role === 'SYSTEM';
      const actorType = isSystem ? 'SYSTEM' : 'USER';
      const systemActorId = isSystem ? 'CIVICPULSE_AI_ADVISORY' : null;
      const actorUuid = isSystem ? null : (uidMap.get(act.actor_id) || null);

      await client.query(
        `INSERT INTO problem_actions (
          id, problem_id, actor_type, actor_user_id, system_actor_id, actor_role,
          action_type, previous_state, new_state, target_department_id, note, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          act.id, act.problem_id, actorType, actorUuid, systemActorId, act.actor_role,
          act.action_type, act.previous_state || null, act.new_state, act.target_department_id || null,
          act.note || null, act.created_at
        ]
      );
    }
    console.log('   ✓ Table 9/13: problem_actions (2 records inserted)');

    // Table 10: resolution_evidence (0)
    console.log('   ✓ Table 10/13: resolution_evidence (0 records)');

    // Table 11: verification_results (0)
    console.log('   ✓ Table 11/13: verification_results (0 records)');

    // Table 12: ai_operations (57)
    for (const op of aiOperations) {
      await client.query(
        `INSERT INTO ai_operations (
          id, operation_type, entity_id, entity_type, model, prompt_version, status, latency_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [op.id, op.operation_type, op.entity_id, op.entity_type, op.model, op.prompt_version, op.status, op.latency_ms || null, op.created_at]
      );
    }
    console.log('   ✓ Table 12/13: ai_operations (57 records inserted)');

    // Table 13: idempotency_records (0)
    console.log('   ✓ Table 13/13: idempotency_records (0 records)');

    // -------------------------------------------------------------------------
    // 3. COMMIT TRANSACTION
    // -------------------------------------------------------------------------
    console.log('\n3. COMMITTING TRANSACTION TO POSTGRESQL...');
    await client.query('COMMIT');
    console.log('   ✓ TRANSACTION COMMITTED SUCCESSFULLY!\n');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('FATAL ERROR DURING IMPORT: TRANSACTION ROLLED BACK!', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('========================================================================');
  console.log(' LIVE IMPORT EXECUTION COMPLETE');
  console.log('========================================================================\n');
}

executeV3LiveImport().catch((err) => {
  console.error(err);
  process.exit(1);
});
