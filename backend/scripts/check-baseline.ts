import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

async function checkBaseline() {
  const db = getFirestoreDb();
  const signalsSnap = await db.collection('signals').get();
  const problemsSnap = await db.collection('problem_clusters').get();
  console.log('--- FIRESTORE BASELINE ---');
  console.log(`Total Signals: ${signalsSnap.size}`);
  console.log(`Signal IDs: ${JSON.stringify(signalsSnap.docs.map(d => d.id))}`);
  console.log(`Total Problems: ${problemsSnap.size}`);
  console.log(`Problem IDs: ${JSON.stringify(problemsSnap.docs.map(d => d.id))}`);
  process.exit(0);
}

checkBaseline().catch(err => {
  console.error(err);
  process.exit(1);
});
