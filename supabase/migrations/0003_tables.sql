-- ==============================================================================
-- CivicPulse AI — Migration 0003: Core Domain Tables
-- Target: Supabase PostgreSQL
-- Rule: NO synthetic default values on domain metrics, embeddings, or provenance.
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. DEPARTMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE departments (
    id VARCHAR(64) PRIMARY KEY, -- Canonical string identifier (e.g. 'WATCO', 'BMC_ROADS')
    name VARCHAR(255) NOT NULL,
    short_name VARCHAR(64) NOT NULL,
    description TEXT,
    lead_officer VARCHAR(255),
    contact_phone VARCHAR(64),
    contact_email VARCHAR(255),
    jurisdiction_wards INTEGER[],
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 2. USERS (Identity Disambiguation)
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Internal stable primary key
    auth_user_id UUID UNIQUE,                      -- Supabase auth.users(id) mapping
    legacy_firebase_uid VARCHAR(128) UNIQUE,       -- Historical Firebase UID (e.g. fb_uid_officer_synthetic_02)
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    role user_role_enum NOT NULL DEFAULT 'CITIZEN',
    status user_status_enum NOT NULL DEFAULT 'ACTIVE',
    department_id VARCHAR(64),
    ward_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    last_login_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 3. CITIZEN PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE citizen_profiles (
    id VARCHAR(128) PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    preferred_language VARCHAR(16) NOT NULL DEFAULT 'en',
    default_ward_id VARCHAR(64),
    notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 4. PROBLEM CLUSTERS (Canonical Municipal Public Problems)
-- -----------------------------------------------------------------------------
CREATE TABLE problem_clusters (
    id VARCHAR(64) PRIMARY KEY, -- Domain ID (e.g. 'PRB-2026-3968')
    title TEXT NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL,
    subcategory VARCHAR(64),
    department_id VARCHAR(64),
    ward_id VARCHAR(64),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status problem_status_enum NOT NULL DEFAULT 'NEW',
    signal_count INTEGER NOT NULL DEFAULT 1,
    
    -- Honest nullability: No synthetic 0 or 0.8 defaults
    estimated_population INTEGER,
    duration_days INTEGER,
    impact_score NUMERIC(5, 2) NOT NULL,
    impact_level impact_level_enum NOT NULL DEFAULT 'LOW',
    impact_explanation TEXT,
    confidence DOUBLE PRECISION,
    
    -- Dual embeddings: legacy 768-dim float array and target 1536-dim pgvector
    legacy_embedding FLOAT4[],
    new_embedding vector(1536),
    
    -- Deterministic factor breakdown
    severity_score NUMERIC(5,2),
    population_score NUMERIC(5,2),
    duration_score NUMERIC(5,2),
    concentration_score NUMERIC(5,2),
    critical_exposure_score NUMERIC(5,2),
    recurrence_score NUMERIC(5,2),
    evidence_score NUMERIC(5,2),
    
    assigned_to UUID,
    assigned_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    
    sla_state JSONB,
    data_provenance JSONB, -- Honest nullability: no hardcoded provenance value
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    supporting_media_count INTEGER NOT NULL DEFAULT 0,
    
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_updated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 5. SIGNALS (Raw & Normalized Grievances)
-- -----------------------------------------------------------------------------
CREATE TABLE signals (
    id VARCHAR(64) PRIMARY KEY, -- Domain ID (e.g. 'sig_...')
    source_type signal_source_enum NOT NULL DEFAULT 'CITIZEN',
    source_reference VARCHAR(255),
    citizen_id UUID,
    original_text TEXT NOT NULL,
    normalized_text TEXT,
    language VARCHAR(16) DEFAULT 'en',
    category VARCHAR(64),
    subcategory VARCHAR(64),
    severity signal_severity_enum NOT NULL DEFAULT 'UNKNOWN',
    duration_days INTEGER,
    department_id VARCHAR(64),
    recommended_department VARCHAR(64),
    ward_id VARCHAR(64),
    ward_name VARCHAR(255),
    geography_provenance VARCHAR(32), -- Honest nullability: no synthetic 'REAL' default
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_reference TEXT,
    critical_facility TEXT,
    status signal_status_enum NOT NULL DEFAULT 'ACTIVE',
    problem_cluster_id VARCHAR(64),
    processing_status signal_processing_enum NOT NULL DEFAULT 'PENDING',
    ai_confidence DOUBLE PRECISION,
    legacy_embedding FLOAT4[],
    new_embedding vector(1536),
    media_ids TEXT[],
    ai_analysis JSONB,
    submitted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. CLUSTER MEMBERS
-- -----------------------------------------------------------------------------
CREATE TABLE cluster_members (
    id VARCHAR(64) PRIMARY KEY, -- Domain ID (e.g. 'mem_...')
    problem_id VARCHAR(64) NOT NULL,
    signal_id VARCHAR(64) NOT NULL,
    relationship cluster_relationship_enum NOT NULL DEFAULT 'SUPPORTING',
    similarity NUMERIC(5, 4) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 7. SIGNAL MEDIA
-- -----------------------------------------------------------------------------
CREATE TABLE signal_media (
    id VARCHAR(64) PRIMARY KEY,
    signal_id VARCHAR(64),
    storage_path TEXT NOT NULL UNIQUE,
    media_type VARCHAR(32) NOT NULL DEFAULT 'IMAGE',
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    uploaded_by UUID NOT NULL,
    analysis_status VARCHAR(32) DEFAULT 'NOT_ANALYZED',
    created_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 8. ASSIGNMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE assignments (
    id VARCHAR(64) PRIMARY KEY, -- Domain ID (e.g. 'asgn_...')
    problem_id VARCHAR(64) NOT NULL,
    department_id VARCHAR(64) NOT NULL,
    previous_department_id VARCHAR(64),
    assigned_to UUID,
    assigned_by UUID NOT NULL,
    priority assignment_priority_enum NOT NULL DEFAULT 'MEDIUM',
    status assignment_status_enum NOT NULL DEFAULT 'ASSIGNED',
    notes TEXT,
    sla_state JSONB,
    assigned_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 9. PROBLEM ACTIONS (Immutable Audit History with First-Class SYSTEM Actor)
-- -----------------------------------------------------------------------------
CREATE TABLE problem_actions (
    id VARCHAR(64) PRIMARY KEY, -- Domain ID (e.g. 'act_...')
    problem_id VARCHAR(64) NOT NULL,
    actor_type action_actor_type_enum NOT NULL DEFAULT 'USER',
    actor_user_id UUID,          -- Populated when actor_type = 'USER'
    system_actor_id VARCHAR(128),-- Populated when actor_type = 'SYSTEM' (e.g. 'civicpulse_ai_advisory')
    actor_role VARCHAR(64) NOT NULL,
    triggered_by_user_id UUID,   -- Tracks human who triggered the action
    action_type VARCHAR(64) NOT NULL,
    previous_state problem_status_enum,
    new_state problem_status_enum,
    target_department_id VARCHAR(64),
    target_officer_id UUID,
    note TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 10. RESOLUTION EVIDENCE
-- -----------------------------------------------------------------------------
CREATE TABLE resolution_evidence (
    id VARCHAR(64) PRIMARY KEY, -- Domain ID (e.g. 'ev_...')
    problem_id VARCHAR(64) NOT NULL,
    submitted_by UUID NOT NULL,
    evidence_type evidence_type_enum NOT NULL,
    storage_path TEXT NOT NULL UNIQUE,
    media_type VARCHAR(32) DEFAULT 'IMAGE',
    media_ids TEXT[],
    file_size_bytes BIGINT,
    sha256_hash VARCHAR(64),
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_reference TEXT,
    observed_at TIMESTAMPTZ,
    before_or_after VARCHAR(16) DEFAULT 'AFTER',
    verification_id VARCHAR(64),
    status evidence_status_enum NOT NULL DEFAULT 'SUBMITTED',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 11. VERIFICATION RESULTS (AI Advisory Evaluations)
-- -----------------------------------------------------------------------------
CREATE TABLE verification_results (
    id VARCHAR(64) PRIMARY KEY, -- Domain ID (e.g. 'ver_...')
    problem_id VARCHAR(64) NOT NULL,
    evidence_id VARCHAR(64) NOT NULL,
    verification_result verification_result_enum NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    observed_conditions TEXT[],
    evidence_summary TEXT NOT NULL,
    before_after_comparison JSONB,
    inconsistencies TEXT[],
    explanation TEXT NOT NULL,
    recommended_review_reason TEXT,
    limitations TEXT[],
    review_required BOOLEAN NOT NULL DEFAULT TRUE,
    model VARCHAR(64),
    prompt_version VARCHAR(64),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 12. AI OPERATIONS LOG
-- -----------------------------------------------------------------------------
CREATE TABLE ai_operations (
    id VARCHAR(64) PRIMARY KEY, -- Domain ID (e.g. 'op_...')
    operation_type VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    model VARCHAR(64) NOT NULL,
    prompt_version VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    confidence DOUBLE PRECISION,
    latency_ms INTEGER,
    error_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL
);

-- -----------------------------------------------------------------------------
-- 13. IDEMPOTENCY RECORDS (Distributed Mutation Safety)
-- -----------------------------------------------------------------------------
CREATE TABLE idempotency_records (
    scoped_key VARCHAR(512) PRIMARY KEY, -- userId + method + path + clientKey
    status VARCHAR(32) NOT NULL,         -- 'IN_PROGRESS', 'COMPLETED'
    status_code INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);
