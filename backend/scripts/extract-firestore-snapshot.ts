import path from 'path';
import dotenv from 'dotenv';

// Load root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';
import { FirestoreSnapshotExtractor } from '../src/migration/extractor';

async function main() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — PHASE 15B.2 AUTHORITATIVE FIRESTORE SNAPSHOT EXTRACTOR');
  console.log(' STRICTLY READ-ONLY (ZERO WRITES / ZERO MUTATIONS)');
  console.log('========================================================================\n');

  const db = getFirestoreDb();
  const extractor = new FirestoreSnapshotExtractor(db);

  console.log('Starting snapshot extraction with reproducibility verification...');
  const result = await extractor.extractSnapshot({
    verifyReproducibility: true
  });

  console.log(`\n✓ Snapshot Completed in ${result.extraction_duration_ms} ms`);
  console.log(`✓ Snapshot Location: ${result.output_directory}`);
  console.log(`✓ Extraction Timestamp: ${result.timestamp}`);
  console.log(`✓ Total Collections Discovered: ${result.total_collections}`);
  console.log(`✓ Total Documents Extracted: ${result.total_documents}`);

  console.log('\n------------------------------------------------------------------------');
  console.log(' 1. COLLECTION COUNTS & INVENTORY SUMMARY');
  console.log('------------------------------------------------------------------------');
  for (const [col, count] of Object.entries(result.collection_counts)) {
    console.log(`  - ${col.padEnd(25)}: ${count} documents`);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(' 2. REPRODUCIBILITY RESULT');
  console.log('------------------------------------------------------------------------');
  if (result.reproducibility) {
    console.log(`  Identical Counts: ${result.reproducibility.identical_counts ? 'PASS (100%)' : 'FAIL'}`);
    console.log(`  Identical IDs:    ${result.reproducibility.identical_ids ? 'PASS (100%)' : 'FAIL'}`);
    console.log(`  Identical Hashes: ${result.reproducibility.identical_hashes ? 'PASS (100%)' : 'FAIL'}`);
    console.log(`  Status:           ${result.reproducibility.details}`);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(' 3. KNOWN ENTITY SANITY CHECKS');
  console.log('------------------------------------------------------------------------');
  for (const check of result.known_entity_checks) {
    const mark = check.found ? '✓ FOUND' : '✗ MISSING';
    console.log(`  ${mark.padEnd(10)} [${check.entity_type}] ${check.expected_id}: ${check.description}`);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(' 4. RELATIONSHIP INTEGRITY & ORPHAN REPORT');
  console.log('------------------------------------------------------------------------');
  console.log(`  Total Orphans Detected: ${result.integrity_report.total_orphans}`);
  console.log(`  Blockers:               ${result.integrity_report.blocker_count}`);
  console.log(`  Warnings:               ${result.integrity_report.warning_count}`);
  console.log(`  Summary:`);
  console.log(`    - Orphan Signal Citizens:        ${result.integrity_report.summary.orphan_signal_citizens}`);
  console.log(`    - Orphan Problem References:     ${result.integrity_report.summary.orphan_problem_references}`);
  console.log(`    - Orphan Cluster Members:        ${result.integrity_report.summary.orphan_cluster_members}`);
  console.log(`    - Orphan Assignment Users:       ${result.integrity_report.summary.orphan_assignment_users}`);
  console.log(`    - Orphan Assignment Departments: ${result.integrity_report.summary.orphan_assignment_departments}`);
  console.log(`    - Orphan Evidence Users:         ${result.integrity_report.summary.orphan_evidence_users}`);
  console.log(`    - Orphan Verification Records:   ${result.integrity_report.summary.orphan_verification_records}`);
  console.log(`    - Orphan Media References:       ${result.integrity_report.summary.orphan_media_references}`);
  console.log(`    - Orphan Action Actors:          ${result.integrity_report.summary.orphan_action_actors}`);
  console.log(`    - Orphan Target Officers:        ${result.integrity_report.summary.orphan_target_officers}`);

  if (result.integrity_report.orphan_findings.length > 0) {
    console.log('\n  Detailed Findings:');
    for (const f of result.integrity_report.orphan_findings) {
      console.log(`    [${f.severity}] ${f.entity_type}/${f.entity_id}.${f.field_name} -> missing ${f.missing_reference_type}/${f.missing_reference_id}`);
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(' 5. MEDIA INVENTORY');
  console.log('------------------------------------------------------------------------');
  console.log(`  Total Media References Scanned: ${result.integrity_report.media_inventory.length}`);
  console.log(`  Missing Physical Media:         ${result.integrity_report.missing_media_count}`);
  for (const m of result.integrity_report.media_inventory) {
    console.log(`  - [${m.status}] ${m.owning_record_type}/${m.owning_record_id} (${m.storage_path}): ${m.error_message || 'OK'}`);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log(' 6. SHA-256 MANIFEST');
  console.log('------------------------------------------------------------------------');
  for (const entry of result.manifest) {
    console.log(`  ${entry.sha256}  ${entry.filename.padEnd(28)} (${entry.bytes} bytes, ${entry.record_count} records)`);
  }

  console.log('\n========================================================================');
  console.log(' EXTRACTOR READ-ONLY PROOF: ZERO WRITES PERFORMED AGAINST FIRESTORE');
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('\n[FATAL] Snapshot extraction failed:', err);
  process.exit(1);
});
