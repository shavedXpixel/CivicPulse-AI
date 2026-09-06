# CivicPulse AI

## UI/UX & Design System Specification

**Version:** 1.0
**Status:** Hackathon MVP
**Product:** CivicPulse AI
**Design Principle:** Serious civic technology that feels human, trustworthy, clear, and operational.

---

# 1. Design Vision

CivicPulse AI should feel like a modern public-infrastructure product used by real governments, not like a generic AI SaaS dashboard.

The design should communicate:

* trust;
* clarity;
* public accountability;
* evidence;
* calmness;
* accessibility;
* operational usefulness.

The interface must make complex governance information understandable without making it look simplistic.

---

# 2. Primary Design Statement

## "Calm interface. Strong information hierarchy. Clear public impact."

CivicPulse should visually communicate:

> "This system helps people understand what is happening in their communities and helps officials act on it."

---

# 3. Visual Personality

The product should feel:

* institutional but modern;
* professional but human;
* analytical but approachable;
* data-rich but not overwhelming;
* technologically advanced without looking futuristic;
* trustworthy rather than flashy.

---

# 4. Visual Anti-Patterns

The implementation must avoid the following unless specifically justified:

* excessive gradients;
* neon backgrounds;
* glowing cards;
* excessive glassmorphism;
* cyberpunk styling;
* floating 3D AI objects;
* animated robot assistants;
* generic purple "AI" dashboards;
* excessive pill-shaped UI;
* giant decorative illustrations;
* excessive shadows;
* excessive rounded cards;
* decorative charts with no analytical value;
* unnecessary animations;
* emoji as primary UI icons.

The interface should never communicate "AI demo."

It should communicate:

**"Civic intelligence infrastructure."**

---

# 5. Brand

## Product Name

CivicPulse AI

## Tagline

Citizen Signals → Government Intelligence → Public Action

## Short description

AI-powered public-problem intelligence for evidence-backed governance.

---

# 6. Color Philosophy

Use a restrained civic palette.

The interface should have:

* warm neutral background;
* near-black primary text;
* muted secondary text;
* one strong primary brand color;
* limited supporting semantic colors.

Do not use many accent colors.

---

# 7. Suggested Color Tokens

The exact RGB/hex values may be adjusted during implementation, but the semantic roles must remain consistent.

```text
--background
Warm near-white

--surface
White

--surface-muted
Very light neutral

--text-primary
Near-black

--text-secondary
Muted charcoal

--text-tertiary
Subtle gray

--border
Light neutral

--brand
Deep civic blue/teal

--brand-hover
Darker brand

--success
Muted green

--warning
Muted amber

--danger
Muted red

--info
Muted blue
```

Semantic colors should be used sparingly.

---

# 8. Typography

Preferred fonts:

1. Geist
2. Inter
3. Another highly legible modern sans-serif if required

Avoid decorative display fonts.

---

# 9. Typography Scale

```text
Display:
40–48px

Page title:
28–32px

Section heading:
18–22px

Card heading:
15–18px

Body:
14–16px

Secondary:
13–14px

Metadata:
12–13px
```

The visual hierarchy must remain strong even when users scan quickly.

---

# 10. Typography Rules

Use:

* sentence case;
* concise headings;
* short labels;
* plain language.

Avoid:

* all-caps headings everywhere;
* unnecessary technical terminology;
* long paragraphs in dashboards;
* model-specific jargon.

Example:

Use:

**Why this is high priority**

Not:

**AI Priority Inference Explanation**

---

# 11. Spacing System

Use a consistent spacing scale based on multiples of 4px.

Example:

```text
4
8
12
16
20
24
32
40
48
64
80
```

Large content areas should have sufficient whitespace.

Do not compress every element simply to fit more information on screen.

---

# 12. Border Radius

Use moderate rounding.

Recommended:

```text
Small elements:
6px

Controls:
8px

Cards:
10–12px

Large panels:
12–16px
```

Avoid excessively rounded "bubble" interfaces.

---

# 13. Shadows

Use shadows sparingly.

Prefer:

* borders;
* subtle elevation;
* tonal separation.

Do not use dramatic floating shadows.

---

# 14. Iconography

Use one consistent icon family.

Preferred:

* Lucide
* another clean outline icon system

Icons should communicate meaning.

Do not add decorative icons merely to fill space.

---

# 15. Motion

Animations should be:

* subtle;
* purposeful;
* short;
* accessible.

Useful animations:

* loading;
* panel transitions;
* map updates;
* notification appearance;
* status changes.

Avoid:

* constant floating animation;
* flashy transitions;
* excessive parallax;
* animated background effects.

Honor reduced-motion accessibility preferences.

---

# 16. Layout Principles

Every page should have:

1. clear primary action;
2. clear page title;
3. obvious information hierarchy;
4. consistent navigation;
5. predictable spacing;
6. useful empty states.

---

# 17. Application Shell

Government interface:

```text
┌──────────────────────────────────────────────────────┐
│ CivicPulse                 Search      Notifications │
├──────────────┬───────────────────────────────────────┤
│              │                                       │
│ Overview     │                                       │
│ Problems     │             Main Content              │
│ Map          │                                       │
│ Departments  │                                       │
│ Trends       │                                       │
│ Governance AI│                                       │
│              │                                       │
│ Settings     │                                       │
└──────────────┴───────────────────────────────────────┘
```

Desktop navigation should be persistent.

Mobile should use a compact navigation pattern.

---

# 18. Citizen Application Shell

The citizen interface should be simpler.

```text
┌───────────────────────────────┐
│ CivicPulse             Menu   │
├───────────────────────────────┤
│                               │
│ Report a public problem       │
│                               │
│ [ Speak ] [ Add Photo ]       │
│                               │
│ [ Describe the problem... ]   │
│                               │
│       [ Report Problem ]      │
│                               │
│ Recent Reports                │
│ ─────────────────────────     │
│ Water supply issue            │
│ Ward 18 · In progress         │
│                               │
└───────────────────────────────┘
```

The citizen experience must not resemble the administrator dashboard.

---

# 19. Primary Navigation

## Citizen

```text
Home
Report
My Reports
Notifications
Profile
```

---

## Officer

```text
My Work
Priority Problems
History
```

---

## Government

```text
Overview
Problems
Map
Departments
Trends
Governance AI
```

---

## Administrator

```text
Overview
Problems
Map
Departments
Trends
Governance AI
Administration
```

---

# 20. Dashboard Design

The administrator dashboard is the primary visual centerpiece.

It must answer:

### What needs attention?

### Why does it matter?

### Where is it happening?

### What is being done?

---

# 21. Dashboard Structure

Recommended layout:

```text
Page Header
    ↓
KPI Strip
    ↓
Priority Problems + AI Brief
    ↓
Public Impact Map
    ↓
Department / SLA Overview
    ↓
Emerging Trends
```

Do not make every section the same visual weight.

---

# 22. Dashboard Header

Example:

```text
District Intelligence

A live view of public problems, impact and response.

Last updated 4 minutes ago
```

Primary controls:

```text
Time Range
Ward
Department
Category
Status
```

Filters should be easy to find and reset.

---

# 23. KPI Strip

Use four or five high-value metrics.

Example:

```text
12,842
Citizen Signals

1,284
Active Problems

426
High Impact

82%
Resolution Rate

31 hrs
Median Response
```

Each KPI should have:

* clear label;
* value;
* optional comparison;
* optional small trend indicator.

Do not use decorative charts inside every KPI.

---

# 24. Priority Problems Section

Title:

**Priority Problems**

Supporting text:

**Issues with the highest estimated public impact.**

Example:

```text
01
Water Supply Disruption
Ward 18

Impact
92 / 100

328 signals
High severity

[View Problem]
```

The highest-priority issue should visually stand out without requiring bright neon colors.

---

# 25. Why This Is High Priority

Every important problem should have a section:

**Why this is high priority**

Example:

```text
92 / 100

High concentration
328 related signals

Long duration
3 days unresolved

Population exposure
~18,400 estimated

Critical facility
School nearby
```

This is more important than merely displaying "AI says high priority."

---

# 26. Impact Score Visualization

Use a restrained visualization.

Possible options:

* horizontal score bar;
* segmented score;
* circular indicator only when useful.

Avoid enormous decorative gauges.

Example:

```text
PUBLIC IMPACT

92 / 100
HIGH

██████████████████░░
```

Below the score show major contributing factors.

---

# 27. Public Impact Map

The map should be one of the largest components on the administrator dashboard.

Requirements:

* problem cluster markers;
* clustering at lower zoom levels;
* filtering;
* tooltip/card on selection;
* impact-aware visual encoding;
* status filtering;
* ward boundaries when available.

Do not make the map the only way to understand the data.

---

# 28. Map Legend

Provide a concise legend.

Example:

```text
● High Impact
● Medium Impact
● Low Impact

● Active
● In Progress
● Resolved
```

Do not overload the legend.

---

# 29. Problem Card

Each problem card should communicate:

```text
Category
Problem title

Location

Impact score

Signal count

Duration

Status

Assigned department
```

Optional:

```text
AI summary
```

The card should allow fast scanning.

---

# 30. Problem Detail Design

The problem detail page should use a clear two-column desktop layout.

```text
┌──────────────────────────────┬──────────────────────┐
│ Problem information          │ Impact               │
│                              │                      │
│ Title                        │ 92 / 100             │
│ Ward                         │ HIGH                 │
│ Department                   │                      │
│ Status                       │ Main factors         │
│                              │                      │
├──────────────────────────────┴──────────────────────┤
│ Evidence                                             │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Timeline                                             │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Related Signals                                     │
└─────────────────────────────────────────────────────┘
```

---

# 31. Evidence Design

Evidence should feel central to the product.

Use evidence cards for:

* citizen image;
* field report;
* resolution image;
* timestamp;
* source;
* location.

Example:

```text
Evidence

Citizen report · Aug 18, 10:42
[IMAGE]

"Water has not been available..."

Ward 18
```

---

# 32. Resolution Evidence

Resolution evidence should clearly distinguish:

### Reported Problem

from:

### Resolution Evidence

Example:

```text
REPORTED
Road damaged

        ↓

RESOLUTION EVIDENCE
Repair completed

Confidence: 91%

AI observation:
Evidence appears consistent with
the reported repair.

Human review recommended.
```

---

# 33. Timeline Design

Use a vertical timeline.

Example:

```text
● Problem detected
│
● Cluster created
│
● Assigned to Water Department
│
● Field investigation
│
● Resolution evidence submitted
│
● AI verification
│
● Human review
```

Each event should include:

* timestamp;
* actor;
* action;
* relevant metadata.

---

# 34. Status Design

Use text + icon + color.

Example:

```text
● New
● Assigned
● In Progress
● Awaiting Verification
● Resolved
● Closed
```

Do not communicate state through color alone.

---

# 35. Citizen Report Screen

Keep it extremely simple.

Recommended structure:

```text
Report a public problem

What happened?

[Describe the problem...]

[🎙 Speak]
[📷 Add photo]

Where?

[Use my location]

Optional:
Category

────────────────────

AI understood:

Water supply interruption
Ward 18
High severity

[Edit]
[Submit Report]
```

The AI preview is an important trust feature.

---

# 36. Citizen Confirmation

After submission:

```text
Report received

Your report has been added.

Water supply issue
Ward 18

Reference:
CP-10482

Related reports:
327

Current status:
Under review
```

Do not expose internal analytical information that might confuse the citizen.

---

# 37. Citizen Status Screen

Use a plain-language timeline.

```text
Report received          ✓
Under review             ✓
Assigned to department   ✓
Work in progress         ●
Resolution submitted     ○
Completed                ○
```

The citizen should not need to understand internal workflow terminology.

---

# 38. Officer Workspace

Officer dashboard should answer:

> What do I need to work on?

Example:

```text
My Work

HIGH PRIORITY
Water Supply Disruption
Ward 18
Impact 92

ROAD DAMAGE
Ward 7
Impact 81

STREETLIGHT OUTAGE
Ward 12
Impact 74
```

Sort by actionable priority rather than creation date by default.

---

# 39. Officer Problem Page

Primary layout:

```text
Problem
↓
AI Summary
↓
Location
↓
Evidence
↓
Related Signals
↓
Actions
↓
Resolution
```

Primary action should be visually obvious.

Examples:

```text
[Start Work]
[Escalate]
[Upload Evidence]
[Submit Resolution]
```

---

# 40. Governance AI Interface

Governance AI should feel like an analytical workspace, not a chatbot clone.

Recommended layout:

```text
Governance AI

Ask about public problems, trends and impact.

[ What is worsening this week?              ]

Suggested questions:

• What are the top three problems?
• Why are water problems increasing?
• Which wards have the highest unresolved impact?
• Which departments face the most SLA risk?

────────────────────────────────────

Answer

Water-related problems increased 31%
over the previous seven days...

Evidence
────────────────────────────
328 signals
Ward 18
+31% weekly change
```

---

# 41. Governance AI Answer Structure

Every answer should distinguish:

### Answer

Natural-language explanation.

### Evidence

Relevant records or metrics.

### Calculated metrics

Numbers calculated by the application.

### Recommendation

Only when applicable.

### Confidence

When meaningful.

---

# 42. AI Brief Component

The AI brief should look like a concise briefing note.

Example:

```text
AI BRIEF

Water disruptions are currently the
largest unresolved public-impact issue.

The strongest concentration is in
Wards 17–19.

Ward 18 accounts for 328 related
signals and includes exposure near
a school.

Suggested attention:
Review Ward 18 water supply status.
```

Use restrained styling.

No AI avatar is necessary.

---

# 43. Charts

Use charts only when they answer a question.

Recommended:

* line chart for trends;
* bar chart for department comparison;
* horizontal bar for priority ranking;
* area chart only when useful;
* compact sparkline for change.

Avoid:

* 3D charts;
* decorative donuts everywhere;
* overly complex chart combinations.

---

# 44. Trend Design

Example:

```text
Water Supply Signals

      ╭────╮
  ────╯    ╰─────╮
                 ╰──

Last 7 days: +31%
```

Show:

* timeframe;
* comparison;
* meaningful change.

---

# 45. Department Analytics

Example:

```text
Department Performance

Water Department
Active Problems        82
High Impact            17
Median Resolution      29 hrs
SLA Risk                8

Sanitation
Active Problems        74
High Impact            12
Median Resolution      35 hrs
SLA Risk               14
```

Users should be able to drill down.

---

# 46. Table Design

Tables should be used for operational data.

Recommended columns:

```text
Problem
Location
Impact
Signals
Department
Status
Updated
```

Use sticky headers for long tables.

Support:

* sorting;
* filtering;
* pagination;
* search.

---

# 47. Empty States

Empty states should explain what is happening.

Bad:

> No data.

Good:

> No active problems match the selected filters.

Optional CTA:

**Clear filters**

---

# 48. Error States

Example:

```text
We couldn't load this dashboard.

The data service did not respond.

[Try Again]
```

Do not expose raw error stacks.

---

# 49. Loading States

Use skeletons for dashboards.

For AI operations use meaningful progress states.

Example:

```text
Analyzing report…

Understanding issue
✓

Checking related reports
●

Calculating impact
○
```

This helps users understand that AI processing is occurring.

---

# 50. AI Processing UI

Avoid generic:

> "AI is thinking..."

Prefer:

> **Analyzing your report**

Then provide meaningful stages.

---

# 51. Notifications

Notifications should be quiet and useful.

Example:

```text
Problem updated

Your report CP-10482 is now
assigned to the Water Department.
```

Use timestamps.

Group repetitive notifications when possible.

---

# 52. Forms

Forms should:

* have clear labels;
* show examples where useful;
* validate inline;
* preserve entered data after validation errors;
* avoid unnecessary fields.

---

# 53. Accessibility

All screens must meet a high practical accessibility standard.

Required:

* semantic HTML;
* keyboard navigation;
* visible focus states;
* adequate contrast;
* accessible names;
* screen-reader-friendly status messages;
* form labels;
* non-color status cues;
* reduced-motion support.

---

# 54. Responsive Design

## Desktop

Use full navigation and rich dashboard layouts.

## Tablet

Collapse secondary panels where appropriate.

## Mobile

Prioritize:

* reporting;
* status;
* priority information;
* officer actions.

Do not simply shrink desktop dashboards.

---

# 55. Mobile Citizen Experience

Citizen reporting should be optimized for mobile-first interaction.

Primary controls should be:

* thumb-friendly;
* large enough to tap;
* clearly separated;
* easy to understand outdoors.

The reporting workflow should minimize typing.

---

# 56. Mobile Government Experience

Government dashboards may use:

* horizontally scrollable KPI areas;
* stacked problem cards;
* collapsible filters;
* full-screen map;
* bottom sheets for problem details.

---

# 57. Design for Government Context

Assume users may:

* work outdoors;
* use older laptops;
* use slower connections;
* scan information quickly;
* have many active tasks.

Therefore:

* avoid heavy animation;
* optimize large tables;
* keep text readable;
* use clear status language;
* make core actions obvious.

---

# 58. Trust Design

Trust should be communicated visually through:

* evidence;
* timestamps;
* source labels;
* confidence indicators;
* audit history;
* human-review markers.

Example:

```text
AI Interpretation

Confidence: High

Based on:
328 related reports
42 images
3 field reports

Reviewed by:
Department Officer
```

Do not use decorative "AI verified" badges without explaining what was actually verified.

---

# 59. AI vs Human Distinction

The interface must visually distinguish:

### Data

Facts stored in the system.

### Calculated

Values produced by deterministic logic.

### AI interpretation

Generated by Gemini.

### Recommendation

AI-assisted suggestion.

Example badges:

```text
DATA
CALCULATED
AI INSIGHT
RECOMMENDATION
```

Use these sparingly.

---

# 60. Data Visualization Rules

Charts and maps must:

* have readable labels;
* provide units;
* show timeframe;
* avoid misleading axes;
* use accessible encodings;
* support textual interpretation where appropriate.

Do not use charts merely because the dashboard has empty space.

---

# 61. Animation Rules

Recommended durations:

```text
micro interaction:
100–180ms

panel:
180–250ms

page transition:
200–300ms
```

Do not animate important numbers continuously.

---

# 62. Component System

Build reusable components.

Recommended component groups:

```text
ui/
├── Button
├── Input
├── Select
├── Badge
├── Dialog
├── Tooltip
├── Tabs
├── Dropdown
└── Toast

dashboard/
├── KPIStat
├── PriorityList
├── TrendCard
├── DepartmentTable
├── AIBrief
└── ImpactSummary

problems/
├── ProblemCard
├── ProblemHeader
├── ImpactScore
├── EvidenceCard
├── ProblemTimeline
├── SignalList
└── AssignmentPanel

maps/
├── ProblemMap
├── MapLegend
└── MapFilters

ai/
├── AIInsight
├── AIConfidence
├── AIProgress
├── GovernanceQuery
└── EvidenceCitation
```

---

# 63. Design Tokens

Create centralized design tokens.

Tokens should include:

```text
colors
spacing
typography
radius
shadows
breakpoints
transitions
z-index
```

Do not scatter styling constants throughout components.

---

# 64. Frontend Design Architecture

Use:

```text
Design Tokens
     ↓
UI Primitives
     ↓
Domain Components
     ↓
Page Sections
     ↓
Application Screens
```

Avoid creating unique one-off versions of the same component.

---

# 65. Content Rules

Use concise civic language.

Prefer:

**Report a Problem**

over:

**Initiate Public Issue Submission**

Prefer:

**High Impact**

over:

**Criticality Score: Elevated**

Prefer:

**Why this matters**

over:

**AI-generated rationale**

---

# 66. Localization

UI strings must be structured so that future translation is possible.

Do not hard-code large amounts of user-facing text directly across components.

Initial languages:

* English
* Hindi
* Odia

---

# 67. Design States

Components that perform asynchronous operations must support:

```text
default
hover
focus
active
disabled
loading
success
error
empty
```

---

# 68. Security-Aware UI

The UI must hide actions a user is not authorized to perform.

However, frontend hiding is not a substitute for server-side authorization.

Examples:

A citizen should not see:

**Assign Officer**

A field officer should not see:

**System Configuration**

The backend must still enforce these permissions.

---

# 69. Demo Environment Indicator

Because the hackathon MVP may use synthetic data, include a subtle but visible indicator:

```text
DEMO ENVIRONMENT
Synthetic civic data
```

It should not dominate the interface.

---

# 70. Demo-Specific Visual Priority

The following must receive the highest design attention:

## 1

Public Impact Map

## 2

Priority Problems

## 3

Problem Detail + Evidence

## 4

Impact Score Explanation

## 5

Governance AI

## 6

Resolution Verification

These form the strongest visual storytelling sequence.

---

# 71. Golden Demo Flow UI

The UI must make this journey visually obvious:

```text
Citizen Signal
      ↓
AI Understanding
      ↓
328 Related Signals
      ↓
Problem Cluster
      ↓
Impact 92
      ↓
High Priority
      ↓
Government Action
      ↓
Resolution Evidence
      ↓
AI Verification
      ↓
Governance Outcome
```

Each stage should feel connected.

---

# 72. Design Quality Bar

Before considering any screen complete, verify:

### Visual

* consistent typography;
* consistent spacing;
* consistent component styles;
* restrained color use;
* no unnecessary decorations.

### UX

* obvious primary action;
* clear hierarchy;
* predictable navigation;
* understandable language.

### Accessibility

* keyboard usable;
* accessible labels;
* contrast;
* non-color status.

### Responsiveness

* desktop;
* tablet;
* mobile.

### Trust

* evidence visible;
* AI clearly distinguished;
* confidence understandable.

---

# 73. Design Anti-Pattern Checklist

Before finalizing a screen, ask:

* Does this look like a generic AI dashboard?
* Are there too many cards?
* Are gradients being used without purpose?
* Is AI represented as decoration?
* Are users forced to interpret unexplained scores?
* Is the interface too dense?
* Is there unnecessary animation?
* Is important information hidden behind visual effects?
* Is color being used as the only status signal?

If yes, redesign the screen.

---

# 74. Final Design Principle

CivicPulse should feel like software a real public institution could trust.

The visual identity should communicate:

> **Evidence over spectacle.
> Clarity over complexity.
> Public impact over ticket volume.
> Human decisions supported by AI.**

The product should look distinctive because of its information design and civic context, not because of visual gimmicks.

---

# 75. Source of Truth

Product requirements:

`01_PRD.md`

Product scope:

`02_PRODUCT_SCOPE.md`

Technical architecture:

`03_ARCHITECTURE.md`

AI behavior:

`05_AI_SPEC.md`

Data structures:

`06_DATA_MODEL.md`

API contracts:

`07_API_SPEC.md`

Security:

`08_SECURITY.md`

Implementation sequence:

`09_PHASES.md`

Demo and evaluation:

`10_DEMO_AND_EVALUATION.md`

Engineering rules:

`11_IMPLEMENTATION_RULES.md`

When visual implementation conflicts with a functional requirement, preserve usability and functional correctness while maintaining the design principles defined in this document.
