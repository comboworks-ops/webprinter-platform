# Webprinter Commercial Readiness Roadmap

Generated: 2026-07-07

## North Star

Webprinter should become a sellable web-to-print operating system for print
houses. The owned tenant sites are the proof:

- `webprinter.dk` proves the broad platform.
- `salgsmapper.dk` proves a focused niche tenant with templates and sales-folder
  design flow.
- `onlinetryksager.dk` proves a general print storefront/catalog tenant.

The Supplier Bank is important, but it is not the product by itself. It is a
sourcing and staging engine behind the platform, used to prepare supplier-backed
products safely before an admin imports or publishes anything.

## CEO Recommendation

The main focus should be commercial readiness of the complete web-to-print
system, not endless expansion of supplier scraping.

The first sellable version should prove this loop:

1. Customer lands on the correct tenant storefront.
2. Customer chooses a real product with a clear Danish product page.
3. Customer sees correct price options and delivery expectations.
4. Customer chooses designer, upload, or self-production template download.
5. Designer opens the correct product/template when one exists.
6. Checkout receives the exact chosen price/design/upload state.
7. Admin can see, verify, and process the order.
8. SEO/analytics can show whether each tenant is gaining traffic and converting.

Supplier Bank work should support that loop by making it easier to source and
stage product data. It should not push scraped prices into live products without
review.

## Current Evidence

### Strong Foundations

- Multi-tenant storefront architecture exists.
- Site Design V2 and storefront theme tooling exist.
- Product detail pages, product grids, and Matrix Layout V1 pricing exist.
- Designer has PDF import/edit/export foundations and vector-preserved PDF
  handling.
- PDF-service foundation exists but still needs production service wiring.
- Supplier Bank tables, admin UI, Edge Functions, source registry, and CLI
  reports exist.
- WIRmachenDRUCK, Print.com, and Pixartprinting are registered external
  suppliers.
- Internal systems such as Salgsmapper/Sales Maba, Webprinter, Onlinetryksager,
  and localhost are excluded as external supplier sources.

### Current Supplier Bank State

Latest evidence files:

- `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`
- `docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md`
- `docs/SUPPLIER_BANK_IMPORTED_DRAFT_QA_LATEST.md`
- `docs/SUPPLIER_BANK_COMPLETION_AUDIT_LATEST.md`
- `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`

As of the refreshed 2026-07-07 reports:

- Supplier family coverage is `9/14`.
- Imported draft QA is `9 OK`, `0 warnings`, `1 error`.
- One older WIRmachenDRUCK imported target is published:
  `wmd-folder-bank-891a5cf1`.
- The current full WIRmachenDRUCK folder draft
  `wmd-folder-bank-20260703` has `18,800` expected Matrix Layout price rows and
  `18,800` stored `generic_product_prices` rows.
- Pixart rigids/signs remains approval-gated. The safer next decision is whether
  to keep the current Plastic-only bank baseline or explicitly approve the
  bank-only Plastic+Plexiglass candidate.

## Commercial Pillars

### 1. Tenant Storefronts As Pilots

Each owned tenant needs one production-ready customer flow before broad catalog
expansion.

Priority:

1. `webprinter.dk` as platform flagship.
2. `salgsmapper.dk` as focused sales-folder/template proof.
3. `onlinetryksager.dk` as broader print-product storefront.

Done when each pilot has:

- clean front page
- product category entry points
- at least one orderable product with verified pricing
- working designer/upload/self-template choice
- checkout/order path verified
- SEO metadata and analytics visibility
- admin processing path verified

### 2. Golden Product Flow

Use `docs/GOLDEN_PRODUCT_FLOW_PLAN_2026-06-28.md` as the product-flow contract.

Do this product by product:

1. Identify source type: manual Matrix V1, fetched storformat, supplier-bank
   draft, Print.com/POD, or static legacy.
2. Verify price rows and frontend preview.
3. Verify product-to-designer handoff.
4. Verify upload/proofing path.
5. Verify checkout and order creation.
6. Verify admin processing.

The first flagship product remains `/produkt/aluminium` unless a different
product is explicitly chosen for launch.

### 3. Product And Pricing Reliability

Pricing is a business-critical trust surface.

Rules:

- Do not change core pricing calculations without explicit approval.
- Keep bank-imported products unpublished until reviewed.
- Verify price-row counts after every import.
- Keep supplier price snapshots separate from live storefront price decisions.
- Add simple admin visibility for "price preview has rows / no rows / mismatch".

### 4. Designer And Template Readiness

The designer should open in the context of the selected product.

Rules:

- If a product has a template PDF, the design button opens that exact template.
- Template/dieline PDF overlays must remain non-printing or export-safe guide
  layers.
- Customers must also be able to download the correct template PDF when they
  design in external software.
- Salgsmapper products should use sales-folder templates first, then expand to
  letterheads/business cards where relevant.
- Stirling-PDF and Open Design remain inspiration/tooling sources unless a
  reviewed integration is approved.

Current product-page support:

- The price/action panel now shows `Download skabelon` beside `Design online`
  when the selected product/format resolves to a template PDF launch. The
  designer button still opens the same product/template context, and the
  download action does not write checkout, pricing, product or order data.

Relevant plan:

- `docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md`

### 5. Checkout And Order Operations

The platform is not commercially ready until the whole order loop is boring and
repeatable.

Done when:

- checkout only accepts valid current quotes
- stale designer states are invalidated when price-driving options change
- upload/designer/self-template flows are visible in admin
- admin can distinguish draft, paid, proof-needed, production-ready, and problem
  orders
- production files and customer choices are traceable

Current order trace support:

- Checkout now writes production/template trace tags into `status_note`:
  `[PRODUKTIONSFLOW]`, `[SKABELON]` and `[SKABELON-DOWNLOAD]`. Admin order
  list shows a compact flow badge and flow filter, and order detail displays
  these tags and attached-file notes, so operators can see whether the order came from
  designer export, customer upload, or external template-based design without
  adding new schema.
- Admin order list also shows read-only production readiness from existing
  order flags and current `order_files`, with a `Klarhed` badge/filter for file
  ready, waiting for customer file, missing file, reupload, problem, production,
  closed, and manual-control states.
- Order detail shows a read-only `Produktionsklarhed` panel with flow,
  readiness, file counts, and the next recommended handling step.
- Selecting `Under produktion` shows a warning-only readiness guardrail when
  the order is not file-ready; this warns operators without changing save logic
  or adding workflow automation.
- Product admin `Produkt & Priser` shows a read-only `Pris-preview status`
  card that counts Matrix price rows, warns at `0` rows, summarizes very large
  Matrix imports, and labels STORFORMAT/MPA products as separate pricing paths.
  Product overview now also shows read-only price-health badges per product and
  a top summary of Matrix OK, missing Matrix prices, and special pricing paths.
  Those summary chips also filter the product overview, so missing Matrix-price
  products can be isolated without opening every product. If an operator tries
  to publish a Matrix product with `0` price rows, the publish toggle now asks
  for explicit confirmation before saving. The `Klar` marker uses the same
  warning-only confirmation, and master-tenant release/send-to-tenant actions
  now warn before distributing a Matrix product whose price preview has no rows.
- The commercial readiness cockpit mirrors order/file readiness at tenant level
  in `Ordredrift signaler`, reading existing `orders` and current `order_files`
  to show total orders, file-ready orders, problem/reupload pressure, and
  missing/customer-file pressure without writing anything.
- `Commercial ready scorecard` now includes `Ordredrift og filklarhed er
  synlig`, so file-ready/order-pressure evidence affects the CEO-level readiness
  count.
- The commercial readiness cockpit now includes `Betaling/checkout signaler`,
  reading existing `tenant_payment_settings` to show live Stripe, Stripe setup,
  or manual/test payment decision state without invoking Stripe or changing
  fees. The scorecard includes `Betaling/checkout pilot er afklaret`.
- The commercial readiness cockpit now includes `Kundeservice signaler`,
  reading existing `order_messages` and `platform_messages` to show
  order-message volume, platform support-message volume, unread customer/tenant
  messages, and latest visible message per owned tenant without sending
  messages or marking anything as read. The scorecard includes `Kundeservice og
  dialog er synlig`.
- The commercial readiness cockpit now includes `Mail/notifikationer signaler`,
  reading existing `tenants.settings` and `tenant_notifications` to show
  customer order-confirmation state, admin new-order mail state, tenant company
  email, unread internal notifications and whether admin order mails would be
  skipped because the company email is missing or invalid. The scorecard
  includes `Mail og notifikationer er afklaret`.
- The commercial readiness cockpit now includes `Levering/fulfillment
  signaler`, reading product `order_delivery`, existing order
  `delivery_type`/tracking values, `delivery_tracking` counts and
  `tenant_pod_shipping_profile` sender readiness without changing delivery
  methods, tracking, POD sender identity, order status, pricing or product
  setup. The scorecard includes `Levering og fulfillment er synlig`.
- The commercial readiness cockpit now includes `Jura/cookie signaler`,
  reading existing `tenants.settings.company` and comparing it with the public
  routes `/kontakt`, `/privatliv`, `/cookiepolitik` and `/betingelser`, plus
  the contact form's privacy-policy consent link and the current cookie
  banner/settings flow. It surfaces missing company email and missing
  CVR/address, while the cookie settings dialog now routes tenant terms to
  `/betingelser` and platform terms to `/handelsbetingelser` without losing
  localhost `force_domain` context. The tenant contact form also links its
  consent text to `/privatliv` with the same domain context, and the default
  tenant footer terms link now uses `/betingelser`. These links reuse the
  existing storefront tenant-context helper. The platform contact form also
  requires the same privacy-policy consent before a platform lead message can be
  submitted. It does not change cookies, tracking, legal text or tenant
  settings. The scorecard includes the `Jura, cookie og kontakt er synlig`
  criterion.
- The commercial readiness cockpit now includes `Platform henvendelser`, a
  read-only lead-readiness layer for the Webprinter sales site. It shows that
  the public platform contact form has required fields and privacy consent,
  that the privacy link keeps `webprinter.dk` context on localhost, and that
  messages use the existing contact mail handoff. Successful platform contact
  submissions are also logged as unread master `platform_messages` with a
  `[PLATFORM LEAD]` prefix, and admin `Beskeder` labels that thread as
  `Platform henvendelser` when lead messages exist. That thread is shown as a
  read-only log so operators do not mistake an internal note for an external
  e-mail svar. Cockpittet læser nu også de masterbeskeder som en read-only
  leadtæller med samlet antal, ulæste henvendelser og seneste tidspunkt. Admin
  `Beskeder` viser nu et fokuseret leadkort for tråden med nyeste kundeemne,
  ulæste henvendelser, beskedpreview og en sikker `mailto:`-overdragelse, mens
  selve tråden stadig er read-only. Cockpittets opfølgningslink åbner direkte
  samme mastertråd via `tenantId=00000000-0000-0000-0000-000000000000`.
  Åbning af mastertråden auto-markerer ikke platformhenvendelser som læst, så
  unread-signalet ikke forsvinder uden en eksplicit leadhandling. Admin header
  og sidebar tæller platformhenvendelser separat, og ved lead-only unread state
  åbner beskedikonet direkte mastertråden.
  Mail-overdragelsen forbliver QA indtil en indbakke/admin-test er bevidnet.
  Scorecardet inkluderer
  `Platformhenvendelser kan modtages og følges op`.

### 6. SEO, Search Console, And Analytics

Google Search Console redirect warnings are not automatically bad. They become
a problem only if important canonical pages are redirecting unintentionally.

Commercial readiness needs:

- canonical host/domain rules per tenant
- sitemap and robots checks per tenant
- visible SEO metadata per product/category page
- analytics/Search Console views connected per owned domain
- admin SEO dashboard that separates indexed pages, redirects, clicks,
  impressions, and likely fixes

This should connect to Google data in the SEO system, but the first step is a
read-only visibility dashboard. Do not make automated SEO redirects/canonical
changes without reviewing the affected URLs.

### 7. Supplier Bank As Sourcing Engine

Supplier Bank should become a clear admin experience:

- choose supplier
- choose product family
- filter options like size, pages, paper, material, finish, quantity
- preview supplier-backed product
- import as an unpublished draft
- verify prices
- decide whether to publish later

Rules:

- No direct scraped-price publishing.
- No automatic live product changes.
- No use of internal tenants as suppliers.
- All write actions stay approval-gated where the reports say so.

### 8. Platform Packaging For Print Houses

When approaching a print house, the offer should be simple:

- branded tenant storefront
- product/pricing catalog
- online designer and PDF upload/preflight
- checkout/order intake
- supplier/product-bank staging
- SEO/analytics visibility
- admin controls for publishing, pricing, templates, and orders

The pitch should not depend on unfinished scraping. It should depend on proved
tenant flows.

## 30 Day Plan

1. Pick one live pilot path per owned tenant.
2. Fix any remaining admin login/access issues for `admin@webprinter.dk`.
3. Verify `/produkt/aluminium` or chosen flagship product end to end.
4. Verify one `salgsmapper.dk` sales-folder product with template download and
   designer handoff.
5. Keep admin price-preview row warnings visible while verifying pilot products.
6. Decide what to do with the older published supplier-bank WMD duplicate.
7. Keep Supplier Bank reports refreshed and visible.
8. Connect SEO/Search Console data read-only where credentials/API access allow.

## 60 Day Plan

1. Expand each tenant to 3-5 verified products.
2. Harden checkout/order admin states.
3. Add regression checks for product -> designer -> checkout signature handling.
4. Deploy and verify the designer PDF service if production usage is desired.
5. Build a simple tenant readiness dashboard in admin.
6. Improve Supplier Bank browsing so it feels like product shelves, not a
   technical report wall.
7. Resolve Pixart rigids and Print.com `other` only through explicit
   approval-gated paths.

## 90 Day Plan

1. Prepare a demo tenant that shows the full platform cleanly.
2. Create onboarding steps for a new print-house tenant.
3. Define minimum data needed from a print house: products, pricing, delivery,
   templates, logo/brand, payment settings, production workflow.
4. Create an operations runbook for importing/staging products.
5. Package the commercial offer around tenant setup, product catalog,
   design/upload, orders, SEO visibility, and optional supplier sourcing.

## Immediate Implementation Slice

The next safest implementation slice is a "commercial readiness cockpit" in
admin, backed first by local/project evidence and then later by live data:

- tenant readiness cards for Webprinter, Salgsmapper, and Onlinetryksager
- product-flow checklist per selected flagship product
- price-preview health
- designer/template readiness
- checkout/order readiness
- SEO/Search Console visibility placeholder/read-only integration
- Supplier Bank gate status from latest reports

This should be additive and read-only at first. It should not publish products,
write prices, or change tenant storefront behavior.

Implemented first read-only version:

- route: `/admin/commercial-readiness`
- sidebar label: `Driftsklarhed`
- current scope: tenant pilot cards, platform readiness pillars, Supplier Bank
  gate facts, and next operational action links
- latest expansion: tenant cards now read live, defensive Supabase signals for
  tenant existence, product counts, published product counts, first product
  price rows, active designer templates, SEO rows, and order counts. Supplier
  Bank facts remain report-derived and read-only.
- first-product flow checks now distinguish Matrix price rows from STORFORMAT
  tier rows, show product template/designer-launch readiness, and show an
  approximate order trace for the selected proof product. These checks are
  observational only.
- newest expansion: a `Flow-blokeringer og QA` section turns those read-only
  checks into prioritized tenant issues with direct admin links. It is still
  observational and does not publish products, write prices, or change orders.
- latest operator layer: `Bevisflow pr. tenant` shows five read-only proof
  steps for each owned tenant: product/domain, price preview, designer/template,
  checkout/order, and SEO visibility. Each step links to the relevant admin
  area using the tenant's own `force_domain`.
- newest acceptance layer: `Klar-til-demo beviser` turns the same read-only
  signals into evidence criteria per tenant: public product page, price preview,
  designer/template, checkout/order, and SEO visibility. It reports what is
  proved and what is missing without writing orders, prices, products, or SEO.
- latest executive layer: `Ledelsesblik: næste handling` chooses one read-only
  next action per tenant from the evidence gaps, with a tenant-safe admin link.
  It is meant to answer what the operator should fix or verify first.
- latest commercial layer: `Trykkeri-demo gate` summarizes the platform-level
  demo readiness gates: tenant proof, price/designer/order evidence, order
  readiness, SEO visibility, Supplier Bank risk, and sales/demo package. It is
  read-only and should not be treated as publish or import automation.
- latest sales layer: `Demo-køreplan for trykkeri` gives a read-only demo
  sequence for a print-house conversation: Webprinter platform, product/price,
  Salgsmapper niche proof, admin/order readiness, Supplier Bank staging, gates,
  and Onlinetryksager as secondary pilot.
- latest pilot-order layer: `Første pilotordre-plan` turns Webprinter's first
  controlled order into six read-only steps: pilot product, price preview,
  designer/upload handoff, payment choice, admin order proof, and Salgsmapper as
  template proof.
- latest sales-package layer: `Trykkeri-salgspakke` turns the cockpit into a
  CEO-level print-house package: demo script, pilot-order proof, tenant
  showcase, onboarding/drift, offer model, and risk boundaries.
- latest offer layer: `Første trykkeripilot: tilbudsmodel` turns the package
  into concrete read-only offer lines for branded tenant/storefront, first
  product package, designer/upload/PDF, checkout/order intake, SEO reporting,
  Supplier Bank staging, support/onboarding, and commercial price frame. It
  shows current proof and the remaining business decision, but does not set
  prices or mutate products/orders.
- latest execution layer: `30-dages eksekveringsplan` turns the roadmap's
  30-day plan into an operator-visible read-only checklist. It covers owned
  tenant pilot paths, manual `admin@webprinter.dk` access verification,
  Webprinter flagship E2E flow, Salgsmapper template proof, price-preview
  warning visibility, WMD duplicate decision, Supplier Bank report visibility,
  and SEO/Search Console read-only connection. Product admin also exposes this
  as a read-only `Pris-preview status` card on `Produkt & Priser`.
- latest rehearsal layer: `Pilot-gennemgang` turns the next manual QA into a
  read-only witness list with direct links for Webprinter product/price,
  designer or upload handoff, admin order proof, Salgsmapper template/download,
  Onlinetryksager first product choice, SEO/Search Console, Supplier Bank
  staging boundary, and `admin@webprinter.dk` access. `Bevisfangst for
  generalprøve` now reuses the same pilot proof list to show what to capture,
  what counts as accepted, and which stop rule keeps a point out of an external
  trykkeridemo.
- latest operations layer: `Pilotdrift runbook` turns the first controlled order
  into a read-only admin operating checklist: order data, product/price basis,
  design/upload/PDF check, payment decision, production owner, proof/customer
  communication, delivery/closeout, and what may be kept as sales evidence.
- latest access layer: `Adgangsberedskab for adminmail` turns the
  `admin@webprinter.dk` concern into a read-only manual access checklist across
  the admin areas needed for the pilot. It does not mutate auth, roles, sessions
  or permissions.
- latest priority layer: `Prioriteret handlingskø` ranks the next operator
  actions across critical path, pilot proof, pilotdrift, admin access, go/no-go
  and the 30-day plan, keeping the cockpit focused on what to do next.
- latest meeting layer: `Trykkerimødepakke` turns the current evidence into a
  read-only first print-house meeting pack: purpose, what may be shown, which
  proof points may be mentioned, what must not be promised, the commercial
  question and next follow-up.
- latest goal layer: `Måleksekvering` turns the active commercial goal into a
  read-only six-phase execution board: cockpit ownership, owned-tenant proof,
  pilot proof/drift, adminmail access, first print-house meeting readiness, and
  visible sales evidence. It links to existing admin evidence and does not
  mutate live data. The section now also shows `Automatisering og menneskelig
  bevisførelse`, a read-only split of safe Codex/system work, manual QA, and
  CEO/business decisions. The cockpit now starts with `Næste sikre handling`:
  next safe system step, next manual proof step, and first live-blocking
  business decision. It also includes `Browserrute til generalprøve`, a compact
  numbered route through the owned tenant proof pages for manual rehearsal, plus
  `Bevisfangst for generalprøve` for capture, acceptance and stop rules.
- latest demo-boundary layer: `Ekstern demo-grænse` separates what may be shown
  externally, what is pilot-only, and what must stay internal before the first
  print-house conversation. It covers platform/tenant proof, Salgsmapper,
  pilotordre, SEO, Supplier Bank, and price/payment/delivery promises without
  mutating live data.
- latest pilot-accept layer: `Pilotaccept for trykkerikunde` adds a read-only
  internal go/no-go gate before a real print-house pilot. It combines
  commercial-ready scorecard, external demo boundary, pilotdrift, adminmail
  access, offer model, and CEO decision queue without creating customers,
  offers, prices, payments, products or order changes.
- latest responsibility layer: `Pilotansvarskort` adds a read-only ownership map
  for the first print-house pilot: CEO go/no-go, product package, operations,
  file/PDF control, admin access, SEO/reporting, Supplier Bank boundaries,
  economy, support and demo ownership. It does not assign roles or mutate live
  data.
- latest scope layer: `Pilotscope aftalegrundlag` adds a read-only scope frame
  for the first print-house pilot. It lists what is included, what is excluded,
  and which business decision is still needed for tenant/branding, product
  package, designer/upload/PDF, checkout/order, SEO, Supplier Bank, support,
  price frame and pilot go/no-go. It does not create offers, prices or customer
  records.
- latest onboarding layer: `Pilotonboarding plan` adds a read-only manual
  sequence for what happens after a print house says yes to a pilot: internal
  accept, tenant/domain/brand, first product package, templates/upload,
  order/admin test, adminmail access, SEO/reporting, Supplier Bank boundaries,
  economy/support and internal rehearsal. It does not create tenants, products,
  customers, offers, roles or prices.
- latest success layer: `Pilotsucces og exitkriterier` adds a read-only pilot
  measurement board for continue, pause, and convert decisions. It uses existing
  cockpit evidence for blockers, product/pricing/template proof, manual order
  handling, scope boundaries, SEO visibility, commercial-ready score and
  reusable sales proof. It does not mutate customers, offers, products, prices,
  orders, roles, SEO rows or Supplier Bank data.
- latest handoff layer: `Trykkeripilot handoff` turns the proof, scope,
  onboarding and success criteria into a CEO-ready bridge for the first
  print-house conversation: what may be shown, what the pilot includes, what
  needs go/no-go, what customer input is needed, what must not be promised, and
  how success is judged. It is read-only and does not create offers, customers,
  prices, products, order status changes or supplier publishing.
- latest meeting-answer layer: `Trykkeripilot Q&A` turns the same proof and
  boundaries into direct first-meeting answers: what can be shown, first pilot
  scope, supplier/pricing automation, order/file handling, payment/support,
  customer input, success criteria, go-live and next commercial decision. Each
  answer includes proof and a boundary, and remains read-only.
- latest meeting-brief layer: `Første mødebrief` condenses the live
  conversation into five steps: open calmly, show only the short demo, ask the
  commercial pilot question, repeat the non-promises, and end with the next
  action. It is derived from meeting pack, Q&A, handoff and priority queue, and
  remains read-only.
- latest follow-up layer: `Eftermøde opfølgning` converts the first meeting
  brief into a read-only post-meeting draft: recap, pilot proposal, customer
  input request, non-promises and internal next action. It does not send mail or
  create leads/offers/customers.
- latest offer-draft layer: `Pilottilbud kladde` converts follow-up, offer
  model, scope, pilotaccept and priority queue into a read-only first-offer
  preparation view without amounts: purpose, delivery package, customer input,
  attachable proof, non-promises, internal approval and support form. It does
  not send mail or create leads/offers/customers.
- latest agreement-check layer: `Pilotaftale tjekliste` checks whether the
  pilot purpose, scope, customer input, economy decision, responsibility/support,
  success/exit criteria and non-promises are ready before the offer draft can
  become a real agreement. It remains read-only and creates no contract, offer,
  customer, price, order or email.
- latest pilot-start layer: `Pilotstart plan` turns a print-house yes into a
  read-only first-days sequence: internal accept, customer kickoff input,
  adminmail/access check, product/design path, first manual order, evidence
  packet and week-1 decision. It does not create tenants, products, prices,
  orders, roles, emails, contracts or Supplier Bank writes.
- latest week-one layer: `Pilot uge-1 rapport` summarizes the first pilot
  week's start-plan progress, order/file readiness, payment, support/mail
  pressure, delivery, SEO visibility and continue/pause/convert decision from
  existing cockpit evidence. It remains read-only and creates no report files,
  customers, offers, prices, orders, emails, product changes or Supplier Bank
  writes.
- latest conversion layer: `Konverteringsklar pilot` checks whether week-1
  proof, agreement basis, offer boundaries, success criteria, economy/support
  decisions and Supplier Bank limitations are clear enough before a pilot
  becomes a paid first package. It remains read-only and creates no offers,
  contracts, customers, prices, products, orders, mails or Supplier Bank
  writes.
- latest paid-pilot layer: `Betalt pilotpakke` summarizes what a first
  print-house customer can buy after pilot proof: scope, non-promises,
  price/payment decisions, order/delivery, support/legal responsibility and next
  phase. It remains read-only and creates no offers, contracts, customers,
  prices, products, orders, mails, payment settings or Supplier Bank writes.
- latest onboarding layer: `Første kundes onboarding` lists customer input and
  internal checks for agreement boundary, tenant/brand, products/pricing
  responsibility, templates/file flow, order/payment/delivery, admin access,
  reporting/sourcing and internal rehearsal. It remains read-only and creates
  no tenants, customers, products, prices, orders, roles, mails, payments or
  Supplier Bank writes.
- latest setup layer: `Setup-arbejdsordre` turns first-customer onboarding into
  internal setup tasks for package boundary, tenant/brand, products, templates,
  order path, admin access, reporting/sourcing and final rehearsal. It remains
  read-only and creates no tenants, customers, products, prices, orders, roles,
  mails, payments or Supplier Bank writes.
- latest kickoff layer: `Kundekickoff agenda` turns setup tasks into first
  customer meeting points for pilot boundary, tenant/brand, products/pricing
  responsibility, files, order/payment/delivery, support/access,
  reporting/sourcing and next action. It remains read-only and sends no mails
  and creates no customers, offers, products, prices, orders, payments or
  Supplier Bank writes.
- latest kickoff follow-up layer: `Kickoff opfølgning` turns the first customer
  kickoff agenda into recap, customer material request, product/pricing
  clarification, order/responsibility follow-up, reporting/sourcing boundary
  and next internal action. It remains read-only and sends no mails and creates
  no customers, offers, products, prices, orders, payments or Supplier Bank
  writes.
- latest material layer: `Kundemateriale checkpoint` lists the customer
  material and decisions that must be manually confirmed before setup
  continues: brand, products/pricing responsibility, templates/files,
  order/payment/delivery, support/access, reporting/sourcing and next internal
  action. It remains read-only and fetches no attachments, sends no mails and
  creates no customers, products, prices, orders, payments or Supplier Bank
  writes.
- latest release layer: `Frigivelse til produktion` separates the manual gates
  before a push/deploy is treated as safe: production build, localhost smoke
  checks, tenant proof, adminmail access, price/POD/Supplier Bank boundaries,
  deploy owner, rollback note and after-deploy tenant smoke checks. It remains
  read-only and creates no branches, commits, deployments, prices, products,
  orders, POD data or Supplier Bank writes.
- latest release-proof layer: `Releasebevis og accept` turns those release
  gates into a capture/acceptance checklist for build/localhost, tenant flow,
  adminmail, data boundaries, deploy/rollback and live smoke tests. It remains
  read-only and saves no files, writes no notes, creates no commits or
  deployments, and mutates no orders, prices, products or Supplier Bank data.
- latest automation layer: `npm run smoke:commercial-readiness` is a read-only
  route and asset smoke check for the owned tenant proof paths. It checks
  Webprinter, `/produkt/aluminium`, Salgsmapper, the Salgsmapper template PDF,
  admin cockpit routes, and the shipped bundle markers for template/order-flow
  support. It can target production or localhost with
  `-- --base-url http://127.0.0.1:8083`, and it does not write products,
  prices, orders, Supplier Bank rows, POD data, or Supabase state.
  `npm run smoke:commercial-readiness:browser` adds rendered Playwright checks
  for the same proof surface and catches runtime error screens. The first
  browser smoke found the `/produkt/aluminium` render crash caused by a null
  checkout session in template-download state preservation; the product panel
  now only preserves `templateDownloadedAt` when an existing session and the
  current template PDF URL both exist and match.
  It now also verifies product-to-designer handoff by clicking `Design online`
  from Webprinter aluminium and the first Salgsmapper template product. The
  check confirms `/designer` receives `order=1`, product context, return path,
  checkout session state, and the Salgsmapper `templatePdfUrl`, without
  creating an order or writing live product/pricing/Supplier Bank data. It also
  verifies the Salgsmapper product-page `Download skabelon` link by checking
  the expected PDF path, Danish download filename, `application/pdf` response
  and `%PDF` file header. It also verifies product-to-checkout handoff by
  clicking `Bestil nu` from the same two products and checking
  `/checkout/konfigurer` for current product, selected format, quantity, price
  totals, tenant context, and Salgsmapper template PDF context. That check stops
  before upload, payment or order creation.
- latest Supplier Bank operations layer: `Supplier Bank staging-runbook` turns
  the roadmap item "Create an operations runbook for importing/staging
  products" into a read-only cockpit sequence: external source only, reported
  candidate, explicit approval, draft import, price-row QA, separate publishing
  decision and tenant handoff. It derives blocker state from existing Supplier
  Bank decisions and does not scrape, import, publish, or mutate live prices,
  products, POD data or Supplier Bank data.
- latest CEO decision layer: `Beslutningsvalgkort` turns each open sales
  blocker into recommended handling, alternatives, cost of waiting and a
  decision rule. It remains read-only and does not choose for the owner or
  mutate products, prices, payments, Supplier Bank, SEO or tenants.
- latest launch layer: `Go/no-go launch board` summarizes what can be demoed
  now, what remains pilot-only, what should stay out of the pitch, and which
  promises are blocked until proof exists.
- latest definition layer: `Commercial ready scorecard` maps this roadmap's
  definition of commercial ready to read-only cockpit evidence: end-to-end
  owned-tenant order, second tenant niche/template proof, traceable
  pricing/designer state, admin order handling, order/file readiness,
  payment/checkout clarity, customer dialogue visibility, mail/notification
  readiness, delivery/fulfillment readiness, legal/cookie/contact readiness,
  platform contact/lead readiness, SEO/analytics visibility, Supplier Bank
  staging safety, and simple business pitch language.
- latest proof layer: `Salgsmæssig bevismappe` maps pitch claims to current
  proof, missing gaps, and admin evidence links so the platform is sold from
  evidence rather than assumptions.
- latest navigation layer: the cockpit has a compact jump bar with anchored
  links to launch board, commercial-ready scorecard, sales proof, SEO proof,
  demo gate, demo runbook, pilot order, sales package, pilot offer, decisions,
  30-day execution, blockers, and tenant proof.
- latest SEO proof layer: `SEO/Search Console bevis` reuses the existing
  Platform SEO Search Console hooks and shows each owned domain's SEO row
  count, verified Search Console site state, 28-day clicks, impressions, CTR,
  and average position when connected. It is read-only and does not connect
  Google, write SEO rows, or mutate Search Console data.
- latest critical-path layer: `Kritisk sti til første trykkerisamtale`
  summarizes the six proof steps that should be solved first: Webprinter
  product/price, Salgsmapper template, controlled pilot order, payment/support,
  Supplier Bank boundaries, and sales story.
- latest intake layer: `Pilottrykkeri intake` turns the future customer
  onboarding conversation into a read-only checklist covering tenant/domain,
  brand, first products, pricing responsibility, templates, checkout/payment,
  order handoff, SEO/reporting, and sourcing boundaries.
- latest decision layer: `Beslutningskø før salg` lists the business decisions
  that still block a real sales/demo promise: Onlinetryksager first product,
  checkout/payment pilot, Salgsmapper template standard, old WMD publication,
  Pixart rigids approval, and the print-house sales story.

## Decisions Needed

These are business decisions, not automatic coding steps:

1. Should the older published WIRmachenDRUCK product
   `wmd-folder-bank-891a5cf1` be unpublished, archived, or intentionally kept
   public?
2. Which product is the first flagship flow for `webprinter.dk`?
3. Which Salgsmapper product/template should be the first production proof?
4. Should Pixart rigids Plastic+Plexiglass be approved as a bank-only write?
5. Should Print.com placemats be approved as a bank-only write?
6. Which payment/checkout configuration is intended for live orders during the
   first pilot?

## Guardrails

- Do not change POD v1 logic.
- Keep POD v2 additive and separate.
- Do not rewrite core pricing logic.
- Do not publish supplier-bank imported products without explicit approval.
- Do not use Salgsmapper, Webprinter, Onlinetryksager, or localhost as supplier
  sources.
- Do not run broad Supabase schema pushes while migration drift remains.
- Prefer read-only dashboards and reports before write automation.

## Definition Of Commercial Ready

The platform is commercially ready for the first print-house conversation when:

- one owned tenant can take a real order end to end
- a second owned tenant proves niche/template behavior
- pricing and designer state are traceable
- admin can process orders without developer help
- public company identity, cookie consent, contact form consent and tenant
  legal routes are visible
- SEO/analytics visibility exists
- Supplier Bank can stage/import products as drafts without touching live
  storefronts unexpectedly
- a demo/pitch can explain the system in simple business language
