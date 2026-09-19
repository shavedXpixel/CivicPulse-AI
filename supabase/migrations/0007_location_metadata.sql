-- ==============================================================================
-- CivicPulse AI — Migration 0007: Optional Location Metadata (Documentation Only)
-- STATUS: UNAPPLIED / DOCUMENTATION ONLY
-- Target: Supabase PostgreSQL
-- DO NOT RUN AUTOMATICALLY AGAINST PRODUCTION.
-- ==============================================================================
-- Note: latitude and longitude are already established as numeric DOUBLE PRECISION
-- columns in 0003_tables.sql on both 'signals' and 'problem_clusters'.
-- This migration documents future optional metadata columns for explicit location
-- provenance and precision tracking.
-- ==============================================================================

-- 1. Optional location provenance on signals (GPS vs MANUAL)
-- ALTER TABLE signals ADD COLUMN IF NOT EXISTS location_source VARCHAR(16);

-- 2. Optional sensor accuracy measurement in meters
-- ALTER TABLE signals ADD COLUMN IF NOT EXISTS location_accuracy_m DOUBLE PRECISION;

-- 3. Validation constraints for documentation
-- ALTER TABLE signals ADD CONSTRAINT check_location_source CHECK (location_source IS NULL OR location_source IN ('GPS', 'MANUAL'));
-- ALTER TABLE signals ADD CONSTRAINT check_location_accuracy_nonnegative CHECK (location_accuracy_m IS NULL OR location_accuracy_m >= 0);
