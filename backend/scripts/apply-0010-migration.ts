const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env' });

async function apply() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sqlPath = path.resolve(__dirname, '../../supabase/migrations/0010_development_demand.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Applying migration 0010_development_demand.sql...');
    await pool.query(sql);
    console.log('Migration 0010 applied successfully!');

    // Ingest the verified official investment records into public_investment_projects table
    const investJsonPath = path.resolve(__dirname, '../../data/reference/investment/bhubaneswar_public_investments.json');
    if (fs.existsSync(investJsonPath)) {
      const records = JSON.parse(fs.readFileSync(investJsonPath, 'utf8'));
      console.log(`Ingesting ${records.length} official public investment records into PostgreSQL...`);
      for (const rec of records) {
        await pool.query(`
          INSERT INTO public_investment_projects (
            id, project_id, plan_name, category, ward_ids, status,
            documented_budget, currency, announcement_date, source_agency,
            source_url, provenance, is_demo, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
          ON CONFLICT (id) DO UPDATE SET
            documented_budget = EXCLUDED.documented_budget,
            status = EXCLUDED.status,
            ward_ids = EXCLUDED.ward_ids,
            updated_at = NOW();
        `, [
          rec.id,
          rec.project_id,
          rec.plan_name,
          rec.category,
          rec.ward_ids,
          rec.status,
          rec.documented_budget,
          rec.currency,
          rec.announcement_date,
          rec.source_agency,
          rec.source_url,
          JSON.stringify(rec.provenance),
          rec.is_demo || false
        ]);
      }
      console.log('Official public investment records ingested successfully!');
    }

    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('UPDATED PUBLIC TABLES:\n' + res.rows.map(r => r.table_name).join('\n'));
  } catch(e) {
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
apply();
