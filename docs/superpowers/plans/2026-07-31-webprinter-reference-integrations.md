# Webprinter Reference Integrations Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use subagent-driven-development to implement this plan.

**Goal:** Add opt-in, evidence-preserving reference integrations for ECB/Frankfurter EUR/DKK rates, optional VIES and official Danish business/address lookups, and display-only PostNord tracking, without changing Webprinter's authoritative pricing, checkout, POD, supplier-submission, or order-status behavior.

**Architecture:** Introduce small pure contracts first, then additive service-role-owned evidence tables and authenticated server adapters. Existing supplier imports keep their current fixed conversion rules unless an operator explicitly supplies an immutable FX snapshot. Business verification remains optional and non-blocking. PostNord events are normalized into a versioned display-only stream. Browser code may read tenant-scoped evidence but never receives provider credentials or chooses provider URLs.

**Tech Stack:** React 18, TypeScript, Vite, Node test runner, Supabase PostgreSQL/RLS, Supabase Edge Functions/Deno, Zod, TanStack Query, existing supplier-import scripts.

## Global Constraints

- Read `AGENTS.md`, `POD2_README.md`, `AI_CONTINUITY.md`, `SYSTEM_OVERVIEW.md`, and `.agent/HANDOVER.md` before implementation.
- Treat existing pricing and POD behavior as protected. Do not modify storefront price calculation, `product_price` behavior, Matrix/MPA/STORFORMAT semantics, POD v1, or POD v2 submission/payment gates.
- Keep `scripts/product-import/shared/conversion.js` backward compatible. Existing fixed-rate rule keys and their exact outputs remain frozen.
- FX snapshot use is opt-in per supplier-import execution. An absent snapshot must preserve today's fixed rule and output byte-for-byte.
- Keep supplier rate, pricing buffer, and markup as separate named values and evidence fields. Never replace them with one opaque multiplier.
- Never reprice, update, republish, or backfill an existing published product row. Snapshot-based prices may target only a newly created or explicitly selected unpublished draft.
- No task in this plan performs a live supplier catalog import, supplier order, price publication, product publication, production submission, payment, or customer-order mutation.
- Frankfurter/ECB, VIES, official Danish company/address, and PostNord calls run server-side only. No provider URL, token, API key, signing secret, or service-role key may be stored in `VITE_*`, browser code, tenant settings, logs, or returned error detail.
- Provider adapters use fixed allow-listed origins, bounded timeouts, bounded response sizes, explicit schema validation, and sanitized errors. A browser request may select a supported operation, never an arbitrary URL.
- VIES uses the European Commission REST base `https://ec.europa.eu/taxation_customs/vies/rest-api/`: `POST check-vat-number` with separate `countryCode`/`vatNumber`, and `GET check-status` for provider/member-state availability. A `valid: false` response is `invalid`; HTTP/provider/member-state failure is `unavailable`.
- The authoritative CVR distribution service remains disabled until Erhvervsstyrelsen credentials are issued and a credential-safe HTTPS transport is confirmed. Official examples currently document Basic authentication to `http://distribution.virk.dk/cvr-permanent/...`; never transmit credentials over plaintext HTTP and never scrape CVR.dk as a fallback.
- New Danish address-data work uses a pinned, configured Datafordeler DAR GraphQL HTTPS schema (`https://graphql.datafordeler.dk/DAR/<version>`) with a server-only API key/OAuth credential. Do not build new work on DAWA, which closes 2026-10-01 10:00 CEST, and keep Adressevælger/Adressevask unavailable until KDS publishes/provides an implementable endpoint contract.
- PostNord uses Track & Trace v5 only (`https://atapi2.postnord.com` sandbox, `https://api2.postnord.com` production, fixed `/rest/shipment/v5/trackandtrace/findByIdentifier.json`). Production remains disabled until a Customer/Partner plan, API key, retention terms, and approval exist; honor 429 and never bulk/constant poll.
- VIES and Danish business/address evidence is optional. Provider timeout, outage, unavailable credentials, inconclusive data, or a negative result must not block account creation, tenant creation, login, checkout, ordering, or later edits.
- VIES evidence is not a tax decision. Store the provider result and evidence timestamp; do not automatically alter VAT, prices, invoices, checkout, or customer eligibility.
- PostNord ingestion is versioned and display-only. It must not update `orders.status`, `shipped_at`, `delivered_at`, email notifications, POD jobs, payment state, or supplier state.
- New database writes are service-role-only through reviewed Edge Functions. Authenticated tenants receive read-only access only to rows in tenants they can access; master admins may read all rows. Anonymous users receive no Data API access.
- Every new public table/function needs explicit `REVOKE`/`GRANT`, RLS, indexes, uniqueness/idempotency constraints, comments, and a rollback section in the same migration. Run `npm run check:supabase-grants` after every migration edit.
- Edge Functions that accept user sessions must verify JWT and re-check tenant access server-side. Any cron path requires a constant-time checked, 32+ character server secret and bounded batch size.
- Preserve the Print.com submission claim, fresh validation, payment evidence, uncertain-response lock, and duplicate supplier-reference safeguards in `20260714190000_harden_print_production_submission.sql` and `src/lib/print-production/orderSubmission.ts`.
- Do not modify, move, delete, format, import from, or overwrite the pre-existing ERPNext pilot snapshot anchored in isolated baseline commit `58ccc6d0`:
  - `docs/ERPNEXT_SHADOW_PILOT.md`
  - `src/lib/erpnext/`
  - `supabase/functions/_shared/erpShadow.ts`
  - `supabase/functions/_shared/erpShadow.test.ts`
- Do not reuse ERPNext outbox/event concepts for these integrations. They have independent schemas, flags, adapters, and rollback paths.
- Use additive migrations only. Do not rename or reinterpret the undocumented remote `delivery_tracking` object; the PostNord stream gets a new versioned table.
- Keep all runtime flags disabled by default. Enabling a hosted provider or cron schedule requires separate operator approval after source review and staging evidence.
- Commit each reviewed task locally on the isolated `codex/external-reference-integrations` branch as required by subagent-driven-development. Do not push, deploy, link Supabase, apply migrations, call live providers/suppliers, or write hosted data unless a later user request explicitly authorizes that action.

## Planned File Map

### FX contracts and supplier-import integration

- Create `scripts/product-import/shared/fx-snapshot.js`
- Create `scripts/product-import/shared/snapshot-pricing.js`
- Create `scripts/product-import/__tests__/fx-snapshot.test.js`
- Create `scripts/product-import/__tests__/snapshot-pricing.test.js`
- Modify `scripts/product-import/shared/normalized-pricing.js`
- Modify `scripts/product-import/__tests__/shared-importers.test.js`
- Modify one pilot importer only: `scripts/fetch2-wmd-roll-labels.mjs`
- Create `supabase/functions/_shared/referenceFx.ts`
- Create `supabase/functions/_shared/referenceFx.test.ts`
- Create `supabase/functions/reference-fx-snapshot/index.ts`

### Danish identity and VIES

- Create `src/lib/onboarding/danishBusinessIdentity.ts`
- Create `src/lib/onboarding/danishBusinessIdentity.test.ts`
- Create `src/components/admin/BusinessIdentityEvidence.tsx`
- Modify `src/components/admin/ShopSettings.tsx`
- Create `supabase/functions/_shared/businessEvidence.ts`
- Create `supabase/functions/_shared/businessEvidence.test.ts`
- Create `supabase/functions/_shared/providers/viesProvider.ts`
- Create `supabase/functions/_shared/providers/danishCompanyProvider.ts`
- Create `supabase/functions/_shared/providers/danishAddressProvider.ts`
- Create `supabase/functions/tenant-business-evidence/index.ts`

### PostNord tracking

- Create `src/lib/delivery/trackingEvents.ts`
- Create `src/lib/delivery/trackingEvents.test.ts`
- Create `src/components/account/TrackingEventTimeline.tsx`
- Modify `src/pages/MyOrders.tsx`
- Modify `src/components/admin/OrderManager.tsx`
- Create `supabase/functions/_shared/postnordTracking.ts`
- Create `supabase/functions/_shared/postnordTracking.test.ts`
- Create `supabase/functions/postnord-tracking-sync/index.ts`

### Schema, config, security, and documentation

- Create `supabase/migrations/20260731120000_reference_integration_evidence.sql`
- Modify `supabase/config.toml`
- Modify `scripts/check-supabase-function-exposure.js` only if its explicit allow-list requires the new authenticated functions
- Create `docs/REFERENCE_INTEGRATIONS.md`
- Modify `SYSTEM_OVERVIEW.md`
- Modify `AI_CONTINUITY.md`
- Modify `POD2_README.md` only to state that these integrations do not change POD contracts

---

## Task 1: Lock The Baseline And Forbidden Boundaries

**Files:**
- Read: `scripts/product-import/shared/conversion.js`
- Read: `scripts/product-import/shared/normalized-pricing.js`
- Read: `src/lib/print-production/orderSubmission.ts`
- Read: `supabase/migrations/20260714190000_harden_print_production_submission.sql`
- Do not modify: the ERPNext paths listed in Global Constraints

- [ ] **Step 1: Capture a read-only worktree baseline**

Run:

```bash
git status --short --branch
git status --short -- docs/ERPNEXT_SHADOW_PILOT.md src/lib/erpnext supabase/functions/_shared/erpShadow.ts supabase/functions/_shared/erpShadow.test.ts
```

Expected: the ERPNext paths are clean relative to isolated baseline `58ccc6d0` and are recorded as pre-existing owner work. Their original source working-tree state remains untouched.

- [ ] **Step 2: Run the existing pricing and POD safety tests before edits**

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test scripts/product-import/__tests__/shared-importers.test.js scripts/product-import/__tests__/ul-prices.test.js
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --experimental-strip-types src/lib/print-production/orderSubmission.test.ts
```

Expected: PASS. If either command fails before implementation, stop and report the baseline failure without changing protected pricing/POD code.

- [ ] **Step 3: Record the protected pricing outputs in the new FX test fixture**

The later FX tests must include these compatibility assertions:

- `applyConversionRule(100, "wmd_tiered_fx_7_5")` still returns `convertedPriceDkk = 750` and `finalPriceDkk = 1200`.
- `applyConversionRule(500, "wmd_roll_labels_threshold_fx_7_6")` still returns `convertedPriceDkk = 3800` and `finalPriceDkk = 6080`.
- No new code path runs unless an explicit snapshot argument or `--fx-snapshot-file` flag is present.

---

## Task 2: Define An Immutable ECB/Frankfurter Snapshot Contract

**Files:**
- Create: `scripts/product-import/shared/fx-snapshot.js`
- Test: `scripts/product-import/__tests__/fx-snapshot.test.js`

**Contract:**

```js
{
  schemaVersion: 1,
  provider: "frankfurter_ecb",
  baseCurrency: "EUR",
  quoteCurrency: "DKK",
  rate: 7.4601,
  rateDate: "2026-07-30",
  fetchedAt: "2026-07-31T08:15:00.000Z",
  sourcePayloadSha256: "<64 lowercase hex characters>"
}
```

- [ ] **Step 1: Write the failing snapshot tests**

Cover:

1. A valid EUR/DKK Frankfurter payload becomes the exact versioned contract.
2. `rateDate` comes from provider data, never from local wall-clock date.
3. `fetchedAt` is supplied by the caller for deterministic tests.
4. Unknown provider, non-EUR/DKK currencies, zero/negative/non-finite rate, invalid dates, and invalid SHA-256 fail closed.
5. Extra provider fields are ignored only before hashing; the stored digest is computed from the exact raw response bytes.
6. Canonical serialization is stable regardless of object key order.
7. The returned snapshot and nested evidence are frozen in memory.

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test scripts/product-import/__tests__/fx-snapshot.test.js
```

Expected: FAIL because `fx-snapshot.js` does not exist.

- [ ] **Step 2: Implement the smallest pure parser**

Export only:

```js
export function parseFrankfurterEurDkkSnapshot(rawBody, fetchedAt) {}
export function parseFxSnapshot(input) {}
export function canonicalizeFxSnapshot(snapshot) {}
```

Do not fetch the network, read environment variables, or know about markups in this module.

- [ ] **Step 3: Re-run the focused test**

Run the Step 1 command.

Expected: PASS.

---

## Task 3: Keep FX, Buffer, And Markup Mathematically Separate

**Files:**
- Create: `scripts/product-import/shared/snapshot-pricing.js`
- Test: `scripts/product-import/__tests__/snapshot-pricing.test.js`
- Do not modify yet: `scripts/product-import/shared/conversion.js`

**Result shape:**

```js
{
  supplierCurrency: "EUR",
  supplierPrice: 100,
  fxSnapshotId: "snapshot-1",
  fxRate: 7.46,
  convertedPriceDkk: 746,
  pricingBuffer: { type: "percent", value: 2, amountDkk: 14.92 },
  bufferedCostDkk: 760.92,
  markup: { type: "percent", value: 60, amountDkk: 456.552 },
  finalPriceDkk: 1218,
  roundingStepDkk: 1
}
```

- [ ] **Step 1: Write failing arithmetic tests**

Cover:

1. EUR `100 * 7.46 = 746` before any buffer.
2. A 2% buffer is `14.92`, producing buffered cost `760.92`.
3. A 60% markup is calculated from buffered cost and recorded as `456.552`.
4. Only `finalPriceDkk` is rounded to the configured step; evidence values retain bounded decimal precision.
5. A zero buffer and zero markup remain explicit objects, not omitted fields.
6. Fixed-percent and existing WMD tier markup policies produce named markup evidence.
7. A snapshot date/rate is never mutated by pricing code.
8. Invalid or missing snapshot IDs, negative inputs, hidden combined factors, and unsupported policies fail closed.

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test scripts/product-import/__tests__/snapshot-pricing.test.js
```

Expected: FAIL because `snapshot-pricing.js` does not exist.

- [ ] **Step 2: Implement `applySnapshotPricing`**

Export:

```js
export function applySnapshotPricing({
  supplierPrice,
  fxSnapshot,
  fxSnapshotId,
  pricingBuffer,
  markupPolicy,
  roundingStepDkk,
}) {}
```

Do not call or change the legacy conversion rules. Reject any config containing `combinedMultiplier`, `allInFactor`, or an equivalent opaque input.

- [ ] **Step 3: Run new and legacy tests together**

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test scripts/product-import/__tests__/snapshot-pricing.test.js scripts/product-import/__tests__/shared-importers.test.js scripts/product-import/__tests__/ul-prices.test.js
```

Expected: PASS with unchanged legacy assertions.

---

## Task 4: Persist Immutable Reference Evidence With Explicit RLS And Grants

**Files:**
- Create: `supabase/migrations/20260731120000_reference_integration_evidence.sql`

Create three additive tables:

1. `public.supplier_fx_rate_snapshots`
   - immutable provider evidence;
   - unique `(provider, base_currency, quote_currency, rate_date, source_payload_sha256)`;
   - authenticated tenant users may read the non-secret reference rate;
   - only `service_role` may insert;
   - no role may update/delete through the Data API.
2. `public.tenant_business_evidence`
   - `tenant_id`, `evidence_type`, normalized identifier, provider, result status, provider reference, checked/received timestamps, request fingerprint, response digest, minimal non-sensitive display fields, schema version;
   - unique idempotency key per tenant/provider/request fingerprint;
   - tenant members read their own rows; master admins read all; only `service_role` writes.
3. `public.carrier_tracking_events_v1`
   - `tenant_id`, `order_id`, `carrier`, `tracking_number`, schema version, provider event ID, provider status, normalized display type, occurred/received timestamps, optional bounded location/description, source digest;
   - unique `(carrier, tracking_number, provider_event_id)` and deterministic fallback dedupe key;
   - tenant members read events for accessible tenant orders; master admins read all; only `service_role` writes.

- [ ] **Step 1: Write the migration with rollback comments before applying anything**

The top rollback block must name the exact safe order:

```sql
-- 1. Disable reference-fx-snapshot, tenant-business-evidence, and postnord-tracking-sync.
-- 2. Stop all reference-integration cron invocations.
-- 3. Drop policies and explicit grants/functions introduced here.
-- 4. Drop carrier_tracking_events_v1, tenant_business_evidence, supplier_fx_rate_snapshots.
-- Existing products, product prices, orders, delivery_tracking, POD tables, and ERP shadow files are untouched.
```

Add an immutable trigger for `supplier_fx_rate_snapshots` that raises on `UPDATE` or `DELETE`. Do not create any update/delete RPC.

- [ ] **Step 2: Add explicit grants and RLS**

For every table:

```sql
REVOKE ALL ON TABLE public.<table> FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.<table> TO authenticated;
GRANT ALL ON TABLE public.<table> TO service_role;
```

Enable RLS and add only read policies for `authenticated`. Do not add authenticated insert/update/delete policies. Add `-- data-api:` decisions next to each grant block.

- [ ] **Step 3: Run static migration gates**

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-migration-grants.js
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-company-hub-v2-foundation.mjs
```

Expected: PASS. Do not run `supabase db push`.

---

## Task 5: Add A Server-Only Frankfurter/ECB Snapshot Adapter

**Files:**
- Create: `supabase/functions/_shared/referenceFx.ts`
- Test: `supabase/functions/_shared/referenceFx.test.ts`
- Create: `supabase/functions/reference-fx-snapshot/index.ts`

- [ ] **Step 1: Write failing provider-boundary tests**

Cover:

1. Only a constant official Frankfurter base URL is accepted.
2. The request is always EUR base with DKK quote and has a bounded timeout.
3. Redirects to another origin are rejected.
4. Non-2xx, non-JSON, oversized payloads, missing DKK rate, invalid dates, and stale rates fail closed.
5. Raw response bytes are SHA-256 hashed before parsing.
6. An exact replay returns the existing snapshot ID instead of inserting another row.
7. The response exposes snapshot metadata but no service-role key or raw internal error.

Run:

```bash
deno test supabase/functions/_shared/referenceFx.test.ts
```

Expected: FAIL because `referenceFx.ts` does not exist.

- [ ] **Step 2: Implement the shared adapter with injected `fetch`**

The shared module must have no Supabase client. Export pure request construction, payload validation, digesting, and staleness checks so tests use a fake `fetch`.

- [ ] **Step 3: Implement the Edge Function**

Requirements:

- JWT required.
- Exact `master_admin` role and master-tenant context required.
- Service-role client created only after authorization.
- Accept only `{ baseCurrency: "EUR", quoteCurrency: "DKK", expectedRateDate?: "YYYY-MM-DD" }`.
- Fetch one fixed provider endpoint, insert immutable snapshot, and return the existing row on uniqueness conflict.
- No scheduled refresh and no import invocation in this task.
- Log only request ID, provider, rate date, and success/failure category.

- [ ] **Step 4: Run focused tests and exposure checks**

Run:

```bash
deno test supabase/functions/_shared/referenceFx.test.ts
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-function-exposure.js
```

Expected: PASS.

---

## Task 6: Wire One Opt-In Supplier Import Without Repricing Published Rows

**Files:**
- Modify: `scripts/product-import/shared/normalized-pricing.js`
- Modify: `scripts/product-import/__tests__/shared-importers.test.js`
- Modify: `scripts/fetch2-wmd-roll-labels.mjs`
- Test: `scripts/product-import/__tests__/snapshot-pricing.test.js`

- [ ] **Step 1: Write failing normalized-evidence tests**

Add cases proving a snapshot-priced normalized record contains separate:

- `fxSnapshotId`, provider, rate, rate date, and digest;
- `convertedPriceDkk`;
- `pricingBuffer` and `bufferedCostDkk`;
- `markupInputs` and markup amount;
- `finalPriceDkk`.

Also prove a legacy record without snapshot fields remains valid and serializes exactly as before.

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test scripts/product-import/__tests__/shared-importers.test.js scripts/product-import/__tests__/snapshot-pricing.test.js
```

Expected: FAIL on the new snapshot assertions.

- [ ] **Step 2: Extend normalized pricing additively**

Add optional `fxSnapshot` and `pricingBuffer` objects. Do not rename or change the meaning of `supplierPrice`, `convertedPriceDkk`, `finalPriceDkk`, `conversionRuleKey`, or `markupInputs`.

- [ ] **Step 3: Add an explicit pilot flag to the roll-label importer**

Support only:

```text
--fx-snapshot-file <absolute-or-repo-relative-json>
--pricing-buffer-pct <non-negative-number>
```

Rules:

- Without `--fx-snapshot-file`, execute the current `DEFAULT_FX`/legacy conversion path unchanged.
- With the flag, parse a previously captured immutable snapshot and use `applySnapshotPricing`.
- Never fetch Frankfurter from the importer.
- Preview output must print rate date, snapshot digest, converted cost, buffer, markup, and final DKK as separate columns.
- Reject snapshot mode for any write targeting a published product.
- Snapshot mode may write only to an unpublished supplier-bank/draft target after the operator separately passes the existing write flag.
- This plan's verification runs preview/test modes only and never supplies a write flag.

- [ ] **Step 4: Add the published-target guard test**

Test that `{ isPublished: true, snapshotMode: true }` fails before any price-row write and that an unpublished draft passes. Assert the rejection occurs before a mocked Supabase insert/update method is called.

- [ ] **Step 5: Run focused and legacy tests**

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test scripts/product-import/__tests__/fx-snapshot.test.js scripts/product-import/__tests__/snapshot-pricing.test.js scripts/product-import/__tests__/shared-importers.test.js scripts/product-import/__tests__/ul-prices.test.js
```

Expected: PASS. Do not run an importer command that contacts a supplier or writes data.

---

## Task 7: Define Danish Business Identity As Optional Onboarding Data

**Files:**
- Create: `src/lib/onboarding/danishBusinessIdentity.ts`
- Test: `src/lib/onboarding/danishBusinessIdentity.test.ts`
- Modify: `src/components/admin/ShopSettings.tsx`
- Create: `src/components/admin/BusinessIdentityEvidence.tsx`

- [ ] **Step 1: Write failing pure validation tests**

Cover:

1. CVR accepts eight digits with spaces/hyphens removed and normalizes to `DK12345678` for VIES.
2. Invalid CVR remains editable but cannot start verification.
3. Danish address fields are structured as street name, house number, floor/door optional, four-digit postcode, city, and country `DK`.
4. Existing free-text `settings.company.address` parses only when unambiguous; otherwise it remains untouched and the structured form starts empty.
5. The save payload preserves unrelated tenant settings by merge.
6. `unknown`, `pending`, `valid`, `invalid`, `unavailable`, and `stale` are display states only.
7. No evidence state changes price, VAT, checkout, signup completion, or tenant access.

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --experimental-strip-types src/lib/onboarding/danishBusinessIdentity.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement pure normalization and merge helpers**

Keep them independent of React and Supabase. Do not call providers from this module.

- [ ] **Step 3: Add structured fields to Shop Settings**

Requirements:

- Keep existing `company.address` and `company.cvr` readable for backward compatibility.
- Add `company.business_identity_v1` as an additive structured object.
- Saving company data does not invoke VIES or any Danish provider.
- Add a separate `Kontrollér virksomhedsoplysninger` action after settings are saved.
- A failed verification shows a non-blocking status and retry action; it does not roll back saved company data.
- Render only current tenant evidence returned through tenant-scoped reads.

- [ ] **Step 4: Run focused tests**

Run the Step 1 command.

Expected: PASS.

---

## Task 8: Implement VIES And Official Danish Provider Boundaries

**Files:**
- Create: `supabase/functions/_shared/businessEvidence.ts`
- Test: `supabase/functions/_shared/businessEvidence.test.ts`
- Create: `supabase/functions/_shared/providers/viesProvider.ts`
- Create: `supabase/functions/_shared/providers/danishCompanyProvider.ts`
- Create: `supabase/functions/_shared/providers/danishAddressProvider.ts`
- Create: `supabase/functions/tenant-business-evidence/index.ts`

- [ ] **Step 1: Write failing contract tests with fake providers**

Cover:

1. A provider implements `verify(input, context)` and returns versioned evidence, never a persistence row directly.
2. VIES receives normalized country code and VAT number separately.
3. Official Danish company lookup and official Danish address lookup are distinct adapters; neither silently falls back to a commercial scraper.
4. Provider base URLs are constants/allow-listed server config, not request values.
5. Provider credentials are optional server config; missing credentials yield `unavailable`, not an exception that blocks onboarding.
6. Timeouts, malformed/oversized responses, and upstream 5xx become sanitized `unavailable` evidence.
7. VIES `valid: false` becomes `invalid` evidence and does not mutate tenant tax or checkout settings.
8. Response digests and request fingerprints are deterministic; raw upstream payloads, names, and addresses are not logged.
9. Replaying a request returns the existing evidence row by idempotency key.
10. Tenant A cannot request or read evidence for tenant B.

Run:

```bash
deno test supabase/functions/_shared/businessEvidence.test.ts
```

Expected: FAIL because the shared module does not exist.

- [ ] **Step 2: Implement provider interfaces and official adapters**

Provider rules:

- `viesProvider.ts`: fixed official VIES service boundary; map only VAT validity, request identifier, provider name/address summary when legally and technically returned, and provider timestamp/reference.
- `danishCompanyProvider.ts`: expose the bounded Erhvervsstyrelsen CVR query/response contract, but return `unavailable` unless credentials and a reviewed HTTPS endpoint are configured. Query only `Vrvirksomhed.cvrNummer` and the minimal approved `_source` fields; do not send Basic credentials to the documented plaintext origin and do not invent/scrape an alternative.
- `danishAddressProvider.ts`: use a pinned configured Datafordeler DAR GraphQL schema and select only stable address ID plus the structured display fields required by the form. Keep API key/OAuth server-only and sanitized from URLs/logs. Do not call legacy DAWA or an undocumented Adressevælger/Adressevask endpoint.
- Every adapter receives injected `fetch`, timeout signal, maximum bytes, and correlation ID.

- [ ] **Step 3: Implement the authenticated Edge Function**

Accept:

```ts
type Request =
  | { operation: "vies"; tenantId: string; cvr: string }
  | { operation: "danish_company"; tenantId: string; cvr: string }
  | { operation: "danish_address"; tenantId: string; query: StructuredAddressQuery };
```

Requirements:

- Verify user JWT, then `can_access_tenant(tenantId)` or exact master role.
- Validate and normalize input before any provider call.
- Use service role only for evidence insert/select replay.
- Store minimal evidence plus hashes; do not store raw provider credentials or full raw payloads.
- Return a stable display DTO and HTTP 200 for `valid`, `invalid`, or `unavailable`; reserve 4xx for caller/auth/schema errors.
- Do not modify `tenants`, checkout, orders, products, prices, invoices, POD, or legal-acceptance rows.

- [ ] **Step 4: Run tests and security checks**

Run:

```bash
deno test supabase/functions/_shared/businessEvidence.test.ts
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-function-exposure.js
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-migration-grants.js
```

Expected: PASS.

---

## Task 9: Define A Versioned, Display-Only PostNord Event Contract

**Files:**
- Create: `supabase/functions/_shared/postnordTracking.ts`
- Test: `supabase/functions/_shared/postnordTracking.test.ts`
- Create: `src/lib/delivery/trackingEvents.ts`
- Test: `src/lib/delivery/trackingEvents.test.ts`

- [ ] **Step 1: Write failing server normalization tests**

Cover:

1. Supported PostNord payload maps to `schemaVersion: 1`, `carrier: "postnord"`, provider event ID/status, normalized display type, bounded description/location, occurred time, received time, and source digest.
2. Events are sorted by occurred time for display but retained as independent immutable rows.
3. Exact replay and fallback dedupe do not create duplicates.
4. Unknown provider statuses map to `unknown`, remain displayable, and never map directly to an order mutation.
5. Missing event ID uses a deterministic digest-based key.
6. Invalid timestamps, mismatched tracking numbers, oversized text, malformed payloads, and events for an unrelated order fail closed.
7. The module has no function that writes orders or sends email.

Run:

```bash
deno test supabase/functions/_shared/postnordTracking.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the server contract**

Keep provider status and normalized display type separate. Include `effect: "display_only"` in the normalized in-memory contract and require it during validation.

- [ ] **Step 3: Write failing client presentation tests**

Cover:

1. Version 1 rows map to Danish display labels.
2. Unknown/new schema versions render a safe generic event rather than crashing.
3. Legacy `delivery_tracking` rows can still render through the existing fallback shape.
4. Timeline ordering does not infer or update an order status.

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --experimental-strip-types src/lib/delivery/trackingEvents.test.ts
```

Expected: FAIL because `trackingEvents.ts` does not exist.

- [ ] **Step 4: Implement the client presentation mapper and run both suites**

Run:

```bash
deno test supabase/functions/_shared/postnordTracking.test.ts
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --experimental-strip-types src/lib/delivery/trackingEvents.test.ts
```

Expected: PASS.

---

## Task 10: Implement Authenticated PostNord Sync With Service-Role Writes

**Files:**
- Create: `supabase/functions/postnord-tracking-sync/index.ts`
- Test through: `supabase/functions/_shared/postnordTracking.test.ts`

- [ ] **Step 1: Add failing orchestration tests around injected dependencies**

Cover:

1. User invocation requires JWT plus tenant access and reads the tracking number from the existing order server-side.
2. Master invocation may read any tenant order but still cannot submit an arbitrary tracking number or provider URL.
3. Optional cron invocation requires a 32+ character secret, constant-time comparison, and a bounded maximum batch.
4. Missing PostNord Customer/Partner approval, production API key, or configuration returns `provider_unavailable` without inserting an event.
5. Provider fetch uses Track & Trace v5 on the exact environment allowlist (`atapi2.postnord.com` sandbox or `api2.postnord.com` production), the fixed `findByIdentifier.json` path, timeout, no cross-origin redirect, bounded response bytes, and 429 retry handling. It never accepts a browser-supplied tracking number; the order supplies it server-side.
6. Event insert uses service role and `ON CONFLICT`/unique replay behavior.
7. Success inserts tracking events only; mocked calls prove zero updates to `orders`, `order_status_history`, email functions, POD jobs, or supplier functions.

Run:

```bash
deno test supabase/functions/_shared/postnordTracking.test.ts
```

Expected: FAIL on the new orchestration cases.

- [ ] **Step 2: Implement the function**

Accepted user body:

```json
{ "orderId": "<uuid>" }
```

The function must:

1. authorize the user;
2. load `order.id`, `tenant_id`, and existing `tracking_number`;
3. reject missing/blank tracking numbers;
4. fetch PostNord through the fixed adapter;
5. normalize and insert version 1 events with service role;
6. return event DTOs and `effect: "display_only"`;
7. never update the order.

- [ ] **Step 3: Run focused and security checks**

Run:

```bash
deno test supabase/functions/_shared/postnordTracking.test.ts
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-function-exposure.js
```

Expected: PASS.

---

## Task 11: Display PostNord Events Without Changing Order Workflow

**Files:**
- Create: `src/components/account/TrackingEventTimeline.tsx`
- Modify: `src/pages/MyOrders.tsx`
- Modify: `src/components/admin/OrderManager.tsx`
- Test: `src/lib/delivery/trackingEvents.test.ts`

- [ ] **Step 1: Extend presentation tests before UI edits**

Add assertions for loading, no-events, unavailable-provider, unknown-event, and mixed legacy/v1 timelines. Prove presentation functions return no suggested order-status mutation.

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --experimental-strip-types src/lib/delivery/trackingEvents.test.ts
```

Expected: FAIL on the new expected presentation states.

- [ ] **Step 2: Implement tenant-scoped reads and timeline**

- `MyOrders.tsx` reads `carrier_tracking_events_v1` for the selected order through RLS.
- Keep its existing `delivery_tracking` read as a backward-compatible fallback.
- `TrackingEventTimeline` labels PostNord as carrier evidence, shows provider timestamp, and explicitly avoids promising that Webprinter order status has changed.
- Unknown event/schema versions render safely.

- [ ] **Step 3: Add an explicit admin sync action**

In `OrderManager.tsx`, add `Hent PostNord-status` only when an existing tracking number is present. The action invokes `postnord-tracking-sync`, refreshes display events, and does not save the order form, update status, or send email.

- [ ] **Step 4: Run tests and build**

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --experimental-strip-types src/lib/delivery/trackingEvents.test.ts
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build
```

Expected: PASS; build may retain existing documented Vite warnings only.

---

## Task 12: Configure Functions And Document Security/Rollback

**Files:**
- Modify: `supabase/config.toml`
- Modify if required: `scripts/check-supabase-function-exposure.js`
- Create: `docs/REFERENCE_INTEGRATIONS.md`
- Modify: `SYSTEM_OVERVIEW.md`
- Modify: `AI_CONTINUITY.md`
- Modify: `POD2_README.md`

- [ ] **Step 1: Configure all three functions as authenticated**

Add explicit configuration for:

- `reference-fx-snapshot`: JWT required, master-only inside handler.
- `tenant-business-evidence`: JWT required, tenant-access check inside handler.
- `postnord-tracking-sync`: JWT required for user calls; if cron support is retained, its secret gate is additional and not a JWT bypass unless separately reviewed.

Do not add provider secrets or endpoint credentials to `supabase/config.toml`.

- [ ] **Step 2: Document provider and security boundaries**

`docs/REFERENCE_INTEGRATIONS.md` must include:

- exact data flow and authoritative-system boundaries;
- official-provider activation gates: VIES public REST; CVR disabled until credential-safe HTTPS access; Datafordeler DAR GraphQL version/key; no new DAWA; PostNord Customer/Partner production approval;
- server environment variable names without values;
- fixed-provider origin policy;
- snapshot/evidence retention and PII minimization;
- service-role write and tenant-read model;
- non-blocking VIES semantics;
- display-only PostNord semantics;
- no-repricing and unpublished-draft-only FX rule;
- operator activation checklist;
- observed metrics/log fields that exclude secrets and raw provider payloads;
- explicit statement that ERPNext is separate and untouched.

- [ ] **Step 3: Add a rollback runbook**

Document rollback in this order:

1. Disable all three runtime flags and stop cron.
2. Remove UI actions/reads while leaving evidence tables intact.
3. Remove importer snapshot flag while retaining normalized artifact readability.
4. Remove Edge Function config/source.
5. Drop new tables only after retention approval using the migration's exact rollback SQL.
6. Verify legacy fixed FX tests, order UI, POD dry-run/submission gates, and build.

State explicitly that rollback never edits existing price rows, published products, orders, `delivery_tracking`, POD jobs, payments, or ERPNext files.

- [ ] **Step 4: Update continuity docs minimally**

- `SYSTEM_OVERVIEW.md`: add the three additive reference integrations and authority boundaries.
- `AI_CONTINUITY.md`: record disabled-by-default state, tests, and next activation gate.
- `POD2_README.md`: add one note that FX/business/tracking evidence does not alter Print.com payment, validation, claim, or supplier-submission rules.

- [ ] **Step 5: Run config/security/document checks**

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-migration-grants.js
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-function-exposure.js
rg -n "ERPNext|service.role|tenant read|display.only|published|rollback" docs/REFERENCE_INTEGRATIONS.md SYSTEM_OVERVIEW.md AI_CONTINUITY.md POD2_README.md
```

Expected: static checks PASS and every boundary is discoverable in documentation.

---

## Task 13: Final Regression, Scope Audit, And Handoff

- [ ] **Step 1: Run all focused tests**

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test scripts/product-import/__tests__/fx-snapshot.test.js scripts/product-import/__tests__/snapshot-pricing.test.js scripts/product-import/__tests__/shared-importers.test.js scripts/product-import/__tests__/ul-prices.test.js
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test --experimental-strip-types src/lib/onboarding/danishBusinessIdentity.test.ts src/lib/delivery/trackingEvents.test.ts src/lib/print-production/orderSubmission.test.ts
deno test supabase/functions/_shared/referenceFx.test.ts supabase/functions/_shared/businessEvidence.test.ts supabase/functions/_shared/postnordTracking.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run static and build baselines**

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-migration-grants.js
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/check-supabase-function-exposure.js
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build
git diff --check
```

Expected: PASS, with only already documented build warnings.

- [ ] **Step 3: Prove forbidden paths and protected contracts were untouched**

Run:

```bash
git diff --name-only 58ccc6d0..HEAD -- docs/ERPNEXT_SHADOW_PILOT.md src/lib/erpnext supabase/functions/_shared/erpShadow.ts supabase/functions/_shared/erpShadow.test.ts
git diff 58ccc6d0..HEAD -- scripts/product-import/shared/conversion.js src/lib/print-production/orderSubmission.ts supabase/migrations/20260714190000_harden_print_production_submission.sql
```

Expected:

- ERPNext status is byte-for-byte the same as the Task 1 baseline and has no diff from this work.
- Legacy conversion and POD submission files have no behavior diff.
- No price row, product, order, payment, POD job, supplier, or hosted database was written during verification.

- [ ] **Step 4: Review the final file list manually**

Run:

```bash
git status --short
git diff --name-only 58ccc6d0..HEAD
```

Classify every path as FX, Danish/VIES, PostNord, migration/config/security, or documentation. Stop if any unrelated, ERPNext, core pricing, POD, generated secret, `.env`, Supabase temp, build output, or lockfile change appears.

- [ ] **Step 5: Prepare the handoff after all reviewed local task commits, without pushing or deploying**

Report:

- focused test and build results;
- migration and Edge Functions that remain source-only;
- provider flags that remain disabled;
- exact unpublished draft used for any later authorized FX canary;
- evidence that published rows were not repriced;
- evidence that VIES was non-blocking and PostNord display-only;
- rollback order;
- explicit confirmation that the pre-existing ERPNext snapshot was not modified relative to `58ccc6d0`.

Do not push, deploy, apply migrations, enable cron, call live suppliers/providers, or change hosted data. The isolated local task commits are the review and handoff artifact.
