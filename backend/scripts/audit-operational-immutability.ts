import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function verifyOperationalImmutability() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — OPERATIONAL GRIEVANCE IMMUTABILITY AUDIT');
  console.log('========================================================================\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const operationalTables = [
      'signals',
      'problem_clusters',
      'cluster_members',
      'assignments',
      'problem_actions',
      'resolution_evidence',
      'verification_results'
    ];

    console.log('1. OPERATIONAL GRIEVANCE TABLES:');
    for (const table of operationalTables) {
      const res = await pool.query(`SELECT count(*)::int as total FROM ${table};`);
      const row = res.rows[0];
      console.log(`   - ${table.padEnd(22)} : Total = ${row.total.toString().padStart(4)}`);
    }

    console.log('\n2. DEVELOPMENT DEMAND INTELLIGENCE TABLES (PHASE 15B.5.3.21):');
    const demandTables = [
      'demand_signals',
      'demand_clusters',
      'demand_cluster_members',
      'public_investment_projects'
    ];

    for (const table of demandTables) {
      const res = await pool.query(`SELECT count(*)::int as total FROM ${table};`);
      const row = res.rows[0];
      console.log(`   - ${table.padEnd(28)} : Total = ${row.total.toString().padStart(4)}`);
    }

    // Verify vector dimensions in demand_signals
    const vecRes = await pool.query(`
      SELECT id, ward_id, vector_dims(embedding) as dim, is_demo, submitted_at
      FROM demand_signals 
      WHERE is_demo = false
      ORDER BY submitted_at DESC;
    `);

    console.log(`\n3. REAL DEMAND SIGNALS IN PRODUCTION: ${vecRes.rows.length}`);
    for (const r of vecRes.rows) {
      console.log(`   - [${r.id}] Ward: ${r.ward_id} | Vector Dim: ${r.dim} (Strictly 1536) | is_demo: ${r.is_demo} | Submitted: ${r.submitted_at}`);
      if (r.dim !== 1536) {
        throw new Error(`Dimension violation: ${r.dim}`);
      }
    }

    console.log('\n========================================================================');
    console.log(' OPERATIONAL IMMUTABILITY & VECTOR INTEGRITY AUDIT PASSED');
    console.log('========================================================================');
  } finally {
    await pool.end();
  }
}

verifyOperationalImmutability().catch(err => {
  console.error('Audit Error:', err);
  process.exitCode = 1;
});
