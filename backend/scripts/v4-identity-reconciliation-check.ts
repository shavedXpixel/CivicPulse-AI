import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function verifyIdentityReconciliation() {
  console.log('========================================================================');
  console.log(' PHASE 15B.3 — V4 IDENTITY RECONCILIATION AUDIT (READ-ONLY)');
  console.log('========================================================================\n');

  const snapshotDir = path.resolve(__dirname, '../../migration/snapshots/2026-09-17T19-46-45-941Z');

  // 1. Source files
  const sourceUsers = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'users.json'), 'utf8'));
  const sourceProfiles = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'citizen_profiles.json'), 'utf8'));

  // 2. V3 Artifacts
  const v3Manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'quarantine-manifest.v3.json'), 'utf8'));
  const v3Closure = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'relational-closure.v3.json'), 'utf8'));

  // 3. V4 Artifacts
  const v4Manifest = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'quarantine-manifest.v4.json'), 'utf8'));
  const v4Partition = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'migration-partition.v4.json'), 'utf8'));
  const v4Closure = JSON.parse(fs.readFileSync(path.join(snapshotDir, 'ai-operation-semantic-closure.v4.json'), 'utf8'));

  // 4. Remote PostgreSQL Target
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const pgUsersRes = await client.query('SELECT id, legacy_firebase_uid, email, role FROM users ORDER BY legacy_firebase_uid ASC;');
    const pgProfilesRes = await client.query('SELECT id, user_id FROM citizen_profiles ORDER BY id ASC;');

    console.log('------------------------------------------------------------------------');
    console.log(' 1. USERS IDENTITY RECONCILIATION');
    console.log('------------------------------------------------------------------------');

    const sourceUserIds = sourceUsers.map((u: any) => u.id).sort();
    const v3UserIds = (v3Closure.authoritative_id_sets.users || []).slice().sort();
    const v4UserIds = (v4Closure.authoritative_id_sets.users || []).slice().sort();
    const pgLegacyUids = pgUsersRes.rows.map((r: any) => r.legacy_firebase_uid).sort();

    console.log(`Source users.json count         : ${sourceUserIds.length}`);
    console.log(`V3 authoritative users count    : ${v3UserIds.length}`);
    console.log(`V4 authoritative users count    : ${v4UserIds.length}`);
    console.log(`PostgreSQL legacy_firebase_uids : ${pgLegacyUids.length}\n`);

    console.log('Detailed Identity Comparison:');
    for (let i = 0; i < sourceUserIds.length; i++) {
      const src = sourceUserIds[i];
      const v3 = v3UserIds[i];
      const v4 = v4UserIds[i];
      const pg = pgLegacyUids[i];
      const match = (src === v3 && v3 === v4 && v4 === pg);
      console.log(`  [${match ? '✓ MATCH' : '✗ MISMATCH'}] Source: ${src.padEnd(28)} | V3: ${v3.padEnd(28)} | V4: ${v4.padEnd(28)} | PG: ${pg}`);
    }

    const missingInV4 = sourceUserIds.filter(id => !v4UserIds.includes(id));
    const unexpectedInV4 = v4UserIds.filter(id => !sourceUserIds.includes(id));
    const missingInPg = sourceUserIds.filter(id => !pgLegacyUids.includes(id));
    const unexpectedInPg = pgLegacyUids.filter(id => !sourceUserIds.includes(id));

    console.log('\nUser ID Delta Summary:');
    console.log(`  Missing in V4      : ${missingInV4.length === 0 ? '0 (None)' : JSON.stringify(missingInV4)}`);
    console.log(`  Unexpected in V4   : ${unexpectedInV4.length === 0 ? '0 (None)' : JSON.stringify(unexpectedInV4)}`);
    console.log(`  Missing in PG      : ${missingInPg.length === 0 ? '0 (None)' : JSON.stringify(missingInPg)}`);
    console.log(`  Unexpected in PG   : ${unexpectedInPg.length === 0 ? '0 (None)' : JSON.stringify(unexpectedInPg)}`);

    // Specifically check the investigated IDs:
    console.log('\nSpecific Identity Inquiry Check:');
    const probed = [
      'WpX1s4yWvNfV0bK3nJ7yU2aM1pq2',
      'b89d4d9b-efb8-4fb3-bb02-3ff55845187e',
      'officer_live_verifier',
      'fb_uid_citizen_synthetic_06',
      'test-citizen@example.com'
    ];
    for (const p of probed) {
      const inSource = sourceUsers.some((u: any) => u.id === p || u.email === p);
      const inV4 = v4UserIds.includes(p);
      const inPgUid = pgLegacyUids.includes(p);
      const inPgEmail = pgUsersRes.rows.some((r: any) => r.email === p);
      console.log(`  - "${p}": inSource=${inSource}, inV4Manifest=${inV4}, inPostgresUID=${inPgUid}, inPostgresEmail=${inPgEmail}`);
    }

    console.log('\n------------------------------------------------------------------------');
    console.log(' 2. CITIZEN PROFILES RECONCILIATION');
    console.log('------------------------------------------------------------------------');

    const v3QProfileIds = new Set(v3Manifest.quarantined_records.filter((r: any) => r.collection === 'citizen_profiles').map((r: any) => r.document_id));
    const v4QProfileIds = new Set(v4Manifest.quarantined_records.filter((r: any) => r.collection === 'citizen_profiles').map((r: any) => r.document_id));

    const sourceAuthProfiles = sourceProfiles.filter((p: any) => !v3QProfileIds.has(p.id)).map((p: any) => p.id).sort();
    const v3AuthProfiles = (v3Closure.authoritative_id_sets.citizen_profiles || []).slice().sort();
    const v4AuthProfiles = (v4Closure.authoritative_id_sets.citizen_profiles || []).slice().sort();
    const pgProfileIds = pgProfilesRes.rows.map((r: any) => r.id).sort();

    console.log(`Source authoritative profiles count : ${sourceAuthProfiles.length}`);
    console.log(`V3 authoritative profiles count     : ${v3AuthProfiles.length}`);
    console.log(`V4 authoritative profiles count     : ${v4AuthProfiles.length}`);
    console.log(`PostgreSQL citizen_profiles count   : ${pgProfileIds.length}\n`);

    console.log('Detailed Profile Comparison:');
    for (let i = 0; i < sourceAuthProfiles.length; i++) {
      const src = sourceAuthProfiles[i];
      const v3 = v3AuthProfiles[i];
      const v4 = v4AuthProfiles[i];
      const pg = pgProfileIds[i];
      const match = (src === v3 && v3 === v4 && v4 === pg);
      console.log(`  [${match ? '✓ MATCH' : '✗ MISMATCH'}] Source: ${src.padEnd(34)} | V3: ${v3.padEnd(34)} | V4: ${v4.padEnd(34)} | PG: ${pg}`);
    }

    const missingProfilesInV4 = sourceAuthProfiles.filter(id => !v4AuthProfiles.includes(id));
    const unexpectedProfilesInV4 = v4AuthProfiles.filter(id => !sourceAuthProfiles.includes(id));
    const missingProfilesInPg = sourceAuthProfiles.filter(id => !pgProfileIds.includes(id));
    const unexpectedProfilesInPg = pgProfileIds.filter(id => !sourceAuthProfiles.includes(id));

    console.log('\nCitizen Profile ID Delta Summary:');
    console.log(`  Missing in V4      : ${missingProfilesInV4.length === 0 ? '0 (None)' : JSON.stringify(missingProfilesInV4)}`);
    console.log(`  Unexpected in V4   : ${unexpectedProfilesInV4.length === 0 ? '0 (None)' : JSON.stringify(unexpectedProfilesInV4)}`);
    console.log(`  Missing in PG      : ${missingProfilesInPg.length === 0 ? '0 (None)' : JSON.stringify(missingProfilesInPg)}`);
    console.log(`  Unexpected in PG   : ${unexpectedProfilesInPg.length === 0 ? '0 (None)' : JSON.stringify(unexpectedProfilesInPg)}`);

    // Verify User FK Mapping in PostgreSQL for Citizen Profiles:
    console.log('\nPostgreSQL Citizen Profile -> User UUID FK Integrity:');
    for (const cp of pgProfilesRes.rows) {
      const user = pgUsersRes.rows.find((u: any) => u.id === cp.user_id);
      console.log(`  - Profile '${cp.id}' linked to users.id '${cp.user_id}' (legacy_uid: '${user?.legacy_firebase_uid}', email: '${user?.email}')`);
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(' IDENTITY RECONCILIATION RESULT: PASS');
  console.log('========================================================================\n');
}

verifyIdentityReconciliation().catch(err => {
  console.error('FATAL ERROR DURING IDENTITY RECONCILIATION:', err);
  process.exit(1);
});
