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

- Use Google's standard embedding model: `gemini-embedding-001` (1536 dimensions) via the `IAIProvider.generateEmbedding(text: string): Promise<number[]>`. (Note: `text-embedding-004` is deprecated/unsupported in v1beta).

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
  - `shared/src/types/signal.ts`, `shared/src/schemas/index.ts`.
  - `backend/src/providers/database/` (`database.interface.ts`, `mock.database.ts`, `firestore.provider.ts`).
  - `backend/src/providers/storage/` (`storage.interface.ts`, `local.storage.ts`, `gcs.storage.ts`).
  - `backend/src/middleware/` (`auth.middleware.ts`, `rbac.middleware.ts`).
  - `backend/src/modules/signals/` (`signal.controller.ts`, `signal.service.ts`, `signal.repository.ts`, `signal.routes.ts`).
  - `backend/src/modules/auth/` (`auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`).
  - `frontend/src/app/citizen/report/page.tsx` (Report form with describe, photo upload, location).
  - `frontend/src/app/citizen/issues/page.tsx` (My Reports list).
  - `frontend/src/app/login/page.tsx` (Persona switcher updating active token).
  - `frontend/src/lib/api-client.ts`.
  - `frontend/next.config.mjs` (Proxy `/api/v1/:path*` to backend port 5000).
- **Database Changes**:
  - Initialize operational collections: `/users`, `/citizen_profiles`, `/signals`, `/signal_media`.
  - Fixtures restricted to minimal demo data (1 demo citizen `usr_citizen_01`, 1 demo officer `usr_officer_01`, 1 demo admin, 2–3 citizen history signals, 1 isolated signal for `usr_citizen_02` to test isolation). No large seed dataset.
- **API Changes & Invariants**:
  - `GET /api/v1/auth/me` (Returns authenticated user profile and citizen preferences).
  - `POST /api/v1/auth/switch-demo-persona` (Strictly demo-only helper; disabled with 404/403 when `DEMO_MODE=false`).
  - `POST /api/v1/signals` (Persists signal with `processing_status: PENDING`. Binary image data is strictly excluded; media is linked via registered IDs).
  - `GET /api/v1/signals/:id` (Enforces server-side authorization scope: Citizen can only read own signal; Field Officer only assigned/problem signals; Department Officer only department scope; Admin broader access).
  - `GET /api/v1/signals` (Enforces server-side scope: Citizen automatically scoped to own signals; never allow passing another user's ID to retrieve their data).
  - `GET /api/v1/me/signals` (Returns authenticated citizen's signals).
  - `POST /api/v1/signals/:id/media` (Registers media with 10 MB limit and generates signed upload URL or local upload target).
  - `GET /api/v1/signals/:id/media` (Returns authorized media metadata).
- **Frontend Changes**:
  - Mobile-first report workflow:
    - Step 1: Text description (3–5000 chars) with live counter.
    - Step 2: Media upload workflow (Create signal -> Register media with 10 MB cap -> Upload file -> Persist metadata).
    - Step 3: Location selection (Prefers browser geolocation `navigator.geolocation` or explicit dropdown selection; Ward 18 Nayapalli default only when `DEMO_MODE=true`; never fabricates coordinates).
    - Step 4: Live confirmation showing assigned `#SIG-...` reference and pending status.
  - Citizen report history tracking page (`/citizen/issues`) fetching from `GET /api/v1/me/signals`.
- **AI Changes**: None (signal stored as `PENDING` awaiting Phase 3 processing).
- **Tests**:
  - Payload validation tests (Zod schema checking text bounds, 10 MB image size limit, supported MIME types).
  - Server-side read authorization test: Citizen cannot read another citizen's private signal or retrieve their signal list.
  - Demo endpoint guard test: `POST /api/v1/auth/switch-demo-persona` returns error when `DEMO_MODE=false`.
  - Media workflow test: Signal creation followed by media registration and association.
- **Browser Verification**:
  - Authenticate as Citizen on mobile viewport $\implies$ submit report with text, 10 MB-compliant photo, and location $\implies$ verify signal is created with `PENDING` status and visible in My Reports history.
- **Acceptance Criteria**:
  - [ ] Citizen can authenticate via demo persona.
  - [ ] Citizen can submit a signal with text, photo via storage provider, and valid coordinates.
  - [ ] Server enforces 10 MB media limit and rejects binary payloads in signal creation.
  - [ ] Signal persists in database with `PENDING` processing status.
  - [ ] Server enforces read authorization (Citizens cannot read other citizens' signals).
  - [ ] Location defaults to Ward 18 only when `DEMO_MODE=true`, otherwise browser GPS or explicit ward.
  - [ ] Demo persona switcher disabled when `DEMO_MODE=false`.
  - [ ] Citizen sees confirmation and can view past reports.
- **Explicitly Excluded**: Gemini AI extraction, embeddings, clustering, impact scoring, department assignment, resolution verification, Governance AI, large 10k dataset.

---

### PHASE 3 — AI Intelligence Pipeline (Gemini Intelligence Layer)
- **Prerequisites**: Phase 2 complete and approved.
- **Files to Create / Modify**:
  - `shared/src/types/ai.ts`, `shared/src/schemas/index.ts`.
  - `backend/src/providers/ai/` (`ai.interface.ts`, `mock.ai.ts`, `gemini.provider.ts`).
  - `backend/src/providers/database/` (`database.interface.ts`, `mock.database.ts`, `firestore.provider.ts`).
  - `backend/src/providers/index.ts` (Register `getAIProvider`).
  - `backend/src/infrastructure/ai/prompts/signal_understanding_v1.ts`.
  - `backend/src/modules/signals/signal-ai.service.ts`.
  - `backend/src/modules/signals/signal.controller.ts`, `backend/src/modules/signals/signal.routes.ts`.
  - `frontend/src/components/citizen/SignalAIPreview.tsx`.
  - `frontend/src/app/citizen/report/page.tsx`, `frontend/src/app/citizen/issues/page.tsx`.
- **Database Changes**:
  - Add collection: `/ai_operations` (tracking operation type, model, prompt version, status, confidence, latency, and errors).
  - Extend `/signals` with AI-derived intelligence fields: `normalized_text`, `language`, `category`, `subcategory`, `severity`, `department_id`, `ai_confidence`.
- **API Changes**:
  - `POST /api/v1/signals/:id/analyze` (Invokes AI pipeline; strictly scoped so Citizens can only analyze own signals).
  - `GET /api/v1/signals/:id/ai` (Returns structured AI intelligence and operation audit trail for authorized callers).
- **AI Scope & Structured Contracts**:
  - Centralized `IAIProvider` interface with `analyzeSignal(input: SignalAnalysisInput): Promise<SignalAnalysisOutput>`.
  - Structured output schema (`SignalAnalysisOutputSchema`) covering:
    - `detected_language` (e.g. `en`, `hi`, `od`)
    - `normalized_summary` (concise plain-language issue summary)
    - `category` (constrained strictly to canonical `CIVIC_CATEGORIES`)
    - `subcategory`
    - `severity` (`UNKNOWN`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
    - `urgency` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
    - `affected_scope`
    - `recommended_department` (advisory routing suggestion only)
    - `confidence` (0.0 to 1.0)
    - `explanation` (transparent reasoning for UI inspection)
    - `image_findings` (observable image findings when media exists)
  - Configurable model selection (`AI_MODEL_GENERAL`, default `gemini-2.5-flash`).
  - Bounded retries (3 attempts with exponential backoff) and timeouts.
  - Prompt injection defense: all citizen input treated as untrusted data wrapped in strict delimiters.
  - Deterministic `MockAIProvider` for demo mode operating without external credentials.
- **Frontend Changes**:
  - Dynamic AI Comprehension Card on `/citizen/report` and `/citizen/issues` displaying normalized summary, detected category, severity badge, and transparent AI reasoning.
  - Never calls Gemini directly from client.
- **Tests**:
  - Successful AI analysis and structured extraction.
  - Schema validation and malformed model output rejection.
  - Missing required fields validation.
  - Low-confidence output handling (`requires_review = true`).
  - Safe error handling on provider failure (`processing_status: FAILED`, preserving original signal).
  - Timeout and retry behavior.
  - Signal read and analyze authorization scoping (preventing Citizen A from analyzing Citizen B's signal).
  - Deterministic output in demo mode across English, Hindi, and Odia samples.
  - Lifecycle state transitions (`PENDING` $\to$ `PROCESSING` $\to$ `COMPLETED`).
- **Browser Verification**:
  - Submit citizen signal $\implies$ trigger/await AI analysis $\implies$ verify structured categories, normalized summary, and confidence render cleanly on `/citizen/report` and `/citizen/issues`.
- **Acceptance Criteria**:
  - [x] Unstructured citizen text converted into structured, validated intelligence.
  - [x] Canonical taxonomy and departments preserved without duplication.
  - [x] AI operation metadata logged to `/ai_operations`.
  - [x] Safe fallback on AI failure without losing original citizen data.
  - [x] Frontend access to Gemini strictly blocked (server-side only).
  - [x] Department recommendation stored in advisory `recommended_department`, leaving authoritative `department_id` unwritten.
  - [x] DEMO_MODE=true uses MockAIProvider, DEMO_MODE=false uses GeminiAIProvider with strict error on missing credentials (no silent fallback).
  - [x] Decoupled pipeline: POST /api/v1/signals creates PENDING signal; POST /api/v1/signals/:id/analyze explicitly processes it.

- **Strictly Out of Scope**: Embeddings, duplicate detection, semantic similarity, problem clustering, impact score calculation, public-problem ranking, department assignment workflow, officer action workflow, resolution verification, Governance AI, intervention simulator, large synthetic datasets.

---

### PHASE 4 — Problem Clustering & Impact Intelligence
- **Prerequisites**: Phase 3 complete and approved.
- **Files to Create / Modify**:
  - `shared/src/types/problem.ts`, `shared/src/constants/impact.ts`, `shared/src/schemas/index.ts`.
  - `backend/src/config/env.ts` (Configurable `AI_EMBEDDING_MODEL`).
  - `backend/src/providers/ai/` (`ai.interface.ts`, `mock.ai.ts`, `gemini.provider.ts`).
  - `backend/src/providers/database/` (`database.interface.ts`, `mock.database.ts`, `firestore.provider.ts`).
  - `backend/src/modules/clustering/` (`clustering.service.ts`, `similarity.math.ts`).
  - `backend/src/modules/impact/` (`impact.service.ts`).
  - `backend/src/modules/problems/` (`problem.controller.ts`, `problem.service.ts`, `problem.repository.ts`, `problem.routes.ts`).
  - `frontend/src/app/dashboard/problems/page.tsx`, `frontend/src/app/dashboard/problems/[id]/page.tsx`.
  - `frontend/src/components/domain/` (`ProblemCard.tsx`, `ProblemList.tsx`, `ImpactBreakdown.tsx`, `ImpactScore.tsx`).
- **Database Changes**:
  - Add operational collections: `/problem_clusters`, `/problem_cluster_members`.
  - Fixtures & Golden Demo Data Size:
    - Pre-seed Golden Demo cluster `PRB-2026-0819` ("Water Supply Disruption — Nayapalli Ward 18").
    - Aggregate metadata reflects 327 related signals and 42 images, clearly labeled as synthetic/demo data.
    - Only a small representative set of actual signal/member records (3–5 signals including `sig_1001`) are persisted in Phase 4.
    - Full 327-signal individual dataset generation is explicitly deferred to Phase 10.
    - Pre-seed 3 secondary ranked clusters to demonstrate multi-issue prioritization (`PRB-2026-0820` Drainage 86, `PRB-2026-0821` Roads 81, `PRB-2026-0822` Sanitation 77).
- **API Changes & Invariants**:
  - `GET /api/v1/problems` (List problem clusters sorted by `impact_score DESC, updated_at DESC`, with filtering by ward, category, status, and impact level).
  - `GET /api/v1/problems/:id` (Retrieve problem cluster detail).
  - `GET /api/v1/problems/:id/details` (Extended details with impact factors, member signals, and timeline).
  - `GET /api/v1/problems/:id/signals` (Paginated member signals with similarity score and relationship metadata).
  - `POST /api/v1/problems` (Create problem cluster. **Authorization**: Ordinary citizens are strictly forbidden from creating official government clusters; restricted to authorized system clustering pipeline and `ADMIN`, `SYSTEM_ADMIN`, `DEPARTMENT_OFFICER`).
  - `POST /api/v1/problems/:id/recalculate-impact` (**Security**: Accepts NO client-controlled impact components in request body. Server strictly derives all 7 factors from authoritative stored records).
  - `POST /api/v1/problems/:id/cluster-signal` (Explicit operation evaluating a signal against clusters and attaching or forming a new cluster).
- **Embedding & Similarity Specification**:
  - Embedding model configurable via `AI_EMBEDDING_MODEL` (canonical default `gemini-embedding-001`, 1536 dimensions).
  - Provider abstraction: `IAIProvider.generateEmbedding(text: string): Promise<number[]>`.
  - Embeddings are computed and used server-side only; never exposed to frontend clients.
  - Filter-first candidate retrieval: Pre-filters by category and ward/proximity before computing vector cosine similarity.
- **Deterministic Relationship Score (0–1)**:
  - Strict separation: `relationship_score` (0–1) determines whether signals are duplicate/related/supporting; `impact_score` (0–100) determines public problem urgency.
  - Formula:
    - Semantic Similarity $\times$ 0.50 (`SEMANTIC_WEIGHT`)
    - Geographic Proximity $\times$ 0.20 (`SPATIAL_WEIGHT`, distance decay)
    - Temporal Proximity $\times$ 0.15 (`TEMPORAL_WEIGHT`, time decay)
    - Category Match $\times$ 0.10 (`CATEGORY_WEIGHT`)
    - Evidence / Visual Match $\times$ 0.05 (`EVIDENCE_WEIGHT`)
  - Thresholds:
    - $\ge 0.85 \implies$ `DUPLICATE`
    - $0.70 - 0.84 \implies$ `RELATED`
    - $< 0.70 \implies$ Unrelated (not linked)
  - Original citizen signals preserved without deletion or mutation.
- **Deterministic 7-Factor Impact Scoring (0–100)**:
  - Calculated strictly by application logic, never determined or altered by LLM.
  - Canonical formula:
    - Severity: 25% (Max 25)
    - Population Affected: 20% (Max 20)
    - Duration: 15% (Max 15)
    - Complaint Concentration: 15% (Max 15)
    - Critical Facility Exposure: 10% (Max 10)
    - Recurrence: 10% (Max 10)
    - Evidence Confidence: 5% (Max 5)
    - Total = 100%
  - Thresholds: 0–39 LOW, 40–64 MEDIUM, 65–84 HIGH, 85–100 CRITICAL.
  - Golden Demo input factors:
    - Severity: 24/25
    - Population: 18/20
    - Duration: 14/15
    - Concentration: 14/15
    - Critical Exposure: 9/10
    - Recurrence: 8/10
    - Evidence: 5/5
    - $\implies$ Calculated total: 92/100 (CRITICAL).
- **Frontend Changes**:
  - Problem directory (`/dashboard/problems`) displays ranked public problems with 0–100 impact score bars.
  - Problem detail (`/dashboard/problems/[id]`) renders live 7-factor Impact Breakdown, component scores, member signals list, and explainability text.
  - Includes secure "Recalculate Impact" button triggering server-side recomputation.
- **AI Changes**:
  - Text embedding generation behind `IAIProvider`.
  - Cluster summarization and impact explanation assistance (textual rationale only, never the numeric score).
- **Tests**:
  - Cosine similarity and Haversine distance arithmetic.
  - Composite relationship score and duplicate thresholding.
  - Deterministic 7-factor impact formula verifying all components, weights, and sum to 100.
  - Score boundary conditions (0 min, 100 max, 39/40/64/65/84/85 threshold crossings).
  - Problem creation authorization: Citizen gets 403 Forbidden; Admin/Officer succeeds.
  - Impact recalculation security: Ignores request body payload and computes strictly from stored data.
  - Preservation of original citizen signals upon cluster attachment.
  - Demo-mode deterministic results for Golden Demo scenario.
- **Browser Verification**:
  - Signals $\to$ Related Signals $\to$ Cluster $\to$ Impact Breakdown $\to$ Ranked Public Problem directory.
- **Acceptance Criteria**:
  - [ ] Embeddings generated via `IAIProvider` with configurable `AI_EMBEDDING_MODEL` (not exposed to frontend).
  - [ ] Filter-first candidate retrieval implemented before similarity comparison.
  - [ ] Explicit deterministic relationship score (0–1) separates signal linking from impact score.
  - [ ] Original signals preserved without mutation upon cluster attachment.
  - [ ] Problem clusters created with explicit authorization (Citizens blocked from creating official clusters).
  - [ ] Deterministic 7-factor impact score (0–100) calculated by server logic with canonical weights and thresholds.
  - [ ] Recalculate impact endpoint accepts no client-controlled factors.
  - [ ] Golden Demo scenario calculates 92/100 CRITICAL from factor inputs with small representative dataset.
  - [ ] Problem directory renders ranked problems by impact score.
  - [ ] Problem detail renders 7-factor breakdown and member signals.
- **Strictly Out of Scope**: Phase 5 department assignments and officer workflows, Phase 6 resolution verification, Phase 7 Governance AI, large 327-signal individual synthetic dataset (deferred to Phase 10).


---

### PHASE 5 — Government Operations & Workflows (Revised)
- **Prerequisites**: Phase 4 complete and approved.
- **Key Architectural Corrections & Enforcements**:
  1. **Deterministic SLA Calculation**:
     - Standard deterministic target hours:
       - `CRITICAL` = 24 hours
       - `HIGH` = 48 hours
       - `MEDIUM` = 120 hours
       - `LOW` = 240 hours
     - SLA computation must always produce **exactly one `target_hours` value** (no ambiguous ranges, no LLM involvement).
     - Deterministic arithmetic:
       - `due_at = assigned_at + target_hours`
       - `hours_elapsed = (now - assigned_at) / 3600000`
       - `hours_remaining = (due_at - now) / 3600000`
     - Status evaluation:
       - `BREACHED` if `hours_remaining <= 0`
       - `AT_RISK` if `hours_remaining <= 0.25 * target_hours`
       - `ON_TRACK` otherwise (or `MET` if problem is `RESOLVED` or `CLOSED`)
  2. **Field Officer vs Department Officer Authorization Scope**:
     - **FIELD_OFFICER**:
       - May view operational problems **only when `assigned_to === user.id`**.
       - May act **only on explicitly assigned problems**.
       - **Must not gain access merely because a problem belongs to their department**.
     - **DEPARTMENT_OFFICER**:
       - May view problems belonging to their authorized `department_id` scope.
       - May assign and reassign problems according to role permissions.
     - **ADMIN / SYSTEM_ADMIN**:
       - Authorized for broad cross-department oversight, global triage, and assignment.
     - **CITIZEN**:
       - Strictly forbidden from creating assignments, updating problem lifecycle statuses, or recording official government actions (`403 Forbidden`).
  3. **Complete Canonical Lifecycle State Machine**:
     - Explicit source $\to$ destination transitions:
       - `NEW` $\to$ `TRIAGED` (Allowed roles: `DEPARTMENT_OFFICER`, `ADMIN`, `SYSTEM_ADMIN`; Action: `TRIAGED`)
       - `TRIAGED` $\to$ `ASSIGNED` (Allowed roles: `DEPARTMENT_OFFICER`, `ADMIN`, `SYSTEM_ADMIN`; Action: `ASSIGNED`)
       - `ASSIGNED` $\to$ `IN_PROGRESS` (Allowed roles: Assigned `FIELD_OFFICER` [where `assigned_to === user.id`], `DEPARTMENT_OFFICER`, `ADMIN`, `SYSTEM_ADMIN`; Action: `STARTED_WORK` or `ACCEPTED`)
       - `IN_PROGRESS` $\to$ `AWAITING_VERIFICATION` (Allowed roles: Assigned `FIELD_OFFICER` [where `assigned_to === user.id`], `DEPARTMENT_OFFICER`, `ADMIN`, `SYSTEM_ADMIN`; Action: `VERIFICATION_REQUESTED` or `RESOLUTION_SUBMITTED`)
       - `AWAITING_VERIFICATION` $\to$ `RESOLVED` (Allowed roles: `DEPARTMENT_OFFICER`, `ADMIN`, `SYSTEM_ADMIN`; Action: `RESOLVED`)
       - `RESOLVED` $\to$ `CLOSED` (Allowed roles: `DEPARTMENT_OFFICER`, `ADMIN`, `SYSTEM_ADMIN`; Action: `CLOSED`)
       - `CLOSED` $\to$ `REOPENED` (Allowed roles: `DEPARTMENT_OFFICER`, `ADMIN`, `SYSTEM_ADMIN`; Action: `REOPENED`)
       - `REOPENED` $\to$ `TRIAGED` (Allowed roles: `DEPARTMENT_OFFICER`, `ADMIN`, `SYSTEM_ADMIN`; Action: `TRIAGED`)
     - **Reject all other transitions** with `400 INVALID_STATE_TRANSITION`.
  4. **API Consistency — Assignments & Workload**:
     - Implement `GET /api/v1/assignments?assigned_to=me`:
       - Server-side scoped to the caller's authorized work queue.
       - If caller is `FIELD_OFFICER`, returns only assignments where `assigned_to === user.id`.
       - If caller is `DEPARTMENT_OFFICER`, returns assignments within their authorized department.
       - If caller is `ADMIN` / `SYSTEM_ADMIN`, returns all assignments (or filtered).
     - Keep `GET /api/v1/problems/:id/assignments` for problem-specific assignment history.
     - Standardize Department Endpoints:
       - `GET /api/v1/departments` $\to$ department metadata/directory list.
       - `GET /api/v1/departments/:id/workload` $\to$ specific workload metrics (active load, SLA risk count, capacity) for that department.
       - Do not claim `GET /departments` alone returns workload metrics unless explicitly combined.
  5. **Atomic Workflow Mutations**:
     - Assignment + corresponding problem department/status update must maintain transactional consistency.
     - Status transitions must validate the current persisted state immediately before mutation to prevent stale concurrent mutations from bypassing the state machine.
     - The mock provider must preserve the exact same consistency invariants expected from production storage.
  6. **Audit Action Integrity**:
     - Every successful assignment, reassignment, status transition, and official action must create **exactly one immutable `ProblemAction` audit record**.
     - Failed authorization (`403`) or invalid transitions (`400`) must **NOT** create successful workflow or action records.
  7. **Acceptance Criteria**:
     - [x] SLA targets strictly deterministic: CRITICAL=24h, HIGH=48h, MEDIUM=120h, LOW=240h.
     - [x] Historical SLA breach outcome (was_breached: true) retained when problem becomes RESOLVED or CLOSED if deadline was exceeded prior to resolution.
     - [x] Field officer scoped strictly to assigned_to === user.id.
     - [x] Department officer scoped strictly to their department.
     - [x] Canonical state machine enforces the 8 valid transitions and rejects all others with 400 INVALID_STATE_TRANSITION.
     - [x] Atomic workflow mutations maintain consistency between assignments and problems.
     - [x] Every transition persists an immutable ProblemAction audit record.
     - [x] Citizen access to government workflows is blocked with 403.
     - [x] Strict phase boundaries maintained (no Phase 6/7 logic; STOP after Phase 5).
     - **No Phase 6 AI resolution verification**: No automated image comparison or AI verification pipeline.
     - **No Phase 7 Governance AI**: No natural language governance querying or NL analytical assistants.
     - **No Autonomous Government Actions**: AI recommendations remain advisory; all assignments, status changes, and resolutions require explicit authenticated human authority.
- **Files to Create / Modify**:
  - `shared/src/types/workflow.ts` (`SLAState`, `SLARiskStatus`, `Department`, `DepartmentWorkload`, updated `Assignment`, `ProblemAction`, `ActionType`).
  - `shared/src/schemas/index.ts` (`AssignProblemSchema`, `UpdateProblemStatusSchema`, `ProblemActionInputSchema`).
  - `backend/src/providers/database/` (`database.interface.ts`, `mock.database.ts`, `firestore.provider.ts`).
  - `backend/src/modules/workflow/` (`workflow.machine.ts`, `sla.service.ts`, `workflow.service.ts`, `workflow.controller.ts`, `workflow.routes.ts`).
  - `backend/src/modules/assignments/` (`assignment.controller.ts`, `assignment.routes.ts` for `GET /api/v1/assignments?assigned_to=me`).
  - `backend/src/modules/dashboard/` (`dashboard.service.ts`, `dashboard.controller.ts`, `dashboard.routes.ts`).
  - `backend/src/modules/departments/` (`department.controller.ts`, `department.routes.ts` for metadata directory & `:id/workload`).
  - `backend/src/modules/problems/problem.routes.ts` (attach workflow routes).
  - `backend/src/app.ts` (mount `/api/v1/assignments`, `/api/v1/dashboard`, `/api/v1/departments`).
  - `frontend/src/app/dashboard/page.tsx` (Live KPIs, department problem queue, priority problems from API).
  - `frontend/src/app/officer/page.tsx` (Live work orders from `/api/v1/assignments?assigned_to=me`, status actions, deterministic SLA countdown).
  - `frontend/src/app/dashboard/problems/[id]/page.tsx` (Interactive assignment modal, live audit timeline, SLA state badge).
  - `frontend/src/app/dashboard/departments/page.tsx` (Department metadata directory + `:id/workload` metrics).
  - `frontend/src/app/dashboard/map/page.tsx` (Problem cluster markers with status and impact score).
- **Automated Tests**:
  - `backend/tests/workflow-state-machine.test.ts` (Valid 8-step lifecycle, invalid transitions rejected with 400, role permissions matrix).
  - `backend/tests/sla.test.ts` (Exact 24/48/120/240h deterministic targets, elapsed/remaining arithmetic, risk thresholds).
  - `backend/tests/operations-api.test.ts` (Citizen 403 guard, department scoping, field officer `assigned_to === user.id` restriction, atomic assignment + problem update, audit log persistence).
- **Browser Verification**:
  - Open `/dashboard` $\implies$ verify live KPIs and priority problems.
  - Open `/dashboard/problems/PRB-2026-0819` $\implies$ assign to WATCO / field officer, update status, verify audit timeline and SLA countdown.
  - Open `/officer` $\implies$ verify assigned problem displays only for assigned officer with operational controls.
  - Verify citizen role receives 403 on all workflow mutation attempts.


---

### PHASE 6 — Resolution Evidence & AI Verification
- **Prerequisites**: Phase 5 complete and approved.
- **Files to Create / Modify**:
  - `shared/src/types/evidence.ts` (Canonical `ResolutionEvidence`, `VerificationResultStatus: VERIFIED | INCONCLUSIVE | REJECTED`, `EvidenceStatus`, `EvidenceType`).
  - `shared/src/schemas/evidence.schema.ts` (Zod validation for evidence submission, structured verification, resolution review).
  - `backend/src/providers/database/database.interface.ts` & `mock.database.ts`, `firestore.provider.ts` (Resolution evidence & verification result persistence, Golden Demo seed).
  - `backend/src/providers/ai/verification.interface.ts` (`IAIVerificationProvider`).
  - `backend/src/providers/ai/mock.verification.ts` & `gemini.verification.ts` (Deterministic mock for Golden Demo `PRB-2026-0819`, Gemini provider with prompt injection defense).
  - `backend/src/infrastructure/ai/prompts/resolution_verification_v1.ts`.
  - `backend/src/modules/resolutions/` (`resolution.controller.ts`, `resolution.service.ts`, `verification.service.ts`, `resolution.routes.ts`).
  - `backend/src/modules/workflow/workflow.machine.ts` (Canonical transition: `AWAITING_VERIFICATION → IN_PROGRESS` on supervisory rejection).
  - `frontend/src/components/domain/ResolutionWorkspace.tsx` (Evidence timeline, before/after visual comparison, advisory AI verification card, human supervisory review controls).
  - `frontend/src/app/dashboard/problems/[id]/page.tsx` (Embed workspace, persona switcher for evaluating RBAC).
  - `frontend/src/app/officer/page.tsx` (Integrate resolution submission flow on assigned work queue).
- **Database Collections**:
  - `/resolution_evidence`, `/verification_results`.
- **API Endpoints**:
  - `POST /api/v1/problems/:id/evidence` (and `POST /api/v1/problems/:id/resolution-evidence`)
  - `GET /api/v1/problems/:id/evidence` (and `GET /api/v1/problems/:id/resolution-evidence`)
  - `POST /api/v1/problems/:id/verify` (and `POST /api/v1/resolution-evidence/:id/verify`)
  - `GET /api/v1/problems/:id/verification` (and `GET /api/v1/resolution-evidence/:id/verification`)
  - `POST /api/v1/problems/:id/review-resolution`
- **Canonical Lifecycle & State Transitions**:
  - `IN_PROGRESS → AWAITING_VERIFICATION`: Triggered by explicit officer resolution evidence submission. The submission does NOT infer completion from content; successful submission from `IN_PROGRESS` moves the case to `AWAITING_VERIFICATION`.
  - AI Verification: Evaluates submitted evidence strictly while in `AWAITING_VERIFICATION`. Advisory assessment only; never changes problem status to `RESOLVED` or `CLOSED`.
  - Human Acceptance: Authorized Department Officer or Admin accepts resolution $\implies$ `AWAITING_VERIFICATION → RESOLVED`.
  - Human Rejection: Authorized Department Officer or Admin rejects resolution evidence $\implies$ `AWAITING_VERIFICATION → IN_PROGRESS`. Evidence is permanently preserved with `REJECTED` status and rejection feedback is written to the audit log.
  - Field officers and citizens cannot resolve, close, or review their own cases.
- **Canonical Verification Result States**:
  - Strictly: `VERIFIED`, `INCONCLUSIVE`, `REJECTED`.
  - Fallback / Timeout / Malformed output: `INCONCLUSIVE` with operation status `FAILED` and `review_required: true`. Problem remains in `AWAITING_VERIFICATION`.
- **Storage**:
  - Reuses existing Phase 2 `IStorageProvider`. No independent second storage mechanism.
  - Raw storage paths are never exposed to frontend clients; media access remains authorization-scoped.
- **Tests**:
  - Evidence RBAC tests (Citizen 403, unassigned officer 403, assigned officer 201, supervisor 201).
  - Evidence integrity & immutability tests (prior evidence never overwritten, audit logging).
  - AI verification resilience tests (Golden Demo `PRB-2026-0819` deterministic `VERIFIED`, `INCONCLUSIVE`, `REJECTED`, malformed, timeout, prompt injection defense in notes).
  - Workflow integration tests (`IN_PROGRESS → AWAITING_VERIFICATION`, AI never auto-resolves, supervisory reject `AWAITING_VERIFICATION → IN_PROGRESS`, supervisory accept `AWAITING_VERIFICATION → RESOLVED`).
- **Browser Verification**:
  - Open `/dashboard/problems/PRB-2026-0819` $\implies$ as assigned officer submit resolution evidence (transitions to `AWAITING_VERIFICATION`) $\implies$ trigger AI verification $\implies$ inspect structured card and before/after comparison $\implies$ as Department Officer accept resolution $\implies$ verify `RESOLVED` and complete audit history.
- **Explicitly Excluded**:
  - Phase 7 Governance AI, intervention simulator, autonomous government action, automatic ticket closure by LLM.

---

### PHASE 7 — Governance AI & Grounded Administrative Intelligence
- **Prerequisites**: Phase 6 complete and approved.
- **Files to Create / Modify**:
  - `shared/src/types/governance.ts` (Structured response, query intent, source citations, tool definitions).
  - `shared/src/schemas/governance.schema.ts` (Zod schemas for query input, tool calls, grounded response).
  - `backend/src/infrastructure/ai/prompts/governance_intelligence_v1.ts` (Prompt with untrusted input boundaries, grounding mandate).
  - `backend/src/providers/ai/governance.interface.ts` (`IGovernanceAIProvider`).
  - `backend/src/providers/ai/mock.governance.ts` (Deterministic grounding for Golden Demo from actual DB records, failure simulation).
  - `backend/src/providers/ai/gemini.governance.ts` (Production Gemini provider with JSON schema validation).
  - `backend/src/modules/governance/governance.tools.ts` (11 allowlisted server-side analytical tools enforcing RBAC scope).
  - `backend/src/modules/governance/governance.classifier.ts` (Deterministic intent classifier).
  - `backend/src/modules/governance/governance.service.ts` (End-to-end grounded query pipeline).
  - `backend/src/modules/governance/governance.controller.ts` (`POST /api/v1/governance/query`, `GET /api/v1/governance/brief`).
  - `backend/src/modules/governance/governance.routes.ts` (Mount with `authMiddleware`).
  - `backend/src/app.ts` (Mount `/api/v1/governance`).
  - `frontend/src/app/dashboard/ai/page.tsx` (Analytical intelligence workspace: persona switcher, grounded answer, source references, safe evidence labels).
  - `backend/tests/governance-ai.test.ts` (Comprehensive RBAC, tool scoping, grounding, injection defense, resilience tests).
- **Core Guardrails & Grounding Invariants**:
  - **No Invented Facts**: All factual values (e.g., PRB-2026-0819 impact 92, population 18,400, duration 3 days, DAV Public School, 7-factor scores) must come directly from authoritative backend database records.
  - **No Fabricated Grounding Score**: Remove arbitrary "96% Evidence Grounding". Use transparent representations such as "Grounded in N verified data sources" and auditable source counts.
  - **Tool Transparency**: The UI presents safe human-readable evidence labels (e.g. *Problem Ranking*, *Department Workload*, *SLA Risk*, *Resolution Evidence*, *Problem Details*). Raw tool names, database internals, and implementation arguments remain server-side/audited.
  - **Deterministic Intent Classification**: Queries are classified into allowlisted intents (`TOP_PROBLEMS`, `PROBLEM_DETAILS`, `WHY_RANKED`, `WARD_IMPACT`, `DEPARTMENT_PERFORMANCE`, `SLA_RISK`, `TREND_ANALYSIS`, `FACILITY_IMPACT`, `RESOLUTION_PERFORMANCE`, `GENERAL_GOVERNANCE_SUMMARY`, `UNSUPPORTED`). Model-generated arbitrary tool execution is strictly prohibited.
  - **Backend-Grounded WHY-RANKED**: Explanations retrieve the authoritative ranked list and 7-factor breakdowns server-side before reasoning.
  - **Inherited RBAC**: Citizen $\to$ 403 Forbidden; Field Officer $\to$ limited scope; Department Officer $\to$ department-scoped; Admin $\to$ cross-department global scope.
  - **Preserve Phases 1–6**: Zero breaking changes to existing features, workflows, or tests.
- **Tests**:
  - Governance RBAC tests (Citizen 403, Field Officer scoped, Department Officer department-scoped, Admin global).
  - Tool scoping tests (cross-department access blocked, client parameter tampering prevented).
  - Grounding accuracy tests (factual values match retrieved records; unsupported queries return clean limitation).
  - Prompt injection defense tests (untrusted citizen text/notes isolated from instructions).
  - Provider failure resilience tests (graceful degradation on timeout/error).
- **Browser Verification**:
  - Open `/dashboard/ai` $\implies$ as Admin ask Golden Demo questions $\implies$ verify exact database values, source links, and safe evidence labels $\implies$ switch to Department Officer $\implies$ verify department scoping $\implies$ switch to Citizen $\implies$ verify 403 blocked screen.
- **Acceptance Criteria**:
  - [ ] Governance AI operates strictly via allowlisted, scoped tools.
  - [ ] Answers are grounded in real database records without hallucinated statistics.
  - [ ] UI shows safe human-readable evidence labels and "Grounded in N verified data sources".
  - [ ] Citizen access is strictly blocked with HTTP 403.
- **Explicitly Excluded**: Phase 8 Intervention Simulator, predictive policy modeling, autonomous actions.

---

### PHASE 8 — Intervention Simulator (Read-Only Civic Simulation)
- **Prerequisites**: Phase 7 complete and approved.
- **Architectural Principle**: Strictly READ-ONLY. Zero database mutations. Deterministic mathematical model owns all calculations. Projected impact score strictly equals the sum of its projected components.
- **Files to Create / Modify**:
  - `shared/src/types/simulation.ts` & `shared/src/schemas/simulation.schema.ts`
  - `shared/src/constants/simulation.ts` (Centralized simulation constants)
  - `backend/src/modules/simulation/` (`simulation.engine.ts`, `simulation.service.ts`, `simulation.controller.ts`, `simulation.routes.ts`)
  - `backend/src/infrastructure/ai/prompts/intervention_simulation_v1.ts`
  - `backend/src/providers/ai/` (`simulation.interface.ts`, `mock.simulation.ts`, `gemini.simulation.ts`)
  - `frontend/src/app/dashboard/simulation/page.tsx`
  - `frontend/src/components/shells/GovernmentShell.tsx` (Add navigation item)
  - `frontend/src/app/dashboard/problems/[id]/page.tsx` (Add "Simulate Intervention" action link)
  - `backend/tests/simulation.test.ts`
- **Database Changes**: Zero database mutations. No real problems, assignments, or SLA states are altered. Audit log created for simulation execution.
- **Deterministic Factor Transformation Model**:
  - `projected_impact_score = sum(projected factor components)` strictly enforced.
  - Population factor recomputed from remaining exposed population using Phase 2 brackets.
  - Duration factor recomputed from total problem duration (elapsed problem hours + projected remaining repair hours).
  - Severity, Concentration, Facility, and Recurrence transformed strictly according to explicit physical scenario rules.
  - SLA State & Utilization: Baseline SLA is already BREACHED (elapsed 72h / threshold 24h = 3.00x utilization). The simulator strictly displays projected state as BREACHED (e.g. 3.50x / 3.67x) and explains that interventions reduce additional repair delay but cannot retroactively undo an already-recorded breach.
  - Recurrence Modeling: Projected recurrence factor (1/10) is an explicit simulation assumption modeled for a 90-day planning horizon, not a guaranteed or observed real-world outcome.
- **Golden Demo Baseline (PRB-2026-0819)**:
  - Baseline: Severity 24 + Pop 18 + Dur 14 + Conc 14 + Facility 9 + Rec 8 + Ev 5 = **92** (Pop: 18,400, Elapsed: 72h, Critical Facility: DAV Public School, SLA: Already Breached at 3.00x).
  - Scenario A (Emergency Tanker & Relief Surge): 18 + 10 + 14 + 12 + 2 + 8 + 5 = **69** (-23 pts; 13,800 relieved; ₹10.87/citizen; SLA remains breached at 4.00x).
  - Scenario B (Accelerated Dual-Crew Repair): 10 + 0 + 14 + 6 + 0 + 8 + 5 = **43** (-49 pts; 18,400 relieved; 12h remaining repair saves 12h additional delay; SLA remains breached at 3.50x; ₹22.83/citizen).
  - Scenario C (Resilient Bypass Loop): 6 + 0 + 14 + 4 + 0 + 1 + 5 = **30** (-62 pts; 18,400 relieved; recurrence assumed reduced to 1/10 for 90-day modeled horizon; ₹46.20/citizen).
- **Frontend Experience**:
  - Prominent `[SIMULATION / ADVISORY]` banner and clear visual demarcation between Authoritative Baseline and Simulated Projection.
  - Current SLA state explicitly marked `ALREADY BREACHED` and projected SLA explicitly marked `BREACHED` (showing additional breach delay reduction without claiming breach reversal).
  - Recurrence impact clearly labeled with assumption badge: `[Modeled 90-Day Planning Horizon Assumption]`.
  - Side-by-side factor component breakdown table.
  - Scenario preset selector + custom parameter sliders bounded by centralized constants.
- **AI Changes**:
  - Gemini receives exact computed deterministic metrics and explains operational trade-offs and feasibility. Gemini never invents, calculates, or alters numbers, and never claims past SLA breaches are undone.
- **Acceptance Criteria**:
  - [ ] Every projected impact score strictly equals the sum of its factor components.
  - [ ] Population relief formula uses explicit scenario parameters and bounded values.
  - [ ] Problem age (elapsed) and remaining MTTR are cleanly separated.
  - [ ] Existing SLA breach is never claimed as avoided or reversed; projected SLA correctly shown as BREACHED.
  - [ ] Recurrence reduction explicitly labeled as a 90-day simulation assumption, not a guarantee.
  - [ ] Zero database mutations verified by automated tests.
  - [ ] Citizen access returns 403 Forbidden with restricted UI.
  - [ ] All unit, lint, build, and browser verifications pass.
- **Explicitly Excluded**: Autonomous procurement, financial transaction execution, ticket status modification, parallel ungrounded datasets.

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
