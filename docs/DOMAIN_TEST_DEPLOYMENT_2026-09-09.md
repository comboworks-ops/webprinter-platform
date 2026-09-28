# Webprinter test deployment — 9 September 2026

The current frontend has been copied into an isolated Git worktree, committed, pushed, and deployed as a protected Vercel preview. The public domain has not been switched.

## Review links and source

- GitHub branch: https://github.com/comboworks-ops/webprinter-platform/tree/codex/domain-test-2026-09-09
- Latest commit: `7bbe3a5269f9fa008d8d92029196566ed2867fdc`
- Vercel preview: https://printmaker-web-craft-main-py57rru1q-thomas-projects-d80b9ddd.vercel.app
- Deployment: `dpl_2yyEzxLXGBjtjsFzE9sNfHB3sCab`, verified Ready, target Preview.
- Worktree: `/private/tmp/webprinter-domain-test-20260909`
- Original working directory remains on `ui-cleanup`; its existing staged paths were preserved. No checkout switch, reset, or bulk staging was performed there.

## Test behavior

- The branch builds with `build:test`, using pinned pnpm 11.19.0 and its matching lockfile.
- A visible banner identifies the test version and warns that login and saved changes use the existing shop.
- Payment initiation is disabled in the checkout UI. The shared Supabase client also blocks the selected Stripe, supplier submission, billing, and order-email function calls in this build before sending requests.
- These are frontend test safeguards, not a server authorization boundary. The preview shares the existing Supabase backend; admin saves can change existing shop data.
- No database migrations or backend functions were deployed. The payment and backend readiness issues documented in `RELEASE_ASSESSMENT_2026-09-09.md` remain open.
- Preview routes serve the compiled SPA directly to avoid the existing tenant shell internally refetching a Vercel login page on protected deployments.
- Responses have `X-Robots-Tag: noindex, nofollow, noarchive`.

## Verification and limits

- A fresh frozen dependency install and production test build passed.
- 66 selected checkout, pricing, email/protocol, proof-availability, and test-request-guard tests passed.
- Supabase grant and exposure checks passed. This is source validation; no pending migrations were applied.
- The broader application TypeScript check still reports 402 diagnostics and is not a clean release gate.
- The compiled local browser preview rendered the platform landing page, test banner, and master shop with the aluminium product calculator and catalogue links.
- Authenticated HTTP checks against the final hosted deployment returned HTTP 200 with the SPA document at `/`, `/shop?tenantId=00000000-0000-0000-0000-000000000000&design=1`, and `/checkout/konfigurer`. The compiled JavaScript returned HTTP 200 and contained the test banner. Root HTML did not contain the Vercel login page.
- Hosted browser access requires an ordinary Vercel login. The available browser sessions were not signed in, so full interactive hosted acceptance and authenticated persistence were not verified. No payment or supplier order was submitted.

## Domain and access

The preview currently uses its Vercel address. Neither `webprinter.dk` nor `www.webprinter.dk` was reassigned, and no custom DNS records were changed. The proposed `test.webprinter.dk` address has not been selected by the user or connected.

An attempt to create a temporary login-free preview link was rejected by automatic approval review because it would expand access to anyone holding the link. No access bypass was created and deployment protection remains enabled.

## Continuing and rollback

Continue frontend test changes on `codex/domain-test-2026-09-09`. Do not merge its test-mode build and direct-SPA routing configuration into a payment-enabled production release without reviewing those differences. Keep database and backend deployment decisions separate.

No live-domain rollback is currently needed because production was not promoted or reassigned. The test deployment can be removed independently if desired. Preserve the original working directory and its uncommitted changes.
