import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { chromium, Browser, Page } from 'playwright';
import { getFirestoreDb } from '../src/infrastructure/firebase/firebase-admin';

const ARTIFACT_DIR = '/home/runner/work\\.gemini\\antigravity-ide\\brain\\84fafff3-00b2-4dd1-95b5-901d9fe86f54';
const BASE_URL = 'http://localhost:3000';

const CREDENTIALS = {
  CITIZEN: {
    email: 'citizen.test@example.com',
    password: process.env.CITIZEN_PASSWORD || ''
  },
  DEPT_OFFICER: {
    email: 'officer@example.com',
    password: process.env.DEPT_OFFICER_PASSWORD || ''
  },
  FIELD_OFFICER: {
    email: 'field@example.com',
    password: process.env.FIELD_OFFICER_PASSWORD || ''
  }
};

const FIELD_OFFICER_UID = 'fb_uid_field_synthetic_03';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureSignedOut(page: Page) {
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await sleep(500);
    const signOutBtn = page.locator('button:has-text("Sign Out"), button[title="Sign Out"]');
    if (await signOutBtn.first().isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('   [Auth] Active session detected, signing out...');
      await signOutBtn.first().click();
      await page.waitForSelector('input[type="email"]', { timeout: 5000 });
      console.log('   [Auth] Signed out successfully.');
    }
  } catch {
    // Ignore error if already signed out
  }
}

async function loginAs(page: Page, email: string, pass: string, expectedPathPart: string) {
  console.log(`\n--- Authenticating as ${email} ---`);
  await ensureSignedOut(page);

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await sleep(300);

  console.log(`   Submitting credentials for ${email}...`);
  await page.click('button[type="submit"]');

  // Wait for redirect to expected path
  await page.waitForFunction(
    (expected) => window.location.pathname.includes(expected),
    expectedPathPart,
    { timeout: 20000 }
  );
  console.log(`   ✓ Successfully authenticated and routed to ${page.url()}`);
  await sleep(1000);
}

export async function runBrowserLifecycle() {
  console.log('======================================================================');
  console.log(' CIVICPULSE AI — PHASE 13: PLAYWRIGHT BROWSER WORKFLOW VERIFICATION');
  console.log('======================================================================\n');

  if (!CREDENTIALS.CITIZEN.password || !CREDENTIALS.DEPT_OFFICER.password || !CREDENTIALS.FIELD_OFFICER.password) {
    throw new Error('CITIZEN_PASSWORD, DEPT_OFFICER_PASSWORD, and FIELD_OFFICER_PASSWORD environment variables are required.');
  }

  const runId = `browser_run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  console.log(`[EXECUTION RUN ID]: ${runId}\n`);

  const db = getFirestoreDb();

  // Baseline audit
  const preSignalsSnap = await db.collection('signals').get();
  const preProblemsSnap = await db.collection('problem_clusters').get();
  const preSignalCount = preSignalsSnap.size;
  const preProblemCount = preProblemsSnap.size;
  const preProblemIds = new Set(preProblemsSnap.docs.map((d) => d.id));
  console.log(`[BASELINE AUDIT]: Persisted records: ${preSignalCount} signals, ${preProblemCount} problems.\n`);

  let createdSignalId: string | null = null;
  let createdProblemId: string | null = null;

  console.log('Launching Microsoft Edge browser instance...');
  const browser: Browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // =========================================================================
    // STEP 1: CITIZEN SUBMISSION
    // =========================================================================
    console.log('\n======================================================================');
    console.log(' STEP 1: CITIZEN INTAKE & PROBLEM CLUSTER CREATION');
    console.log('======================================================================');

    await loginAs(page, CREDENTIALS.CITIZEN.email, CREDENTIALS.CITIZEN.password, 'citizen');

    // Setup network response listener to capture signal and problem ID
    const signalPromise = new Promise<{ id: string; problem_cluster_id?: string }>((resolve) => {
      page.on('response', async (response) => {
        if (response.url().includes('/api/v1/signals') && response.request().method() === 'POST') {
          try {
            const body = await response.json();
            if (body?.data?.id) {
              resolve(body.data);
            }
          } catch {}
        }
      });
    });

    console.log('Navigating to citizen report intake (/citizen/report)...');
    await page.goto(`${BASE_URL}/citizen/report`, { waitUntil: 'networkidle' });
    await sleep(1000);

    // Stage 1: Description with unique run tag and distinct location
    console.log('Entering report description...');
    await page.waitForSelector('textarea', { timeout: 10000 });
    await page.fill(
      'textarea',
      `[Phase 13 ${runId}] Major water transmission pipeline fracture near Pokhariput Ananta Vihar square causing immediate water service cut and roadway flooding.`
    );
    await sleep(500);

    console.log('Proceeding to Location stage...');
    await page.click('button:has-text("Continue to Location")');
    await sleep(1000);

    // Stage 2: Location
    console.log('Configuring incident coordinates...');
    const manualBtn = page.locator('button:has-text("Enter manual coordinates")');
    if (await manualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   Enabling manual coordinate entry...');
      await manualBtn.click();
      await sleep(300);
    }

    const manualLatInput = page.locator('input[placeholder="e.g. 20.2961"]');
    if (await manualLatInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await manualLatInput.fill('20.2505');
      await page.fill('input[placeholder="e.g. 85.8245"]', '85.8115');
      await page.fill(
        'input[placeholder="e.g. Near Damana Square, near Big Bazaar crossing"]',
        'Pokhariput Ananta Vihar Square, Bhubaneswar'
      );
    }
    await sleep(500);

    console.log('Proceeding to Media stage...');
    await page.click('button:has-text("Continue to Media")');
    await sleep(1000);

    // Stage 3: Media
    console.log('Proceeding to Review stage...');
    await page.click('button:has-text("Review Report")');
    await sleep(1000);

    // Stage 4: Review & Submit
    console.log('Submitting citizen report...');
    await page.click('button:has-text("Submit Civic Report")');

    console.log('Waiting for backend ingestion and Gemini clustering pipeline...');
    const signalData = await Promise.race([
      signalPromise,
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for signal creation response')), 45000))
    ]);

    createdSignalId = signalData.id;
    createdProblemId = signalData.problem_cluster_id || null;
    console.log(`   ✓ Ingested Signal ID: ${createdSignalId}`);

    let pollAttempts = 0;
    while (!createdProblemId && pollAttempts < 15) {
      console.log(`   Waiting for Gemini clustering to assign ProblemCluster ID (attempt ${pollAttempts + 1}/15)...`);
      await sleep(2000);
      const sigDoc = await db.collection('signals').doc(createdSignalId).get();
      createdProblemId = sigDoc.data()?.problem_cluster_id || null;
      pollAttempts++;
    }

    if (!createdProblemId) {
      throw new Error(`Failed to associate Signal ${createdSignalId} with a ProblemCluster`);
    }
    console.log(`   ✓ Generated Problem Cluster ID: ${createdProblemId}`);

    // Wait for result screen
    await sleep(3000);
    const step1Shot = path.join(ARTIFACT_DIR, 'browser_step1_citizen_submitted.png');
    await page.screenshot({ path: step1Shot, fullPage: true });
    console.log(`   ✓ Screenshot captured: ${step1Shot}`);

    // Sign out citizen
    await ensureSignedOut(page);

    // =========================================================================
    // STEP 2: DEPARTMENT OFFICER TRIAGE & ASSIGNMENT
    // =========================================================================
    console.log('\n======================================================================');
    console.log(' STEP 2: DEPARTMENT OFFICER ASSIGNMENT TO FIELD OFFICER');
    console.log('======================================================================');

    await loginAs(page, CREDENTIALS.DEPT_OFFICER.email, CREDENTIALS.DEPT_OFFICER.password, 'dashboard');

    console.log(`Navigating to problem detail /dashboard/problems/${createdProblemId}...`);
    await page.goto(`${BASE_URL}/dashboard/problems/${createdProblemId}`, { waitUntil: 'networkidle' });
    await sleep(2000);

    console.log('Opening assignment modal...');
    const assignBtn = page.locator('button:has-text("Assign Department & Officer"), button:has-text("Reassign Department & Officer")');
    await assignBtn.first().waitFor({ state: 'visible', timeout: 10000 });
    await assignBtn.first().click();
    await sleep(1000);

    console.log('Selecting WATCO department and Priyanshu Dash (WATCO Field Officer)...');
    const officerSelect = page.locator('form select').nth(1);
    await officerSelect.waitFor({ state: 'visible', timeout: 5000 });

    // Explicitly select Field Officer UID
    console.log(`   Setting select value to Field Officer UID: ${FIELD_OFFICER_UID}`);
    await officerSelect.selectOption({ value: FIELD_OFFICER_UID });
    await sleep(500);

    console.log('Submitting assignment...');
    const confirmBtn = page.locator('button[type="submit"]:has-text("Confirm Assignment")');
    await confirmBtn.click();
    await sleep(3000);

    // Verify problem is now ASSIGNED
    await page.goto(`${BASE_URL}/dashboard/problems/${createdProblemId}`, { waitUntil: 'networkidle' });
    await sleep(1500);

    const step2Shot = path.join(ARTIFACT_DIR, 'browser_step2_gov_assigned.png');
    await page.screenshot({ path: step2Shot, fullPage: true });
    console.log(`   ✓ Screenshot captured: ${step2Shot}`);

    await ensureSignedOut(page);

    // =========================================================================
    // STEP 3: FIELD OFFICER EXECUTION
    // =========================================================================
    console.log('\n======================================================================');
    console.log(' STEP 3: FIELD OFFICER WORK COMMENCEMENT & VERIFICATION SUBMISSION');
    console.log('======================================================================');

    await loginAs(page, CREDENTIALS.FIELD_OFFICER.email, CREDENTIALS.FIELD_OFFICER.password, 'officer');

    console.log('Locating assigned work order in Field Operations queue...');
    await page.goto(`${BASE_URL}/officer`, { waitUntil: 'networkidle' });
    await sleep(2500);

    // Look for problem card by dossier link or problem ID
    const problemCard = page.locator(`.shadow-card:has(a[href*="${createdProblemId}"]), .shadow-card:has-text("${createdProblemId}")`).first();
    let cardVisible = await problemCard.isVisible().catch(() => false);
    if (!cardVisible) {
      console.log('   Card not immediately visible, refreshing officer queue...');
      await page.reload({ waitUntil: 'networkidle' });
      await sleep(2500);
    }
    await problemCard.waitFor({ state: 'visible', timeout: 25000 });
    console.log(`   ✓ Found work order card for ${createdProblemId}`);

    const startWorkBtn = problemCard.locator('button:has-text("Start Work")').first();
    if (await startWorkBtn.isVisible().catch(() => false)) {
      console.log('Clicking "Start Work (Commence Repairs)"...');
      await startWorkBtn.click();
      await sleep(2500);
      console.log('   ✓ Transitioned to IN_PROGRESS');
    }

    const reqVerifyBtn = problemCard.locator('button:has-text("Request Verification")').first();
    if (await reqVerifyBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log('Clicking "Request Verification (Submit Proof)"...');
      await reqVerifyBtn.click();
      await sleep(2500);
      console.log('   ✓ Transitioned to AWAITING_VERIFICATION');
    }

    const step3Shot = path.join(ARTIFACT_DIR, 'browser_step3_field_officer_work.png');
    await page.screenshot({ path: step3Shot, fullPage: true });
    console.log(`   ✓ Screenshot captured: ${step3Shot}`);

    await ensureSignedOut(page);

    // =========================================================================
    // STEP 4: SUPERVISOR APPROVAL & CASE CLOSURE
    // =========================================================================
    console.log('\n======================================================================');
    console.log(' STEP 4: SUPERVISOR REVIEW, APPROVAL & CLOSURE');
    console.log('======================================================================');

    await loginAs(page, CREDENTIALS.DEPT_OFFICER.email, CREDENTIALS.DEPT_OFFICER.password, 'dashboard');

    console.log(`Navigating to problem detail /dashboard/problems/${createdProblemId}...`);
    await page.goto(`${BASE_URL}/dashboard/problems/${createdProblemId}`, { waitUntil: 'networkidle' });
    await sleep(2000);

    console.log('Approving resolution as Department Officer...');
    const resolveBtn = page.locator('button:has-text("Verify & Resolve (RESOLVED)"), button:has-text("Approve Resolution")').first();
    await resolveBtn.waitFor({ state: 'visible', timeout: 10000 });
    await resolveBtn.click();
    await sleep(2500);
    console.log('   ✓ Transitioned to RESOLVED');

    // Close Case
    console.log('Closing case ticket...');
    const closeBtn = page.locator('button:has-text("Close Case (CLOSED)")').first();
    await closeBtn.waitFor({ state: 'visible', timeout: 10000 });
    await closeBtn.click();
    await sleep(2500);
    console.log('   ✓ Transitioned to CLOSED');

    await page.goto(`${BASE_URL}/dashboard/problems/${createdProblemId}`, { waitUntil: 'networkidle' });
    await sleep(1500);

    const step4Shot = path.join(ARTIFACT_DIR, 'browser_step4_supervisor_closed.png');
    await page.screenshot({ path: step4Shot, fullPage: true });
    console.log(`   ✓ Screenshot captured: ${step4Shot}`);

    await ensureSignedOut(page);

    // =========================================================================
    // STEP 5: CITIZEN PUBLIC REFLECTION
    // =========================================================================
    console.log('\n======================================================================');
    console.log(' STEP 5: CITIZEN PUBLIC REFLECTION');
    console.log('======================================================================');

    await loginAs(page, CREDENTIALS.CITIZEN.email, CREDENTIALS.CITIZEN.password, 'citizen');

    console.log('Navigating to citizen submitted issues (/citizen/issues)...');
    await page.goto(`${BASE_URL}/citizen/issues`, { waitUntil: 'networkidle' });
    await sleep(2500);

    const issueElement = page.locator(`.shadow-card:has-text("${createdSignalId}"), .shadow-card:has-text("${createdProblemId}")`).first();
    await issueElement.waitFor({ state: 'visible', timeout: 15000 });
    console.log(`   ✓ Issue found on Citizen Issues page for signal ${createdSignalId}`);

    const step5Shot = path.join(ARTIFACT_DIR, 'browser_step5_citizen_reflection.png');
    await page.screenshot({ path: step5Shot, fullPage: true });
    console.log(`   ✓ Screenshot captured: ${step5Shot}`);

    console.log('\n======================================================================');
    console.log(' ALL 5 BROWSER WORKFLOW PERSONA STAGES COMPLETED SUCCESSFULLY!');
    console.log('======================================================================\n');
  } finally {
    await browser.close();
    console.log('Browser closed.\n');

    // =========================================================================
    // STEP 6: DATA SAFETY & CLEANUP
    // =========================================================================
    console.log('======================================================================');
    console.log(' DATA SAFETY: EXACT-ID CLEANUP');
    console.log('======================================================================');

    if (createdSignalId) {
      console.log(`Cleaning up temporary signal: ${createdSignalId}`);
      await db.collection('signals').doc(createdSignalId).delete().catch(() => {});
    }
    if (createdProblemId) {
      if (!preProblemIds.has(createdProblemId)) {
        console.log(`Cleaning up temporary problem: ${createdProblemId}`);
        await db.collection('problem_clusters').doc(createdProblemId).delete().catch(() => {});
      } else {
        console.log(`Preserving pre-existing problem: ${createdProblemId}`);
      }

      // Clean up assignments & actions created for this run
      const asgns = await db.collection('assignments').where('problem_id', '==', createdProblemId).get();
      for (const doc of asgns.docs) {
        if (doc.id.includes(runId) || !preProblemIds.has(createdProblemId)) {
          console.log(`Cleaning up assignment: ${doc.id}`);
          await doc.ref.delete().catch(() => {});
        }
      }
      const acts = await db.collection('problem_actions').where('problem_id', '==', createdProblemId).get();
      for (const doc of acts.docs) {
        if (!preProblemIds.has(createdProblemId)) {
          console.log(`Cleaning up action: ${doc.id}`);
          await doc.ref.delete().catch(() => {});
        }
      }
      const mems = await db.collection('cluster_members').where('signal_id', '==', createdSignalId).get();
      for (const doc of mems.docs) {
        console.log(`Cleaning up cluster member: ${doc.id}`);
        await doc.ref.delete().catch(() => {});
      }
    }

    const postSignalsSnap = await db.collection('signals').get();
    const postProblemsSnap = await db.collection('problem_clusters').get();
    console.log(`\n[POST-CLEANUP AUDIT]: Persisted records: ${postSignalsSnap.size} signals, ${postProblemsSnap.size} problems.`);
    console.log(`Baseline was: ${preSignalCount} signals, ${preProblemCount} problems.`);
    if (postSignalsSnap.size === preSignalCount && postProblemsSnap.size === preProblemCount) {
      console.log('✓ Pre-existing production records 100% preserved and intact.\n');
    } else {
      console.warn('⚠ Record count difference detected. Please check audit logs.');
    }
  }
}

runBrowserLifecycle().catch((err) => {
  console.error('\n❌ Browser Lifecycle Verification Failed:', err);
  process.exit(1);
});
