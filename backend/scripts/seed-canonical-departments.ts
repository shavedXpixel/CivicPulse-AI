import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { Pool } from 'pg';

const CANONICAL_DEPARTMENTS = [
  {
    id: 'WATCO',
    name: 'Water Corporation of Odisha',
    short_name: 'WATCO',
    description: 'Urban drinking water supply and sewerage infrastructure for Bhubaneswar Municipal Corporation.',
    status: 'ACTIVE'
  }
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const d of CANONICAL_DEPARTMENTS) {
      await pool.query(
        `INSERT INTO departments (id, name, short_name, description, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           short_name = EXCLUDED.short_name,
           description = EXCLUDED.description,
           status = EXCLUDED.status,
           updated_at = NOW();`,
        [d.id, d.name, d.short_name, d.description, d.status]
      );
      console.log(`✓ Department verified/seeded: ${d.id} (${d.name})`);
    }

    const deleteRes = await pool.query(`DELETE FROM departments WHERE id != 'WATCO';`);
    console.log(`✓ Purged ${deleteRes.rowCount} non-WATCO departments from database.`);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
