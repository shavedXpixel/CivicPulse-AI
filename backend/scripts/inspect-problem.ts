import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

async function main() {
  const db = getFirestoreDb();
  const doc = await db.collection('problem_clusters').doc('PRB-2026-4047').get();
  console.log('PRB-2026-4047:', JSON.stringify(doc.data(), null, 2));

  // Check signals belonging to PRB-2026-3968
  const membersSnap = await db.collection('cluster_members').where('cluster_id', '==', 'PRB-2026-3968').get();
  console.log('PRB-2026-3968 members:', membersSnap.docs.map(d => d.data()));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
