# Print Production Control Center Design

Date: 2026-07-13
Status: Approved product direction, written specification pending final user review
Owner: Webprinter

## 1. Purpose

The Print Production Control Center gives Webprinter one simple master-operated
workspace for sourcing products, preparing prices, distributing ordinary
products to selected tenant shops, and forwarding paid customer orders to print
suppliers.

It is a new operating layer over the verified POD v2 pipeline. It is not a new
POD engine. POD v1 remains intact, POD v2 remains the production integration,
and the isolated POD v3/Flyer Alarm workbench remains parked until explicitly
connected later.

The intended first-time success is:

1. Webprinter chooses a supplier product.
2. Webprinter confirms variants, quantities, selling price, and margin.
3. Webprinter sends the product to selected shops.
4. The tenant receives an ordinary product without supplier or POD details.
5. A customer places an ordinary shop order.
6. Webprinter sees the order in one action queue, validates it, and sends it to
   production.

## 2. Approved Decisions

1. Webprinter's master operator is the primary user of the POD system.
2. Tenants receive products from Webprinter and do not operate the supplier
   integration.
3. Tenant products and orders look ordinary. Tenant-facing screens do not show
   POD versions, supplier names, wholesale costs, API settings, matrix mapping,
   dry runs, or forwarding controls.
4. Products are distributed to explicitly selected shops by default.
5. `Vælg alle` is available as a deliberate secondary action and is never
   preselected.
6. The new interface follows the approved high-fidelity control-center visual:
   quiet operational layout, compact navigation, dense product rows, clear
   readiness, and a visible action queue.
7. Existing routes and technical tools remain available under
   `Avancerede værktøjer` during rollout and provide the rollback path.

## 3. Product Principles

1. Use business language. A normal operator should not need to understand
   tenant IDs, SKUs, payloads, matrix axes, API presets, or fulfillment jobs.
2. Show the next useful action, not the implementation history.
3. Keep supplier cost visible only to authorized master operators.
4. Treat current pricing calculations as read-only. The control center displays
   and orchestrates existing prices; it does not replace the pricing engine.
5. Separate readiness from publication. An incomplete product can be saved as a
   draft but cannot be sent to shops.
6. Separate validation from irreversible submission. Supplier validation runs
   before the operator can perform the final production action.
7. Never automatically retry a real supplier submission when duplicate-order
   risk exists.
8. Every product distribution and production submission remains auditable.
9. All new behavior is additive, role-gated, versioned, and reversible.
10. Danish is the default UI language and uses correct Danish letters.

## 4. Non-Goals

This project does not:

- merge Supplier Bank into POD v2;
- modify POD v1 tables, functions, pricing, or UI behavior;
- activate POD v3/Flyer Alarm in tenant storefronts;
- replace the existing product configuration or storefront pricing engine;
- expose Print.com credentials or supplier data to tenants;
- silently distribute a product to every tenant;
- create a fourth POD data model;
- promise automatic supplier cancellation where the supplier API does not
  support it;
- change an independent tenant's financial settlement without an explicit,
  opt-in settlement policy.

## 5. Information Architecture

### Primary route

`/admin/printproduktion`

The route is master-context only. A tenant that reaches it is redirected to the
normal product or order area with no supplier information disclosed.

### Primary navigation

1. `Overblik`
2. `Produkter`
3. `Distribution`
4. `Ordrer`
5. `Indstillinger`

The admin sidebar contains one entry named `Printproduktion`. Versioned POD
links are removed from normal navigation only after the new flows pass QA. They
remain reachable from `Avancerede værktøjer`.

### Advanced tools

The following existing capabilities are retained behind a clearly separated
master-only area:

- supplier/API connection diagnostics;
- API Explorer and saved presets;
- raw product introspection;
- matrix layout mapping and merge tools;
- supplier payload and dry-run detail;
- manual supplier forwarding fallback;
- POD v1, POD v2, and POD v3 legacy workbenches.

Advanced tools never become the default path.

## 6. Screen Design

### 6.1 Overblik

The overview answers three questions: is production ready, what can be sold,
and what requires attention?

Top readiness strip:

1. `Leverandør forbundet`
2. `Produkter klargjort`
3. `Ordreflow aktivt`

Operational metrics:

- active products;
- shops receiving managed products;
- orders requiring action.

Main workspace:

- `Produkter klar til distribution`: dense rows showing product image, format,
  material, supplier cost, selling price, margin, readiness checks, shop count,
  and the actions `Gennemse` and `Send til butikker`;
- `Kræver handling`: the highest-priority orders with deadline, file status,
  and one clear action;
- `Seneste aktivitet`: product distribution, file receipt, validation,
  production submission, and status changes.

Empty states always provide a next action. They do not present a dashboard full
of zero-value cards.

### 6.2 Produkter

The product view is a searchable, filterable operational table or dense list.
It avoids a decorative card grid for large catalogs.

Default filters:

- status: `Kladde`, `Kræver opsætning`, `Klar`, `Distribueret`, `Blokeret`;
- supplier;
- category;
- destination shop;
- price readiness.

Each row shows only the information needed to make a decision. Technical values
are available in an advanced drawer.

#### Add-product flow

The `Tilføj produkt` command opens a focused wizard:

1. `Vælg produkt`
   - select an active supplier;
   - browse/search supplier products in Danish;
   - show product image, category, available formats, and a supplier link when
     available.
2. `Vælg sortiment`
   - choose offered variants and quantities;
   - apply safe recommended defaults;
   - hide supplier-only options and unsupported combinations;
   - place matrix-layout controls under `Avanceret`, not in the default flow.
3. `Pris og avance`
   - supplier cost is read-only;
   - operator sets a selling price or target margin;
   - all values use the existing POD v2 price data and current product pricing
     contracts;
   - incomplete or quote-only combinations are clearly excluded or flagged.
4. `Kontrollér produkt`
   - preview the customer-facing title, image, options, quantities, and prices;
   - run readiness validation;
   - save as draft when incomplete.
5. `Send til butikker`
   - select one or more shops;
   - no shop is selected by default;
   - `Vælg alle` requires an explicit click;
   - show a final summary before distribution.

The final primary action is `Klargør og send`. Import, mapping, product creation,
and product-transfer operations happen through existing services behind this
single guided action. If one stage fails, completed stages remain visible and
the operator resumes from the failed stage without duplicating data.

### 6.3 Distribution

Distribution shows products by shop and shops by product. It uses the existing
selected-tenant transfer contract and `delivery_mode = pod_price_list` under the
hood, while the master UI uses the business label `Webprinter-styret produkt`.

States:

- `Ikke sendt`
- `Afventer modtagelse`
- `Aktiv i butik`
- `Opdatering tilgængelig`
- `Pauset`
- `Fejl`

The operator can:

- send a ready product to selected shops;
- see which shops have received it;
- resend a failed notification safely;
- open the tenant product in context;
- compare the master version with the distributed version.

The first version does not add a persistent pause policy. Leaving a shop
unselected prevents a new distribution, but does not alter an existing tenant
product. A later pause feature requires an explicit additive distribution-policy
record and separate approval; it must never be simulated by deleting a product.

Tenant acceptance, synchronization, or copy-on-transfer continues through the
existing tenant notification and product cloning path. The tenant sees an
ordinary Webprinter product update, not supplier terminology. The compatibility
value `delivery_mode = pod_price_list` may remain in data, but the current
tenant-facing `POD-pris` label must be replaced with ordinary Webprinter product
language.

### 6.4 Ordrer

The order view is one master action queue. Default groups are:

- `Kræver handling`
- `Klar til produktion`
- `Hos leverandøren`
- `Afsluttet`
- `Fejl`

Each order shows customer, tenant shop, product, quantity, delivery deadline,
file readiness, production status, and the next action. Raw job IDs and variant
signatures are hidden from the normal view.

#### Safe submission flow

1. The operator opens an order.
2. The control center verifies address, quantity, product mapping, supplier
   options, public file URL, and sender identity.
3. The existing supplier dry run executes as `Kontrollér ordre`; raw payloads
   remain hidden unless the operator expands technical details.
4. A passing validation enables `Send til produktion`.
5. The final dialog identifies the supplier, charge method, expected cost, and
   recipient, and requires explicit confirmation.
6. Real submission uses the verified `pod2-order-submit` adapter.
7. The supplier order reference and response are retained for audit.

`MANUALCHECK` is presented as `Leverandøren gennemgår filen`, not as a generic
failure. The UI never claims that `submitted` means production is complete.

The manual forwarding fallback remains under advanced tools and is visually
separated from automatic submission because it can otherwise create an
incorrect submitted state.

### 6.5 Indstillinger

The default settings view contains only operational setup:

- active supplier and connection health;
- Webprinter billing identity;
- default sender identity;
- status synchronization state;
- managed-shop readiness;
- notification preferences.

Credentials, base URLs, auth header modes, payloads, and API presets are shown
only under advanced tools.

## 7. Tenant Experience

Tenants receive:

- normal products in their product system;
- normal storefront product pages and prices;
- normal customer orders and order communication;
- ordinary Webprinter product-update language.

Tenants do not receive:

- POD catalog or supplier browser navigation;
- POD payment and forwarding pages;
- supplier name or supplier cost;
- Print.com status payloads;
- matrix mapping or merge controls;
- versioned POD labels.

For Webprinter-owned shops that already use `pod2_auto_forward = true`, the
existing internal managed flow continues without charging Webprinter through
Stripe. For a future independent tenant, distribution is blocked until an
explicit settlement mode is configured. The first implementation must not use
`pod2_auto_forward` as a general substitute for commercial settlement.

## 8. Architecture

### 8.1 Additive shell

The control center introduces a route shell and focused components. It reuses:

- `pod2_supplier_connections`;
- `pod2_catalog_products` and related attributes/price matrices;
- `pod2_tenant_imports`;
- `pod2_fulfillment_jobs`;
- existing POD v2 hooks and edge functions;
- `pod2-tenant-import` and `pod2-tenant-merge`;
- `send_product_to_tenants` and the existing product-transfer path;
- `pod2-create-jobs`;
- `pod2-order-submit`;
- `pod2-sync-printcom-status`;
- existing product configuration, pricing, checkout, and order tables.

POD v1 and Supplier Bank remain separate systems.

### 8.2 UI service boundary

The new page does not directly reproduce the current 3,000-line admin
workbench. It uses focused modules:

- `PrintProductionReadModel`: aggregates connection, product, distribution,
  tenant, and fulfillment state for display;
- `PrintProductReadiness`: pure functions that derive readiness and blockers;
- `PrintProductionCatalogService`: orchestrates existing import/curation calls
  without calculating prices;
- `PrintDistributionService`: wraps selected-tenant distribution and provides
  resumable results;
- `PrintProductionOrderService`: wraps validation, status sync, and explicit
  supplier submission;
- `PrintProductionLanguage`: maps technical states to Danish business language.

Read models may use parallel queries, pagination, and cached counts. They do not
write derived state back to pricing tables.

### 8.3 Role and tenant boundary

- The control center requires master-admin authorization in master context.
- Server-side functions continue to enforce authorization; UI hiding is never
  treated as security.
- Supplier credentials remain server-side.
- Tenant queries remain scoped by `tenant_id`.
- Any new public table, view, RPC, or function must include explicit grants,
  RLS, indexes, and a rollback note according to
  `docs/SUPABASE_DATA_API_GRANTS.md`.

### 8.4 Supplier capability boundary

The UI is supplier-neutral, but capabilities are honest and adapter-specific.
Each supplier presented by the control center has a small capability contract:

- catalog browsing;
- product-detail lookup;
- price lookup;
- order validation;
- live order submission;
- status synchronization;
- cancellation, when supported.

Print.com is initially the only adapter allowed to report live submission and
status synchronization as ready because `pod2-order-submit` has been verified
against its real API. Another supplier may be used for catalog preparation only
until its server-side adapter, authorization, option translation, idempotency,
and canary order pass the same acceptance tests. The UI disables unsupported
actions and explains what is missing; it never sends a Print.com payload to a
different supplier endpoint.

## 9. Readiness Model

A product is `Klar` only when all required checks pass:

- active supplier connection;
- catalog product and supplier reference exist;
- at least one supported variant and quantity exist;
- price rows exist for the offered combinations;
- no required combination is `needs_quote` unless intentionally excluded;
- master product import/link exists;
- public title and product image exist;
- required storefront selections can be represented by the current product
  pricing UI.

A product remains editable as a draft when checks fail. The UI shows the first
blocking action and the complete checklist on demand.

An order is `Klar til produktion` only when:

- the fulfillment job is in the correct state;
- recipient and delivery address are complete;
- the order quantity maps to a supported supplier quantity;
- supplier option translation succeeds;
- a publicly fetchable production file exists;
- sender and billing configuration are valid;
- the supplier validation/dry run passes.

## 10. Error Handling And Recovery

1. Normal users see a Danish explanation, impact, and recovery action.
2. Raw supplier errors, payloads, and references are preserved under technical
   details for support.
3. Read failures show cached content when safe and mark it as potentially
   outdated.
4. Import and distribution operations return per-stage results so the operator
   can resume after a partial failure.
5. Existing idempotency checks are used for job creation and product transfer.
6. A real supplier submission is never automatically retried after an uncertain
   response. The operator first checks whether a supplier order ID was stored.
7. Destructive product removal retains the documented POD v2 delete order:
   tenant imports, fulfillment jobs, then catalog product.
8. The normal interface prefers pause/archive actions over destructive delete.
9. Failed status synchronization does not roll back a valid submitted order.
10. Activity records never expose credentials or complete supplier payloads.

## 11. Performance

- Catalog and order lists use server-side pagination or bounded queries.
- Counts are fetched independently from row payloads.
- Product images are lazy-loaded and use stable dimensions.
- Search and filters are debounced.
- Large price matrices are summarized in the list and loaded only in product
  detail.
- Existing 500-combination preview safeguards remain in force.
- The overview does not fetch raw supplier catalogs on every render.

## 12. Testing Strategy

### Unit tests

- product-readiness derivation;
- order-readiness derivation;
- technical-to-Danish status mapping;
- selected-shop behavior and explicit `Vælg alle`;
- price/margin display using fixture data without price recalculation;
- resumable stage-result reducer.

### Integration tests

- master-context role gate;
- POD v2 read-model aggregation;
- import orchestration without duplicate master products;
- selected-tenant transfer with `pod_price_list` delivery mode;
- tenant data does not contain supplier cost or credentials;
- order validation before submission;
- uncertain supplier response does not cause automatic resubmission.

### Browser tests

- first-time empty-state journey;
- add product, save draft, resume, and distribute to one selected shop;
- verify a second unselected shop receives nothing;
- tenant sees the distributed product as ordinary product data;
- customer order becomes a master production action;
- dry-run validation then mocked successful submission;
- failed validation shows a useful recovery action;
- desktop and mobile layouts have no overlap, clipping, or shifting controls.

### Production verification

- use dry run for real Print.com payload verification;
- never place a live supplier order during automated tests;
- require an explicit operator confirmation for a real canary order;
- verify stored supplier order reference and status sync after the canary;
- confirm POD v1, existing storefront pricing, and normal checkout regression
  tests still pass.

## 13. Rollout

### Phase 1: Shell and read model

- add `/admin/printproduktion`;
- add master-only overview, products, distribution, orders, and settings tabs;
- aggregate existing state without changing writes;
- add one sidebar entry while retaining old links.

### Phase 2: Guided product flow

- add the five-step product wizard;
- wrap existing import and curation operations;
- show readiness and resumable errors;
- keep technical mapping in advanced tools.

### Phase 3: Selected-shop distribution

- orchestrate existing selected-tenant transfer;
- default to no shops selected;
- show distribution state and per-shop results;
- verify tenant products remain ordinary.

### Phase 4: Safe order queue

- replace dry-run terminology with `Kontrollér ordre` in the default UI;
- require successful validation before real send;
- retain raw payload and manual fallback under advanced tools;
- verify Print.com status polling and manual-review language.

### Phase 5: Navigation consolidation

- perform browser QA and role-boundary tests;
- make `Printproduktion` the single normal sidebar entry;
- move versioned routes to advanced tools;
- keep old routes deployed for rollback until real orders pass the new shell.

## 14. Rollback

The first rollout is primarily routing, composition, and orchestration. Rollback
removes the new sidebar entry and route while leaving all POD v2 data and edge
functions untouched. Existing `/admin/pod2`, `/admin/pod2-katalog`,
`/admin/pod2-ordrer`, and `/admin/pod2-betaling` routes remain available.

Any later additive migration includes its own down/rollback note. No rollout
step deletes POD v1, POD v2, product, price, order, or tenant data.

## 15. Acceptance Criteria

1. A first-time master operator can identify the next action without opening
   API Explorer or reading documentation.
2. A product can be chosen, priced, checked, and sent to one selected shop
   through one guided flow.
3. No shop is selected by default, and `Vælg alle` is explicit.
4. An unselected shop receives no product notification or clone.
5. The receiving tenant sees an ordinary product and ordinary order experience.
6. Supplier name, supplier cost, credentials, and POD technical details are not
   exposed to tenants.
7. Existing pricing remains authoritative and unchanged.
8. A master operator can validate an order and send it through the verified
   Print.com adapter without seeing a raw payload.
9. Uncertain real-submission responses cannot create an automatic duplicate
   retry.
10. POD v1 and the legacy POD v2 routes continue to work during rollout.
11. Large catalogs and matrices do not make the overview unresponsive.
12. The new interface passes desktop/mobile browser QA and tenant role checks.
