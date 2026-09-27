import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function repairDatabase() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — PRODUCTION BACKEND WORKFLOW DATABASE REPAIR');
  console.log('========================================================================\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Audit and cancel superseded active assignments for PRB-2026-8415
    console.log('1. Auditing assignments for PRB-2026-8415...');
    const asgns = await client.query(
      `SELECT id, assigned_to, status, created_at FROM assignments WHERE problem_id = 'PRB-2026-8415' ORDER BY created_at ASC;`
    );
    console.log(`Found ${asgns.rows.length} assignments for PRB-2026-8415.`);

    // Reopened incident has historical assignments: mark prior active assignments as CANCELLED with completed_at timestamp
    const cancelRes = await client.query(
      `UPDATE assignments 
       SET status = 'CANCELLED', completed_at = NOW(), updated_at = NOW() 
       WHERE problem_id = 'PRB-2026-8415' AND status IN ('ASSIGNED', 'ACCEPTED')
       RETURNING id, status;`
    );
    console.log(`Updated ${cancelRes.rows.length} active assignments to CANCELLED.`);

    // 2. Normalize PRB-2026-8415 problem cluster state
    // Incident is in REOPENED state; clear assigned_to & assigned_at so it cleanly awaits re-triage and reassignment
    console.log('2. Normalizing PRB-2026-8415 cluster fields...');
    const probRes = await client.query(
      `UPDATE problem_clusters 
       SET assigned_to = NULL, assigned_at = NULL, department_id = 'WATCO', updated_at = NOW() 
       WHERE id = 'PRB-2026-8415' 
       RETURNING id, status, department_id, assigned_to;`
    );
    console.log('PRB-2026-8415 normalized:', probRes.rows[0]);

    // 3. Create partial unique index on assignments to enforce UNIQUE ACTIVE ASSIGNMENT at DB level
    console.log('3. Applying partial unique index idx_unique_active_assignment_per_problem...');
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_assignment_per_problem 
       ON assignments (problem_id) 
       WHERE status IN ('ASSIGNED', 'ACCEPTED');`
    );
    console.log('Partial unique index applied successfully.');

    await client.query('COMMIT');
    console.log('\nProduction database repair committed successfully.');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Database repair failed, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  repairDatabase().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { repairDatabase };
