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

async function executeV4Cleanup() {
  console.log('========================================================================');
  console.log(' PHASE 15B.3 — ATOMIC POSTGRESQL CLEANUP TRANSACTION');
  console.log(' Target: Supabase PostgreSQL 17');
  console.log(' Action: Delete 51 V4 Quarantined ai_operations Records');
  console.log('========================================================================\n');

  const snapshotDir = path.resolve(__dirname, '../../migration/snapshots/2026-09-17T19-46-45-941Z');

  // Load V4 manifest and closure
  const v4Manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'quarantine-manifest.v4.json'), 'utf8'));
  const v4Closure = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'ai-operation-semantic-closure.v4.json'), 'utf8'));
  const v4Partition = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'migration-partition.v4.json'), 'utf8'));

  const tables = [
    'departments', 'users', 'citizen_profiles', 'signals', 'problem_clusters',
    'cluster_members', 'signal_media', 'assignments', 'problem_actions',
    'resolution_evidence', 'verification_results', 'ai_operations', 'idempotency_records'
  ];

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // -------------------------------------------------------------------------
    // 1. PRE-FLIGHT VERIFICATION
    // -------------------------------------------------------------------------
    console.log('------------------------------------------------------------------------');
    console.log(' 1. PRE-FLIGHT VERIFICATION');
    console.log('------------------------------------------------------------------------');

    const expectedPreCounts: Record<string, number> = {
      departments: 1,
      users: 7,
      citizen_profiles: 4,
      signals: 4,
      problem_clusters: 1,
      cluster_members: 0,
      signal_media: 0,
      assignments: 1,
      problem_actions: 2,
      resolution_evidence: 0,
      verification_results: 0,
      ai_operations: 57,
      idempotency_records: 0
    };

    let preFlightTotal = 0;
    for (const t of tables) {
      const res = await client.query(`SELECT COUNT(*)::int as c FROM ${t};`);
      const count = res.rows[0].c;
      preFlightTotal += count;
      const expected = expectedPreCounts[t];
      const match = count === expected;
      console.log(`   ${t.padEnd(22)}: Actual=${String(count).padStart(2)} Expected=${String(expected).padStart(2)} -> ${match ? '✓ MATCH' : '✗ MISMATCH'}`);
      if (!match) {
        throw new Error(`PRE-FLIGHT ABORT: Table '${t}' has count ${count}, expected ${expected}.`);
      }
    }
    console.log(`\n   Pre-Flight Total Rows: ${preFlightTotal} (Expected: 77) -> ${preFlightTotal === 77 ? '✓ PASS' : '✗ FAIL'}`);
    if (preFlightTotal !== 77) {
      throw new Error(`PRE-FLIGHT ABORT: Total rows ${preFlightTotal} !== 77.`);
    }

    // Extract exactly the 51 IDs from quarantine-manifest.v4.json
    const quarantinedOps = v4Manifest.quarantined_records
      .filter((r: any) => r.collection === 'ai_operations')
      .map((r: any) => r.document_id);

    console.log(`\n   Quarantined ai_operations to delete: ${quarantinedOps.length} (Expected: 51)`);
    if (quarantinedOps.length !== 51) {
      throw new Error(`PRE-FLIGHT ABORT: Expected exactly 51 quarantined ai_operations, found ${quarantinedOps.length}`);
    }

    // -------------------------------------------------------------------------
    // 2. ATOMIC TRANSACTION EXECUTION
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log(' 2. ATOMIC TRANSACTION EXECUTION');
    console.log('------------------------------------------------------------------------');

    console.log('>>> Executing: BEGIN;');
    await client.query('BEGIN;');

    try {
      // Step A: Verify all 51 target IDs exist in PostgreSQL
      const checkTargetRes = await client.query(
        'SELECT id FROM ai_operations WHERE id = ANY($1::varchar[]) ORDER BY id ASC;',
        [quarantinedOps]
      );
      console.log(`>>> Target IDs verified in PostgreSQL: ${checkTargetRes.rows.length} / 51`);
      if (checkTargetRes.rows.length !== 51) {
        throw new Error(`TRANSACTION ABORT: Only ${checkTargetRes.rows.length} of 51 target IDs exist in PostgreSQL.`);
      }

      // Step B: DELETE exactly those 51 IDs
      console.log(`>>> Executing: DELETE FROM ai_operations WHERE id = ANY($1::varchar[]);`);
      const deleteRes = await client.query(
        'DELETE FROM ai_operations WHERE id = ANY($1::varchar[]);',
        [quarantinedOps]
      );
      console.log(`>>> Deleted rows: ${deleteRes.rowCount} (Expected: 51)`);
      if (deleteRes.rowCount !== 51) {
        throw new Error(`TRANSACTION ABORT: Expected 51 deleted rows, got ${deleteRes.rowCount}. Rolling back.`);
      }

      // Step C: Verify remaining in-transaction ai_operations count is exactly 6
      const inTxOpsRes = await client.query('SELECT COUNT(*)::int as c FROM ai_operations;');
      const remainingOpsCount = inTxOpsRes.rows[0].c;
      console.log(`>>> In-transaction remaining ai_operations: ${remainingOpsCount} (Expected: 6)`);
      if (remainingOpsCount !== 6) {
        throw new Error(`TRANSACTION ABORT: Remaining ai_operations count is ${remainingOpsCount}, expected 6.`);
      }

      // Step D: Verify exact remaining IDs match the 6 authoritative IDs
      const expectedAuthOps = [
        'ai_op_1788812968596_53fjwc',
        'ai_op_1788872999335_niulyd',
        'ai_op_1788893965005_y4bvfp',
        'ai_op_1788926715449_icfhbe',
        'ai_op_1788980221211_37mkoa',
        'ai_1789549111098_ad42'
      ].sort();

      const inTxOpsIdsRes = await client.query('SELECT id FROM ai_operations ORDER BY id ASC;');
      const actualRemainingOpsIds = inTxOpsIdsRes.rows.map((r: any) => r.id).sort();
      const opsIdsMatch = JSON.stringify(actualRemainingOpsIds) === JSON.stringify(expectedAuthOps);
      console.log(`>>> In-transaction IDs match exact 6 authoritative IDs: ${opsIdsMatch ? '✓ PASS' : '✗ FAIL'}`);
      if (!opsIdsMatch) {
        throw new Error(`TRANSACTION ABORT: Remaining IDs ${JSON.stringify(actualRemainingOpsIds)} do not match expected ${JSON.stringify(expectedAuthOps)}`);
      }

      // Step E: Verify total domain rows across all 13 tables equals 26
      let inTxTotal = 0;
      for (const t of tables) {
        const cRes = await client.query(`SELECT COUNT(*)::int as c FROM ${t};`);
        inTxTotal += cRes.rows[0].c;
      }
      console.log(`>>> In-transaction total domain rows: ${inTxTotal} (Expected: 26)`);
      if (inTxTotal !== 26) {
        throw new Error(`TRANSACTION ABORT: In-transaction total rows ${inTxTotal} !== 26.`);
      }

      // Step F: COMMIT
      console.log('>>> Executing: COMMIT;');
      await client.query('COMMIT;');
      console.log('✓ Cleanup transaction COMMITTED successfully.');

    } catch (txErr) {
      console.error('>>> TRANSACTION FAILED. Executing: ROLLBACK;');
      await client.query('ROLLBACK;');
      throw txErr;
    }

    // -------------------------------------------------------------------------
    // 3. POST-COMMIT REMOTE DATABASE DIRECT VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log(' 3. POST-COMMIT REMOTE DATABASE VERIFICATION');
    console.log('------------------------------------------------------------------------');

    const expectedPostCounts: Record<string, number> = {
      departments: 1,
      users: 7,
      citizen_profiles: 4,
      signals: 4,
      problem_clusters: 1,
      cluster_members: 0,
      signal_media: 0,
      assignments: 1,
      problem_actions: 2,
      resolution_evidence: 0,
      verification_results: 0,
      ai_operations: 6,
      idempotency_records: 0
    };

    let postCommitTotal = 0;
    const actualPostCounts: Record<string, number> = {};
    for (const t of tables) {
      const res = await client.query(`SELECT COUNT(*)::int as c FROM ${t};`);
      const count = res.rows[0].c;
      actualPostCounts[t] = count;
      postCommitTotal += count;
      const expected = expectedPostCounts[t];
      const match = count === expected;
      console.log(`   ${t.padEnd(22)}: Actual=${String(count).padStart(2)} Expected=${String(expected).padStart(2)} -> ${match ? '✓ PASS' : '✗ FAIL'}`);
      if (!match) {
        throw new Error(`POST-COMMIT FAILURE: Table '${t}' has count ${count}, expected ${expected}.`);
      }
    }
    console.log(`\n   TOTAL POSTGRESQL ROWS: ${postCommitTotal} (Expected: 26) -> ${postCommitTotal === 26 ? '✓ PASS' : '✗ FAIL'}\n`);

    // -------------------------------------------------------------------------
    // 4. QUARANTINE ABSENCE & EXACT ID VERIFICATION
    // -------------------------------------------------------------------------
    console.log('------------------------------------------------------------------------');
    console.log(' 4. QUARANTINE ABSENCE & EXACT ID VERIFICATION');
    console.log('------------------------------------------------------------------------');

    // Verify zero quarantined ai_operations remain
    const checkDeletedRes = await client.query(
      'SELECT id FROM ai_operations WHERE id = ANY($1::varchar[]);',
      [quarantinedOps]
    );
    console.log(`   Quarantined ai_operations found in PostgreSQL: ${checkDeletedRes.rows.length} (Must be 0) -> ${checkDeletedRes.rows.length === 0 ? '✓ PASS' : '✗ FAIL'}`);
    if (checkDeletedRes.rows.length > 0) {
      throw new Error(`Quarantined records still linger in PostgreSQL: ${JSON.stringify(checkDeletedRes.rows)}`);
    }

    // Verify all 130 quarantined records are ABSENT from PostgreSQL
    console.log(`   Checking all 130 V4 quarantined records across domain tables...`);
    let quarantinedLeakCount = 0;
    for (const q of v4Manifest.quarantined_records) {
      const idCol = q.collection === 'idempotency_records' ? 'scoped_key' : q.collection === 'users' ? 'legacy_firebase_uid' : 'id';
      const checkRes = await client.query(`SELECT ${idCol} FROM ${q.collection} WHERE ${idCol} = $1;`, [q.document_id]);
      if (checkRes.rows.length > 0) {
        console.error(`     LEAK: Quarantined document ${q.collection}:${q.document_id} found in PostgreSQL!`);
        quarantinedLeakCount++;
      }
    }
    console.log(`   Quarantined records present in PostgreSQL: ${quarantinedLeakCount} (Must be 0) -> ${quarantinedLeakCount === 0 ? '✓ PASS' : '✗ FAIL'}`);
    if (quarantinedLeakCount > 0) {
      throw new Error(`Quarantine validation failed: ${quarantinedLeakCount} quarantined records found in PostgreSQL.`);
    }

    // -------------------------------------------------------------------------
    // 5. SEMANTIC CLOSURE OF 6 PRESERVED AI OPERATIONS
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log(' 5. SEMANTIC VALIDATION OF 6 PRESERVED AI OPERATIONS');
    console.log('------------------------------------------------------------------------');

    const opsRes = await client.query('SELECT * FROM ai_operations ORDER BY id ASC;');
    console.log(`   Preserved ai_operations records in PostgreSQL:`);
    let semanticOrphanCount = 0;

    for (const op of opsRes.rows) {
      let targetValid = false;
      if (op.entity_type === 'signal') {
        const sRes = await client.query('SELECT id FROM signals WHERE id = $1;', [op.entity_id]);
        targetValid = sRes.rows.length === 1;
      } else if (op.entity_type === 'problem_cluster' || op.entity_type === 'intervention_simulation') {
        const pRes = await client.query('SELECT id FROM problem_clusters WHERE id = $1;', [op.entity_id]);
        targetValid = pRes.rows.length === 1;
      }
      if (!targetValid) semanticOrphanCount++;
      console.log(`   - ${op.id.padEnd(30)} [${op.operation_type.padEnd(24)}] -> ${op.entity_type}:${op.entity_id} (${targetValid ? '✓ TARGET VALID' : '✗ TARGET INVALID'})`);
    }

    console.log(`   Semantic orphan references: ${semanticOrphanCount} (Must be 0) -> ${semanticOrphanCount === 0 ? '✓ PASS' : '✗ FAIL'}`);
    if (semanticOrphanCount > 0) {
      throw new Error(`Semantic closure check failed with ${semanticOrphanCount} orphan references.`);
    }

    // -------------------------------------------------------------------------
    // 6. FOREIGN KEY & DATA INTEGRITY AUDIT
    // -------------------------------------------------------------------------
    console.log('\n------------------------------------------------------------------------');
    console.log(' 6. FOREIGN KEY & DATA INTEGRITY AUDIT');
    console.log('------------------------------------------------------------------------');

    // Check FKs:
    // A. signals -> departments
    const orphanSigDept = await client.query(`SELECT id, department_id FROM signals WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT id FROM departments);`);
    console.log(`   Orphan signals.department_id         : ${orphanSigDept.rows.length}`);

    // B. signals -> users (citizen_id)
    const orphanSigUser = await client.query(`SELECT id, citizen_id FROM signals WHERE citizen_id IS NOT NULL AND citizen_id NOT IN (SELECT id FROM users);`);
    console.log(`   Orphan signals.citizen_id            : ${orphanSigUser.rows.length}`);

    // C. signals -> problem_clusters
    const orphanSigProb = await client.query(`SELECT id, problem_cluster_id FROM signals WHERE problem_cluster_id IS NOT NULL AND problem_cluster_id NOT IN (SELECT id FROM problem_clusters);`);
    console.log(`   Orphan signals.problem_cluster_id    : ${orphanSigProb.rows.length}`);

    // D. problem_clusters -> departments
    const orphanProbDept = await client.query(`SELECT id, department_id FROM problem_clusters WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT id FROM departments);`);
    console.log(`   Orphan problem_clusters.department_id: ${orphanProbDept.rows.length}`);

    // E. problem_clusters -> users (assigned_to)
    const orphanProbUser = await client.query(`SELECT id, assigned_to FROM problem_clusters WHERE assigned_to IS NOT NULL AND assigned_to NOT IN (SELECT id FROM users);`);
    console.log(`   Orphan problem_clusters.assigned_to  : ${orphanProbUser.rows.length}`);

    // F. citizen_profiles -> users
    const orphanProfUser = await client.query(`SELECT id, user_id FROM citizen_profiles WHERE user_id NOT IN (SELECT id FROM users);`);
    console.log(`   Orphan citizen_profiles.user_id      : ${orphanProfUser.rows.length}`);

    // G. assignments -> problem_clusters
    const orphanAsgnProb = await client.query(`SELECT id, problem_id FROM assignments WHERE problem_id NOT IN (SELECT id FROM problem_clusters);`);
    console.log(`   Orphan assignments.problem_id        : ${orphanAsgnProb.rows.length}`);

    // H. assignments -> departments
    const orphanAsgnDept = await client.query(`SELECT id, department_id FROM assignments WHERE department_id NOT IN (SELECT id FROM departments);`);
    console.log(`   Orphan assignments.department_id     : ${orphanAsgnDept.rows.length}`);

    // I. assignments -> users (assigned_to, assigned_by)
    const orphanAsgnUsers = await client.query(`SELECT id FROM assignments WHERE (assigned_to IS NOT NULL AND assigned_to NOT IN (SELECT id FROM users)) OR assigned_by NOT IN (SELECT id FROM users);`);
    console.log(`   Orphan assignments users             : ${orphanAsgnUsers.rows.length}`);

    // J. problem_actions -> problem_clusters
    const orphanActProb = await client.query(`SELECT id, problem_id FROM problem_actions WHERE problem_id NOT IN (SELECT id FROM problem_clusters);`);
    console.log(`   Orphan problem_actions.problem_id    : ${orphanActProb.rows.length}`);

    // K. problem_actions -> departments
    const orphanActDept = await client.query(`SELECT id, target_department_id FROM problem_actions WHERE target_department_id IS NOT NULL AND target_department_id NOT IN (SELECT id FROM departments);`);
    console.log(`   Orphan problem_actions.target_dept   : ${orphanActDept.rows.length}`);

    const totalFkOrphans =
      orphanSigDept.rows.length + orphanSigUser.rows.length + orphanSigProb.rows.length +
      orphanProbDept.rows.length + orphanProbUser.rows.length + orphanProfUser.rows.length +
      orphanAsgnProb.rows.length + orphanAsgnDept.rows.length + orphanAsgnUsers.rows.length +
      orphanActProb.rows.length + orphanActDept.rows.length;

    console.log(`\n   TOTAL ORPHAN FOREIGN KEYS: ${totalFkOrphans} (Must be 0) -> ${totalFkOrphans === 0 ? '✓ PASS' : '✗ FAIL'}`);
    if (totalFkOrphans > 0) {
      throw new Error(`FK integrity failure: ${totalFkOrphans} orphan references exist.`);
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(' ATOMIC CLEANUP TRANSACTION & POST-COMMIT VERIFICATION COMPLETE: PASS');
  console.log('========================================================================\n');
}

executeV4Cleanup().catch(err => {
  console.error('FATAL ERROR DURING ATOMIC CLEANUP:', err);
  process.exit(1);
});
