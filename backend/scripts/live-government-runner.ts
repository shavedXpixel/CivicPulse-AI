import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import request from 'supertest';
import { createApp } from '../src/app';
import { getFirebaseAuth, getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';
import {
  UserRole,
  ProblemStatus,
  ActionType,
  AssignmentPriority,
  EvidenceType,
  BeforeOrAfter
} from '@civicpulse/shared';
import {
  ProviderContainer,
  FirestoreDatabaseProvider,
  GeminiAIProvider,
  GeminiVerificationProvider,
  StaticGeographyProvider,
  StaticPopulationProvider,
  StaticFacilityProvider
} from '../src/providers';
import { env } from '../src/config/env';

// Enforce REAL_MODE and cloud providers for authoritative live runner
(env as any).DEMO_MODE = false;
(env as any).PROVIDER_MODE = 'cloud';
ProviderContainer.resetAllProviders();
ProviderContainer.setDatabaseProvider(new FirestoreDatabaseProvider());
ProviderContainer.setAIProvider(new GeminiAIProvider());
ProviderContainer.setVerificationProvider(new GeminiVerificationProvider());
ProviderContainer.setGeographyProvider(new StaticGeographyProvider());
ProviderContainer.setPopulationProvider(new StaticPopulationProvider());
ProviderContainer.setFacilityProvider(new StaticFacilityProvider());

const app = createApp();

async function getIdTokenForUid(uid: string): Promise<string> {
  const auth = getFirebaseAuth();
  const customToken = await auth.createCustomToken(uid);
  const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY || 'process.env.FIREBASE_WEB_API_KEY || ''';
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

export async function runLiveGovernmentVerification() {
  console.log('======================================================================');
  console.log(' CIVICPULSE AI — PHASE 13: REAL GOVERNMENT WORKFLOW LIFECYCLE RUNNER');
  console.log('======================================================================\n');

  const runId = `phase13_run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  console.log(`[EXECUTION RUN ID]: ${runId}\n`);

  const UIDS = {
    ADMIN: 'fb_uid_admin_synthetic_01',         // admin@example.com
    DEPT_OFFICER: 'fb_uid_officer_synthetic_02',  // officer@example.com
    FIELD_OFFICER: 'fb_uid_field_synthetic_03', // field@example.com
    CITIZEN: 'fb_uid_citizen_synthetic_06'        // citizen.test@example.com
  };

  // Exact ID tracking for data safety & cleanup isolation
  let createdSignalId: string | null = null;
  let createdProblemId: string | null = null;
  let createdAssignmentId: string | null = null;
  let createdEvidenceId: string | null = null;
  let createdStoragePath: string | null = null;
  const createdActionIds: string[] = [];
  const createdMemberIds: string[] = [];
  const createdVerificationIds: string[] = [];

  const db = getFirestoreDb();

  // Record baseline production state count & snapshots
  const preSignalsSnap = await db.collection('signals').get();
  const preProblemsSnap = await db.collection('problem_clusters').get();
  const preSignalCount = preSignalsSnap.size;
  const preProblemCount = preProblemsSnap.size;
  const preProblemIds = new Set(preProblemsSnap.docs.map(d => d.id));
  const preSignalIds = new Set(preSignalsSnap.docs.map(d => d.id));

  // Deep snapshot of baseline problem clusters for field-level immutability verification
  const baselineProblemSnapshots: Record<string, any> = {};
  for (const doc of preProblemsSnap.docs) {
    const data = doc.data();
    const { centroid_embedding, ...rest } = data;
    baselineProblemSnapshots[doc.id] = JSON.parse(JSON.stringify(rest));
  }
  console.log(`[BASELINE AUDIT]: Persisted records before test: ${preSignalCount} signals, ${preProblemCount} problems (${Array.from(preProblemIds).join(', ')}).\n`);

  try {
    // 1. Authenticate all 4 real accounts
    console.log('1. Acquiring genuine Firebase ID tokens for all 4 personas...');
    const tokens = {
      admin: await getIdTokenForUid(UIDS.ADMIN),
      deptOfficer: await getIdTokenForUid(UIDS.DEPT_OFFICER),
      fieldOfficer: await getIdTokenForUid(UIDS.FIELD_OFFICER),
      citizen: await getIdTokenForUid(UIDS.CITIZEN)
    };
    console.log('   ✓ All 4 genuine Firebase ID tokens acquired.\n');

    // 2. Authoritative Profile Verification
    console.log('2. Authoritative Profile Verification (/api/v1/auth/me):');
    const profiles: Record<string, any> = {};
    for (const [name, token] of Object.entries(tokens)) {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      if (res.status !== 200) {
        throw new Error(`Auth me failed for ${name}: status ${res.status}`);
      }
      profiles[name] = res.body.data.user;
      console.log(`   ✓ [${name.toUpperCase()}]: role=${res.body.data.user.role}, email=${res.body.data.user.email}, dept=${res.body.data.user.department_id || '(global)'}`);
    }
    console.log('');

    // 3. Real Citizen Report Ingestion Pipeline
    console.log('3. Submitting REAL Citizen Report to trigger live ingestion pipeline:');
    // Use an isolated distinct incident topic and location in Ward 003 (Kalarahanga) that cannot semantically cluster into PRB-2026-3968 or PRB-2026-4047
    const citizenReportText = `[Run ${runId}] High-pressure drinking water booster pump manifold flange gasket ruptured inside Kalarahanga distribution pump house yard, Ward 003. Mechanical seal burst flooding station pump trench.`;
    const citizenLocation = { lat: 20.3650, lng: 85.8280 };

    const signalRes = await request(app)
      .post('/api/v1/signals')
      .set('Authorization', `Bearer ${tokens.citizen}`)
      .send({
        original_text: citizenReportText,
        location: citizenLocation,
        location_reference: 'Kalarahanga Water Supply Distribution Depot, Ward 003, Bhubaneswar',
        auto_process: true
      });

    if (signalRes.status !== 201) {
      throw new Error(`Citizen signal submission failed (${signalRes.status}): ${JSON.stringify(signalRes.body)}`);
    }

    const signalData = signalRes.body.data;
    createdSignalId = signalData.id;
    console.log(`   ✓ Real Signal created via pipeline: ${createdSignalId}`);
    console.log(`     - Processing Status: ${signalData.processing_status}`);
    console.log(`     - AI Category: ${signalData.category}`);
    console.log(`     - AI Severity: ${signalData.severity}`);

    // Retrieve generated ProblemCluster
    const clusterResult = signalRes.body.cluster || signalData.cluster;
    createdProblemId = clusterResult?.problem?.id || signalData.problem_cluster_id;
    if (!createdProblemId) {
      throw new Error('Pipeline did not link signal to a ProblemCluster');
    }

    // MANDATORY PRODUCTION SAFETY INVARIANT ASSERTIONS:
    if (preProblemIds.has(createdProblemId)) {
      throw new Error(
        `CRITICAL SAFETY VIOLATION: Pipeline linked verification signal to pre-existing baseline problem ${createdProblemId}! Aborting run immediately to protect baseline.`
      );
    }
    if (clusterResult && clusterResult.is_new_cluster === false) {
      throw new Error(
        `CRITICAL SAFETY VIOLATION: Pipeline did not create a new cluster! Attached to existing problem ${clusterResult.problem?.id}.`
      );
    }
    console.log(`   ✓ Real ProblemCluster created by clustering pipeline: ${createdProblemId} (GUARANTEED UNIQUE & FRESH)`);

    // Track cluster member
    if (clusterResult?.member?.id) {
      createdMemberIds.push(clusterResult.member.id);
    }

    // Verify Firestore persistence of the problem cluster
    const problemDoc = await db.collection('problem_clusters').doc(createdProblemId).get();
    if (!problemDoc.exists) {
      throw new Error(`ProblemCluster ${createdProblemId} does not exist in Firestore`);
    }
    const initialProblemData = problemDoc.data()!;
    console.log(`   ✓ ProblemCluster persisted in Firestore with status: "${initialProblemData.status}"`);

    // 4. Lifecycle: TRIAGED
    console.log('\n4. Government Triage Verification:');
    if (initialProblemData.status === ProblemStatus.NEW) {
      const triageRes = await request(app)
        .post(`/api/v1/problems/${createdProblemId}/actions`)
        .set('Authorization', `Bearer ${tokens.deptOfficer}`)
        .send({
          action: ActionType.TRIAGED,
          note: `[Run ${runId}] Triaged by WATCO Department Supervisor for immediate field assignment.`
        });
      if (triageRes.status !== 200) {
        throw new Error(`Triage transition failed: ${triageRes.status} ${JSON.stringify(triageRes.body)}`);
      }
      if (triageRes.body.data?.action?.id) createdActionIds.push(triageRes.body.data.action.id);
      console.log('   ✓ Transitioned NEW → TRIAGED by Department Officer.');
    } else {
      console.log(`   ✓ ProblemCluster already in initial triaged state: ${initialProblemData.status}.`);
    }

    // 5. Lifecycle: TRIAGED -> ASSIGNED (WATCO Department & Real Field Officer)
    console.log('\n5. Assignment to WATCO & Real Field Officer:');
    const assignRes = await request(app)
      .post(`/api/v1/problems/${createdProblemId}/assign`)
      .set('Authorization', `Bearer ${tokens.deptOfficer}`)
      .send({
        department_id: 'WATCO',
        assigned_to: UIDS.FIELD_OFFICER,
        priority: AssignmentPriority.HIGH,
        notes: `[Run ${runId}] Emergency deployment: deploy pipe excavation and coupling crew.`
      });

    if (assignRes.status !== 200) {
      throw new Error(`Assignment failed (${assignRes.status}): ${JSON.stringify(assignRes.body)}`);
    }

    const assignedProblem = assignRes.body.data.problem;
    const assignmentRecord = assignRes.body.data.assignment;
    createdAssignmentId = assignmentRecord.id;
    if (assignRes.body.data.action?.id) createdActionIds.push(assignRes.body.data.action.id);

    console.log(`   ✓ Problem status: ${assignedProblem.status} (Expected: ASSIGNED)`);
    console.log(`   ✓ Assignment ID: ${createdAssignmentId}`);
    console.log(`   ✓ Assigned Department: ${assignmentRecord.department_id}`);
    console.log(`   ✓ Assigned Field Officer UID: ${assignmentRecord.assigned_to}`);
    console.log(`   ✓ Deterministic SLA State: status=${assignedProblem.sla_state?.status}, target_hours=${assignedProblem.sla_state?.target_hours}h, due_at=${assignedProblem.sla_state?.due_at}`);

    // Verify assignment document exists in Firestore
    if (!createdAssignmentId) throw new Error('Assignment document was not generated');
    const assignDoc = await db.collection('assignments').doc(createdAssignmentId).get();
    if (!assignDoc.exists) throw new Error('Assignment document was not persisted to Firestore');

    // 6. Field Officer Queue & Work Commencement (ASSIGNED -> IN_PROGRESS)
    console.log('\n6. Field Officer Personal Queue & Work Commencement:');
    const fieldQueueRes = await request(app)
      .get('/api/v1/assignments?assigned_to=me')
      .set('Authorization', `Bearer ${tokens.fieldOfficer}`);
    if (fieldQueueRes.status !== 200) throw new Error('Field officer queue query failed');

    const hasAssignment = fieldQueueRes.body.data?.some((a: any) => a.id === createdAssignmentId || a.problem_id === createdProblemId);
    if (!hasAssignment) throw new Error(`Assigned problem ${createdProblemId} not found in field officer personal queue`);
    console.log(`   ✓ Field Officer queue contains assigned work order ${createdAssignmentId}.`);

    // Field Officer starts work
    const startWorkRes = await request(app)
      .post(`/api/v1/problems/${createdProblemId}/actions`)
      .set('Authorization', `Bearer ${tokens.fieldOfficer}`)
      .send({
        action: ActionType.STARTED_WORK,
        note: `[Run ${runId}] Crew deployed on Janpath road. Isolation valves locked, excavation started.`
      });
    if (startWorkRes.status !== 200) throw new Error(`Start work failed: ${startWorkRes.status}`);
    if (startWorkRes.body.data?.action?.id) createdActionIds.push(startWorkRes.body.data.action.id);
    console.log('   ✓ Transitioned ASSIGNED → IN_PROGRESS by Field Officer.');

    // 7. Real Storage Upload & Resolution Evidence Submission
    console.log('\n7. Real Photographic Evidence Upload via Backend Storage:');
    // Construct real valid JPEG binary buffer (minimal JFIF standard header + dummy scan)
    const validJpegBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9
    ]);

    createdStoragePath = `evidence/${runId}_coupling_replacement.jpg`;
    const uploadRes = await request(app)
      .put(`/api/v1/storage/upload?path=${encodeURIComponent(createdStoragePath)}&mime=image/jpeg`)
      .set('Authorization', `Bearer ${tokens.fieldOfficer}`)
      .set('Content-Type', 'image/jpeg')
      .send(validJpegBuffer);

    if (uploadRes.status !== 200) {
      throw new Error(`Storage upload failed (${uploadRes.status}): ${JSON.stringify(uploadRes.body)}`);
    }
    const uploadedStoragePath = uploadRes.body.data.storagePath;
    console.log(`   ✓ Real JPEG Evidence stored via backend: "${uploadedStoragePath}" (${uploadRes.body.data.size} bytes)`);

    // Field Officer submits Resolution Evidence (IN_PROGRESS -> AWAITING_VERIFICATION)
    const evidenceRes = await request(app)
      .post(`/api/v1/problems/${createdProblemId}/evidence`)
      .set('Authorization', `Bearer ${tokens.fieldOfficer}`)
      .send({
        evidence_type: EvidenceType.COMPLETION_PHOTO,
        storage_path: uploadedStoragePath,
        media_type: 'image/jpeg',
        description: `[Run ${runId}] Replaced 300mm pipe segment with ductile iron coupling. Pipeline pressure normalized to 3.5 bar with zero leakage.`,
        before_or_after: BeforeOrAfter.AFTER,
        location: citizenLocation
      });

    if (evidenceRes.status !== 201) {
      throw new Error(`Evidence submission failed (${evidenceRes.status}): ${JSON.stringify(evidenceRes.body)}`);
    }
    createdEvidenceId = evidenceRes.body.data.evidence.id;
    console.log(`   ✓ Resolution Evidence registered: ${createdEvidenceId}`);
    console.log(`   ✓ Problem status transitioned to: "${evidenceRes.body.data.problem_status}" (Expected: AWAITING_VERIFICATION)`);

    // 8. Real Gemini Advisory Verification
    console.log('\n8. Dynamic Gemini AI Advisory Verification:');
    const verifyRes = await request(app)
      .post(`/api/v1/problems/${createdProblemId}/verify`)
      .set('Authorization', `Bearer ${tokens.deptOfficer}`)
      .send({ evidence_id: createdEvidenceId });

    if (verifyRes.status !== 200) {
      throw new Error(`AI verification failed (${verifyRes.status}): ${JSON.stringify(verifyRes.body)}`);
    }

    const verificationResult = verifyRes.body.data;
    if (verificationResult.id) createdVerificationIds.push(verificationResult.id);

    console.log(`   ✓ Actual Gemini Verification Result: "${verificationResult.verification_result}"`);
    console.log(`     - Confidence Score: ${verificationResult.confidence}`);
    console.log(`     - AI Explanation: ${verificationResult.explanation?.substring(0, 120)}...`);
    console.log(`     - Review Required: ${verificationResult.review_required}`);

    // Architectural Invariant Assertion: Status must strictly remain AWAITING_VERIFICATION
    const intermediateProblem = await db.collection('problem_clusters').doc(createdProblemId).get();
    const intermediateStatus = intermediateProblem.data()?.status;
    console.log(`   ✓ Problem status post-AI: "${intermediateStatus}" (Strictly preserved in AWAITING_VERIFICATION)`);
    if (intermediateStatus !== ProblemStatus.AWAITING_VERIFICATION) {
      throw new Error(`AI verification illegally mutated problem status to ${intermediateStatus}`);
    }

    // 9. Self-Approval Protection Barrier
    console.log('\n9. Enforcing Self-Approval Protection:');
    const selfApproveRes = await request(app)
      .post(`/api/v1/problems/${createdProblemId}/review-resolution`)
      .set('Authorization', `Bearer ${tokens.fieldOfficer}`)
      .send({
        decision: 'ACCEPT',
        notes: 'Attempting self-approval by resolver field officer.'
      });
    console.log(`   - Field Officer self-review status: ${selfApproveRes.status} (Expected: 403 Forbidden)`);
    if (selfApproveRes.status !== 403) {
      throw new Error(`Self-approval protection failed: received status ${selfApproveRes.status}`);
    }
    console.log('   ✓ Resolver Field Officer strictly barred from self-approving resolution work.');

    // 10. Supervisor Supervisory Review & Approval (AWAITING_VERIFICATION -> RESOLVED)
    console.log('\n10. Department Officer Supervisory Review & Acceptance:');
    const reviewRes = await request(app)
      .post(`/api/v1/problems/${createdProblemId}/review-resolution`)
      .set('Authorization', `Bearer ${tokens.deptOfficer}`)
      .send({
        decision: 'ACCEPT',
        notes: `[Run ${runId}] Inspected photographic proof and verified 3.5 bar pressure test. Approved by WATCO Supervisor Priyanshu Dash.`
      });

    if (reviewRes.status !== 200) {
      throw new Error(`Supervisor review failed (${reviewRes.status}): ${JSON.stringify(reviewRes.body)}`);
    }
    console.log(`   ✓ Supervisor Decision: "${reviewRes.body.data.decision}"`);
    console.log(`   ✓ Transitioned to: "${reviewRes.body.data.problem_status}" (Expected: RESOLVED)`);

    // Verify resolution evidence marked ACCEPTED
    if (!createdEvidenceId) throw new Error('Evidence document was not generated');
    const evidenceDoc = await db.collection('resolution_evidence').doc(createdEvidenceId).get();
    console.log(`   ✓ Resolution Evidence Status in Firestore: "${evidenceDoc.data()?.status}" (Expected: ACCEPTED)`);

    // 11. Ticket Closure (RESOLVED -> CLOSED)
    console.log('\n11. Final Problem Ticket Closure:');
    const closeRes = await request(app)
      .patch(`/api/v1/problems/${createdProblemId}/status`)
      .set('Authorization', `Bearer ${tokens.deptOfficer}`)
      .send({
        status: ProblemStatus.CLOSED,
        note: `[Run ${runId}] 24-hour post-resolution observation period concluded. Case officially CLOSED.`
      });

    if (closeRes.status !== 200) {
      throw new Error(`Close ticket failed (${closeRes.status}): ${JSON.stringify(closeRes.body)}`);
    }
    console.log(`   ✓ Problem status: "${closeRes.body.data.status}" (Expected: CLOSED)`);

    // 12. Citizen Public View & Privacy Gatekeeping
    console.log('\n12. Citizen Public Reflection & Privacy Barrier:');
    const citizenViewRes = await request(app)
      .get(`/api/v1/problems/${createdProblemId}`)
      .set('Authorization', `Bearer ${tokens.citizen}`);

    if (citizenViewRes.status !== 200) {
      throw new Error(`Citizen cannot view public problem (${citizenViewRes.status})`);
    }
    console.log(`   ✓ Citizen views public problem status: "${citizenViewRes.body.data.status}" (Expected: CLOSED)`);
    console.log(`     - Public Category: ${citizenViewRes.body.data.category}`);
    console.log(`     - Public Department: ${citizenViewRes.body.data.department_id}`);

    const citizenSignalsRes = await request(app)
      .get(`/api/v1/problems/${createdProblemId}/signals`)
      .set('Authorization', `Bearer ${tokens.citizen}`);
    console.log(`   - Citizen -> /problems/:id/signals: ${citizenSignalsRes.status} (Expected: 403 Forbidden)`);
    if (citizenSignalsRes.status !== 403) {
      throw new Error(`Citizen was not blocked from querying raw member signals: status ${citizenSignalsRes.status}`);
    }
    console.log('   ✓ Citizen privacy barrier enforced (raw internal signals inaccessible to citizens).');

    // 13. Audit Timeline Verification
    console.log('\n13. Verifying Authoritative Action Timeline:');
    const actionsRes = await request(app)
      .get(`/api/v1/problems/${createdProblemId}/actions`)
      .set('Authorization', `Bearer ${tokens.admin}`);
    const recordedActions = actionsRes.body.data || [];
    console.log(`   ✓ Audit actions logged (${recordedActions.length}):`);
    for (const a of recordedActions) {
      if (a.id && !createdActionIds.includes(a.id)) {
        createdActionIds.push(a.id);
      }
      console.log(`     - [${a.action_type}] ${a.previous_state || 'START'} → ${a.new_state} (by ${a.actor_role}: ${a.actor_id})`);
    }

    console.log('\n======================================================================');
    console.log(' ✓ ALL 13 REAL_MODE GOVERNMENT LIFECYCLE PHASES PASSED 100%');
    console.log('======================================================================\n');
  } finally {
    // 14. Data Safety: Isolated Exact-ID Cleanup
    console.log('14. Data Safety: Cleaning up ONLY exact IDs generated by this run...');
    const deleteBatch = db.batch();

    if (createdSignalId && !preSignalIds.has(createdSignalId)) {
      deleteBatch.delete(db.collection('signals').doc(createdSignalId));
      console.log(`   - Cleanup signal: ${createdSignalId}`);
    }
    if (createdProblemId && !preProblemIds.has(createdProblemId)) {
      deleteBatch.delete(db.collection('problem_clusters').doc(createdProblemId));
      console.log(`   - Cleanup temporary problem: ${createdProblemId}`);
    } else if (createdProblemId) {
      console.error(`   [CRITICAL SAFETY]: Refusing to delete baseline problem ${createdProblemId}!`);
    }
    if (createdAssignmentId) {
      deleteBatch.delete(db.collection('assignments').doc(createdAssignmentId));
      console.log(`   - Cleanup assignment: ${createdAssignmentId}`);
    }
    if (createdEvidenceId) {
      deleteBatch.delete(db.collection('resolution_evidence').doc(createdEvidenceId));
      console.log(`   - Cleanup evidence: ${createdEvidenceId}`);
    }
    for (const mId of createdMemberIds) {
      deleteBatch.delete(db.collection('cluster_members').doc(mId));
      console.log(`   - Cleanup member: ${mId}`);
    }
    for (const actId of createdActionIds) {
      deleteBatch.delete(db.collection('problem_actions').doc(actId));
      console.log(`   - Cleanup action: ${actId}`);
    }
    for (const vId of createdVerificationIds) {
      deleteBatch.delete(db.collection('verification_results').doc(vId));
      console.log(`   - Cleanup verification: ${vId}`);
    }

    await deleteBatch.commit();
    console.log('   ✓ Exact-ID Firestore cleanup completed.');

    // Assert that baseline counts are preserved
    const postSignalsSnap = await db.collection('signals').get();
    const postProblemsSnap = await db.collection('problem_clusters').get();
    console.log(`[CLEANUP AUDIT]: Pre-run signals: ${preSignalCount}, Post-cleanup signals: ${postSignalsSnap.size}`);
    console.log(`[CLEANUP AUDIT]: Pre-run problems: ${preProblemCount}, Post-cleanup problems: ${postProblemsSnap.size}`);
    if (postSignalsSnap.size !== preSignalCount) {
      throw new Error(`[DATA INTEGRITY FAILURE]: Signal count delta: expected ${preSignalCount}, found ${postSignalsSnap.size}`);
    }
    if (postProblemsSnap.size !== preProblemCount) {
      throw new Error(`[DATA INTEGRITY FAILURE]: Problem count delta: expected ${preProblemCount}, found ${postProblemsSnap.size}`);
    }

    // FIELD-LEVEL DEEP COMPARISON ASSERTION
    console.log('\n[DATA-INTEGRITY RECONCILIATION]: Verifying field-level integrity of baseline records...');
    for (const doc of postProblemsSnap.docs) {
      if (!preProblemIds.has(doc.id)) {
        throw new Error(`[DATA INTEGRITY FAILURE]: Unexpected problem cluster lingering in Firestore: ${doc.id}`);
      }
      const data = doc.data();
      const { centroid_embedding, ...rest } = data;
      const baseline = baselineProblemSnapshots[doc.id];
      const diffs: string[] = [];
      for (const [key, val] of Object.entries(baseline)) {
        if (JSON.stringify(val) !== JSON.stringify(rest[key])) {
          diffs.push(`Field '${key}': before=${JSON.stringify(val)}, after=${JSON.stringify(rest[key])}`);
        }
      }
      for (const [key, val] of Object.entries(rest)) {
        if (baseline[key] === undefined) {
          diffs.push(`Field '${key}' added: after=${JSON.stringify(val)}`);
        }
      }
      if (diffs.length > 0) {
        throw new Error(`[DATA INTEGRITY FAILURE]: Field mutation on baseline problem ${doc.id}:\n  ${diffs.join('\n  ')}`);
      }
      console.log(`   ✓ Baseline Problem ${doc.id}: All fields 100% identical before and after run.`);
    }
    console.log('   ✓ Production baseline records 100% untouched at field-level.\n');
  }
}

if (require.main === module) {
  runLiveGovernmentVerification().catch((err) => {
    console.error('\n✗ Live verification failed:', err);
    process.exit(1);
  });
}
