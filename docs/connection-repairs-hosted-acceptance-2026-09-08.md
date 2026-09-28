# Matched release and hosted acceptance — 8 September 2026

This is the remaining acceptance plan for the [connection repairs](SYSTEM_CONNECTION_REPAIRS_2026-09-08.md). It is based on source/configuration inspection and a local read-only release check. No hosted configuration, records, files, payments, emails or deployments were changed during this review. The steps below are a runbook, **not completed hosted tests**.

## Environment finding

### Live read-only follow-up — 8 September 2026, 19:19 UTC

The connected Supabase inventory now confirms one visible project,
`ziattmsmiirfweiuunfo` (`printmaker-dev`), with only its default `main`
branch. No isolated staging project/branch was found in this connection.
None of the six repair migration versions appears in its hosted migration
history. This checks recorded migration history, not every database object's
definition.

The hosted function inventory contains `stripe-create-payment-intent` v13
with `verify_jwt=false` and `send-order-email` v15 with `verify_jwt=true`.
`stripe-finalize-checkout`, `stripe-storefront-webhook`, and
`storefront-order-email-dispatch` are absent. The local creator requires
`verify_jwt=true`, so existing deployment metadata does not match this packet.
Function source was not downloaded or executed by this follow-up.

Local environment inspection, with values suppressed, reconfirms the same
backend URL and live-mode Stripe publishable keys in `.env` and `.env.local`.
Neither `.env.staging` nor `.env.staging.local` exists. The Vercel connector
returns **403 Forbidden** for the exact linked project/team. This is an access
failure; it does not establish whether a Vercel staging deployment exists.

Local checks pass: **51/51** focused checkout/handler/STORFORMAT/email tests,
explicit grants across seven pending migration files, and exposure/config
checks across 59 functions. The seven-file grants check includes the unrelated
ERP migration, which remains excluded from the six-file deployment packet.
These are local checks with synthetic service adapters, not hosted acceptance.
No full TypeScript check or frontend build was repeated in this follow-up;
the existing TypeScript backlog remains open.

Preparation artifacts are in [the staging preflight directory](staging-preflight-2026-09-08/README.md):
a backend source/checksum manifest and a blank results sheet expanded across
both accounts and shops. The manifest is not a complete frontend release or a
deployment approval. Staging identities, Auth/Stripe/email configuration,
ordinary test accounts, controlled inboxes, and the exact frontend artifact
still require verification. No hosted configuration, migration, payment,
email, fixture, Git index or application source was changed.

**No designated isolated Supabase/Stripe staging environment is established by the inspected evidence.** A project named `printmaker-dev` exists in cached link metadata, but its name does not establish disposable data or test-mode payments.

| Evidence inspected | Finding | Release implication |
| --- | --- | --- |
| `supabase/config.toml`, `supabase/.temp/project-ref`, cached linked-project metadata | All point to `ziattmsmiirfweiuunfo`; cached name is `printmaker-dev`. | Do not infer staging isolation or repoint this checkout implicitly. |
| `.env` and `.env.local`, with values suppressed | Both Supabase URLs point to that same ref. Both browser Supabase keys are legacy anon JWTs whose nonsecret role/ref claims match it. Both Stripe publishable keys have the **live** prefix. | The current local environment is unsuitable for an unguarded Stripe test run. No secret or complete key was copied into this report. |
| `.env.local` project-ID label | Its `VITE_SUPABASE_PROJECT_ID` is missing the final character compared with the URL/config. The browser client uses the URL/key; no runtime use of this ID label was found in `src`/`api`. | Correct the release manifest's project identity; do not use this label alone as evidence of the target. |
| `.vercel/project.json`, `vercel.json` | Linked Vercel project is `printmaker-web-craft-main`. Routing includes server tenant-shell endpoints and SPA fallback. No distinct staging project/environment is declared here. | Vercel Preview is not proof that its backend/Stripe credentials are isolated. Verify browser **and** server-function environment scopes. |
| `supabase/config.toml` | Function JWT settings exist, but no Auth site URL, redirect allowlist, SMTP configuration or staging secrets are declared. | Confirm these in the chosen staging project before real Auth tests. |
| `docs/STRIPE_SUBSCRIPTIONS_SETUP.md` | Documents platform subscription billing and its separate webhook. | It does not configure storefront order completion. A dedicated `stripe-storefront-webhook` endpoint is still required. |
| Available tool metadata | Supabase project/branch/function/migration metadata and Vercel project/deployment inspection are available. No Stripe or Resend connector is exposed in the current tool set. | Read-only discovery can identify a designated staging project/branch later. Tool availability does not prove it exists or is configured. No remote inventory was requested by this review. |

`scripts/supabase-cli.mjs` loads `.env` first and `.env.local` second without an override option, whereas frontend Vite environment precedence differs. Use an isolated release checkout and explicitly scoped deployment environment. Do not rely on swapping one local file while leaving the linked project and server keys implicit.

## Existing verification tools and their limits

- `node scripts/check-commercial-deploy-readiness.mjs --strict` was run locally and exited **1 / HOLD**. Three existing staged entries do not contain this repair's Supabase packet. The check sees the large unrelated dirty worktree. Its release/freshness PASS rows read July reports; they do not attest to the September code. No fetch, staging, commit, or report rewrite was performed.
- `check:supabase-grants` checks explicit Data API privilege decisions. `check:supabase-functions` checks config coverage, selected public-read CORS handling and local-only guards. Neither proves deployed JWT settings, application authorization, PostgREST/RLS behavior, or binary Storage operations.
- `scripts/tests/checkout-browser.test.mjs` uses real checkout UI but replaces Supabase, Stripe and the Designer destination. It intercepts remote requests. The Designer browser harness retains actual Fabric but also replaces services. Passing these remains synthetic evidence.
- `scripts/tests/storformat-checkout-browser.test.mjs` passed two actual ProductPrice/StorformatConfigurator/ProductPricePanel journeys with synthetic Supabase and a lightweight checkout destination. A 125×60 cm, three-unit material/finish/product selection displays and retains 338 kr; changing to 80×150 cm, one different material/product and no finish displays and retains 101 kr. Exact IDs, section values, dimensions, area, quantity, subtotal and shop query survive handoff. The unchanged calculator and manual fixture arithmetic agree. No page/console errors or remote mutations occurred; targeted ESLint passed. [Results](../tmp/connection-repairs-storformat-browser/report.json), [selected configuration](../tmp/connection-repairs-storformat-browser/selected-product.png). This proves that browser handoff, not hosted server price parity or the separate A4 per-area-option path.
- The PostgreSQL account/payment/branding fixtures use disposable local databases and representative policies. Never point them at the hosted project: they create/drop fixture databases and are not production migrations or hosted test runners.
- `scripts/check-tenant-proof-routes.mjs` can take `--base-url`, but embeds existing Webprinter/Salgsmapper/Onlinetryksager expectations. Its Designer return check substitutes the production Storage upload response. Do not count it as a genuine uploaded-file/payment test or assume changing the base URL creates a two-test-shop acceptance suite.
- Only a Supabase grants workflow was found under `.github/workflows`. There is no checked-in authenticated hosted four-journey harness or declared dedicated Stripe test deployment.

## Authentication expectations to prove

The creator and finalizer retain `verify_jwt=true`. The webhook uses `verify_jwt=false` and checks Stripe's signature over the original request body. The email worker's dedicated bearer-secret authentication must likewise have the matching gateway setting from its reviewed config; a random cron secret is not a Supabase user JWT.

The installed `supabase-js` client supplies the signed-in session token, or the project's key when no session exists (`SupabaseClient._getAccessToken` and `lib/fetch.ts`). Current local keys are legacy anon JWTs. `verify_jwt=true` is therefore **not a customer-login requirement**. Current Supabase documentation also describes API-key compatibility at this gateway; a modern publishable key is not by itself evidence that guest calls fail. Keep the existing gateway settings and prove the actual chosen SDK/key/gateway combination. [Supabase authorization headers](https://supabase.com/docs/guides/functions/auth-headers).

| Caller/path | Required observed behavior |
| --- | --- |
| Signed-out browser creating an order | Valid app key reaches the creator; `getUser` provides no account, so the attempt has `user_id=null`. Independent random attempt ID and recovery token are retained. This is a guest checkout, not `signInAnonymously()`. |
| Signed-in customer creating an order | Server `getUser` determines `user_id`; client metadata cannot choose it. Token refresh/expired-session errors must not be mistaken for a completed account order. |
| Account attempt finalization/cancellation | Original account **and** correct recovery token required. Wrong customer, signed-out state, wrong token or mismatched payment identity must fail without leaking an order or creating another payment. |
| Guest attempt recovery | Correct independent recovery token required; email equality does not grant access or claim the order. Signing in later does not retroactively attach the order to that account. Guest-to-account claiming is outside this release. |
| Customer account, saved design, message receipt, replacement file | Genuine user JWT and current shop context required; public app key alone is insufficient. Test through the browser/PostgREST, not service-role SQL. |
| Branding update | Real tenant-owner session and existing tenants RLS required. A customer session must not gain settings rights simply because the RPC has an authenticated grant. |
| Stripe webhook | Valid dedicated endpoint signature required. Missing/wrong signature and altered raw bytes cannot finalize an attempt. A failure after a valid event must be retryable. |

Signup/reset code builds redirects on `window.location.origin`, including shop context. Configure the staging Auth Site URL and allowed callback routes for the exact staging origins; verify the email templates honor the requested redirect. Supabase identifies these settings as relevant to confirmation and password reset redirects. [Auth redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Release manifest and sequence

Complete these steps in order on the designated staging environment. Record target IDs/URLs and secret **names/modes**, never tokens or customer payloads.

1. **Identify the target.** Record the staging Supabase project/branch ref, Vercel deployment origin, two shop origins, Stripe test account/sandbox identity, test-connected-account identity if destination charges will launch, test inboxes, and the person owning cleanup/reconciliation. Verify the chosen backend contains only approved staging fixtures. If none is designated, creating one is a separate infrastructure step; the linked project is not an automatic substitute.
2. **Freeze the exact packet.** Build an isolated release checkout from the reviewed repair hunks plus their dependencies, preserving the working checkout. Record commit/artifact SHA, migration versions/checksums, deployed function versions, environment modes and build timestamp. Re-run focused tests, production build, grants/exposure checks and relevant release-packet checks on that exact source. Retain the known broad TypeScript backlog as an explicit outstanding limit; a Vite build is not a clean typecheck.
3. **Keep new effects disabled.** Set `STOREFRONT_CHECKOUT_ENABLED=false` and `STOREFRONT_ORDER_EMAIL_MODE=disabled` in staging. Set only Stripe test credentials there. Audit Vercel Preview **and** server function `VITE_SUPABASE_URL`/`SUPABASE_URL`/key scopes; all must resolve to staging. Browser `VITE_STRIPE_PUBLISHABLE_KEY` must be the matching test key. Do not expose service keys through `VITE_*`. The existing exposed supplier demo-token variable needs its separately documented privilege assessment; do not carry production supplier access into this test.
4. **Apply the matched schema.** The base repair uses the five migrations listed below. Include the coordinated email outbox migration in the extended release. Review actual final SQL and target migration history first; do not bulk-push unrelated pending migrations such as the ERP shadow outbox. Validate grants/RLS/advisors and PostgREST schema availability after application.
5. **Deploy the matched runtime while disabled.** Deploy `stripe-create-payment-intent`, `stripe-finalize-checkout`, `stripe-storefront-webhook`, their reviewed shared quote/artifact helpers including `storefrontStorformatQuote.ts`, `storefront-order-email-dispatch`, the hardened existing `send-order-email`, and the matching frontend. Include `supabase/config.toml` JWT settings. Leaving the old status-email endpoint deployed retains its caller-controlled recipient/content bypass. The authoritative pricing extension and email implementation must be the exact versions tested with this build; older reports do not establish their coverage. Verify deployed source/version and dependency imports, not just successful CLI output.
6. **Configure external test plumbing.** Register `https://<staging-ref>.supabase.co/functions/v1/stripe-storefront-webhook` for storefront `payment_intent.succeeded` in the matching Stripe test account/sandbox. Use that endpoint's `STOREFRONT_CHECKOUT_WEBHOOK_SECRET` and the intended `STRIPE_API_VERSION`. Do not reuse the subscription webhook secret or send live events to staging. Configure staging Auth redirects/SMTP and isolated operator/customer inboxes.
7. **Probe while disabled.** From signed-out and genuine signed-in staging browsers, verify OPTIONS/gateway behavior and that a creator POST returns contract-v2 `checkout_backend_not_ready` without creating an intent. Invalid finalizer input must fail before writes; a wrong webhook signature must fail. Verify public catalog and tenant resolution, real account login/session refresh, and all low-privilege access denials below. Log only status/error codes and nonsecret identities.
8. **Seed the bounded fixtures and enable test checkout.** Use two visibly different test shops S/T with separate ordinary tenant owners, two customer accounts A/B with no admin/operator roles, distinguishable addresses, and controlled products covering the launch price models. Use no real customer data or supplier dispatch. Add same-slug products with different IDs/prices across shops to expose lost shop context. Once the deployed protocol is matched, enable `STOREFRONT_CHECKOUT_ENABLED=true` only on staging.
9. **Run the acceptance matrix.** Complete A→S, A→T, B→S, B→T in clean browser profiles, plus an explicit guest journey. Direct shop-host navigation must be tested as well as `?tenantId=` preview navigation. Random Vercel preview hosts are not automatically mapped to a shop; use registered test shop domains or explicit IDs until domain routing is configured. Capture the evidence listed below.
10. **Enable and verify controlled mail delivery.** Set `STOREFRONT_ORDER_EMAIL_MODE=test`, `RESEND_API_KEY`, verified `CONTACT_EMAIL_FROM`, a 32+ character `STOREFRONT_ORDER_EMAIL_CRON_SECRET`, and `STOREFRONT_ORDER_EMAIL_RECIPIENT_ALLOWLIST` containing only the test customer/operator inboxes. Set `STOREFRONT_ORDER_EMAIL_SITE_URL` to the staging HTTPS origin, without credentials, query, fragment or subpath; it supplies the account links frozen into the first provider payload. After manual controlled worker acceptance, schedule `storefront-order-email-dispatch` once per minute using its dedicated bearer secret. Verify the worker cannot claim live attempts or nonallowlisted recipients. Confirm outbox persistence and receipt before describing mail as delivered.
11. **Close the run.** Disable new staging payments, reconcile every test attempt/intent and pending email, then retain sanitized evidence and a pass/fail sheet. Promotion to a production canary is a separate release decision using the same reviewed packet and production-specific configuration. Retain finalization/webhook completion while any issued intent is unsettled.

Base migrations, in version order:

```text
20260908140250_customer_order_file_finalization.sql
20260908171700_customer_order_message_read_receipts.sql
20260908171743_storefront_checkout_finalization.sql
20260908172146_tenant_branding_settings_compare_and_swap.sql
20260908172325_checkout_customer_profile_address_details.sql
```

Coordinated email extension: `20260908184205_storefront_order_email_outbox.sql` and `storefront-order-email-dispatch`. Their final implementation/test report is part of the extended matched packet, not proof supplied by this document.

## Acceptance matrix

Use a results sheet with one row per scenario and per relevant account/shop. Each row needs the release SHA, run time, actor/shop, expected behavior, actual result, and sanitized evidence reference.

| Scenario | Required proof |
| --- | --- |
| Settings in S and T | Each ordinary tenant owner saves draft, reloads editor, publishes and reloads a fresh storefront/account tab. Draft remains private; selected theme survives. Master draft overrides published values in editor only. Simultaneous writes reject stale CAS instead of reporting success. Owner S/customer A cannot write T. |
| Four account/shop purchases | Each A/B×S/T journey signs in through actual Auth, selects the intended product, uploads/proofs, pays with the same Stripe test setup, receives a durable order, reloads it in the correct account, and opens it in that shop owner's admin. Two accounts in one shop and one account across two shops test different boundaries. |
| Quote parity | For every intended launch pricing model, compare unchanged product calculator, checkout display, server quote snapshot and Stripe integer minor-unit amount, including dimensions/quantity/options/delivery/tax semantics. Test minimums/boundaries, missing/unknown/cross-shop IDs, unpublished product and client amount tampering. An unsupported or ambiguous model must stop **before** a PaymentIntent; do not substitute a generic fallback. |
| Proof and production bytes | Test exact-size PDF, raster image routed through Designer, translated/scaled placement, and non-square dimensions. Download the final immutable object, compare SHA-256 to the approved/exported bytes and server snapshot, and inspect PDF dimensions/bleed/placement. Mutate the original upload after approval: creator must refuse until reapproved. Mutate after immutable copy: retained order bytes remain unchanged. Test primary versus alternate output file order. |
| Designer login/save | Start signed out with visible artwork, open login in a second tab on the same shop origin, then save in the original tab. Refresh saved design and export single-page PDF; original vector/PDF bytes survive. Wrong shop/product and denied/zero-row saves retain artwork. Multi-page/multi-side library save stays open with its explicit limitation; separately verify any production export formats required for launch. |
| Address and identity changes | Persist line 2/country through default selection, typed overrides, reload, checkout profile, server order snapshot and receipt. Slow the saved-address response, type a country-only change, then switch A→B; old A responses cannot overwrite B. Addresses/profile preferences may be user-wide by design; order/design visibility still follows both user and shop. |
| Account/RLS separation | A cannot select/update B's orders/designs, acknowledge B's messages, upload a replacement to B's order, or directly insert order-file rows. Correct account on wrong shop route must not reveal another shop's order details. Use actual customer tokens through Data API; service-role checks cannot prove this. |
| Messages and replacements | Operator creates a file request and message in each shop. Customer reads only those exact operator-message IDs; failure/partial RPC return does not fake read state. Replacement dry-run, binary upload and finalization succeed with the correct Storage `owner_id`, size and JWT issuer. Double-submit/replay is idempotent; concurrent replacements yield one accepted current version; wrong owner/path/current-file IDs fail. Existing/current files remain downloadable. |
| Hosted Storage immutability | Exercise actual Storage upload/download, overwrite and delete APIs for replacement paths and `checkout-finalized/` paths under anon, owner and another customer. Verify prohibited changes fail and bytes remain identical. Public `order-files` visibility is unchanged by this release: do not claim public file URLs are private merely because account APIs are scoped. |
| Payment success/failure/3DS | Actual test PaymentElement success, decline, 3DS success/cancel and redirect return. A paid-status toast alone is not order acceptance. Only server finalizer success with durable order identity permits order confirmation; failed/pending finalization retains retry controls and the authoritative receipt. |
| Retry/concurrency/cancellation | Double-click and same-attempt retry produce one intent/order. Altered retry body fails. Definitive cancellation permits a new attempt; processing/uncertain state retains recovery. Race cancellation with success and delayed creation. Reload pending and completed checkout; use persisted order totals, not later edited local totals. |
| Webhook-only completion | Close the browser after payment, deliver the genuine signed success event, then sign in afresh: one order and all files exist. Replay/duplicate and delayed events remain idempotent. In disposable staging only, induce finalizer write failure, observe non-2xx event delivery and no partial order, restore and retry. Do not force failures in the linked business database. |
| Guest and session expiry | Signed-out test payment finalizes by recovery token. Wrong token is denied; matching email cannot claim order. Account-originated checkout signed out or switched to B cannot finalize with A's token. Verify session refresh and browser restart/return behavior honestly; do not promise recovery if the required session/token was lost. |
| Durable test email | Customer/operator messages correspond to committed order data and correct shop URLs/branding. No browser must remain open. Failed sends remain queued/retryable; duplicate callbacks/workers do not send duplicates within the provider idempotency window. Missing/wrong worker secret, disabled mode, live/test mismatch and nonallowlisted recipient produce no mail. At 23h/8 attempts, ambiguous sends become `needs_review`; do not blindly resend beyond the idempotency window. |
| Manual status/problem email | Actual owner/same-shop staff may request a saved order's update; customer, anonymous and other-shop staff tokens must fail. Forged recipient/content fields have no effect, and legacy confirmation calls return 409. A new problem with unchanged status sends its saved problem message without inserting false status history. Only allowlisted test-order recipients are contacted. Failed sending warns while the saved order remains successful. These direct operator requests have no durable outbox. |
| Kill switch and operations | Disabling new checkout blocks new intents while existing paid attempts still finalize. Disabling email prevents new dispatch without losing queued records. Document how the operator finds incomplete paid attempts, undelivered email and each test failure; avoid historical backfill or supplier submission as part of acceptance. |

For each accepted payment, preserve a sanitized joinable chain: test shop ID → test account ID or guest marker → attempt ID → Stripe test intent/event IDs → durable order ID/number → immutable file path/hash → notification/outbox/provider receipt IDs. Record amounts, dimensions, statuses and row counts, but omit access tokens, client secrets, email bodies and card details. A screenshot of an order confirmation without this persistence chain is insufficient.

Release acceptance remains incomplete until the chosen hosted environment and all required rows have actual results. Retain additive security/schema changes on rollback; turn off new effects first and reconcile issued payments/ambiguous mail rather than deleting attempts, immutable files or recovery history. Specific rollback details remain in the area repair reports.
