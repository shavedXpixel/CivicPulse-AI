-- ==============================================================================
-- CivicPulse AI — Migration 0002: Enums & Custom Types
-- ==============================================================================

-- 1. User & Identity Enums
CREATE TYPE user_role_enum AS ENUM (
    'CITIZEN',
    'FIELD_OFFICER',
    'DEPARTMENT_OFFICER',
    'ADMIN',
    'SYSTEM_ADMIN'
);

CREATE TYPE user_status_enum AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED'
);

-- 2. Problem Lifecycle Enums
CREATE TYPE problem_status_enum AS ENUM (
    'NEW',
    'TRIAGED',
    'ASSIGNED',
    'IN_PROGRESS',
    'AWAITING_VERIFICATION',
    'RESOLVED',
    'CLOSED',
    'REOPENED'
);

CREATE TYPE impact_level_enum AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

-- 3. Signal & Grievance Enums
CREATE TYPE signal_source_enum AS ENUM (
    'CITIZEN',
    'FIELD_OFFICER',
    'IMPORTED_GRIEVANCE',
    'SURVEY',
    'SYSTEM',
    'OTHER'
);

CREATE TYPE signal_severity_enum AS ENUM (
    'UNKNOWN',
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE signal_status_enum AS ENUM (
    'ACTIVE',
    'PROCESSED',
    'ATTACHED_TO_PROBLEM',
    'REVIEW_REQUIRED',
    'RESOLVED',
    'ARCHIVED'
);

CREATE TYPE signal_processing_enum AS ENUM (
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'REQUIRES_REVIEW'
);

-- 4. Clustering Enums
CREATE TYPE cluster_relationship_enum AS ENUM (
    'DUPLICATE',
    'RELATED',
    'SUPPORTING'
);

-- 5. Workflow & Assignment Enums
CREATE TYPE assignment_priority_enum AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE assignment_status_enum AS ENUM (
    'ASSIGNED',
    'ACCEPTED',
    'DECLINED',
    'COMPLETED',
    'ESCALATED',
    'CANCELLED'
);

-- 6. Audit & Actor Discriminator
CREATE TYPE action_actor_type_enum AS ENUM (
    'USER',
    'SYSTEM'
);

-- 7. Resolution & Verification Enums
CREATE TYPE evidence_type_enum AS ENUM (
    'COMPLETION_PHOTO',
    'FIELD_NOTE',
    'WORK_LOG',
    'DOCUMENT',
    'WORK_ORDER',
    'TELEMETRY_LOG',
    'SUPERVISOR_SIGN_OFF'
);

CREATE TYPE evidence_status_enum AS ENUM (
    'SUBMITTED',
    'UNDER_REVIEW',
    'ACCEPTED',
    'REJECTED',
    'INSUFFICIENT'
);

CREATE TYPE verification_result_enum AS ENUM (
    'VERIFIED',
    'INCONCLUSIVE',
    'REJECTED'
);
