import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

async function verify() {
  console.log('=== PHASE 13 LIVE FIRESTORE VERIFICATION ===');
  const db = getFirestoreDb();

  // 1. Verify WATCO exists
  const watcoDoc = await db.collection('departments').doc('WATCO').get();
  console.log('1. WATCO Department exists:', watcoDoc.exists);
  if (watcoDoc.exists) {
    console.log('   Data:', JSON.stringify(watcoDoc.data(), null, 2));
  }

  // 2. Verify Government Profiles
  const adminDoc = await db.collection('users').doc('fb_uid_admin_synthetic_01').get();
  console.log('\n2a. ADMIN (fb_uid_admin_synthetic_01): exists =', adminDoc.exists);
  if (adminDoc.exists) console.log('    Data:', JSON.stringify(adminDoc.data(), null, 2));

  const deptOffDoc = await db.collection('users').doc('fb_uid_officer_synthetic_02').get();
  console.log('\n2b. DEPT_OFFICER (fb_uid_officer_synthetic_02): exists =', deptOffDoc.exists);
  if (deptOffDoc.exists) console.log('    Data:', JSON.stringify(deptOffDoc.data(), null, 2));

  const fieldOffDoc = await db.collection('users').doc('fb_uid_field_synthetic_03').get();
  console.log('\n2c. FIELD_OFFICER (fb_uid_field_synthetic_03): exists =', fieldOffDoc.exists);
  if (fieldOffDoc.exists) console.log('    Data:', JSON.stringify(fieldOffDoc.data(), null, 2));

  // 3. Verify Citizen
  const citizenDoc = await db.collection('users').doc('fb_uid_citizen_synthetic_05').get();
  console.log('\n3. CITIZEN test-citizen@example.com (fb_uid_citizen_synthetic_05): exists =', citizenDoc.exists);
  if (citizenDoc.exists) console.log('   Data:', JSON.stringify(citizenDoc.data(), null, 2));

  // 4. Count problems and signals
  const probSnap = await db.collection('problems').get();
  const sigSnap = await db.collection('signals').get();
  console.log(`\n4. Existing records preserved: ${probSnap.size} problems, ${sigSnap.size} signals.`);
  console.log('=== VERIFICATION COMPLETED ===');
}

verify().catch(console.error);
