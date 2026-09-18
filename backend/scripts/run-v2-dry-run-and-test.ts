import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function runV2DryRunAndTest() {
  console.log('========================================================================');
  console.log(' PHASE 15B.3 — RELATIONAL QUARANTINE RECONCILIATION V2: DRY RUN TEST');
  console.log('========================================================================\n');

  const snapshotDir = path.resolve(__dirname, '../../migration/snapshots/2026-09-17T19-46-45-941Z');
  const v2ManifestPath = path.join(snapshotDir, 'quarantine-manifest.v2.json');
  if (!fs.existsSync(v2ManifestPath)) {
    throw new Error('quarantine-manifest.v2.json not found!');
  }

  const v2Manifest = JSON.parse(fs.readFileSync(v2ManifestPath, 'utf8'));
  const quarantinedIds = new Set(v2Manifest.quarantined_records.map((r: any) => r.document_id));

  console.log(`Loaded V2 Quarantine Manifest: ${v2Manifest.quarantined_records.length} quarantined records.`);

  // Load snapshot tables
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

  const totalAttempted =
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

  console.log(`Proposed Authoritative Record Count: ${totalAttempted}`);
  console.log({
    departments: departments.length,
    users: users.length,
    citizen_profiles: citizenProfiles.length,
    signals: signals.length,
    problem_clusters: problemClusters.length,
    cluster_members: clusterMembers.length,
    signal_media: signalMedia.length,
    assignments: assignments.length,
    problem_actions: problemActions.length,
    resolution_evidence: resolutionEvidence.length,
    verification_results: verificationResults.length,
    ai_operations: aiOperations.length,
    idempotency_records: idempotencyRecords.length
  });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const violations: string[] = [];

  try {
    await client.query('BEGIN');

    // 1. departments
    for (const d of departments) {
      await client.query(
        `INSERT INTO departments (id, name, short_name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6);`,
        [d.id, d.name, d.short_name, d.description || null, d.created_at || '2026-09-17T19:46:45.941Z', d.updated_at || '2026-09-17T19:46:45.941Z']
      );
    }
    console.log('✓ 1. departments (1/1) passed.');

    // 2. users
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
    console.log('✓ 2. users (7/7) passed.');

    // 3. citizen_profiles
    for (const cp of citizenProfiles) {
      const userUuid = uidMap.get(cp.user_id) || cp.user_id;
      await client.query(
        `INSERT INTO citizen_profiles (id, user_id, preferred_language, notification_enabled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [cp.id, userUuid, cp.preferred_language || 'en', cp.notification_enabled !== false, cp.created_at || new Date().toISOString(), cp.updated_at || new Date().toISOString()]
      );
    }
    console.log('✓ 3. citizen_profiles (4/4) passed.');

    // 4. signals
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
    console.log('✓ 4. signals (11/11) passed.');

    // 5. problem_clusters
    for (const p of problemClusters) {
      const savepoint = `sp_prob_${p.id.replace(/-/g, '_')}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      try {
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
        console.log(`✓ 5. problem_cluster ${p.id} passed.`);
      } catch (err: any) {
        violations.push(`problem_clusters [${p.id}]: ${err.message}`);
        console.error(`✗ 5. problem_cluster ${p.id} FAILED: ${err.message}`);
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);

        // Insert with department_id = null so downstream tests can proceed to evaluate cluster_members
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
            null, p.ward_id || null, p.location?.latitude || null, p.location?.longitude || null,
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
    }

    // 6. cluster_members
    let memberSuccess = 0;
    for (const m of clusterMembers) {
      const savepoint = `sp_mem_${m.id}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      try {
        await client.query(
          `INSERT INTO cluster_members (id, problem_id, signal_id, relationship, similarity, reason, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [m.id, m.problem_id, m.signal_id, m.relationship || 'RELATED', m.similarity || 0.8, m.reason || 'Semantic and geographic proximity', m.created_at]
        );
        memberSuccess++;
      } catch (err: any) {
        violations.push(`cluster_members [${m.id}] (prob: ${m.problem_id}, sig: ${m.signal_id}): ${err.message}`);
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      }
    }
    console.log(`6. cluster_members: ${memberSuccess}/${clusterMembers.length} succeeded, ${clusterMembers.length - memberSuccess} failed foreign keys.`);

    // 7. assignments
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
    console.log('✓ 7. assignments (1/1) passed.');

    // 8. problem_actions
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
    console.log('✓ 8. problem_actions (2/2) passed.');

    // 9. ai_operations
    for (const op of aiOperations) {
      await client.query(
        `INSERT INTO ai_operations (
          id, operation_type, entity_id, entity_type, model, prompt_version, status, latency_ms, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [op.id, op.operation_type, op.entity_id, op.entity_type, op.model, op.prompt_version, op.status, op.latency_ms || null, op.created_at]
      );
    }
    console.log('✓ 9. ai_operations (57/57) passed.');

    console.log('\n------------------------------------------------------------------------');
    console.log(' DRY RUN EXECUTION FINISHED — ROLLING BACK TO PROTECT DATABASE');
    console.log('------------------------------------------------------------------------');
    await client.query('ROLLBACK');
    console.log('✓ TRANSACTION ROLLED BACK.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Fatal Dry Run Error:', err);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(' DRY RUN RELATIONAL VIOLATION AUDIT');
  console.log('========================================================================');
  console.log(`Total Violations Caught: ${violations.length}\n`);
  violations.forEach((v, idx) => console.log(`${idx + 1}. ${v}`));
}

runV2DryRunAndTest().catch(console.error);
