import '../src/config/env';
import { env } from '../src/config/env';
import { ProviderContainer, getDatabaseProvider } from '../src/providers';

async function runDemoReset() {
  console.log('===============================================================');
  console.log(' CivicPulse AI — Golden Demo Reset');
  console.log('===============================================================\n');

  // Check for explicit CLI flag to run in demo sandbox mode
  if (process.argv.includes('--demo') || process.argv.includes('--mock')) {
    (env as any).DEMO_MODE = true;
    ProviderContainer.resetAllProviders();
  }

  // Strict guard: NEVER run in REAL_MODE to protect production/Firestore data
  if (!env.DEMO_MODE) {
    console.error('✗ ERROR: Demo reset is blocked because DEMO_MODE=false (REAL_MODE active).');
    console.error('  REAL_MODE Firestore database is strictly protected against resets.');
    console.error('  To safely reset the presentation demo, either:');
    console.error('    1. Set DEMO_MODE=true in your .env file, OR');
    console.error('    2. Run with the demo flag: npm run demo:reset -- --demo\n');
    process.exit(1);
  }

  console.log('1. Checking environment: DEMO_MODE=true [OK]');

  // Execute in-memory reset
  ProviderContainer.resetToGoldenDemo();
  console.log('2. In-memory MockDatabaseProvider cleared and re-seeded [OK]');

  // Verify canonical Golden Demo state
  const db = getDatabaseProvider();
  const goldenProblem = await db.getProblemCluster('PRB-2026-0819');

  if (!goldenProblem) {
    console.error('✗ ERROR: Golden Demo Problem PRB-2026-0819 was not found after reset!');
    process.exit(1);
  }

  if (goldenProblem.impact_score !== 92 || goldenProblem.ward_id !== 'WARD-018') {
    console.error(
      `✗ ERROR: Golden Demo Problem values mismatch! Score: ${goldenProblem.impact_score}, Ward: ${goldenProblem.ward_id}`
    );
    process.exit(1);
  }

  console.log('3. Verifying canonical Golden Demo state:');
  console.log(`   - Problem ID:    ${goldenProblem.id}`);
  console.log(`   - Title:         "${goldenProblem.title}"`);
  console.log(`   - Ward:          ${goldenProblem.ward_id} (Nayapalli)`);
  console.log(`   - Impact Score:  ${goldenProblem.impact_score}/100 (CRITICAL)`);
  console.log(`   - Department:    ${goldenProblem.department_id} (WATCO)`);
  console.log(`   - Status:        ${goldenProblem.status} (IN_PROGRESS)`);

  const assignments = await db.getAssignments(goldenProblem.id);
  console.log(`   - Assignments:   ${assignments.length} canonical assignment(s) restored`);

  const actions = await db.getActions(goldenProblem.id);
  console.log(`   - Audit Actions: ${actions.length} canonical audit action(s) restored`);

  const evidence = await db.getResolutionEvidence(goldenProblem.id);
  console.log(`   - Evidence:      ${evidence.length} canonical evidence record(s) restored`);

  console.log('\n===============================================================');
  console.log(' ✓ GOLDEN DEMO RESET COMPLETE — Presentation Ready');
  console.log('===============================================================\n');
}

runDemoReset().catch((err) => {
  console.error('Fatal error during demo reset:', err);
  process.exit(1);
});
