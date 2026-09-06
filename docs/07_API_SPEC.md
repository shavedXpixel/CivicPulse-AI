# CivicPulse AI

## API Specification

**Version:** 1.0
**Status:** Hackathon MVP
**Base Path:** `/api/v1`

---

# 1. Purpose

This document defines the API contracts for CivicPulse AI.

It specifies:

* endpoints;
* authentication;
* authorization;
* request schemas;
* response schemas;
* validation;
* errors;
* pagination;
* filtering;
* AI operations;
* governance queries;
* workflow transitions.

The frontend must use these APIs rather than directly accessing privileged backend functionality.

---

# 2. API Design Principles

The API must be:

* REST-oriented;
* predictable;
* versioned;
* typed;
* validated;
* authorization-aware;
* idempotent where appropriate;
* safe for AI-generated inputs;
* consistent in error handling.

---

# 3. API Base URL

All application APIs use:

```text
/api/v1
```

Example:

```text
POST /api/v1/signals
GET  /api/v1/problems
```

Do not create unversioned application endpoints such as:

```text
/api/signals
```

unless required by the selected framework internally.

---

# 4. Authentication

Authentication uses Firebase Authentication.

Client flow:

```text
User
 ↓
Firebase Authentication
 ↓
ID Token
 ↓
Authorization Header
 ↓
Backend
 ↓
Verify Token
 ↓
Load User Role
 ↓
Authorize Request
```

---

# 5. Authorization Header

Authenticated requests should send:

```http
Authorization: Bearer <firebase-id-token>
```

The backend must verify the token.

Never trust:

* a client-supplied user ID;
* a client-supplied role;
* a client-supplied department ID without authorization checks.

---

# 6. Roles

```text
CITIZEN
FIELD_OFFICER
DEPARTMENT_OFFICER
ADMIN
SYSTEM_ADMIN
```

---

# 7. Authorization Model

## Citizen

Can access:

* own profile;
* own signals;
* own notifications;
* public status of relevant problems.

## Field Officer

Can access:

* assigned problems;
* permitted supporting evidence;
* own assignments;
* resolution workflows.

## Department Officer

Can access:

* authorized department problems;
* department assignments;
* department analytics;
* resolution review.

## Admin

Can access:

* cross-department dashboards;
* problem intelligence;
* Governance AI;
* trends;
* authorized aggregate data.

## System Admin

Can additionally access:

* users;
* configuration;
* departments;
* wards;
* data sources;
* audit logs.

---

# 8. API Response Convention

Successful responses should use:

```json
{
  "data": {}
}
```

For list endpoints:

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "next_cursor": "..."
  }
}
```

---

# 9. Error Convention

Errors should use:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The submitted signal is missing required information.",
    "requestId": "req_12345"
  }
}
```

Do not expose:

* stack traces;
* SQL errors;
* internal provider errors;
* API secrets;
* internal prompts.

---

# 10. Standard HTTP Statuses

Use:

```text
200 OK
201 Created
202 Accepted
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
```

Use the most semantically appropriate status.

---

# 11. Request ID

Every backend request should have a request ID.

The API should:

1. accept an incoming request ID when safe;
2. otherwise generate one;
3. include it in error responses;
4. include it in structured logs.

Example:

```text
X-Request-ID: req_12345
```

---

# 12. Authentication APIs

Authentication itself is handled by Firebase.

The backend may provide:

```http
GET /api/v1/auth/me
```

---

# 13. GET `/auth/me`

## Purpose

Return the authenticated user's application profile and role.

## Authentication

Required.

## Response

```json
{
  "data": {
    "id": "usr_1001",
    "email": "demo@example.com",
    "display_name": "Demo User",
    "role": "ADMIN",
    "status": "ACTIVE"
  }
}
```

---

# 14. Signal APIs

---

## POST `/signals`

Create a citizen/public signal.

### Roles

* CITIZEN
* FIELD_OFFICER
* authorized imported-data service

### Request

```json
{
  "original_text": "There has been no water in our area for three days.",
  "category": null,
  "location": {
    "lat": 20.2961,
    "lng": 85.8245
  },
  "ward_id": "ward_18",
  "media_ids": []
}
```

### Server behavior

1. Authenticate.
2. Authorize.
3. Validate input.
4. Store original signal.
5. Set processing status to `PENDING`.
6. Trigger appropriate AI processing.
7. Return created signal.

### Response

```json
{
  "data": {
    "id": "sig_1001",
    "status": "ACTIVE",
    "processing_status": "PENDING",
    "created_at": "2026-09-06T12:00:00Z"
  }
}
```

---

# 15. GET `/signals/:id`

Return a signal.

### Authorization

* Citizen: own signal.
* Officer: signals associated with authorized problems.
* Department Officer: authorized department signals.
* Admin: authorized aggregate/detail access.

### Response

```json
{
  "data": {
    "id": "sig_1001",
    "original_text": "There has been no water in our area for three days.",
    "normalized_text": "Water supply unavailable for three days.",
    "language": "en",
    "category": "water_supply",
    "subcategory": "outage",
    "severity": "HIGH",
    "duration_days": 3,
    "ward_id": "ward_18",
    "department_id": "dep_water",
    "problem_cluster_id": "prb_1042",
    "processing_status": "COMPLETED",
    "ai_confidence": 0.94,
    "created_at": "2026-09-06T12:00:00Z"
  }
}
```

---

# 16. GET `/signals`

List signals.

### Authorized roles

* CITIZEN
* FIELD_OFFICER
* DEPARTMENT_OFFICER
* ADMIN
* SYSTEM_ADMIN

### Query Parameters

```text
limit
cursor
status
category
subcategory
severity
department_id
ward_id
problem_cluster_id
source_type
created_from
created_to
search
```

Example:

```text
GET /api/v1/signals?ward_id=ward_18&status=ACTIVE&limit=20
```

### Response

```json
{
  "data": [],
  "pagination": {
    "limit": 20,
    "next_cursor": "cursor_abc"
  }
}
```

---

# 17. POST `/signals/:id/analyze`

Trigger or re-run signal analysis.

### Roles

* authorized officers;
* system/admin workflows.

### Response

```json
{
  "data": {
    "signal_id": "sig_1001",
    "processing_status": "PROCESSING",
    "operation_id": "ai_1001"
  }
}
```

This endpoint must be protected against abuse and unnecessary repeated AI processing.

---

# 18. Signal Media APIs

---

## POST `/signals/:id/media`

Register or upload signal media.

The implementation may use a signed-upload flow.

### Request

```json
{
  "file_name": "street.jpg",
  "mime_type": "image/jpeg",
  "file_size_bytes": 1420000
}
```

### Response

```json
{
  "data": {
    "media_id": "med_1001",
    "upload_url": "SIGNED_UPLOAD_URL",
    "expires_at": "2026-09-06T12:15:00Z"
  }
}
```

The backend must validate:

* file type;
* size;
* authorization;
* ownership.

---

# 19. GET `/signals/:id/media`

Return authorized signal media metadata.

Do not expose unrestricted storage paths.

---

# 20. Problem APIs

---

## GET `/problems`

List problem clusters.

### Query Parameters

```text
limit
cursor
status
impact_level
min_impact
max_impact
category
department_id
ward_id
sort
created_from
created_to
search
```

### Default sorting

```text
impact_score DESC
updated_at DESC
```

---

# 21. GET `/problems/:id`

Return a problem cluster.

### Response

```json
{
  "data": {
    "id": "prb_1042",
    "title": "Water Supply Disruption — Ward 18",
    "description": "Concentrated water-supply disruption reported across Ward 18.",
    "category": "water_supply",
    "department_id": "dep_water",
    "ward_id": "ward_18",
    "status": "IN_PROGRESS",
    "signal_count": 328,
    "estimated_population": 18400,
    "duration_days": 3,
    "impact_score": 92,
    "impact_level": "CRITICAL",
    "confidence": 0.91
  }
}
```

---

# 22. GET `/problems/:id/details`

Return extended problem information.

May include:

* summary;
* impact factors;
* signals;
* evidence;
* assignments;
* timeline;
* verification;
* AI insights.

Large relationships should be paginated.

---

# 23. GET `/problems/:id/signals`

Return signals belonging to a problem.

### Query Parameters

```text
limit
cursor
relationship
created_from
created_to
```

---

# 24. GET `/problems/:id/evidence`

Return authorized evidence associated with the problem.

Evidence should be grouped conceptually into:

```text
CITIZEN
FIELD
RESOLUTION
```

---

# 25. POST `/problems`

Create a problem cluster.

Normally this is triggered by system intelligence.

### Roles

* authorized backend/system workflow;
* administrators for controlled manual creation.

### Request

```json
{
  "title": "Water Supply Disruption — Ward 18",
  "category": "water_supply",
  "ward_id": "ward_18",
  "department_id": "dep_water",
  "signal_ids": [
    "sig_1001",
    "sig_1002"
  ]
}
```

The backend must validate all signal references.

---

# 26. POST `/problems/:id/recalculate-impact`

Recalculate deterministic impact score.

### Roles

* authorized administrative workflow.

### Response

```json
{
  "data": {
    "problem_id": "prb_1042",
    "impact_score": 92,
    "impact_level": "CRITICAL"
  }
}
```

No LLM should determine the final numeric score.

---

# 27. Problem Lifecycle APIs

The preferred pattern is:

```http
POST /api/v1/problems/:id/actions
```

rather than exposing arbitrary direct status mutation.

---

# 28. POST `/problems/:id/actions`

Perform an authorized workflow action.

### Request

```json
{
  "action": "STARTED_WORK",
  "note": "Field team dispatched."
}
```

### Supported actions

```text
TRIAGED
ASSIGN
REASSIGN
ACCEPT
STARTED_WORK
ESCALATE
REQUEST_INFO
RESOLUTION_SUBMITTED
VERIFY
RESOLVE
REOPEN
CLOSE
```

The backend must validate:

* role;
* current problem state;
* target action;
* required fields;
* assignment;
* authorization.

---

# 29. Action Response

```json
{
  "data": {
    "problem_id": "prb_1042",
    "previous_status": "ASSIGNED",
    "new_status": "IN_PROGRESS",
    "action_id": "act_5001"
  }
}
```

---

# 30. GET `/problems/:id/timeline`

Return problem history.

### Response

```json
{
  "data": [
    {
      "id": "act_1",
      "action": "CREATED",
      "actor_role": "SYSTEM",
      "created_at": "2026-09-01T10:00:00Z"
    },
    {
      "id": "act_2",
      "action": "ASSIGNED",
      "actor_role": "DEPARTMENT_OFFICER",
      "created_at": "2026-09-01T11:00:00Z"
    }
  ]
}
```

---

# 31. Assignment APIs

---

## POST `/problems/:id/assign`

Assign a problem.

### Roles

* DEPARTMENT_OFFICER
* ADMIN
* SYSTEM_ADMIN

### Request

```json
{
  "department_id": "dep_water",
  "assigned_to": "usr_officer_1",
  "priority": "CRITICAL",
  "due_at": "2026-09-08T12:00:00Z"
}
```

---

# 32. Assignment Validation

Backend must confirm:

* department exists;
* officer exists;
* officer is active;
* officer can receive this assignment;
* caller has permission;
* problem state allows assignment.

---

# 33. POST `/problems/:id/reassign`

Reassign to another officer or department.

### Request

```json
{
  "department_id": "dep_water",
  "assigned_to": "usr_officer_2",
  "reason": "Ward coverage changed."
}
```

Create an audit record.

---

# 34. GET `/assignments`

List assignments.

### Query Parameters

```text
limit
cursor
assigned_to
department_id
status
priority
due_before
```

---

# 35. Resolution APIs

---

## POST `/problems/:id/resolution-evidence`

Submit evidence that a problem has been addressed.

### Roles

* FIELD_OFFICER
* DEPARTMENT_OFFICER
* authorized staff

### Request

```json
{
  "storage_path": "resolution/prb_1042/evidence_1.jpg",
  "media_type": "image/jpeg",
  "description": "Road surface repaired.",
  "observed_at": "2026-09-06T09:30:00Z"
}
```

### Response

```json
{
  "data": {
    "evidence_id": "evd_450",
    "status": "SUBMITTED"
  }
}
```

---

# 36. POST `/resolution-evidence/:id/verify`

Request AI verification.

### Roles

* authorized officer;
* automated workflow.

### Response

```json
{
  "data": {
    "verification_id": "ver_701",
    "status": "PROCESSING"
  }
}
```

The endpoint should return quickly when processing may take time.

---

# 37. GET `/resolution-evidence/:id/verification`

Return latest or selected verification result.

### Response

```json
{
  "data": {
    "verification_id": "ver_701",
    "status": "LIKELY_RESOLVED",
    "confidence": 0.91,
    "observations": [
      "Uploaded evidence appears consistent with repair."
    ],
    "limitations": [
      "Image evidence cannot establish long-term repair quality."
    ],
    "review_required": true
  }
}
```

---

# 38. Citizen Report APIs

---

## GET `/me/signals`

Return current citizen's own signals.

Equivalent to a protected query of:

```text
citizen_id = authenticated_user
```

The client must never supply arbitrary citizen IDs for this endpoint.

---

# 39. GET `/me/signals/:id`

Return one of the current citizen's own signals.

---

# 40. GET `/me/notifications`

Return authenticated user's notifications.

Query:

```text
limit
cursor
read
```

---

# 41. POST `/me/notifications/:id/read`

Mark notification as read.

---

# 42. Dashboard APIs

The dashboard should use purpose-built aggregate APIs rather than fetching thousands of raw records to calculate metrics in the browser.

---

# 43. GET `/dashboard/overview`

### Roles

* ADMIN
* SYSTEM_ADMIN
* authorized Department Officer for scoped version

### Query Parameters

```text
ward_id
department_id
category
date_from
date_to
```

### Response

```json
{
  "data": {
    "signals": {
      "total": 12842,
      "change_percent": 8.2
    },
    "active_problems": {
      "total": 1284,
      "change_percent": -3.1
    },
    "high_impact": {
      "total": 426
    },
    "resolution": {
      "rate_percent": 82
    },
    "response": {
      "median_hours": 31
    }
  }
}
```

All percentages must be calculated by the backend.

---

# 44. GET `/dashboard/priority-problems`

Return highest-impact problems.

### Query Parameters

```text
limit
ward_id
department_id
category
status
```

### Response

```json
{
  "data": [
    {
      "id": "prb_1042",
      "title": "Water Supply Disruption — Ward 18",
      "impact_score": 92,
      "impact_level": "CRITICAL",
      "signal_count": 328,
      "status": "IN_PROGRESS"
    }
  ]
}
```

---

# 45. GET `/dashboard/map`

Return geospatial problem-cluster data.

### Query Parameters

```text
bounds
zoom
ward_id
category
status
min_impact
```

The backend should return only data required by the map viewport.

---

# 46. GET `/dashboard/departments`

Return department-level metrics.

### Response

```json
{
  "data": [
    {
      "department_id": "dep_water",
      "department_name": "Water Department",
      "active_problems": 82,
      "high_impact": 17,
      "median_resolution_hours": 29,
      "sla_risk": 8
    }
  ]
}
```

---

# 47. GET `/dashboard/trends`

Return calculated trends.

### Query Parameters

```text
metric
category
ward_id
department_id
date_from
date_to
interval
```

Example:

```text
GET /api/v1/dashboard/trends?metric=signals&category=water_supply&interval=day
```

### Response

```json
{
  "data": {
    "metric": "signals",
    "interval": "day",
    "series": [
      {
        "date": "2026-09-01",
        "value": 42
      },
      {
        "date": "2026-09-02",
        "value": 56
      }
    ],
    "change_percent": 31.25
  }
}
```

---

# 48. SLA Risk API

## GET `/dashboard/sla-risk`

Return problems approaching or exceeding configured SLA thresholds.

### Query Parameters

```text
department_id
ward_id
status
limit
cursor
```

### Response

```json
{
  "data": [
    {
      "problem_id": "prb_1042",
      "department_id": "dep_water",
      "status": "IN_PROGRESS",
      "due_at": "2026-09-06T18:00:00Z",
      "risk_level": "HIGH",
      "hours_remaining": 2.5
    }
  ]
}
```

---

# 49. AI APIs

AI endpoints must be protected, rate-limited, and authorized.

---

# 50. POST `/ai/signals/:id/analyze`

Analyze a signal.

### Response

```json
{
  "data": {
    "operation_id": "ai_1001",
    "status": "PROCESSING"
  }
}
```

---

# 51. GET `/ai/operations/:id`

Return AI operation status.

### Response

```json
{
  "data": {
    "id": "ai_1001",
    "operation_type": "SIGNAL_UNDERSTANDING",
    "status": "SUCCESS",
    "confidence": 0.94,
    "created_at": "2026-09-06T12:00:00Z"
  }
}
```

---

# 52. POST `/ai/problems/:id/summarize`

Generate or regenerate a problem summary.

### Roles

* authorized officers;
* admin.

### Response

```json
{
  "data": {
    "operation_id": "ai_2001",
    "status": "PROCESSING"
  }
}
```

Summary generation should not alter core problem fields without validation.

---

# 53. Governance AI API

## POST `/governance/query`

This is the primary Governance AI endpoint.

### Roles

* ADMIN
* SYSTEM_ADMIN
* authorized DEPARTMENT_OFFICER for scoped queries

### Request

```json
{
  "question": "Which wards have the highest unresolved impact?",
  "scope": {
    "ward_id": null,
    "department_id": null,
    "date_from": "2026-08-30T00:00:00Z",
    "date_to": "2026-09-06T23:59:59Z"
  }
}
```

---

# 54. Governance Query Flow

Backend must:

```text id="mp2fwd"
Receive question
 ↓
Authenticate
 ↓
Authorize scope
 ↓
Classify intent
 ↓
Select allowed analytical tool
 ↓
Retrieve data
 ↓
Calculate derived metrics
 ↓
Construct grounded context
 ↓
Gemini reasoning
 ↓
Validate response
 ↓
Return answer + evidence
```

The model must not receive unauthorized data.

---

# 55. Governance Query Response

```json
{
  "data": {
    "answer": "Ward 18 has the highest unresolved public impact...",
    "facts": [
      {
        "statement": "Ward 18 has 14 active problem clusters.",
        "source_type": "DATABASE_METRIC"
      }
    ],
    "metrics": [
      {
        "label": "Unresolved impact",
        "value": 842,
        "unit": "score"
      }
    ],
    "supporting_problems": [
      "prb_1042",
      "prb_1088"
    ],
    "recommendations": [
      "Review the water-supply cluster in Ward 18."
    ],
    "confidence": "HIGH"
  }
}
```

---

# 56. Governance Tool APIs

The backend should expose controlled analytical functions.

Examples:

```text
getTopProblems
getWardImpact
getDepartmentBacklog
getTrend
getProblemDetails
getSlaRisk
getProblemsNearFacility
getDepartmentPerformance
```

Gemini may select from these tools.

The model must not receive unrestricted database access.

---

# 57. Governance AI Scope

The request scope must be server-validated.

Example:

A Department Officer belonging to the Water Department cannot use a client request to obtain unrelated private department data.

---

# 58. Governance AI Rate Limits

Apply reasonable rate limits.

Example starting point:

```text
10 governance queries / minute / user
```

Adjust based on actual product needs and provider limits.

---

# 59. AI Output Validation

Structured AI responses must be validated before returning them.

Validate:

* enums;
* numbers;
* confidence;
* arrays;
* string lengths;
* references.

---

# 60. Map APIs

No separate map-specific business logic should be placed in frontend code.

The backend provides geospatially authorized problem data.

Example:

```http
GET /api/v1/dashboard/map
```

The frontend renders the result.

---

# 61. Department APIs

---

## GET `/departments`

List active departments.

### Roles

* authenticated users as appropriate.

---

## GET `/departments/:id`

Return department details.

---

## GET `/departments/:id/problems`

Return department-scoped problems.

---

# 62. Ward APIs

---

## GET `/wards`

List configured wards.

### Query

```text
district_id
active
```

---

## GET `/wards/:id`

Return ward details.

---

## GET `/wards/:id/problems`

Return authorized problem clusters associated with the ward.

---

# 63. Admin APIs

---

## GET `/admin/users`

System administrator only.

Query:

```text
limit
cursor
role
status
search
```

---

## PATCH `/admin/users/:id`

Modify allowed user properties.

Role changes must be audited.

---

# 64. Department Configuration

## PATCH `/admin/departments/:id`

System administrator only.

Possible fields:

```text
name
description
active
default_sla_hours
```

---

# 65. Ward Configuration

## PATCH `/admin/wards/:id`

System administrator only.

---

# 66. System Configuration

## GET `/admin/config`

System administrator only.

---

## PATCH `/admin/config`

System administrator only.

Possible configuration:

```text
impact weights
impact thresholds
similarity thresholds
supported languages
SLA defaults
feature flags
```

All configuration changes must be audited.

---

# 67. Audit APIs

## GET `/admin/audit-logs`

System administrator only.

Query:

```text
limit
cursor
actor_id
actor_role
action
entity_type
entity_id
created_from
created_to
```

Audit logs must be read-only through the API.

---

# 68. Notification APIs

## GET `/notifications`

Authenticated user.

---

## POST `/notifications/:id/read`

Authenticated owner.

---

# 69. Search API

The MVP may provide a unified search endpoint.

## GET `/search`

Query:

```text
q
type
limit
```

Supported types:

```text
problems
signals
departments
wards
```

Semantic search should not be treated as the same operation as exact ID search.

---

# 70. Pagination

All large list endpoints should support cursor-based pagination.

Preferred:

```text
limit
cursor
```

Default:

```text
limit = 20
```

Maximum:

```text
limit = 100
```

The server must enforce maximum page sizes.

---

# 71. Filtering

Filtering must happen server-side.

Do not retrieve thousands of records and filter only in React.

---

# 72. Sorting

Allowed sort fields must be whitelisted.

Example:

```text
sort=impact_score_desc
sort=updated_at_desc
sort=created_at_desc
```

Do not directly concatenate arbitrary query parameters into database queries.

---

# 73. Search Validation

Search strings must:

* have maximum length;
* be sanitized;
* be safely parameterized;
* not become executable queries.

---

# 74. Idempotency

Operations that may be retried should support idempotency where appropriate.

Examples:

* resolution submission;
* assignment;
* AI job creation;
* notification creation.

Potential header:

```http
Idempotency-Key: <unique-key>
```

---

# 75. Concurrency

When updating workflow state:

1. verify current state;
2. verify version/updated timestamp where appropriate;
3. apply authorized transition;
4. write audit event;
5. return resulting state.

Avoid lost updates.

---

# 76. API Validation

Use runtime schemas such as Zod or an equivalent validation library.

Validate:

* request bodies;
* query parameters;
* path parameters;
* AI outputs;
* database-bound objects.

---

# 77. Request Size Limits

Apply reasonable maximum sizes.

Especially for:

* text;
* JSON bodies;
* uploads;
* Governance AI questions.

Example starting values:

```text
signal description:
5,000 characters

Governance question:
2,000 characters

image:
10 MB
```

These are starting limits and may be adjusted.

---

# 78. File Upload Security

The API must validate:

* MIME type;
* file size;
* authenticated owner;
* storage destination;
* allowed file categories.

Never trust client-provided metadata without server validation.

---

# 79. API Security

Never expose:

* Firebase Admin credentials;
* Gemini credentials;
* BigQuery service credentials;
* private storage credentials.

All privileged operations occur server-side.

---

# 80. Direct Database Access

The frontend must not perform privileged administrative writes directly to Firestore.

Use backend APIs for:

* assignments;
* state changes;
* impact updates;
* configuration;
* verification;
* audit-sensitive operations.

Client-side Firestore access may be used only where explicitly authorized and modeled securely.

---

# 81. API and AI Separation

The following is prohibited:

```text
React Component
     ↓
Gemini API
```

Preferred:

```text
React
 ↓
Backend API
 ↓
AI Service
 ↓
Gemini
```

This keeps credentials, validation, authorization, and prompt logic server-side.

---

# 82. AI Query Safety

Never allow:

```text
POST /governance/query
{
  "sql": "SELECT * FROM ..."
}
```

The Governance AI API accepts natural-language intent, not unrestricted SQL.

The backend chooses safe query functions.

---

# 83. AI Tool Safety

Allowed tools should be explicitly registered.

Example:

```text
TOOL:
getTopProblems

INPUT:
{
  "ward_id": "ward_18",
  "department_id": null,
  "limit": 5
}
```

The tool validates its own parameters.

---

# 84. API Caching

Cache safe aggregate endpoints where useful.

Potential:

```text
/dashboard/overview
/departments
/wards
```

Be careful with:

* user-specific information;
* permission-sensitive data;
* rapidly changing workflow states.

---

# 85. API Performance

Use:

* pagination;
* indexed queries;
* aggregation endpoints;
* batching where appropriate;
* caching;
* asynchronous AI processing.

Do not make the frontend perform large relational-style joins.

---

# 86. API Observability

Every request should capture:

```text
request_id
route
method
status
duration
actor_role
error_code
```

AI requests should additionally record:

```text
ai_operation_id
model
operation_type
latency
status
```

Avoid logging sensitive payloads unnecessarily.

---

# 87. API Error Codes

Recommended application error codes:

```text
INVALID_REQUEST
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INVALID_STATE_TRANSITION
ASSIGNMENT_NOT_ALLOWED
FILE_TOO_LARGE
FILE_TYPE_NOT_ALLOWED
AI_UNAVAILABLE
AI_VALIDATION_FAILED
AI_RATE_LIMITED
INSUFFICIENT_DATA
RATE_LIMITED
INTERNAL_ERROR
```

---

# 88. `202 Accepted` Usage

Use `202 Accepted` when processing is asynchronous.

Examples:

```text
AI signal analysis
Image analysis
Resolution verification
Large data imports
```

Example:

```json
{
  "data": {
    "operation_id": "ai_1001",
    "status": "PROCESSING"
  }
}
```

---

# 89. API Contract for AI Processing

AI-processing endpoints should return operation IDs.

This allows:

```text id="j4b7j6"
POST request
 ↓
operation_id
 ↓
poll/get operation
 ↓
completed result
```

Future implementations may replace polling with realtime events without changing the domain model.

---

# 90. API Contract for Problem Creation

Problem creation should not blindly trust client-supplied impact values.

Client may provide:

```text
title
category
ward
signal_ids
```

Server calculates:

```text
signal_count
impact_score
impact_level
```

---

# 91. API Contract for Impact

The client may request recalculation.

The client must not submit:

```json
{
  "impact_score": 100
}
```

as the authoritative value.

The backend owns impact calculation.

---

# 92. API Contract for Status

The client must not directly submit arbitrary:

```json
{
  "status": "CLOSED"
}
```

Instead:

```json
{
  "action": "CLOSE"
}
```

The backend validates whether the transition is legal.

---

# 93. API Contract for Evidence

The system must distinguish:

```text
evidence submitted
```

from:

```text
AI verification
```

Uploading evidence does not automatically mark the problem resolved.

---

# 94. API Contract for Governance Answers

The Governance API must return both:

```text
answer
```

and:

```text
supporting evidence / metrics
```

A plain text answer without grounding metadata should not be considered a complete Governance AI response.

---

# 95. API Contract for Recommendations

Recommendations should be structured:

```json
{
  "type": "RECOMMENDATION",
  "text": "Review Ward 18 water-supply status.",
  "basis": [
    "High impact",
    "Long duration",
    "High concentration"
  ]
}
```

---

# 96. API Contract for Uncertainty

When data is insufficient:

```json
{
  "data": {
    "answer": "There is not enough information in the selected dataset to determine this.",
    "confidence": "LOW",
    "supporting_problems": [],
    "recommendations": []
  }
}
```

Do not return a fabricated confident answer.

---

# 97. API Contract for AI Confidence

Confidence values should be normalized:

```text
0.0–1.0
```

Frontend may translate them to:

```text
High
Moderate
Low
```

---

# 98. API Contract for Multilingual Data

Signal APIs should preserve:

```text
original_text
language
normalized_text
```

Do not replace the original submission with a translation.

---

# 99. API Contract for Localization

User-facing API messages may be localized.

Internal error codes must remain stable.

Example:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Localized user-facing message."
  }
}
```

---

# 100. API Contract for Public vs Private Data

Aggregate dashboard endpoints should not expose unnecessary:

* citizen names;
* email addresses;
* phone numbers;
* personal identifiers.

Only return fields required for the requested task.

---

# 101. API Testing Requirements

Every endpoint should have tests covering at least:

### Authentication

* missing token;
* invalid token.

### Authorization

* permitted role;
* forbidden role.

### Validation

* valid request;
* missing required fields;
* invalid enums;
* invalid IDs.

### Business rules

* valid state transition;
* invalid state transition.

### Error handling

* not found;
* conflict;
* internal error behavior.

---

# 102. AI API Testing

Test:

* successful AI response;
* malformed AI response;
* timeout;
* rate limit;
* insufficient data;
* unauthorized data access;
* prompt injection;
* low-confidence result.

---

# 103. API Mocking

For development/tests, AI provider calls may be mocked.

However:

* mocks must be clearly identified;
* mock responses must follow real schemas;
* production/demo mode must not falsely claim that mocked results came from live Gemini.

---

# 104. Demo API Seed Scenario

The following sequence must work:

```text id="i01y6d"
POST /signals
      ↓
AI processing
      ↓
GET /signals/:id
      ↓
Problem cluster assigned
      ↓
GET /problems/:id
      ↓
GET /dashboard/priority-problems
      ↓
POST /problems/:id/assign
      ↓
POST /problems/:id/resolution-evidence
      ↓
POST /resolution-evidence/:id/verify
      ↓
GET /resolution-evidence/:id/verification
      ↓
POST /governance/query
```

This represents the core demonstration path.

---

# 105. API Versioning Rules

Breaking API changes require a version change.

Example:

```text
/api/v1
/api/v2
```

Do not silently change existing field semantics.

---

# 106. Backward Compatibility

Non-breaking additions may include:

* optional response fields;
* new endpoints;
* additional optional request fields.

Breaking changes require documentation and migration planning.

---

# 107. API Documentation

The repository should contain API documentation generated or maintained from the contract.

Possible future implementation:

* OpenAPI;
* generated TypeScript types;
* API client generation.

The chosen approach should keep frontend/backend types synchronized.

---

# 108. Recommended Shared Types

Where practical, define shared schemas/types for:

```text
Problem
Signal
Assignment
ResolutionEvidence
VerificationResult
DashboardMetric
GovernanceAnswer
APIError
Pagination
```

Do not duplicate incompatible types between frontend and backend.

---

# 109. API Anti-Patterns

Do not:

* expose unrestricted database queries;
* expose raw Firestore documents as public API contracts;
* let clients calculate authoritative impact scores;
* let clients choose arbitrary status transitions;
* call Gemini directly from frontend;
* return private data unnecessarily;
* create separate incompatible schemas for the same entity;
* silently change API behavior;
* swallow errors and return fake success.

---

# 110. Definition of Done

An API feature is complete when:

* endpoint exists;
* authentication is defined;
* authorization is enforced;
* request validation exists;
* response schema is defined;
* errors are handled;
* business rules are enforced;
* audit requirements are implemented;
* tests exist;
* API behavior is documented;
* frontend can consume the endpoint using the defined contract.

---

# 111. Source of Truth

Product requirements:

`01_PRD.md`

Product scope:

`02_PRODUCT_SCOPE.md`

Architecture:

`03_ARCHITECTURE.md`

Design:

`04_DESIGN.md`

AI specification:

`05_AI_SPEC.md`

Data model:

`06_DATA_MODEL.md`

Security:

`08_SECURITY.md`

Implementation phases:

`09_PHASES.md`

Demo and evaluation:

`10_DEMO_AND_EVALUATION.md`

Engineering rules:

`11_IMPLEMENTATION_RULES.md`

This document defines the API contract for CivicPulse AI.

When implementation details conflict with this contract, preserve the documented API semantics unless a deliberate versioned change is made.
