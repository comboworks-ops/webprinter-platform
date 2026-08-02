# Reference Integrations

## Purpose and authority boundaries

These integrations add reference evidence to Webprinter. They do not become an
authoritative source for product prices, tax treatment, company identity,
addresses, delivery state, payment, or supplier fulfilment.

| Integration | Data flow | Stored evidence | Explicitly not authoritative for |
| --- | --- | --- | --- |
| EUR/DKK | Authenticated exact `master_admin` -> `reference-fx-snapshot` -> fixed Frankfurter ECB endpoint -> service-role insert | Immutable rate, provider date, fetch time, and exact response digest | Existing prices, published products, checkout, invoices, or supplier costs |
| VIES/CVR/DAR | Authenticated tenant member or exact master -> `tenant-business-evidence` -> one fixed provider adapter -> service-role insert | Tenant-scoped result, normalized identifier, timestamps, exact source-byte digest when a response was received, normalized-evidence digest, and bounded display fields | Tax decisions, onboarding, account access, company ownership, or address acceptance |
| PostNord | Authenticated order reader -> explicit `postnord-tracking-sync` action -> fixed Track & Trace v5 endpoint -> service-role insert | Versioned, tenant/order-bound carrier events | `orders.status`, shipment/delivery timestamps, email, POD, payment, or supplier state |

All three Edge Functions require a JWT in `supabase/config.toml` and re-check
authorization inside the handler. Browser requests cannot provide a provider
URL or provider credential. The service-role client is server-only and is used
only after user authentication, exact tenant/order authorization, request
validation, and provider response validation.

`supplier_fx_rate_snapshots` is readable reference data for authenticated
users. `tenant_business_evidence` is tenant-scoped. Carrier evidence is
readable by an exact master, a tenant member for an exactly matching order, or
the customer whose `orders.user_id` owns that exact order. Anonymous users have
no Data API access. Only `service_role` can invoke the atomic carrier-event
writer.

ERPNext remains a separate shadow-pilot integration. This work does not use its
outbox or event model and does not modify `docs/ERPNEXT_SHADOW_PILOT.md`,
`src/lib/erpnext/`, or either `erpShadow` Edge Function file.

## Fixed providers and activation gates

Provider origins and paths are constants in server code. Redirects are not
followed and a response is accepted only from the exact requested URL.

- Frankfurter/ECB: `https://api.frankfurter.dev/v2/rate/EUR/DKK?providers=ECB`.
  It has a 5-second timeout and a 16 KiB response limit. Invocation is
  master-only. A requested rate date mismatch fails closed.
- EU VIES: `https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number`.
  `valid: false` means `invalid`; a timeout, HTTP error, malformed response, or
  provider/member-state outage means `unavailable`. Both results remain
  non-blocking evidence and never change VAT or customer eligibility.
- Danish company data: the implemented adapter is pinned to
  `https://graphql.datafordeler.dk/CVR/v2`. Keep it operationally unavailable
  until Datafordeler credentials are provisioned and the pinned query contract
  is confirmed in staging. The `CVRNummer.eq` filter is emitted only as a
  validated, unquoted eight-digit GraphQL `Long` literal. A leading-zero value
  cannot be represented as that scalar without changing identity, so the CVR
  adapter returns sanitized `unavailable` evidence without calling the provider.
  The legacy CVR distribution service remains disabled: never send credentials
  to the documented plaintext
  `http://distribution.virk.dk` examples and never scrape CVR.dk.
- Danish addresses: the implemented adapter is pinned to
  `https://graphql.datafordeler.dk/DAR/v3`. Activate only with an approved
  Datafordeler credential and a staging contract test. DAR `id_lokalId` is a
  bounded string contract: exact lowercase UUID-shaped hexadecimal identifiers,
  including legacy non-RFC version/variant values, are accepted without trimming
  or case folding. Do not add new DAWA dependencies; DAWA closes on 2026-10-01
  at 10:00 CEST. Adressevælger and Adressevask remain unavailable until KDS
  supplies an implementable contract.
- Business providers have a 5-second default timeout and a 32 KiB maximum
  response. A missing credential returns unavailable evidence instead of
  blocking tenant setup or edits.
- Provider admission is atomic per tenant/provider/request fingerprint. Only
  one equivalent request may be in flight for 30 seconds; subsequent callers
  receive a bounded 429. The database also limits each user to 12 and each
  tenant/provider operation to 60 admitted requests per 10 minutes. The
  non-secret admission telemetry is private and pruned after 24 hours.
- PostNord Track & Trace v5 uses only the sandbox endpoint
  `https://atapi2.postnord.com/rest/shipment/v5/trackandtrace/findByIdentifier.json`
  or the production endpoint
  `https://api2.postnord.com/rest/shipment/v5/trackandtrace/findByIdentifier.json`.
  Production requires an approved Customer/Partner plan, API key, confirmed
  retention terms, staging evidence, and the separate production-approval
  switch. The adapter has a 5-second timeout, 32 KiB response limit, no
  automatic retry, and propagates a bounded `Retry-After` on HTTP 429.
- The official v5 event shape is covered by a checked-in synthetic contract
  fixture; tests never call PostNord. A timestamp with `Z` or an explicit
  offset is honored as supplied. A timezone-less v5 `eventTime` is provider
  local time in `Europe/Copenhagen`: normal winter/summer offsets are applied,
  a fall DST overlap deterministically chooses the earlier summer-time
  occurrence, and a nonexistent spring-gap time fails closed as unavailable.
- PostNord `status` is the semantic display authority. Current `INFORMED` and
  `EN_ROUTE` values map to information and in-transit display evidence;
  `eventCode` is preserved separately (including numeric codes such as `21`)
  and never substitutes for a supplied semantic status. Unknown statuses stay
  displayable as unknown and never imply a workflow transition.
- One provider response crosses one service-only database RPC boundary. Exact
  immutable replays are counted without inserting, while any conflicting event
  rejects and rolls back the entire batch. A UUID owner token and monotonically
  increasing order-scope fence bind that completion to the current fetch;
  event persistence and successful completion commit atomically, so an expired
  worker cannot overwrite a successor.

There is no cron authentication bypass in these functions. PostNord sync is an
explicit user action against a saved order and saved tracking number. If cron
support is proposed later, it requires a separate security review, a
constant-time checked secret of at least 32 characters, and a bounded batch.

## Server environment variables

Configure values only in the server/Edge Function secret store. Never put
them in `VITE_*`, tenant settings, checked-in files, browser responses, or log
messages.

Supabase runtime variables used by authenticated handlers:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Datafordeler credentials, checked in this precedence order:

- `DATAFORDELER_ACCESS_TOKEN`
- `DATAFORDELER_CVR_API_KEY`
- `DATAFORDELER_DAR_API_KEY`
- `DATAFORDELER_API_KEY` (shared fallback)

PostNord controls:

- `POSTNORD_TRACKING_ENABLED` — keep absent or `false` until approved.
- `POSTNORD_TRACKING_ENVIRONMENT` — only `sandbox` or `production` is valid.
- `POSTNORD_TRACKING_API_KEY`
- `POSTNORD_TRACKING_PRODUCTION_APPROVED` — keep absent or `false` until the
  production gate is signed off.

Frankfurter and VIES need no provider secret. `reference-fx-snapshot` is still
protected by exact master authorization, and the importer remains off unless
an operator explicitly supplies an immutable snapshot file.

## FX snapshot use

The existing fixed supplier conversion rules remain the default and their
outputs are unchanged. Snapshot pricing is double opt-in:

1. Supply `--fx-snapshot-file` to the WMD roll-label extract/import command.
2. Supply `--write-snapshot-draft` for a write.

The write path uses one row-locked database RPC and accepts only a new or
explicitly selected unpublished draft. It preserves the provider rate,
pricing buffer, markup, and final rounding as separate evidence. It cannot
update, backfill, reprice, or publish an existing published product. Keep the
snapshot artifact readable during rollback even after removing the write flag.

## Evidence retention and minimization

- When provider bytes were received, `response_digest` hashes those exact UTF-8
  bytes before JSON parsing; it is `NULL` when no response existed.
  `evidence_digest` separately binds the validated, normalized evidence DTO.
  Do not store or log raw provider payloads, and do not present one digest as
  evidence of the other.
- Business evidence stores a normalized CVR/VAT/address identifier and bounded
  display fields only. Do not add contacts, email, phone, ownership records, or
  unrestricted provider objects.
- PostNord evidence stores only the saved tracking number, bounded carrier
  event text/location, timestamps, semantic status, provider event ID/code,
  and a digest. Do not store proof-of-delivery files or recipient contact data
  in this stream.
- Evidence rows are append-only through the application. Direct `DELETE` is
  revoked from `public`, `anon`, `authenticated`, and `service_role`, while an
  update-only trigger rejects `UPDATE`. Current source adds no automatic purge
  job. Agree a legal/business retention period before hosted activation. Any
  standalone deletion requires retention approval after all writers are
  disabled; the declared tenant/order foreign-key cascades continue to apply
  when their authoritative parent is deliberately deleted. Migration
  `20260801140000_reference_evidence_cascade_correction.sql` establishes this
  final privilege/trigger boundary without `pg_trigger_depth()` heuristics.
- Business-provider admission claims contain tenant/user IDs, operation,
  provider, a request fingerprint, and timestamps—not the raw identifier or
  provider payload—and are pruned to a rolling 24-hour window by the admission
  RPC.
- PostNord admission claims contain only tenant/order/user IDs, the canonical
  tracking identity, an opaque owner token/fence, bounded lifecycle state, and
  timestamps. The database serializes each order scope, supports fenced lease
  renewal and explicit success/failure release, serves one-minute successful
  cache hits without quota debit, applies per-user/per-tenant and global
  rolling provider windows, and prunes finished claims after 24 hours. A
  separate private singleton retains only PostNord's global `blocked_until`;
  an exact valid `Retry-After` from provider HTTP 429 sets that boundary before
  another uncached provider call can be admitted.
- A negative, stale, unknown, or unavailable result remains evidence of that
  check at that time. It is not silently converted to a positive result.

## Safe observability

Operational logs may contain only these bounded fields:

- generated `requestId`;
- provider or operation category;
- requested/provider rate date for FX;
- normalized outcome category such as `created`, `replay`, `invalid`,
  `unavailable`, `rate_limited`, or `forbidden`;
- normalized PostNord event count.

Do not log authorization headers, JWTs, service-role keys, provider keys,
access tokens, VAT/CVR/address input, tracking numbers, raw response bodies,
provider URLs supplied by a caller, response display fields, or stack traces
containing request data. Monitor counts and latency by function/outcome, 429
rates, provider-unavailable rates, idempotent replay rates, database failures,
and schema-validation failures. Alert on sustained failures without sampling
raw payloads.

## Release verification evidence

The mandatory database release gate is:

```bash
npm run check:reference-integrations:release
```

It runs both isolated PostgreSQL 17 suites. The business-evidence/PostNord suite
applies six migrations in order (base evidence, business admission hardening,
PostNord atomic persistence, PostNord admission, the forward cascade
correction, and exact customer-read authority) and covers realistic parent RLS,
direct-mutation denial, authoritative order/tenant cascades, rollback, quota,
and concurrency. The WMD suite separately applies the snapshot-draft migration
and covers exact-target, canonical price validation, idempotency, draft-only,
atomic replacement, and publish/import races.
The command fails closed before reporting success if Docker or its daemon is
unavailable, if PostgreSQL is not major version 17, or if either suite fails.

The restricted 2026-08-01 review sandbox could not reach the Docker daemon, so
an in-sandbox attempt is **BLOCKED—not a pass**. The same command was then run
through the approved local Docker execution boundary against
`postgres:17-alpine`; both suites passed with these terminal markers:

- `business evidence PostgreSQL 17 concurrency and quota checks passed`
- `WMD snapshot draft PostgreSQL 17 race checks passed`
- `Reference integrations PostgreSQL 17 release gate passed.`

That approved run is the database evidence for this review. Static migration
assertions, unit tests, Edge tests, and the production build remain separate
gates and cannot replace a future database rerun after migration changes. If a
future release owner cannot execute Docker/PostgreSQL 17, the status returns to
blocked rather than skipped or green.

## Operator activation checklist

- [ ] Review the fixed provider endpoint and current official provider terms.
- [ ] Run `npm run check:reference-integrations:release` on a Docker-capable
      host and retain a pass for both PostgreSQL 17 suites. An unavailable
      runner is a release blocker, not a skipped or green check.
- [ ] Deploy all three functions with `verify_jwt = true`; do not add a public
      or secret-only bypass.
- [ ] Configure server secrets without `VITE_*` exposure and scan built assets.
- [ ] Leave `POSTNORD_TRACKING_ENABLED=false` and production approval false.
- [ ] Run VIES and Datafordeler staging contract tests with synthetic/minimal
      records; include an unquoted numeric CVR `Long` and a legacy DAR
      `id_lokalId`, and verify unavailable results do not block saving or
      onboarding.
- [ ] Run PostNord sandbox against one authorized saved order; verify an
      unrelated tenant and unsaved tracking number are rejected.
- [ ] Confirm PostNord events render as carrier evidence while `orders`, email,
      payment, POD, and supplier records remain byte-for-byte unchanged.
- [ ] Select an exact unpublished draft for one later authorized FX canary;
      verify no published row can be selected or modified.
- [ ] Agree retention ownership, monitoring thresholds, incident response, and
      provider rate limits before production approval.
- [ ] Obtain separate explicit authorization before deploying, applying the
      migration, enabling a provider, calling a live provider, importing a
      supplier catalog, or writing hosted data.

## Rollback runbook

1. Set `POSTNORD_TRACKING_ENABLED=false`, clear production approval, remove
   Datafordeler credentials, and stop any future reference-integration cron.
   Restrict invocation of the master FX function during rollback.
2. After all PostNord callers are disabled, revoke and drop the lifecycle RPCs
   in dependency order: `finish_postnord_tracking_sync(uuid,text,integer)`,
   `complete_postnord_tracking_sync(uuid,jsonb)`,
   `renew_postnord_tracking_sync(uuid)`, then
   `claim_postnord_tracking_sync(uuid,uuid,uuid,text)`. Revoke and drop
   `persist_postnord_tracking_events_v1(jsonb)` only after the completion RPC is
   gone. Drop `postnord_tracking_sync_claims` and
   `postnord_tracking_provider_state` only after the four lifecycle RPCs are
   gone. Keep direct service-role table inserts revoked: restoring the old
   per-event writer would restore the partial-batch failure mode.
3. To remove customer carrier reads, replace
   `carrier_tracking_events_v1_tenant_order_read` with the exact master/tenant
   branches first, then revoke/drop
   `can_read_carrier_tracking_order(uuid,uuid)`. Retain
   `provider_event_code` while evidence is retained.
4. Remove the optional business-evidence and carrier-event UI actions/reads.
   Leave evidence tables intact for audit and retention review.
5. Remove `--write-snapshot-draft` and the importer snapshot option while
   retaining normalized artifact readability and the existing fixed FX rules.
6. Remove the three Edge Function config entries/source only after callers are
   disabled.
7. Do not roll back
   `20260801140000_reference_evidence_cascade_correction.sql` by itself while
   authoritative tenant/order deletion remains enabled: that would restore the
   trigger that blocks declared cascades. After retention approval and after
   disabling writers and parent deletion, follow the correction migration's
   rollback notes, then the exact order at the top of
   `20260731120000_reference_integration_evidence.sql`: drop its policies,
   explicit grants/functions/triggers, then
   `carrier_tracking_events_v1`, `tenant_business_evidence`, and
   `supplier_fx_rate_snapshots`.
8. Re-run legacy fixed-FX tests, ordinary order UI tests, POD dry-run/submission
   gates, Supabase grant/exposure checks, and the production build.

Rollback never edits existing price rows, published products, orders,
`delivery_tracking`, shipment/delivery timestamps, emails, POD jobs, payments,
supplier state, or ERPNext files.
