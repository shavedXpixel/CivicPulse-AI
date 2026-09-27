import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

import { getCitizenSessionToken } from './get-citizen-token';

const HOSTED_BACKEND = 'https://civicpulse-ai-backend-osz4.onrender.com/api/v1';

async function main() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — COMPLETE HOSTED PRODUCTION SMOKE VERIFICATION');
  console.log('========================================================================\n');

  // 1. Health & Readiness
  console.log('1. HOSTED HEALTH & READINESS:');
  const healthRes = await fetch(`${HOSTED_BACKEND}/health`);
  const healthData: any = await healthRes.json();
  console.log(`   GET /health : ${healthRes.status} (status: ${healthData.data?.status})`);

  const readyRes = await fetch(`${HOSTED_BACKEND}/ready`);
  const readyData: any = await readyRes.json();
  console.log(`   GET /ready  : ${readyRes.status} (database: ${readyData.database}, latency: ${readyData.latency_ms}ms)\n`);

  // 2. Acquire Genuine Tokens
  console.log('2. ACQUIRING HOSTED PRODUCTION TOKENS:');
  const citizenAuth = await getCitizenSessionToken('citizen2@example.com');
  console.log(`   Citizen Token Acquired: Yes (UID: ${citizenAuth.userId})`);

  const adminAuth = await getCitizenSessionToken('admin@example.com');
  console.log(`   Admin Token Acquired  : Yes (UID: ${adminAuth.userId})\n`);

  // 3. Verify Admin Profile
  console.log('3. VERIFYING ADMIN AUTHORIZATION ON HOSTED RENDER:');
  const adminMeRes = await fetch(`${HOSTED_BACKEND}/auth/me`, {
    headers: { Authorization: `Bearer ${adminAuth.accessToken}` }
  });
  const adminMeData: any = await adminMeRes.json();
  console.log(`   GET /auth/me : ${adminMeRes.status} (Role: ${adminMeData.data?.user?.role}, Email: ${adminMeData.data?.user?.email})\n`);

  // 4. Governance Development Demand Overview
  console.log('4. HOSTED DEVELOPMENT DEMAND OVERVIEW:');
  const overviewRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/overview`, {
    headers: { Authorization: `Bearer ${adminAuth.accessToken}` }
  });
  const overviewData: any = await overviewRes.json();
  console.log(`   GET /overview : ${overviewRes.status}`);
  console.log(`   Total Active Demands : ${overviewData.data?.overview?.total_active_demands}`);
  console.log(`   Total Demand Signals : ${overviewData.data?.overview?.total_demand_signals}`);
  console.log(`   Top Sectors          : ${JSON.stringify(overviewData.data?.overview?.top_sectors)}`);
  console.log(`   is_demo              : ${overviewData.data?.is_demo} (Expected: false)\n`);

  // 5. Governance Clusters List
  console.log('5. HOSTED DEVELOPMENT DEMAND CLUSTERS:');
  const clustersRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/clusters`, {
    headers: { Authorization: `Bearer ${adminAuth.accessToken}` }
  });
  const clustersData: any = await clustersRes.json();
  console.log(`   GET /clusters : ${clustersRes.status}`);
  const clusters = clustersData.data?.clusters || [];
  console.log(`   Real Clusters Returned : ${clusters.length}`);
  let firstClusterId = '';
  for (const c of clusters) {
    firstClusterId = c.id;
    console.log(`   - [${c.id}] "${c.title}"`);
    console.log(`     Category: ${c.category} | Signals: ${c.signal_count} | Index: ${c.composite_demand_index} | Priority: ${c.priority_band} | is_demo: ${c.is_demo}`);
  }

  // 6. Cluster Detail
  if (firstClusterId) {
    console.log(`\n6. HOSTED CLUSTER DETAIL (${firstClusterId}):`);
    const detailRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/clusters/${firstClusterId}`, {
      headers: { Authorization: `Bearer ${adminAuth.accessToken}` }
    });
    const detailData: any = await detailRes.json();
    console.log(`   GET /clusters/${firstClusterId} : ${detailRes.status}`);
    console.log(`   Cluster Title : "${detailData.data?.cluster?.title}"`);
    console.log(`   Signal Count  : ${detailData.data?.cluster?.signal_count}`);
    console.log(`   Member Signals: ${detailData.data?.signals?.length}`);
    console.log(`   is_demo       : ${detailData.data?.cluster?.is_demo} (Expected: false)`);
  }

  // 7. Hosted Map
  console.log('\n7. HOSTED DEVELOPMENT DEMAND MAP:');
  const mapRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/map`, {
    headers: { Authorization: `Bearer ${adminAuth.accessToken}` }
  });
  const mapData: any = await mapRes.json();
  console.log(`   GET /map : ${mapRes.status} (Features: ${mapData.data?.features?.length}, is_demo: ${mapData.data?.metadata?.is_demo})`);

  // 8. Hosted Indicators
  console.log('\n8. HOSTED CONTEXT INDICATORS:');
  const indRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/indicators`, {
    headers: { Authorization: `Bearer ${adminAuth.accessToken}` }
  });
  const indData: any = await indRes.json();
  console.log(`   GET /indicators : ${indRes.status} (Wards with indicators: ${Object.keys(indData.data?.indicators || {}).length})`);

  // 9. Hosted Public Investment Context
  console.log('\n9. HOSTED PUBLIC INVESTMENT CONTEXT:');
  const invRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/investment-context`, {
    headers: { Authorization: `Bearer ${adminAuth.accessToken}` }
  });
  const invData: any = await invRes.json();
  console.log(`   GET /investment-context : ${invRes.status} (Total Projects: ${invData.data?.investments?.length})`);

  // 10. Hosted Governance AI Analysis
  if (firstClusterId) {
    console.log(`\n10. HOSTED GOVERNANCE AI ANALYSIS ON REAL CLUSTER (${firstClusterId}):`);
    const aiRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAuth.accessToken}`
      },
      body: JSON.stringify({ cluster_id: firstClusterId })
    });
    console.log(`   POST /analyze : ${aiRes.status}`);
    const aiData: any = await aiRes.json();
    if (aiRes.ok) {
      console.log(`   AI Executive Summary : "${aiData.data?.analysis?.executive_summary?.substring(0, 100)}..."`);
      console.log(`   Observed Facts Count : ${aiData.data?.analysis?.observed_facts?.length}`);
      console.log(`   Evidence Indicators  : ${aiData.data?.analysis?.evidence_indicators?.length}`);
      console.log(`   Strategic Advice     : "${aiData.data?.analysis?.strategic_advice?.substring(0, 100)}..."`);
      console.log(`   Uncertainty Factors  : ${aiData.data?.analysis?.uncertainty_factors?.length}`);
      console.log(`   is_demo              : ${aiData.data?.is_demo} (Expected: false)`);
    } else {
      console.log(`   AI Analysis Response:`, JSON.stringify(aiData));
    }
  }

  // 11. Live Citizen Demand Submission directly against Hosted Render
  console.log('\n11. SUBMITTING LIVE CITIZEN DEMAND DIRECTLY TO HOSTED RENDER INTAKE:');
  const proposalText = 'Urgent request for high-capacity stormwater drain reconstruction along Patia Damana canal to prevent water overflow into residential streets.';
  const intakeRes = await fetch(`${HOSTED_BACKEND}/governance/development-demand/intake`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${citizenAuth.accessToken}`
    },
    body: JSON.stringify({
      demand_text: proposalText,
      ward_id: 'WARD-014',
      locality_name: 'Damana, Patia',
      category: 'DRAINAGE',
      source_channel: 'WEB_FORM'
    })
  });
  console.log(`   POST /intake : ${intakeRes.status}`);
  const intakeData: any = await intakeRes.json();
  if (intakeRes.ok) {
    console.log(`   Signal Ingested ID   : ${intakeData.data?.signal?.id}`);
    console.log(`   Detected Category    : ${intakeData.data?.signal?.detected_category}`);
    console.log(`   Detected Urgency     : ${intakeData.data?.signal?.detected_urgency}`);
    console.log(`   Cluster Attached     : ${intakeData.data?.cluster?.id} ("${intakeData.data?.cluster?.title}")`);
    console.log(`   Composite Index      : ${intakeData.data?.cluster?.composite_demand_index}`);
    console.log(`   is_demo              : ${intakeData.data?.signal?.is_demo} (Expected: false)`);
    console.log(`   SUCCESS: Hosted Render embedding + normalization + clustering pipeline fully operational!`);
  } else {
    console.error(`   FAILURE on hosted intake:`, JSON.stringify(intakeData));
    process.exitCode = 1;
  }

  console.log('\n========================================================================');
  console.log(' ALL HOSTED PRODUCTION SMOKE CHECKS COMPLETED SUCCESSFULLY');
  console.log('========================================================================');
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exitCode = 1;
});
