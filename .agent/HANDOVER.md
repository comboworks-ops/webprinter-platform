# Agent Handover

Last updated: 2026-07-08

Read these first:
1. `AGENTS.md`
2. `HANDOVER.md`
3. `AI_CONTINUITY.md`
4. `POD2_README.md`
5. `SYSTEM_OVERVIEW.md`

The root `HANDOVER.md` is now the current human-readable handover. The root
`AI_CONTINUITY.md` is the condensed AI startup file.

## Current Snapshot

Branch: `ui-cleanup`
Latest commit: `7932644 feat: polish tenant site design controls`
GitHub branch: `https://github.com/comboworks-ops/webprinter-platform/tree/ui-cleanup`
Live Vercel alias: `https://www.webprinter.dk`

The latest session was deployed to Vercel production successfully.

Current active direction:
- Make Webprinter commercially ready as a sellable web-to-print platform.
- Use owned tenants (`webprinter.dk`, `salgsmapper.dk`, and
  `onlinetryksager.dk`) as proof tenants.
- Treat Supplier Bank as a sourcing/staging engine, not the whole product.
- Roadmap: `docs/WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md`.
- Read-only admin cockpit now exists at `/admin/commercial-readiness` with
  sidebar label `Driftsklarhed`. It reads live, defensive Supabase signals for
  tenant/product/template/SEO/order readiness, while Supplier Bank gate facts
  remain report-derived/read-only. It also shows first-product flow health:
  Matrix/STORFORMAT price rows, product template/designer-launch readiness, and
  approximate order traces for the selected proof product, plus prioritized
  `Flow-blokeringer og QA` issue links and a `Bevisflow pr. tenant` proof-step
  checklist with tenant-safe admin links. It also shows `Klar-til-demo beviser`
  so each tenant's commercial demo evidence and missing proof points are visible.
  The top `Ledelsesblik: næste handling` layer derives one read-only next action
  per tenant from those gaps.
  `Trykkeri-demo gate` summarizes platform-level demo readiness across tenant
  proof, price/designer/order evidence, order readiness, SEO, Supplier Bank
  risk, and demo/sales package.
  `Demo-køreplan for trykkeri` gives a read-only step-by-step presentation path
  for a print-house conversation.
  `Første pilotordre-plan` turns Webprinter's first controlled order into a
  read-only operating checklist before sales use.
  `Trykkeri-salgspakke` adds the CEO/sales package view: demo script,
  pilot-order proof, tenant showcase, onboarding, offer model, and risk
  boundaries.
  `Go/no-go launch board` is the top CEO view for what can be demoed, what is
  pilot-only, and what must not be promised yet.
  `Commercial ready scorecard` maps the roadmap's definition of commercial
  ready to current evidence: owned-tenant order, second tenant niche/template
  proof, traceable pricing/designer state, admin order handling, order/file
  readiness, payment/checkout clarity, customer dialogue visibility,
  mail/notification readiness, delivery/fulfillment readiness,
  legal/cookie/contact readiness, platform contact/lead readiness,
  SEO/analytics, Supplier Bank staging safety, and simple business pitch
  language. It is read-only and only links back to existing admin evidence.
  `Salgsmæssig bevismappe` maps each sales claim to proof, gaps, and admin
  evidence links before it is used in a pitch.
  A compact jump bar links directly to the key cockpit sections so the page can
  be used live in an internal review or print-house prep conversation.
  `SEO/Search Console bevis` reuses the existing Platform SEO Search Console
  hooks to show each owned domain's SEO rows, verified Search Console state,
  28-day clicks, impressions, CTR, and average position when connected. It is
  read-only and does not connect Google, write SEO rows, or mutate Search
  Console data.
  `Første trykkeripilot: tilbudsmodel` turns the print-house package into
  concrete offer lines: branded tenant/storefront, first product package,
  designer/upload/PDF, checkout/order intake, SEO reporting, Supplier Bank
  staging, support/onboarding, and commercial price frame. It remains read-only
  and does not set prices or mutate products/orders.
  `30-dages eksekveringsplan` maps the roadmap's first 30 days into an operator
  checklist: owned-tenant pilot paths, manual `admin@webprinter.dk` access
  verification, Webprinter flagship E2E flow, Salgsmapper template proof,
  price-preview warning visibility, WMD duplicate decision, Supplier Bank report
  visibility, and SEO/Search Console read-only connection. Product admin
  `Produkt & Priser` now has a read-only `Pris-preview status` card that counts
  Matrix rows, warns at `0` rows, summarizes very large Matrix imports, and
  labels STORFORMAT/MPA as separate pricing paths. Product overview also shows
  read-only price-health badges per product plus a Matrix OK / missing Matrix
  prices / special pricing summary. The summary chips are filter buttons, so
  operators can isolate missing Matrix-price products without opening each
  card. Publishing a Matrix product with `0` price rows now asks for explicit
  confirmation before saving, and the product `Klar` marker uses the same
  warning-only confirmation. Master-tenant release/send-to-tenant actions now
  reuse that price-health signal and warn before distributing a Matrix product
  with `0` price rows. It does not change pricing and only links to
  existing admin areas. Product overview also has a read-only storefront
  category-readiness strip that counts forside-knapper, hovedkategorier and
  underkategorier, and flags empty categories, invalid front-card selections
  and submenu categories without visible children. Storefront category cards
  now fall back to the first usable product in the category when the selected
  front-card product is missing or unpublished.
  `Pilot-gennemgang` is the practical read-only rehearsal list for the exact
  proof paths to witness before a print-house conversation: Webprinter
  product/price, designer or upload, order into admin, Salgsmapper
  template/download/designer, Onlinetryksager first product, SEO/Search Console,
  Supplier Bank as staging, and `admin@webprinter.dk` access.
  `Bevisfangst for generalprøve` is derived from the same pilot proof list and
  tells the operator what to capture, what counts as accepted, and which stop
  rule keeps the point out of an external trykkeridemo. It does not write notes,
  files, prices, products, ordrestatus, SEO data or Supplier Bank state.
  `Pilotdrift runbook` is the read-only operating checklist for the first
  controlled order: order data, product/price basis, design/upload/PDF check,
  payment decision, production owner, proof/customer communication, delivery,
  closeout, and sales evidence boundary. It does not mutate orders, payments,
  files, prices, products or publishing.
  `Ordredrift signaler` is the read-only tenant-level order operations summary
  that reads existing `orders` and current `order_files` rows to show total
  orders, file-ready orders, problem/reupload pressure, and missing/customer-file
  pressure without creating orders, moving status or changing files.
  `Betaling/checkout signaler` is the read-only tenant-level payment readiness
  summary that reads existing `tenant_payment_settings` and separates live
  Stripe, Stripe setup and manual/test payment decision states without invoking
  Stripe or changing fees.
  `Kundeservice signaler` is the read-only tenant-level customer/support
  summary that reads existing `order_messages` and `platform_messages` to show
  order-message volume, platform support-message volume, unread customer/tenant
  messages, and latest visible message without sending messages or marking
  anything as read.
  `Mail/notifikationer signaler` is the read-only tenant-level notification
  readiness summary that reads existing `tenants.settings` and
  `tenant_notifications` to show customer order-confirmation state, admin
  new-order mail state, tenant company email, unread internal notifications and
  whether admin order mails would be skipped because the company email is
  missing or invalid. It does not send emails, update settings or mark
  notifications as read.
  `Levering/fulfillment signaler` is the read-only tenant-level delivery and
  fulfillment summary that reads product `order_delivery`, existing order
  `delivery_type`/tracking values, `delivery_tracking` counts and
  `tenant_pod_shipping_profile` sender readiness. It does not change delivery
  methods, tracking, POD sender identity, order status, pricing or product
  setup.
  `Jura/cookie signaler` is the read-only tenant-level legal and consent
  summary that reads existing `tenants.settings.company`, public routes
  `/kontakt`, `/privatliv`, `/cookiepolitik` and `/betingelser`, the contact
  form's privacy-policy consent link, plus the current cookie banner/settings
  flow. It surfaces missing company email and missing CVR/address, while the
  cookie settings dialog now routes tenant terms to `/betingelser` and platform
  terms to `/handelsbetingelser` without losing localhost `force_domain`
  context. The tenant contact form also links its consent text to `/privatliv`
  with the same domain context, and the default tenant footer terms link now
  uses `/betingelser`. These links reuse the existing storefront tenant-context
  helper. The platform contact form also requires the same privacy-policy
  consent before a platform lead message can be submitted. It does not change
  cookies, tracking, legal text or tenant settings.
  `Platform henvendelser` is the read-only platform lead-readiness layer for
  the Webprinter sales site. It shows public contact fields, privacy consent,
  localhost-safe privacy links, and the existing `send-contact-message`/Resend
  mail handoff. Successful platform contact submissions are also logged as
  unread master messages in `platform_messages` with a `[PLATFORM LEAD]`
  prefix, and admin `Beskeder` labels that master thread as `Platform
  henvendelser` when lead messages exist. That thread is shown as a read-only
  log so operators do not mistake an internal note for an external email reply.
  Cockpittet læser nu de masterbeskeder som en read-only leadtæller med samlet
  antal, ulæste henvendelser og seneste tidspunkt. Admin `Beskeder` viser også
  et lille leadkort for den tråd med samlet antal
  platformhenvendelser, ulæste henvendelser, nyeste kundeemne, beskedpreview
  og en sikker `mailto:`-overdragelse til svar uden for den interne log.
  Cockpittets opfølgningslink åbner direkte samme mastertråd via
  `tenantId=00000000-0000-0000-0000-000000000000`. Den mastertråd bliver ikke
  auto-markeret som læst ved åbning, så ulæste platformhenvendelser forbliver
  synlige indtil et senere eksplicit leadflow håndterer dem. Admin header og
  sidebar tæller platformhenvendelser separat; hvis de er de eneste ulæste
  beskeder, åbner beskedikonet direkte samme mastertråd.
  Mail-overdragelsen forbliver QA indtil en kontrolleret indbakke/admin-test
  er bevidnet. Det opretter ikke en ny CRM-tabel, sender ikke testmails,
  ændrer ikke tracking, produkter, priser, ordrer eller Supplier Bank.
  `Adgangsberedskab for adminmail` is the read-only manual access checklist for
  `admin@webprinter.dk` across dashboard, products, product price, Salgsmapper
  templates, orders/customers, Platform SEO, Supplier Bank, tenant/domain
  context, payment, modules and settings. It does not mutate auth, roles,
  sessions or permissions.
  `Prioriteret handlingskø` is the read-only top operator queue that ranks the
  next actions across critical path, pilot proof, pilotdrift, admin access,
  go/no-go and the 30-day plan, so the cockpit starts with what to do next.
  `Trykkerimødepakke` is the read-only meeting-prep layer for the first
  print-house conversation: purpose, what may be shown, which proof points may
  be mentioned, what must not be promised, the commercial question to ask, and
  the next follow-up. It does not create offers, prices, emails, products or
  supplier changes.
  `Måleksekvering` is the read-only top execution layer for the active goal. It
  turns the work into six phases: cockpit ownership, owned-tenant proof,
  pilot proof/drift, adminmail access, first print-house meeting readiness, and
  visible sales evidence. It links to existing evidence and does not mutate
  prices, products, orders, auth, SEO, POD or Supplier Bank. It now also shows
  `Automatisering og menneskelig bevisførelse`: a read-only split between safe
  Codex/system work, manual browser/admin QA, and CEO/business decisions. The
  cockpit top now also has `Næste sikre handling`, which highlights the next
  safe system step, next manual proof step, and first live-blocking decision.
  `Browserrute til generalprøve` turns the pilot-proof items into a numbered
  manual route with tenant-safe links for the internal browser rehearsal.
  `Bevisfangst for generalprøve` adds capture, acceptance and stop rules for
  each route step without creating a write path.
  `Automatiseret browserbevis` is now part of `Bevisflow pr. tenant`. It points
  to `npm run check:commercial-proof`, a combined read-only gate that checks
  the commercial-readiness cockpit bindings and then runs Playwright against
  Webprinter Aluminium, Banner Builder Pro site-package preview, Salgsmapper
  category landing, Salgsmapper PDF/template/designer, Onlinetryksager category
  landing, and Onlinetryksager Flyers proof flows on localhost. It must remain
  a verification path only and
  must not write products, prices, orders, SEO, POD or Supplier Bank data.
  `npm run check:commercial-proof:write` runs the same gate and writes only the
  local report `docs/COMMERCIAL_PROOF_LATEST.md`.
  `npm run check:commercial-proof-report` verifies that report without
  rerunning the browser smoke. `npm run check:commercial-release` is the local
  pre-demo/pre-deploy gate that writes the report, verifies it, and runs the
  Vite production build. It also writes `docs/COMMERCIAL_RELEASE_LATEST.md`.
  `npm run check:commercial-release-report` verifies that release summary. The
  summary includes a read-only `git status --short --branch` snapshot and
  dirty-entry count, so local work-in-progress is visible in the proof trail.
  `npm run check:commercial-changeset`, `npm run check:commercial-changeset:write`
  and `npm run check:commercial-changeset-report` generate/verify
  `docs/COMMERCIAL_CHANGESET_LATEST.md`, which groups the dirty paths into
  review buckets with suggested review order and bucket-specific verification
  commands before any push/deploy decision. It also lists the first commercial
  proof-chain review packet with exact candidate files and hold reasons for the
  other buckets, plus read-only staging, staged-file validation and rollback
  command previews. `npm run check:commercial-application-source:write`
  writes/verifies `docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md`, the second
  runtime review packet. It groups app-source changes by pricing/product,
  designer/PDF/template, tenant storefront/SEO/design, admin, checkout/account
  and build/config risk, and `npm run check:commercial-application-source-report`
  verifies that report without writing products, prices, orders, SEO, POD or
  Supplier Bank data. `npm run check:commercial-supabase:write` writes/verifies
  `docs/COMMERCIAL_SUPABASE_LATEST.md`, the Supabase review packet. It runs the
  existing grant/function exposure checks, lists migrations, Edge Functions,
  temp/config duplicates and local Supabase artifacts separately, and
  `npm run check:commercial-supabase-report` verifies that report without
  deploying or mutating database/function state. `npm run check:commercial-staged-packet`,
  `npm run check:commercial-staged-packet:write` and
  `npm run check:commercial-staged-packet-report` verify
  `docs/COMMERCIAL_STAGED_PACKET_LATEST.md`, the git-index safety packet that
  keeps forbidden local Supabase/debug artifacts, core pricing source, POD
  source and local tooling out of a commit/push/deploy packet unless explicitly
  approved. `npm run check:commercial-branch-freshness`,
  `npm run check:commercial-branch-freshness:write` and
  `npm run check:commercial-branch-freshness-report` verify
  `docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md`, the upstream safety packet that
  lists upstream-only commits/files and staged-packet overlap without fetching,
  pulling, merging, rebasing, committing, pushing or deploying. `npm run check:commercial-upstream-reconciliation`,
  `npm run check:commercial-upstream-reconciliation:write` and
  `npm run check:commercial-upstream-reconciliation-report` verify
  `docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md`, the overlap interpretation
  packet that classifies upstream/staged overlap as exact, represented,
  superseded or unresolved while staying read-only. `npm run check:commercial-owner-merge-readiness`,
  `npm run check:commercial-owner-merge-readiness:write` and
  `npm run check:commercial-owner-merge-readiness-report` verify
  `docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md`, the release-owner dry-run
  packet that uses a temporary Git index to overlay the staged packet on the
  upstream tree without pulling, rebasing, merging, staging, committing, pushing
  or deploying. `npm run check:commercial-release-owner-sequence`,
  `npm run check:commercial-release-owner-sequence:write` and
  `npm run check:commercial-release-owner-sequence-report` verify
  `docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md`, the ordered human
  branch-freshness, commit, deploy and stop-rule handoff. `npm run check:commercial-deploy-readiness`,
  `npm run check:commercial-deploy-readiness:write` and
  `npm run check:commercial-deploy-readiness-report` verify
  `docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md`, the read-only push/deploy
  decision report. That report may intentionally show `HOLD` when branch
  freshness, unstaged leftovers, held local artifacts, Supabase deploy scope or
  human release ownership still need a decision. `npm run check:commercial-release-handoff`,
  `npm run check:commercial-release-handoff:write` and
  `npm run check:commercial-release-handoff-report` verify
  `docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md`, the release-owner handoff packet
  with suggested commit text, owner decisions, Supabase deploy scope, rollback
  note template and post-deploy tenant smoke routes. `npm run check:commercial-release-packet`,
  `npm run check:commercial-release-packet:write` and
  `npm run check:commercial-release-packet-report` verify
  `docs/COMMERCIAL_RELEASE_PACKET_LATEST.md`, the read-only open-first index
  over the whole commercial release packet. It remains read-only. The tenant proof runner retries once after the app's short
  Supabase transport cooldown only when a route reports the known temporary
  Supabase pause message.
  `Ekstern demo-grænse` is the read-only safety boundary for the first
  print-house conversation. It separates what may be shown externally, what is
  pilot-only, and what must stay internal, including Supplier Bank, SEO,
  payment and delivery promises. It does not mutate demo content, products,
  prices, payment, SEO or Supplier Bank.
  `Pilotaccept for trykkerikunde` is the read-only internal go/no-go gate before
  a real print-house pilot. It combines commercial-ready scorecard,
  external demo boundary, pilotdrift, adminmail access, offer model, and CEO
  decision queue. It does not create customers, offers, prices, payments,
  products or order changes.
  `Pilotansvarskort` is the read-only responsibility map for the first
  print-house pilot: CEO go/no-go, product package, operations, file/PDF
  control, admin access, SEO/reporting, Supplier Bank boundaries, economy,
  support and demo ownership. It does not assign roles, change permissions or
  mutate live data.
  `Pilotscope aftalegrundlag` is the read-only scope frame for the first
  print-house pilot. It lists what is included, what is excluded, and which
  business decision is still needed for tenant/branding, product package,
  designer/upload/PDF, checkout/order, SEO, Supplier Bank, support, price frame
  and pilot go/no-go. It does not create offers, prices or customer records.
  `Pilotonboarding plan` is the read-only sequence for what happens after a
  print house says yes to a pilot: internal accept, tenant/domain/brand, first
  product package, templates/upload, order/admin test, adminmail access,
  SEO/reporting, Supplier Bank boundaries, economy/support and internal
  rehearsal. It does not create tenants, products, customers, offers, roles or
  prices.
  `Pilotsucces og exitkriterier` is the read-only measurement layer for the
  first print-house pilot. It defines when the pilot can continue, when it
  should be paused, and when it can be converted to a paid first package, based
  only on existing cockpit evidence. It does not create customers, offers,
  products, prices, orders, roles, SEO rows or Supplier Bank changes.
  `Trykkeripilot handoff` is the read-only bridge from proof to first
  print-house conversation. It summarizes what may be shown, concrete pilot
  scope, CEO go/no-go, customer input after a yes, non-promises, and how pilot
  success is judged. It does not create offers, customers, prices, products,
  order status changes or supplier publishing.
  `Trykkeripilot Q&A` is the read-only answer layer for first-meeting questions:
  what can be shown, pilot scope, supplier/pricing automation, orders/files,
  payment/support, customer input, success criteria, go-live and next
  commercial decision. Every answer includes proof and a boundary so it stays a
  meeting aid, not a feature promise.
  `Første mødebrief` is the read-only five-step live meeting brief: open
  calmly, show only the short demo, ask the commercial pilot question, repeat
  non-promises, and end with the next action. It derives from meeting pack,
  Q&A, handoff and priority queue without creating offers, emails, customers,
  prices, products, order status or supplier publishing.
  `Eftermøde opfølgning` is the read-only post-meeting draft layer that turns
  the meeting brief and Q&A into recap, pilot proposal, customer input request,
  non-promises and internal next action. It does not send emails, create leads,
  offers or customers, change prices/products/order status, or publish Supplier
  Bank data.
  `Pilottilbud kladde` is the read-only first-offer preparation layer that
  turns follow-up, offer model, scope, pilotaccept and priority queue into
  offer sections without amounts: purpose, delivery package, customer input,
  attachable proof, non-promises, internal approval and support form. It does
  not send mail, create leads/offers/customers, set prices, mutate
  products/orders or publish Supplier Bank data.
  `Pilotaftale tjekliste` is the read-only agreement-readiness layer after the
  offer draft. It checks pilot purpose, scope, customer input, economy
  decision, responsibility/support, success/exit criteria and non-promises
  before any draft becomes a real customer agreement. It does not create
  contracts, customers, offers, prices, orders, emails, product changes or
  Supplier Bank publishing.
  `Pilotstart plan` is the read-only first-days plan after a print-house yes:
  internal accept, customer kickoff input, adminmail/access check,
  product/design path, first manual order, evidence packet and week-1 decision.
  It does not create tenants, products, prices, orders, roles, emails,
  contracts or Supplier Bank writes.
  `Pilot uge-1 rapport` is the read-only internal status view for the first
  pilot week. It summarizes start-plan progress, first order/file readiness,
  payment, support/mail pressure, delivery, SEO visibility and the
  continue/pause/convert decision from existing cockpit evidence. It does not
  create report files, customers, offers, prices, orders, emails, product
  changes or Supplier Bank writes.
  `Konverteringsklar pilot` is the read-only conversion gate after the first
  pilot week. It checks whether week-1 proof, agreement basis, offer
  boundaries, success criteria, economy/support decisions and Supplier Bank
  limitations are clear enough before a pilot becomes a paid first package. It
  does not create offers, contracts, customers, prices, products, orders, mails
  or Supplier Bank writes.
  `Betalt pilotpakke` is the read-only package worksheet after the conversion
  gate. It summarizes what a first print-house customer can buy after pilot
  proof: scope, non-promises, price/payment decisions, order/delivery,
  support/legal responsibility and next phase. It does not create offers,
  contracts, customers, prices, products, orders, mails, payment settings or
  Supplier Bank writes.
  `Første kundes onboarding` is the read-only setup board after the paid
  package. It lists customer input and internal checks for agreement boundary,
  tenant/brand, products/pricing responsibility, templates/file flow,
  order/payment/delivery, admin access, reporting/sourcing and internal
  rehearsal. It does not create tenants, customers, products, prices, orders,
  roles, mails, payments or Supplier Bank writes.
  `Setup-arbejdsordre` is the read-only internal setup work order after
  first-customer onboarding. It turns the customer input into setup tasks for
  package boundary, tenant/brand, products, templates, order path, admin
  access, reporting/sourcing and final rehearsal. It does not create tenants,
  customers, products, prices, orders, roles, mails, payments or Supplier Bank
  writes.
  `Kundekickoff agenda` is the read-only first-customer meeting agenda after
  the setup work order. It turns setup tasks into meeting points for pilot
  boundary, tenant/brand, products/pricing responsibility, files,
  order/payment/delivery, support/access, reporting/sourcing and next action.
  It does not send mails or create customers, offers, products, prices, orders,
  payments or Supplier Bank writes.
  `Kickoff opfølgning` is the read-only post-kickoff follow-up layer. It turns
  the customer kickoff agenda into recap, customer material request,
  product/pricing clarification, order/responsibility follow-up,
  reporting/sourcing boundary and next internal action. It does not send mails
  or create customers, offers, products, prices, orders, payments or Supplier
  Bank writes.
  `Kundemateriale checkpoint` is the read-only manual material gate after
  kickoff follow-up. It lists the customer material and decisions that must be
  manually confirmed before setup continues: brand, products/pricing
  responsibility, templates/files, order/payment/delivery, support/access,
  reporting/sourcing and next internal action. It does not fetch attachments,
  send mails or create customers, products, prices, orders, payments or
  Supplier Bank writes.
  `Frigivelse til produktion` is the read-only release-readiness gate before a
  push/deploy is treated as safe. It separates production build, localhost
  smoke checks, tenant proof, adminmail access, price/POD/Supplier Bank
  boundaries, deploy owner, rollback note and after-deploy tenant smoke checks.
  It does not create branches, commits, deployments, prices, products, orders,
  POD data or Supplier Bank writes.
  `Releasebevis og accept` is the read-only proof-capture layer for the release
  gate. It states what to capture for build/localhost, tenant flow, adminmail,
  data boundaries, deploy/rollback and live smoke tests, plus what counts as
  accepted and when to stop. It does not save files, write notes, create
  commits, deploy, or mutate orders, prices, products or Supplier Bank data.
  `Supplier Bank staging-runbook` is the read-only operating sequence for
  supplier-bank products: external source only, report candidate, explicit
  approval, draft import, price-row QA, separate publishing decision and tenant
  handoff. It derives blocker state from the existing Supplier Bank decisions
  and does not scrape, import, publish or mutate live prices, products, POD
  data or Supplier Bank data.
  `Beslutningsvalgkort` is the read-only CEO decision helper for the open sales
  blockers. It turns each current decision into recommended handling,
  alternatives, cost of waiting and a decision rule, without choosing for the
  owner or mutating products, prices, payments, Supplier Bank, SEO or tenants.
  `Kritisk sti til første trykkerisamtale` summarizes the smallest proof chain
  needed before approaching a print house.
  `Pilottrykkeri intake` lists the information needed from a future
  print-house customer before onboarding, while staying read-only.
  `Beslutningskø før salg` makes the remaining CEO/product decisions visible
  before any sales promise is made.
  It remains read-only.
- Local build note: ignored `dist` output had stale generated preview files
  that caused Vite cleanup errors. `vite.config.ts` now cleans the build output
  with a build-only pre-plugin and disables Vite's fragile `emptyOutDir` step,
  so Vite can build cleanly.
- Codex desktop shell note: global `npm` may be unavailable, and bundled
  `pnpm run build` can stop on pnpm's ignored-builds approval gate. In that
  environment, use:
  `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build`.

## What Changed Recently

Major Site Design V2 and tenant storefront work:
- Complete visual theme presets.
- Ten color presets and five font presets.
- Advanced per-theme button effects.
- Contrast safeguards for generated buttons.
- Hero/banner transitions, text effects and parallax controls.
- Header dropdown layout/motion presets.
- Product option and matrix hotspots that open the right side-panel editors.
- Download Tilbud button styling target.
- Product price panels now show `Download skabelon` beside `Design online`
  when the selected product/format resolves to a template PDF launch. This uses
  the same template resolution as the designer launch and does not mutate
  checkout, pricing, product or order data.
- Checkout/session traceability now records template PDF name/url and whether
  the customer clicked `Download skabelon`. Order creation writes
  `[PRODUKTIONSFLOW]`, `[SKABELON]` and `[SKABELON-DOWNLOAD]` tags into
  `status_note`, and `Kunder & Ordrer` displays a flow badge and flow filter in
  the order list plus full tags and attached-file notes in order detail so admin
  can distinguish designer export, customer upload and external template-based
  design.
- `Kunder & Ordrer` now also shows read-only production readiness from existing
  order flags and current `order_files`: `Klarhed` badge/filter plus a `Fil
  klar` count, without writing orders, files, prices or schema.
- Order detail includes a read-only `Produktionsklarhed` panel with flow,
  readiness, file counts, and next recommended handling step.
- Selecting `Under produktion` in order detail now shows a warning-only
  readiness guardrail when the order is not file-ready. It does not block saving
  or write any extra workflow state.
- The commercial readiness cockpit now mirrors order/file readiness at tenant
  level in `Ordredrift signaler`.
- The commercial-ready scorecard includes `Ordredrift og filklarhed er synlig`,
  so those order/file signals affect the top-level ready count.
- The commercial-ready scorecard includes `Betaling/checkout pilot er afklaret`,
  so payment-mode clarity affects the top-level ready count.
- The commercial-ready scorecard includes `Kundeservice og dialog er synlig`,
  so customer/order and tenant-support message readiness affects the top-level
  ready count.
- The commercial-ready scorecard includes `Mail og notifikationer er afklaret`,
  so order confirmation/admin-mail readiness affects the top-level ready count.
- The commercial-ready scorecard includes `Levering og fulfillment er synlig`,
  so delivery methods, tracking and POD sender readiness affect the top-level
  ready count.
- The commercial-ready scorecard includes `Jura, cookie og kontakt er synlig`,
  so public company identity, contact email, cookie consent and tenant
  legal-route QA affect the top-level ready count.
- The commercial-ready scorecard includes `Platformhenvendelser kan modtages og
  følges op`, so the platform's public contact/lead path is visible before a
  print-house sales conversation.
- SEO/tenant-shell fixes.
- POD v2 admin updates and Danish Print.com term mapping.

PDF designer/service foundation:
- Vector-preserved PDF import/edit flow now supports page selection, rotate,
  crop-to-document ratio, stamp text, signature text, and text color.
- Selected PDF backgrounds expose `PdfToolsPanel` with page switching,
  reopen/edit, replace selected PDF, CutContour handoff, PDF-service scan, and
  vector export handoff.
- Generic designer PDF-service foundation exists in
  `src/lib/designer/pdfService.ts` and
  `supabase/functions/designer-pdf-service/index.ts`, separate from POD v2.
- Remaining expansions: deploy `designer-pdf-service`, connect an external PDF
  processor for OCR/compression/repair/PDF-A/redaction/form flattening, and add
  deeper save/load/export regression automation.

Supplier product bank:
- Supabase project `ziattmsmiirfweiuunfo` is linked and the local CLI loads
  secrets from `.env.local`.
- Do not run broad `supabase db push` for supplier-bank work while migration
  history drift remains; use the single supplier-bank migration path documented
  in `docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md`.
- Supplier-bank migration `20260701120000_supplier_product_bank.sql` is applied
  remotely and marked applied. Refresh-queue migration
  `20260703003500_supplier_bank_refresh_queue.sql` is also applied.
- Supplier registry rows are seeded for WIRmachenDRUCK, Pixartprinting, and
  Print.com. Internal Webprinter, Salgsmapper/Sales Maba, Onlinetryksager, and
  localhost domains remain excluded.
- Edge Functions `supplier-bank-import-draft` and
  `supplier-bank-create-delta-review` are deployed.
- WIRmachenDRUCK full folder bank is stored, refreshed, review-accepted, and
  imported as unpublished Matrix Layout draft `wmd-folder-bank-20260703` with
  18,800 price rows.
- Print.com has six approved bank slices imported as unpublished Matrix Layout
  drafts: flyers, business cards, presentation folders, letterheads,
  business-card boxes, and `t-shirt-basic-7`.
- Pixart flat-surface adhesive is approved and imported through STORFORMAT as
  unpublished draft `pixart-flat-surface-adhesive-storformat-draft`.
- Pixart rigids/signs is the open gate: the stored bank snapshot is still the
  older Plastic-only baseline, while the local Plastic+Plexiglass candidate
  `pricing_raw/supplier-bank-normalized/pixartprinting/pixart-rigids/20260703-051855.json`
  has packet/preflight evidence ready. Do not write it to the bank without
  explicit approval.
- Latest read-only overview reports:
  `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`,
  `docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md`,
  `docs/SUPPLIER_BANK_DECISION_QUEUE_20260703-111214.md`, and
  `docs/SUPPLIER_BANK_EXECUTIVE_SUMMARY_20260703-111214.md`. The executive
  summary links the current audit/approval/preflight evidence and separates
  safe preflight checks from approval-gated write commands. The latest status
  report now also links the Pixart URL confirmation checklist as a proof file.
- Latest report index:
  `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`; it is a local
  read-only evidence map over already generated Supplier Bank reports. It did
  not call supplier pages, scrape, read Supabase, write supplier-bank rows,
  create products, publish products, or write live pricing.
  The report lookup now prefers stable latest paths for recurring proof files,
  so generated proof trails and the admin evidence panel keep pointing at
  current operator files instead of older timestamped copies. The stable proof
  set includes the index, status, goal snapshot, gate roadmap, approval packet,
  decision queue, executive summary, completion audit, imported draft QA, expansion packet,
  coverage gap plan, Pixart adapter/readiness, URL candidates/checklist, and
  the Pixart/Print.com no-write preflights.
- Latest approval packet:
  `docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-120931.md`; it is read-only,
  separates safe check commands from write commands, and lists two approval
  candidates: high-priority Pixart rigids bank-only snapshot approval and
  medium-priority Print.com `placemats` bank-only snapshot approval. Both
  candidates show their no-write preflight/check command before the
  write-gated command(s), links the latest Pixart/Print.com no-write preflight
  reports, and includes the Pixart missing-family readiness blockers (`0/4`
  ready). It also lists exact approve and exact defer phrases per write
  candidate. No write command from the packet has been run.
- Latest expansion packet:
  `docs/SUPPLIER_BANK_EXPANSION_PACKET_20260703-111157.md`; it is read-only
  and turns the five remaining coverage gaps into a safe execution order:
  Print.com `other`, then Pixart `banners`, `labels`, `posters`, and
  `rollups`. It separates executable safe commands from human checklist items
  and keeps write-flagged commands out of the safe checklist. It includes
  Pixart readiness before probe and shows `0/4` missing Pixart families ready
  until exact URLs and extractor profiles exist.
- Latest completion/evidence audit:
  `docs/SUPPLIER_BANK_COMPLETION_AUDIT_20260703-111157.md`; it proves 5/8
  audited requirements and keeps the overall supplier-bank goal open because
  Pixart rigids, remaining registered family coverage, and the high-priority
  decision are still unresolved. It now includes the latest Pixart rigids
  no-write preflight report, candidate rows/effective rows `18/18`, materials
  `Foamex 3mm` and `Clear Polycarbonate 3mm`, DKK range `182.7-976.83`, and
  the Pixart `0/4` missing-family readiness evidence with per-family blockers.
- Latest coverage-gap plan:
  `docs/SUPPLIER_BANK_COVERAGE_GAP_PLAN_20260703-111101.md`; it breaks the five
  missing families into Print.com `other` scoping plus Pixart adapter mappings
  for `banners`, `labels`, `posters`, and `rollups`.
- Latest gate roadmap:
  `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`; it is read-only and
  turns the current work into five ordered gates: Pixart rigids approval,
  Print.com `other`/placemats approval, missing Pixart family preparation,
  imported-draft QA, and completion recheck. It lists safe/check commands
  separately from approval-gated writes and now marks whether exact
  approve/defer phrases exist for a gate. It also links the latest Pixart URL
  confirmation checklist in the missing-family gate evidence. It did not call
  suppliers, write supplier-bank rows, create products, publish products, or
  write live pricing.
- Latest goal snapshot:
  `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`; it is the current
  read-only operator-control view and keeps the goal open at 5/8 proved with
  3 open gates. Its latest proof-file section includes the URL confirmation
  checklist, status report, approval packet, roadmap, readiness, and preflight
  paths.
- Print.com `other` has fresh local/no-write scoping evidence from 2026-07-03
  13:17 local time. The broad catalog preview listed 856 Print.com products,
  kept 80 `other` candidates, fetched details for 12, and wrote
  `pricing_raw/supplier-bank-raw/print-com/other/20260703-131707.json` plus
  `pricing_raw/supplier-bank-normalized/print-com/other/20260703-131707.json`.
  The refreshed placemats named-policy price preview produced 4/4 valid DKK
  rows for quantities 10/25/50/100, DKK range `271.23-368.85`, and wrote
  `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-131715.json`.
  `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_LATEST.md` says it is ready
  for explicit bank-only write approval only. No supplier-bank rows, POD v2
  rows, products, publishing state, or live prices were written.
- Pixart missing-family readiness was refreshed at 2026-07-03 13:19 local
  time. The URL candidate report/checklist still shows 7 Pixart URL candidates,
  all `official_candidate_needs_confirmation`, with 0 confirmed exact URLs. The
  adapter/readiness reports still show 4/4 missing Pixart families blocked
  before probe (`posters`, `banners`, `rollups`, `labels`), 0
  extractor-supported profiles, 0 supplier-bank normalizer-supported profiles,
  and 0 confirmed exact URL candidates. Latest files are
  `docs/SUPPLIER_BANK_URL_CANDIDATES_LATEST.md`,
  `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_LATEST.md`,
  `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_LATEST.md`, and
  `docs/SUPPLIER_BANK_PIXART_READINESS_LATEST.md`. No Pixart probe/scrape,
  bank write, product write, publishing, or live pricing write was run.
- The core Supplier Bank proof reports were refreshed at 2026-07-07 local time
  with no supplier scraping, no Supabase writes, no product writes, no
  publishing, and no live pricing writes. The refreshed reports show the
  supplier-bank goal is not complete yet: 4/8 completion requirements proved,
  3 open gates, 1 contradicted gate, 9/14 registered families covered,
  5 missing families, imported draft QA at 9 OK / 0 warnings / 1 error, and
  1 published imported target. The current full WMD folder draft
  `wmd-folder-bank-20260703` has 18,800 expected Matrix Layout rows and
  18,800 stored `generic_product_prices` rows. The remaining QA error is the
  older published WMD target `wmd-folder-bank-891a5cf1`; do not
  unpublish/archive it without explicit user approval. Refreshed latest paths
  include
  `docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md`,
  `docs/SUPPLIER_BANK_DECISION_QUEUE_LATEST.md`,
  `docs/SUPPLIER_BANK_APPROVAL_PACKET_LATEST.md`,
  `docs/SUPPLIER_BANK_EXPANSION_PACKET_LATEST.md`,
  `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`,
  `docs/SUPPLIER_BANK_COMPLETION_AUDIT_LATEST.md`,
  `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`, and
  `docs/SUPPLIER_BANK_REPORT_INDEX_LATEST.md`.
- `/admin/supplier-bank` now surfaces the same five-step Gate roadmap above
  the decision queue. It is derived from already loaded supplier-bank state and
  is UI-only: no supplier calls, bank writes, product writes, publishing, or
  live pricing writes. It also surfaces Pixart URL candidates for missing
  families from supplier metadata or the checked-in registry fallback, keeping
  them clearly marked as candidates until exact URLs and extractor profiles are
  confirmed.
- `/admin/supplier-bank` also has a read-only top `Målestatus` panel derived
  from already loaded bank state. It summarizes family coverage, imported-draft
  QA, open approval/coverage gates, and the high-priority Pixart decision so the
  admin can see why the goal remains open without running CLI reports. It also
  lists plain-text safe check commands for coverage, draft QA, completion audit,
  and relevant preflight checks; these are not executable UI controls.
- `/admin/supplier-bank` now mirrors the Pixart readiness report in the browser
  for missing Pixart families. Missing-family cards and the top engineering
  readiness summary show the mapped Pixart profile, extractor support,
  supplier-bank normalizer support, and exact-URL confirmation from already
  loaded coverage/registry data. This is read-only and does not probe, scrape,
  write bank rows, create products, publish, or touch live pricing.
- The Gate roadmap's Pixart URL candidate panel now shows pending/confirmed/
  rejected counts plus a read-only manual URL confirmation checklist. The
  checklist keeps the human-review order explicit: open URL manually only,
  verify exact product/configurator URL, compare visible option shape with the
  planned profile/first slice, confirm extractor and supplier-bank normalizer
  support, and only then promote or reject with evidence. The safe checklist
  command is displayed as plain text, not an executable control.
- `/admin/supplier-bank` now also makes the supplier menu more business-facing:
  a top `Leverandør-menu` card shows each supplier with bank/missing family
  chips and ready/draft/blocked counts, and clicking a supplier jumps to the
  filtered product catalog. The selected supplier now has richer
  `Kataloghylder` cards per product family with ready/draft/blocked counts,
  price-line totals, DKK ranges, latest update time, and missing-family
  preview/URL-candidate state. These controls only filter already loaded bank
  rows; missing families and URL candidates stay planning-only and do not
  trigger probes, scrapes, imports, publishing, or live pricing writes. Each
  shelf also shows a read-only `Næste sikre skridt` and optional plain-text
  safe check command, not an executable UI action.
- Product cards in `/admin/supplier-bank` are business-first by default:
  source/preview, open-draft, and import actions stay visible, while refresh
  queueing and price-review creation sit behind a `Vis avanceret` toggle. This
  keeps the bank usable as a supplier product catalog without removing the
  controlled admin tools.
- Product cards also show compact read-only `Valgmuligheder` previews from
  normalized supplier-bank attributes, with group labels, value counts, and the
  first few visible values. This helps confirm formats/materials/finishes
  before opening the full preview.
- The product preview dialog now mirrors the safe workflow with a read-only
  `Næste sikre skridt` summary and optional plain-text safe check command. It
  does not run preflights, write bank rows, import drafts, publish, or change
  live prices by itself.
- The supplier-bank product browser shows active search/family/status/readiness
  filters as badges with a `Ryd filtre` button. This is local UI state only and
  does not touch supplier-bank rows, products, publishing, or live prices.
- `/admin/supplier-bank` also has an `Afventer godkendelse` panel for the
  current business approval candidates: Pixart rigids/signs and Print.com
  placemats. It is read-only and only changes the supplier filter when clicked;
  it does not run preflights, write bank snapshots, create drafts, publish, or
  write live prices. The cards now show a read-only "Hvis godkendt" / "Hvis
  afventer" impact strip so approval and deferral consequences are clear
  without exposing write controls. They also show guardrail badges such as
  no-write preflight present, explicit approval required, Matrix import
  blocked, and POD v2/live pricing untouched. Each card also shows the next
  safe no-write check command as plain text; it is not an executable UI action.
- `/admin/supplier-bank` product browsing now includes bank-status workflow
  filters (`Godkendt`, `Kladde`, `Gennemgaaet`, `Fejlet`) before the existing
  readiness filters. These are read-only filters over already loaded active bank
  rows; archived rows remain excluded from the admin browser query.
- `/admin/supplier-bank` also has a read-only `Manglende familier` panel that
  lists remaining supplier-family coverage gaps with current blockers and next
  safe steps. Pixart missing families remain blocked before probe/extract until
  exact URLs and profiles are confirmed; Print.com `other` remains the
  placemats bank-only approval gate. Clicking a row only filters the current
  browser view.
- Latest Pixart adapter mapping plan:
  `docs/SUPPLIER_BANK_PIXART_ADAPTER_PLAN_missing-pixart-families_20260703-111101.md`.
  It maps the missing Pixart families to proposed profile names, safe first
  slices, conversion-path assumptions, quality gates, and official Pixart URL
  candidates read from `config/supplier-bank/sources.json`
  `productFamilyUrlCandidates`. The report now separates URL candidate count
  from `confirmed_source_url` count; current confirmed exact URL candidates are
  `0/4`, and the profiles remain not implemented. No Pixart probe/scrape or
  bank write was run for those families.
- Latest Pixart readiness report:
  `docs/SUPPLIER_BANK_PIXART_READINESS_missing-pixart-families_20260703-111101.md`;
  it confirms 0/4 missing Pixart families are ready for a local/no-write probe
  because the profiles and exact product URLs are still missing. It now records
  registry-backed official Pixart URL candidates for posters, banners,
  rollups, and labels, but still blocks probe/extract until profile support and
  a candidate is manually promoted to `confirmed_source_url`. It is read-only
  and did not probe/scrape Pixart.
- Latest URL-candidate report:
  `docs/SUPPLIER_BANK_URL_CANDIDATES_pixartprinting-all-families_20260703-111100.md`;
  it is read-only over `config/supplier-bank/sources.json`, confirms 7 Pixart
  URL candidates, 7 pending confirmation, 0 confirmed exact source URLs, and 0
  rejected. It did not call supplier pages, scrape, write bank rows, create
  products, publish products, or write live pricing.
- Latest URL-confirmation checklist:
  `docs/SUPPLIER_BANK_URL_CONFIRMATION_CHECKLIST_pixartprinting-all-families_20260703-121623.md`;
  it is read-only over `config/supplier-bank/sources.json` and turns the 7
  Pixart candidate URLs across 4 missing families into a manual confirmation
  checklist. It requires exact product/configurator route, visible option-shape,
  login/cart blocker, and extractor-profile checks before a candidate may be
  promoted to `confirmed_source_url`. It did not call supplier pages, scrape,
  write bank rows, create products, publish products, or write live pricing.
- Latest Print.com `other` scoping report:
  `docs/SUPPLIER_BANK_PRINT_COM_OTHER_SCOPING_20260703-084329.md`; the latest
  local/no-write refresh listed 855 catalog products, captured 80 `other`
  candidates, and fetched 12 detail payloads at
  `pricing_raw/supplier-bank-normalized/print-com/other/20260703-092642.json`.
  The recommended first narrow price-policy candidate remains `placemats`.
  The refreshed named-policy preview
  `pricing_raw/supplier-bank-normalized/print-com/other/prices/20260703-092659.json`
  passed 4/4 valid DKK rows and no-write write-plan validation. The latest
  decision queue lists it as a medium-priority bank-only approval choice.
  Latest preflight report
  `docs/SUPPLIER_BANK_PRINT_COM_PLACEMATS_PREFLIGHT_20260703-110649.md`
  confirms it is ready for explicit bank-only write approval. No supplier-bank
  write is approved for this family yet.
- Latest Pixart rigids no-write preflight report:
  `docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_20260703-110648.md`. It confirms
  the Plastic+Plexiglass candidate has 18/18 effective rows, categories
  `Plastic` and `Plexiglass`, duplicate keys old/new `12/0`, DKK range
  `182.7-976.83`, and prints only approval-gated bank snapshot/delta-review
  commands. No supplier-bank write has been run.
- Latest imported draft QA: 10 checked, 10 OK, 0 warnings, 0 errors, and 0
  published targets. Matrix/STORFORMAT split is 9/1.
- No supplier-bank command should publish products or write live storefront
  pricing unless the user explicitly asks for that separate step.
- `/admin/supplier-bank` missing-family cards now include plain-text
  `Næste sikre check` commands. These are read-only operator hints, not UI
  actions: Pixart gaps point to readiness checks, Print.com `other` points to
  placemats no-write preflight, and generic gaps point to the coverage-gap
  plan.
- Those missing-family cards also show the first registry-backed URL candidate
  and evidence inline when available. The candidate remains planning-only unless
  its status is `confirmed_source_url`; showing it in the browser does not
  approve probe/extract, bank writes, product imports, publishing, or live
  pricing changes.
- `/admin/supplier-bank` now also has a read-only `Bevisfiler` panel with the
  latest local report paths for executive summary, completion audit, Pixart
  rigids preflight, Print.com placemats preflight, coverage gap plan, and Pixart
  readiness. The paths are operator evidence only; they do not run supplier
  calls, bank writes, imports, publishing, or live pricing updates.
- The `Bevisfiler` panel now also includes the latest goal-control snapshot:
  `docs/SUPPLIER_BANK_GOAL_SNAPSHOT_LATEST.md`, plus the latest
  approval packet `docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-120931.md` and
  gate roadmap `docs/SUPPLIER_BANK_GATE_ROADMAP_LATEST.md`.
- Approval cards now include a read-only `Beslutningscheckliste` for Pixart
  rigids and Print.com placemats. It clarifies the allowed bank-only decision
  scope and explicitly excludes product import, publishing, POD v2 rows, and
  live pricing changes.
- Approval cards also show an exact approval phrase for each candidate. That
  phrase is inert UI text only; it is not standing approval and must not be
  treated as permission unless the user explicitly says it in the conversation.
- Supplier-bank CLI now has a read-only goal-control snapshot:
  `npm run supplier-bank:goal-snapshot` and
  `npm run supplier-bank:goal-snapshot:write`. It combines the completion
  audit, source coverage, import eligibility, imported-draft QA, decision
  queue, Pixart readiness, and latest proof-file paths into one operator view.
  It separates safe/check-only commands from approval-gated writes and prints
  the exact approval phrases plus exact deferral phrases for Pixart rigids and
  Print.com placemats. It must not scrape suppliers, write bank rows, create
  products, publish, or write live prices.
- The goal snapshot, completion audit, and gate roadmap now include an
  `Open Work By Gate Type` section. It separates business approval,
  engineering readiness, local preview, draft QA, and completion-proof gates so
  future sessions can see why the bank is usable but not complete without
  inferring that from several reports.
- `/admin/supplier-bank` now mirrors that gate-type structure in the read-only
  `Målestatus` panel. It shows business approval, engineering readiness,
  local preview, draft QA, and completion-proof buckets from already loaded
  browser state only. It does not call suppliers, write supplier-bank rows,
  import drafts, publish products, or change live pricing.
- Pixart missing-family readiness now splits extractor support from
  supplier-bank normalizer support. The latest adapter/readiness reports show
  `0/4` extractor-supported profiles, `0/4` normalizer-supported profiles, and
  `0/4` confirmed exact URLs for posters, banners, rollups, and labels. Keep
  probe/extract/normalization blocked for those families until all three gates
  are green.
- `/admin/supplier-bank` approval cards now show both an exact approval phrase
  and an exact afvent/defer phrase. The defer phrase is inert UI text only and
  must not be treated as permission to write anything.
- `/admin/supplier-bank` approval cards now also show a read-only `Bevisspor
  før beslutning` section. Pixart rigids links the operator to the
  candidate/baseline JSON, candidate packet, no-write preflight, and storformat
  review. Print.com placemats links to the local catalog/price previews,
  no-write preflight, coverage plan, and decision queue. This is navigation
  evidence only and must not be treated as approval to scrape, write bank rows,
  import products, publish, or update live prices.
- `/admin/supplier-bank` now has a read-only `Næste importvalg` queue above
  the selected supplier family shelves. It uses the current filters and
  existing import-readiness gates to rank ready, warning, blocked, and imported
  rows, then opens only the existing preview dialog. It does not approve bank
  products, call suppliers, write supplier-bank rows, import drafts, publish,
  or update live prices.
- `/admin/supplier-bank` now also surfaces `Faktiske bankprodukter` directly
  below the top KPI cards, before the report/goal panels. This was added after
  the admin page felt like text frames instead of a product bank. The cards show
  supplier, family, readiness, price-line count, DKK range, latest update, and
  draft/blocker note, and they only open the existing preview. On 2026-07-03 a
  service-role read confirmed 3 suppliers, 10 total bank products, 17 price
  snapshots, and 10 import jobs; active/non-archived UI coverage is 9 products.
- That same top section is now an `Enkel produktvaelger`: product-group buttons
  first, then product cards with normalized option previews. For WMD Foldere
  this exposes options such as material, format, foldetype, pages, and direction
  from the stored 18,800-row matrix. The preview dialog now supports exact
  Matrix Layout variant selection through `Konkret produktvalg`; selected
  attributes are passed to `supplier-bank-import-draft` as `rowFilter`, so the
  dry-run and final draft import use only matching normalized price rows.
  Imported variant drafts include the selection in their draft name/slug and
  import summary. Storformat products still require the separate storformat
  importer and remain blocked from generic Matrix import.
- The Supplier Bank browser is now intentionally picker-first. The normal
  first view is button-based: product group -> print house -> product. The old
  KPI/report/status panels are hidden behind `Vis teknisk overblik` so admins
  can handpick supplier products without reading the operator report first.

Important files:
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/hooks/useBrandingDraft.ts`
- `src/components/Header.tsx`
- `src/components/HeroSlider.tsx`
- `src/components/ProductGrid.tsx`
- `src/components/product-price-page/ProductPricePanel.tsx`
- `src/components/product-price-page/DynamicProductOptions.tsx`
- `src/components/admin/ProductOptionButtonEditor.tsx`
- `src/components/admin/ProductOptionSectionBoxEditor.tsx`
- `src/components/preview/PreviewInteractionManager.tsx`
- `src/lib/siteDesignTargets.ts`
- `src/pages/admin/Pod2Admin.tsx`
- `src/lib/pod2/danishTerms.ts`
- `src/components/designer/PDFImportModal.tsx`
- `src/components/designer/PdfToolsPanel.tsx`
- `src/lib/designer/pdfService.ts`
- `supabase/functions/designer-pdf-service/index.ts`
- `docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md`

## Safety Notes

- Local admin may write to production Supabase data.
- Do not change POD v1 or core pricing unless explicitly asked.
- Read `POD2_README.md` before touching POD v2.
- Preserve tenant-specific settings. Code is shared, settings are per tenant.
- Run `npm run build` before any deploy when npm is available. In the Codex
  desktop shell, use the bundled Node/Vite command above if npm is missing.
