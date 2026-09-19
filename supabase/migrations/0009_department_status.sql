-- ==============================================================================
-- CivicPulse AI — Migration 0009: Department Status & Registry Metadata
-- Target: Supabase PostgreSQL
-- ==============================================================================

-- 1. Add status column to departments table if not exists
ALTER TABLE departments ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';

-- 2. Index for filtering active departments
CREATE INDEX IF NOT EXISTS idx_departments_status ON departments(status);
