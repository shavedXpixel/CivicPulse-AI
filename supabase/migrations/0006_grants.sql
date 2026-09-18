-- ==============================================================================
-- CivicPulse AI — Migration 0006: Permissions & Grants Lockout
-- Rule: Direct browser / PostgREST client roles are stripped of all domain access.
-- ==============================================================================

-- 1. Revoke all privileges on all tables from client roles
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;

-- 2. Alter default privileges for any future tables created in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;

-- 3. Grant schema usage only so connection handshakes do not produce schema errors
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 4. Authoritative Backend Service Access
-- Ensure service_role and postgres roles retain full operational access for backend server pool
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role, postgres;
