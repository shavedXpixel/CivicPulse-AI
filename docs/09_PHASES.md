# CivicPulse AI

## Implementation Phases & Acceptance Criteria

**Version:** 1.0
**Status:** Hackathon MVP
**Product:** CivicPulse AI

---

# 1. Purpose

This document defines the implementation sequence for CivicPulse AI.

The project must be implemented incrementally.

The implementation agent must:

1. complete the current phase;
2. verify the phase;
3. fix issues;
4. document the result;
5. stop.

The agent must **not automatically begin the next phase**.

---

# 2. Phase Execution Rule

For every phase:

```text
READ
 ↓
PLAN
 ↓
IMPLEMENT
 ↓
TEST
 ↓
BROWSER VERIFY
 ↓
FIX
 ↓
DOCUMENT
 ↓
STOP
```

Do not skip verification.

---

# 3. Priority Order

Implementation priority:

```text
P0
 ↓
P1
 ↓
P2
 ↓
Polish
```

Never allow optional features to delay core functionality.

---

# 4. Phase Overview

```text
Phase 0
Foundation

Phase 1
Design System + Application Shell

Phase 2
Citizen Signal Intake

Phase 3
AI Intelligence Pipeline

Phase 4
Problem Clustering + Impact Intelligence

Phase 5
Government Operations

Phase 6
Resolution + AI Verification

Phase 7
Governance AI

Phase 8
Intervention Simulator

Phase 9
Security + Performance + Testing

Phase 10
Demo + Deployment + Final Polish
```

---

# 5. PHASE 0 — FOUNDATION

## Objective

Create a stable technical foundation before implementing product features.

---

## Scope

Set up:

* repository;
* frontend;
* backend;
* TypeScript;
* linting;
* formatting;
* testing;
* environment management;
* Firebase;
* backend configuration;
* shared types;
* base error handling;
* logging;
* API versioning.

---

## Expected Structure

```text id="l06j5r"
frontend/
backend/
shared/
docs/
data/
scripts/
tests/
```

The exact structure may follow the chosen framework while preserving architectural boundaries.

---

## Deliverables

### Frontend

* Next.js application;
* TypeScript strict mode;
* base layout;
* global styles;
* route structure.

### Backend

* API server;
* `/api/v1` routing;
* health endpoint;
* error middleware;
* configuration loader.

### Shared

* common types;
* validation schemas;
* API response types.

### Tooling

* lint;
* format;
* test;
* build;
* development scripts.

---

## Required Endpoint

```http id="6a3j14"
GET /api/v1/health
```

Response:

```json id="i1qxn0"
{
  "data": {
    "status": "ok"
  }
}
```

---

## Tests

At minimum:

* application starts;
* backend starts;
* health endpoint works;
* TypeScript passes;
* lint passes;
* build passes.

---

## Acceptance Criteria

Phase 0 is complete when:

```text id="8w86q5"
[ ] Frontend runs
[ ] Backend runs
[ ] Health endpoint works
[ ] Environment config exists
[ ] Shared types work
[ ] Lint passes
[ ] Tests pass
[ ] Production build passes
[ ] No secrets committed
```

---

## Must Not Build

* AI features;
* citizen reporting;
* dashboard analytics;
* advanced database workflows.

---

# 6. PHASE 1 — DESIGN SYSTEM + APPLICATION SHELL

## Objective

Build the visual foundation and navigation structure.

---

## Scope

Implement:

* design tokens;
* typography;
* colors;
* spacing;
* buttons;
* forms;
* cards;
* tables;
* badges;
* navigation;
* responsive layouts;
* application shells;
* route placeholders.

---

## Required Screens

```text id="lbfqag"
/login

/citizen
/citizen/report
/citizen/issues

/dashboard
/dashboard/problems
/dashboard/map
/dashboard/departments
/dashboard/trends
/dashboard/ai

/officer
/admin
```

Screens may contain placeholders where functionality belongs to later phases.

---

## Components

Build reusable primitives:

```text id="c1l80j"
Button
Input
Textarea
Select
Badge
Card
Dialog
Tabs
Toast
Tooltip
DataTable
Skeleton
EmptyState
ErrorState
```

Domain components:

```text id="wmc5gq"
KPIStat
ProblemCard
ImpactScore
AIBrief
EvidenceCard
Timeline
```

---

## Responsive Requirements

Verify:

* desktop;
* tablet;
* mobile.

---

## Design Requirements

Follow `04_DESIGN.md`.

Do not introduce:

* generic AI gradients;
* glowing cards;
* excessive glass;
* decorative AI avatars.

---

## Acceptance Criteria

```text id="c5kwxu"
[ ] Design tokens implemented
[ ] Responsive shell implemented
[ ] Citizen shell implemented
[ ] Government shell implemented
[ ] Officer shell implemented
[ ] Admin shell implemented
[ ] Navigation works
[ ] Routes exist
[ ] Loading states exist
[ ] Empty states exist
[ ] Error states exist
[ ] Browser verification completed
```

---

# 7. PHASE 2 — CITIZEN SIGNAL INTAKE

## Objective

Allow citizens to submit public problems.

---

## Scope

Implement:

* authentication;
* citizen profile;
* report form;
* image upload;
* location;
* signal creation;
* signal detail;
* citizen report history.

---

## Database

Implement:

```text id="y72h2f"
users
citizen_profiles
signals
signal_media
```

---

## APIs

Implement:

```text id="m5f2ye"
GET  /api/v1/auth/me

POST /api/v1/signals
GET  /api/v1/signals/:id
GET  /api/v1/signals
GET  /api/v1/me/signals

POST /api/v1/signals/:id/media
GET  /api/v1/signals/:id/media
```

---

## Citizen Workflow

```text id="z7omx5"
Report a Problem
      ↓
Enter description
      ↓
Add image
      ↓
Provide location
      ↓
Submit
      ↓
Signal created
      ↓
Confirmation
```

---

## AI

Do not require full AI processing yet.

The application may create:

```text id="onhl1k"
processing_status = PENDING
```

---

## Acceptance Criteria

```text id="qbxu0g"
[ ] Citizen can authenticate
[ ] Citizen can submit a signal
[ ] Image upload works
[ ] Location is stored
[ ] Signal is persisted
[ ] Citizen sees confirmation
[ ] Citizen can view own reports
[ ] Unauthorized users cannot access private reports
[ ] Validation works
[ ] Browser flow works
```

---

# 8. PHASE 3 — AI INTELLIGENCE PIPELINE

## Objective

Introduce Gemini-powered signal understanding.

---

## Scope

Implement:

* language detection;
* structured extraction;
* classification;
* severity interpretation;
* department recommendation;
* image understanding where practical;
* AI operation metadata;
* schema validation;
* failure handling.

---

## Database

Add:

```text id="2kcrb4"
ai_operations
```

Extend:

```text id="vxn1kf"
signals
```

with AI-derived fields.

---

## AI Capabilities

Implement in this order:

```text id="wl43ap"
1. Language Detection
2. Signal Understanding
3. Classification
4. Severity
5. Department Recommendation
6. Image Analysis
```

---

## Processing Flow

```text id="fddzfr"
New Signal
 ↓
AI Processing
 ↓
Language
 ↓
Extraction
 ↓
Classification
 ↓
Severity
 ↓
Department
 ↓
Validation
 ↓
Persist
```

---

## Required AI Rules

All structured model responses must:

* use schemas;
* validate;
* handle malformed responses;
* record model metadata;
* record prompt version.

---

## Required UI

Citizen should see:

```text id="54ez3v"
We understood your report:

Water supply interruption
Ward 18
High severity

Confidence:
High
```

The citizen should be able to correct obvious misunderstandings before future workflows rely on them where appropriate.

---

## Acceptance Criteria

```text id="rbwz3j"
[ ] Gemini integration works
[ ] AI output validated
[ ] Language detected
[ ] Category extracted
[ ] Severity extracted
[ ] Department recommended
[ ] AI operation recorded
[ ] AI failure handled
[ ] Low-confidence result handled
[ ] Original input preserved
[ ] Browser verification completed
```

---

# 9. PHASE 4 — PROBLEM CLUSTERING + IMPACT INTELLIGENCE

## Objective

Transform individual signals into higher-level public problems.

This is one of the most important product phases.

---

## Scope

Implement:

* semantic similarity;
* duplicate detection;
* relationship scoring;
* problem cluster creation;
* cluster membership;
* deterministic impact score;
* impact explanation;
* priority ranking.

---

## Database

Add:

```text id="tsg3h7"
problem_clusters
problem_cluster_members
```

---

## APIs

Implement:

```text id="dyf6qt"
GET  /api/v1/problems
GET  /api/v1/problems/:id
GET  /api/v1/problems/:id/signals
GET  /api/v1/problems/:id/details

POST /api/v1/problems/:id/recalculate-impact
```

---

## Relationship Logic

Use:

```text id="sfkoe9"
Semantic Similarity
+
Geographic Proximity
+
Temporal Proximity
+
Category Match
+
Optional Visual Similarity
```

---

## Relationship Thresholds

Initial configuration:

```text id="n4s2tr"
>= 0.85
Strong Duplicate

0.70–0.84
Related

< 0.70
Probably Unrelated
```

These must be configurable.

---

## Problem Creation

Example:

```text id="9ekhmx"
327 related reports
        ↓
Problem Cluster
        ↓
Water Supply Disruption — Ward 18
```

---

## Impact Formula

Use deterministic logic:

```text id="4x7a3g"
Severity                         25%
Population Affected             20%
Duration                        15%
Complaint Concentration         15%
Critical Facility Exposure      10%
Recurrence                      10%
Evidence Confidence              5%
```

---

## Impact Output

```text id="9yl4mk"
Impact:
92 / 100

Level:
CRITICAL
```

---

## Explainability

Show:

```text id="c1z28m"
Why this is high impact:

• 328 related reports
• 3-day duration
• strong concentration
• estimated population exposure
• nearby school
```

---

## Acceptance Criteria

```text id="gyn1z5"
[ ] Related reports detected
[ ] Duplicate relationships stored
[ ] Originals preserved
[ ] Problem clusters created
[ ] Impact score calculated deterministically
[ ] Component scores stored
[ ] Priority ranking works
[ ] Explainability shown
[ ] Thresholds configurable
[ ] Browser flow verified
```

---

# 10. PHASE 5 — GOVERNMENT OPERATIONS

## Objective

Turn identified public problems into actionable government workflows.

---

## Scope

Implement:

* government dashboard;
* priority problems;
* map;
* department management;
* officer assignment;
* problem lifecycle;
* SLA tracking;
* timeline.

---

## Database

Implement:

```text id="c5cdcb"
departments
wards
assignments
actions
```

---

## Required Workflow

```text id="a86k2j"
Problem
 ↓
Triaged
 ↓
Assigned
 ↓
In Progress
 ↓
Awaiting Verification
 ↓
Resolved
 ↓
Closed
```

---

## APIs

Implement:

```text id="z6h4km"
GET  /api/v1/dashboard/overview
GET  /api/v1/dashboard/priority-problems
GET  /api/v1/dashboard/map
GET  /api/v1/dashboard/departments
GET  /api/v1/dashboard/trends
GET  /api/v1/dashboard/sla-risk

POST /api/v1/problems/:id/assign
POST /api/v1/problems/:id/reassign
POST /api/v1/problems/:id/actions

GET /api/v1/problems/:id/timeline
```

---

## Dashboard Requirements

Show:

```text id="x0wfkw"
Citizen Signals
Active Problems
High Impact
Resolution Rate
Median Response
```

Then:

* priority problems;
* map;
* AI brief placeholder;
* department performance;
* trend section.

---

## Map

Show:

* problem clusters;
* impact;
* status;
* category.

Filtering:

* ward;
* department;
* category;
* status;
* impact.

---

## Officer Workspace

Show:

```text id="1e1u6u"
My Work
Priority Problems
Problem Detail
Timeline
Actions
```

---

## Acceptance Criteria

```text id="lqceuw"
[ ] Dashboard works
[ ] Priority ranking visible
[ ] Map works
[ ] Filters work
[ ] Department data visible
[ ] Officer can receive assignment
[ ] Officer can update status
[ ] Timeline records actions
[ ] SLA risk works
[ ] Authorization works
[ ] Browser verification completed
```

---

# 11. PHASE 6 — RESOLUTION + AI VERIFICATION

## Objective

Provide evidence-based resolution workflows.

---

## Scope

Implement:

* resolution evidence;
* resolution submission;
* AI verification;
* confidence;
* limitations;
* human review.

---

## Database

Implement:

```text id="n6qytj"
resolution_evidence
verification_results
```

---

## APIs

Implement:

```text id="m7n8xu"
POST /api/v1/problems/:id/resolution-evidence

POST /api/v1/resolution-evidence/:id/verify

GET /api/v1/resolution-evidence/:id/verification
```

---

## Workflow

```text id="q7n6qi"
Officer
 ↓
Upload Resolution Evidence
 ↓
Submit
 ↓
AI Verification
 ↓
Human Review
 ↓
Resolve
 ↓
Close
```

---

## Verification States

```text id="evk4hk"
LIKELY_RESOLVED
UNCERTAIN
LIKELY_NOT_RESOLVED
INSUFFICIENT_EVIDENCE
```

---

## UI

Show:

```text id="7z7vbe"
Resolution Evidence

AI Assessment:
Likely Resolved

Confidence:
91%

Observation:
Evidence appears consistent
with the reported repair.

Limitation:
Image alone cannot establish
long-term repair quality.

Human review required.
```

---

## Important Rule

AI verification must not automatically equal official closure.

---

## Acceptance Criteria

```text id="uzgx17"
[ ] Evidence upload works
[ ] Evidence metadata stored
[ ] AI verification works
[ ] Confidence shown
[ ] Limitations shown
[ ] Human review supported
[ ] Resolution state transitions work
[ ] Audit events created
[ ] Unauthorized evidence access blocked
[ ] Browser flow verified
```

---

# 12. PHASE 7 — GOVERNANCE AI

## Objective

Create the natural-language intelligence layer for administrators.

This is the second major product differentiator after clustering/impact intelligence.

---

## Scope

Implement:

* controlled analytical tools;
* grounded retrieval;
* Governance AI;
* AI brief;
* evidence display;
* trend explanations.

---

## Required Analytical Tools

Implement:

```text id="29uo40"
getTopProblems
getWardImpact
getDepartmentBacklog
getTrend
getProblemDetails
getSlaRisk
getProblemsNearFacility
getDepartmentPerformance
```

---

## Governance Query Flow

```text id="9wj9wh"
Question
 ↓
Intent Detection
 ↓
Permission Check
 ↓
Tool Selection
 ↓
Structured Data Retrieval
 ↓
Metric Calculation
 ↓
Gemini
 ↓
Validated Response
 ↓
Evidence Display
```

---

## Supported Questions

At minimum:

```text id="lh5o0j"
What are the top three problems?

Which wards have the highest unresolved impact?

Why are water problems increasing?

Which department has the largest backlog?

What problems are concentrated in Ward 18?
```

---

## Response Structure

Every answer should provide:

* answer;
* evidence;
* metrics;
* supporting problem IDs;
* recommendation when relevant;
* confidence.

---

## No Arbitrary SQL

Do not allow Gemini or users to execute unrestricted SQL.

---

## Governance AI UI

It should feel like an analytical workspace, not a generic chatbot.

Include:

* suggested questions;
* answer area;
* supporting metrics;
* evidence;
* related problems.

---

## AI Brief

Show on the dashboard:

```text id="nyd2ju"
AI BRIEF

Water supply is currently the
largest unresolved public-impact
problem.

The strongest concentration is
in Wards 17–19.
```

---

## Acceptance Criteria

```text id="n1f4dm"
[ ] Governance AI works
[ ] Questions are permission-scoped
[ ] Controlled tools implemented
[ ] Structured data retrieved
[ ] Gemini receives grounded context
[ ] Answers include evidence
[ ] Unsupported questions handled
[ ] No arbitrary SQL
[ ] AI output validated
[ ] Browser verification completed
```

---

# 13. PHASE 8 — INTERVENTION SIMULATOR

## Objective

Allow administrators to explore hypothetical intervention allocation.

This is an enhancement, not a prerequisite for the core product.

---

## Example

User asks:

> We have ₹10 lakh available. Where could intervention have the greatest estimated public impact?

System returns:

```text id="j3b6fm"
Recommended scenario

Ward 18 — Water
₹4.2L

Ward 7 — Roads
₹2.1L

Ward 12 — Drainage
₹1.8L

Ward 9 — Streetlights
₹1.1L

Contingency
₹0.8L
```

---

## Requirements

Display:

* assumptions;
* estimated impact;
* uncertainty;
* recommendation basis.

Clearly label:

**Simulation / Advisory**

---

## Important Rule

This feature must never:

* execute payments;
* approve budgets;
* create procurement orders;
* represent estimates as official costs.

---

## Acceptance Criteria

```text id="18mxs3"
[ ] Budget input works
[ ] Scenario calculation works
[ ] Assumptions visible
[ ] Results explainable
[ ] Simulation clearly labeled
[ ] No financial action is executed
```

---

# 14. PHASE 9 — SECURITY + PERFORMANCE + TESTING

## Objective

Harden the product before final demo and deployment.

---

## Security

Verify:

* authentication;
* role-based authorization;
* Firestore rules;
* server-side permissions;
* API validation;
* file upload security;
* rate limiting;
* secret handling;
* AI prompt injection protection;
* Governance AI data isolation.

---

## Performance

Check:

* dashboard loading;
* problem list pagination;
* map performance;
* AI request duplication;
* database query efficiency;
* large synthetic dataset.

---

## Testing

Minimum:

### Unit tests

* impact score;
* state transitions;
* similarity logic;
* validation.

### Integration tests

* signal creation;
* AI processing;
* cluster creation;
* assignment;
* resolution.

### Security tests

* unauthorized access;
* role escalation;
* data leakage;
* prompt injection.

### Browser tests

* citizen report;
* government dashboard;
* officer workflow;
* verification;
* Governance AI.

---

## Acceptance Criteria

```text id="rj2j2f"
[ ] Critical tests pass
[ ] Security tests pass
[ ] No secret exposure
[ ] No critical console errors
[ ] Large lists paginate
[ ] AI calls are controlled
[ ] Mobile layout verified
[ ] Desktop layout verified
```

---

# 15. PHASE 10 — DEMO + DEPLOYMENT + FINAL POLISH

## Objective

Prepare the product for hackathon presentation.

---

## Scope

Implement:

* synthetic demo dataset;
* golden demo scenario;
* polished dashboards;
* demo accounts;
* final error handling;
* deployment;
* demo walkthrough;
* documentation.

---

## Golden Demo Scenario

### Step 1 — Citizen

Submit:

> Water has not been available in our area for three days.

Preferably in Odia or Hindi during the final demonstration.

---

### Step 2 — AI

System detects:

```text id="8pif5r"
Water Supply
High Severity
Ward 18
```

---

### Step 3 — Related Signals

System reveals:

```text id="fu5dsi"
327 related signals
```

---

### Step 4 — Problem Cluster

```text id="43lvbb"
Water Supply Disruption
Ward 18

Impact:
92 / 100
```

---

### Step 5 — Government Dashboard

Problem appears among:

**Top Public Priorities**

---

### Step 6 — Officer

Officer receives:

**High Impact Problem**

and begins work.

---

### Step 7 — Resolution

Officer submits evidence.

---

### Step 8 — AI Verification

System responds:

```text id="jzq8x5"
Likely Resolved
91% confidence
```

---

### Step 9 — Governance AI

Administrator asks:

> Which wards currently have the highest unresolved impact?

The system responds using actual synthetic data.

---

# 16. Demo Data Requirements

Seed:

```text id="2bclxa"
10+ wards
5+ departments
10,000+ signals
500+ problem clusters
```

Include:

* duplicates;
* multilingual signals;
* unresolved problems;
* resolved problems;
* high-impact problems;
* different categories;
* geographic concentrations.

---

# 17. Final Visual Polish

Before final demo verify:

* spacing;
* typography;
* empty states;
* loading states;
* errors;
* mobile responsiveness;
* navigation;
* map behavior;
* chart labels;
* evidence display;
* AI confidence;
* accessibility.

---

# 18. Demo Mode

Support:

```text id="h2akwr"
DEMO_MODE=true
```

Demo mode may:

* seed data;
* provide demo accounts;
* expose synthetic records.

It must not weaken production security silently.

---

# 19. Deployment

Prepare:

* environment variables;
* cloud configuration;
* frontend deployment;
* backend deployment;
* Firestore;
* Storage;
* AI;
* Maps;
* BigQuery where used.

---

# 20. Final Acceptance Test

The entire product must support:

```text id="y8h2ih"
Citizen
 ↓
Signal
 ↓
AI Understanding
 ↓
Related Reports
 ↓
Problem Cluster
 ↓
Impact Score
 ↓
Priority
 ↓
Government Assignment
 ↓
Action
 ↓
Resolution Evidence
 ↓
AI Verification
 ↓
Governance Intelligence
```

---

# 21. Phase Dependencies

```text id="3t2yl4"
Phase 0
  ↓
Phase 1
  ↓
Phase 2
  ↓
Phase 3
  ↓
Phase 4
  ↓
Phase 5
  ↓
Phase 6
  ↓
Phase 7
  ↓
Phase 8
  ↓
Phase 9
  ↓
Phase 10
```

---

# 22. Parallel Work Guidance

Some work can be developed in parallel only when dependencies are stable.

Potential parallel work:

```text id="m0jhwj"
Frontend components
       +
Backend repositories
       +
Seed data
```

However, integrated testing must occur after both sides converge.

Do not create parallel implementations of the same business logic.

---

# 23. Agent Execution Rule

When asked:

> Implement Phase N.

The agent must:

1. read all relevant specification files;
2. inspect existing implementation;
3. verify previous phases;
4. implement only Phase N;
5. test Phase N;
6. browser-test Phase N;
7. fix issues;
8. update documentation;
9. stop.

---

# 24. Prohibited Agent Behavior

The agent must not:

* skip phases;
* silently implement future phases;
* rewrite unrelated working code;
* add unnecessary frameworks;
* add unnecessary dependencies;
* replace real functionality with fake UI;
* leave unfinished features pretending to work;
* silently introduce mock data into production flows;
* claim successful verification without testing.

---

# 25. Phase Completion Report

After each phase, provide:

```text id="7edq6f"
Phase:
Status:

Implemented:
- ...

Files changed:
- ...

Database changes:
- ...

API changes:
- ...

AI changes:
- ...

Tests:
- ...

Browser verification:
- ...

Known issues:
- ...

Next phase:
- ...
```

---

# 26. Definition of Done

A phase is complete only when:

```text id="3r5wvo"
[ ] Requirements implemented
[ ] Existing architecture preserved
[ ] Types pass
[ ] Lint passes
[ ] Tests pass
[ ] Build passes
[ ] Browser verified
[ ] Error states verified
[ ] Security considerations addressed
[ ] Documentation updated
```

---

# 27. Priority During Time Pressure

If hackathon time becomes limited, prioritize:

```text id="z3cgx2"
1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 10 polish
```

Phase 8 may be dropped.

Do not sacrifice core signal → cluster → impact → action → verification functionality to implement optional features.

---

# 28. Minimum Competitive MVP

If implementation must stop early, the strongest minimum product is:

```text id="jtltyk"
Citizen Signal
        ↓
Gemini Understanding
        ↓
Duplicate Detection
        ↓
Problem Cluster
        ↓
Impact Score
        ↓
Government Dashboard
        ↓
Officer Action
        ↓
Resolution Evidence
        ↓
AI Verification
```

This is the minimum end-to-end story that should remain intact.

---

# 29. Final Product Loop

The final product must demonstrate:

## Observe

Collect citizen signals.

## Understand

Use AI to normalize unstructured information.

## Connect

Identify related signals.

## Prioritize

Measure public impact.

## Act

Support government workflows.

## Verify

Assess resolution evidence.

## Learn

Generate governance intelligence.

```text id="bs9uz0"
OBSERVE
   ↓
UNDERSTAND
   ↓
CONNECT
   ↓
PRIORITIZE
   ↓
ACT
   ↓
VERIFY
   ↓
LEARN
```

---

# 30. Source of Truth

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

API specification:

`07_API_SPEC.md`

Security:

`08_SECURITY.md`

Demo/evaluation:

`10_DEMO_AND_EVALUATION.md`

Engineering rules:

`11_IMPLEMENTATION_RULES.md`

This document defines the implementation order and acceptance criteria for CivicPulse AI.
