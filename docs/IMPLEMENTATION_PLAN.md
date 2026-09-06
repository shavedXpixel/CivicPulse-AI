# CivicPulse AI — Master Implementation Plan & Engineering Roadmap

**Product:** CivicPulse AI  
**Tagline:** Citizen Signals → Government Intelligence → Public Action  
**Version:** 1.1 (Revised Architecture & Phasing)  
**Status:** Baseline Plan Approved — Pre-Implementation Stage  

---

## A. Executive Summary

CivicPulse AI is an AI-powered public-problem intelligence layer for Digital Public Infrastructure (DPI) and modern governance. It does not replace existing municipal grievance portals or government complaint desks; rather, it functions as an intelligence layer situated above fragmented intake channels.

CivicPulse ingests raw, unstructured, multilingual citizen and public-service signals (text, voice transcripts, images, location), normalizes and understands them using Gemini, identifies duplicates and semantic relationships, clusters them into actionable public problems, computes deterministic public impact scores (0–100), prioritizes problems for government action, tracks the operational resolution workflow, and assists authorities with AI-based resolution evidence verification and grounded governance intelligence.

### The Core Loop
```text
SIGNAL
  ↓
UNDERSTAND (Gemini structured extraction via IAIProvider)
  ↓
RELATE (Filter-first candidate retrieval + in-memory cosine similarity + geospatial proximity)
  ↓
CLUSTER (Problem Clusters — e.g. P-1042)
  ↓
SCORE (Authoritative deterministic 0–100 impact score)
  ↓
PRIORITIZE (Ranked public problem queues & heatmap)
  ↓
ACT (Department assignment, field investigation, status tracking)
  ↓
VERIFY (Resolution evidence analysis & human verification)
  ↓
LEARN (Grounded Governance AI via allowlisted analytical tools)
```

---

## B. Current Repository State

1. **Workspace Inspection**:
   - The repository root currently contains only `.cursorrules` and the `docs/` directory with 11 specification documents (`01_PRD.md` through `11_IMPLEMENTATION_RULES.md`).
   - No source code, package manifests (`package.json`), build scripts, environment files, or tests exist yet.
   - The directory is not yet initialized as a git repository.
2. **Environment & Host Tooling**:
   - Host OS: Windows.
   - Node.js version: `v24.16.0`.
   - npm / npx version: `11.13.0`.
   - PowerShell Execution Policy: `npm.ps1` script execution is disabled by Windows security policy (`PSSecurityException`). All tooling calls must invoke `npm.cmd` and `npx.cmd` directly.

---

## C. Final Recommended Architecture

A **Modular Monolith** organized with npm workspaces (`shared/`, `backend/`, `frontend/`), preserving clean physical and logical boundaries across the presentation layer, the backend API, shared types, and cloud infrastructure.

```text
                                  ┌────────────────────────┐
                                  │      CITIZEN UX        │
                                  │ Mobile-first / Simple  │
                                  └───────────┬────────────┘
                                              │
                                              ▼
┌─────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│     GOVERNMENT UX       │       │    WEB CLIENT APP      │       │     OFFICER UX         │
│  Dashboards / Heatmaps  ├──────►│      (Next.js)         │◄──────┤ Actionable Worklists   │
│  Governance AI Workspace│       │ TypeScript / React /   │       │ Evidence Upload        │
└─────────────────────────┘       │ Tailwind CSS           │       └────────────────────────┘
                                  └───────────┬────────────┘
                                              │ HTTPS / JSON (/api/v1)
                                              ▼
                                  ┌────────────────────────┐
                                  │     BACKEND SERVER     │
                                  │  (Node.js / Express)   │
                                  ├────────────────────────┤
                                  │ • Firebase Auth Guard  │
                                  │ • RBAC Authorization   │
                                  │ • Zod Schema Validator │
                                  │ • Domain Orchestrator  │
                                  │ • Audit Logger         │
                                  └───────────┬────────────┘
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
┌─────────────────┐                  ┌─────────────────┐                  ┌─────────────────┐
│IDatabaseProvider│                  │IStorageProvider │                  │   IAIProvider   │
├─────────────────┤                  ├─────────────────┤                  ├─────────────────┤
│FirestoreProvider│                  │CloudStorage     │                  │GeminiAIProvider │
│  (or Mock)      │                  │  (or LocalDisk) │                  │  (or Mock)      │
└────────┬────────┘                  └────────┬────────┘                  └────────┬────────┘
         │                                    │                                    │
         ▼                                    ▼                                    ▼
┌─────────────────┐                  ┌─────────────────┐                  ┌─────────────────┐
│    FIRESTORE    │                  │  CLOUD STORAGE  │                  │ GEMINI / VERTEX │
│ Operational DB  │                  │ Media & Evidence│                  │ AI Layer        │
└─────────────────┘                  └─────────────────┘                  └─────────────────┘
         │
         ▼
┌─────────────────┐
│IAnalyticsAdapter│
├─────────────────┤
│BigQuery (Prod)  │
│Firestore (Demo) │
└─────────────────┘
```

### Architectural Invariants
1. **Frontend**: Presentation, client state, interaction, accessibility. No direct privileged database mutations; no secret credentials.
2. **Backend**: Sole authority on authentication verification, RBAC, domain workflows, state transitions, mathematical impact calculation, and audit persistence.
3. **AI Layer**: Accessed strictly via `IAIProvider`. Handles unstructured interpretation, multimodal reasoning, translation, and explanation. Never authoritative for authorization, exact counts, financial decisions, or state transitions.
4. **Data Layer**: Firestore is the operational source of truth; Cloud Storage holds media; BigQuery processes analytical rollups.
5. **No Microservices**: Single modular monolith with clean domain modules.

---

## D. Repository Structure

```text
CivicPulse-AI/
├── .cursorrules                         # Agent behavioral rules
├── package.json                         # Root npm workspace manifest
├── tsconfig.base.json                   # Shared TypeScript compiler options
├── .gitignore                           # Git ignore rules
├── .env.example                         # Documented configuration template
├── docs/                                # Source specifications
│   ├── 01_PRD.md
│   ├── ...
│   ├── 11_IMPLEMENTATION_RULES.md
│   └── IMPLEMENTATION_PLAN.md           # Master implementation plan
│
├── shared/                              # Shared types, Zod schemas, constants
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types/
│       │   ├── auth.ts                  # Roles (CITIZEN, FIELD_OFFICER, etc.)
│       │   ├── signal.ts                # Signal models & processing statuses
│       │   ├── problem.ts               # ProblemCluster, Impact components
│       │   ├── workflow.ts              # Assignments, Actions, Lifecycles
│       │   ├── evidence.ts              # ResolutionEvidence, Verification
│       │   ├── governance.ts            # Query intents, Tool outputs, AI Brief
│       │   └── audit.ts                 # Audit log schemas
│       ├── schemas/                     # Zod runtime validation schemas
│       │   ├── signal.schema.ts
│       │   ├── problem.schema.ts
│       │   ├── governance.schema.ts
│       │   └── verification.schema.ts
│       └── constants/                   # Impact weights, thresholds, taxonomies
│           ├── impact.ts
│           ├── taxonomy.ts
│           └── errors.ts
│
├── backend/                             # Centralized Node.js / Express API server
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                     # Server entry point
│   │   ├── app.ts                       # Express app configuration & middleware
│   │   ├── config/                      # Environment & provider configuration
│   │   │   ├── env.ts
│   │   │   └── constants.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts       # Token verification & user context injection
│   │   │   ├── rbac.middleware.ts       # Role-based access control guard
│   │   │   ├── validate.middleware.ts   # Zod request validator
│   │   │   ├── error.middleware.ts      # Standardized error serializer
│   │   │   └── rate-limit.middleware.ts # Endpoint protection
│   │   ├── providers/                   # Infrastructure abstractions
│   │   │   ├── database/
│   │   │   │   ├── database.interface.ts # IDatabaseProvider
│   │   │   │   ├── firestore.provider.ts # Real Firestore implementation
│   │   │   │   └── mock.database.ts      # Local in-memory demo provider
│   │   │   ├── storage/
│   │   │   │   ├── storage.interface.ts  # IStorageProvider
│   │   │   │   ├── gcs.storage.ts        # Cloud Storage implementation
│   │   │   │   └── local.storage.ts      # Local disk demo provider
│   │   │   ├── ai/
│   │   │   │   ├── ai.interface.ts       # IAIProvider
│   │   │   │   ├── gemini.provider.ts    # Google Gemini implementation
│   │   │   │   └── mock.ai.ts            # Local demo AI provider
│   │   │   └── analytics/
│   │   │       ├── analytics.interface.ts# IAnalyticsProvider
│   │   │       ├── bigquery.provider.ts  # BigQuery implementation
│   │   │       └── firestore.analytics.ts# Firestore aggregation provider
│   │   └── modules/                     # Domain modules (Controller -> Service -> Repository)
│   │       ├── auth/
│   │       ├── signals/
│   │       ├── clustering/
│   │       ├── impact/
│   │       ├── problems/
│   │       ├── assignments/
│   │       ├── resolutions/
│   │       ├── verification/
│   │       ├── governance/
│   │       ├── analytics/
│   │       ├── admin/
│   │       └── audit/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── security/
│
├── frontend/                            # Next.js Web Client Application
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── src/
│   │   ├── app/                         # Next.js App Router
│   │   │   ├── layout.tsx               # Root layout with fonts, theme, notifications
│   │   │   ├── page.tsx                 # Landing & portal router
│   │   │   ├── login/                   # Authentication screen with role switchers
│   │   │   ├── citizen/                 # Citizen portal (Report, Track, My Reports)
│   │   │   ├── dashboard/               # Government intelligence dashboard
│   │   │   ├── officer/                 # Field officer task list & evidence submission
│   │   │   └── admin/                   # System admin (Users, Taxonomy, Audit logs)
│   │   ├── components/
│   │   │   ├── ui/                      # Base primitives (Button, Input, Badge, Dialog, etc.)
│   │   │   ├── layout/                  # Shells (CitizenShell, GovShell, OfficerShell)
│   │   │   ├── dashboard/               # KPIStat, PriorityList, AIBrief, TrendChart
│   │   │   ├── problems/                # ProblemCard, ImpactScoreBar, Timeline, Evidence
│   │   │   ├── maps/                    # ProblemMap, MapLegend, HotspotCluster
│   │   │   └── ai/                      # GovernanceQueryBox, EvidenceCitation, AIProgress
│   │   ├── lib/
│   │   │   ├── api-client.ts            # Centralized typed HTTP client with token handling
│   │   │   ├── auth-context.tsx         # React auth provider
│   │   │   └── utils.ts
│   │   └── styles/
│   │       └── globals.css
│   └── tests/
│
├── data/                                # Fixtures & benchmarks (minimal in early phases)
│   ├── fixtures/                        # Small, static test fixtures for unit tests
│   └── seed/                            # 10,000+ synthetic demo dataset (Phase 10)
│
└── scripts/                             # Utility & seeding scripts
    ├── seed-demo.ts                     # Populate database with realistic synthetic data (Phase 10)
    └── reset-demo.ts                    # Reset demo environment to clean baseline
```

---

## E. Technology Stack & Dependencies

- **Frontend**: Currently supported stable Next.js version compatible with React 19 (e.g. Next.js 15/16 stable), Tailwind CSS, Lucide React, Zod.
- **Backend**: Node.js, Express, TypeScript, Zod, CORS.
- **AI SDK**: Google Gen AI SDK (`@google/genai` or `@google/generative-ai`), accessed exclusively through `IAIProvider`.
- **Database & Storage**: Google Cloud Firestore (`@google-cloud/firestore` / `firebase-admin`), Google Cloud Storage (`@google-cloud/storage`).
- **Analytics**: BigQuery (`@google-cloud/bigquery`) with Firestore aggregation fallback.
- **Validation**: Zod (shared across frontend and backend).

---

## F. Provider Abstraction & DEMO_MODE Architecture

To prevent polluting domain/business logic with `if (DEMO_MODE)` branches, all infrastructure dependencies are decoupled through typed interfaces:

```text
               ┌───────────────────────────┐
               │    Domain / Application   │
               │         Services          │
               └─────────────┬─────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │IDatabaseProv │ │IStorageProv  │ │ IAIProvider  │
     └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                │                │
     ┌──────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐
     │Factory Inject│ │Factory Inject│ │Factory Inject│
     └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       /         \      /         \      /         \
     Real       Demo  Real       Demo  Real       Demo
```

- In `backend/src/providers/factory.ts`, instances of `IDatabaseProvider`, `IStorageProvider`, `IAIProvider`, and `IAnalyticsProvider` are initialized based on environment configuration (`PROVIDER_MODE=cloud` vs `PROVIDER_MODE=mock`).
- Business logic calls `aiProvider.extractSignal()`, `dbProvider.createProblemCluster()`, etc., completely unaware of whether the underlying target is live Google Cloud or the local mock provider.

---

## G. Embedding & Similarity Architecture

### 1. Vector Model
- Use Google's standard embedding model: `text-embedding-004` (768 dimensions) via the `IAIProvider.generateEmbedding(text: string): Promise<number[]>`.

### 2. Storage
- Embeddings are stored directly within Firestore documents as an array of floats:
  - `signals.embedding`: `number[]`
  - `problem_clusters.centroid_embedding`: `number[]`

### 3. Candidate Retrieval & Similarity Search (No External Vector DB)
- **Zero Third-Party Vector DB**: Pinecone, Weaviate, and Chroma are strictly forbidden to avoid external dependencies and configuration drift.
- **Filter-First Candidate Retrieval**: When a new signal is ingested:
  1. Retrieve recent candidate signals from Firestore matching the same `category` and within the target `ward_id` (or temporal window $\le 7$ days). This limits candidate volume to a manageable set (typically 10–200 items).
  2. Compute vector cosine similarity in memory across the candidates:
     $$\text{cosine\_similarity}(\mathbf{u}, \mathbf{v}) = \frac{\sum_{i=1}^n u_i v_i}{\sqrt{\sum_{i=1}^n u_i^2} \sqrt{\sum_{i=1}^n v_i^2}}$$
  3. Combine with geospatial Haversine distance, temporal decay, and category exact match into the composite relationship score:
     $$\text{Relationship Score} = 0.50 \times \text{Semantic} + 0.20 \times \text{Geo} + 0.15 \times \text{Temporal} + 0.10 \times \text{Category} + 0.05 \times \text{Visual}$$
  4. Compare against configurable thresholds:
     - $\ge 0.85$: Strong Duplicate
     - $0.70 - 0.84$: Related Candidate
     - $< 0.70$: Unrelated

---

## H. Golden Demo Determinism Strategy

To ensure that the hackathon demonstration is 100% reliable and reproducible before judges:

1. **Pre-Seeded Downstream Artifacts**:
   - The Golden Demo Scenario (Ward 18 Water Disruption) has deterministic, pre-seeded downstream data:
     - 327 related signals with known IDs (`sig_golden_001` through `sig_golden_327`).
     - Fixed Problem Cluster `P-WATER-018` ("Water Supply Disruption — Ward 18").
     - Fixed impact components: Severity 24/25, Population 18/20, Duration 14/15, Concentration 14/15, Facility Exposure 9/10, Recurrence 8/10, Evidence 5/5 $\implies$ Impact Score: **92 / 100 (CRITICAL)**.
     - Fixed resolution evidence photo and metadata.
     - Fixed verification outcome (91% confidence, `LIKELY_RESOLVED`).
2. **Live AI Demonstration**:
   - Live Gemini extraction is executed dynamically when the presenter submits a new report (e.g. in Odia: *"ଆମ ଅଞ୍ଚଳରେ ତିନି ଦିନ ହେଲା ପାଣି ଆସୁନାହିଁ"*).
   - The live report is extracted $\to$ matched to the existing Ward 18 cluster $\to$ increments signal count to 328 $\to$ confirms cluster priority.
   - Live Gemini Governance AI answers questions dynamically using grounded tools.
3. **No Flaky Demo Paths**: Core priority ranking and impact mathematics are deterministic, preventing live model hallucinations from breaking the primary judging flow.

---

## I. Phase-by-Phase Implementation Plan

### PHASE 0 — Foundation & Infrastructure
- **Prerequisites**: Clean repository with `.cursorrules` and `docs/`.
- **Files to Create / Modify**:
  - `package.json` (Root npm workspace manifest).
  - `tsconfig.base.json`, `.gitignore`, `.env.example`.
  - `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts`.
  - `shared/src/types/` (base enums: roles, statuses).
  - `shared/src/schemas/` (base validation schemas).
  - `backend/package.json`, `backend/tsconfig.json`, `backend/src/index.ts`, `backend/src/app.ts`.
  - `backend/src/middleware/error.middleware.ts`.
  - `backend/src/config/env.ts`.
  - `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.mjs`, `frontend/postcss.config.mjs`, `frontend/tailwind.config.ts`.
  - `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`, `frontend/src/styles/globals.css`.
- **Database Changes**: None.
- **API Changes**:
  - `GET /api/v1/health` $\implies$ returns `{ data: { status: "ok" } }`.
- **Frontend Changes**: Blank Next.js welcome/health check page with minimal styling.
- **AI Changes**: None.
- **Tests**:
  - Unit test for health check endpoint.
  - TypeScript compilation check across all packages (`npm.cmd run build`).
  - Linter check (`npm.cmd run lint`).
- **Browser Verification**:
  - Open `http://localhost:3000` $\implies$ page loads without console errors.
  - Open `http://localhost:5000/api/v1/health` $\implies$ returns `{ data: { status: "ok" } }`.
- **Acceptance Criteria**:
  - [ ] Root workspace configured with `shared`, `backend`, `frontend`.
  - [ ] `npm.cmd run lint` passes with zero errors.
  - [ ] `npm.cmd run test` passes.
  - [ ] `npm.cmd run build` completes successfully.
  - [ ] Backend runs on port 5000 and responds to `/api/v1/health`.
  - [ ] Frontend runs on port 3000.
  - [ ] No secrets committed.
- **Explicitly Excluded**: Citizen reporting, Gemini SDK integration, problem clustering, impact scoring, dashboard analytics, Governance AI, large seed datasets.

---

### PHASE 1 — Design System & Application Shells
- **Prerequisites**: Phase 0 complete and approved.
- **Files to Create / Modify**:
  - `frontend/src/styles/globals.css` (Civic color tokens, typography scales, spacing).
  - `frontend/src/components/ui/` (`Button`, `Input`, `Textarea`, `Select`, `Badge`, `Card`, `Dialog`, `Tabs`, `Toast`, `Tooltip`, `DataTable`, `Skeleton`, `EmptyState`, `ErrorState`).
  - `frontend/src/components/layout/` (`CitizenShell`, `GovernmentShell`, `OfficerShell`, `AdminShell`).
  - `frontend/src/app/login/page.tsx`.
  - `frontend/src/app/citizen/page.tsx`, `frontend/src/app/citizen/report/page.tsx`, `frontend/src/app/citizen/issues/page.tsx`.
  - `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/dashboard/problems/page.tsx`, `frontend/src/app/dashboard/map/page.tsx`, `frontend/src/app/dashboard/departments/page.tsx`, `frontend/src/app/dashboard/trends/page.tsx`, `frontend/src/app/dashboard/ai/page.tsx`.
  - `frontend/src/app/officer/page.tsx`.
  - `frontend/src/app/admin/page.tsx`.
- **Database Changes**: None.
- **API Changes**: None (UI routes render shell components and layout placeholders).
- **Frontend Changes**: Full responsive navigation structure and UI primitive library.
- **AI Changes**: None.
- **Tests**: Component rendering unit tests for UI primitives.
- **Browser Verification**:
  - Verify all 4 application shells across Desktop (1440px), Tablet (768px), and Mobile (375px) viewports.
  - Verify empty states, loading skeletons, and error state components.
- **Acceptance Criteria**:
  - [ ] Restrained civic design system implemented (no neon, no glowing cards).
  - [ ] Responsive navigation works across all routes.
  - [ ] Accessible focus states and keyboard navigation functional.
- **Explicitly Excluded**: Real database fetching, AI processing, form submissions.

---

### PHASE 2 — Citizen Signal Intake
- **Prerequisites**: Phase 1 complete and approved.
- **Files to Create / Modify**:
  - `shared/src/types/signal.ts`, `shared/src/schemas/signal.schema.ts`.
  - `backend/src/providers/database/` (Firestore & Mock signal CRUD operations).
  - `backend/src/providers/storage/` (Cloud Storage signed URL & Local file adapter).
  - `backend/src/modules/signals/` (`signal.controller.ts`, `signal.service.ts`, `signal.repository.ts`, `signal.routes.ts`).
  - `backend/src/modules/auth/` (`auth.controller.ts`, `auth.service.ts`).
  - `frontend/src/app/citizen/report/page.tsx` (Report form with describe, photo upload, location).
  - `frontend/src/app/citizen/issues/page.tsx` (My Reports list).
  - `frontend/src/lib/api-client.ts`.
- **Database Changes**:
  - Initialize Firestore collections: `/users`, `/citizen_profiles`, `/signals`, `/signal_media`.
- **API Changes**:
  - `GET /api/v1/auth/me`
  - `POST /api/v1/signals` (Persists signal with `processing_status: PENDING`).
  - `GET /api/v1/signals/:id`
  - `GET /api/v1/me/signals`
  - `POST /api/v1/signals/:id/media` (Generates upload URL).
- **Frontend Changes**:
  - Mobile-first 3-step report workflow (Describe -> Photo/Location -> Confirmation).
  - Citizen report history tracking page.
- **AI Changes**: None (signal stored as `PENDING` awaiting Phase 3 processing).
- **Tests**:
  - Payload validation tests (Zod schema checking for required fields, max text limits).
  - RBAC security test: Citizen cannot read another citizen's private report.
- **Browser Verification**:
  - Submit report via browser on mobile viewport $\implies$ verify signal is created and visible in My Reports.
- **Acceptance Criteria**:
  - [ ] Citizen can submit a signal with text, photo, and coordinates.
  - [ ] Signal persists in database with `PENDING` processing status.
  - [ ] Citizen sees confirmation and can view past reports.
- **Explicitly Excluded**: Gemini AI extraction, clustering, impact scoring.

---

### PHASE 3 — AI Intelligence Pipeline
- **Prerequisites**: Phase 2 complete and approved.
- **Files to Create / Modify**:
  - `backend/src/providers/ai/` (`ai.interface.ts`, `gemini.provider.ts`, `mock.ai.ts`).
  - `backend/src/infrastructure/gemini/prompts/signal_understanding_v1.ts`.
  - `backend/src/infrastructure/gemini/prompts/classification_v1.ts`.
  - `shared/src/schemas/ai.schema.ts`.
  - `backend/src/modules/signals/signal-ai.service.ts`.
  - `frontend/src/components/citizen/SignalAIPreview.tsx`.
- **Database Changes**:
  - Add collection: `/ai_operations`.
  - Extend `/signals` with AI fields: `normalized_text`, `language`, `category`, `subcategory`, `severity`, `department_id`, `ai_confidence`.
- **API Changes**:
  - `POST /api/v1/signals/:id/analyze`
  - `GET /api/v1/ai/operations/:id`
- **Frontend Changes**:
  - AI Preview card in citizen report flow: shows what was understood before final submission.
- **AI Changes**:
  - Multilingual extraction (English, Hindi, Odia).
  - Issue classification into central taxonomy.
  - Severity estimation and department recommendation.
  - Structured schema enforcement and bounded retries.
- **Tests**:
  - Prompt injection test: ensuring malicious user text does not break extraction.
  - Schema fallback test: handling malformed model output gracefully.
- **Browser Verification**:
  - Submit Odia/Hindi text $\implies$ verify structured English category and normalized summary display in UI.
- **Acceptance Criteria**:
  - [ ] Gemini extracts category, severity, duration, and department.
  - [ ] Output is validated against Zod schema.
  - [ ] AI operation metadata logged.
  - [ ] Graceful fallback on AI failure.
- **Explicitly Excluded**: Problem clustering, impact scoring formula.

---

### PHASE 4 — Problem Clustering & Impact Intelligence
- **Prerequisites**: Phase 3 complete and approved.
- **Files to Create / Modify**:
  - `shared/src/types/problem.ts`, `shared/src/constants/impact.ts`.
  - `backend/src/modules/clustering/` (`clustering.service.ts`, `similarity.math.ts`).
  - `backend/src/modules/impact/` (`impact.service.ts`).
  - `backend/src/modules/problems/` (`problem.controller.ts`, `problem.service.ts`, `problem.repository.ts`).
  - `frontend/src/components/problems/` (`ProblemCard.tsx`, `ImpactScoreBar.tsx`, `ImpactBreakdown.tsx`).
- **Database Changes**:
  - Add collections: `/problem_clusters`, `/problem_cluster_members`.
- **API Changes**:
  - `GET /api/v1/problems`
  - `GET /api/v1/problems/:id`
  - `GET /api/v1/problems/:id/details`
  - `POST /api/v1/problems/:id/recalculate-impact`
- **Frontend Changes**:
  - Problem card with 0–100 impact bar.
  - "Why this is high impact" factor breakdown.
- **AI Changes**:
  - Text embedding generation (`text-embedding-004` via `IAIProvider`).
  - Gemini cluster summary generation (`cluster_summary_v1`).
- **Tests**:
  - Unit tests for deterministic impact formula (checking all 7 components and weights).
  - Cosine similarity and Haversine distance unit tests.
- **Browser Verification**:
  - View problem detail page $\implies$ verify impact components sum to final score.
- **Acceptance Criteria**:
  - [ ] Related signals clustered into problem clusters.
  - [ ] Authoritative impact score calculated deterministically (0–100).
  - [ ] Original signals preserved.
  - [ ] Clear explainability UI shown.
- **Explicitly Excluded**: Full government dashboard, department assignments, resolution verification.

---

### PHASE 5 — Government Operations & Workflows
- **Prerequisites**: Phase 4 complete and approved.
- **Files to Create / Modify**:
  - `backend/src/modules/assignments/` (`assignment.service.ts`, `assignment.controller.ts`).
  - `backend/src/modules/problems/problem-lifecycle.service.ts`.
  - `backend/src/modules/analytics/` (`dashboard.service.ts`, `dashboard.controller.ts`).
  - `frontend/src/app/dashboard/page.tsx` (KPI strip, Priority Problems list, Heatmap).
  - `frontend/src/app/dashboard/map/page.tsx` (Map with cluster markers).
  - `frontend/src/app/officer/page.tsx` (Officer assigned queue).
  - `frontend/src/components/maps/ProblemMap.tsx`.
- **Database Changes**:
  - Add collections: `/departments`, `/wards`, `/assignments`, `/actions`.
- **API Changes**:
  - `GET /api/v1/dashboard/overview`
  - `GET /api/v1/dashboard/priority-problems`
  - `GET /api/v1/dashboard/map`
  - `GET /api/v1/dashboard/departments`
  - `GET /api/v1/dashboard/sla-risk`
  - `POST /api/v1/problems/:id/assign`
  - `POST /api/v1/problems/:id/actions`
  - `GET /api/v1/problems/:id/timeline`
- **Frontend Changes**:
  - Executive dashboard with KPI cards and prioritized problem list.
  - Map view with cluster markers and category filters.
  - Officer worklist with direct action triggers.
- **AI Changes**: None.
- **Tests**:
  - State machine transition tests (preventing illegal transitions).
  - SLA countdown calculation tests.
- **Browser Verification**:
  - Assign problem to officer $\implies$ verify problem appears in `/officer` workspace with correct priority.
- **Acceptance Criteria**:
  - [ ] Government dashboard renders real metrics.
  - [ ] Map renders problem clusters with filtering.
  - [ ] Department officer can assign work.
  - [ ] Lifecycle transitions enforce RBAC.
- **Explicitly Excluded**: Resolution evidence upload, AI verification, Governance AI assistant.

---

### PHASE 6 — Resolution & AI Verification
- **Prerequisites**: Phase 5 complete and approved.
- **Files to Create / Modify**:
  - `shared/src/types/evidence.ts`.
  - `backend/src/modules/resolutions/` (`resolution.controller.ts`, `resolution.service.ts`).
  - `backend/src/modules/verification/` (`verification.service.ts`).
  - `backend/src/infrastructure/gemini/prompts/resolution_verification_v1.ts`.
  - `frontend/src/components/problems/ResolutionEvidenceUpload.tsx`.
  - `frontend/src/components/problems/VerificationResultCard.tsx`.
- **Database Changes**:
  - Add collections: `/resolution_evidence`, `/verification_results`.
- **API Changes**:
  - `POST /api/v1/problems/:id/resolution-evidence`
  - `POST /api/v1/resolution-evidence/:id/verify`
  - `GET /api/v1/resolution-evidence/:id/verification`
- **Frontend Changes**:
  - Officer resolution upload form (image + field note).
  - Verification review card displaying status, confidence, observations, limitations, and human review toggle.
- **AI Changes**:
  - Multimodal Gemini prompt comparing problem description with resolution image.
  - Generates assessment without autonomously closing ticket.
- **Tests**:
  - Verification schema validation test.
  - Workflow rule test: resolution submission requires evidence before moving to `AWAITING_VERIFICATION`.
- **Browser Verification**:
  - Upload resolution evidence as Officer $\implies$ trigger verification $\implies$ review assessment card $\implies$ approve and verify problem status moves to `RESOLVED`.
- **Acceptance Criteria**:
  - [ ] Officer can submit resolution photo & notes.
  - [ ] Gemini analyzes evidence and outputs structured assessment.
  - [ ] Human review required before closure.
- **Explicitly Excluded**: Governance AI natural-language assistant.

---

### PHASE 7 — Governance AI & Administrative Intelligence
- **Prerequisites**: Phase 6 complete and approved.
- **Files to Create / Modify**:
  - `backend/src/modules/governance/` (`governance.controller.ts`, `governance.service.ts`, `governance-tools.ts`).
  - `backend/src/infrastructure/gemini/prompts/governance_query_v1.ts`.
  - `backend/src/infrastructure/gemini/prompts/governance_brief_v1.ts`.
  - `frontend/src/app/dashboard/ai/page.tsx` (Governance AI analytical workspace).
  - `frontend/src/components/dashboard/AIBrief.tsx`.
- **Database Changes**:
  - Add collection: `/ai_insights`.
- **API Changes**:
  - `POST /api/v1/governance/query`
- **Frontend Changes**:
  - Governance AI query page with suggested questions, response card, supporting metrics, and evidence citations.
  - Executive AI Brief widget on dashboard overview.
- **AI Changes**:
  - Two-stage grounded retrieval: Intent detection $\to$ Allowlisted analytical tool execution $\to$ Gemini explanation.
  - Zero arbitrary SQL. Cites specific problem IDs and metrics.
- **Tests**:
  - Security test: ensuring prompt injection cannot access unauthorized private records.
  - Tool allowlist test: rejecting unregistered tool invocations.
- **Browser Verification**:
  - Ask: *"Which wards currently have the highest unresolved impact?"* $\implies$ verify response identifies Ward 18 with supporting metrics.
- **Acceptance Criteria**:
  - [ ] Governance AI operates strictly via allowlisted tools.
  - [ ] Answers include grounded evidence and citations.
  - [ ] AI Brief appears on executive dashboard.
- **Explicitly Excluded**: Intervention budget simulator (P2).

---

### PHASE 8 — Intervention Simulator (P2 Enhancement)
- **Prerequisites**: Phase 7 complete and approved. Built only if time permits.
- **Files to Create / Modify**:
  - `backend/src/modules/simulator/` (`simulator.service.ts`, `simulator.controller.ts`).
  - `frontend/src/app/dashboard/simulator/page.tsx`.
- **Database Changes**: None.
- **API Changes**:
  - `POST /api/v1/dashboard/simulate`
- **Frontend Changes**:
  - Budget input slider ($\text{₹}$ amount) with estimated impact reduction breakdown.
  - Prominent badge: `[SIMULATION / ADVISORY]`.
- **AI Changes**:
  - Explanatory synthesis of allocation trade-offs.
- **Tests**: Mathematical scenario validation.
- **Browser Verification**: Run $\text{₹}10\text{L}$ scenario $\implies$ verify clear advisory labeling.
- **Acceptance Criteria**:
  - [ ] Budget input produces explainable allocation model.
  - [ ] No financial transactions executed.
- **Explicitly Excluded**: Automated procurement.

---

### PHASE 9 — Security Hardening, Performance & E2E Testing
- **Prerequisites**: Core workflows (Phases 0–7) complete.
- **Files to Create / Modify**:
  - `backend/src/middleware/rate-limit.middleware.ts`.
  - `backend/src/middleware/security-headers.middleware.ts`.
  - `backend/src/modules/audit/audit.service.ts`.
  - `backend/tests/security/` (Privilege escalation, Prompt injection, File upload bounds).
- **Database Changes**:
  - Verify Firestore composite indexes via `firestore.indexes.json`.
- **API Changes**:
  - Rate limiting active on `/signals` and `/governance/query`.
- **Frontend Changes**:
  - Security headers configured in `next.config.mjs`.
- **AI Changes**:
  - Context size bounding and timeout enforcement.
- **Tests**:
  - Full suite of security and penetration tests.
  - End-to-end integration tests for the core product loop.
- **Browser Verification**:
  - Verify unauthorized URL direct navigation redirects to login.
  - Verify console is clean of errors across all screens.
- **Acceptance Criteria**:
  - [ ] Rate limiting functional.
  - [ ] All administrative mutations produce audit logs.
  - [ ] Critical security tests pass.
- **Explicitly Excluded**: Unnecessary enterprise security features.

---

### PHASE 10 — Golden Demo Seeding, Deployment & Final Polish
- **Prerequisites**: Phase 9 complete.
- **Files to Create / Modify**:
  - `data/seed/` (`wards.json`, `departments.json`, `golden_ward18.json`, `synthetic_signals.json`).
  - `scripts/seed-demo.ts`, `scripts/reset-demo.ts`.
  - `frontend/src/components/ui/DemoEnvironmentBanner.tsx`.
  - Root `README.md`.
- **Database Changes**:
  - Populate 15 wards, 8 departments, 500+ clusters, 10,000+ synthetic signals, and the Golden Ward 18 scenario.
- **API Changes**:
  - `POST /api/v1/admin/reset-demo` (Development/demo mode only).
- **Frontend Changes**:
  - Subtle persistent indicator: `[DEMO ENVIRONMENT — SYNTHETIC CIVIC DATA]`.
  - Fast demo role switcher for judging presentations.
- **AI Changes**:
  - Fine-tuned prompt formatting and latency verification.
- **Tests**:
  - Full automated regression test suite.
- **Browser Verification**:
  - Execute full 3-minute judging script end-to-end.
- **Acceptance Criteria**:
  - [ ] `npm.cmd run seed:demo` populates reproducible dataset.
  - [ ] Golden Demo scenario executes flawlessly.
  - [ ] Production build succeeds cleanly.
  - [ ] Ready for presentation.
- **Explicitly Excluded**: Real-world external system connectors.

---

## J. Phase Dependency Graph

```text
Phase 0: Foundation & Infrastructure
  │
  ▼
Phase 1: Design System & Application Shells
  │
  ▼
Phase 2: Citizen Signal Intake
  │
  ▼
Phase 3: AI Intelligence Pipeline
  │
  ▼
Phase 4: Problem Clustering & Impact Intelligence
  │
  ▼
Phase 5: Government Operations & Workflows
  │
  ▼
Phase 6: Resolution & AI Verification
  │
  ▼
Phase 7: Governance AI & Administrative Intelligence
  │
  ├─────────────────────────────────────────┐
  ▼                                         ▼
Phase 9: Security, Performance & E2E   Phase 8: Intervention Simulator (Optional P2)
  │
  ▼
Phase 10: Golden Demo Seeding, Deployment & Final Polish
```

---

## K. Testing & Verification Summary

| Phase | Automated Check | Browser / Manual Check | Scope Exclusions |
| :--- | :--- | :--- | :--- |
| **Phase 0** | `npm.cmd run lint`, `npm.cmd run test`, `npm.cmd run build` | Frontend on `:3000`, `/api/v1/health` on `:5000` | No AI, no reporting, no DB models |
| **Phase 1** | Component unit tests | Layouts at 1440px, 768px, 375px; state components | No real data fetching |
| **Phase 2** | Payload validation & RBAC unit tests | Mobile report submission $\to$ My Reports | No Gemini extraction |
| **Phase 3** | Prompt injection & schema fallback tests | Odia/Hindi submission $\to$ AI Preview card | No clustering or impact score |
| **Phase 4** | Impact formula math & similarity unit tests | Problem detail impact breakdown (0–100) | No officer assignments |
| **Phase 5** | State transition state machine & SLA tests | Assign problem $\to$ appears in `/officer` queue | No resolution verification |
| **Phase 6** | Resolution workflow & schema tests | Officer upload $\to$ AI assessment card $\to$ resolve | No Governance AI Q&A |
| **Phase 7** | Tool allowlist & grounding tests | Query: *"Wards with highest impact"* $\to$ Ward 18 | No budget simulator |
| **Phase 8** | Simulation mathematical scenario tests | Advisory slider and badge check | Optional P2 only |
| **Phase 9** | Security penetration & rate limit tests | Auth redirects, rate throttling | None |
| **Phase 10**| Full test suite regression | Rehearse complete 3-minute judging flow | None |

---

## L. Final Decisions & Non-Negotiables

1. **Architecture**: Modular monolith with npm workspaces (`shared`, `backend`, `frontend`). No microservices.
2. **Next.js Version**: Currently supported stable Next.js version compatible with React 19 and dependencies.
3. **Infrastructure Isolation**: `IDatabaseProvider`, `IStorageProvider`, `IAIProvider`, and `IAnalyticsProvider` isolate Google Cloud vs local demo mock implementations. No `if (DEMO_MODE)` in domain logic.
4. **Golden Demo Reproducibility**: Ward 18 scenario uses deterministic seeded downstream data (impact score 92, known resolution verification state) so the demo is guaranteed not to fail due to random model drift.
5. **Phase Discipline**: Strictly one phase at a time. Phase 0 must be completed, verified, and reviewed before Phase 1 begins.
