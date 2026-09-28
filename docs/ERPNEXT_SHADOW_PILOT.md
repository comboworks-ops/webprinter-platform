# ERPNext shadow pilot for Webprinter

Status: local shadow runtime proven end to end; hosted dispatch remains
disabled and no production-order hook is active.

## Purpose

The pilot lets Webprinter describe a production order to a separate ERPNext
service without allowing ERPNext to change Webprinter's prices, payments,
customer workflow, supplier submission, stock, or accounting.

Webprinter remains authoritative for:

- products and selling prices;
- checkout, payments, and customer-facing order state;
- POD validation and supplier submission;
- the decision that an order is ready for production.

ERPNext is initially only a shadow observer. It may calculate proposed material
requirements, machine time, work orders, and stock movements, but those results
are informational until they have been compared with real orders and approved.

## Current implementation

The first version adds only:

- a strict, versioned `webprinter.production_order.shadow_requested` contract;
- deterministic idempotency per tenant, order, and revision;
- optional recipe, machine, and material-requirement fields;
- hard-coded `inventoryPosting: disabled` and `accounting.posting: disabled`;
- a policy gate that defaults to disabled, requires master context, and requires
  HTTPS in production;
- tests that reject PII, payment fields, invalid values, and live effects.

The second source-only stage adds:

- a private, RLS-enabled `erp_shadow_outbox` migration with no authenticated or
  anonymous Data API access;
- a service-role-only atomic claim function with bounded retries;
- a master-admin-only Edge Function configured with JWT verification;
- disabled/synthetic/shadow runtime modes, defaulting to disabled;
- HMAC signing, replay timestamps, HTTPS enforcement for real shadow mode, and
  sanitized error recording;
- a synthetic-only scope that cannot dispatch tenant business events.

The localhost integration stage now also provides:

- an isolated ERPNext v16.29.0 service at `erp.localhost:8088`;
- a signed loopback gateway with replay protection and sanitized failures;
- a custom `comboworks_erp` app with additive `ERP Shadow Event` list/detail
  pages;
- an exact API-only integration user and role;
- source-estimate aggregation for material proposals and machine minutes;
- hard validation that forbids stock, accounting, Work Order, Journal Entry,
  and General Ledger effects;
- Frappe tests proving those operational document counts stay unchanged;
- a disposable local Supabase proof using byte-identical Webprinter migration
  and Edge Function source.

The reconciliation stage now maps an already-reviewed Webprinter machine-cost
result into the shadow contract:

- sheet jobs propose the calculated sheet count including setup/run waste;
- roll jobs propose calculated linear metres or square metres;
- calculated setup plus runtime becomes proposed machine minutes;
- Webprinter remains authoritative for every value; and
- the adapter cannot enable ERP stock or accounting posting.

The complete local proof returned 202 for the first dispatch, 200 for exact
replay, 403 for an authenticated user without the master role, 401 for an
unauthenticated request, and 401 for anonymous outbox access. It created one
ERP shadow page and left inventory and accounting posting disabled.

There is still no browser API client, no real-order hook, and no production
deployment. The migration and Edge Function remain source-only for the hosted
Webprinter project. Closing the development chat does not activate either one.

## Intended architecture

```text
Webprinter order
  -> protected server-side outbox (implemented, not wired to real orders)
  -> signed ERP gateway (local runtime)
  -> separate private ERPNext service (local runtime)
  -> read-only ERP Shadow Event calculation page

Webprinter pricing, payment, POD and customer status remain unchanged.
```

The eventual connector must run server-side. ERPNext credentials, gateway
signing secrets, and private endpoints must never be placed in `VITE_*`
variables or shipped to a browser.

## Data minimisation

The v1 event contains stable internal references and production facts. It does
not accept names, email addresses, postal addresses, payment details, supplier
credentials, or authentication secrets. A later customer/accounting integration
requires a separate reviewed contract rather than expanding this event silently.

## Activation gates

Production runtime work must not start until all of these are true:

1. A protected local or hosted ERPNext test environment exists.
2. Server-side credentials are stored in the deployment secret manager.
3. The gateway verifies authentication, timestamps, signatures, payload size,
   schema version, and idempotency keys.
4. Tenant isolation and master-only visibility have integration tests.
5. Shadow results are visible only to authorised operators.
6. Backups, patching, monitoring, audit logs, and restore tests are documented.
7. A named operator approves changing the flag from disabled to shadow.

The local fixture satisfies gates 1 through 5 for the synthetic Webprinter
contract. Production-grade monitoring, backup/restore evidence, externally
reachable TLS topology, deployment secrets, and explicit production activation
are deliberately still open.

Even in shadow mode, inventory and accounting posting stay disabled. Enabling
either is a later release with its own reconciliation and rollback approval.

## Planned rollout

1. Contract preview: completed with fixed fixtures.
2. Local shadow: completed through Webprinter Auth/RLS/outbox, signed gateway,
   and ERPNext persistence.
3. Staging shadow: copy selected non-sensitive production facts after an order
   is committed; compare ERP calculations with Webprinter without side effects.
4. Production shadow: send a small allow-listed sample and monitor drift.
5. Assisted operations: an operator may accept suggested material reservations
   or work orders.
6. Authoritative ERP operations: considered only after reconciliation proves
   safe; accounting is a separate decision.

## Rollback

Before runtime dispatch exists, rollback is simply removal of:

- `src/lib/erpnext/shadowContract.ts`;
- `src/lib/erpnext/shadowPolicy.ts`;
- `src/lib/erpnext/machineReconciliation.ts`;
- `src/lib/erpnext/shadowContract.test.ts`;
- `src/lib/erpnext/machineReconciliation.test.ts`;
- this document.

After a dispatcher is added, rollback must work by setting the server-side
feature flag to false first. The outbox must stop retrying, Webprinter must
continue normally, and ERPNext shadow records may be retained for audit or
deleted under the applicable retention policy. Rollback must never require
editing pricing, POD, checkout, or payment records.

For the current local pilot, stop the gateway or set its mode to `synthetic`,
then stop ERPNext if desired. Uninstalling the custom app disables its
dedicated integration user. Persistent ERP data is retained unless a separately
reviewed volume deletion is explicitly performed.

## Next implementation seam

The next safe change is a staging-only real-order adapter after the existing
Webprinter transaction commits. It must remain disabled by default, write the
same strict outbox contract, and never make checkout or production submission
wait for ERPNext. Production activation still requires a separately reviewed
operator decision.
