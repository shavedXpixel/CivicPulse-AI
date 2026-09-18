import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { getFirebaseAuth, getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';
import { UserRole } from '@civicpulse/shared';
import { createApp } from '../src/app';
import request from 'supertest';

const app = createApp();

async function getIdTokenForUid(uid: string): Promise<string> {
  const auth = getFirebaseAuth();
  const customToken = await auth.createCustomToken(uid);
  const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY || '';
  const exchangeUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseWebApiKey}`;
  const res = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });
  if (!res.ok) {
    throw new Error(`Failed to exchange custom token for UID ${uid}: ${await res.text()}`);
  }
  const data: any = await res.json();
  return data.idToken;
}

async function runTests() {
  console.log('===============================================================');
  console.log(' Phase 13 Real Government Identity Live API Verification');
  console.log('===============================================================\n');

  const UIDS = {
    ADMIN: 'fb_uid_admin_synthetic_01',
    DEPT_OFFICER: 'fb_uid_officer_synthetic_02',
    FIELD_OFFICER: 'fb_uid_field_synthetic_03',
    CITIZEN: 'fb_uid_citizen_synthetic_05'
  };

  console.log('1. Exchanging Firebase custom tokens for genuine ID tokens...');
  const tokens = {
    admin: await getIdTokenForUid(UIDS.ADMIN),
    deptOfficer: await getIdTokenForUid(UIDS.DEPT_OFFICER),
    fieldOfficer: await getIdTokenForUid(UIDS.FIELD_OFFICER),
    citizen: await getIdTokenForUid(UIDS.CITIZEN)
  };
  console.log('✓ All 4 genuine Firebase ID tokens acquired.\n');

  // Test 1: GET /api/v1/auth/me for each user
  console.log('2. Verifying GET /api/v1/auth/me for each persona:');
  for (const [name, token] of Object.entries(tokens)) {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    
    if (res.status === 200) {
      console.log(`   ✓ ${name}: role=${res.body.data.user.role}, email=${res.body.data.user.email}, dept=${res.body.data.user.department_id || '(global)'}`);
    } else {
      console.error(`   ✗ ${name} FAILED (${res.status}):`, res.body);
    }
  }

  // Test 2: GET /api/v1/departments
  console.log('\n3. Verifying GET /api/v1/departments as Admin:');
  const deptsRes = await request(app)
    .get('/api/v1/departments')
    .set('Authorization', `Bearer ${tokens.admin}`);
  console.log(`   Status: ${deptsRes.status}, Total departments: ${deptsRes.body.data?.length}`);
  console.log(`   Departments:`, deptsRes.body.data?.map((d: any) => `${d.id} (${d.name})`));

  // Test 3: GET /api/v1/departments/WATCO/officers
  console.log('\n4. Verifying GET /api/v1/departments/WATCO/officers:');
  const officersRes = await request(app)
    .get('/api/v1/departments/WATCO/officers')
    .set('Authorization', `Bearer ${tokens.deptOfficer}`);
  console.log(`   Status: ${officersRes.status}, Total officers: ${officersRes.body.data?.length}`);
  for (const off of officersRes.body.data || []) {
    console.log(`   - [${off.role}] ${off.display_name} (${off.email}) - Dept: ${off.department_id}`);
  }

  // Test 4: Citizen RBAC restriction
  console.log('\n5. Verifying Citizen RBAC restriction on /api/v1/dashboard/metrics:');
  const citizenDashRes = await request(app)
    .get('/api/v1/dashboard/metrics')
    .set('Authorization', `Bearer ${tokens.citizen}`);
  console.log(`   Citizen access status: ${citizenDashRes.status} (Expected 403 Forbidden)`);
  if (citizenDashRes.status === 403) {
    console.log('   ✓ Citizen correctly blocked from government command center.');
  }

  // Test 5: Department Officer access to /api/v1/dashboard/metrics
  console.log('\n6. Verifying Dept Officer access to /api/v1/dashboard/metrics:');
  const deptDashRes = await request(app)
    .get('/api/v1/dashboard/metrics')
    .set('Authorization', `Bearer ${tokens.deptOfficer}`);
  console.log(`   Dept Officer access status: ${deptDashRes.status} (Expected 200 OK)`);
  if (deptDashRes.status === 200) {
    console.log('   ✓ Dept Officer authorized to access dashboard metrics.');
  }

  // Test 6: Field Officer queue
  console.log('\n7. Verifying Field Officer assignments queue:');
  const foAssignRes = await request(app)
    .get('/api/v1/assignments?assigned_to=me')
    .set('Authorization', `Bearer ${tokens.fieldOfficer}`);
  console.log(`   Field Officer queue status: ${foAssignRes.status}, Assignments count: ${foAssignRes.body.data?.length}`);

  console.log('\n===============================================================');
  console.log(' Verification Complete');
  console.log('===============================================================\n');
}

runTests().catch(console.error);
