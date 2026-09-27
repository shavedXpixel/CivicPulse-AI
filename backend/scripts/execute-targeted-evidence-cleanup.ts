import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import { PostgresDatabaseProvider } from '../src/providers/database/postgres.provider';
import { R2StorageProvider } from '../src/providers/storage/r2.storage';
import { ProviderContainer } from '../src/providers';
import { ProblemStatus } from '@civicpulse/shared';

async function main() {
  console.log('========================================================================');
  console.log(' TARGETED EVIDENCE CLEANUP FOR PRB-2026-8415');
  console.log('========================================================================\n');

  const db = new PostgresDatabaseProvider();
  ProviderContainer.setDatabaseProvider(db);
  const r2Storage = new R2StorageProvider();
  (ProviderContainer as any).storageInstance = r2Storage;

  const problemId = 'PRB-2026-8415';

  // --- 0. PRE-CLEANUP SNAPSHOT ---
  const initialProblem = await db.getProblemCluster(problemId);
  if (!initialProblem) {
    throw new Error(`CRITICAL: Problem ${problemId} not found!`);
  }
  const initialEvidence = await db.getResolutionEvidence(problemId);
  const initialSignalMedia = await db.query(
    `SELECT * FROM signal_media WHERE storage_path LIKE 'evidence/PRB-2026-8415/%';`
  );
  const initialActions = await db.getActions(problemId);

  console.log('[CURRENT SNAPSHOT]');
  console.log(`- Problem: ${initialProblem.id} (${initialProblem.status})`);
  console.log(`- Department: ${initialProblem.department_id} | Assigned To: ${initialProblem.assigned_to}`);
  console.log(`- resolution_evidence rows: ${initialEvidence.length}`);
  console.log(`- signal_media rows:       ${initialSignalMedia.length}`);
  console.log(`- problem_actions rows:    ${initialActions.length}\n`);

  // Target IDs for strict deletion
  const targetEvidenceIds = [
    'evd_1790532724244_3k7o',
    'evd_1790518650297_hrqy',
    'evd_1790518491307_2rut',
    'evd_1790518442353_otbh',
    'evd_1790518233495_ouj9',
    'evd_1790518160395_4f9q'
  ];

  const targetMediaIds = [
    'evd_med_1790532719861_coamyc',
    'evd_med_1790519477942_tidetb',
    'evd_med_1790519265716_bcmye7',
    'evd_med_1790518644886_v4t04o',
    'evd_med_1790518486720_dfxgbi',
    'evd_med_1790518437576_s4smn9'
  ];

  const targetR2Keys = [
    'evidence/PRB-2026-8415/evd_med_1790532719861_coamyc-images__1_.jpg',
    'evidence/PRB-2026-8415/evd_med_1790519477942_tidetb-images__1_.jpg',
    'evidence/PRB-2026-8415/evd_med_1790519265716_bcmye7-images__1_.jpg',
    'evidence/PRB-2026-8415/evd_med_1790518644886_v4t04o-street_light_repaired_after.png',
    'evidence/PRB-2026-8415/evd_med_1790518486720_dfxgbi-street_light_repaired_after.png',
    'evidence/PRB-2026-8415/evd_med_1790518437576_s4smn9-street_light_repaired_after.png',
    'evidence/PRB-2026-8415/evd_med_1790518228399_82c4mb-street_light_repaired_after.png',
    'evidence/PRB-2026-8415/evd_med_1790518153843_9ooum0-street_light_repaired_after.png'
  ];

  // --- 1. DELETE RESOLUTION EVIDENCE ROWS ---
  console.log('[1. DELETING RESOLUTION EVIDENCE ROWS]');
  const deleteEvidenceRes = await db.query(
    `DELETE FROM resolution_evidence WHERE problem_id = $1 AND id = ANY($2::text[]) RETURNING id;`,
    [problemId, targetEvidenceIds]
  );
  console.log(`Deleted ${deleteEvidenceRes.length} resolution_evidence rows.`);

  // --- 2. DELETE SIGNAL MEDIA ROWS ---
  console.log('\n[2. DELETING SIGNAL MEDIA ROWS]');
  const deleteMediaRes = await db.query(
    `DELETE FROM signal_media WHERE storage_path LIKE 'evidence/PRB-2026-8415/%' AND id = ANY($1::text[]) RETURNING id;`,
    [targetMediaIds]
  );
  console.log(`Deleted ${deleteMediaRes.length} signal_media rows.`);

  // --- 3. DELETE R2 OBJECTS ---
  console.log('\n[3. DELETING R2 OBJECTS]');
  for (const key of targetR2Keys) {
    if (!key.startsWith('evidence/PRB-2026-8415/')) {
      throw new Error(`SAFETY ABORT: Refusing to delete key outside evidence/PRB-2026-8415/: ${key}`);
    }
    const existsBefore = await r2Storage.objectExists(key);
    if (existsBefore) {
      await r2Storage.deleteFile(key);
      const existsAfter = await r2Storage.objectExists(key);
      console.log(`- Deleted R2 key: ${key} (verified absent: ${!existsAfter})`);
    } else {
      console.log(`- R2 key already absent: ${key}`);
    }
  }

  // --- 4. TRANSITION INCIDENT STATUS TO IN_PROGRESS ---
  console.log('\n[4. UPDATING INCIDENT STATUS TO IN_PROGRESS]');
  await db.updateProblemCluster(problemId, {
    status: ProblemStatus.IN_PROGRESS
  });
  console.log(`Incident status updated to ${ProblemStatus.IN_PROGRESS}`);

  // --- 5. POST-CLEANUP VERIFICATION ---
  console.log('\n[5. POST-CLEANUP AUTHORITATIVE VERIFICATION]');
  const postProblem = await db.getProblemCluster(problemId);
  const postEvidence = await db.getResolutionEvidence(problemId);
  const postSignalMedia = await db.query(
    `SELECT * FROM signal_media WHERE storage_path LIKE 'evidence/PRB-2026-8415/%';`
  );
  const postActions = await db.getActions(problemId);

  // Check citizen signal
  const members = await db.getProblemClusterMembers(problemId);
  const memberSignal = members.length > 0 ? await db.getSignal(members[0].signal_id) : null;

  // Check all 8 R2 objects
  let anyR2Remain = false;
  for (const key of targetR2Keys) {
    const stillExists = await r2Storage.objectExists(key);
    if (stillExists) {
      anyR2Remain = true;
      console.error(`ERROR: R2 object still exists: ${key}`);
    }
  }

  console.log('\n[AFTER CLEANUP]');
  console.log(`- Problem Exists:            ${Boolean(postProblem)} (ID: ${postProblem?.id})`);
  console.log(`- Status:                    ${postProblem?.status}`);
  console.log(`- Department:                ${postProblem?.department_id} (WATCO)`);
  console.log(`- Assigned Officer:          ${postProblem?.assigned_to}`);
  console.log(`- Citizen Signal Exists:     ${Boolean(memberSignal)} (ID: ${memberSignal?.id})`);
  console.log(`- Citizen Signal Text:       "${memberSignal?.original_text || memberSignal?.normalized_text || ''}"`);
  console.log(`- resolution_evidence count: ${postEvidence.length} (Expected: 0)`);
  console.log(`- signal_media count:       ${postSignalMedia.length} (Expected: 0)`);
  console.log(`- R2 test objects remaining: ${anyR2Remain ? 'FAIL' : '0 (ALL DELETED)'}`);
  console.log(`- problem_actions count:    ${postActions.length} (PRESERVED: 22)`);

  if (postEvidence.length === 0 && postSignalMedia.length === 0 && !anyR2Remain && postProblem) {
    console.log('\n>>> CLEANUP SUCCEEDED WITH 100% INTEGRITY <<<');
  } else {
    throw new Error('Post-cleanup verification assertions failed!');
  }
}

main().catch((err) => {
  console.error('Cleanup execution failed:', err);
  process.exit(1);
});
