import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getFirebaseAuth, getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

async function inspectIdentities() {
  console.log('===============================================================');
  console.log(' CivicPulse AI — Read-Only Identity & Schema Inspector');
  console.log('===============================================================\n');

  const auth = getFirebaseAuth();
  const db = getFirestoreDb();

  const targetEmails = [
    'admin@example.com',
    'officer@example.com',
    'field@example.com',
    'test-citizen@example.com'
  ];

  console.log('1. Querying Firebase Auth for target accounts:');
  const authResults: Record<string, any> = {};

  for (const email of targetEmails) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      authResults[email] = {
        found: true,
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        disabled: userRecord.disabled,
        emailVerified: userRecord.emailVerified,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime
        },
        customClaims: userRecord.customClaims
      };
      console.log(`   ✓ Found ${email}: UID = ${userRecord.uid}`);
    } catch (err: any) {
      authResults[email] = {
        found: false,
        error: err.code || err.message
      };
      console.log(`   ✗ Not found / Error for ${email}: ${err.message}`);
    }
  }

  // Also list all Auth users to be completely sure about account inventory
  console.log('\n2. Listing all Firebase Auth users in project:');
  try {
    const listUsersResult = await auth.listUsers(50);
    console.log(`   Total users returned: ${listUsersResult.users.length}`);
    for (const u of listUsersResult.users) {
      console.log(`   - [${u.uid}] ${u.email || '(no email)'} | Name: ${u.displayName || '(none)'} | Created: ${u.metadata.creationTime}`);
    }
  } catch (err: any) {
    console.warn('   Could not list auth users:', err.message);
  }

  // 3. Inspect Firestore /users collection for target UIDs
  console.log('\n3. Inspecting Firestore `/users` for target UIDs & existing records:');
  for (const email of targetEmails) {
    const authInfo = authResults[email];
    if (authInfo && authInfo.found) {
      const docSnap = await db.collection('users').doc(authInfo.uid).get();
      if (docSnap.exists) {
        console.log(`   [users/${authInfo.uid}] (${email}): EXISTS`);
        console.log(`     Data:`, JSON.stringify(docSnap.data(), null, 2));
      } else {
        console.log(`   [users/${authInfo.uid}] (${email}): DOES NOT EXIST in Firestore`);
      }
    }
  }

  // Also check if any doc in /users has email matching any target
  console.log('\n4. Checking if any documents in `/users` match target emails by query:');
  for (const email of targetEmails) {
    const snap = await db.collection('users').where('email', '==', email).get();
    if (!snap.empty) {
      snap.forEach(d => {
        console.log(`   Found doc users/${d.id} matching email ${email}:`, JSON.stringify(d.data(), null, 2));
      });
    } else {
      console.log(`   No doc found by email == "${email}"`);
    }
  }

  // 5. Inspect Firestore `/departments` collection
  console.log('\n5. Inspecting Firestore `/departments` collection:');
  const deptSnap = await db.collection('departments').get();
  console.log(`   Total department docs: ${deptSnap.size}`);
  deptSnap.forEach(d => {
    console.log(`   - [departments/${d.id}]:`, JSON.stringify(d.data(), null, 2));
  });

  const watcoSnap = await db.collection('departments').doc('WATCO').get();
  if (watcoSnap.exists) {
    console.log('   WATCO doc exists in Firestore:', JSON.stringify(watcoSnap.data(), null, 2));
  } else {
    console.log('   WATCO doc DOES NOT EXIST yet in Firestore.');
  }

  // 6. Inspect `/citizen_profiles` for target UIDs
  console.log('\n6. Inspecting Firestore `/citizen_profiles` for target UIDs:');
  for (const email of targetEmails) {
    const authInfo = authResults[email];
    if (authInfo && authInfo.found) {
      const cpSnap = await db.collection('citizen_profiles').doc(authInfo.uid).get();
      if (cpSnap.exists) {
        console.log(`   [citizen_profiles/${authInfo.uid}] (${email}): EXISTS`);
        console.log(`     Data:`, JSON.stringify(cpSnap.data(), null, 2));
      } else {
        console.log(`   [citizen_profiles/${authInfo.uid}] (${email}): DOES NOT EXIST`);
      }
    }
  }

  console.log('\n===============================================================');
  console.log(' Inspection Complete — Zero Writes Performed');
  console.log('===============================================================\n');
}

inspectIdentities().catch(console.error);
