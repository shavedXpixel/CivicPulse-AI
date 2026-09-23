# CivicPulse AI — Production Maintenance Log

## Maintenance Event: HF6.6B Legacy Synthetic Evidence Provenance Remediation

- **Target Evidence ID**: `evd_1790020354431_b8vg`
- **Parent Problem ID**: `PRB-2026-8299`
- **Reason for Remediation**:
  The resolution evidence row for acceptance case `PRB-2026-8299` was created during the Phase 15B E2E workflow validation with an explicit description prefix `[SYNTHETIC TEST EVIDENCE - PHASE 15B E2E WORKFLOW]`, but inherited PostgreSQL's default `is_demo = false`. This maintenance operation aligns the structured database column (`is_demo`) with the known artifact provenance, guaranteeing that Governance AI (`GovernanceTools.getResolutionPerformance`) in `REAL_MODE` excludes this synthetic test evidence from municipal intelligence and prompt contexts.
- **Old `is_demo` Value**: `false`
- **New `is_demo` Value**: `true`
- **Execution Timestamp**: `2026-09-23T20:36:01.311Z`
- **Operator / Maintenance Identifier**: `PHASE 15B.5.3.19-HF6.6B / controlled-legacy-evidence-remediation`
- **Affected Rows**: Exactly `1` row in `resolution_evidence` (verified inside an atomic transaction with row locking and row-count assertion).
- **Preserved Fields**:
  All other fields on `resolution_evidence` (`id`, `problem_id`, `submitted_by`, `evidence_type`, `storage_path`, `media_type`, `file_size_bytes`, `sha256_hash`, `description`, `latitude`, `longitude`, `location_reference`, `observed_at`, `before_or_after`, `verification_id`, `status`, `submitted_at`, `created_at`) were verified unchanged.
- **Relational Integrity Verification**:
  - `problem_clusters.status`: Remained `CLOSED` (`is_demo: false`).
  - `assignments`: Exactly 1 record (`asgn_1790019180691_5x1i`).
  - `problem_actions`: Exactly 6 actions (`ASSIGNED`, `STARTED_WORK`, `RESOLUTION_SUBMITTED`, `VERIFICATION_COMPLETED`, `RESOLVED`, `CLOSED`). Lifecycle history untouched.
  - `verification_results`: Exactly 1 record (`ver_1790020385306_597p`, foreign key `evidence_id = 'evd_1790020354431_b8vg'` intact).
  - `signals`: Exactly 1 linked citizen signal.
  - R2 Media Storage: Object `evidence/PRB-2026-8299/repair_proof_hf5_1790020350588.png` verified intact and readable (67 bytes).
- **Application & Governance Verification**:
  - `GET /api/v1/problems/PRB-2026-8299/evidence`: Returns evidence with `is_demo: true`.
  - UI `ResolutionWorkspace`: Renders `SYNTHETIC DEMO` amber badge.
  - `GovernanceTools.getResolutionPerformance`: Returns `evidence: []` in `REAL_MODE`, proving strict exclusion from AI intelligence context.
  - WATCO Active Workload: Stays `1` (`PRB-2026-3968`), confirming terminal problem status exclusion.
