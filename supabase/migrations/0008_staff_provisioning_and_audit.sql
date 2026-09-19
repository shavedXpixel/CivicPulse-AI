-- ==============================================================================
-- CivicPulse AI — Migration 0008: Staff Lifecycle 'INVITED' Status & Audit Trail
-- Target: Supabase PostgreSQL
-- Rule: Non-destructive additions; preserves existing production data and tables.
-- ==============================================================================

-- 1. Extend user_status_enum with 'INVITED'
ALTER TYPE user_status_enum ADD VALUE IF NOT EXISTS 'INVITED';

-- 2. Administrative Audit Log Table with Cryptographic Integrity Chain
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    actor_user_id VARCHAR(128) NOT NULL,
    actor_email VARCHAR(255),
    action VARCHAR(64) NOT NULL,
    target_user_id VARCHAR(128),
    target_email VARCHAR(255) NOT NULL,
    target_role VARCHAR(64) NOT NULL,
    department_id VARCHAR(64),
    result VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    details JSONB,
    previous_hash VARCHAR(64),
    record_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON admin_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs(target_email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
