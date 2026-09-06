# CivicPulse AI

## Data Model & Database Specification

**Version:** 1.0
**Status:** Hackathon MVP
**Product:** CivicPulse AI

---

# 1. Purpose

This document defines the canonical data model for CivicPulse AI.

It specifies:

* operational entities;
* analytical entities;
* relationships;
* fields;
* types;
* required/optional values;
* lifecycle states;
* indexes;
* AI metadata;
* audit records;
* synthetic demo data.

The implementation must treat this document as the database contract.

Do not create new entities or fields casually when an existing model can represent the requirement.

---

# 2. Data Architecture

CivicPulse uses three primary storage systems.

```text
Firestore
    ↓
Operational Application Data

BigQuery
    ↓
Analytics / Aggregations / Trends

Cloud Storage
    ↓
Images / Resolution Evidence / Media
```

---

# 3. Storage Responsibilities

## 3.1 Firestore

Use Firestore for:

* users;
* profiles;
* departments;
* wards;
* signals;
* problem clusters;
* assignments;
* actions;
* evidence metadata;
* verification results;
* notifications;
* AI operation metadata;
* configuration;
* audit records.

Firestore is the primary operational source of truth.

---

## 3.2 BigQuery

Use BigQuery for:

* historical analytics;
* time-series aggregation;
* trend analysis;
* cross-ward analysis;
* cross-department analysis;
* dashboard aggregation at larger scale.

BigQuery should not replace Firestore as the source of truth for workflow state.

---

## 3.3 Cloud Storage

Use Cloud Storage for:

* citizen-uploaded images;
* resolution images;
* supporting documents;
* other approved media.

Firestore stores metadata and references rather than large binary objects.

---

# 4. Entity Relationship Overview

```text
User
 ├── Citizen Profile
 │
 └── Role

Signal
 ├── belongs to User
 ├── belongs to Ward
 ├── references Department
 ├── has Media
 └── belongs to Problem Cluster

Problem Cluster
 ├── contains Signals
 ├── references Department
 ├── belongs to Ward
 ├── has Impact Score
 ├── has Assignments
 ├── has Actions
 ├── has Resolution Evidence
 └── has Verification Result

Department
 └── has Officers

Ward
 └── has Problem Clusters

AI Operation
 └── references source entity

Audit Log
 └── references actor + affected entity
```

---

# 5. Global Data Rules

## 5.1 IDs

All major entities must use unique IDs.

Recommended format:

```text
usr_xxxxx
sig_xxxxx
prb_xxxxx
dep_xxxxx
ward_xxxxx
asg_xxxxx
act_xxxxx
evd_xxxxx
ver_xxxxx
ai_xxxxx
aud_xxxxx
```

The exact ID implementation may use Firestore-generated IDs, but the API should expose stable identifiers.

---

## 5.2 Timestamps

Store timestamps using UTC-compatible timestamp types.

Primary fields:

```text
created_at
updated_at
```

Additional lifecycle timestamps may include:

```text
submitted_at
assigned_at
started_at
resolved_at
closed_at
verified_at
```

Frontend should format timestamps according to the user's locale/timezone where appropriate.

---

## 5.3 Soft Deletion

Important operational records should generally not be physically deleted during normal workflows.

Where necessary use:

```text
deleted_at
is_deleted
```

Do not destroy audit history.

---

# 6. User Entity

Collection:

```text
/users
```

Schema:

```text
id                string
email             string?
display_name      string
photo_url         string?
role              enum
status            enum
created_at        timestamp
updated_at        timestamp
last_login_at     timestamp?
```

---

## 6.1 Role Enum

```text
CITIZEN
FIELD_OFFICER
DEPARTMENT_OFFICER
ADMIN
SYSTEM_ADMIN
```

---

## 6.2 User Status

```text
ACTIVE
INACTIVE
SUSPENDED
```

---

# 7. Citizen Profile

Collection:

```text
/citizen_profiles
```

Schema:

```text
id                   string
user_id              string
preferred_language   string
default_ward_id      string?
notification_enabled boolean
created_at           timestamp
updated_at           timestamp
```

Do not store unnecessary sensitive personal information.

---

# 8. Department Entity

Collection:

```text
/departments
```

Schema:

```text
id                 string
name               string
code               string
description        string?
active             boolean
default_sla_hours  number?
created_at         timestamp
updated_at         timestamp
```

---

## 8.1 Example Departments

```text
WATER
ROADS
SANITATION
DRAINAGE
ELECTRICAL
TRAFFIC
PUBLIC_HEALTH
MUNICIPAL_SERVICES
OTHER
```

These are configurable reference values.

---

# 9. Ward Entity

Collection:

```text
/wards
```

Schema:

```text
id                 string
name               string
code               string
district_id        string?
population         number?
boundary_reference string?
center_lat         number?
center_lng         number?
active             boolean
created_at         timestamp
updated_at         timestamp
```

Population figures may be synthetic in the MVP.

---

# 10. Signal Entity

Collection:

```text
/signals
```

This is one of the most important entities.

Schema:

```text
id                    string
source_type           enum
source_reference      string?
citizen_id            string?
original_text         string?
normalized_text       string?
language              string?
category              string?
subcategory           string?
severity              enum
duration_days         number?
department_id         string?
ward_id               string?
location              GeoPoint?
location_reference    string?
critical_facility     string?
status                enum
problem_cluster_id    string?
processing_status     enum
ai_confidence         number?
created_at            timestamp
updated_at            timestamp
submitted_at          timestamp?
```

---

# 11. Signal Source Type

Possible values:

```text
CITIZEN
FIELD_OFFICER
IMPORTED_GRIEVANCE
SURVEY
SYSTEM
OTHER
```

The architecture should support future external integrations.

---

# 12. Signal Severity

```text
UNKNOWN
LOW
MEDIUM
HIGH
CRITICAL
```

---

# 13. Signal Status

```text
ACTIVE
PROCESSED
ATTACHED_TO_PROBLEM
REVIEW_REQUIRED
RESOLVED
ARCHIVED
```

The signal lifecycle is separate from the problem lifecycle.

---

# 14. Signal Processing Status

```text
PENDING
PROCESSING
COMPLETED
FAILED
REQUIRES_REVIEW
```

---

# 15. Signal Location

Use a structured geospatial representation.

Recommended:

```json
{
  "lat": 20.2961,
  "lng": 85.8245
}
```

Where supported by Firestore, use a native GeoPoint type.

Do not fabricate coordinates from text.

---

# 16. Signal Media

Collection:

```text
/signal_media
```

Schema:

```text
id               string
signal_id        string
storage_path     string
media_type       enum
mime_type        string
file_size_bytes  number
uploaded_by      string
created_at       timestamp
analysis_status  enum
```

---

## 16.1 Media Types

```text
IMAGE
VIDEO
DOCUMENT
AUDIO
```

The MVP primarily requires images.

---

## 16.2 Media Analysis Status

```text
NOT_ANALYZED
PROCESSING
ANALYZED
FAILED
```

---

# 17. Problem Cluster Entity

Collection:

```text
/problem_clusters
```

This is the primary governance-level entity.

Schema:

```text
id                          string
title                       string
description                 string?
category                    string
subcategory                 string?
department_id               string?
ward_id                     string?
location                    GeoPoint?
status                      enum
signal_count                number
estimated_population        number?
duration_days               number?
severity_score              number
population_score            number
duration_score              number
concentration_score         number
critical_exposure_score     number
recurrence_score            number
evidence_score              number
impact_score                number
impact_level                enum
impact_explanation          string?
confidence                  number?
first_detected_at           timestamp
last_updated_at             timestamp
created_at                  timestamp
updated_at                  timestamp
```

---

# 18. Problem Status

```text
NEW
TRIAGED
ASSIGNED
IN_PROGRESS
AWAITING_VERIFICATION
RESOLVED
CLOSED
REOPENED
```

---

# 19. Impact Level

Derived from the impact score.

Suggested:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Initial thresholds may be:

```text
0–39      LOW
40–64     MEDIUM
65–84     HIGH
85–100    CRITICAL
```

These thresholds are configurable.

---

# 20. Impact Score

The total impact score is:

```text
0–100
```

Default weights:

```text
Severity                         25%
Population Affected             20%
Duration                        15%
Complaint Concentration         15%
Critical Facility Exposure      10%
Recurrence                      10%
Evidence Confidence              5%
```

Store both:

* component scores;
* final score.

Do not only store the final score.

---

# 21. Impact Score Example

```json id="8b6nbi"
{
  "severity_score": 24,
  "population_score": 18,
  "duration_score": 14,
  "concentration_score": 14,
  "critical_exposure_score": 9,
  "recurrence_score": 8,
  "evidence_score": 5,
  "impact_score": 92,
  "impact_level": "CRITICAL"
}
```

---

# 22. Problem Cluster Membership

Collection:

```text
/problem_cluster_members
```

Schema:

```text
id             string
problem_id     string
signal_id      string
relationship   enum
similarity     number
reason         string?
created_at     timestamp
```

---

# 23. Relationship Type

```text
DUPLICATE
RELATED
SUPPORTING
```

The system must distinguish strong duplicates from merely related reports.

---

# 24. Similarity

Store a normalized value:

```text
0–1
```

Example:

```text
0.93
```

The UI may display this as a percentage when useful.

---

# 25. Assignment Entity

Collection:

```text
/assignments
```

Schema:

```text
id                 string
problem_id         string
department_id      string
assigned_to        string?
assigned_by        string
priority           enum
status             enum
assigned_at        timestamp
due_at             timestamp?
completed_at       timestamp?
created_at         timestamp
updated_at         timestamp
```

---

# 26. Assignment Priority

```text
LOW
MEDIUM
HIGH
CRITICAL
```

Priority should generally be derived from problem impact and business rules.

---

# 27. Assignment Status

```text
ASSIGNED
ACCEPTED
DECLINED
COMPLETED
ESCALATED
CANCELLED
```

---

# 28. Action Entity

Collection:

```text
/actions
```

This records important problem workflow events.

Schema:

```text
id                string
problem_id        string
actor_id          string
action_type       enum
note              string?
metadata          map?
created_at        timestamp
```

---

# 29. Action Types

```text
CREATED
TRIAGED
ASSIGNED
REASSIGNED
ACCEPTED
STARTED_WORK
ESCALATED
REQUESTED_INFO
EVIDENCE_ADDED
RESOLUTION_SUBMITTED
VERIFICATION_REQUESTED
VERIFICATION_COMPLETED
RESOLVED
REOPENED
CLOSED
```

---

# 30. Resolution Evidence Entity

Collection:

```text
/resolution_evidence
```

Schema:

```text
id                 string
problem_id         string
submitted_by       string
storage_path       string
media_type         string
description        string?
observed_at        timestamp?
submitted_at       timestamp
verification_id    string?
status             enum
created_at         timestamp
```

---

# 31. Resolution Evidence Status

```text
SUBMITTED
UNDER_REVIEW
ACCEPTED
REJECTED
INSUFFICIENT
```

---

# 32. Verification Result Entity

Collection:

```text
/verification_results
```

Schema:

```text
id                   string
problem_id           string
evidence_id          string
status               enum
confidence            number
observations          array<string>
limitations           array<string>
model                 string?
prompt_version        string?
review_required       boolean
reviewed_by           string?
reviewed_at           timestamp?
created_at            timestamp
```

---

# 33. Verification Status

```text
LIKELY_RESOLVED
UNCERTAIN
LIKELY_NOT_RESOLVED
INSUFFICIENT_EVIDENCE
```

---

# 34. Verification Rule

AI verification does not equal official closure.

The backend must treat the AI result as an assessment.

Example:

```text
AI:
LIKELY_RESOLVED

Problem:
AWAITING_VERIFICATION

Human officer:
Confirms

Problem:
RESOLVED
```

The exact state-transition policy is defined by authorization rules.

---

# 35. AI Operation Entity

Collection:

```text
/ai_operations
```

Schema:

```text
id                string
operation_type    enum
entity_type       string
entity_id         string
model              string
prompt_version    string
status            enum
confidence        number?
latency_ms        number?
error_code        string?
created_at        timestamp
```

Do not unnecessarily store sensitive raw prompts or full model outputs.

---

# 36. AI Operation Types

```text
LANGUAGE_DETECTION
SIGNAL_UNDERSTANDING
CLASSIFICATION
DEPARTMENT_RECOMMENDATION
IMAGE_ANALYSIS
SIMILARITY_ANALYSIS
CLUSTER_SUMMARY
IMPACT_EXPLANATION
GOVERNANCE_QUERY
GOVERNANCE_BRIEF
RESOLUTION_VERIFICATION
TRANSLATION
```

---

# 37. AI Operation Status

```text
SUCCESS
FAILED
TIMEOUT
VALIDATION_FAILED
RATE_LIMITED
```

---

# 38. Governance Insight Entity

Collection:

```text
/ai_insights
```

Schema:

```text
id                   string
insight_type         enum
title                string
summary              string
scope                object
supporting_entities  array<string>
supporting_metrics   array<object>
recommendation       string?
confidence           number?
generated_at         timestamp
model                string?
prompt_version       string?
expires_at           timestamp?
```

---

# 39. Insight Types

```text
AI_BRIEF
TREND_EXPLANATION
PRIORITY_EXPLANATION
GOVERNANCE_ANSWER
RECOMMENDATION
```

---

# 40. Notification Entity

Collection:

```text
/notifications
```

Schema:

```text
id             string
user_id        string
type           enum
title          string
message        string
entity_type    string?
entity_id      string?
read           boolean
created_at     timestamp
read_at        timestamp?
```

---

# 41. Notification Types

```text
REPORT_RECEIVED
REPORT_UPDATED
ASSIGNED
STATUS_CHANGED
RESOLUTION_SUBMITTED
VERIFICATION_COMPLETED
ACTION_REQUIRED
SYSTEM
```

---

# 42. Audit Log Entity

Collection:

```text
/audit_logs
```

Schema:

```text
id                 string
actor_id            string?
actor_role          string?
action              string
entity_type        string
entity_id           string
before              map?
after               map?
metadata            map?
request_id          string?
created_at          timestamp
```

Audit logs should be treated as append-oriented records.

---

# 43. Audit Requirements

Audit important actions such as:

* assignment;
* reassignment;
* escalation;
* status changes;
* evidence submission;
* verification;
* role changes;
* configuration changes;
* sensitive administrative actions.

Avoid storing unnecessary sensitive payloads.

---

# 44. Data Source Entity

Collection:

```text
/data_sources
```

Schema:

```text
id                 string
name               string
type               enum
description        string?
active             boolean
last_sync_at       timestamp?
configuration_ref  string?
created_at         timestamp
updated_at         timestamp
```

---

# 45. Data Source Types

```text
CITIZEN_PORTAL
MUNICIPAL_SYSTEM
GRIEVANCE_SYSTEM
FIELD_IMPORT
CSV
API
SURVEY
INTERNAL
```

Actual external integrations are future scope.

---

# 46. System Configuration Entity

Collection:

```text
/system_config
```

Potential configuration:

```text
impact_weights
impact_thresholds
similarity_thresholds
supported_languages
category_taxonomy
departments
sla_defaults
feature_flags
```

Configuration changes must be audited.

---

# 47. Category Taxonomy

Initial categories:

```text
water_supply
roads
drainage
garbage
sanitation
streetlights
electricity
public_toilets
traffic
public_infrastructure
other
```

Each category may optionally have subcategories.

Example:

```text
water_supply
├── outage
├── low_pressure
├── contamination
├── leakage
└── other
```

The taxonomy should be configurable.

---

# 48. Common Reference Fields

Where applicable:

```text
country_code
region_code
district_id
ward_id
department_id
```

The MVP should focus on a single configured geography while avoiding hard-coded assumptions that prevent future expansion.

---

# 49. Firestore Relationships

Firestore does not enforce relational integrity like a SQL database.

The application must enforce relationships.

Example:

```text
signal.problem_cluster_id
```

must refer to an existing problem cluster or be null.

---

# 50. Referential Integrity

Before writing references:

* validate the referenced entity exists;
* validate it is active where required;
* validate user permissions;
* validate lifecycle state.

Example:

An inactive officer cannot receive a new assignment.

---

# 51. Firestore Document Size

Avoid storing large arrays directly in documents.

For example, do not store thousands of signal IDs inside one problem-cluster document.

Use:

```text
problem_clusters
problem_cluster_members
```

instead.

---

# 52. Denormalization

Controlled denormalization is acceptable for performance.

Example problem cluster may store:

```text
signal_count
```

even though signal membership exists separately.

When denormalized values change, update them through backend logic.

Never maintain conflicting sources of truth casually.

---

# 53. Counter Fields

Potential cached counters:

```text
problem_clusters.signal_count
problem_clusters.estimated_population
```

These may be updated transactionally or through controlled backend processing.

---

# 54. Historical Preservation

Do not overwrite important historical values when possible.

For example, a problem's impact may change.

The system may later support:

```text
impact_history
```

as a separate entity or analytical table.

For MVP, current impact + audit history is sufficient.

---

# 55. BigQuery Analytical Model

The analytics layer should contain denormalized analytical tables or views such as:

```text
fact_signals
fact_problem_clusters
fact_assignments
fact_resolutions
fact_verifications
fact_daily_metrics
```

---

# 56. Fact: Signals

Suggested fields:

```text
signal_id
date
timestamp
ward_id
department_id
category
severity
status
latitude
longitude
problem_cluster_id
source_type
```

---

# 57. Fact: Problem Clusters

Suggested fields:

```text
problem_id
created_date
updated_date
ward_id
department_id
category
status
signal_count
estimated_population
impact_score
impact_level
duration_days
```

---

# 58. Fact: Assignments

Suggested fields:

```text
assignment_id
problem_id
department_id
officer_id
assigned_date
due_date
completed_date
priority
status
```

---

# 59. Fact: Resolutions

Suggested fields:

```text
problem_id
submitted_date
verified_date
verification_status
verification_confidence
resolved_date
closed_date
```

---

# 60. Daily Metrics

Suggested analytical metrics:

```text
signals_created
signals_processed
new_problem_clusters
active_problem_clusters
high_impact_problems
critical_problems
resolved_problems
average_resolution_hours
median_resolution_hours
sla_breaches
```

---

# 61. Trend Calculation

Trend metrics should be calculated from structured data.

Example:

```text
current_period = 420
previous_period = 320

change_percentage =
((420 - 320) / 320) * 100
= 31.25%
```

Store exact calculated values where useful.

Do not ask Gemini to perform this calculation when backend code can do it reliably.

---

# 62. Geographic Analytics

Possible analytical dimensions:

```text
ward
district
department
category
time
impact_level
status
```

Potential metrics:

```text
problem_count
signal_count
unresolved_impact
average_resolution_time
critical_problem_count
```

---

# 63. Synthetic Data Requirements

The demo dataset must be synthetic unless explicitly connected to authorized real data.

Suggested minimum:

```text
10+ wards
5+ departments
10,000+ signals
500+ problem clusters
```

The exact volume can be reduced if needed for development performance.

---

# 64. Synthetic Data Distribution

The dataset should not be uniformly random.

Create realistic patterns.

Example:

```text
Ward 18:
Heavy water issue concentration

Ward 7:
Road damage concentration

Ward 12:
Garbage and sanitation concentration

Ward 3:
Streetlight concentration
```

This allows the dashboard to reveal meaningful patterns.

---

# 65. Duplicate Data

Include realistic duplicate/related groups.

Example:

```text
P-1042
├── S-10401
├── S-10402
├── S-10403
├── ...
└── S-10728
```

Not every report should be identical.

Use:

* different wording;
* different languages;
* nearby locations;
* different timestamps;
* different descriptions of the same underlying issue.

---

# 66. Multilingual Synthetic Data

Include:

* English;
* Hindi;
* Odia.

Example:

English:

> No water supply for three days.

Hindi:

> हमारे इलाके में तीन दिन से पानी नहीं आ रहा है।

Odia:

> ଆମ ଅଞ୍ଚଳରେ ତିନି ଦିନ ହେଲା ପାଣି ଆସୁନାହିଁ।

The system should preserve original text.

---

# 67. Golden Problem Cluster

Create a deliberately strong demo cluster.

Example:

```text
Problem ID:
P-WATER-018

Title:
Water Supply Disruption — Ward 18

Signals:
327

Images:
42

Field Reports:
8

Duration:
3 days

Critical Facility:
Nearby school

Impact:
92

Level:
CRITICAL

Status:
IN_PROGRESS
```

---

# 68. Golden Resolution Problem

Create a problem with resolution evidence.

Example:

```text
Problem:
Road Damage — Ward 7

Impact:
81

Status:
AWAITING_VERIFICATION
```

Resolution evidence:

```text
Image uploaded
Description:
Road surface repaired
```

AI verification:

```text
LIKELY_RESOLVED
Confidence:
0.91
```

This supports the final demo flow.

---

# 69. Demo Users

Create seeded demo accounts for development.

Suggested roles:

```text
demo.citizen
demo.field.officer
demo.department.officer
demo.admin
demo.system.admin
```

Do not commit real credentials.

Use environment-controlled demo authentication.

---

# 70. Data Privacy

Never place sensitive information into synthetic records unnecessarily.

Avoid realistic-looking:

* personal phone numbers;
* government IDs;
* bank information;
* medical information;
* political information.

Use obviously synthetic values.

---

# 71. Data Validation

Use runtime validation for API inputs.

Every entity write should validate:

* required fields;
* enum values;
* numeric ranges;
* string lengths;
* references;
* timestamps;
* role permissions.

---

# 72. Numeric Validation

Important ranges:

```text
latitude:
-90 to 90

longitude:
-180 to 180

confidence:
0 to 1

impact_score:
0 to 100

signal_count:
>= 0

population:
>= 0

duration_days:
>= 0
```

---

# 73. String Validation

User-generated fields must have limits.

Examples:

```text
title:
1–200 chars

description:
1–5,000 chars

notes:
0–5,000 chars
```

Exact limits may be adjusted.

---

# 74. Search Indexes

Recommended Firestore indexes should support common queries.

Potential composite indexes:

```text
signals:
department_id + status + created_at
ward_id + status + created_at
category + status + created_at
problem_cluster_id + created_at

problem_clusters:
status + impact_score
ward_id + status + impact_score
department_id + status + impact_score
category + status + impact_score

assignments:
assigned_to + status + assigned_at
department_id + status + assigned_at
```

The exact index configuration should be generated from actual query patterns.

---

# 75. Pagination

Large collections must use pagination.

Never retrieve unlimited:

* signals;
* problem clusters;
* audit logs;
* notifications.

Preferred:

```text
limit
cursor / page token
```

---

# 76. Sorting

Default problem sorting:

```text
impact_score DESC
```

Secondary:

```text
updated_at DESC
```

Default signal sorting:

```text
created_at DESC
```

---

# 77. Query Rules

Queries should be permission-scoped.

Examples:

Citizen:

```text
signals where citizen_id == current_user
```

Department officer:

```text
problem_clusters where department_id == authorized_department
```

Administrator:

```text
cross-department access
```

Do not fetch broad data and filter only in the frontend.

---

# 78. Data Ownership

## Citizen-owned

* personal profile;
* own reports;
* own preferences.

## Department-owned

* department workflow;
* assignments;
* internal notes where allowed.

## System-owned

* impact configuration;
* AI operations;
* audit logs;
* system configuration.

---

# 79. State Consistency

When a problem changes state, associated data must remain consistent.

Example:

When entering:

```text
AWAITING_VERIFICATION
```

there should normally be:

* a resolution evidence submission;
* an associated resolution action.

When entering:

```text
CLOSED
```

appropriate authorization must exist.

---

# 80. Soft Reopening

A resolved problem may be reopened where:

* citizen feedback indicates continuing issue;
* new evidence contradicts resolution;
* authorized officer reopens the case.

Record:

```text
REOPENED
```

and preserve the previous resolution history.

---

# 81. Data Retention

The MVP should avoid unnecessary retention of personal data.

Retention periods may be configurable in future.

Audit records should remain available for governance and debugging subject to appropriate privacy policy.

---

# 82. Migration Strategy

Database schema changes must be backward-conscious.

When changing a field:

1. document the change;
2. support old records where practical;
3. migrate existing synthetic data;
4. avoid destructive changes during active development.

---

# 83. Data Access Layer

Application code should not scatter raw Firestore queries everywhere.

Recommended abstraction:

```text
Domain Service
    ↓
Repository
    ↓
Firestore
```

Example:

```text
SignalRepository
ProblemRepository
AssignmentRepository
ResolutionRepository
AuditRepository
```

---

# 84. Repository Responsibilities

Repositories handle:

* reads;
* writes;
* query composition;
* pagination;
* transactions;
* persistence errors.

Repositories should not contain AI reasoning.

---

# 85. Service Responsibilities

Services handle:

* business rules;
* authorization-aware workflows;
* state changes;
* orchestration;
* impact calculations;
* AI service invocation where needed.

---

# 86. Transaction Rules

Use transactions where multiple records must change atomically.

Example:

When attaching a signal to a problem cluster:

```text
update signal.problem_cluster_id
+
increment problem.signal_count
+
create membership record
```

These changes should be coordinated to prevent inconsistent state.

---

# 87. Optimistic Concurrency

Where multiple officers may edit the same problem, avoid silently overwriting updates.

Possible approach:

```text
updated_at
version
```

or transactional writes.

The exact strategy may be chosen during implementation.

---

# 88. Data Consistency for AI Results

AI results must reference the source entity.

Example:

```text
ai_operation.entity_id
```

must point to the signal/problem/evidence it analyzed.

This enables traceability.

---

# 89. Data Consistency for Impact Scores

When score components change:

1. recompute deterministic score;
2. store updated components;
3. update explanation if necessary;
4. record relevant action/history.

Do not let Gemini become the source of numeric truth.

---

# 90. Data Consistency for Verification

A new verification result should:

* reference the evidence;
* reference the problem;
* record model and prompt version;
* preserve previous verification records where appropriate.

Do not overwrite verification history without traceability.

---

# 91. Data Model Anti-Patterns

Do not:

* store entire signal lists in one problem document;
* store large images inside Firestore;
* expose private data through aggregate tables;
* store AI output without validation;
* use user-entered roles;
* duplicate the same source of truth in many entities without synchronization;
* use random IDs that are not stable across references;
* delete audit records during ordinary workflows.

---

# 92. Example Signal Record

```json id="7n5mw8"
{
  "id": "sig_1001",
  "source_type": "CITIZEN",
  "citizen_id": "usr_2001",
  "original_text": "There has been no water in our area for three days.",
  "normalized_text": "Water supply unavailable for three days.",
  "language": "en",
  "category": "water_supply",
  "subcategory": "outage",
  "severity": "HIGH",
  "duration_days": 3,
  "department_id": "dep_water",
  "ward_id": "ward_18",
  "status": "ATTACHED_TO_PROBLEM",
  "processing_status": "COMPLETED",
  "ai_confidence": 0.94,
  "problem_cluster_id": "prb_1042"
}
```

---

# 93. Example Problem Cluster Record

```json id="5j8kqf"
{
  "id": "prb_1042",
  "title": "Water Supply Disruption — Ward 18",
  "category": "water_supply",
  "department_id": "dep_water",
  "ward_id": "ward_18",
  "signal_count": 328,
  "estimated_population": 18400,
  "duration_days": 3,
  "severity_score": 24,
  "population_score": 18,
  "duration_score": 14,
  "concentration_score": 14,
  "critical_exposure_score": 9,
  "recurrence_score": 8,
  "evidence_score": 5,
  "impact_score": 92,
  "impact_level": "CRITICAL",
  "status": "IN_PROGRESS",
  "confidence": 0.91
}
```

---

# 94. Example Verification Record

```json id="h53bzi"
{
  "id": "ver_701",
  "problem_id": "prb_1042",
  "evidence_id": "evd_450",
  "status": "LIKELY_RESOLVED",
  "confidence": 0.91,
  "observations": [
    "Uploaded evidence appears consistent with repair."
  ],
  "limitations": [
    "Image evidence alone cannot establish long-term repair quality."
  ],
  "model": "configured-gemini-model",
  "prompt_version": "resolution_verification_v1",
  "review_required": true
}
```

---

# 95. Example Audit Record

```json id="5s9vgt"
{
  "id": "aud_9001",
  "actor_id": "usr_officer_1",
  "actor_role": "FIELD_OFFICER",
  "action": "STATUS_CHANGED",
  "entity_type": "PROBLEM",
  "entity_id": "prb_1042",
  "metadata": {
    "from": "ASSIGNED",
    "to": "IN_PROGRESS"
  }
}
```

---

# 96. Example Governance Insight Record

```json id="0h69kw"
{
  "id": "ai_302",
  "insight_type": "AI_BRIEF",
  "title": "Water disruptions require attention",
  "summary": "Water-related problems are currently the highest-impact unresolved issue.",
  "scope": {
    "ward": null,
    "department": "dep_water",
    "period": "last_7_days"
  },
  "supporting_entities": [
    "prb_1042",
    "prb_1088"
  ],
  "confidence": 0.89
}
```

---

# 97. Firestore Collection Summary

```text
/users
/citizen_profiles
/departments
/wards
/signals
/signal_media
/problem_clusters
/problem_cluster_members
/assignments
/actions
/resolution_evidence
/verification_results
/ai_operations
/ai_insights
/notifications
/audit_logs
/data_sources
/system_config
```

---

# 98. BigQuery Summary

```text
fact_signals
fact_problem_clusters
fact_assignments
fact_resolutions
fact_verifications
fact_daily_metrics
```

Views may be added for:

```text
ward_impact
department_performance
trend_analysis
sla_risk
```

---

# 99. Data Model Priority

During MVP implementation:

## P0

* users
* citizen profiles
* departments
* wards
* signals
* signal media
* problem clusters
* cluster membership
* assignments
* actions
* resolution evidence
* verification results
* AI operations
* audit logs

## P1

* notifications
* AI insights
* data sources
* system configuration

## P2

* historical impact versions
* advanced analytics models
* sophisticated facility entities
* intervention simulation datasets

---

# 100. Final Data Principle

The most important distinction in the CivicPulse data model is:

```text
Signal
    ≠
Problem Cluster
    ≠
Action
    ≠
Resolution
    ≠
Verification
```

A citizen report is an observation.

A problem cluster is an inferred/aggregated public problem.

An action is a government workflow event.

A resolution is a submitted claim of completion.

A verification result is an AI-assisted assessment of evidence.

These entities must remain distinct.

---

# 101. Source of Truth

Product requirements:

`01_PRD.md`

Product scope:

`02_PRODUCT_SCOPE.md`

Architecture:

`03_ARCHITECTURE.md`

Design:

`04_DESIGN.md`

AI behavior:

`05_AI_SPEC.md`

API contracts:

`07_API_SPEC.md`

Security:

`08_SECURITY.md`

Implementation phases:

`09_PHASES.md`

Demo/evaluation:

`10_DEMO_AND_EVALUATION.md`

Engineering rules:

`11_IMPLEMENTATION_RULES.md`

This document is the canonical data-model specification for CivicPulse AI.
