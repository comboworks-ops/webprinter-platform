# REST API Readiness Draft

Status: Draft v1  
Owner: Product + Engineering  
Scope: Introduce REST APIs safely without breaking pricing, tenant isolation, or current storefront/admin flows.

---

## 1) Goal

Build REST APIs in a controlled sequence.  
Do not migrate unstable features.  
Do not rewrite pricing logic.  
Expose stable behavior behind API contracts.

---

## 2) Working Method (How We Collaborate)

Use this loop per module:

1. You build/fix module in UI/domain until it feels stable.
2. You tell me: **"Module X is ready for API hardening."**
3. I run hardening checklist + define API contract draft.
4. We add read-only API wrapper first.
5. We test old path vs API path in parallel (shadow mode).
6. If stable, we switch via feature flag.
7. Only then we consider write endpoints.

This avoids shipping APIs on top of broken behavior.

---

## 3) Guardrails (Must Not Break)

- Do not change core pricing calculations without explicit approval.
- Keep POD v1 and POD v2 isolation intact.
- Keep tenant data isolation strict.
- Additive changes only (no destructive schema rewrites).
- Every new API path must have rollback via feature flag.

---

## 4) Readiness Gate (Before Any API Work)

A module is API-ready only if all are true:

- No blocking UI errors in normal flow.
- No backend 500s for the module path.
- Data shown in UI is correct vs DB/source.
- Save/publish operations work consistently.
- Tenant scoping is verified.
- At least 5 real test runs completed by you (same flow).

If one fails, we continue hardening, not API.

---

## 5) Suggested Module Order (Low Risk -> High Risk)

1. Site Designer (read)
2. Catalog browse (read)
3. Product details/options (read)
4. Pricing read/quote endpoint (read)
5. Product admin write
6. Pricing admin write
7. Order creation/update
8. Design module API
9. Tenant publish/sync APIs
10. Integration/import job APIs

Reason: read paths are easier to validate and rollback.

---

## 6) API Categories (Target ~10 Domains)

1. Auth + tenant resolution
2. Product overviews/categories
3. Product metadata/options
4. Pricing read (matrix/storformat)
5. Pricing admin write
6. Product admin write
7. Orders/checkout
8. Site designer (draft/save/publish/history)
9. Design module (assets/templates/jobs)
10. Import/integration jobs + status/logs

---

## 7) Technical Template Per Module

For each module, create:

- `Contract`: endpoint list + request/response + error codes
- `Feature flag`: `USE_API_<MODULE>`
- `Read wrapper`: API calls existing service logic (no logic rewrite)
- `Shadow comparator`: old path vs API result checks
- `Observability`: request ID, tenant ID, latency, error rate
- `Rollback`: one-step toggle back to old path

---

## 8) Minimal Definition of Done (Per Module)

- OpenAPI draft merged (or equivalent endpoint spec)
- Read endpoints stable under real data
- Shadow mismatch rate = 0 for agreed test set
- No new tenant leakage risks
- Rollback tested once
- Short runbook added in `docs/`

---

## 9) What You Should Send Me When Ready

Copy this and fill quickly:

```txt
Module ready for API hardening:
- Module: <name>
- Environment: <localhost / production tenant>
- Main flows tested: <list>
- Known remaining issues: <list or "none">
- Tenant(s) tested: <list>
- Priority: <high/medium/low>
```

Then I will produce:

1. API contract draft  
2. Hardening gap list  
3. Implementation plan with rollback flag  

---

## 10) First Practical Start (Recommended)

Start with: **Site Designer Read API**  
Why: high impact, lower risk than pricing/order writes, and easy to verify in preview.

Initial endpoints:

- `GET /api/v1/site-designer/branding?tenantId=...`
- `GET /api/v1/site-designer/themes`
- `GET /api/v1/site-designer/pages`

No writes in phase 1.

---

## 11) Tracking Table

Use this status model per module:

- `Hardening`
- `Contract Draft`
- `Read API`
- `Shadow Test`
- `Flagged Rollout`
- `Write API`
- `Done`

Keep one source-of-truth table in this file as we progress.

| Module | Status | Owner | Last Updated | Notes |
|---|---|---|---|---|
| Site Designer | Hardening | - | - | Start here |
| Catalog | Pending | - | - | |
| Pricing Read | Pending | - | - | Keep pricing logic unchanged |
| Product Admin Write | Pending | - | - | |
| Pricing Admin Write | Pending | - | - | |
| Orders | Pending | - | - | |
| Design Module | Pending | - | - | |
| Tenant Publish/Sync | Pending | - | - | |
| Import/Integrations | Pending | - | - | |

