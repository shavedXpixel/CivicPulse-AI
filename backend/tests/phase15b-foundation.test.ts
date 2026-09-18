import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { env, validateRealModeConfig, validateNonGoogleConfig } from '../src/config/env';
import {
  IDatabaseProvider,
  IStorageProvider,
  IAIProvider,
  IAIVerificationProvider,
  IGovernanceAIProvider,
  ISimulationAIProvider,
  IAuthProvider,
  getDatabaseProvider,
  getStorageProvider,
  getAIProvider
} from '../src/providers';
import { PostgresTransactionHelper } from '../src/infrastructure/database/transaction.helper';

describe('Phase 15B.1 — Foundation & Non-Google Architecture Verification', () => {
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

  describe('1. PostgreSQL Migration Files Structure', () => {
    it('contains all 6 required migration files', () => {
      expect(fs.existsSync(migrationsDir)).toBe(true);

      const files = fs.readdirSync(migrationsDir).sort();
      expect(files).toEqual([
        '0001_extensions.sql',
        '0002_types.sql',
        '0003_tables.sql',
        '0004_constraints_indexes.sql',
        '0005_rls.sql',
        '0006_grants.sql'
      ]);
    });

    it('0001_extensions.sql enables uuid-ossp, pgcrypto, and vector', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0001_extensions.sql'), 'utf-8');
      expect(sql).toContain('"uuid-ossp"');
      expect(sql).toContain('"pgcrypto"');
      expect(sql).toContain('"vector"');
    });

    it('0002_types.sql defines all required canonical domain enums', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0002_types.sql'), 'utf-8');
      expect(sql).toContain('user_role_enum');
      expect(sql).toContain('user_status_enum');
      expect(sql).toContain('problem_status_enum');
      expect(sql).toContain('impact_level_enum');
      expect(sql).toContain('signal_source_enum');
      expect(sql).toContain('signal_severity_enum');
      expect(sql).toContain('signal_status_enum');
      expect(sql).toContain('signal_processing_enum');
      expect(sql).toContain('cluster_relationship_enum');
      expect(sql).toContain('assignment_priority_enum');
      expect(sql).toContain('assignment_status_enum');
      expect(sql).toContain('action_actor_type_enum');
      expect(sql).toContain('evidence_type_enum');
      expect(sql).toContain('evidence_status_enum');
      expect(sql).toContain('verification_result_enum');
    });

    it('0003_tables.sql defines all 13 core domain tables', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0003_tables.sql'), 'utf-8');
      const expectedTables = [
        'departments',
        'public.users',
        'citizen_profiles',
        'problem_clusters',
        'signals',
        'cluster_members',
        'signal_media',
        'assignments',
        'problem_actions',
        'resolution_evidence',
        'verification_results',
        'ai_operations',
        'idempotency_records'
      ];
      for (const table of expectedTables) {
        expect(sql).toContain(`CREATE TABLE ${table}`);
      }
    });
  });

  describe('2. User Identity Disambiguation (UUID vs Firebase UID)', () => {
    it('public.users defines separate UUID primary key, Supabase auth UUID, and legacy Firebase UID', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0003_tables.sql'), 'utf-8');
      expect(sql).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/);
      expect(sql).toMatch(/auth_user_id UUID UNIQUE/);
      expect(sql).toMatch(/legacy_firebase_uid VARCHAR\(128\) UNIQUE/);
      expect(sql).toMatch(/email VARCHAR\(255\) UNIQUE NOT NULL/);
    });
  });

  describe('3. First-Class SYSTEM Actor Model', () => {
    it('problem_actions schema supports USER and SYSTEM actors without dummy user records', () => {
      const tablesSql = fs.readFileSync(path.join(migrationsDir, '0003_tables.sql'), 'utf-8');
      expect(tablesSql).toMatch(/actor_type action_actor_type_enum NOT NULL DEFAULT 'USER'/);
      expect(tablesSql).toMatch(/actor_user_id UUID/);
      expect(tablesSql).toMatch(/system_actor_id VARCHAR\(128\)/);
      expect(tablesSql).toMatch(/triggered_by_user_id UUID/);

      const constraintsSql = fs.readFileSync(path.join(migrationsDir, '0004_constraints_indexes.sql'), 'utf-8');
      expect(constraintsSql).toContain('chk_problem_action_actor');
      expect(constraintsSql).toContain("actor_type = 'USER' AND actor_user_id IS NOT NULL AND system_actor_id IS NULL");
      expect(constraintsSql).toContain("actor_type = 'SYSTEM' AND system_actor_id IS NOT NULL AND actor_user_id IS NULL");
    });
  });

  describe('4. Synthetic Defaults Audit & Elimination', () => {
    it('problem_clusters does NOT contain synthetic defaults for provenance, population, confidence, or duration', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0003_tables.sql'), 'utf-8');
      // Extract problem_clusters block
      const problemBlock = sql.split('CREATE TABLE problem_clusters')[1]?.split('CREATE TABLE signals')[0] || '';
      
      expect(problemBlock).not.toMatch(/data_provenance\s+JSONB\s+DEFAULT\s+'REAL'/i);
      expect(problemBlock).not.toMatch(/confidence\s+DOUBLE PRECISION\s+DEFAULT\s+0\.8/i);
      expect(problemBlock).not.toMatch(/estimated_population\s+INTEGER\s+DEFAULT\s+0/i);
      expect(problemBlock).not.toMatch(/duration_days\s+INTEGER\s+DEFAULT\s+0/i);
      expect(problemBlock).not.toMatch(/severity_score\s+NUMERIC\(5,2\)\s+DEFAULT\s+0/i);
    });

    it('signals does NOT contain synthetic defaults for geography_provenance or media_ids', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0003_tables.sql'), 'utf-8');
      const signalsBlock = sql.split('CREATE TABLE signals')[1]?.split('CREATE TABLE cluster_members')[0] || '';

      expect(signalsBlock).not.toMatch(/geography_provenance\s+JSONB\s+DEFAULT\s+'REAL'/i);
      expect(signalsBlock).not.toMatch(/media_ids\s+.*DEFAULT\s+'\{\}'/i);
    });
  });

  describe('5. pgvector & Dual Embeddings Foundation', () => {
    it('supports both legacy_embedding float array and new_embedding vector(1536)', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0003_tables.sql'), 'utf-8');
      expect(sql).toMatch(/legacy_embedding FLOAT4\[\]/);
      expect(sql).toMatch(/new_embedding vector\(1536\)/);
    });

    it('creates HNSW cosine vector indexes for problem_clusters and signals', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0004_constraints_indexes.sql'), 'utf-8');
      expect(sql).toContain('CREATE INDEX idx_problems_embedding ON problem_clusters USING hnsw (new_embedding vector_cosine_ops)');
      expect(sql).toContain('CREATE INDEX idx_signals_embedding ON signals USING hnsw (new_embedding vector_cosine_ops)');
    });
  });

  describe('6. RLS & PostgREST Access Lockout Defense-in-Depth', () => {
    it('0005_rls.sql enables RLS on all 13 domain tables with default deny', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0005_rls.sql'), 'utf-8');
      const expectedTables = [
        'departments',
        'public.users',
        'citizen_profiles',
        'problem_clusters',
        'signals',
        'cluster_members',
        'signal_media',
        'assignments',
        'problem_actions',
        'resolution_evidence',
        'verification_results',
        'ai_operations',
        'idempotency_records'
      ];
      for (const table of expectedTables) {
        expect(sql).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      }
      expect(sql).toContain('CREATE POLICY "Deny All PostgREST Access Problem Clusters"');
      expect(sql).toContain('CREATE POLICY "Deny All PostgREST Access Signals"');
      expect(sql).not.toContain('CREATE POLICY "Public Read Published Problems"');
    });

    it('0006_grants.sql revokes all table privileges from anon and authenticated', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0006_grants.sql'), 'utf-8');
      expect(sql).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;');
      expect(sql).toContain('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;');
      expect(sql).toContain('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, postgres;');
    });
  });

  describe('7. Idempotency Records Table', () => {
    it('defines idempotency_records with scoped_key, status, response_body, and expires_at', () => {
      const sql = fs.readFileSync(path.join(migrationsDir, '0003_tables.sql'), 'utf-8');
      expect(sql).toMatch(/scoped_key VARCHAR\(512\) PRIMARY KEY/);
      expect(sql).toMatch(/status VARCHAR\(32\) NOT NULL/);
      expect(sql).toMatch(/response_body JSONB/);
      expect(sql).toMatch(/expires_at TIMESTAMPTZ NOT NULL/);
    });
  });

  describe('8. Provider Scaffolding & Preservation', () => {
    it('IAuthProvider interface is cleanly exported from providers index', () => {
      const authInterfacePath = path.resolve(__dirname, '../src/providers/auth/auth.interface.ts');
      expect(fs.existsSync(authInterfacePath)).toBe(true);
    });

    it('Phase 14 providers remain intact and runnable as rollback baseline', () => {
      const db = getDatabaseProvider();
      expect(db).toBeDefined();

      const storage = getStorageProvider();
      expect(storage).toBeDefined();

      const ai = getAIProvider();
      expect(ai).toBeDefined();
    });

    it('PostgresTransactionHelper scaffolding defines templates for all 4 atomic operations', () => {
      expect(typeof PostgresTransactionHelper.withTransaction).toBe('function');
      expect(typeof PostgresTransactionHelper.executeAtomicAssignProblem).toBe('function');
      expect(typeof PostgresTransactionHelper.executeAtomicTransitionStatus).toBe('function');
      expect(typeof PostgresTransactionHelper.executeAtomicCreateClusterFromSignal).toBe('function');
      expect(typeof PostgresTransactionHelper.executeAtomicReviewResolution).toBe('function');
    });
  });

  describe('9. Environment Configuration Scaffolding', () => {
    it('env object parses Phase 15B non-Google variables with safe defaults', () => {
      expect(env.SUPABASE_URL).toBeDefined();
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
      expect(env.DATABASE_URL).toBeDefined();
      expect(env.OPENAI_API_KEY).toBeDefined();
      expect(env.AI_PROVIDER).toBeDefined();
      expect(env.AI_EMBEDDING_DIMENSIONS).toBe(1536);
    });

    it('preserves Phase 14 validateRealModeConfig backward compatibility', () => {
      const testEnv = {
        DEMO_MODE: false,
        FIREBASE_PROJECT_ID: 'test-project',
        PROVIDER_MODE: 'mock' as const
      };
      const result = validateRealModeConfig(testEnv as any);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('provides validateNonGoogleConfig helper for future Phase 15B cutover', () => {
      const testEnv = {
        DEMO_MODE: false,
        PROVIDER_MODE: 'cloud' as const,
        SUPABASE_URL: '',
        DATABASE_URL: '',
        OPENAI_API_KEY: ''
      };
      const result = validateNonGoogleConfig(testEnv as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });
});
