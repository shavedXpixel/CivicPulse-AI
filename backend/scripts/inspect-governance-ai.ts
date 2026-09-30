import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env.local') });

import { getCitizenSessionToken } from './get-citizen-token';

const HOSTED_BACKEND = process.env.HOSTED_BACKEND || process.env.NEXT_PUBLIC_API_URL || 'https://civicpulse-ai-backend-osz4.onrender.com/api/v1';

async function main() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — GOVERNANCE AI REAL CLUSTER VERIFICATION');
  console.log('========================================================================\n');

  const adminAuth = await getCitizenSessionToken('admin@example.com');
  const clusterId = 'dclus_65742a765e4e6d54';

  console.log(`Invoking POST /api/v1/governance/development-demand/analyze on cluster ${clusterId}...`);
  const res = await fetch(`${HOSTED_BACKEND}/governance/development-demand/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminAuth.accessToken}`
    },
    body: JSON.stringify({ cluster_id: clusterId })
  });

  const body: any = await res.json();
  console.log(`HTTP Status: ${res.status}`);

  if (!res.ok) {
    console.error('Failure:', body);
    process.exitCode = 1;
    return;
  }

  const analysis = body.data || body;
  console.log('\n--- 1. ADVISORY INTERPRETATION ---');
  console.log(`Summary            : ${analysis.advisory_interpretation?.summary}`);
  console.log(`Need Justification : ${analysis.advisory_interpretation?.need_justification}`);
  console.log(`Tradeoffs & Notes  :`);
  for (const t of analysis.advisory_interpretation?.tradeoffs_and_considerations || []) {
    console.log(`  - ${t}`);
  }

  console.log('\n--- 2. OBSERVED FACTS (Non-hallucinatory Grounding) ---');
  console.log(`Opportunity ID     : ${analysis.opportunity_id}`);
  console.log(`Ward ID            : ${analysis.ward_id}`);
  console.log(`Category           : ${analysis.category}`);
  console.log(`Total Signals      : ${analysis.observed_facts?.total_signals}`);
  console.log(`First Detected     : ${analysis.observed_facts?.first_detected}`);
  console.log(`Last Detected      : ${analysis.observed_facts?.last_detected}`);
  console.log(`Intake Channels    : ${JSON.stringify(analysis.observed_facts?.intake_channels)}`);

  console.log('\n--- 3. EVIDENCE CITATIONS (Traceable Inputs Only) ---');
  console.log(`Signal IDs         : ${JSON.stringify(analysis.evidence_citations?.signal_ids)}`);
  console.log(`Indicator Sources  : ${JSON.stringify(analysis.evidence_citations?.indicator_sources)}`);
  console.log(`Investment Refs    : ${JSON.stringify(analysis.evidence_citations?.investment_references)}`);

  console.log('\n--- 4. DETERMINISTIC METRICS (HF7.5 Preserved) ---');
  console.log(`Composite Demand Index : ${analysis.metrics?.composite_demand_index} / 100`);
  console.log(`Priority Band          : ${analysis.metrics?.priority_band}`);
  console.log(`Demand Volume Score    : ${analysis.metrics?.demand_volume_score} / 25`);
  console.log(`Recurrence Score       : ${analysis.metrics?.recurrence_score} / 20`);
  console.log(`Geographic Focus Score : ${analysis.metrics?.geographic_concentration_score} / 15`);
  console.log(`Population Exposure    : ${analysis.metrics?.population_exposure_score} / 15`);
  console.log(`Infrastructure Deficit : ${analysis.metrics?.infrastructure_deficit_score} / 15`);
  console.log(`Investment Gap Score   : ${analysis.metrics?.investment_gap_score} / 10`);

  console.log('\n--- 5. UNCERTAINTY & LIMITATIONS ---');
  console.log(`Confidence Score   : ${analysis.uncertainty?.confidence}`);
  for (const l of analysis.uncertainty?.limitations || []) {
    console.log(`  - ${l}`);
  }

  console.log('\n--- 6. INVARIANTS ---');
  console.log(`is_demo            : ${analysis.is_demo} (Expected: false)`);
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exitCode = 1;
});
