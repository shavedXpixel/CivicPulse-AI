# CivicPulse AI

## Engineering & Implementation Rules

**Version:** 1.0
**Status:** Hackathon MVP
**Product:** CivicPulse AI

---

# 1. Purpose

This document defines the engineering standards for implementing CivicPulse AI.

The goal is to ensure that the codebase remains:

* maintainable;
* secure;
* testable;
* modular;
* understandable;
* production-credible;
* compatible with AI-assisted development.

The implementation agent must follow these rules together with:

* `01_PRD.md`
* `02_PRODUCT_SCOPE.md`
* `03_ARCHITECTURE.md`
* `04_DESIGN.md`
* `05_AI_SPEC.md`
* `06_DATA_MODEL.md`
* `07_API_SPEC.md`
* `08_SECURITY.md`
* `09_PHASES.md`
* `10_DEMO_AND_EVALUATION.md`

---

# 2. Engineering Priority

When making implementation decisions, prioritize:

```text
Correctness
    ↓
Security
    ↓
Reliability
    ↓
Maintainability
    ↓
Performance
    ↓
Visual polish
```

Do not sacrifice correctness for speed of implementation.

Do not sacrifice security for demo convenience.

---

# 3. Core Engineering Principle

Build:

> **The smallest reliable implementation that satisfies the specification.**

Avoid unnecessary abstraction and infrastructure.

Do not build a complicated system simply because it looks impressive.

---

# 4. Source-of-Truth Hierarchy

When deciding what to implement, use this order:

```text
1. Security constraints
2. Product requirements
3. Product scope
4. Architecture
5. Data model
6. API contract
7. AI specification
8. Design specification
9. Implementation convenience
```

Convenience must never override a higher-level requirement.

---

# 5. Read Before Modifying

Before modifying an existing feature:

1. inspect relevant files;
2. understand current behavior;
3. identify dependencies;
4. read the relevant specification;
5. determine whether existing components/services can be reused.

Do not rewrite an entire module without first inspecting it.

---

# 6. Phase Discipline

The project is implemented phase by phase.

When asked to implement Phase N:

```text
Read
 ↓
Inspect
 ↓
Plan
 ↓
Implement
 ↓
Test
 ↓
Browser Verify
 ↓
Fix
 ↓
Document
 ↓
Stop
```

Do not automatically implement Phase N+1.

---

# 7. No Silent Scope Expansion

Do not add features merely because they seem useful.

Examples of prohibited unsolicited additions:

* social feeds;
* extra AI agents;
* unnecessary notifications;
* unrelated analytics;
* unnecessary external integrations;
* complex admin tools;
* speculative predictive systems.

---

# 8. Technology Rules

Preferred stack:

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* accessible component primitives

### Backend

* Node.js
* TypeScript
* structured API layer
* Zod or equivalent validation

### Cloud

* Firebase Authentication
* Firestore
* Cloud Storage
* Cloud Run where appropriate
* BigQuery for analytics
* Gemini / Vertex AI
* Google Maps Platform

Equivalent tools may be used only when necessary and documented.

---

# 9. Dependency Rules

Before adding a dependency:

1. inspect existing dependencies;
2. determine whether the standard platform can solve the problem;
3. determine whether an existing library is sufficient;
4. add a dependency only when it provides meaningful value.

Do not add multiple libraries for the same purpose.

---

# 10. TypeScript Rules

Use TypeScript strict mode.

Avoid:

```ts
any
```

unless there is a documented and justified reason.

Prefer:

* explicit interfaces;
* discriminated unions;
* enums or constrained literals;
* generic reusable types;
* runtime validation at external boundaries.

---

# 11. Runtime Validation

Compile-time typing is not sufficient for external data.

Validate:

* API requests;
* query parameters;
* path parameters;
* uploaded file metadata;
* external API responses;
* AI outputs;
* imported data.

---

# 12. API Boundary Rule

Treat all external input as untrusted.

This includes:

* browser requests;
* citizen text;
* uploaded files;
* imported records;
* external APIs;
* AI output.

Validate before use.

---

# 13. Business Logic

Business logic belongs in domain/application services.

Do not place important business rules inside:

* React components;
* route handlers;
* database hooks without clear ownership;
* UI helper functions.

Examples of business logic:

* problem lifecycle;
* impact calculation;
* assignment validation;
* SLA logic;
* duplicate decision thresholds.

---

# 14. Frontend Rules

React components should focus on:

* presentation;
* interaction;
* local UI state;
* composition.

Do not put:

* database credentials;
* privileged business logic;
* raw Gemini calls;
* authorization decisions;

inside frontend components.

---

# 15. Backend Rules

The backend owns:

* authorization;
* business rules;
* data access;
* AI orchestration;
* validation;
* lifecycle transitions;
* audit logging.

---

# 16. Repository Rules

Use repository/data-access abstractions for persistent storage where practical.

Example:

```text
SignalRepository
ProblemRepository
AssignmentRepository
ResolutionRepository
AuditRepository
```

Repositories should handle persistence.

Repositories should not contain:

* UI logic;
* prompt construction;
* product explanations.

---

# 17. Service Layer

Services should coordinate business behavior.

Example:

```text
SignalService
ProblemService
AssignmentService
ResolutionService
VerificationService
GovernanceService
ImpactService
```

Services may coordinate multiple repositories and AI capabilities.

---

# 18. AI Architecture Rules

Never call Gemini directly from UI components.

Preferred:

```text
Frontend
   ↓
API
   ↓
Domain / Application Service
   ↓
AI Service
   ↓
Gemini
```

---

# 19. AI Is Not the Source of Truth

Never let Gemini become the authoritative source for:

* permissions;
* roles;
* impact score;
* lifecycle transitions;
* exact counts;
* financial calculations;
* security decisions.

---

# 20. Deterministic Logic

Use deterministic code for:

* arithmetic;
* percentages;
* score calculation;
* SLA calculations;
* authorization;
* filtering;
* sorting;
* state transitions;
* database consistency.

---

# 21. AI Use Cases

Use Gemini for:

* language understanding;
* text extraction;
* classification;
* semantic interpretation;
* summarization;
* image understanding;
* governance-language interaction;
* evidence interpretation.

---

# 22. AI Output Rules

Never trust raw AI output.

Every structured response must:

```text
Receive
 ↓
Parse
 ↓
Validate
 ↓
Normalize
 ↓
Business-check
 ↓
Persist / return
```

---

# 23. AI Prompt Rules

Prompts should be:

* versioned;
* centralized;
* explicit;
* short enough to maintain;
* designed around structured output.

Do not duplicate large prompts throughout the codebase.

---

# 24. Prompt Versioning

Use:

```text
signal_understanding_v1
classification_v1
governance_query_v1
resolution_verification_v1
```

Changing behavior materially requires a prompt-version update.

---

# 25. Model Configuration

Do not scatter hard-coded model IDs throughout the repository.

Use centralized configuration.

Example:

```text
AI_MODEL_GENERAL
AI_MODEL_FAST
AI_MODEL_VISION
AI_MODEL_EMBEDDING
```

---

# 26. AI Retry Rules

AI operations may retry transient failures.

Maximum default:

```text
3 attempts
```

Use backoff.

Do not retry indefinitely.

---

# 27. AI Cost Rules

Avoid unnecessary AI calls.

Do not:

* regenerate the same summary every page load;
* re-analyze unchanged images;
* repeatedly classify unchanged signals;
* send entire databases to the model.

Use:

* caching;
* stored results;
* incremental processing;
* retrieval.

---

# 28. AI Failure Handling

Every AI feature must have a graceful fallback.

Example:

```text
AI unavailable

The report has been saved and will be
processed when analysis is available.
```

Do not lose user data because an AI service fails.

---

# 29. Confidence Handling

Confidence must be represented carefully.

Do not convert:

```text
0.91
```

into:

> Guaranteed correct.

Use:

> High model confidence.

---

# 30. Low-Confidence Handling

Low confidence should result in:

```text
requires_review = true
```

where appropriate.

Never force uncertain results into definitive decisions.

---

# 31. Prompt Injection Rules

Treat all user and imported content as untrusted.

Examples:

* citizen text;
* uploaded documents;
* imported descriptions;
* external data.

Such content must never override system instructions.

---

# 32. Governance AI Rules

Governance AI must use controlled retrieval.

Preferred:

```text
User Question
 ↓
Intent
 ↓
Permission Check
 ↓
Allowed Tool
 ↓
Structured Data
 ↓
Gemini Explanation
```

Do not give the model unrestricted database access.

---

# 33. No Arbitrary SQL

Never execute arbitrary SQL or database queries generated directly from user text.

Use:

* allowlisted tools;
* predefined query functions;
* validated parameters.

---

# 34. Governance Tool Rules

Each Governance AI tool must have:

* explicit name;
* schema;
* authorization check;
* input validation;
* controlled query;
* typed output.

Example:

```text
getTopProblems
getWardImpact
getDepartmentBacklog
getTrend
getSlaRisk
```

---

# 35. Authorization Rules

Authorization must be checked:

* before retrieving protected data;
* before modifying protected data;
* before executing privileged tools.

Do not retrieve all records and filter them in React.

---

# 36. Role Rules

Roles must be server-controlled.

Never accept:

```json
{
  "role": "SYSTEM_ADMIN"
}
```

from the client as authoritative.

---

# 37. Status Transition Rules

Status changes must be validated against:

* current status;
* requested action;
* actor role;
* permissions;
* required data.

Do not expose an unrestricted:

```text
PATCH /problem/:id { status: "CLOSED" }
```

workflow.

---

# 38. Impact Score Rules

Impact score must be calculated server-side.

Store:

* individual components;
* final score;
* impact level.

The formula must remain traceable.

---

# 39. Duplicate Detection Rules

Duplicate detection must not rely solely on LLM output.

Use a combination of:

* semantic similarity;
* geography;
* time;
* category;
* optional visual similarity.

Store the relationship reasoning.

---

# 40. Problem Cluster Rules

A cluster must never erase source signals.

Always preserve:

```text
Signal
 ↓
Cluster Membership
 ↓
Problem Cluster
```

Original reports remain accessible according to authorization.

---

# 41. Database Rules

Use Firestore as the operational source of truth.

Use BigQuery for analytical workloads.

Use Cloud Storage for media.

Do not create duplicate sources of truth unnecessarily.

---

# 42. Firestore Rules

Queries must be:

* authorization-scoped;
* indexed;
* paginated;
* bounded.

Do not perform unbounded collection reads.

---

# 43. BigQuery Rules

Do not use BigQuery for simple transactional workflows.

Use it when analytical queries provide clear value.

---

# 44. Storage Rules

Large files belong in Cloud Storage.

Firestore should store metadata/reference information.

---

# 45. Data Integrity

When multiple related records change, use:

* transactions;
* controlled writes;
* idempotency;
* consistency checks.

Example:

When assigning a problem:

```text
Assignment
+
Problem State
+
Audit Record
```

must remain consistent.

---

# 46. IDs

Use stable identifiers.

Do not use display names as identifiers.

References must use entity IDs.

---

# 47. Timestamps

Store backend timestamps in UTC-compatible form.

Do not rely on client clock values for authoritative audit timestamps.

---

# 48. Time Handling

All business time calculations must use consistent server-side timestamps.

Examples:

* SLA deadlines;
* duration;
* resolution time;
* trend periods.

---

# 49. File Upload Rules

Validate:

* file size;
* MIME type;
* ownership;
* allowed file category.

Do not trust only the filename.

---

# 50. Public vs Private Data

Design APIs so that aggregate views do not accidentally expose personal information.

Prefer:

```text
328 reports
```

over:

```text
Priyansu Dash, phone..., email...
```

where identity is not required.

---

# 51. Logging Rules

Logs should help diagnose issues without becoming a copy of the database.

Do not log unnecessarily:

* passwords;
* tokens;
* API keys;
* private citizen content;
* entire AI contexts;
* uploaded file contents.

---

# 52. Error Handling

Every user-facing operation must have:

```text
loading
success
error
empty
```

states where applicable.

Backend errors must return stable application error codes.

---

# 53. Error Message Rules

User-facing errors should be understandable.

Avoid exposing:

* stack traces;
* file paths;
* database internals;
* provider-specific diagnostics.

---

# 54. Frontend Data Fetching

Use a consistent data-fetching approach.

Avoid multiple competing state-management/data-fetching libraries without a clear reason.

---

# 55. Caching Rules

Cache only safe data.

Potential cache:

* department list;
* ward list;
* dashboard summaries.

Use caution with:

* user-specific data;
* permission-sensitive data;
* rapidly changing status.

---

# 56. Pagination Rules

Large collections must be paginated.

Default:

```text
20
```

Maximum:

```text
100
```

The backend must enforce limits.

---

# 57. Search Rules

Different search types should remain distinct:

```text
Exact Search
Filtered Search
Semantic Search
```

Do not use semantic search for exact identifiers.

---

# 58. Component Reuse

Before creating a new UI component:

1. search for an existing equivalent;
2. reuse it if possible;
3. extend it carefully where appropriate.

Avoid component duplication.

---

# 59. Component Size

Avoid massive components.

A component should have a clear responsibility.

If a component becomes difficult to understand, extract logical subcomponents.

Do not extract every tiny element unnecessarily.

---

# 60. UI Design Rules

Follow `04_DESIGN.md`.

The UI should be:

* calm;
* professional;
* information-focused;
* accessible.

Avoid:

* AI gimmicks;
* neon effects;
* excessive gradients;
* excessive glassmorphism.

---

# 61. Citizen UX Rules

The citizen flow should minimize friction.

Prefer:

```text
Report
 ↓
Describe
 ↓
Location
 ↓
Submit
```

Do not require unnecessary fields.

---

# 62. Government UX Rules

Government users need:

* dense but readable data;
* clear priorities;
* evidence;
* filters;
* actionable workflows.

Do not bury primary actions in decorative UI.

---

# 63. Mobile Rules

Every feature must remain usable on mobile unless explicitly desktop-only.

Test:

* small screens;
* touch targets;
* scrolling;
* forms;
* tables;
* maps.

---

# 64. Accessibility Rules

Every user-facing page should support:

* keyboard access;
* visible focus;
* accessible labels;
* meaningful headings;
* readable contrast;
* non-color status indicators;
* reduced motion.

---

# 65. Loading Rules

Use meaningful loading states.

For AI:

```text
Analyzing report...
Checking related signals...
Preparing result...
```

Avoid vague:

> AI is thinking...

---

# 66. Empty State Rules

An empty state must answer:

1. What is empty?
2. Why?
3. What can the user do next?

---

# 67. Browser Verification

For user-facing changes, verify in the browser where practical.

Check:

* layout;
* interactions;
* routing;
* loading;
* errors;
* responsive behavior;
* data rendering.

---

# 68. Console Hygiene

Before marking a feature complete:

* resolve unexpected console errors;
* investigate warnings that affect functionality;
* avoid leaving debug logs in production flows.

---

# 69. Testing Strategy

Use multiple testing levels.

## Unit

For:

* scoring;
* validation;
* lifecycle;
* similarity logic.

## Integration

For:

* API;
* database;
* AI orchestration.

## End-to-End

For:

* citizen report;
* officer workflow;
* administrator workflow.

---

# 70. Tests Must Be Meaningful

Do not create tests merely to increase test count.

Tests should catch realistic failures.

---

# 71. Critical Logic Test Priority

Highest priority:

```text
Authorization
Impact scoring
State transitions
AI output validation
Problem clustering
Resolution verification flow
Governance retrieval
```

---

# 72. AI Test Strategy

AI tests should include:

* normal input;
* ambiguous input;
* malformed output;
* low confidence;
* prompt injection;
* unsupported content;
* timeout;
* provider failure.

---

# 73. Deterministic Test Fixtures

Use fixed fixtures for deterministic tests.

Do not make unit tests depend on live Gemini responses.

Mock external AI services when testing deterministic behavior.

---

# 74. Integration Tests

When testing actual AI integration:

* use controlled inputs;
* validate response schemas;
* record failures;
* avoid unnecessary model calls.

---

# 75. Demo Data Rules

Synthetic data must be deterministic enough to reproduce the main demo.

Seed scripts should be repeatable.

Example:

```text
npm run seed:demo
```

or equivalent.

---

# 76. Golden Demo Stability

The golden demo scenario must not depend on random model behavior to create the final narrative every time.

Pre-seed or control important demo outcomes where appropriate.

For example:

* known signal clusters;
* known impact scores;
* known demonstration evidence.

Live AI should still be demonstrated where it provides meaningful value.

---

# 77. Demo Integrity

Never present:

* synthetic data as real government data;
* mocked Gemini output as live Gemini output;
* simulated metrics as measured real-world impact.

Label synthetic/demo information clearly.

---

# 78. Mocking Rules

Mocks are permitted for:

* unit tests;
* local development;
* unavailable external services.

Mocks must never be silently presented as production functionality.

---

# 79. Configuration Rules

Use environment/configuration for:

* API keys;
* model IDs;
* service URLs;
* project IDs;
* feature flags;
* thresholds.

Do not scatter configuration constants through the application.

---

# 80. Feature Flags

Optional capabilities may use feature flags.

Example:

```text
ENABLE_INTERVENTION_SIMULATOR
ENABLE_VOICE_INPUT
ENABLE_ADVANCED_TRENDS
```

Do not use feature flags to conceal broken core functionality.

---

# 81. Threshold Configuration

Potentially configurable:

```text
duplicate_threshold
related_threshold
impact_thresholds
confidence_thresholds
SLA thresholds
```

Store configuration centrally.

---

# 82. Constants

Avoid magic numbers.

Instead of:

```ts
if (score >= 85)
```

prefer:

```ts
if (score >= IMPACT_THRESHOLDS.CRITICAL)
```

---

# 83. Naming Rules

Use clear names.

Prefer:

```text
problemCluster
resolutionEvidence
impactScore
```

over:

```text
pc
res
score2
```

---

# 84. Async Rules

Do not perform heavy operations synchronously when they can exceed normal request latency.

Potential asynchronous jobs:

* image analysis;
* large clustering;
* bulk imports;
* resolution verification;
* large analytics processing.

---

# 85. Idempotency Rules

Operations that may be retried must not create duplicate results.

Examples:

* AI processing;
* assignment;
* resolution submission;
* notification creation.

---

# 86. Concurrency Rules

Protect shared state from lost updates.

Use:

* transactions;
* version checks;
* updated timestamps;
* controlled state transitions.

---

# 87. API Rules

Every endpoint must define:

* method;
* path;
* auth;
* authorization;
* request;
* validation;
* response;
* errors.

The API contract is defined in `07_API_SPEC.md`.

---

# 88. API Client Rules

Frontend API calls should use a centralized client abstraction.

Avoid scattered raw `fetch()` implementations with inconsistent behavior.

Centralize:

* base URL;
* authorization;
* error handling;
* response parsing.

---

# 89. Shared Schema Rules

Where practical, share schemas/types between frontend and backend.

Avoid maintaining two incompatible definitions of the same entity.

---

# 90. Database Query Rules

Do not expose raw database query parameters directly to users without validation.

Whitelist:

* sort fields;
* filter fields;
* supported operators.

---

# 91. SQL Rules

Any SQL used with BigQuery must be:

* parameterized;
* controlled;
* validated.

Do not concatenate raw user strings into SQL.

---

# 92. Firestore Query Rules

Queries must be:

* indexed;
* bounded;
* scoped;
* paginated.

Avoid fetching thousands of documents simply to filter them client-side.

---

# 93. Cloud Storage Rules

Use predictable storage paths.

Example:

```text
signals/{signalId}/...
resolutions/{problemId}/...
```

Do not allow arbitrary user-controlled paths.

---

# 94. Audit Rules

Important mutations should create audit events.

Examples:

```text
ASSIGNMENT_CREATED
STATUS_CHANGED
EVIDENCE_SUBMITTED
VERIFICATION_COMPLETED
CONFIG_CHANGED
ROLE_CHANGED
```

---

# 95. Documentation Rules

Update documentation when:

* architecture changes;
* API changes;
* database fields change;
* environment variables change;
* major AI behavior changes.

---

# 96. README Rules

The root README should eventually include:

* project overview;
* architecture;
* setup;
* environment variables;
* development;
* testing;
* seeding;
* deployment;
* demo instructions.

---

# 97. `.env.example`

Maintain an up-to-date example.

Never put real secrets into it.

---

# 98. Code Comments

Comments should explain:

* why something is non-obvious;
* important constraints;
* security assumptions;
* architectural decisions.

Do not comment obvious code.

Bad:

```ts
// Increment count by one
count += 1;
```

Good:

```ts
// Keep the cached cluster count synchronized with
// membership writes performed in the same transaction.
```

---

# 99. TODO Rules

Do not leave vague TODOs.

Bad:

```text
TODO: fix later
```

Good:

```text
TODO(P2): Replace polling with realtime event
when external integration architecture is introduced.
```

---

# 100. Dead Code

Do not leave large blocks of commented-out code.

Remove unused code after verifying it is not needed.

---

# 101. Refactoring Rules

Refactor when:

* duplication is significant;
* behavior is difficult to test;
* architecture boundaries are being violated.

Do not refactor unrelated modules during feature work without reason.

---

# 102. Performance Rules

Optimize based on actual need.

Prioritize:

* database query efficiency;
* repeated AI calls;
* unnecessary rendering;
* large list rendering;
* map performance;
* upload handling.

Do not prematurely optimize every function.

---

# 103. Frontend Performance

Use appropriate:

* lazy loading;
* memoization where justified;
* pagination;
* virtualization for genuinely large lists;
* caching.

Do not introduce performance libraries without evidence of need.

---

# 104. Backend Performance

Avoid:

* N+1 queries;
* repeated AI calls;
* unbounded reads;
* sequential work that can safely be parallelized.

---

# 105. AI Performance

Prefer:

```text
Retrieve only what is needed
+
Send only relevant context
+
Cache reusable outputs
```

Do not send:

```text
Entire database
```

to Gemini.

---

# 106. Build Verification

Before completing a phase:

```text
npm run lint
npm run test
npm run build
```

or the project's equivalent commands.

All required checks must pass.

---

# 107. Browser Verification Requirement

For UI changes, verify the actual application in a browser where practical.

Check:

```text
Desktop
Tablet
Mobile
```

---

# 108. Final Phase Review

Before declaring the project complete, review:

* product scope;
* architecture;
* AI behavior;
* security;
* UI;
* data;
* APIs;
* demo.

Verify that implementation still matches the specifications.

---

# 109. Agent Output Rules

After implementation, provide:

```text
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

Do not claim work that was not performed.

---

# 110. Agent Stop Rule

After completing the requested phase and verification:

> **STOP.**

Do not automatically:

* continue to the next phase;
* redesign unrelated pages;
* add optional features;
* refactor the entire repository.

---

# 111. Definition of Done

A feature is complete only when:

```text
[ ] Requirements implemented
[ ] Architecture respected
[ ] Types pass
[ ] Validation exists
[ ] Authorization exists
[ ] Error handling exists
[ ] Tests pass
[ ] Build passes
[ ] Browser verification completed where applicable
[ ] Documentation updated where necessary
[ ] No obvious debug artifacts remain
```

---

# 112. Production-Credibility Rule

A feature is not complete merely because:

* the button exists;
* the page looks correct;
* a mock response is displayed.

The underlying workflow must actually function or be explicitly labeled as a prototype/demo mechanism.

---

# 113. Hackathon-Time Rule

When time is limited:

Prioritize:

```text
Core workflow correctness
    ↓
AI differentiation
    ↓
Trust/security
    ↓
Demo stability
    ↓
Visual polish
    ↓
Optional features
```

Do not spend the remaining build time adding minor features while the main workflow is unstable.

---

# 114. Golden Product Workflow

Everything should ultimately strengthen:

```text
Citizen Signal
      ↓
AI Understanding
      ↓
Related Signals
      ↓
Problem Cluster
      ↓
Impact Score
      ↓
Priority
      ↓
Government Action
      ↓
Resolution Evidence
      ↓
AI Verification
      ↓
Governance Intelligence
```

---

# 115. Final Engineering Principle

Build CivicPulse as though another engineering team will inherit the repository tomorrow.

The code should be:

* understandable;
* structured;
* documented;
* testable;
* secure;
* replaceable where necessary.

Do not optimize only for making the hackathon demo work once.

Build a credible foundation that can continue beyond the demo.

---

# 116. Source of Truth

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

Implementation phases:

`09_PHASES.md`

Demo and evaluation:

`10_DEMO_AND_EVALUATION.md`

This document defines the engineering standards and implementation behavior for CivicPulse AI.
