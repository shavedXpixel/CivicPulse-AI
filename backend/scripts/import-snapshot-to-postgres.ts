import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { SnapshotImporter } from '../src/migration/importer';

async function main() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — PHASE 15B.3 SNAPSHOT TO POSTGRESQL TRANSACTIONAL IMPORTER');
  console.log('========================================================================\n');

  let snapshotsBase = path.resolve(process.cwd(), 'migration', 'snapshots');
  if (!fs.existsSync(snapshotsBase)) {
    snapshotsBase = path.resolve(__dirname, '../../migration/snapshots');
  }
  if (!fs.existsSync(snapshotsBase)) {
    throw new Error(`Snapshot directory ${snapshotsBase} not found.`);
  }

  // Find latest snapshot folder
  const subdirs = fs
    .readdirSync(snapshotsBase)
    .filter((d) => fs.statSync(path.join(snapshotsBase, d)).isDirectory())
    .sort()
    .reverse();

  if (subdirs.length === 0) {
    throw new Error('No snapshots found in migration/snapshots/.');
  }

  const snapshotDir = path.join(snapshotsBase, subdirs[0]);
  console.log(`Using Authoritative Snapshot: ${snapshotDir}`);

  const databaseUrl = process.env.DATABASE_URL;
  let pool: Pool | undefined;

  if (databaseUrl) {
    console.log('Detected DATABASE_URL: Connecting to PostgreSQL...');
    pool = new Pool({ connectionString: databaseUrl });
  } else {
    console.log('No DATABASE_URL provided: Running in dry-run validation mode.');
  }

  const importer = new SnapshotImporter(pool);
  const result = await importer.importSnapshot({
    snapshotDir,
    dryRun: !databaseUrl,
    allowQuarantineOrphans: true
  });

  console.log('\n------------------------------------------------------------------------');
  console.log(' 1. IMPORT & VALIDATION SUMMARY');
  console.log('------------------------------------------------------------------------');
  console.log(`  Snapshot ID:               ${result.snapshotId}`);
  console.log(`  Execution Mode:            ${result.dryRun ? 'DRY-RUN / VALIDATION ONLY' : 'LIVE TRANSACTION'}`);
  console.log(`  Duration:                  ${result.durationMs} ms`);
  console.log(`  Status:                    ${result.status}`);
  console.log(`  User Mappings Created:     ${result.userMappingCount}`);
  console.log(`  Total Source Records:      ${result.totalSourceRecords}`);
  console.log(`  Total Validated Records:   ${result.totalImportedRecords}`);
  console.log(`  Total Quarantined Records: ${result.totalQuarantinedRecords}`);

  console.log('\n------------------------------------------------------------------------');
  console.log(' 2. PER-TABLE VALIDATION BREAKDOWN');
  console.log('------------------------------------------------------------------------');
  for (const [table, res] of Object.entries(result.tableResults)) {
    const matchMark = res.exactIdMatch ? '✓ MATCH' : '⚠ ORPHANS QUARANTINED';
    console.log(
      `  ${matchMark.padEnd(24)} ${table.padEnd(22)}: ` +
      `Source=${String(res.sourceRecordCount).padEnd(3)} ` +
      `Imported=${String(res.importedCount).padEnd(3)} ` +
      `Quarantined=${String(res.quarantinedCount).padEnd(2)} ` +
      `SHA=${res.sha256.substring(0, 12)}...`
    );
  }

  if (result.warnings.length > 0) {
    console.log('\n------------------------------------------------------------------------');
    console.log(' 3. WARNINGS & ORPHAN NOTICES');
    console.log('------------------------------------------------------------------------');
    for (const w of result.warnings) {
      console.log(`  - ${w}`);
    }
  }

  if (result.blockers.length > 0) {
    console.log('\n------------------------------------------------------------------------');
    console.log(' 4. MIGRATION BLOCKERS');
    console.log('------------------------------------------------------------------------');
    for (const b of result.blockers) {
      console.log(`  - ${b}`);
    }
  }

  if (pool) {
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(' VALIDATION ARTIFACTS WRITTEN: postgres-validation.json, postgres-manifest.sha256');
  console.log(' FIRESTORE WAS STRICTLY UNTOUCHED (ZERO FIRESTORE WRITES)');
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('\n[FATAL] Importer failed:', err);
  process.exit(1);
});
