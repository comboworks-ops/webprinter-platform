# Webprinter AI Continuity

Last updated: 2026-07-08
Purpose: give future AI/Codex instances immediate context before they edit code.

Start here, then read `HANDOVER.md`, `POD2_README.md` and
`SYSTEM_OVERVIEW.md`.

## One-Minute Summary

Webprinter is a multi-tenant SaaS platform for print shops. It has tenant
storefronts, an admin panel, a Site Design V2 visual editor, a product price
calculator/matrix system, a print designer, SEO tooling and a POD v2 Print.com
integration.

Current active direction: make Webprinter commercially ready as a sellable
web-to-print platform. Use the owned tenants (`webprinter.dk`,
`salgsmapper.dk`, and `onlinetryksager.dk`) as proof tenants, and keep Supplier
Bank as a staging/sourcing engine behind the platform, not as the product by
itself.

The newest work was a large Site Design V2 and storefront polish pass:
- Complete visual theme presets.
- Stronger color and font presets.
- Different advanced button effects per theme.
- Contrast safeguards for buttons and hero CTAs.
- Hero/banner animation controls.
- Header dropdown layout/motion presets.
- Product option and matrix hotspots for side-panel editing.
- SEO/tenant-shell updates.
- POD v2 admin improvements and Danish Print.com label mapping.

The current branch `ui-cleanup` was committed, pushed and deployed to Vercel
production:
- Commit: `7932644 feat: polish tenant site design controls`
- Live: `https://www.webprinter.dk`

## Architecture Snapshot

Frontend:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Framer Motion
- TanStack Query
- React Router

Backend:
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Edge Functions
- RLS policies

Deployment:
- Vercel production alias: `https://www.webprinter.dk`

Important multi-tenant behavior:
- Storefront code is shared.
- Tenant-specific branding/SEO/product data is stored in Supabase.
- Code changes deploy globally, but saved tenant settings remain per tenant.
- Localhost often points at the same Supabase data as production.

## Current Priority Areas

### Commercial Readiness Roadmap

North-star plan:
- `docs/WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md`

CEO-level recommendation:
- Prioritize complete tenant order flows over broad supplier scraping.
- Prove one owned tenant can take a real order end to end.
- Prove Salgsmapper as the focused template/sales-folder tenant.
- Keep Supplier Bank imports unpublished until explicit business approval.
- Add read-only admin readiness visibility before adding write automation.

Implemented read-only admin route:
- `/admin/commercial-readiness`
- Sidebar label: `Driftsklarhed`
- Purpose: show tenant pilot status, product/designer/checkout/SEO readiness,
  Supplier Bank gate status, and next safe operational steps. It must remain
  read-only unless a later task explicitly approves write behavior.
- The route now reads live, defensive Supabase signals for tenant existence,
  product counts, published product counts, first product price rows, active
  designer templates, SEO rows, and order counts. Supplier Bank gate numbers
  remain report-derived/read-only.
- It also checks first-product flow health: Matrix vs STORFORMAT price rows,
  product template/designer-launch readiness, and approximate order traces for
  the selected proof product. These checks are observational only.
- It now surfaces prioritized `Flow-blokeringer og QA` issues with direct admin
  links, while remaining read-only.
- It also includes `Bevisflow pr. tenant`: five read-only proof steps per owned
  tenant with tenant-safe admin links for product/domain, price preview,
  designer/template, checkout/order, and SEO visibility.
- It now includes `Klar-til-demo beviser`, a read-only acceptance/evidence layer
  showing which tenant proof points are actually proven and which are still
  missing before a tenant can be demoed commercially.
- It now includes `Ledelsesblik: næste handling`, which derives one read-only
  next best action per tenant from the current evidence gaps.
- It now includes `Trykkeri-demo gate`, a read-only platform-level gate summary
  for print-house demo readiness across tenant proof, evidence, orders, SEO,
  Supplier Bank risk, and sales/demo package.
- It now includes `Demo-køreplan for trykkeri`, a read-only sales/demo sequence
  that turns the cockpit into a guided print-house presentation.
- It now includes `Første pilotordre-plan`, a read-only operating checklist for
  proving one controlled Webprinter order before using the system in sales.
- It now includes `Trykkeri-salgspakke`, a read-only CEO/sales readiness layer
  for demo script, pilot-order proof, tenant showcase, onboarding, offer model,
  and risk boundaries.
- It now includes `Go/no-go launch board`, a read-only CEO view of what can be
  demoed, what is pilot-only, and what must not be promised yet.
- It now includes `Commercial ready scorecard`, a read-only scorecard mapped
  directly to the roadmap's definition of commercial ready for a first
  print-house conversation: end-to-end owned-tenant order, second tenant
  niche/template proof, traceable pricing/designer state, admin order handling,
  order/file readiness, payment/checkout clarity, customer dialogue visibility,
  mail/notification readiness, delivery/fulfillment readiness, legal/cookie/contact
  readiness, platform contact/lead readiness, SEO/analytics visibility, Supplier
  Bank staging safety, and simple business pitch language.
  It only aggregates existing cockpit evidence and links to the relevant admin
  areas.
- It now includes `Salgsmæssig bevismappe`, a read-only binder that maps each
  possible sales claim to current proof, missing gaps, and the relevant admin
  evidence link.
- It now has a compact cockpit jump bar with anchors to the key commercial
  sections, so operators can move directly between launch, proof, demo,
  pilot-order, sales, decisions, blockers, and tenant evidence.
- It now includes `SEO/Search Console bevis`, a read-only visibility layer for
  the three owned domains. It reuses the existing Platform SEO Search Console
  hooks and shows SEO row count, verified Search Console site state, 28-day
  clicks, impressions, CTR, and average position when connected. It does not
  connect Google, write SEO rows, or change Search Console data.
- It now includes `Første trykkeripilot: tilbudsmodel`, a read-only offer
  framing layer for the first print-house conversation. It lists package lines
  for branded tenant/storefront, first product package, designer/upload/PDF,
  checkout/order intake, SEO reporting, Supplier Bank staging, support/onboarding,
  and commercial price frame. It shows current proof and the CEO/business
  decision still needed, but does not set prices or change products/orders.
- It now includes `30-dages eksekveringsplan`, a read-only operator checklist
  mapped to the roadmap's 30-day plan: owned-tenant pilot paths, manual
  `admin@webprinter.dk` access verification, Webprinter flagship E2E flow,
  Salgsmapper template proof, price-preview warning visibility, WMD duplicate
  decision, Supplier Bank report visibility, and SEO/Search Console read-only
  connection. Product admin `Produkt & Priser` now has a read-only
  `Pris-preview status` card that counts Matrix rows, warns at `0` rows,
  summarizes very large Matrix imports, and labels STORFORMAT/MPA as separate
  pricing paths. Product overview also shows read-only price-health badges per
  product plus a Matrix OK / missing Matrix prices / special pricing summary.
  The summary chips are filter buttons, so operators can isolate missing
  Matrix-price products without opening each card. Publishing a Matrix product
  with `0` price rows now asks for explicit confirmation before saving, and the
  product `Klar` marker uses the same warning-only confirmation. Master-tenant
  release/send-to-tenant actions now reuse the same read-only price-health signal
  and warn before distributing a Matrix product with `0` price rows.
  It links to existing admin areas and does not run login tests, imports,
  publishing, price changes, or SEO writes.
- It now includes `Pilot-gennemgang`, a read-only manual rehearsal checklist for
  the proof paths that must be witnessed before an external print-house
  conversation: Webprinter product/price, designer or upload handoff, order into
  admin, Salgsmapper template/download/designer proof, Onlinetryksager first
  product choice, SEO/Search Console visibility, Supplier Bank staging boundary,
  and `admin@webprinter.dk` access.
- It now includes `Bevisfangst for generalprøve`, a read-only checklist derived
  from the same pilot proof items. It tells the operator what to capture, what
  counts as accepted, and which stop rule keeps a point out of an external
  trykkeridemo. It does not write notes, files, prices, products, ordrestatus,
  SEO data or Supplier Bank state.
- It now includes `Pilotdrift runbook`, a read-only operating checklist for
  handling the first controlled order in admin: customer/order data, product and
  price basis, design/upload/PDF check, payment decision, production owner,
  proof/customer communication, delivery/closeout, and what may be saved as
  sales evidence. It does not change order statuses, payments, files, prices,
  products or publishing.
- It now includes `Ordredrift signaler`, a read-only tenant-level order
  operations summary. It reads existing `orders` and current `order_files` rows
  to show total orders, file-ready orders, problem/reupload pressure, and
  missing/customer-file pressure for each owned tenant. It does not create
  orders, move status, change files, or mutate pricing/products.
- It now includes `Betaling/checkout signaler`, a read-only tenant-level payment
  readiness summary. It reads existing `tenant_payment_settings` to show whether
  Stripe is live-ready, under setup, or whether a pilot order should stay as
  test/manual payment. It does not invoke Stripe, create accounts, change fees,
  or start payments.
- It now includes `Kundeservice signaler`, a read-only tenant-level
  customer/support summary. It reads existing `order_messages` and
  `platform_messages` to show order-message volume, platform support-message
  volume, unread customer/tenant messages, and latest visible message per owned
  tenant. It does not send messages, mark messages as read, or mutate support
  threads.
- It now includes `Mail/notifikationer signaler`, a read-only tenant-level
  notification readiness summary. It reads existing `tenants.settings` and
  `tenant_notifications` to show customer order-confirmation state, admin
  new-order mail state, tenant company email, unread internal notifications and
  whether admin order mails would be skipped because the company email is
  missing or invalid. It does not send emails, update settings or mark
  notifications as read.
- It now includes `Levering/fulfillment signaler`, a read-only tenant-level
  delivery and fulfillment summary. It reads product `order_delivery`, existing
  order `delivery_type`/tracking values, `delivery_tracking` counts and
  `tenant_pod_shipping_profile` sender readiness. It does not change delivery
  methods, tracking, POD sender identity, order status, pricing or product
  setup.
- It now includes `Jura/cookie signaler`, a read-only tenant-level legal and
  consent summary. It reads existing `tenants.settings.company` and compares it
  with the existing public routes `/kontakt`, `/privatliv`, `/cookiepolitik`
  and `/betingelser`, the contact form's privacy-policy consent link, plus the
  current cookie banner/settings flow. It surfaces missing company email and
  missing CVR/address, while the cookie settings dialog now routes tenant terms
  to `/betingelser` and platform terms to `/handelsbetingelser` without losing
  localhost `force_domain` context. The tenant contact form also links its
  consent text to `/privatliv` with the same domain context, and the default
  tenant footer terms link now uses `/betingelser`. These links reuse the
  existing storefront tenant-context helper. The platform contact form also
  requires the same privacy-policy consent before a platform lead message can be
  submitted. It does not change cookies, tracking, legal text or tenant
  settings.
- It now includes `Platform henvendelser`, a read-only platform lead-readiness
  layer for the Webprinter sales site. It shows that the public platform contact
  form has required contact fields and privacy consent, that the privacy link
  preserves `webprinter.dk` context on localhost, and that successful platform
  contact messages use the existing `send-contact-message`/Resend mail handoff
  while also being logged as unread master messages in `platform_messages` with
  a `[PLATFORM LEAD]` prefix. Admin `Beskeder` labels that master thread as
  `Platform henvendelser` when lead messages exist, and shows that thread as a
  read-only log so operators do not mistake an internal note for an external
  e-mail svar. Cockpittet læser nu også de samme masterbeskeder som en
  read-only leadtæller med samlet antal, ulæste henvendelser og seneste
  tidspunkt.
  Admin `Beskeder` viser nu også et lille operatørkort i den tråd:
  samlet antal platformhenvendelser, ulæste henvendelser, nyeste kundeemne,
  beskedpreview og en sikker `mailto:`-overdragelse til svar uden for den
  interne log. Cockpittets opfølgningslink åbner direkte samme mastertråd via
  `tenantId=00000000-0000-0000-0000-000000000000`. Den mastertråd bliver ikke
  auto-markeret som læst ved åbning, så ulæste platformhenvendelser forbliver
  synlige indtil et senere eksplicit leadflow håndterer dem. Admin header og
  sidebar tæller platformhenvendelser separat; hvis de er de eneste ulæste
  beskeder, åbner beskedikonet direkte samme mastertråd.
  Mail-overdragelsen forbliver QA indtil en kontrolleret indbakke/admin-test
  er bevidnet.
  Det opretter ikke en ny CRM-tabel, sender ikke testmails, ændrer ikke
  tracking, produkter, priser, ordrer eller Supplier Bank.
- It now includes `Adgangsberedskab for adminmail`, a read-only manual access
  checklist for `admin@webprinter.dk` across dashboard, products, product price,
  Salgsmapper templates, orders/customers, Platform SEO, Supplier Bank,
  tenant/domain context, payment, modules and settings. It does not change auth,
  roles, sessions or permissions.
- It now includes `Prioriteret handlingskø`, a read-only top operator queue
  that ranks the next actions across critical path, pilot proof, pilotdrift,
  admin access, go/no-go and 30-day plan, so the cockpit starts with what to do
  next instead of only showing separate evidence sections.
- It now includes `Trykkerimødepakke`, a read-only meeting-prep layer for the
  first print-house conversation: meeting purpose, what may be shown, which
  proof points may be mentioned, what must not be promised, the commercial
  question to ask, and the next follow-up. It does not create offers, prices,
  emails, products or supplier changes.
- It now includes `Måleksekvering`, a read-only top execution layer that turns
  the active commercial goal into six trackable phases: cockpit ownership,
  owned-tenant proof, pilot proof/drift, adminmail access, first print-house
  meeting readiness, and visible sales evidence. It links back to existing
  evidence only and does not mutate prices, products, orders, auth, SEO, POD or
  Supplier Bank. The same section now includes `Automatisering og menneskelig
  bevisførelse`, which separates what Codex/system work can continue safely,
  what requires manual browser/admin QA, and what requires CEO/business decision.
  It is derived from existing cockpit evidence and remains read-only. The top of
  the cockpit now also includes `Næste sikre handling`, a three-lane focus strip
  for the next safe system step, next manual proof step, and first live-blocking
  business decision. `Browserrute til generalprøve` now compresses the existing
  pilot-proof cards into a numbered manual route with tenant-safe links for the
  internal rehearsal before an external print-house conversation. `Bevisfangst
  for generalprøve` sits beside that route and defines capture, acceptance and
  stop rules for each step.
- It now includes `Ekstern demo-grænse`, a read-only safety boundary for the
  first print-house conversation. It separates what may be shown externally,
  what is pilot-only, and what must stay internal, including Supplier Bank,
  SEO, payment and delivery promises. It does not change demo content,
  products, prices, payment, SEO or Supplier Bank.
- It now includes `Pilotaccept for trykkerikunde`, a read-only internal go/no-go
  gate before a real print-house pilot. It combines the commercial-ready
  scorecard, external demo boundary, pilotdrift, adminmail access, offer model,
  and CEO decision queue. It does not create customers, offers, prices,
  payments, products or order changes.
- It now includes `Pilotansvarskort`, a read-only responsibility map for the
  first print-house pilot: CEO go/no-go, product package, operations, file/PDF
  control, admin access, SEO/reporting, Supplier Bank boundaries, economy,
  support and demo ownership. It does not assign roles, change permissions or
  mutate live data.
- It now includes `Pilotscope aftalegrundlag`, a read-only scope frame for the
  first print-house pilot. It lists what is included, what is excluded, and
  which business decision is still needed for tenant/branding, product package,
  designer/upload/PDF, checkout/order, SEO, Supplier Bank, support, price frame
  and pilot go/no-go. It does not create offers, prices or customer records.
- It now includes `Pilotonboarding plan`, a read-only sequence for what happens
  after a print house says yes to a pilot: internal accept, tenant/domain/brand,
  first product package, templates/upload, order/admin test, adminmail access,
  SEO/reporting, Supplier Bank boundaries, economy/support and internal
  rehearsal. It does not create tenants, products, customers, offers, roles or
  prices.
- It now includes `Pilotsucces og exitkriterier`, a read-only measurement layer
  for the first print-house pilot. It defines when the pilot can continue, when
  it should be paused, and when it can be converted to a paid first package,
  based only on existing cockpit evidence. It does not create customers, offers,
  products, prices, orders, roles, SEO rows or Supplier Bank changes.
- It now includes `Trykkeripilot handoff`, a read-only bridge from pilot proof
  to first print-house conversation. It summarizes what may be shown, the
  concrete pilot scope, CEO go/no-go, customer input after a yes, what must not
  be promised yet, and how pilot success will be judged. It does not create
  offers, customers, prices, products, order status changes or supplier
  publishing.
- It now includes `Trykkeripilot Q&A`, a read-only answer layer for the first
  print-house meeting. It answers likely questions about what can be shown,
  pilot scope, supplier/pricing automation, orders/files, payment/support,
  customer input, success criteria, go-live and next commercial decision. Each
  answer links to proof and a boundary so the conversation does not become a
  feature promise. It does not create offers, customers, prices, products,
  order status, SEO data or Supplier Bank publishing.
- It now includes `Første mødebrief`, a read-only five-step live meeting brief:
  open calmly, show only the short demo, ask the commercial pilot question,
  repeat the non-promises, and end with the next action. It is derived from the
  meeting pack, Q&A, handoff and priority queue, and does not create offers,
  emails, customers, prices, products, order status or supplier publishing.
- It now includes `Eftermøde opfølgning`, a read-only post-meeting draft layer
  that turns the meeting brief and Q&A into recap, pilot proposal, customer
  input request, non-promises and internal next action. It does not send emails,
  create leads/offers/customers, change prices/products/order status, or
  publish Supplier Bank data.
- It now includes `Pilottilbud kladde`, a read-only first-offer preparation
  layer that converts follow-up, offer model, scope, pilotaccept and priority
  queue into offer sections without amounts: purpose, delivery package, customer
  input, attachable proof, non-promises, internal approval and support form. It
  does not send mail, create leads/offers/customers, set prices, mutate
  products/orders or publish Supplier Bank data.
- It now includes `Pilotaftale tjekliste`, a read-only agreement-readiness
  layer after the offer draft. It checks pilot purpose, scope, customer input,
  economy decision, responsibility/support, success/exit criteria and
  non-promises before any draft becomes a real customer agreement. It does not
  create contracts, customers, offers, prices, orders, emails, product changes
  or Supplier Bank publishing.
- It now includes `Pilotstart plan`, a read-only first-days plan after a
  print-house yes: internal accept, customer kickoff input, adminmail/access
  check, product/design path, first manual order, evidence packet and week-1
  decision. It does not create tenants, products, prices, orders, roles,
  emails, contracts or Supplier Bank writes.
- It now includes `Pilot uge-1 rapport`, a read-only internal status view for
  the first pilot week. It summarizes start-plan progress, first order/file
  readiness, payment, support/mail pressure, delivery, SEO visibility and the
  continue/pause/convert decision from existing cockpit evidence. It does not
  create report files, customers, offers, prices, orders, emails, product
  changes or Supplier Bank writes.
- It now includes `Konverteringsklar pilot`, a read-only conversion gate after
  the first pilot week. It checks whether week-1 proof, agreement basis, offer
  boundaries, success criteria, economy/support decisions and Supplier Bank
  limitations are clear enough before a pilot becomes a paid first package. It
  does not create offers, contracts, customers, prices, products, orders, mails
  or Supplier Bank writes.
- It now includes `Betalt pilotpakke`, a read-only package worksheet after the
  conversion gate. It summarizes what a first print-house customer can buy
  after pilot proof: scope, non-promises, price/payment decisions,
  order/delivery, support/legal responsibility and next phase. It does not
  create offers, contracts, customers, prices, products, orders, mails,
  payment settings or Supplier Bank writes.
- It now includes `Første kundes onboarding`, a read-only setup board after the
  paid package. It lists customer input and internal checks for agreement
  boundary, tenant/brand, products/pricing responsibility, templates/file flow,
  order/payment/delivery, admin access, reporting/sourcing and internal
  rehearsal. It does not create tenants, customers, products, prices, orders,
  roles, mails, payments or Supplier Bank writes.
- It now includes `Setup-arbejdsordre`, a read-only internal setup work order
  after first-customer onboarding. It turns the customer input into setup tasks
  for package boundary, tenant/brand, products, templates, order path, admin
  access, reporting/sourcing and final rehearsal. It does not create tenants,
  customers, products, prices, orders, roles, mails, payments or Supplier Bank
  writes.
- It now includes `Kundekickoff agenda`, a read-only first-customer meeting
  agenda after the setup work order. It turns setup tasks into meeting points
  for pilot boundary, tenant/brand, products/pricing responsibility, files,
  order/payment/delivery, support/access, reporting/sourcing and next action.
  It does not send mails or create customers, offers, products, prices, orders,
  payments or Supplier Bank writes.
- It now includes `Kickoff opfølgning`, a read-only post-kickoff follow-up
  layer. It turns the customer kickoff agenda into recap, customer material
  request, product/pricing clarification, order/responsibility follow-up,
  reporting/sourcing boundary and next internal action. It does not send mails
  or create customers, offers, products, prices, orders, payments or Supplier
  Bank writes.
- It now includes `Kundemateriale checkpoint`, a read-only manual material gate
  after kickoff follow-up. It lists the customer material and decisions that
  must be manually confirmed before setup continues: brand, products/pricing
  responsibility, templates/files, order/payment/delivery, support/access,
  reporting/sourcing and next internal action. It does not fetch attachments,
  send mails or create customers, products, prices, orders, payments or
  Supplier Bank writes.
- It now includes `Frigivelse til produktion`, a read-only release-readiness
  gate before a push/deploy is treated as safe. It separates production build,
  localhost smoke checks, tenant proof, adminmail access, price/POD/Supplier
  Bank boundaries, deploy owner, rollback note and after-deploy tenant smoke
  checks. It does not create branches, commits, deployments, prices, products,
  orders, POD data or Supplier Bank writes.
- It now includes `Releasebevis og accept`, a read-only proof-capture layer for
  the release gate. It states what to capture for build/localhost, tenant flow,
  adminmail, data boundaries, deploy/rollback and live smoke tests, plus what
  counts as accepted and when to stop. It does not save files, write notes,
  create commits, deploy, or mutate orders, prices, products or Supplier Bank
  data.
- It now has a read-only commercial smoke command:
  `npm run smoke:commercial-readiness`. By default it checks
  `https://www.webprinter.dk`; pass
  `-- --base-url http://127.0.0.1:8083` for localhost. It verifies the owned
  tenant proof routes, the Salgsmapper PDF template, admin cockpit routes, and
  shipped bundle markers for `Download skabelon`, `Produktionsklarhed`,
  `templatePdfUrl`, and `sales-mapper`. It does not create orders, write
  products, touch prices, scrape suppliers, or call Supabase write paths.
  `npm run smoke:commercial-readiness:browser` adds Playwright-rendered checks
  for the same commercial proof surface and fails if a page renders the Danish
  temporary error screen. This caught and fixed the `/produkt/aluminium`
  first-load crash where `ProductPricePanel` compared two missing template URLs
  as equal and then read `templateDownloadedAt` from a null checkout session.
  The browser smoke now also clicks `Design online` from `/produkt/aluminium`
  and from the first Salgsmapper template product, then verifies `/designer`
  receives `order=1`, product context, return path, checkout session state, and
  for Salgsmapper the correct `templatePdfUrl`. This proves product-to-designer
  handoff without creating orders or writing database state. It also verifies
  the Salgsmapper `Download skabelon` link on the product page, including the
  expected PDF path, Danish download filename, `application/pdf` response and
  `%PDF` file header. It also clicks `Bestil nu` from the same two product pages
  and verifies
  `/checkout/konfigurer` receives the current product, selected format,
  quantity, price totals, tenant context, and Salgsmapper template PDF context
  in session storage. It now also verifies that checkout shows the `Fil Upload`
  panel for both products, exposes an input accepting PDF/JPG/JPEG/PNG/TIFF,
  keeps `siteUpload` empty before any file is chosen, and keeps payment disabled
  before upload/customer details. That upload check deliberately does not select
  a real file, because doing so would write to storage; all checkout checks stop
  before upload, payment or order creation. The browser smoke also installs a
  synthetic in-session upload for both products, approves it in the UI, clicks
  `Gå til betaling`, and verifies the Danish customer/delivery validation
  blocks payment before any Stripe payment intent, order-file storage write or
  order insert request is sent. With valid smoke customer and delivery details,
  the same browser smoke intercepts `stripe-create-payment-intent` before it
  reaches Supabase and verifies the outgoing tenant id, amount, quote
  productId/slug/quantity, upload path, standard delivery metadata,
  blind-shipping boundary, customer metadata and Salgsmapper variant labels.
  The stubbed response intentionally returns no Stripe secret, so no real
  payment form, payment intent, storage write or order insert can be created.
  The smoke command also includes a local no-write source contract that checks
  checkout still writes admin-readable `[PRODUKTIONSFLOW]`, `[SKABELON]`,
  `[SKABELON-DOWNLOAD]`, delivery and `order_files` markers, and that
  `Kunder & Ordrer` still reads those tags and file-readiness signals.
  It also checks the Stripe payment-intent edge function source still requires
  `checkout_quote`, recalculates the amount through server-side `pricing-read`,
  rejects client/server amount mismatches, includes delivery/option components,
  and writes server-quote metadata to Stripe.
- It now includes `Supplier Bank staging-runbook`, a read-only operating
  sequence for supplier-bank products: external source only, report candidate,
  explicit approval, draft import, price-row QA, separate publishing decision
  and tenant handoff. It derives blocker state from the existing Supplier Bank
  decisions and does not scrape, import, publish or mutate live prices,
  products, POD data or Supplier Bank data.
- It now includes `Beslutningsvalgkort`, a read-only CEO decision helper for
  the open sales blockers. It turns each current decision into recommended
  handling, alternatives, cost of waiting and a decision rule, without choosing
  for the owner or mutating products, prices, payments, Supplier Bank, SEO or
  tenants.
- It now includes `Kritisk sti til første trykkerisamtale`, a read-only six-step
  summary of the smallest proof chain needed before approaching a print house.
- It now includes `Pilottrykkeri intake`, a read-only checklist for the
  information needed from a future print-house customer before onboarding:
  tenant/domain, brand, first products, pricing responsibility, templates,
  checkout/payment/order handoff, SEO/reporting, and sourcing boundaries.
- It now includes `Beslutningskø før salg`, a read-only queue of CEO/product
  decisions that must be made before the platform is presented as commercially
  ready.
- Local build note: ignored `dist` output had stale generated preview files
  that caused Vite cleanup errors. `vite.config.ts` now cleans the build output
  with a build-only pre-plugin and disables Vite's fragile `emptyOutDir` step,
  so Vite can build cleanly.
- Codex desktop shell note: global `npm` may be unavailable, and bundled
  `pnpm run build` can stop on pnpm's ignored-builds approval gate. In that
  environment, use the bundled Node runtime directly:
  `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`.

Key related plans:
- `docs/GOLDEN_PRODUCT_FLOW_PLAN_2026-06-28.md`
- `docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md`
- `docs/API_ROLLOUT_PLAN.md`

### System Review Recommendations

Latest non-destructive review:
- `docs/SYSTEM_REVIEW_RECOMMENDATIONS_2026-06-27.md`

Main recommendation:
- Harden service-role Edge Functions, Stripe amount calculation, admin role
  verification, and PDF-service input ownership before adding more large
  product surfaces.
- Clean duplicate/conflict artifacts only on a dedicated cleanup branch.

### Site Design V2

Main goal: admins should click storefront areas in preview and edit those areas
in the side panel.

Recent work:
- Added/expanded visual presets in `SiteDesignEditorV2.tsx`.
- Added theme-wide button surface controls and motion parameters.
- Added option/matrix box controls and hotspots.
- Connected price panel Download Tilbud styling target.
- Added page transitions and dropdown motion presets.

Key files:
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/preview/PreviewInteractionManager.tsx`
- `src/lib/siteDesignTargets.ts`
- `src/hooks/useBrandingDraft.ts`
- `src/components/admin/ProductOptionButtonEditor.tsx`
- `src/components/admin/ProductOptionSectionBoxEditor.tsx`
- `src/components/admin/ProduktvalgknapperSection.tsx`

### Storefront Header, Dropdowns and Hero

Recent work:
- Header dropdown presets and motion.
- Split-preview dropdown can use current campaign/framed product.
- Removed unnecessary image frames around PNG product images.
- Stabilized dropdown product hover so it zooms smoothly without lateral shift.
- Hero banner gained text animations, slide transitions and parallax controls.
- Hero buttons now protect against unreadable text and support `rgba(...)`.

Key files:
- `src/components/Header.tsx`
- `src/components/HeroSlider.tsx`
- `src/components/admin/HeaderSection.tsx`
- `src/components/admin/BannerEditor.tsx`

### Product Price Page

Recent work:
- Dynamic option buttons now have richer hover/selected styling.
- Matrix option buttons and white-format option buttons share more styling
  logic.
- Product grid CTAs and order buttons use theme-specific surfaces.
- Download Tilbud is style-targetable.
- Contrast helpers prevent unreadable text on theme-generated buttons.
- When a product/format resolves to a template PDF launch, the price/action
  panel now shows `Download skabelon` beside `Design online`. It uses the same
  product template resolution as the designer launch and does not write
  checkout, pricing, product or order data.
- The checkout session now remembers the resolved template PDF name/url and
  whether the customer clicked `Download skabelon`. Design-ready signatures
  include template context, so a stale design is invalidated if the product
  template changes.

Key files:
- `src/components/product-price-page/ProductPricePanel.tsx`
- `src/lib/checkout/siteCheckoutSession.ts`
- `src/components/product-price-page/DynamicProductOptions.tsx`
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx`
- `src/components/product-price-page/PriceMatrix.tsx`
- `src/components/product-price-page/StorformatConfigurator.tsx`
- `src/components/ProductGrid.tsx`
- `src/lib/pricing/selectorStyling.ts`

### Checkout And Order Traceability

Recent work:
- Checkout writes `[PRODUKTIONSFLOW]`, `[SKABELON]` and
  `[SKABELON-DOWNLOAD]` lines into `status_note` when an order is created, so
  admin can see whether the order came from designer export, customer upload,
  or external design via downloaded template.
- `Kunder & Ordrer` displays these production/template tags in the order list
  as a compact flow badge with a flow filter, in the order detail product card,
  and in `order_files.notes`, including whether the attached file came from
  designer export or customer upload.
- `Kunder & Ordrer` also reads current `order_files` rows to show a read-only
  `Klarhed` badge/filter and `Fil klar` count, so operators can separate orders
  with production files from orders that are waiting for customer files, require
  reupload, have problems, or still need manual control.
- Order detail now includes a read-only `Produktionsklarhed` panel with flow,
  readiness, current/all file counts, and the next recommended handling step.
- When an operator selects `Under produktion`, the status form shows a
  warning-only readiness guardrail if the order still has a problem, needs a
  reupload, lacks a current production file, waits for customer file, is closed,
  or needs manual control. It does not block saving or mutate workflow state.
- The commercial readiness cockpit mirrors this at tenant level in
  `Ordredrift signaler`, so pilot/demo review can see order/file readiness
  pressure without opening every order.
- `Commercial ready scorecard` now includes `Ordredrift og filklarhed er
  synlig`, so file-ready/order-pressure signals affect the CEO-level readiness
  count.
- `Commercial ready scorecard` also includes `Betaling/checkout pilot er
  afklaret`, so payment-mode clarity affects the CEO-level readiness count.
- `Commercial ready scorecard` also includes `Kundeservice og dialog er
  synlig`, so customer/order and tenant-support message readiness affects the
  CEO-level readiness count.
- `Commercial ready scorecard` also includes `Mail og notifikationer er
  afklaret`, so order confirmation/admin-mail readiness affects the CEO-level
  readiness count.
- `Commercial ready scorecard` also includes `Levering og fulfillment er
  synlig`, so delivery methods, tracking and POD sender readiness affect the
  CEO-level readiness count.
- `Commercial ready scorecard` also includes `Jura, cookie og kontakt er
  synlig`, so public company identity, contact email, cookie consent and
  tenant legal-route QA affect the CEO-level readiness count.
- `Commercial ready scorecard` also includes `Platformhenvendelser kan modtages
  og følges op`, so the platform's public contact/lead path is visible before a
  print-house sales conversation.

Key files:
- `src/pages/FileUploadConfiguration.tsx`
- `src/components/admin/OrderManager.tsx`
- `src/lib/checkout/siteCheckoutSession.ts`

### SEO and Tenant Shell

Recent work:
- Storefront SEO metadata path was adjusted for tenant shops.
- Migration added for public page SEO metadata reads.
- Tenant shell was adjusted as part of making SEO visible on tenant storefronts.

Key files:
- `api/tenant-shell.ts`
- `src/components/SEO.tsx`
- `src/components/storefront/StorefrontSeo.tsx`
- `supabase/migrations/20260427130500_public_read_page_seo_metadata.sql`

### PDF Designer + Service Foundation

Recent work:
- Added vector-preserved PDF editing in the designer: rotate, crop, stamp,
  signature, text color, multipage switching, selected-PDF replacement, and
  reopen/edit selected PDF.
- Added `PdfToolsPanel` for selected PDF backgrounds with PDF metadata,
  page controls, CutContour handoff, vector export handoff, PDF-service scan,
  and a compact design-product-flow checklist.
- Added generic PDF-service foundation separate from POD v2:
  `src/lib/designer/pdfService.ts` and
  `supabase/functions/designer-pdf-service/index.ts`.
- Playwright Chromium smoke test passed for import, edit, replace, service
  scan, and vector export dialog with no console errors.

Remaining expansion:
- Deploy `designer-pdf-service` before relying on the edge runtime.
- Wire in a real external PDF processor for OCR, compression, repair, PDF/A,
  true redaction, and form flattening. These are capability placeholders now.
- Add save/load/export regression automation for edited PDF backgrounds.
- Keep Stirling-PDF as inspiration unless legal/deployment/privacy review
  approves direct production reuse.

Key files:
- `src/components/designer/PDFImportModal.tsx`
- `src/components/designer/PdfToolsPanel.tsx`
- `src/lib/designer/pdfService.ts`
- `src/pages/Designer.tsx`
- `supabase/functions/designer-pdf-service/index.ts`
- `docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md`

### Supplier Product Bank

Planned additive architecture:
- `docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md`
- `.agents/skills/supplier-product-bank/SKILL.md`

Purpose:
- Create a backend/admin bank of supplier print-house products and prices.
- Scrape/API-fetch supplier data into snapshots and normalized bank records.
- Let admins review, translate to Danish, categorize, and approve products.
- Import into existing Webprinter product/pricing structures only by explicit
  admin action.

Safety:
- This is not POD v1 and not POD v2.
- Do not reuse POD tables.
- Do not push scraped prices directly into live storefront products.
- Do not change core pricing logic.
- Reuse Matrix Layout V1, storformat, product attribute, and generic price
  publisher patterns only after bank review/dry-run approval.
- Salgsmapper/Sales Maba is internal and must not be used as an external
  supplier source.
- External supplier candidates must be listed in
  `config/supplier-bank/sources.json` and pass
  `scripts/supplier-bank-cli.mjs validate-supplier-sources` before new scraping
  work begins.

Recent status:
- Supabase project `ziattmsmiirfweiuunfo` is linked. Do not run broad
  `supabase db push` for supplier-bank work while migration history drift
  remains; use the single-file migration/repair path documented in
  `docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md`.
- Supplier-bank migrations, master-admin RLS/grants, source registry, Edge
  Functions, CLI runbook, and `/admin/supplier-bank` browser are in place.
- Supplier registry is seeded for WIRmachenDRUCK, Pixartprinting, and
  Print.com. Webprinter, Sales Maba/Salgsmapper, Onlinetryksager, and localhost
  remain internal exclusions, not external suppliers.
- WIRmachenDRUCK full folder bank is stored, refreshed, review-accepted, and
  imported as an unpublished Matrix Layout draft `wmd-folder-bank-20260703`
  with 18,800 price rows.
- Print.com has six approved bank slices imported as unpublished Matrix Layout
  drafts: flyers, business cards, presentation folders, letterheads,
  business-card boxes, and `t-shirt-basic-7`. The t-shirt import preserves the
  locked `Stoerrelsesfordeling` metadata and quantity-match rule.
- Pixart flat-surface adhesive is approved in the bank and imported through the
  STORFORMAT path as unpublished draft
  `pixart-flat-surface-adhesive-storformat-draft`.
- Pixart rigids/signs is still a decision gate: stored bank snapshot is the
  older Plastic-only baseline, while a local Plastic+Plexiglass candidate is
  prepared at
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json`.
  Candidate packet/preflight reports are ready, but no bank write should happen
  without explicit approval.
- Coverage is currently 9/14 registered supplier families. Missing registered
  families are Pixart `banners`, `labels`, `posters`, `rollups`, and Print.com
  `other`.
- Print.com `other` now has fresh local/no-write scoping evidence from
  2026-07-03 13:17 local time: broad catalog discovery listed 856 Print.com
  products, kept 80 `other` candidates, fetched details for 12, and wrote local
  raw/normalized previews at
  `pricing_raw/supplier-bank-raw/print-com/other/20260703-131707.json` and
  `pricing_raw/supplier-bank-normalized/print-com/other/20260703-131707.json`.
  The refreshed placemats named-policy price preview passed 4/4 DKK rows,
  quantities 10/25/50/100, DKK range `271.23-368.85`, and wrote
  `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-131715.json`.
  `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md` marks it ready
  for explicit bank-only write approval only; no supplier-bank rows, POD v2
  rows, products, publishing state, or live prices were written.
- Pixart missing-family readiness was refreshed at 2026-07-03 13:19 local
  time. The read-only URL candidate report/checklist still shows 7 Pixart URL
  candidates, all `official_candidate_needs_confirmation`, with 0 confirmed
  exact URLs. The adapter/readiness reports still show 4/4 missing Pixart
  families blocked before probe (`posters`, `banners`, `rollups`, `labels`),
  0 extractor-supported profiles, 0 supplier-bank normalizer-supported
  profiles, and 0 confirmed exact URL candidates. Latest files:
  `docs/SUPPLIER_BANK_URL_CANDIDATES_LATEST.md`,
  `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md`,
  `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST.md`, and
  `docs/SUPPLIER_BANK_PIXART_READINESS_LATEST.md`. No Pixart probe/scrape,
  bank write, product write, publishing, or live pricing write was run.
- `/admin/supplier-bank` mirrors the Pixart readiness report for missing
  families: each Pixart coverage gap shows extractor support, supplier-bank
  normalizer support, exact-URL confirmation, and the mapped profile name. This
  is read-only UI state from existing coverage/registry data; it does not probe,
  scrape, write bank rows, create products, publish, or touch live pricing.
- `/admin/supplier-bank` now also makes the Pixart URL confirmation gate more
  actionable in the Gate roadmap. The Pixart URL candidate panel shows pending,
  confirmed, and rejected counts plus a read-only manual checklist: human-open
  the URL only, verify exact product/configurator URL, compare visible option
  shape to the planned profile/first slice, confirm extractor and supplier-bank
  normalizer support, and only then promote or reject with evidence. The
  displayed checklist command is plain text and does not execute anything.
- Latest imported draft QA checked 10 imported targets: 10 OK, 0 warnings, 0
  errors, and 0 published targets. Matrix/STORFORMAT split is 9/1.
- The current read-only planning reports were refreshed at 2026-07-07
  local time. They show the supplier-bank goal is not complete yet:
  4/8 requirements proved, 3 open, 1 contradicted, 9/14 covered families,
  5 missing families, imported draft QA at 9 OK / 0 warnings / 1 error, and
  1 published imported target:
  - `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`
  - `docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md`
  - `docs/SUPPLIER_BANK_DECISION_QUEUE_LATEST.md`
  - `docs/SUPPLIER_BANK_APPROVAL_PACKET_LATEST.md`
  - `docs/SUPPLIER_BANK_EXPANSION_PACKET_LATEST.md`
  - `docs/SUPPLIER_BANK_COMPLETION_AUDIT_LATEST.md`
  - `docs/SUPPLIER_BANK_COVERAGE_GAP_PLAN_LATEST.md`
  - `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`
  - `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`
  - `docs/SUPPLIER_BANK_EXECUTIVE_SUMMARY_LATEST.md`
  - `docs/SUPPLIER_BANK_PRINT_COM_OTHER_SCOPING_20260703-084329.md`
  - `docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST.md`
  - `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md`
  - `docs/SUPPLIER_BANK_PIXART_READINESS_LATEST.md`
  - `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST.md`
  - `docs/SUPPLIER_BANK_URL_CANDIDATES_LATEST.md`
  - `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md`
- The current full WIRmachenDRUCK folder draft `wmd-folder-bank-20260703`
  has 18,800 expected Matrix Layout rows and 18,800 stored
  `generic_product_prices` rows. The remaining imported-draft QA error is an
  older WMD target, `wmd-folder-bank-891a5cf1`, which is already published.
  Do not unpublish/archive it without explicit user approval.
- Latest report index:
  `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`.
  It is a local read-only evidence map over already generated Supplier Bank
  reports. It did not call supplier pages, scrape, read Supabase, write
  supplier-bank rows, create products, publish products, or write live pricing.
  Recurring proof reports now prefer stable latest paths when building proof
  trails, so timestamp churn does not make the admin evidence links look stale.
  The stable proof set includes the index, status, goal snapshot, gate roadmap,
  approval packet, decision queue, executive summary, completion audit,
  imported draft QA, expansion packet, coverage gap plan, Pixart adapter/readiness, URL
  candidates/checklist, and the Pixart/Print.com no-write preflights.
- `/admin/supplier-bank` now includes a read-only five-step Gate roadmap,
  decision queue, Draft QA, and "Næste udvidelser" panels derived from the
  same import/coverage gates as the CLI. The roadmap is UI-only and does not
  scrape suppliers, write bank rows, import products, publish, or write live
  pricing. The roadmap now also shows Pixart URL candidates from supplier
  metadata when available, with a checked-in registry fallback for already
  seeded rows; these are still planning-only and do not make probe/extract
  runnable.
- `/admin/supplier-bank` also shows a top-level read-only `Målestatus` panel
  derived from already loaded bank state. It summarizes family coverage, draft
  QA, open approval/coverage gates, and the high-priority Pixart decision so the
  admin page explains why the supplier-bank goal remains open. The panel also
  lists plain-text safe check commands such as coverage, draft QA, completion
  audit, and relevant preflight checks; these are not executable UI actions.
- The supplier-bank browser also has an operator-focused top `Leverandør-menu`:
  each supplier shows bank/missing family chips plus ready/draft/blocked counts,
  and clicking a supplier jumps to the filtered product catalog. The selected
  supplier view now shows richer `Kataloghylder` per product family with
  ready/draft/blocked counts, price-line totals, DKK ranges, and missing-family
  preview/URL-candidate state. These controls only filter visible bank
  products; missing-family and URL-candidate rows remain planning-only and do
  not start probes, scrapes, imports, publishing, or live price writes. Each
  shelf also shows a read-only `Næste sikre skridt` and, when useful, a
  plain-text safe check command such as a readiness/preflight command; these
  are not executable UI controls.
- Product cards are now business-first by default: admins see source/preview,
  open-draft, and import actions first. Refresh queueing and price-review
  creation are hidden behind a `Vis avanceret` toggle so the product bank reads
  like an import catalog instead of a technical workbench until advanced tools
  are needed.
- Product cards also show compact read-only `Valgmuligheder` previews from
  normalized bank attributes, such as format/material/finish groups with value
  counts and the first few values. This makes supplier products easier to scan
  before opening the full product preview.
- The product preview dialog now shows a read-only `Næste sikre skridt`
  summary with route-specific guidance and optional plain-text safe check
  commands. It does not execute preflights, writes, imports, publishing, or
  live price changes.
- The product browser now shows active search/family/status/readiness filters
  as badges plus a `Ryd filtre` control. This only resets local UI filters and
  does not touch supplier-bank data, products, publishing, or prices.
- The browser now also has an `Afventer godkendelse` panel that presents the
  Pixart rigids/signs and Print.com placemats approval candidates in business
  language. It is display-only and only filters to the supplier when clicked;
  it does not run preflights, write supplier-bank rows, import drafts, publish,
  or write live pricing. The cards also show a read-only "Hvis godkendt" /
  "Hvis afventer" impact strip so the business consequence of approving or
  deferring the gate is visible without adding executable write controls. They
  also show guardrail badges such as no-write preflight present, explicit
  approval required, Matrix import blocked, and POD v2/live pricing untouched.
  Each card also shows the next safe no-write check command as plain text; it
  is not an executable UI action.
- The product bank browser now includes bank-status workflow filters
  (`Godkendt`, `Kladde`, `Gennemgaaet`, `Fejlet`) layered before the existing
  readiness filters. They only filter already loaded active bank rows; archived
  bank products remain excluded by the browser query.
- The browser now also has a read-only `Manglende familier` coverage-gap panel.
  It lists each missing registered supplier family with the current blocker and
  next safe step. Pixart rows show the missing profile/exact-URL blocker before
  probe/extract; Print.com `other` shows the placemats bank-only approval gate.
  Clicking a row only filters the visible supplier/family.
- Main next business decision: approve the Pixart rigids Plastic+Plexiglass
  bank-only snapshot, or keep the current Plastic-only snapshot in review. The
  completion audit proves 5/8 audited requirements and keeps the overall goal
  open because Pixart rigids, remaining registered family coverage, and the
  high-priority decision are still unresolved. The coverage-gap plan breaks the
  five missing families into Print.com `other` scoping plus Pixart adapter
  mappings for `banners`, `labels`, `posters`, and `rollups`. Next expansion
  should start as local/no-write previews only.
- The latest approval packet
  `docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-120931.md` is read-only and
  separates safe checks from write commands. It lists two approval candidates:
  high-priority Pixart rigids bank-only snapshot approval and medium-priority
  Print.com `placemats` bank-only snapshot approval. Both candidates now show
  their no-write preflight/check command before the write-gated command(s). It
  also repeats the three open requirements from the completion audit, links the
  latest Pixart/Print.com no-write preflight reports, and includes the Pixart
  missing-family readiness blockers (`0/4` ready). It also lists exact approve
  and exact defer phrases per write candidate. No write command from that packet
  has been run.
- The latest completion audit
  `docs/SUPPLIER_BANK_COMPLETION_AUDIT_20260703-111157.md` is read-only and
  proves 5/8 audited requirements. It now includes the latest Pixart rigids
  no-write preflight report, candidate rows/effective rows `18/18`, materials
  `Foamex 3mm` and `Clear Polycarbonate 3mm`, and DKK range `182.7-976.83`.
- The latest expansion packet
  `docs/SUPPLIER_BANK_EXPANSION_PACKET_20260703-111157.md` is read-only and
  turns the five remaining coverage gaps into a safe execution order:
  Print.com `other`, then Pixart `banners`, `labels`, `posters`, and `rollups`.
  It separates executable safe commands from human checklist items, keeps
  write-flagged commands out of the safe checklist, includes the Pixart
  readiness-before-probe section (`0/4` missing Pixart families ready), and
  repeats that Pixart rigids and Print.com placemats still need explicit
  bank-only approval before any write.
- The latest gate roadmap
  `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md` is read-only and
  combines the open decisions, coverage gaps, Pixart readiness blockers,
  Pixart URL-candidate counts, imported-draft QA, and latest proof files into
  five ordered gates. It reports Pixart rigids approval first, Print.com
  `other`/placemats second, missing Pixart family preparation third, clean
  draft QA fourth, and completion recheck fifth. It now marks whether exact
  approve/defer phrases are present for a gate and links the latest Pixart URL
  confirmation checklist. It did not call suppliers, write bank rows, create
  products, publish products, or write live pricing.
- Print.com `other` scoping has now refreshed as a local/no-write preview:
  `pricing_raw/supplier-bank-normalized/print-com/other/20260703-092642.json`
  captures 80 candidates with 12 detail payloads from 855 listed catalog
  products. The recommended first narrow price-policy candidate remains
  `placemats`. The refreshed named-policy preview at
  `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-092659.json`
  passed 4/4 valid DKK rows and no-write write-plan validation, but no
  supplier-bank write is approved yet. The decision queue surfaces this as a
  medium-priority bank-only approval choice while Print.com `other` is missing
  from stored coverage. The latest no-write preflight report
  `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_20260703-110649.md`
  confirms the refreshed preview is ready for explicit bank-only write
  approval. Only run `--write-bank` after explicit approval.
- Pixart rigids latest no-write preflight report:
  `docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_20260703-110648.md`. It confirms
  the Plastic+Plexiglass candidate has 18/18 effective rows, categories
  `Plastic` and `Plexiglass`, duplicate keys old/new `12/0`, DKK range
  `182.7-976.83`, and prints only approval-gated bank snapshot/delta-review
  commands. No supplier-bank write has been run.
- Pixart adapter mapping has been regenerated as one combined missing-family
  report:
  `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_missing-pixart-families_20260703-111101.md`.
  It maps the registered missing Pixart families to proposed profile names,
  safe first-slice shapes, and official Pixart URL candidates read from
  `config/supplier-bank/sources.json` `productFamilyUrlCandidates`. The URL
  candidates are not treated as confirmed exact source URLs unless their status
  is `confirmed_source_url`. Current confirmed exact URL candidates are `0/4`.
  Profiles are still not implemented, so probe/extract remains blocked. No
  Pixart probe/scrape or supplier-bank write has been run for those families.
- Latest Pixart readiness report:
  `docs/SUPPLIER_BANK_PIXART_READINESS_missing-pixart-families_20260703-111101.md`.
  It checks the four missing Pixart families and confirms 0/4 are ready for a
  local/no-write probe because `posters`, `banners`, `rollups`, and `labels`
  do not yet have supported extractor profiles or exact confirmed Pixart
  product URLs. It now records registry-backed official URL candidates for each
  family and a separate confirmed exact URL count, but the report is still
  read-only and did not probe/scrape Pixart.
- Latest URL-candidate report:
  `docs/SUPPLIER_BANK_URL_CANDIDATES_pixartprinting-all-families_20260703-111100.md`.
  It checks only the registry and shows 7 Pixart URL candidates, 7 pending
  confirmation, 0 confirmed exact source URLs, and 0 rejected. It did not call
  supplier pages, scrape, write supplier-bank rows, create products, publish
  products, or write live pricing.
- Latest URL-confirmation checklist:
  `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_pixartprinting-all-families_20260703-121623.md`.
  It turns the 7 Pixart candidate URLs across 4 missing families into a manual
  review checklist for confirming exact product/configurator routes, option
  shape, login/cart blockers, and extractor-profile readiness. It is
  registry-only and did not call supplier pages, scrape, write supplier-bank
  rows, create products, publish products, or write live pricing.

### POD v2

POD v2 is a Print.com integration for master-admin curation and tenant imports.
It feeds data into the existing product system. It must not replace or alter
core pricing logic unless explicitly approved.

Recent work:
- Danish term mapping for Print.com import wizard labels.
- Admin UI/catalog/order improvements.
- Minor request function adjustment.

Key files:
- `POD2_README.md`
- `src/pages/admin/Pod2Admin.tsx`
- `src/pages/admin/Pod2Katalog.tsx`
- `src/pages/admin/Pod2Ordrer.tsx`
- `src/lib/pod2/danishTerms.ts`
- `supabase/functions/pod2-explorer-request/index.ts`

## Safety Rules for Future AI Agents

Do:
- Prefer additive changes.
- Preserve tenant data and tenant-specific settings.
- Run `npm run build` after frontend changes when npm is available. In the
  Codex desktop shell, use the bundled Node/Vite command from the local build
  note above if npm is missing.
- Use existing branding and pricing types instead of inventing parallel config.
- Keep theme changes in the branding model and storefront renderers.
- Respect reduced-motion settings for Framer Motion work.

Do not:
- Reset the branch or revert user changes without explicit instruction.
- Change core pricing calculations casually.
- Merge POD v2 into POD v1.
- Hard-delete POD v2 catalog/import data manually.
- Assume localhost is safe test data.

## Last Known Validation

Local:
- `npm run build` passed in an earlier shell with npm available.
- 2026-07-07 Codex desktop verification used:
  `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`.
  It passed with only the known Vite warnings.

## Supplier Product Bank Continuity

Latest admin UI adjustment:
- `/admin/supplier-bank` now shows plain-text `Næste sikre check` commands on
  each missing-family card. These are guidance only and do not execute from the
  browser. Pixart gaps point to readiness checks, Print.com `other` points to
  the placemats no-write preflight, and generic gaps point to the coverage-gap
  plan.
- Missing-family cards also show the first registry-backed URL candidate and
  evidence inline when one exists. These URLs remain planning-only unless their
  status is explicitly `confirmed_source_url`; they do not make Pixart probe or
  extraction runnable by themselves.
- `/admin/supplier-bank` now includes a read-only `Bevisfiler` panel with the
  latest local report paths for executive summary, completion audit, Pixart
  rigids preflight, Print.com placemats preflight, coverage gap plan, and Pixart
  readiness. These paths are documentation only and do not execute supplier
  calls, bank writes, imports, publishing, or live price updates.
- The `Bevisfiler` panel now also includes the latest goal-control snapshot:
  `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`, plus the latest
  approval packet `docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-120931.md` and
  gate roadmap `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`.
- Approval cards now include a read-only `Beslutningscheckliste` that separates
  what the business decision may approve from what remains forbidden. It is
  guidance only and does not add any write controls.
- Approval cards also show an exact plain-text approval phrase for Pixart
  rigids and Print.com placemats. The phrase is inert UI text; it only helps a
  human give explicit approval later and does not approve or run anything by
  itself.
- Supplier-bank CLI now has a read-only goal-control snapshot:
  `npm run supplier-bank:goal-snapshot` and
  `npm run supplier-bank:goal-snapshot:write`. It combines the completion
  audit, source coverage, import eligibility, imported-draft QA, decision
  queue, Pixart readiness, and latest proof-file paths. It separates safe
  checks from approval-gated write commands and prints the exact approval
  phrases plus exact deferral phrases for Pixart rigids and Print.com
  placemats. It must not scrape suppliers, write supplier-bank rows, create
  products, publish products, or write live pricing.
- The latest goal snapshot, completion audit, and gate roadmap now include an
  `Open Work By Gate Type` section. It separates business approval gates,
  engineering readiness gates, local preview gates, imported-draft QA, and
  completion proof so it is clear what can move with checks versus what still
  needs explicit approval or profile/URL work.
- `/admin/supplier-bank` now mirrors that gate-type structure inside the
  read-only `Målestatus` panel. It shows business approval, engineering
  readiness, local preview, draft QA, and completion-proof buckets from already
  loaded browser state. This is display-only and does not call suppliers, write
  supplier-bank rows, import drafts, publish products, or change live pricing.
- Pixart missing-family readiness now separates extractor support from
  supplier-bank normalizer support. The latest adapter/readiness reports show
  `0/4` extractor-supported profiles, `0/4` normalizer-supported profiles, and
  `0/4` confirmed exact URLs for posters, banners, rollups, and labels. Do not
  run Pixart probe, extract, normalization, bank writes, imports, publishing, or
  live pricing for those families until all three gates are green.
- `/admin/supplier-bank` approval cards now show both an exact approval phrase
  and an exact afvent/defer phrase. The defer phrase is also inert UI text; it
  only gives the user a precise way to keep a gate on hold without approving
  bank writes, draft imports, publishing, or live pricing changes.
- `/admin/supplier-bank` approval cards now include a read-only `Bevisspor før
  beslutning` section. Pixart rigids points to the candidate/baseline JSON,
  candidate packet, no-write preflight, and storformat review. Print.com
  placemats points to the local catalog/price previews, no-write preflight,
  coverage plan, and decision queue. These are proof paths only; they do not
  add buttons, write flags, supplier calls, imports, publishing, or live price
  updates.
- `/admin/supplier-bank` now shows a read-only `Næste importvalg` queue above
  the selected supplier family shelves. It ranks the currently filtered bank
  rows by ready/warning/blocked/imported state and opens only the existing
  preview dialog. It does not approve products, call suppliers, write
  supplier-bank rows, import drafts, publish products, or update live prices.
- `/admin/supplier-bank` now also shows `Faktiske bankprodukter` immediately
  below the top KPI cards so admins see the real supplier products before the
  longer goal/report panels. The cards show supplier, family, readiness,
  price-line count, DKK range, latest snapshot/update date, and draft/blocker
  note; clicking a card opens the existing preview only. Backend verification
  on 2026-07-03 showed 3 suppliers, 10 total bank products, 17 snapshots, and
  10 import jobs; active/non-archived browser coverage remains 9 products.
- That top bank section is now an `Enkel produktvaelger`: first choose a
  product group such as Foldere/Flyers/Visitkort, then choose a product card.
  Product cards show normalized option previews like format, material,
  foldetype, pages, and direction where the bank product has those attributes.
  The preview dialog now has `Konkret produktvalg` buttons for those
  attributes. For Matrix Layout supplier-bank products, the selected values are
  sent as `rowFilter` to `supplier-bank-import-draft`, which dry-runs and
  imports only matching normalized price rows as a separate unpublished draft.
  Storformat products remain blocked to their separate storformat import path.
- `/admin/supplier-bank` is now picker-first instead of report-first. The main
  view hides the KPI strip and long supplier-bank status/report panels by
  default. Admins first see button rows for product group, print house, and
  product. The old operational reports are behind `Vis teknisk overblik`.
- Keep Supplier Bank as a staging layer. Do not scrape suppliers, write bank
  snapshots, import drafts, publish products, or change live pricing unless the
  user explicitly approves that exact write path.

Vercel:
- Production build passed.
- Deployment completed.
- Alias applied to `https://www.webprinter.dk`.

Known warnings:
- Large Vite chunks.
- Supabase client mixed dynamic/static imports.
- `pdfjs-dist` eval warning.
- `lcms-wasm` browser externalization warning.

These warnings existed during successful deployment.

## If Continuing Visual Theme Work

Check these first:
- Are the generated colors readable in normal, hover and selected states?
- Does the theme affect header, hero, USP, products, matrix, price panel and
  option buttons consistently?
- Does a tenant's saved branding override still work?
- Does preview click-to-edit open the correct side panel section?
- Does mobile still fit without overlap?

Run:

```bash
/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build
```

If deploying:

```bash
git status --short --branch
git add -A
git commit -m "..."
git push -u origin ui-cleanup
vercel deploy . --prod -y
```
