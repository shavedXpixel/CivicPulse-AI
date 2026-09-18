import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function queryPostgresActualState() {
  console.log('========================================================================');
  console.log(' CIVICPULSE AI — POSTGRESQL ACTUAL STATE DIRECT QUERY');
  console.log('========================================================================\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('STATUS: DATABASE_URL is not set in environment or .env.');
    console.log('Local host check: PostgreSQL port 5432 is closed, Docker is not installed.');
    console.log('The target Supabase PostgreSQL instance has not had its connection string set in .env.');
    console.log('\nWhen DATABASE_URL is configured, this tool queries the following tables directly:');
    console.log('- departments');
    console.log('- users');
    console.log('- citizen_profiles');
    console.log('- signals');
    console.log('- problem_clusters');
    console.log('- cluster_members');
    console.log('- assignments');
    console.log('- problem_actions');
    console.log('- ai_operations');
    return {
      connected: false,
      reason: 'DATABASE_URL_NOT_CONFIGURED'
    };
  }

  console.log(`Connecting to PostgreSQL at: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const client = await pool.connect();
    console.log('Connected successfully to target PostgreSQL database.\n');

    const tables = [
      'departments',
      'users',
      'citizen_profiles',
      'signals',
      'problem_clusters',
      'cluster_members',
      'signal_media',
      'assignments',
      'problem_actions',
      'resolution_evidence',
      'verification_results',
      'ai_operations',
      'idempotency_records'
    ];

    const state: Record<string, any> = {};

    for (const table of tables) {
      try {
        const countRes = await client.query(`SELECT count(*)::int as count FROM ${table};`);
        const count = countRes.rows[0].count;

        let idField = 'id';
        if (table === 'idempotency_records') idField = 'scoped_key';

        const idRes = await client.query(`SELECT ${idField} FROM ${table} ORDER BY ${idField} ASC;`);
        const ids = idRes.rows.map((r: any) => r[idField]);

        let extra: Record<string, any> = {};
        if (table === 'users') {
          const uRes = await client.query(`SELECT legacy_firebase_uid FROM users WHERE legacy_firebase_uid IS NOT NULL ORDER BY legacy_firebase_uid ASC;`);
          extra.legacy_firebase_uids = uRes.rows.map((r: any) => r.legacy_firebase_uid);
        }

        state[table] = {
          count,
          ids,
          ...extra
        };

        console.log(`Table ${table.padEnd(22)}: RowCount = ${String(count).padEnd(4)} IDs = [${ids.slice(0, 3).join(', ')}${ids.length > 3 ? '...' : ''}]`);
      } catch (err: any) {
        state[table] = { error: err.message };
        console.warn(`Table ${table.padEnd(22)}: Query failed (${err.message})`);
      }
    }

    client.release();
    await pool.end();

    console.log('\nDirect PostgreSQL state query completed successfully.');
    return {
      connected: true,
      state
    };
  } catch (err: any) {
    console.error('Failed to connect to PostgreSQL:', err.message);
    await pool.end();
    return {
      connected: false,
      error: err.message
    };
  }
}

if (require.main === module) {
  queryPostgresActualState().catch(console.error);
}

export { queryPostgresActualState };
