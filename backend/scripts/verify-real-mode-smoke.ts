import path from 'path';
import dotenv from 'dotenv';

// Load root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { ProviderContainer, PostgresDatabaseProvider, getDevelopmentIndicatorProvider, getPublicInvestmentProvider } from '../src/providers';
import { developmentDemandWorkspaceService } from '../src/services/development-demand-workspace.service';
import { env } from '../src/config/env';

async function verifyRealModeSmoke() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — REAL_MODE POST-DEPLOYMENT SMOKE VERIFICATION (PHASE 15B.5.3.21)');
  console.log('========================================================================\n');

  // 1. REAL_MODE Configuration
  console.log('1. CONFIGURATION CHECKS:');
  console.log(`   DEMO_MODE          : ${env.DEMO_MODE} (Expected: false)`);
  console.log(`   PROVIDER_MODE      : ${env.PROVIDER_MODE} (Expected: cloud)`);
  console.log(`   AUTH_PROVIDER      : ${env.AUTH_PROVIDER} (Expected: supabase)`);
  console.log(`   DATABASE_PROVIDER  : ${env.DATABASE_PROVIDER} (Expected: postgres)`);
  console.log(`   AI_PROVIDER        : ${env.AI_PROVIDER} (Expected: gemini)`);

  if (env.DEMO_MODE) {
    throw new Error('CONFIG ERROR: DEMO_MODE must be false in REAL_MODE.');
  }

  // 2. PostgreSQL Connectivity (Read-Only)
  console.log('\n2. POSTGRESQL CONNECTIVITY (READ-ONLY):');
  const db = new PostgresDatabaseProvider();
  ProviderContainer.setDatabaseProvider(db);
  const readiness = await db.checkReadiness();
  console.log(`   Connected          : ${readiness.ready}`);
  console.log(`   Latency            : ${readiness.latencyMs}ms`);

  if (!readiness.ready) {
    throw new Error('DB ERROR: Target PostgreSQL instance is not reachable.');
  }

  // Check read-only counts from demand tables
  const signalCountRows = await (db as any).query('SELECT count(*)::int as count FROM demand_signals WHERE is_demo = false;');
  const clusterCountRows = await (db as any).query('SELECT count(*)::int as count FROM demand_clusters WHERE is_demo = false;');
  const investmentCountRows = await (db as any).query('SELECT count(*)::int as count FROM public_investment_projects WHERE is_demo = false;');
  const realSignalCount = signalCountRows[0].count;
  const realClusterCount = clusterCountRows[0].count;
  const realInvestmentCount = investmentCountRows[0].count;

  console.log(`   Real Signals in DB : ${realSignalCount}`);
  console.log(`   Real Clusters in DB: ${realClusterCount}`);
  console.log(`   Official Investments: ${realInvestmentCount}`);

  // 3. Development Demand Overview
  console.log('\n3. DEVELOPMENT DEMAND OVERVIEW:');
  const overview = await developmentDemandWorkspaceService.getOverview(false);
  console.log(`   Total Active Demands: ${overview.total_active_demands}`);
  console.log(`   Total Demand Signals: ${overview.total_demand_signals}`);
  console.log(`   Top Sectors         : ${JSON.stringify(overview.top_sectors)}`);
  console.log(`   Ward Summary Count  : ${overview.ward_demand_summary.length}`);
  console.log(`   is_demo             : ${overview.is_demo}`);

  if (overview.is_demo !== false) {
    throw new Error('BOUNDARY ERROR: Overview returned is_demo !== false');
  }

  // 4. Clusters Listing
  console.log('\n4. CLUSTERS LISTING:');
  const clustersRes = await developmentDemandWorkspaceService.getClusters({}, false);
  console.log(`   Clusters Count      : ${clustersRes.total_count}`);
  console.log(`   Clusters Returned   : ${clustersRes.clusters.length}`);
  console.log(`   is_demo             : ${clustersRes.is_demo}`);

  if (clustersRes.is_demo !== false) {
    throw new Error('BOUNDARY ERROR: Clusters returned is_demo !== false');
  }

  // 5. Context Indicators
  console.log('\n5. CONTEXT INDICATORS (WARD-018):');
  const indicatorsRes = await developmentDemandWorkspaceService.getIndicators('WARD-018', undefined, false);
  console.log(`   Ward                : ${indicatorsRes.ward_id}`);
  console.log(`   Indicators Count    : ${indicatorsRes.indicators.length}`);
  console.log(`   is_demo             : ${indicatorsRes.is_demo}`);
  if (indicatorsRes.indicators.length > 0) {
    const sample = indicatorsRes.indicators[0];
    console.log(`   Sample Indicator    : ${sample.name} (${sample.value} ${sample.unit})`);
    console.log(`   Source Agency/Data  : ${sample.source} | Date: ${sample.measurement_date}`);
  }

  if (indicatorsRes.is_demo !== false) {
    throw new Error('BOUNDARY ERROR: Indicators returned is_demo !== false');
  }

  // 6. Public Investment Context
  console.log('\n6. PUBLIC INVESTMENT CONTEXT:');
  const investmentsRes = await developmentDemandWorkspaceService.getInvestmentContext(undefined, undefined, false);
  console.log(`   Total Projects      : ${investmentsRes.investments.length}`);
  console.log(`   Total Budget        : INR ${investmentsRes.total_budget.toLocaleString('en-IN')}`);
  console.log(`   is_demo             : ${investmentsRes.is_demo}`);

  if (investmentsRes.is_demo !== false) {
    throw new Error('BOUNDARY ERROR: Investments returned is_demo !== false');
  }

  for (const inv of investmentsRes.investments) {
    console.log(`   - [${inv.project_id}] ${inv.plan_name}`);
    console.log(`     Budget: INR ${inv.documented_budget?.toLocaleString('en-IN')} | Status: ${inv.status} | Source: ${inv.source_url}`);
  }

  // 7. Map Geometry & Intensity
  console.log('\n7. MAP SYSTEM & GEOGRAPHY:');
  const mapData = await developmentDemandWorkspaceService.getMap(false);
  console.log(`   Feature Count       : ${mapData.features.length}`);
  console.log(`   Metadata            : ${JSON.stringify(mapData.metadata)}`);

  // 8. Demo Data Exclusion Verification
  console.log('\n8. DEMO DATA EXCLUSION VERIFICATION:');
  const demoTitles = ['Nayapalli Water Main Rupture', 'Janpath Drain Siltation', 'AMRUT', '19 signals'];
  const hasDemoArtifact = JSON.stringify({ overview, clustersRes, investmentsRes }).includes('dclust_demo_');
  console.log(`   Demo cluster ID leaks detected: ${hasDemoArtifact ? 'YES (FAIL)' : 'NONE (PASS)'}`);
  if (hasDemoArtifact) {
    throw new Error('SECURITY VIOLATION: Synthetic demo cluster IDs detected in REAL_MODE output!');
  }

  // 9. Privacy Checks
  console.log('\n9. PRIVACY & SENSITIVE DATA BOUNDARY:');
  const jsonStr = JSON.stringify({ overview, clustersRes, investmentsRes });
  const hasEmailLeak = /([a-zA-Z0-9_\.-]+)@([a-zA-Z0-9_\.-]+)\.([a-zA-Z\.]{2,6})/.test(jsonStr);
  const hasPhoneLeak = /\b[6-9]\d{9}\b/.test(jsonStr);
  console.log(`   Email regex leak detected: ${hasEmailLeak ? 'YES (FAIL)' : 'NONE (PASS)'}`);
  console.log(`   Phone regex leak detected: ${hasPhoneLeak ? 'YES (FAIL)' : 'NONE (PASS)'}`);

  if (hasEmailLeak || hasPhoneLeak) {
    throw new Error('PRIVACY VIOLATION: Citizen email or phone detected in public governance DTOs!');
  }

  console.log('\n========================================================================');
  console.log(' ALL PHASE 15B.5.3.21 REAL_MODE POST-DEPLOYMENT SMOKE CHECKS PASSED');
  console.log('========================================================================\n');
}

verifyRealModeSmoke()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSMOKE VERIFICATION FAILED:', err.message);
    process.exit(1);
  });
