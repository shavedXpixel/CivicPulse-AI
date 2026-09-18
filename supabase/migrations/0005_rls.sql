-- ==============================================================================
-- CivicPulse AI — Migration 0005: Row-Level Security (RLS) Default Deny
-- Rule: Direct PostgREST client access to all domain tables is completely denied.
-- Access is mediated exclusively by the authoritative backend API.
-- ==============================================================================

-- 1. Enable Row-Level Security on all 13 domain tables
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE citizen_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cluster_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolution_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_records ENABLE ROW LEVEL SECURITY;

-- 2. Explicit Default-Deny Policies for Client Roles ('anon', 'authenticated')
-- In accordance with project security directives, NO direct public SELECT or mutation
-- policies are granted on domain tables. All client queries via PostgREST evaluate to false.

CREATE POLICY "Deny All PostgREST Access Departments"
    ON departments FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Users"
    ON public.users FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Citizen Profiles"
    ON citizen_profiles FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Problem Clusters"
    ON problem_clusters FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Signals"
    ON signals FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Cluster Members"
    ON cluster_members FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Signal Media"
    ON signal_media FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Assignments"
    ON assignments FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Problem Actions"
    ON problem_actions FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Resolution Evidence"
    ON resolution_evidence FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Verification Results"
    ON verification_results FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access AI Operations"
    ON ai_operations FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);

CREATE POLICY "Deny All PostgREST Access Idempotency"
    ON idempotency_records FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
