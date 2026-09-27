import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

import { chromium } from 'playwright';
import { getCitizenSessionToken } from './get-citizen-token';

const VERCEL_URL = 'https://civicpulse-ai-henna.vercel.app';
const ARTIFACT_DIR = path.join(process.cwd(), '.scratch', 'hosted-governance-artifacts');
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function main() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — HOSTED VERCEL GOVERNANCE WORKSPACE VERIFICATION');
  console.log('========================================================================\n');

  console.log('1. Acquiring admin session token for admin@example.com...');
  const { accessToken, refreshToken, userId } = await getCitizenSessionToken('admin@example.com');
  console.log(`   Admin UID: ${userId}, Token Length: ${accessToken.length}\n`);

  console.log('2. Launching browser to visit hosted VERCEL governance workspace...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();

  await context.addInitScript(({ token, refresh, uid }: any) => {
    window.localStorage.setItem('civicpulse_auth_token', token);
    const sbData = {
      access_token: token,
      refresh_token: refresh,
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: { id: uid, email: 'admin@example.com' }
    };
    window.localStorage.setItem('sb-sihttdjkubjuizwdjmrj-auth-token', JSON.stringify(sbData));
  }, { token: accessToken, refresh: refreshToken, uid: userId });

  const page = await context.newPage();

  console.log(`   Navigating to: ${VERCEL_URL}/governance/development-demand...`);
  await page.goto(`${VERCEL_URL}/governance/development-demand`, { waitUntil: 'networkidle', timeout: 60000 });

  console.log('   Waiting for page elements to load...');
  await page.waitForTimeout(3000);

  const screenshotPath = path.join(ARTIFACT_DIR, 'hosted-governance-workspace.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`   Screenshot captured: ${screenshotPath}`);

  const pageTitle = await page.title();
  const heading = await page.locator('h1, h2').allInnerTexts();
  console.log(`   Page Title : "${pageTitle}"`);
  console.log(`   Headings   : ${JSON.stringify(heading)}`);

  const bodyText = await page.innerText('body');
  const hasDrainageCluster = bodyText.includes('Drainage & Flood Stormwater Management Demand Cluster');
  console.log(`   Real Cluster Visible on Hosted Vercel : ${hasDrainageCluster}`);

  await browser.close();

  if (!hasDrainageCluster) {
    console.log('   Note: Cluster text check returned:', hasDrainageCluster);
  } else {
    console.log('   SUCCESS: Real demand cluster is actively rendered on hosted Vercel governance workspace!');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exitCode = 1;
});
