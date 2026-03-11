# Domain Contracts

Status: Working contract map  
Purpose: Define what each domain owns, reads, writes, returns, and whether it is ready for API extraction.

This document is the bridge between:

- `docs/DOMAIN_STABILITY_MAP.md`
- `docs/CRITICAL_FLOWS.md`
- `docs/REST_API_READINESS_DRAFT.md`

Use this file when deciding:

- whether a change belongs to the correct domain
- whether a domain is stable enough for read-only API extraction
- whether a domain is allowed to write data directly

---

## 1. Important Clarification

This document is **not automatic enforcement**.

Right now it is a **working architecture contract**:

- it guides decisions
- it helps avoid boundary mistakes
- it gives a shared readiness standard

It does **not** automatically block code changes or trigger API extraction by itself.

For now, the process is:

1. we use this document as the source of truth
2. when a domain feels stable, you tell me it is ready
3. I compare the real behavior against this contract
4. only then I recommend API extraction

If you want later, this can become more operational with:

- a readiness checklist
- a tracked status table
- feature flags
- shadow testing
- CI checks around selected domains

---

## 2. Contract Status Meanings

| Status | Meaning |
|---|---|
| `Not Ready` | Too unstable or unclear for API extraction |
| `Read Candidate` | Reasonable candidate for read-only API after targeted checks |
| `Write Later` | Reads may be possible, but writes should wait |
| `Protected` | Special domain; do not extract casually |

---

## 3. Contract Summary

| Domain | Owns | Reads | Writes | Returns / Exposes | Current API Status |
|---|---|---|---|---|---|
| Shop Frontend | storefront rendering, product page composition, runtime presentation | catalog, product detail, pricing, branding, tenant context | very little domain data directly | rendered storefront UI | `Not Ready` as API domain, consumer only |
| Product + Pricing Admin | product setup, attributes, pricing structures, pricing generation/admin editing | products, options, pricing tables, admin state | product and pricing configuration | admin product/pricing structures | `Read Candidate` for reads, `Write Later` |
| Site Designer / Branding | header/footer/hero/colors/fonts/draft/publish state | tenant branding settings, preview state, assets | branding drafts, published branding settings | branding/theme payloads | `Read Candidate` after hardening, `Write Later` |
| Print Designer | canvas editing, export pipeline, preflight, proofing | templates, product dimensions, color profiles, assets | saved designs, export artifacts | design state / export jobs | `Write Later` |
| Tenant / Publish / Distribution | tenant context, visibility rules, distribution semantics | tenant records, roles, product visibility, publish state | publish state, distribution/copy results | tenant-scoped visibility/distribution outcomes | `Not Ready` until behavior is clearer |
| Supplier Imports | supplier source data transformation into internal product data | supplier inputs, product targets, import configs | imported product structures and rows | import results / logs | `Write Later` and only after standardization |
| POD v1 | legacy POD behavior | POD v1 data only | POD v1 data only | POD v1 flows | `Protected` |
| POD v2 | additive Print.com integration | POD v2 catalog/import data | POD v2 catalog/import data | POD v2 catalog/import outputs | `Protected` |

---

## 4. Domain Contracts

### 4.1 Shop Frontend

**Owns**

- storefront page rendering
- runtime composition of product pages
- customer-facing display logic

**Reads**

- tenant context
- visible catalog/products
- product detail/options
- pricing read results
- branding/theme state

**Writes**

- very limited direct writes
- mostly consumes data rather than owning it

**Returns / Exposes**

- rendered pages
- selected state in the browser

**Must not own**

- pricing generation logic
- tenant publish rules
- branding editor state
- import behavior

**API extraction judgment**

- The frontend itself is not the first API domain.
- It should become a clean consumer of APIs from other domains.

**Current status**

- `Not Ready` as an API domain
- treat as a runtime consumer, not a contract owner

---

### 4.2 Product + Pricing Admin

**Owns**

- product setup
- attributes and option structure
- pricing configuration
- matrix pricing generation/admin editing

**Reads**

- products
- product options
- published pricing rows
- machine/material data where relevant

**Writes**

- product configuration
- pricing structures
- generated/admin-managed pricing records

**Returns / Exposes**

- product metadata
- option structures
- pricing matrix configuration
- published pricing data for storefront consumption

**Must not own**

- designer canvas/export logic
- site branding runtime
- POD-specific integration behavior

**API extraction judgment**

- strong candidate for read-only API extraction
- write APIs should come later, after read contracts are stable

**Good first API surfaces**

- product overview/category reads
- product detail/options reads
- pricing read/quote reads

**Current status**

- `Read Candidate`
- `Write Later`

---

### 4.3 Site Designer / Branding

**Owns**

- header/footer/hero setup
- colors and fonts
- branding drafts
- preview-to-publish branding state

**Reads**

- tenant settings
- branding drafts/published branding state
- tenant assets and media
- preview state

**Writes**

- draft branding state
- published branding state
- related appearance configuration

**Returns / Exposes**

- branding payloads
- theme/style payloads
- preview/runtime settings

**Must not own**

- core pricing logic
- supplier import behavior
- print designer export logic

**API extraction judgment**

- good read-only API candidate, but only after runtime expectations are clearer
- do not start with writes if preview/publish behavior still feels ambiguous

**Good first API surfaces**

- branding/theme read
- available page/theme metadata
- published branding read

**Current status**

- `Read Candidate`
- `Write Later`

---

### 4.4 Print Designer

**Owns**

- canvas editing
- preflight
- export logic
- soft proofing / color proofing

**Reads**

- templates
- product dimensions/specs
- uploaded assets
- color profiles

**Writes**

- saved designs
- export artifacts
- related design metadata

**Returns / Exposes**

- design state
- export outputs
- validation/preflight results

**Must not own**

- pricing logic
- tenant publish logic
- storefront theme rules

**API extraction judgment**

- not first-wave API work
- only after the read contracts for product/pricing/tenant are stable

**Good eventual API surfaces**

- design save/load
- asset/template lists
- export job status

**Current status**

- `Write Later`

---

### 4.5 Tenant / Publish / Distribution

**Owns**

- tenant context
- publish state
- distribution/copy semantics
- visibility rules across tenants

**Reads**

- tenant records
- user roles
- product visibility state
- publish status
- master/tenant relationships

**Writes**

- publish flags/state
- product distribution results
- tenant-scoped visibility outcomes

**Returns / Exposes**

- tenant-scoped access context
- visibility decisions
- distribution outcomes

**Must not own**

- pricing calculation
- design export
- supplier-specific parsing

**API extraction judgment**

- this domain is too sensitive to expose early unless the behavior is fully pinned down
- it should be hardened before API work, not after

**Good eventual API surfaces**

- tenant context read
- publish state read
- controlled distribution actions later

**Current status**

- `Not Ready`

---

### 4.6 Supplier Imports

**Owns**

- supplier data retrieval and shaping
- import-specific mapping from supplier structure into internal product structure

**Reads**

- supplier pages/data
- import profiles/config
- target tenant/product context

**Writes**

- new product structures
- price rows
- import artifacts/logs

**Returns / Exposes**

- imported products
- import logs/snapshots
- validation results

**Must not own**

- storefront runtime rules
- core pricing engine behavior
- tenant resolution logic

**API extraction judgment**

- not ready as a clean API domain yet
- imports need standardization first

**Good eventual API surfaces**

- import job start/status/log
- supplier profile definitions

**Current status**

- `Write Later`

---

### 4.7 POD v1

**Owns**

- legacy POD-specific flows

**Reads**

- POD v1-specific data only

**Writes**

- POD v1-specific data only

**Returns / Exposes**

- POD v1 runtime behavior

**Must not own**

- POD v2 logic
- core pricing refactors
- cross-domain platform restructuring

**API extraction judgment**

- protected legacy domain

**Current status**

- `Protected`

---

### 4.8 POD v2

**Owns**

- additive Print.com integration
- POD v2 catalog/import logic

**Reads**

- POD v2 catalog/import data

**Writes**

- POD v2 catalog/import data

**Returns / Exposes**

- POD v2 import/catalog outcomes

**Must not own**

- core pricing engine behavior
- POD v1 behavior
- tenant-wide unrelated domain behavior

**API extraction judgment**

- protected additive domain
- changes must follow `POD2_README.md`

**Current status**

- `Protected`

---

## 5. Practical Readiness Gate

Before I recommend API extraction for any domain, I should be able to say yes to all of these:

1. ownership is clear
2. read path is clear
3. write path is clear
4. tenant scoping is verified
5. critical flows still pass
6. no blocking 500s remain
7. the domain can be rolled back by flag or fallback path

If one of those is missing, I should not call the domain API-ready.

---

## 6. Answer To Your Practical Question

### Will this activate automatically so I notice it is good enough for API extraction?

**No, not automatically yet.**

Right now this is a **manual architecture gate**, not an automated one.

What this means in practice:

- I will use this document as the standard when we discuss API extraction
- but you still need to tell me when a module feels ready
- then I evaluate it against this contract and the readiness rules

So the practical trigger is still:

**“Module X is ready for API hardening.”**

Then I check:

- does it match the domain contract?
- does it pass the critical flow expectations?
- is it ready for read-only API first?

### Can this become more automatic later?

Yes.

Later we can add:

- a module readiness table
- a checkbox checklist per domain
- a feature flag registry
- shadow-read verification
- CI or admin runbook checks

That would make it much more operational.

---

## 7. Best Next Step After This

The next useful document is:

- `docs/API_ROLLOUT_PLAN.md`

That should translate these contracts into:

- exact API order
- exact first endpoints
- what is read-only first
- what must wait
- what can be feature-flagged

