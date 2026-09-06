# CivicPulse AI

## Product Scope & MVP Boundaries

**Version:** 1.0
**Status:** Hackathon MVP
**Product:** CivicPulse AI

---

# 1. Purpose

This document defines the exact product boundaries for CivicPulse AI.

It exists to ensure that implementation remains focused on the core product:

> **Citizen Signals → Government Intelligence → Public Action**

This document defines:

* what must be built;
* what may be built;
* what must not be built;
* user roles;
* core workflows;
* MVP screens;
* feature priorities;
* release boundaries.

The implementation agent must use this document together with `01_PRD.md`.

---

# 2. Product Boundary

CivicPulse AI is an **AI-powered public-problem intelligence platform**.

It is NOT:

* a replacement for CPGRAMS;
* a replacement for municipal grievance portals;
* a generic chatbot;
* a social-media platform;
* a government ERP;
* a complete financial management system;
* a fully autonomous government agent.

The core product is the intelligence layer that turns fragmented signals into actionable public-problem intelligence.

---

# 3. Core Product Loop

The entire MVP revolves around this loop:

```text
SIGNAL
  ↓
UNDERSTAND
  ↓
RELATE
  ↓
CLUSTER
  ↓
SCORE
  ↓
PRIORITIZE
  ↓
ACT
  ↓
VERIFY
  ↓
LEARN
```

Every major feature should contribute to this loop.

Features that do not strengthen this loop should be considered lower priority.

---

# 4. Feature Priority Framework

Features are divided into four priority levels.

## P0 — Critical

Must exist for the MVP and final demonstration.

## P1 — Important

Should be implemented after P0 and before final polish.

## P2 — Enhancement

Implement only when P0/P1 are stable.

## P3 — Future

Do not implement during the main MVP build.

---

# 5. P0 — Critical MVP Features

## P0-01 Authentication

Users must be able to sign in.

Required roles:

* Citizen
* Field Officer
* Department Officer
* Administrator / Policymaker
* System Administrator

Authentication should use the selected identity provider.

---

## P0-02 Citizen Signal Submission

A citizen can submit:

* text description;
* optional image;
* location;
* optional category.

The initial MVP must prioritize speed and simplicity.

Primary CTA:

**Report a Problem**

---

## P0-03 Signal Analysis

Every submitted signal should be analyzed by the AI pipeline.

Extract:

* category;
* subcategory;
* language;
* normalized description;
* severity;
* probable department;
* location context;
* confidence.

---

## P0-04 Duplicate / Related Signal Detection

When a new signal is submitted, the system should determine whether it is:

1. likely unique;
2. related to an existing problem;
3. potentially duplicated.

The system must never delete or overwrite the original report.

---

## P0-05 Problem Cluster Creation

Related signals should be represented as a higher-level problem cluster.

Example:

```text
328 citizen signals
        ↓
Problem Cluster
"Water Supply Disruption — Ward 18"
```

The cluster should become the primary governance unit.

---

## P0-06 Public Impact Score

Each active problem cluster must receive a transparent score from 0–100.

Default model:

```text
Severity                         25%
Population Affected             20%
Duration                        15%
Complaint Concentration         15%
Vulnerability/Critical Facility 10%
Recurrence                      10%
Evidence Confidence              5%
```

The score should be calculated using deterministic application logic.

AI may explain the score.

AI must not silently modify the calculation.

---

## P0-07 Priority Ranking

The administrator dashboard must surface the highest-impact active problems.

Example:

```text
01  Water Supply Disruption       92
02  Drainage Failure              86
03  Road Damage                   81
04  Garbage Accumulation          77
```

Users must be able to open the underlying problem cluster.

---

## P0-08 Geographic Problem View

Display problem clusters geographically.

Minimum information shown:

* location;
* category;
* impact score;
* signal count;
* status.

The map should support filtering.

The platform must provide an accessible textual alternative.

---

## P0-09 Government Assignment

Authorized officers must be able to:

* assign department;
* assign officer;
* update status;
* add notes;
* escalate;
* attach evidence.

---

## P0-10 Problem Lifecycle

Required states:

```text
NEW
TRIAGED
ASSIGNED
IN_PROGRESS
AWAITING_VERIFICATION
RESOLVED
CLOSED
```

State transitions must be validated.

---

## P0-11 Resolution Evidence

Officers must be able to upload:

* image;
* description;
* timestamp;
* optional field note.

The evidence becomes part of the problem history.

---

## P0-12 AI Resolution Verification

The AI should analyze submitted evidence and produce:

* status suggestion;
* confidence;
* observations;
* limitations.

Example:

```text
Verification
-----------------------------
Likely resolved

Confidence: 91%

Observation:
Uploaded evidence appears
consistent with road repair.

Human review required.
```

---

## P0-13 Governance Dashboard

The main administrator view must include:

### Overview

* total signals;
* active problems;
* high-impact problems;
* resolution rate.

### Priority

* top public problems.

### Geography

* public-problem hotspots.

### Operations

* department workload;
* SLA risk.

### Intelligence

* AI-generated brief.

---

## P0-14 Governance AI

Authorized administrative users must be able to ask questions against platform data.

Required examples:

> What are the top problems this week?

> Why is water-related activity increasing?

> Which wards have the highest unresolved impact?

> Which department has the largest active backlog?

> Show me problems affecting schools.

The system should answer from actual application data.

---

# 6. P1 — Important Features

## P1-01 Voice Input

Citizen can report through voice.

Flow:

```text
Voice
 ↓
Speech-to-text
 ↓
Language detection
 ↓
Gemini understanding
 ↓
Structured signal
```

The original transcript should remain accessible.

---

## P1-02 Multilingual UI

Support:

* English
* Hindi
* Odia

The interface should allow users to maintain their selected language.

---

## P1-03 Image Understanding

Use image input to detect visible issue characteristics.

Examples:

* pothole;
* garbage accumulation;
* broken infrastructure;
* water leakage;
* damaged public asset.

Image interpretation should augment, not replace, textual evidence.

---

## P1-04 Emerging Trend Detection

Identify statistically meaningful increases.

Example:

> Drainage-related signals are 48% above the previous 7-day baseline.

This feature should distinguish calculated trends from AI interpretation.

---

## P1-05 Department Analytics

Department users should see:

* active problem clusters;
* average resolution time;
* SLA risk;
* unresolved impact;
* categories;
* trend lines.

---

## P1-06 Citizen Status Timeline

Citizens should be able to see:

```text
Submitted
   ↓
Under Review
   ↓
Assigned
   ↓
In Progress
   ↓
Resolution Submitted
   ↓
Resolved
```

Use simple language instead of internal technical status names where possible.

---

## P1-07 Notifications

Support notifications for important events.

Examples:

* report received;
* report assigned;
* status changed;
* additional information requested;
* problem resolved.

For MVP, in-app notifications are sufficient.

---

# 7. P2 — Enhancement Features

## P2-01 What-If Intervention Simulator

Allow authorized users to ask:

> We have ₹10 lakh available. Where could intervention have the greatest estimated public impact?

The system may consider:

* problem impact;
* estimated population affected;
* urgency;
* configurable cost assumptions.

Output must include:

* assumptions;
* estimate;
* uncertainty;
* rationale.

It must be explicitly labeled:

**Simulation / Advisory**

---

## P2-02 Advanced Geospatial Intelligence

Possible additions:

* ward comparison;
* heatmaps;
* geographic clustering;
* critical-facility overlays;
* temporal animation.

---

## P2-03 Advanced Citizen Feedback

After resolution:

* satisfaction rating;
* confirmation;
* optional comments.

---

## P2-04 Advanced Evidence Comparison

Compare:

* original issue evidence;
* field evidence;
* resolution evidence.

Generate a structured comparison.

---

# 8. P3 — Future Features

These are intentionally outside the main MVP.

## P3-01 Full Government System Integrations

Potential integrations:

* external grievance systems;
* municipal CRMs;
* helplines;
* data warehouses;
* approved APIs.

The architecture should support integration later.

Do not build numerous external integrations during the MVP unless specifically required.

---

## P3-02 Predictive Governance

Possible future capabilities:

* infrastructure failure forecasting;
* complaint surge prediction;
* seasonal issue prediction;
* risk forecasting.

---

## P3-03 Autonomous Task Orchestration

Future possibility:

AI recommends and orchestrates multi-department workflows.

This is NOT part of the MVP.

---

## P3-04 Cross-Country Deployment

Future configurable structures:

```text
Country
 ↓
Region
 ↓
District
 ↓
Municipality
 ↓
Ward
```

The data model should avoid unnecessary country-specific assumptions.

---

# 9. Explicitly Excluded Features

The following must NOT be added to the MVP unless explicitly requested:

### Social Features

* citizen follower system;
* public social feed;
* likes;
* comments;
* citizen reputation;
* leaderboards.

### Unnecessary AI Features

* AI avatars;
* animated AI characters;
* generic AI chat;
* autonomous voice agent;
* AI-generated political messaging;
* AI-generated public announcements without review.

### Unnecessary Enterprise Features

* payroll;
* procurement;
* accounting;
* full HR system;
* complex asset management;
* complete document-management suite.

### Unnecessary Technical Complexity

* microservice architecture for every feature;
* Kubernetes unless actually required;
* custom machine-learning model training for basic classification;
* multiple vector databases;
* multiple authentication providers;
* unnecessary message queues.

---

# 10. User Role Scope

## 10.1 Citizen

### Can

* register/login;
* submit signals;
* attach images;
* provide location;
* view own reports;
* view public status;
* receive notifications;
* provide resolution feedback when enabled.

### Cannot

* see private administrative notes;
* access internal analytics;
* change official classifications;
* modify impact scores;
* assign officers.

---

# 11. Field Officer

### Can

* see assigned problem clusters;
* inspect supporting signals;
* view locations;
* update progress;
* add notes;
* upload evidence;
* submit resolution.

### Cannot

* alter system-wide scoring configuration;
* manage users;
* access unrelated sensitive citizen information.

---

# 12. Department Officer

### Can

* view department problems;
* inspect priorities;
* assign field officers;
* change status;
* escalate;
* inspect department analytics;
* review resolution evidence.

---

# 13. Administrator / Policymaker

### Can

* inspect cross-department problems;
* view maps;
* inspect trends;
* compare wards;
* use Governance AI;
* view impact rankings;
* review recommendations;
* use intervention simulation when enabled.

---

# 14. System Administrator

### Can

* manage users;
* manage roles;
* manage departments;
* manage wards;
* manage data sources;
* manage configuration;
* inspect audit logs;
* manage application settings.

---

# 15. Core Screens

The MVP should contain the following primary screens.

## Public / Citizen

```text
/login
/register
/citizen
/citizen/report
/citizen/issues
/citizen/issues/[id]
```

---

## Government

```text
/dashboard
/dashboard/problems
/dashboard/problems/[id]
/dashboard/map
/dashboard/departments
/dashboard/trends
/dashboard/ai
```

---

## Officer

```text
/officer
/officer/problems/[id]
```

---

## Administration

```text
/admin
/admin/users
/admin/departments
/admin/wards
/admin/data-sources
/admin/audit
```

Not every administration page must be fully implemented in the first visual prototype.

---

# 16. Navigation Structure

## Citizen navigation

```text
Home
Report
My Reports
Notifications
Profile
```

Keep navigation simple.

---

## Government navigation

```text
Overview
Problems
Map
Departments
Trends
Governance AI
```

Optional:

```text
Settings
```

---

## Officer navigation

```text
My Work
Priority Problems
History
```

---

# 17. Citizen Core Workflow

```text
Open CivicPulse
      ↓
Report a Problem
      ↓
Enter voice/text
      ↓
Optional image
      ↓
Location
      ↓
AI Preview
      ↓
Citizen confirms
      ↓
Submit
      ↓
Confirmation
      ↓
Track Problem
```

The AI Preview should explain what the system understood.

Example:

```text
We understood:

Problem:
Water supply interruption

Area:
Ward 18

Duration:
3 days

Priority:
High

[Edit] [Submit]
```

---

# 18. Administrator Core Workflow

```text
Open Dashboard
      ↓
Review Overview
      ↓
See Priority Problems
      ↓
Open Problem Cluster
      ↓
Inspect Evidence
      ↓
Review Impact Factors
      ↓
Assign / Escalate
      ↓
Monitor Progress
      ↓
Review Resolution Evidence
      ↓
Close / Reopen
```

---

# 19. Officer Core Workflow

```text
My Work
 ↓
Open Priority Problem
 ↓
Read AI Summary
 ↓
Inspect Signals
 ↓
Visit / Investigate
 ↓
Update Status
 ↓
Upload Evidence
 ↓
Submit Resolution
 ↓
AI Verification
 ↓
Human Review
```

---

# 20. Governance AI Workflow

```text
Administrator asks question
            ↓
Question understanding
            ↓
Retrieve structured data
            ↓
Retrieve relevant problems
            ↓
Generate grounded response
            ↓
Display evidence
            ↓
Show calculated metrics
            ↓
Show recommendation when relevant
```

The AI should never present an unsupported statement as fact.

---

# 21. Problem Detail Page

The problem detail page is a critical screen.

It should contain:

## Header

* problem title;
* status;
* impact score;
* severity;
* location.

## Summary

* AI-generated summary;
* signal count;
* affected population estimate;
* duration.

## Evidence

* citizen submissions;
* images;
* field evidence;
* resolution evidence.

## Why This Matters

Show the impact factors.

Example:

```text
Why High Priority?

327 related reports
3 days unresolved
High population exposure
Near a school
Strong evidence confidence
```

## Timeline

Display:

```text
Problem detected
↓
Cluster created
↓
Assigned
↓
Investigation
↓
Resolution submitted
↓
AI verification
```

---

# 22. Dashboard Information Hierarchy

The administrator dashboard must prioritize information in this order:

## Level 1

What requires attention now?

## Level 2

Why does it matter?

## Level 3

Where is it happening?

## Level 4

What is being done?

## Level 5

What changed over time?

Avoid displaying dozens of equal-priority metrics.

---

# 23. Public Impact Score Presentation

The score must never appear as an unexplained number.

Example:

```text
92 / 100
HIGH IMPACT

Severity              24/25
Population            18/20
Duration              14/15
Concentration         14/15
Critical Exposure      9/10
Recurrence             8/10
Evidence               5/5
```

Then:

> Main drivers: high concentration, long duration, and nearby critical facility exposure.

---

# 24. AI Confidence Presentation

Use understandable language.

Instead of only:

```text
0.93
```

show:

```text
Confidence
High — 93%
```

For lower confidence:

```text
Confidence
Moderate — 68%

Review recommended.
```

---

# 25. Data States

Every major asynchronous operation must support:

### Loading

Show meaningful skeletons or progress indicators.

### Empty

Explain what the user can do next.

### Error

Explain the problem and provide retry.

### Success

Confirm the result.

No screen should remain blank while waiting for an API or AI operation.

---

# 26. Synthetic Demo Environment

The MVP must include a clearly identifiable synthetic dataset.

The dataset should demonstrate:

* multiple wards;
* multiple departments;
* thousands of citizen signals;
* duplicate groups;
* problem clusters;
* different severity levels;
* different resolution states;
* geographic concentration;
* historical trends.

Suggested scale:

```text
10,000+ signals
500+ problem clusters
10–20 wards
5–10 departments
```

The exact number may be adjusted for performance.

The UI must clearly indicate:

**Demo Environment / Synthetic Data**

---

# 27. Golden Demo Problem

The application must contain one especially strong demonstration scenario.

## Scenario

A water-supply disruption occurs in Ward 18.

Data:

```text
327 citizen signals
42 images
8 field reports
3-day duration
1 nearby school
High geographic concentration
```

The system should transform these into:

```text
Problem Cluster:
Water Supply Disruption — Ward 18

Impact:
92 / 100

Priority:
HIGH

Status:
IN PROGRESS
```

The administrator should be able to trace the result back to the underlying evidence.

---

# 28. Golden Demo Resolution

A second scenario should demonstrate resolution verification.

Example:

```text
Road Damage — Ward 7

Before:
Severe road damage

After:
Repair evidence uploaded

AI:
Evidence appears consistent with repair
Confidence: 91%

Status:
Awaiting Human Confirmation
```

This creates a complete end-to-end story.

---

# 29. Demo-First Product Constraint

Every MVP feature should be evaluated against:

1. Does it strengthen the core governance story?
2. Does it improve public impact?
3. Does it demonstrate meaningful AI usage?
4. Can it be explained clearly to judges?
5. Can it be verified?

Features that fail all or most of these criteria should not delay core implementation.

---

# 30. MVP Acceptance Criteria

The MVP is considered functionally complete when all of the following work:

### Citizen

* user can sign in;
* user can submit a signal;
* user can add an image;
* user can provide location;
* user can view the submitted signal.

### AI

* signal is structured;
* classification is returned;
* duplicate/related detection works;
* problem cluster can be created;
* AI output is validated.

### Governance

* impact score is calculated;
* priorities are ranked;
* problems appear on the map;
* administrator can inspect problem details.

### Operations

* problem can be assigned;
* status can change;
* evidence can be uploaded.

### Verification

* AI can analyze resolution evidence;
* verification result is displayed;
* human review remains possible.

### Governance AI

* administrator can ask a question;
* answer is grounded in application data;
* relevant evidence/metrics are displayed.

---

# 31. Performance Boundary

The MVP should prioritize reliability over extreme scale.

Target:

* smooth handling of synthetic demo dataset;
* pagination for large lists;
* no unnecessary repeated AI calls;
* reasonable map performance;
* asynchronous processing for expensive AI operations where appropriate.

Do not optimize for nationwide production scale during the hackathon.

The architecture should remain scalable without implementing unnecessary complexity.

---

# 32. Scope Control Rules

The implementation agent must follow these rules:

1. P0 before P1.
2. P1 before P2.
3. P2 only after P0/P1 stability.
4. P3 must not be implemented unless explicitly requested.
5. Do not invent new major features.
6. Do not redesign the product without documenting the reason.
7. Do not replace the core governance intelligence concept with a generic complaint system.
8. Do not prioritize visual polish over core workflow correctness.
9. Do not prioritize AI theatrics over useful AI functionality.
10. Do not add infrastructure solely to make the architecture look sophisticated.

---

# 33. Definition of a Good MVP

A good CivicPulse MVP should allow a judge to understand the entire product within minutes:

```text
Citizen signal
      ↓
AI understanding
      ↓
Related reports
      ↓
Problem cluster
      ↓
Impact score
      ↓
Priority
      ↓
Government action
      ↓
Resolution evidence
      ↓
AI verification
      ↓
Governance insight
```

If the judge can follow this chain without additional explanation, the MVP is successful.

---

# 34. Product Scope Summary

## Must Build

```text
Authentication
Citizen reporting
AI understanding
Duplicate detection
Problem clustering
Impact scoring
Priority ranking
Map
Government dashboard
Officer workflow
Resolution evidence
AI verification
Governance AI
Synthetic demo data
```

## Build After Core

```text
Voice
Multilingual UI
Image intelligence
Trend detection
Notifications
Department analytics
Citizen feedback
```

## Build Only If Time Allows

```text
Intervention simulator
Advanced geospatial analytics
Advanced evidence comparison
```

## Do Not Build For MVP

```text
Large-scale integrations
Predictive governance
Autonomous government actions
Complex enterprise modules
Social network features
Unnecessary AI experiences
Unnecessary infrastructure complexity
```

---

# 35. Source of Truth

This document defines **product scope**.

Use:

`01_PRD.md`
for product vision and requirements.

`03_ARCHITECTURE.md`
for technical architecture.

`04_DESIGN.md`
for visual and interaction design.

`05_AI_SPEC.md`
for AI behavior.

`06_DATA_MODEL.md`
for data structures.

`07_API_SPEC.md`
for API contracts.

`08_SECURITY.md`
for security and privacy.

`09_PHASES.md`
for implementation sequence.

`10_DEMO_AND_EVALUATION.md`
for hackathon demonstration and evaluation strategy.

`11_IMPLEMENTATION_RULES.md`
for engineering behavior.

When a feature is not explicitly included in the MVP scope, the implementation agent should not assume it is required.
