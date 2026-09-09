# CivicPulse AI — Real Product Mode Directive

## Primary Principle
From this point forward, CivicPulse AI is treated strictly as a real production-oriented civic platform.
**REAL_MODE is the primary and authoritative product experience.**

Do NOT design new functionality around Golden Demo data.

## Role of Golden Demo Data
Golden Demo data is preserved exclusively as:
- Automated-test fixtures
- Isolated development fixtures
- Optional internal regression fixtures

**It must NEVER be used as a fallback for missing real production data.**

---

## Architectural Rule
```text
Authoritative Pipeline:
REAL_MODE UI → Backend API → Firestore / Real Reference Data / Real AI

Prohibited:
REAL_MODE UI → Hardcoded/Demo Fallback
```

---

## Mandatory Requirements for All Future Work

1. **Firestore is the operational source of truth.**
2. **Real Firebase Authentication is authoritative.**
3. **Gemini / Vertex AI is used only through backend provider abstractions.**
4. **Real geography, census population, and facility datasets are used where available.**
5. **No fabricated citizen signals.**
6. **No fabricated public problems.**
7. **No fabricated departments.**
8. **No fabricated officers.**
9. **No fabricated dashboard metrics.**
10. **No fabricated AI briefings.**
11. **No hardcoded problem counts.**
12. **No hardcoded signal counts.**
13. **No demo problem IDs in REAL_MODE.**
14. **No synthetic Golden Demo fallback when real data is empty.**
15. **Empty real data must produce honest empty states.**

---

## Testing & Infrastructure Rules
- Test fixtures are permitted inside automated test suites only.
- When a feature requires unavailable real infrastructure/data:
  - Expose the limitation clearly.
  - Create the proper provider abstraction/interface.
  - Do not fake the production data.

## Verification Checklist for Every New Feature
- [ ] **Citizen** $\rightarrow$ Firestore
- [ ] **Government** $\rightarrow$ Firestore
- [ ] **AI** $\rightarrow$ Backend provider
- [ ] **RBAC** $\rightarrow$ Backend enforcement
- [ ] **Metrics** $\rightarrow$ Backend calculation
- [ ] **UI** $\rightarrow$ Authoritative API response

Do NOT create separate frontend sources of truth.
Do NOT add DEMO_MODE-specific product functionality unless explicitly requested.
All future implementation phases must prioritize REAL_MODE.
