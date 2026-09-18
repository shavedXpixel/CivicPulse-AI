-- ==============================================================================
-- CivicPulse AI — Migration 0004: Foreign Keys, Constraints & Indexes
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. FOREIGN KEY CONSTRAINTS
-- -----------------------------------------------------------------------------

-- Users
ALTER TABLE public.users
    ADD CONSTRAINT fk_users_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- Citizen Profiles
ALTER TABLE citizen_profiles
    ADD CONSTRAINT fk_citizen_profiles_user
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Problem Clusters
ALTER TABLE problem_clusters
    ADD CONSTRAINT fk_problems_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_problems_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

-- Signals
ALTER TABLE signals
    ADD CONSTRAINT fk_signals_citizen
    FOREIGN KEY (citizen_id) REFERENCES public.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_signals_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_signals_problem_cluster
    FOREIGN KEY (problem_cluster_id) REFERENCES problem_clusters(id) ON DELETE SET NULL;

-- Cluster Members
ALTER TABLE cluster_members
    ADD CONSTRAINT fk_members_problem
    FOREIGN KEY (problem_id) REFERENCES problem_clusters(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_members_signal
    FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_cluster_member
    UNIQUE (problem_id, signal_id);

-- Signal Media
ALTER TABLE signal_media
    ADD CONSTRAINT fk_media_signal
    FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_media_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE CASCADE;

-- Assignments
ALTER TABLE assignments
    ADD CONSTRAINT fk_assignments_problem
    FOREIGN KEY (problem_id) REFERENCES problem_clusters(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_assignments_department
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_assignments_previous_dept
    FOREIGN KEY (previous_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_assignments_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_assignments_assigned_by
    FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE RESTRICT;

-- Problem Actions (First-Class System Actor Constraint)
ALTER TABLE problem_actions
    ADD CONSTRAINT fk_actions_problem
    FOREIGN KEY (problem_id) REFERENCES problem_clusters(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_actions_actor_user
    FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_actions_triggered_by
    FOREIGN KEY (triggered_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_actions_target_dept
    FOREIGN KEY (target_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_actions_target_officer
    FOREIGN KEY (target_officer_id) REFERENCES public.users(id) ON DELETE SET NULL,
    ADD CONSTRAINT chk_problem_action_actor
    CHECK (
        (actor_type = 'USER' AND actor_user_id IS NOT NULL AND system_actor_id IS NULL)
        OR
        (actor_type = 'SYSTEM' AND system_actor_id IS NOT NULL AND actor_user_id IS NULL)
    );

-- Resolution Evidence
ALTER TABLE resolution_evidence
    ADD CONSTRAINT fk_evidence_problem
    FOREIGN KEY (problem_id) REFERENCES problem_clusters(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_evidence_submitted_by
    FOREIGN KEY (submitted_by) REFERENCES public.users(id) ON DELETE RESTRICT;

-- Verification Results
ALTER TABLE verification_results
    ADD CONSTRAINT fk_verification_problem
    FOREIGN KEY (problem_id) REFERENCES problem_clusters(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_verification_evidence
    FOREIGN KEY (evidence_id) REFERENCES resolution_evidence(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_verification_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 2. INDEXES
-- -----------------------------------------------------------------------------

-- Users
CREATE INDEX idx_users_auth_id ON public.users(auth_user_id);
CREATE INDEX idx_users_legacy_uid ON public.users(legacy_firebase_uid);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_department ON public.users(department_id);

-- Problem Clusters
CREATE INDEX idx_problems_status ON problem_clusters(status);
CREATE INDEX idx_problems_dept ON problem_clusters(department_id);
CREATE INDEX idx_problems_ward ON problem_clusters(ward_id);
CREATE INDEX idx_problems_impact_score ON problem_clusters(impact_score DESC);
CREATE INDEX idx_problems_created ON problem_clusters(created_at DESC);
CREATE INDEX idx_problems_embedding ON problem_clusters USING hnsw (new_embedding vector_cosine_ops);

-- Signals
CREATE INDEX idx_signals_citizen ON signals(citizen_id);
CREATE INDEX idx_signals_dept ON signals(department_id);
CREATE INDEX idx_signals_ward ON signals(ward_id);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_cluster ON signals(problem_cluster_id);
CREATE INDEX idx_signals_created ON signals(created_at DESC);
CREATE INDEX idx_signals_embedding ON signals USING hnsw (new_embedding vector_cosine_ops);

-- Cluster Members
CREATE INDEX idx_cluster_members_problem ON cluster_members(problem_id);
CREATE INDEX idx_cluster_members_signal ON cluster_members(signal_id);

-- Signal Media
CREATE INDEX idx_signal_media_signal ON signal_media(signal_id);
CREATE INDEX idx_signal_media_path ON signal_media(storage_path);

-- Assignments
CREATE INDEX idx_assignments_problem ON assignments(problem_id);
CREATE INDEX idx_assignments_dept ON assignments(department_id);
CREATE INDEX idx_assignments_assigned_to ON assignments(assigned_to);

-- Problem Actions
CREATE INDEX idx_actions_problem ON problem_actions(problem_id);
CREATE INDEX idx_actions_created ON problem_actions(created_at ASC);
CREATE INDEX idx_actions_actor_user ON problem_actions(actor_user_id);
CREATE INDEX idx_actions_system_actor ON problem_actions(system_actor_id);

-- Resolution Evidence
CREATE INDEX idx_evidence_problem ON resolution_evidence(problem_id);
CREATE INDEX idx_evidence_path ON resolution_evidence(storage_path);

-- Verification Results
CREATE INDEX idx_verification_problem ON verification_results(problem_id);
CREATE INDEX idx_verification_evidence ON verification_results(evidence_id);

-- AI Operations
CREATE INDEX idx_ai_ops_entity ON ai_operations(entity_id);
CREATE INDEX idx_ai_ops_created ON ai_operations(created_at DESC);

-- Idempotency Records
CREATE INDEX idx_idempotency_expires ON idempotency_records(expires_at);
