-- ==============================================================================
-- CivicPulse AI — Migration 0010: Development Demand Intelligence Persistence
-- Target: Supabase PostgreSQL
-- Rule: Real Data Activation — Normalized schemas for demand signals, clusters,
--       cluster membership, verified public investments, and governance analyses.
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. DEMAND SIGNALS (Multilingual Normalized Citizen Demand Intake)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demand_signals (
    id VARCHAR(64) PRIMARY KEY,
    citizen_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    source_channel VARCHAR(32) NOT NULL DEFAULT 'WEB_FORM',
    original_language VARCHAR(16) NOT NULL DEFAULT 'en',
    original_text TEXT NOT NULL,
    normalized_language VARCHAR(16) NOT NULL DEFAULT 'en',
    normalized_text TEXT NOT NULL,
    normalization_confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    detected_category VARCHAR(64) NOT NULL,
    detected_urgency VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    ward_id VARCHAR(64) NOT NULL,
    locality_name VARCHAR(255),
    embedding vector(1536),
    demand_cluster_id VARCHAR(64),
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. DEMAND CLUSTERS (Semantic, Geographic & Temporal Demand Aggregates)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demand_clusters (
    id VARCHAR(64) PRIMARY KEY,
    title TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    subcategory VARCHAR(64),
    ward_ids VARCHAR(64)[] NOT NULL,
    locality_names TEXT[],
    centroid_lat DOUBLE PRECISION,
    centroid_lng DOUBLE PRECISION,
    signal_count INTEGER NOT NULL DEFAULT 1,
    first_signal_at TIMESTAMPTZ NOT NULL,
    last_signal_at TIMESTAMPTZ NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 1,
    composite_demand_index INTEGER NOT NULL DEFAULT 0,
    priority_band VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    metrics JSONB,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint on demand_signals(demand_cluster_id) -> demand_clusters(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_demand_signals_cluster'
    ) THEN
        ALTER TABLE demand_signals
        ADD CONSTRAINT fk_demand_signals_cluster
        FOREIGN KEY (demand_cluster_id) REFERENCES demand_clusters(id) ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. DEMAND CLUSTER MEMBERS (Membership & Edge Weights)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demand_cluster_members (
    cluster_id VARCHAR(64) NOT NULL REFERENCES demand_clusters(id) ON DELETE CASCADE,
    signal_id VARCHAR(64) NOT NULL REFERENCES demand_signals(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5,4),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (cluster_id, signal_id)
);

-- -----------------------------------------------------------------------------
-- 4. PUBLIC INVESTMENT PROJECTS (Official BMC / BSCL Capital Disclosures)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public_investment_projects (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL,
    plan_name TEXT NOT NULL,
    category VARCHAR(64) NOT NULL,
    ward_ids VARCHAR(64)[] NOT NULL DEFAULT '{}',
    status VARCHAR(32) NOT NULL,
    documented_budget NUMERIC(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    announcement_date VARCHAR(64),
    source_agency VARCHAR(255) NOT NULL,
    source_url TEXT NOT NULL,
    provenance JSONB NOT NULL,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 5. DEMAND ANALYSIS RUNS (Governance AI Interpretations & Audit Trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demand_analysis_runs (
    id VARCHAR(64) PRIMARY KEY,
    cluster_id VARCHAR(64) REFERENCES demand_clusters(id) ON DELETE CASCADE,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_name VARCHAR(64) NOT NULL,
    prompt_version VARCHAR(32) NOT NULL,
    analysis_response JSONB NOT NULL,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE
);

-- -----------------------------------------------------------------------------
-- 6. INDEXES FOR HIGH-THROUGHPUT READS & BOUNDARY ENFORCEMENT
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_demand_signals_ward_id ON demand_signals(ward_id);
CREATE INDEX IF NOT EXISTS idx_demand_signals_category ON demand_signals(detected_category);
CREATE INDEX IF NOT EXISTS idx_demand_signals_is_demo ON demand_signals(is_demo);
CREATE INDEX IF NOT EXISTS idx_demand_signals_cluster_id ON demand_signals(demand_cluster_id);

CREATE INDEX IF NOT EXISTS idx_demand_clusters_category ON demand_clusters(category);
CREATE INDEX IF NOT EXISTS idx_demand_clusters_is_demo ON demand_clusters(is_demo);
CREATE INDEX IF NOT EXISTS idx_demand_clusters_ward_ids ON demand_clusters USING gin(ward_ids);

CREATE INDEX IF NOT EXISTS idx_public_investment_is_demo ON public_investment_projects(is_demo);
CREATE INDEX IF NOT EXISTS idx_public_investment_category ON public_investment_projects(category);
CREATE INDEX IF NOT EXISTS idx_public_investment_ward_ids ON public_investment_projects USING gin(ward_ids);
