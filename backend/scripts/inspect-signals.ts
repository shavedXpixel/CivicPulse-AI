import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

async function main() {
  const db = getFirestoreDb();
  const snap = await db.collection('signals').get();
  console.log('--- SIGNALS DETAILS ---');
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, 'status:', data.status, 'cluster:', data.problem_cluster_id || data.cluster_id);
  });
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
