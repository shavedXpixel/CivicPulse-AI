import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

async function restorePristineBaseline() {
  const db = getFirestoreDb();
  console.log('Restoring PRB-2026-3968 and related records to pristine baseline...');

  // 1. Restore PRB-2026-3968 exact fields
  await db.collection('problem_clusters').doc('PRB-2026-3968').set({
    id: 'PRB-2026-3968',
    title: 'A major drinking water pipeline has burst on Janpath near Unit 3 Market Square, flooding traffic lanes and shop entrances.',
    description: 'Potable water transmission main rupture causing localized flooding and supply outage.',
    category: 'water_supply',
    department_id: 'WATCO',
    ward_id: 'WARD-030',
    location: {
      lat: 20.2785,
      lng: 85.8420
    },
    status: 'ASSIGNED',
    assigned_to: 'fb_uid_officer_synthetic_02', // matches asgn_1789539866388_3ucg
    signal_count: 1,
    impact_score: 75,
    impact_level: 'HIGH',
    created_at: '2026-09-16T06:24:00.000Z',
    updated_at: '2026-09-16T06:24:27.000Z',
    data_provenance: {
      geography: 'REAL',
      population: 'REAL',
      facility: 'REAL'
    }
  });

  // 2. Restore the 2 pre-existing actions inadvertently deleted during cleanup
  await db.collection('problem_actions').doc('act_1789539865711_nbr4').set({
    id: 'act_1789539865711_nbr4',
    problem_id: 'PRB-2026-3968',
    actor_id: 'fb_uid_officer_synthetic_02',
    actor_role: 'DEPARTMENT_OFFICER',
    action_type: 'TRIAGED',
    previous_state: 'NEW',
    new_state: 'TRIAGED',
    target_department_id: 'WATCO',
    note: 'Problem triaged by department dispatcher.',
    created_at: '2026-09-16T06:24:25.711Z'
  });

  await db.collection('problem_actions').doc('act_1789539866388_8w4q').set({
    id: 'act_1789539866388_8w4q',
    problem_id: 'PRB-2026-3968',
    actor_id: 'fb_uid_officer_synthetic_02',
    actor_role: 'DEPARTMENT_OFFICER',
    action_type: 'ASSIGNED',
    previous_state: 'TRIAGED',
    new_state: 'ASSIGNED',
    target_department_id: 'WATCO',
    target_officer_id: 'fb_uid_officer_synthetic_02',
    note: 'Dispatched emergency engineering team for pipeline excavation and valve repair.',
    created_at: '2026-09-16T06:24:26.388Z'
  });

  // 3. Remove orphaned temporary verification from Phase 14 run
  const orphanedVer = await db.collection('verification_results').doc('ver_1789549119697_tv3o').get();
  if (orphanedVer.exists) {
    await db.collection('verification_results').doc('ver_1789549119697_tv3o').delete();
    console.log('Cleaned up orphaned temporary verification ver_1789549119697_tv3o.');
  }

  console.log('✓ Pristine baseline restoration completed.');
  process.exit(0);
}

restorePristineBaseline().catch(err => {
  console.error(err);
  process.exit(1);
});
