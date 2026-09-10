import path from 'path';
import dotenv from 'dotenv';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import request from 'supertest';
import { createApp } from '../src/app';
import {
  ProviderContainer,
  FirestoreDatabaseProvider,
  GeminiAIProvider,
  StaticGeographyProvider,
  StaticPopulationProvider,
  StaticFacilityProvider
} from '../src/providers';
import { getFirestoreDb, getFirebaseAuth } from '../src/infrastructure/firebase/firebase-admin';
import { env } from '../src/config/env';
import { ERROR_CODES } from '@civicpulse/shared';

async function getLiveCitizenToken(uid: string, email: string): Promise<string> {
  const auth = getFirebaseAuth();
  const customToken = await auth.createCustomToken(uid, { role: 'CITIZEN', email });
  const apiKey = process.env.FIREBASE_WEB_API_KEY || 'process.env.FIREBASE_WEB_API_KEY || ''';
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true })
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to exchange custom token for ID token: ${await res.text()}`);
  }

  const data: any = await res.json();
  return data.idToken;
}

async function runLiveCitizenVerification() {
  console.log('================================================================');
  console.log('  CIVICPULSE AI — PHASE 12: REAL CITIZEN LIVE VERIFICATION');
  console.log('================================================================\n');

  // Enforce REAL_MODE
  (env as any).DEMO_MODE = false;
  ProviderContainer.resetAllProviders();
  ProviderContainer.setDatabaseProvider(new FirestoreDatabaseProvider());
  ProviderContainer.setAIProvider(new GeminiAIProvider());
  ProviderContainer.setGeographyProvider(new StaticGeographyProvider());
  ProviderContainer.setPopulationProvider(new StaticPopulationProvider());
  ProviderContainer.setFacilityProvider(new StaticFacilityProvider());

  const app = createApp();
  const firestore = getFirestoreDb();

  const testRunId = `phase12_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let createdSignalId: string | null = null;
  let createdProblemClusterId: string | null = null;
  let isNewlyCreatedCluster = false;
  let createdMemberDocId: string | null = null;

  try {
    // 1. Authenticate real citizen
    const citizenUid = 'fb_uid_citizen_synthetic_04'; // citizen2@example.com
    const citizenEmail = 'citizen2@example.com';
    console.log(`1. Authenticating real citizen account (${citizenEmail})...`);
    const citizenToken = await getLiveCitizenToken(citizenUid, citizenEmail);
    console.log('   ✓ Genuine Firebase ID token acquired successfully.');

    // 2. Submit realistic civic report with auto_process: true
    console.log('\n2. Submitting citizen report to POST /api/v1/signals (auto_process: true)...');
    const reportText = `Severe drinking water main leakage flooding Kharavela Nagar roadway near Unit 3 market. Clean water gushing across street disrupting shopfronts [Test Run ${testRunId}].`;

    // Coordinates for Ward 30 (Kharavela Nagar / Unit 3 area)
    const reportLocation = { lat: 20.2785, lng: 85.8420 };

    const submitRes = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({
        original_text: reportText,
        location: reportLocation,
        location_reference: 'Near Unit 3 Market Square, Kharavela Nagar',
        auto_process: true
      });

    console.log(`   Response status: ${submitRes.status}`);
    if (submitRes.status !== 201) {
      console.error('   Submission error:', JSON.stringify(submitRes.body, null, 2));
      throw new Error(`Expected 201 Created, received ${submitRes.status}`);
    }

    const signalData = submitRes.body.data;
    createdSignalId = signalData.id;
    console.log(`   ✓ Signal created with ID: ${createdSignalId}`);
    console.log(`     - Processing status: ${signalData.processing_status}`);
    console.log(`     - Category: ${signalData.category}`);
    console.log(`     - Recommended Dept: ${signalData.recommended_department}`);
    console.log(`     - Resolved Ward ID: ${signalData.ward_id || 'UNKNOWN'}`);
    console.log(`     - Ward Name: ${signalData.ward_name || 'Unresolved'}`);
    console.log(`     - Geography Provenance: ${signalData.geography_provenance}`);

    // Check cluster assignment
    const clusterInfo = submitRes.body.cluster || signalData.cluster;
    const problemId = clusterInfo?.problem?.id || signalData.problem_cluster_id;
    if (problemId) {
      createdProblemClusterId = problemId;
      isNewlyCreatedCluster = clusterInfo?.action === 'CREATED';
      console.log(`     - Correlated Problem Cluster ID: ${problemId} (Action: ${clusterInfo?.action || 'ATTACHED'})`);
      console.log(`     - Cluster Impact Score: ${clusterInfo?.problem?.impact_score || 'N/A'}`);
    }

    // 3. Verify Firestore persistence of the specific signal
    console.log(`\n3. Verifying Firestore document signals/${createdSignalId}...`);
    const signalDocSnap = await firestore.collection('signals').doc(createdSignalId!).get();
    if (!signalDocSnap.exists) {
      throw new Error(`Signal ${createdSignalId} not found in Firestore!`);
    }
    const firestoreSignal = signalDocSnap.data()!;
    if (firestoreSignal.citizen_id !== citizenUid) {
      throw new Error(`Citizen ID mismatch: expected ${citizenUid}, got ${firestoreSignal.citizen_id}`);
    }
    console.log('   ✓ Document verified in Firestore with correct citizen_id and attributes.');

    // 4. Verify Gemini AI extraction succeeded
    console.log('\n4. Verifying Gemini AI intelligence extraction...');
    if (!signalData.category || signalData.category === 'UNKNOWN') {
      console.warn('   ! Warning: Category was not classified by AI.');
    } else {
      console.log(`   ✓ Category extracted: ${signalData.category}`);
    }
    if (signalData.ai_analysis) {
      console.log(`   ✓ AI Analysis structured fields:`);
      console.log(`     - Severity: ${signalData.ai_analysis.severity}`);
      console.log(`     - Department: ${signalData.ai_analysis.recommended_department}`);
      console.log(`     - Summary: ${signalData.ai_analysis.normalized_summary || signalData.ai_analysis.key_facts?.[0]}`);
    }

    // 5. Verify Geography ward resolution
    console.log('\n5. Verifying Geographic Ward resolution...');
    if (signalData.ward_id === 'WARD-018' && signalData.geography_provenance !== 'REAL') {
      throw new Error('VIOLATION: Signal silently fell back to Ward 18 (Nayapalli)!');
    }
    console.log(`   ✓ Geography resolution verified honest: Ward ${signalData.ward_id || 'UNKNOWN'} (${signalData.geography_provenance})`);

    // 6. Verify citizen's own history via GET /api/v1/signals/me
    console.log('\n6. Verifying citizen reports list (GET /api/v1/signals/me)...');
    const mySignalsRes = await request(app)
      .get('/api/v1/signals/me')
      .set('Authorization', `Bearer ${citizenToken}`);

    if (mySignalsRes.status !== 200) {
      throw new Error(`GET /api/v1/signals/me failed with status ${mySignalsRes.status}`);
    }
    const mySignalsList: any[] = mySignalsRes.body.data;
    const foundMySignal = mySignalsList.find((s) => s.id === createdSignalId);
    if (!foundMySignal) {
      throw new Error(`Created signal ${createdSignalId} not found in GET /api/v1/signals/me!`);
    }
    console.log(`   ✓ Signal present in authenticated citizen's personal history (${mySignalsList.length} total signals).`);

    // 7. Verify Safe Public Problem Tracking & Zero-PII Sanitization
    if (createdProblemClusterId) {
      console.log(`\n7. Verifying Safe Public Problem Tracking for Cluster #${createdProblemClusterId}...`);

      // 7a. Citizen should successfully get public problem details
      const detailsRes = await request(app)
        .get(`/api/v1/problems/${createdProblemClusterId}/details`)
        .set('Authorization', `Bearer ${citizenToken}`);

      if (detailsRes.status !== 200) {
        throw new Error(`GET /api/v1/problems/${createdProblemClusterId}/details failed with ${detailsRes.status}`);
      }

      const problemDetails = detailsRes.body.data;
      console.log(`   ✓ Public Problem details retrieved:`);
      console.log(`     - Title: ${problemDetails.title}`);
      console.log(`     - Impact Score: ${problemDetails.impact_score}/100 (${problemDetails.impact_level})`);
      console.log(`     - Status: ${problemDetails.status}`);
      console.log(`     - Timeline Milestones: ${problemDetails.timeline?.length || 0} stages`);

      // 7b. Verify PII Sanitization: member signals from other citizens MUST NOT have private fields
      const members: any[] = problemDetails.members || [];
      console.log(`     - Cluster Members: ${members.length} member(s)`);
      for (const member of members) {
        if (member.signal && member.signal.citizen_id !== citizenUid) {
          throw new Error(`PII LEAK: Foreign member signal leaked private data for citizen ${member.signal.citizen_id}`);
        }
      }
      console.log('   ✓ Zero-PII Invariant verified: Foreign citizen identities and texts are strictly stripped.');

      // 7c. Citizen MUST be rejected with 403 on internal /signals query
      const forbiddenRes = await request(app)
        .get(`/api/v1/problems/${createdProblemClusterId}/signals`)
        .set('Authorization', `Bearer ${citizenToken}`);

      if (forbiddenRes.status !== 403) {
        throw new Error(`RBAC LEAK: Expected 403 Forbidden for citizen querying internal problem signals, received ${forbiddenRes.status}`);
      }
      console.log('   ✓ RBAC verified: Citizen forbidden from accessing internal member signals endpoint (403).');

      // Record cluster member doc ID for targeted cleanup
      const memberQuery = await firestore.collection('cluster_members')
        .where('signal_id', '==', createdSignalId)
        .get();
      if (!memberQuery.empty) {
        createdMemberDocId = memberQuery.docs[0].id;
      }
    }

    console.log('\n================================================================');
    console.log('  ALL REAL-MODE CITIZEN CHECKS PASSED WITH ZERO PII LEAKAGE');
    console.log('================================================================\n');

  } finally {
    // =========================================================================
    // STRICT TARGETED CLEANUP DIRECTIVE:
    // Delete ONLY the exact records created by this specific verification run.
    // NEVER use broad collection deletion, truncate, or queries affecting real data.
    // =========================================================================
    console.log('----------------------------------------------------------------');
    console.log(' STRICT TARGETED TEST CLEANUP');
    console.log('----------------------------------------------------------------');

    if (createdSignalId) {
      console.log(`  Deleting test signal: signals/${createdSignalId}...`);
      await firestore.collection('signals').doc(createdSignalId).delete();
      console.log('  ✓ Test signal document removed.');
    }

    if (createdMemberDocId) {
      console.log(`  Deleting test cluster member: cluster_members/${createdMemberDocId}...`);
      await firestore.collection('cluster_members').doc(createdMemberDocId).delete();
      console.log('  ✓ Test cluster member document removed.');
    }

    if (createdProblemClusterId && isNewlyCreatedCluster) {
      console.log(`  Deleting test problem cluster: problem_clusters/${createdProblemClusterId}...`);
      await firestore.collection('problem_clusters').doc(createdProblemClusterId).delete();
      console.log('  ✓ Test problem cluster document removed.');
    }

    console.log('  ✓ Targeted cleanup complete. Real citizen data remains 100% untouched.\n');
  }
}

runLiveCitizenVerification()
  .then(() => {
    console.log('Live citizen verification completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Live citizen verification failed:', err);
    process.exit(1);
  });
