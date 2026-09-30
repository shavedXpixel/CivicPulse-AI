import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

import { getCitizenSessionToken } from './get-citizen-token';

const HOSTED_BACKEND = process.env.HOSTED_BACKEND || process.env.NEXT_PUBLIC_API_URL || 'https://civicpulse-ai-backend-osz4.onrender.com/api/v1';

async function main() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — HOSTED RENDER API VERIFICATION');
  console.log('========================================================================\n');

  // 1. Health & Ready
  console.log('1. HEALTH & READY CHECKS:');
  const healthRes = await fetch(`${HOSTED_BACKEND}/health`);
  console.log(`   GET /health: ${healthRes.status} ${JSON.stringify(await healthRes.json())}`);

  const readyRes = await fetch(`${HOSTED_BACKEND}/ready`);
  console.log(`   GET /ready : ${readyRes.status} ${JSON.stringify(await readyRes.json())}\n`);

  // 2. Token Authentication against Hosted Render
  console.log('2. AUTHENTICATING AGAINST HOSTED RENDER WITH REAL TOKEN:');
  const { accessToken, userId } = await getCitizenSessionToken('citizen2@example.com');
  console.log(`   Token Acquired for Citizen: ${userId}`);

  const meRes = await fetch(`${HOSTED_BACKEND}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log(`   GET /auth/me: ${meRes.status}`);
  const meData: any = await meRes.json();
  console.log(`   Me Profile: role=${meData.data?.user?.role}, email=${meData.data?.user?.email}, is_demo=${meData.data?.user?.is_demo || false}\n`);

  // 3. Query Real Development Demand Overview from Hosted Render
  console.log('3. QUERYING DEVELOPMENT DEMAND OVERVIEW FROM HOSTED RENDER:');
  const overviewRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/overview`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log(`   GET /development-demand/overview: ${overviewRes.status}`);
  const overviewData: any = await overviewRes.json();
  console.log(`   Total Active Demands: ${overviewData.data?.overview?.total_active_demands}`);
  console.log(`   Total Signals       : ${overviewData.data?.overview?.total_demand_signals}`);
  console.log(`   Top Sectors         : ${JSON.stringify(overviewData.data?.overview?.top_sectors)}`);
  console.log(`   is_demo             : ${overviewData.data?.is_demo}\n`);

  // 4. Query Real Clusters from Hosted Render
  console.log('4. QUERYING DEVELOPMENT DEMAND CLUSTERS FROM HOSTED RENDER:');
  const clustersRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/clusters`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log(`   GET /development-demand/clusters: ${clustersRes.status}`);
  const clustersData: any = await clustersRes.json();
  console.log(`   Clusters Count: ${clustersData.data?.clusters?.length}`);
  for (const c of clustersData.data?.clusters || []) {
    console.log(`   - [${c.id}] "${c.title}"`);
    console.log(`     Category: ${c.category} | Signals: ${c.signal_count} | Index: ${c.composite_demand_index} | Priority: ${c.priority_band} | is_demo: ${c.is_demo}`);
  }

  // 5. Query Context Indicators from Hosted Render
  console.log('\n5. QUERYING CONTEXT INDICATORS (WARD-018) FROM HOSTED RENDER:');
  const indRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/indicators/WARD-018`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log(`   GET /indicators/WARD-018: ${indRes.status}`);
  const indData: any = await indRes.json();
  console.log(`   Indicators Count: ${indData.data?.indicators?.length}`);

  // 6. Query Public Investments from Hosted Render
  console.log('\n6. QUERYING PUBLIC INVESTMENTS (WARD-018) FROM HOSTED RENDER:');
  const invRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/investments/WARD-018`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log(`   GET /investments/WARD-018: ${invRes.status}`);
  const invData: any = await invRes.json();
  console.log(`   Investments Count: ${invData.data?.investments?.length}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exitCode = 1;
});
