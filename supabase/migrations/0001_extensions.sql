-- ==============================================================================
-- CivicPulse AI — Migration 0001: Required Extensions
-- Target: Supabase PostgreSQL 15+
-- ==============================================================================

-- Standard UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic helpers
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- pgvector for dense semantic vector similarity & clustering
CREATE EXTENSION IF NOT EXISTS "vector";
