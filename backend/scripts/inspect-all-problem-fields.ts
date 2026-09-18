import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

async function main() {
  const db = getFirestoreDb();

  const problems = ['PRB-2026-3968', 'PRB-2026-4047'];
  for (const pid of problems) {
    const doc = await db.collection('problem_clusters').doc(pid).get();
    console.log(`\n=================== ${pid} ===================`);
    if (!doc.exists) {
      console.log('DOES NOT EXIST');
      continue;
    }
    const data = doc.data()!;
    for (const [key, value] of Object.entries(data)) {
      if (key === 'centroid_embedding') {
        console.log(`  ${key}: [Array of ${(value as any).length} floats]`);
      } else {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      }
    }

    // Subcollections / related documents
    const members = await db.collection('cluster_members').where('problem_id', '==', pid).get();
    console.log(`  -> cluster_members (${members.size}):`);
    members.docs.forEach(d => console.log('     ', d.id, d.data()));

    const assignments = await db.collection('assignments').where('problem_id', '==', pid).get();
    console.log(`  -> assignments (${assignments.size}):`);
    assignments.docs.forEach(d => console.log('     ', d.id, d.data()));

    const actions = await db.collection('problem_actions').where('problem_id', '==', pid).get();
    console.log(`  -> problem_actions (${actions.size}):`);
    actions.docs.forEach(d => console.log('     ', d.id, d.data()));

    const evidence = await db.collection('resolution_evidence').where('problem_id', '==', pid).get();
    console.log(`  -> resolution_evidence (${evidence.size}):`);
    evidence.docs.forEach(d => console.log('     ', d.id, d.data()));

    const verifications = await db.collection('verification_results').where('problem_id', '==', pid).get();
    console.log(`  -> verification_results (${verifications.size}):`);
    verifications.docs.forEach(d => console.log('     ', d.id, d.data()));
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
