import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

async function restoreBaseline() {
  const db = getFirestoreDb();
  await db.collection('problem_clusters').doc('PRB-2026-3968').set({
    id: 'PRB-2026-3968',
    title: 'A major drinking water pipeline has burst on Janpath near Unit 3 Market Square, flooding traffic lanes and shop entrances.',
    description: 'Potable water transmission main rupture causing localized flooding and supply outage.',
    category: 'water_supply',
    department_id: 'WATCO',
    ward_id: 'WARD-030',
    status: 'ASSIGNED',
    assigned_to: 'fb_uid_field_synthetic_03',
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
  }, { merge: true });

  const signalsSnap = await db.collection('signals').get();
  const problemsSnap = await db.collection('problem_clusters').get();
  console.log('--- VERIFIED BASELINE AFTER RESTORE ---');
  console.log('Total Signals:', signalsSnap.size);
  console.log('Signal IDs:', signalsSnap.docs.map(d => d.id));
  console.log('Total Problems:', problemsSnap.size);
  console.log('Problem IDs:', problemsSnap.docs.map(d => d.id));
  process.exit(0);
}

restoreBaseline().catch(err => {
  console.error(err);
  process.exit(1);
});
