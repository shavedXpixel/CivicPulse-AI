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

async function verifyPostImport() {
  console.log('========================================================================');
  console.log(' PHASE 15B.3 — POST-IMPORT DIRECT POSTGRESQL & CANONICAL VERIFICATION');
  console.log('========================================================================\n');

  const snapshotDir = path.resolve(__dirname, '../../migration/snapshots/2026-09-17T19-46-45-941Z');
  const v3Manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'quarantine-manifest.v3.json'), 'utf8'));
  const v3Closure = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'relational-closure.v3.json'), 'utf8'));
  const v3Partition = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'migration-partition.v3.json'), 'utf8'));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  const tables = [
    'departments', 'users', 'citizen_profiles', 'signals', 'problem_clusters',
    'cluster_members', 'signal_media', 'assignments', 'problem_actions',
    'resolution_evidence', 'verification_results', 'ai_operations', 'idempotency_records'
  ];

  console.log('1. ACTUAL REMOTE POSTGRESQL TABLE COUNTS:');
  let actualTotal = 0;
  const actualCounts: Record<string, number> = {};
  const actualIds: Record<string, string[]> = {};

  for (const t of tables) {
    const idCol = t === 'idempotency_records' ? 'scoped_key' : t === 'users' ? 'legacy_firebase_uid' : 'id';
    const res = await client.query(`SELECT ${idCol} as id FROM ${t} ORDER BY ${idCol} ASC;`);
    actualCounts[t] = res.rows.length;
    actualTotal += res.rows.length;
    actualIds[t] = res.rows.map((r: any) => r.id);
    const expectedCount = v3Partition.tables[t].authoritative;
    const match = actualCounts[t] === expectedCount ? '✓ PASS' : '✗ FAIL';
    console.log(`   ${match} ${t.padEnd(22)}: Actual=${String(actualCounts[t]).padStart(2)} Expected=${String(expectedCount).padStart(2)}`);
  }

  console.log(`\n   TOTAL POSTGRESQL ROW COUNT: ${actualTotal} (Expected: 77) -> ${actualTotal === 77 ? '✓ PASS' : '✗ FAIL'}\n`);

  // ---------------------------------------------------------------------------
  // 2. Exact ID Set Comparison
  // ---------------------------------------------------------------------------
  console.log('2. EXACT ID SET COMPARISON:');
  let missingTotal = 0;
  let unexpectedTotal = 0;

  for (const t of tables) {
    const expectedIds = new Set(v3Closure.authoritative_id_sets[t] || []);
    const actualSet = new Set(actualIds[t]);

    const missing = Array.from(expectedIds).filter(id => !actualSet.has(id));
    const unexpected = actualIds[t].filter(id => !expectedIds.has(id));

    missingTotal += missing.length;
    unexpectedTotal += unexpected.length;

    console.log(`   ${t.padEnd(22)}: Missing=${missing.length} Unexpected=${unexpected.length}`);
    if (missing.length > 0) console.error(`     Missing in ${t}:`, missing);
    if (unexpected.length > 0) console.error(`     Unexpected in ${t}:`, unexpected);
  }
  console.log(`   Summary: Missing IDs = ${missingTotal}, Unexpected IDs = ${unexpectedTotal}\n`);

  // ---------------------------------------------------------------------------
  // 3. Canonical Checksum Comparison
  // ---------------------------------------------------------------------------
  console.log('3. CANONICAL SOURCE CHECKSUM COMPARISON:');
  const sourceChecksums: Record<string, string> = {};
  for (const t of tables) {
    const qSet = new Set(v3Manifest.quarantined_records.filter((r: any) => r.collection === t).map((r: any) => r.document_id));
    const authSource = JSON.parse(fs.readFileSync(path.join(snapshotDir, `${t}.json`), 'utf8')).filter((r: any) => !qSet.has(r.id));
    const hash = sha256(canonicalStringify(authSource));
    sourceChecksums[t] = hash;
    console.log(`   ${t.padEnd(22)} (${String(authSource.length).padStart(2)} records): SHA-256 = ${hash.substring(0, 16)}...`);
  }

  // ---------------------------------------------------------------------------
  // 4. Foreign Key & Relational Verification in PostgreSQL
  // ---------------------------------------------------------------------------
  console.log('\n4. RELATIONAL FOREIGN KEY VALIDATION IN POSTGRESQL:');
  const fkChecks = [
    { name: 'citizen_profiles -> users', query: `SELECT count(*)::int as c FROM citizen_profiles cp LEFT JOIN users u ON cp.user_id = u.id WHERE u.id IS NULL;` },
    { name: 'signals -> users (citizen_id)', query: `SELECT count(*)::int as c FROM signals s LEFT JOIN users u ON s.citizen_id = u.id WHERE s.citizen_id IS NOT NULL AND u.id IS NULL;` },
    { name: 'signals -> problem_clusters', query: `SELECT count(*)::int as c FROM signals s LEFT JOIN problem_clusters p ON s.problem_cluster_id = p.id WHERE s.problem_cluster_id IS NOT NULL AND p.id IS NULL;` },
    { name: 'problem_clusters -> departments', query: `SELECT count(*)::int as c FROM problem_clusters p LEFT JOIN departments d ON p.department_id = d.id WHERE p.department_id IS NOT NULL AND d.id IS NULL;` },
    { name: 'problem_clusters -> users (assigned_to)', query: `SELECT count(*)::int as c FROM problem_clusters p LEFT JOIN users u ON p.assigned_to = u.id WHERE p.assigned_to IS NOT NULL AND u.id IS NULL;` },
    { name: 'assignments -> problem_clusters', query: `SELECT count(*)::int as c FROM assignments a LEFT JOIN problem_clusters p ON a.problem_id = p.id WHERE p.id IS NULL;` },
    { name: 'assignments -> departments', query: `SELECT count(*)::int as c FROM assignments a LEFT JOIN departments d ON a.department_id = d.id WHERE d.id IS NULL;` },
    { name: 'assignments -> users (assigned_to)', query: `SELECT count(*)::int as c FROM assignments a LEFT JOIN users u ON a.assigned_to = u.id WHERE a.assigned_to IS NOT NULL AND u.id IS NULL;` },
    { name: 'assignments -> users (assigned_by)', query: `SELECT count(*)::int as c FROM assignments a LEFT JOIN users u ON a.assigned_by = u.id WHERE u.id IS NULL;` },
    { name: 'problem_actions -> problem_clusters', query: `SELECT count(*)::int as c FROM problem_actions pa LEFT JOIN problem_clusters p ON pa.problem_id = p.id WHERE p.id IS NULL;` },
    { name: 'problem_actions -> users (actor_user_id)', query: `SELECT count(*)::int as c FROM problem_actions pa LEFT JOIN users u ON pa.actor_user_id = u.id WHERE pa.actor_user_id IS NOT NULL AND u.id IS NULL;` },
    { name: 'problem_actions -> departments (target_dept)', query: `SELECT count(*)::int as c FROM problem_actions pa LEFT JOIN departments d ON pa.target_department_id = d.id WHERE pa.target_department_id IS NOT NULL AND d.id IS NULL;` }
  ];

  let totalFkOrphans = 0;
  for (const check of fkChecks) {
    const res = await client.query(check.query);
    const count = res.rows[0].c;
    totalFkOrphans += count;
    console.log(`   ${count === 0 ? '✓ PASS' : '✗ FAIL'} ${check.name}: Orphan Count = ${count}`);
  }
  console.log(`   PostgreSQL Foreign Key Validation Result: ${totalFkOrphans === 0 ? 'PASS (0 orphan FKs)' : 'FAIL'}\n`);

  // ---------------------------------------------------------------------------
  // 5. Quarantine Verification (Ensure 79 records are ABSENT from PostgreSQL)
  // ---------------------------------------------------------------------------
  console.log('5. QUARANTINE ABSENCE VERIFICATION:');
  const qIds = v3Manifest.quarantined_records.map((r: any) => r.document_id);
  console.log(`   Checking ${qIds.length} quarantined IDs against PostgreSQL...`);

  let quarantinedInPostgres = 0;
  for (const t of tables) {
    const qIdsForTable = v3Manifest.quarantined_records.filter((r: any) => r.collection === t).map((r: any) => r.document_id);
    if (qIdsForTable.length === 0) continue;

    const idCol = t === 'idempotency_records' ? 'scoped_key' : t === 'users' ? 'legacy_firebase_uid' : 'id';
    const res = await client.query(`SELECT ${idCol} as id FROM ${t} WHERE ${idCol} = ANY($1::varchar[]);`, [qIdsForTable]);
    if (res.rows.length > 0) {
      quarantinedInPostgres += res.rows.length;
      console.error(`   ✗ LEAK DETECTED: ${res.rows.length} quarantined records found in table '${t}':`, res.rows.map((r: any) => r.id));
    }
  }
  console.log(`   Quarantined Records in Production Domain Tables: ${quarantinedInPostgres} (Expected: 0) -> ${quarantinedInPostgres === 0 ? '✓ PASS' : '✗ FAIL'}\n`);

  // ---------------------------------------------------------------------------
  // 6. AI Operations Semantic Validation
  // ---------------------------------------------------------------------------
  console.log('6. AI OPERATIONS SEMANTIC VALIDATION:');
  const aiOpsRes = await client.query(`SELECT id, operation_type, entity_type, entity_id FROM ai_operations ORDER BY created_at ASC;`);
  console.log(`   Total AI Operations in PostgreSQL: ${aiOpsRes.rows.length}`);

  const authEntityIds = new Set([
    ...actualIds.departments,
    ...actualIds.users,
    ...actualIds.citizen_profiles,
    ...actualIds.signals,
    ...actualIds.problem_clusters,
    ...actualIds.assignments,
    ...actualIds.problem_actions
  ]);

  let aiOpsReferencingAuthoritative = 0;
  let aiOpsReferencingNonAuthoritative = 0;
  const nonAuthDetails: any[] = [];

  for (const op of aiOpsRes.rows) {
    if (authEntityIds.has(op.entity_id)) {
      aiOpsReferencingAuthoritative++;
    } else {
      aiOpsReferencingNonAuthoritative++;
      nonAuthDetails.push({
        id: op.id,
        operation_type: op.operation_type,
        entity_type: op.entity_type,
        entity_id: op.entity_id
      });
    }
  }

  console.log(`   - Referencing Authoritative Domain Entities: ${aiOpsReferencingAuthoritative}`);
  console.log(`   - Referencing Non-Authoritative / Quarantined Entities: ${aiOpsReferencingNonAuthoritative}`);
  console.log(`   Sample non-authoritative references:`, nonAuthDetails.slice(0, 5));

  client.release();
  await pool.end();

  console.log('\n========================================================================');
  console.log(' POST-IMPORT VERIFICATION COMPLETE');
  console.log('========================================================================\n');
}

verifyPostImport().catch(console.error);
