# GitHub and live replacement assessment — 9 September 2026

**Decision: prepare a reviewed GitHub branch and an isolated test deployment; hold replacement of the production application.**

The current application builds and its sampled storefront journey works. The decisive blocker is a verified mismatch between the current frontend and the hosted checkout backend. Uploading the frontend alone cannot deliver the new payment, order completion and email journey.

This assessment made no application edits, commits, pushes, deployments, infrastructure changes, database writes, uploads, payments or email sends. Local verification artifacts are under `tmp/release-assessment-2026-09-09/`. The existing Git index and working changes were preserved.

## GitHub and hosting

- Repository: `comboworks-ops/webprinter-platform`.
- Current branch: `ui-cleanup`; local HEAD and the branch read directly from GitHub both equal `c0ee02839e4329c6c8543101e4fca4d9d0222cda` (28 July).
- Remote `main`: `354f59de9488136f376ff6a67e2eed2feae8901a`. This review did not merge or reconcile it with the working changes.
- At intake, `git status --porcelain=v1 -uall` listed 778 paths: 190 tracked modifications and 588 untracked files. Three tracked files have staged changes and additional unstaged changes. This is a working collection of changes, not a frozen release artifact.
- Live Vercel API inspection confirms project `printmaker-web-craft-main`, GitHub integration with the repository above, and **production branch `main`**. The current production target reports `READY`. That is deployment status, not functional acceptance.
- Vercel uses the Vite preset and Node 24.x, with no explicit install/build override. The connector returned 403, but the existing CLI login successfully read the project and its Git configuration.
- Vercel normally deploys branch pushes as previews and production-branch pushes to the live domains. Verify the preview environment before pushing the candidate; a preview URL does not establish database/payment isolation. [Vercel GitHub integration](https://vercel.com/docs/git/vercel-for-github).

**GitHub recommendation:** use a new reviewed `codex/` release branch, retain the existing work, exclude scratch/generated material and credentials, and check dependencies in a clean checkout. Do not merge this collection straight into `main`.

## Current verification

| Check | Fresh result | What it establishes |
| --- | --- | --- |
| Production Vite build | PASS, 11.66 seconds; large-chunk warning | Current working source compiles using installed dependencies. Output: `tmp/release-assessment-2026-09-09/build`. Not a clean-install or Vercel server-function test. |
| Six focused test files | 63/63 PASS | Checkout protocol/handlers, quote validation, order/status email and file-approval logic with synthetic services. No hosted payment or email was exercised. |
| Data API grants | PASS across 8 candidate migrations | Local explicit-grant checks. These eight files are not an approved deployment set. |
| Edge function exposure | PASS across 59 functions | Local configuration checks, not deployed authorization acceptance. |
| Application TypeScript | FAIL, 402 diagnostics | Broad typecheck remains unclean. This review does not attribute every error to the latest changes. |
| Existing strict release script | HOLD, exit 1 | Current packaging is incomplete. Some PASS rows reference historical reports and cannot attest to this September source. |
| Public `https://www.webprinter.dk/` | Rendered existing platform landing; no captured warning/error logs | Current homepage accessibility only. Does not establish old checkout health. |
| Local master storefront and aluminium product | Rendered with real backend reads; homepage handoff preserved 100 × 100 cm and quantity 1, showing 436 kr product subtotal on both pages | Sampled navigation/configuration works. No captured errors; one `motion()` deprecation warning on the homepage. |

The listener on `127.0.0.1:8110` was confirmed as PID 3823 with this repository as its working directory. Browser checks used the explicit master tenant context. Authenticated admin saving, customer order persistence, tenant isolation, file upload/print acceptance, supplier fulfillment and payment were not tested in this assessment.

## Production blockers

1. **Checkout backend is incomplete for the new frontend.** Live Supabase inventory shows none of `stripe-finalize-checkout`, `stripe-storefront-webhook`, or `storefront-order-email-dispatch`. The existing payment creator is v13 with `verify_jwt=false`; the current local configuration requires the reviewed matching setup. The frontend invokes the absent finalizer and requires the v2 protocol. Deploy the complete matching backend and frontend together after test acceptance.

2. **The six connection-repair migrations are absent from hosted migration history.** The inventory contains 145 records and none of the six September repair versions. This establishes missing migration history, not a full introspection of every database object. These repairs support order/file finalization, message receipts, settings conflict checking, checkout addresses and the email queue. Follow the exact packet in [SYSTEM_CONNECTION_REPAIRS_2026-09-08.md](SYSTEM_CONNECTION_REPAIRS_2026-09-08.md); do not bulk-apply unrelated pending ERP or pricing migrations.

3. **No isolated test backend was found in the connected inventory.** Supabase lists one visible project, `ziattmsmiirfweiuunfo`, and only its default `main` branch. Both local environment files point to it and contain live-mode Stripe publishable keys. A project called `printmaker-dev` is not evidence of staging. Test checkout with a dedicated backend and Stripe test configuration, with outbound email restricted to agreed test recipients.

4. **The release must install and build from Git, without relying on this machine.** `package-lock.json` is missing the root dependencies `@pdf-lib/fontkit`, `maxrects-packer` and `svg2pdf.js`. The new `pnpm-workspace.yaml` contains unresolved `allowBuilds` placeholder strings. Choose and verify a package manager/lockfile and an explicit hosted installation policy before release. No installation or lockfile rewrite was performed here.

5. **Hosted acceptance remains outstanding.** Prove product selection → approved production file → Stripe test payment → exactly one durable order → customer account → correct shop admin → customer/operator email. Include closing the browser after payment, repeated webhooks, denied cross-customer/shop access, file replacement and save/reload of branding. Use the existing [hosted acceptance runbook](connection-repairs-hosted-acceptance-2026-09-08.md). The 63 local test passes do not close these boundaries.

The 402 TypeScript diagnostics are an additional quality risk: triage the release paths and track the remaining backlog explicitly. The confirmed missing backend is sufficient to hold the live switch even without treating every diagnostic as a runtime defect.

## Suggested release sequence

1. Freeze a reviewed candidate on a separate branch/checkout, including required assets, backend files and dependencies. Preserve all existing work and staged hunks. Review the diff against current `main` and verify a clean install/build.
2. Prepare an isolated hosted test application and backend with synthetic shops/accounts, Stripe test credentials and controlled test inboxes. Keep checkout and email effects disabled until the matching configuration is in place. Infrastructure creation and its cost are separate implementation steps; nothing was provisioned during this assessment.
3. Deploy the exact reviewed migrations/functions/frontend to that test environment and execute the hosted acceptance runbook. Missing-price or unfinished products can remain excluded from the initial release.
4. Once the intended launch journeys pass, review the production deployment packet, domain routing, per-tenant behavior and rollback, then promote through `main` or the explicitly selected production mechanism.
5. Run a controlled production canary before accepting general customer orders. On rollback, disable new payment/email effects first, retain finalizers while payments are unsettled, and preserve paid-order/file/email history. A frontend rollback alone is not a database rollback.

A narrowly scoped marketing-page update could be assessed separately if the immediate aim is simply to refresh the public presentation. The current working tree changes checkout, accounts, admin, designer, pricing-related source and backend code as well as presentation, so it is not such a limited release.

## Evidence limits and retained artifacts

- `build.log`, `focused-tests.log`, `typecheck.log`, and `deploy-readiness.log` are retained in the local artifact directory.
- A limited scan of Git-visible text found no matching private-key blocks, live Stripe secret patterns, GitHub-token patterns or Supabase secret-key patterns; no environment files were Git-visible and no candidate file exceeded 10 MiB. This is not a comprehensive secret or history audit.
- No general claim of security, print fidelity, production order reliability, legal compliance or clean installation follows from this review.
