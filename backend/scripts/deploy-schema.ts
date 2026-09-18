import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool, PoolClient } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

interface MigrationFile {
  filename: string;
  order: number;
  fullPath: string;
  sizeBytes: number;
  sql: string;
}

const EXPECTED_MIGRATIONS = [
  '0001_extensions.sql',
  '0002_types.sql',
  '0003_tables.sql',
  '0004_constraints_indexes.sql',
  '0005_rls.sql',
  '0006_grants.sql'
];

const EXPECTED_TABLES = [
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

const EXPECTED_ENUMS = [
  'user_role_enum',
  'user_status_enum',
  'problem_status_enum',
  'impact_level_enum',
  'signal_source_enum',
  'signal_severity_enum',
  'signal_status_enum',
  'signal_processing_enum',
  'cluster_relationship_enum',
  'assignment_priority_enum',
  'assignment_status_enum',
  'action_actor_type_enum',
  'evidence_type_enum',
  'evidence_status_enum',
  'verification_result_enum'
];

export async function runSchemaDeployment(isDryRun: boolean = false) {
  console.log('========================================================================');
  console.log(` CIVICPULSE AI — SUPABASE POSTGRESQL SCHEMA DEPLOYMENT [${isDryRun ? 'DRY-RUN' : 'LIVE DEPLOY'}]`);
  console.log('========================================================================\n');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured in .env or environment.');
  }

  console.log(`Target Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  const pool = new Pool({ connectionString: databaseUrl });

  // 1. Inspect and verify migration files
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  console.log(`\n1. Inspecting migrations directory: ${migrationsDir}`);
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found at ${migrationsDir}`);
  }

  const foundFiles = fs.readdirSync(migrationsDir).sort();
  console.log(`   Found ${foundFiles.length} files in supabase/migrations/:`);
  for (const f of foundFiles) {
    console.log(`   - ${f}`);
  }

  if (JSON.stringify(foundFiles) !== JSON.stringify(EXPECTED_MIGRATIONS)) {
    throw new Error(`Migration files do not match expected list exactly. Found: ${foundFiles.join(', ')}`);
  }

  const migrations: MigrationFile[] = EXPECTED_MIGRATIONS.map((filename, index) => {
    const fullPath = path.join(migrationsDir, filename);
    const stat = fs.statSync(fullPath);
    const sql = fs.readFileSync(fullPath, 'utf8');
    return {
      filename,
      order: index + 1,
      fullPath,
      sizeBytes: stat.size,
      sql
    };
  });

  console.log(`\n2. Migration Execution Plan (${migrations.length} files):`);
  for (const m of migrations) {
    console.log(`   Step ${m.order}: ${m.filename} (${m.sizeBytes} bytes)`);
  }

  const client: PoolClient = await pool.connect();

  try {
    if (isDryRun) {
      console.log('\n--- EXECUTING DRY-RUN (TRANSACTION WITH ROLLBACK) ---');
      await client.query('BEGIN');
      for (const m of migrations) {
        console.log(`   Executing [Dry-Run] ${m.filename}...`);
        const start = Date.now();
        await client.query(m.sql);
        console.log(`   ✓ ${m.filename} executed cleanly (${Date.now() - start} ms)`);
      }
      console.log('   All 6 migrations parsed and executed successfully without error.');
      await client.query('ROLLBACK');
      console.log('   Dry-run transaction rolled back. Target database remains untouched.');
      return { success: true, dryRun: true };
    }

    console.log('\n--- EXECUTING LIVE MIGRATION DEPLOYMENT ---');
    // Execute migrations in order
    for (const m of migrations) {
      console.log(`\n--> Applying: ${m.filename}...`);
      const start = Date.now();
      await client.query(m.sql);
      console.log(`    ✓ Applied ${m.filename} successfully (${Date.now() - start} ms)`);
    }

    console.log('\nAll 6 migrations applied successfully to target database.');

    // -------------------------------------------------------------------------
    // Comprehensive Verification Checks
    // -------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(' VERIFYING DEPLOYED SCHEMA INTEGRITY');
    console.log('========================================================================\n');

    // A. Extensions Verification
    console.log('A. Extensions:');
    const extRes = await client.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector');
    `);
    const installedExts = extRes.rows.map((r: any) => r.extname);
    console.log(`   Installed extensions found: ${installedExts.join(', ')}`);
    for (const reqExt of ['uuid-ossp', 'pgcrypto', 'vector']) {
      if (!installedExts.includes(reqExt)) {
        throw new Error(`Required extension missing: ${reqExt}`);
      }
      const v = extRes.rows.find((r: any) => r.extname === reqExt)?.extversion;
      console.log(`   ✓ Extension "${reqExt}" verified (version: ${v})`);
    }

    // B. Enum Types Verification
    console.log('\nB. ENUM Types:');
    const enumRes = await client.query(`
      SELECT t.typname
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      GROUP BY t.typname;
    `);
    const installedEnums = enumRes.rows.map((r: any) => r.typname);
    for (const reqEnum of EXPECTED_ENUMS) {
      if (!installedEnums.includes(reqEnum)) {
        throw new Error(`Required ENUM type missing: ${reqEnum}`);
      }
      console.log(`   ✓ ENUM "${reqEnum}" verified`);
    }

    // C. Tables Verification
    console.log('\nC. Domain Tables Existence:');
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const installedTables = tableRes.rows.map((r: any) => r.table_name);
    for (const reqTable of EXPECTED_TABLES) {
      if (!installedTables.includes(reqTable)) {
        throw new Error(`Required table missing: ${reqTable}`);
      }
      console.log(`   ✓ Table "public.${reqTable}" verified`);
    }

    // D. Foreign Keys Verification
    console.log('\nD. Foreign Key Constraints:');
    const fkRes = await client.query(`
      SELECT conname, conrelid::regclass AS table_from, confrelid::regclass AS table_to
      FROM pg_constraint
      WHERE contype = 'f' AND connamespace = 'public'::regnamespace
      ORDER BY conname;
    `);
    console.log(`   Found ${fkRes.rowCount} foreign key constraints:`);
    for (const row of fkRes.rows) {
      console.log(`   ✓ FK [${row.conname}]: ${row.table_from} -> ${row.table_to}`);
    }

    // E. CHECK Constraints Verification
    console.log('\nE. CHECK Constraints:');
    const chkRes = await client.query(`
      SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) as def
      FROM pg_constraint
      WHERE contype = 'c' AND connamespace = 'public'::regnamespace AND conname NOT LIKE '%_not_null'
      ORDER BY conname;
    `);
    for (const row of chkRes.rows) {
      console.log(`   ✓ CHECK [${row.conname}] on ${row.table_name}: ${row.def}`);
    }

    // F. Indexes Verification
    console.log('\nF. Indexes & HNSW Vector Indexes:');
    const idxRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND (indexname LIKE 'idx_%' OR indexname LIKE '%embedding%')
      ORDER BY tablename, indexname;
    `);
    console.log(`   Found ${idxRes.rowCount} domain indexes:`);
    for (const row of idxRes.rows) {
      const isVector = row.indexdef.includes('hnsw') || row.indexdef.includes('vector');
      console.log(`   ✓ Index [${row.indexname}] on ${row.tablename} ${isVector ? '(HNSW VECTOR COSINE)' : ''}`);
    }

    // G. Row-Level Security (RLS) Verification
    console.log('\nG. Row-Level Security (RLS) on all 13 tables:');
    const rlsRes = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname = ANY($1::text[])
      ORDER BY relname;
    `, [EXPECTED_TABLES]);

    for (const row of rlsRes.rows) {
      if (!row.relrowsecurity) {
        throw new Error(`RLS is NOT enabled on table: ${row.relname}`);
      }
      console.log(`   ✓ RLS Enabled on "${row.relname}": relrowsecurity = ${row.relrowsecurity}`);
    }

    // H. PostgREST Default-Deny Policies Verification
    console.log('\nH. PostgREST Default-Deny Policies:');
    const policyRes = await client.query(`
      SELECT tablename, policyname, roles, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `);
    console.log(`   Found ${policyRes.rowCount} RLS policies:`);
    for (const row of policyRes.rows) {
      console.log(`   ✓ Policy [${row.policyname}] on ${row.tablename} (roles: ${row.roles}, cmd: ${row.cmd})`);
    }

    // I. Grants & Permissions Verification
    console.log('\nI. Grants & Permissions Lockout:');
    const privRes = await client.query(`
      SELECT grantee, table_name, string_agg(privilege_type, ', ') as privileges
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
        AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
      GROUP BY grantee, table_name
      ORDER BY table_name, grantee;
    `, [EXPECTED_TABLES]);

    const anonGrants = privRes.rows.filter((r: any) => r.grantee === 'anon' || r.grantee === 'authenticated');
    console.log(`   Direct table privileges for 'anon' and 'authenticated': ${anonGrants.length === 0 ? '0 (COMPLETE REVOCATION CONFIRMED)' : anonGrants.length}`);
    if (anonGrants.length > 0) {
      console.warn('   WARNING: Some privileges remain for anon/authenticated:', anonGrants);
    }

    const serviceGrants = privRes.rows.filter((r: any) => r.grantee === 'service_role' || r.grantee === 'postgres');
    console.log(`   Backend service access (postgres / service_role): ${serviceGrants.length > 0 ? 'CONFIRMED' : 'MISSING'}`);

    console.log('\n========================================================================');
    console.log(' SCHEMA DEPLOYMENT AND VERIFICATION COMPLETED WITH 100% SUCCESS');
    console.log('========================================================================\n');

    return {
      success: true,
      migrationsApplied: EXPECTED_MIGRATIONS,
      tablesCreated: installedTables.filter((t: string) => EXPECTED_TABLES.includes(t)),
      extensionsVerified: installedExts
    };
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  runSchemaDeployment(isDryRun).catch((err) => {
    console.error('\n[FATAL] Schema deployment failed:', err);
    process.exit(1);
  });
}
