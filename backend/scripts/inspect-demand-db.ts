import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const sigs = await pool.query(`
      SELECT 
        id, 
        original_text, 
        normalized_text, 
        detected_category, 
        detected_urgency, 
        ward_id, 
        locality_name, 
        vector_dims(embedding) as embedding_dimension,
        is_demo, 
        submitted_at
      FROM demand_signals 
      WHERE is_demo = false
      ORDER BY submitted_at DESC;
    `);

    console.log(`REAL DEMAND SIGNALS IN POSTGRES: ${sigs.rows.length}`);
    for (const s of sigs.rows) {
      console.log(`- Signal ID: ${s.id}`);
      console.log(`  Original: "${s.original_text}"`);
      console.log(`  Normalized: "${s.normalized_text}"`);
      console.log(`  Category: ${s.detected_category} | Urgency: ${s.detected_urgency} | Ward: ${s.ward_id}`);
      console.log(`  Embedding Dimension: ${s.embedding_dimension}`);
      console.log(`  is_demo: ${s.is_demo} | Submitted: ${s.submitted_at}`);
    }

    const clus = await pool.query(`
      SELECT 
        id, 
        title, 
        category, 
        signal_count, 
        composite_demand_index, 
        priority_band, 
        is_demo, 
        metrics
      FROM demand_clusters 
      WHERE is_demo = false;
    `);

    console.log(`\nREAL DEMAND CLUSTERS IN POSTGRES: ${clus.rows.length}`);
    for (const c of clus.rows) {
      console.log(`- Cluster ID: ${c.id}`);
      console.log(`  Title: "${c.title}"`);
      console.log(`  Category: ${c.category} | Signals: ${c.signal_count}`);
      console.log(`  Composite Demand Index: ${c.composite_demand_index}`);
      console.log(`  Priority Band: ${c.priority_band}`);
      console.log(`  is_demo: ${c.is_demo}`);
      console.log(`  Metrics:`, JSON.stringify(c.metrics));
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
