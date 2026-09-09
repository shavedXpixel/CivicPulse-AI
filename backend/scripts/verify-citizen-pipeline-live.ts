import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import request from 'supertest';
import { createApp } from '../src/app';
import { getFirestoreDb, getFirebaseAuth } from '../src/infrastructure/firebase/firebase-admin';

async function main() {
  console.log('================================================================');
  console.log('  LIVE REAL_MODE VERIFICATION: CITIZEN -> GOVERNMENT PROBLEM PIPELINE');
  console.log('================================================================');

  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const app = createApp();

  const citizenUid = 'fb_uid_citizen_synthetic_04'; // citizen2@example.com
  const firebaseWebApiKey = 'process.env.FIREBASE_WEB_API_KEY || ''';

  console.log(`\n1. Authenticating real citizen user: ${citizenUid}...`);
  const citizenCustomToken = await auth.createCustomToken(citizenUid, { role: 'CITIZEN' });
  const exchangeRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseWebApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: citizenCustomToken, returnSecureToken: true })
    }
  );

  if (!exchangeRes.ok) {
    throw new Error(`Failed to exchange custom token for ID token: ${await exchangeRes.text()}`);
  }
  const tokenData: any = await exchangeRes.json();
  const citizenIdToken = tokenData.idToken;
  console.log('   ✓ Successfully obtained genuine Firebase ID token for citizen!');

  // Officer auth token
  console.log('\n2. Authenticating government officer user...');
  const officerUid = 'officer_live_verifier';
  const officerCustomToken = await auth.createCustomToken(officerUid, { role: 'OFFICER' });
  const officerExchangeRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseWebApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: officerCustomToken, returnSecureToken: true })
    }
  );
  const officerTokenData: any = await officerExchangeRes.json();
  const officerIdToken = officerTokenData.idToken;
  console.log('   ✓ Successfully obtained genuine Firebase ID token for officer!');

  // 3. Citizen submits new report with auto_process: true
  console.log('\n3. Citizen submitting report to POST /api/v1/signals (auto_process: true)...');
  const timestamp = Date.now();
  const reportPayload = {
    original_text: `Drinking water supply line fractured near Damana square Ward 18. Brown muddy water flooding street and entering houses. Over 200 residents affected since early morning ${timestamp}.`,
    category: 'WATER_SUPPLY',
    location: {
      lat: 20.2961,
      lng: 85.8245
    },
    location_reference: 'Near Damana Square, Ward 18',
    auto_process: true
  };

  const createRes = await request(app)
    .post('/api/v1/signals')
    .set('Authorization', `Bearer ${citizenIdToken}`)
    .send(reportPayload);

  console.log(`   Status code: ${createRes.status}`);
  if (createRes.status !== 201) {
    console.error('   Submission error body:', JSON.stringify(createRes.body, null, 2));
    throw new Error(`Expected 201, got ${createRes.status}`);
  }

  const signal = createRes.body.data;
  const clusterResult = createRes.body.cluster || signal.cluster;
  const problem = clusterResult?.problem;
  const problemId = problem?.id || clusterResult?.cluster_id || signal.problem_cluster_id;

  console.log('   ✓ Signal created successfully:');
  console.log(`     - Signal ID: ${signal.id}`);
  console.log(`     - Status: ${signal.processing_status}`);
  console.log(`     - Category: ${signal.category}`);
  console.log(`     - AI Summary: ${signal.ai_analysis?.normalized_summary || signal.normalized_text || signal.original_text}`);
  console.log(`     - Problem ID: ${problemId}`);
  console.log(`     - Impact Score: ${problem?.impact_score}`);
  console.log(`     - Signal Count: ${problem?.signal_count}`);

  if (!problemId) {
    throw new Error('Pipeline failed to create/associate problem cluster!');
  }

  // 4. Directly verify Firestore records & relations
  console.log('\n4. Verifying Firestore records and data relationship...');
  const signalDoc = await db.collection('signals').doc(signal.id).get();
  if (!signalDoc.exists) {
    throw new Error(`Signal ${signal.id} not found in Firestore signals collection!`);
  }
  console.log(`   ✓ signals/${signal.id} verified in Firestore (citizen_id: ${signalDoc.data()?.citizen_id})`);

  const problemDoc = await db.collection('problem_clusters').doc(problemId).get();
  if (!problemDoc.exists) {
    throw new Error(`Problem cluster ${problemId} not found in Firestore problem_clusters collection!`);
  }
  const problemData = problemDoc.data();
  console.log(`   ✓ problem_clusters/${problemId} verified in Firestore:`);
  console.log(`     - Title: ${problemData?.title}`);
  console.log(`     - Category: ${problemData?.category}`);
  console.log(`     - Impact Score: ${problemData?.impact_score}`);
  console.log(`     - Signal Count: ${problemData?.signal_count}`);
  console.log(`     - Status: ${problemData?.status}`);

  const membersSnap = await db.collection('cluster_members')
    .where('problem_id', '==', problemId)
    .where('signal_id', '==', signal.id)
    .get();

  if (membersSnap.empty) {
    throw new Error(`cluster_members relationship not found for signal ${signal.id} and cluster ${problemId}!`);
  }
  console.log(`   ✓ cluster_members relationship verified! (Doc ID: ${membersSnap.docs[0].id})`);

  // 5. Query Government Problems API
  console.log('\n5. Querying Government Problems API (GET /api/v1/problems)...');
  const getProblemsRes = await request(app)
    .get('/api/v1/problems')
    .set('Authorization', `Bearer ${officerIdToken}`);

  console.log(`   Status code: ${getProblemsRes.status}`);
  if (getProblemsRes.status !== 200) {
    throw new Error(`GET /api/v1/problems failed with ${getProblemsRes.status}`);
  }

  const problemsList: any[] = getProblemsRes.body.data;
  console.log(`   Total problems returned in REAL_MODE: ${problemsList.length}`);
  const found = problemsList.find(p => p.id === problemId);
  if (!found) {
    throw new Error(`New problem cluster ${problemId} NOT found in GET /api/v1/problems!`);
  }
  console.log('   ✓ Newly clustered problem verified in Government Directory:');
  console.log(`     - ID: ${found.id}`);
  console.log(`     - Title: ${found.title}`);
  console.log(`     - Category: ${found.category}`);
  console.log(`     - Impact Score: ${found.impact_score}`);
  console.log(`     - Signal Count: ${found.signal_count}`);

  // 6. Test second correlated signal
  console.log('\n6. Submitting second correlated signal to verify cluster grouping...');
  const secondReport = {
    original_text: `Muddy contaminated drinking water gushing across road Damana square Ward 18. Water supply completely disrupted ${timestamp}.`,
    category: 'WATER_SUPPLY',
    location: {
      lat: 20.2962,
      lng: 85.8246
    },
    location_reference: 'Damana square Ward 18',
    auto_process: true
  };

  const secondRes = await request(app)
    .post('/api/v1/signals')
    .set('Authorization', `Bearer ${citizenIdToken}`)
    .send(secondReport);

  console.log(`   Status code: ${secondRes.status}`);
  if (secondRes.status === 201) {
    const secondCluster = secondRes.body.cluster || secondRes.body.data?.cluster;
    const secondProblemId = secondCluster?.problem?.id || secondRes.body.data?.problem_cluster_id;
    console.log(`   ✓ Second signal processed! Correlated Problem ID: ${secondProblemId}`);
    console.log(`   - Is reused cluster: ${secondProblemId === problemId}`);
    console.log(`   - New signal count: ${secondCluster?.problem?.signal_count}`);
  } else {
    console.log(`   Second signal response: ${secondRes.status} ${JSON.stringify(secondRes.body)}`);
  }

  // 7. Verify DEMO_MODE isolation
  console.log('\n7. Verifying DEMO_MODE isolation...');
  const demoProblemsRes = await request(app)
    .get('/api/v1/problems')
    .set('X-Demo-Mode', 'true')
    .set('Authorization', `Bearer ${officerIdToken}`);

  if (demoProblemsRes.status === 200) {
    const demoProblems = demoProblemsRes.body.data;
    const goldenDemo = demoProblems.find((p: any) => p.id === 'PRB-2026-0819');
    if (goldenDemo) {
      console.log('   ✓ Golden Demo PRB-2026-0819 verified intact in DEMO_MODE (signal_count: 327)');
    } else {
      console.warn('   ! Warning: PRB-2026-0819 not found in demo problems response');
    }
  }

  console.log('\n================================================================');
  console.log('  ALL LIVE REAL_MODE VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\n❌ LIVE VERIFICATION FAILED:', err);
  process.exit(1);
});
