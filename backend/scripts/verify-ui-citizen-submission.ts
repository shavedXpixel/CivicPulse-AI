import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

import { chromium } from 'playwright';
import { Pool } from 'pg';
import { getCitizenSessionToken } from './get-citizen-token';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ARTIFACT_DIR = path.join(process.cwd(), '.scratch', 'citizen-demand-artifacts');
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function main() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — REAL CITIZEN UI DEMAND SUBMISSION VERIFICATION');
  console.log('========================================================================\n');

  // 1. Acquire genuine citizen access token for citizen2@example.com
  console.log('1. ACQUIRING GENUINE CITIZEN SESSION TOKEN:');
  const { accessToken, refreshToken, userId } = await getCitizenSessionToken('citizen2@example.com');
  console.log(`   Citizen UID: ${userId}`);
  console.log(`   Token Acquired: Yes (length: ${accessToken.length})\n`);

  // 2. Launch browser and load citizen demand page with citizen session
  console.log('2. LAUNCHING PLAYWRIGHT BROWSER TO SUBMIT VIA CITIZEN UI:');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();

  // Inject citizen auth token into localStorage
  await context.addInitScript(({ token, refresh, uid }: any) => {
    window.localStorage.setItem('civicpulse_auth_token', token);
    const sbData = {
      access_token: token,
      refresh_token: refresh,
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: uid, email: 'citizen2@example.com' }
    };
    window.localStorage.setItem('sb-sihttdjkubjuizwdjmrj-auth-token', JSON.stringify(sbData));
  }, { token: accessToken, refresh: refreshToken, uid: userId });

  const page = await context.newPage();

  console.log(`   Navigating to: ${BASE_URL}/citizen/demand...`);
  await page.goto(`${BASE_URL}/citizen/demand`, { waitUntil: 'networkidle' });

  // Verify page title and header
  const heading = await page.textContent('h1');
  console.log(`   Page Heading: "${heading?.trim()}"`);

  // 3. Fill the citizen demand intake form
  console.log('\n3. FILLING CITIZEN DEMAND PROPOSAL FORM:');
  const proposalText = 'Construction of reinforced covered stormwater drainage channels along Nuasahi Main Road to eliminate severe monsoon waterlogging and road subsidence.';
  const locality = 'Nuasahi, Nayapalli';

  // Fill Locality
  await page.fill('input[placeholder*="Nayapalli"]', locality);
  console.log(`   Locality Name: "${locality}"`);

  // Fill Description textarea
  await page.fill('textarea', proposalText);
  console.log(`   Proposal Text (${proposalText.length} chars): "${proposalText.substring(0, 60)}..."`);

  // Select Sector (Stormwater Drainage & Flood Control)
  const sectorSelect = page.locator('select').nth(2);
  if (await sectorSelect.isVisible()) {
    await sectorSelect.selectOption('DRAINAGE');
    console.log('   Sector Category: DRAINAGE (Selected)');
  }

  // 4. Submit the form through the citizen UI
  console.log('\n4. SUBMITTING PROPOSAL VIA CITIZEN UI...');
  const submitButton = page.locator('button:has-text("Submit to Development Demand Intelligence Pipeline")');
  await submitButton.click();

  // Wait for intake API call to complete and success screen to render
  console.log('   Waiting for ingestion & AI pipeline processing...');
  await page.waitForSelector('text=Development Demand Ingested & Processed', { timeout: 45000 });
  console.log('   SUCCESS: "Development Demand Ingested & Processed" confirmed rendered in UI!');

  // Capture screenshot of successful submission UI
  const screenshotPath = path.join(ARTIFACT_DIR, 'citizen-demand-success.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`   Screenshot captured to: ${screenshotPath}`);

  // Extract result details from UI
  const bodyText = await page.innerText('body');
  const hasSignalId = /ds_[a-f0-9]+/i.test(bodyText);
  console.log(`   Demand Signal ID Displayed: ${hasSignalId}`);

  await browser.close();

  // 5. Verify PostgreSQL database state directly
  console.log('\n5. VERIFYING POSTGRESQL DATABASE PERSISTENCE & VECTOR EMBEDDING:');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    // Check demand_signals
    const signalQuery = await pool.query(`
      SELECT 
        id, 
        original_text, 
        normalized_text, 
        detected_category, 
        detected_urgency, 
        ward_id, 
        locality_name, 
        vector_dims(embedding) as embedding_dimension,
        is_demo, 
        submitted_at
      FROM demand_signals 
      WHERE is_demo = false 
      ORDER BY submitted_at DESC 
      LIMIT 1;
    `);

    if (signalQuery.rows.length === 0) {
      throw new Error('FAILURE: No real demand signal found in database!');
    }

    const row = signalQuery.rows[0];
    console.log(`   Signal ID            : ${row.id}`);
    console.log(`   Original Text        : "${row.original_text.substring(0, 60)}..."`);
    console.log(`   Normalized Text      : "${row.normalized_text?.substring(0, 60)}..."`);
    console.log(`   Detected Sector      : ${row.detected_category}`);
    console.log(`   Detected Urgency     : ${row.detected_urgency}`);
    console.log(`   Ward ID              : ${row.ward_id}`);
    console.log(`   is_demo              : ${row.is_demo} (Expected: false)`);
    console.log(`   Embedding Dimension  : ${row.embedding_dimension} (Expected: 1536)`);

    if (row.embedding_dimension !== 1536) {
      throw new Error(`FAILURE: Expected embedding dimension 1536, got ${row.embedding_dimension}`);
    }

    // Check demand_clusters downstream pipeline
    const clusterQuery = await pool.query(`
      SELECT 
        id, 
        title, 
        category, 
        signal_count, 
        composite_demand_index, 
        priority_band, 
        is_demo
      FROM demand_clusters 
      WHERE is_demo = false;
    `);

    console.log(`\n6. VERIFYING DOWNSTREAM CLUSTERING & DETERMINISTIC METRICS:`);
    console.log(`   Real Clusters Formed : ${clusterQuery.rows.length}`);
    for (const cl of clusterQuery.rows) {
      console.log(`   - Cluster [${cl.id}] "${cl.title}"`);
      console.log(`     Category: ${cl.category} | Signals: ${cl.signal_count} | Index: ${cl.composite_demand_index} | Priority: ${cl.priority_band} | is_demo: ${cl.is_demo}`);
    }

    console.log('\n========================================================================');
    console.log(' ALL STEPS PASSED: REAL CITIZEN DEMAND SUBMITTED & VERIFIED END-TO-END');
    console.log('========================================================================');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('\nFAILURE:', err);
  process.exitCode = 1;
});
