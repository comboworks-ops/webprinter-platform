# GetStack + Superpowers Step Report - 2026-06-27

This report consolidates the current project hardening status, what is still
lacking, and the step-by-step path to make the platform safer and more
production-ready.

Prepared using:

- Superpowers process discipline: explicit plan, staged work, verification gates.
- GetStack-style review discipline: correctness, security, architecture,
  interface contracts, and operational pragmatism.

## Current State

Latest focused hardening commit:

- `1a7e14b fix: harden supabase edge function exposure`

Phase 1 completed:

- Shared Supabase Edge Function helpers were added:
  - `supabase/functions/_shared/http.ts`
  - `supabase/functions/_shared/auth.ts`
  - `supabase/functions/_shared/localOnly.ts`
- Local/dev-only functions are now guarded:
  - `create-admin-user`
  - `seed-folder-prices`
  - `seed-generic-prices`
  - `seed-product-prices`
  - `setup-schema`
  - `test-env`
- `test-env` no longer returns secret previews or lengths.
- All 50 observed Supabase function directories now have explicit
  `verify_jwt` decisions in `supabase/config.toml`.
- Static checker added:
  - `scripts/check-supabase-function-exposure.js`
  - package script: `check:supabase-functions`
- Review docs and Superpowers plan exist:
  - `docs/SYSTEM_REVIEW_RECOMMENDATIONS_2026-06-27.md`
  - `docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md`
  - `docs/superpowers/plans/2026-06-27-edge-function-hardening-phase-1.md`

Verification already performed:

- Supabase function exposure checker passed for 50 functions.
- Direct Vite production build passed.
- `pnpm run build` could not be used in the Codex shell because bundled pnpm
  stopped on dependency build-script approval. Direct Vite build against the
  existing dependencies succeeded.

Important workspace condition:

- The branch still contains many unrelated uncommitted changes.
- The Phase 1 hardening work was committed separately.
- New conflict-style untracked files are present and should be reviewed before
  cleanup:
  - `supabase/config 2.toml`
  - `supabase/functions/test-env/index 2.ts`

## Executive Assessment

The product direction is coherent:

- Multi-tenant storefronts
- Tenant branding and site design
- Product pricing and checkout
- Online designer
- PDF import/edit/export foundation
- POD/POD v2 supplier workflows
- SEO and platform tooling

The main problem is not missing features. The main problem is that several
trust boundaries still need to move from "development-friendly" to
"production-defensible."

The highest priority remaining work is:

1. Server-side checkout amount calculation.
2. PDF service input ownership, size limits, and URL restrictions.
3. Server-verified admin role handling in the frontend.
4. Content sanitization policy for tenant-rendered HTML.
5. Supplier API key handling moved server-side.
6. Tests and CI gates for the critical flows.
7. Workspace cleanup, after safety-critical items are isolated.

## What Is Lacking

### 1. Checkout Still Trusts Browser Amounts

Files:

- `supabase/functions/stripe-create-payment-intent/index.ts`
- `src/pages/FileUploadConfiguration.tsx`

Current issue:

- The browser sends `tenant_id` and `amount_ore`.
- The Edge Function creates a Stripe PaymentIntent from that amount.
- A modified client can underpay unless server-side validation blocks it later.

What is needed:

- Implemented: the frontend sends a structured `checkout_quote`.
- Implemented: `stripe-create-payment-intent` recalculates product price through
  `pricing-read`, verifies selected option IDs against assigned product option
  groups, resolves delivery, and rejects client/server amount mismatches.
- Implemented: Stripe metadata records the server-calculated product, option,
  delivery, pricing source, and matched price-row values.
- Remaining: add dedicated tests for tampered quantities, options, and delivery
  IDs when an Edge Function test harness is available.

Definition of done:

- `amount_ore` is no longer accepted as authoritative input.
- Edge Function computes amount or validates a signed quote/order token.
- Tests prove a tampered amount cannot create an underpriced PaymentIntent.

### 2. PDF Services Need One More Contract Step

Files:

- `supabase/functions/designer-pdf-service/index.ts`
- `supabase/functions/pod2-pdf-preflight/index.ts`

Status:

- Initial hardening is implemented: both services require an authenticated user,
  reject non-HTTPS/private hosts, enforce PDF header checks, and apply file size
  limits.
- `pod2-pdf-preflight` also verifies product tenant access before service-role
  supplier calls or storage overwrites.
- Implemented: `pod2-pdf-preflight` now accepts storage path input and creates a
  short-lived signed URL server-side for Print.com preflight.
- Implemented: `designer-pdf-service` can read PDFs from allowed Supabase
  storage buckets server-side.
- Implemented: lightweight per-instance Edge Function rate limits are applied to
  Stripe checkout and both PDF services.
- Remaining: replace the in-memory limiter with a persistent distributed limit
  if traffic grows or abuse appears.

What is needed:

- Prefer the storage-path contracts in new callers; keep remote URL support only
  for controlled compatibility paths.
- Add persistent rate limits before enabling heavier OCR/compress/PDF-A
  providers.
- Add strict max file size.
- Add allowed MIME/content-type checks.
- Block private/internal network URLs.
- Add operation allowlist.
- Disable auto-fix overwrite unless ownership and expected path are verified.

Definition of done:

- Server-side PDF functions process only caller-owned or tenant-authorized
  storage objects.
- Arbitrary remote URL fetch is removed or tightly allowlisted.
- Large PDFs are rejected before processing.
- Tests cover unauthorized file access and oversize input.

### 3. Frontend Admin Role Fallback Is Still Too Trusting

File:

- `src/hooks/useUserRole.tsx`

Current issue:

- `EMAIL_ROLE_MAP` can set `serverVerified = true`.
- This allows the UI to treat known emails as verified admin without completing
  the normal role fetch.

What is needed:

- Remove the client-side email whitelist or make it strictly non-verified.
- Use `verify-admin` or a server-verified role contract for admin UI gating.
- Keep lockout recovery as an operational tool, not browser logic.

Definition of done:

- `serverVerified` only becomes true after server/database verification.
- Known-email fallback cannot expose admin UI by itself.
- Admin pages continue to load for valid admins.

### 4. Tenant HTML Rendering Has No Central Sanitization Contract

Files:

- `src/themes/glassmorphism/components/GlassContentBlock.tsx`
- `src/themes/classic/components/ClassicContentBlock.tsx`

Current issue:

- Tenant/content blocks use `dangerouslySetInnerHTML`.
- There is no visible central policy that defines trusted HTML vs plain text.

What is needed:

- A single sanitization module for tenant content.
- A documented field policy:
  - plain text fields
  - safe rich text fields
  - admin-only trusted fields, if any
- Sanitization on write, render, or both.

Definition of done:

- Content blocks call one sanitizer before rendering HTML.
- Tests prove scripts/events/unsafe URLs are stripped.
- The policy is documented in system docs.

### 5. Supplier API Keys Are Not Properly Server-Owned

Files:

- `src/lib/pod/hooks.ts`
- `src/lib/pod2/hooks.ts`

Current issue:

- Browser-side code assigns `api_key` to `api_key_encrypted`.
- Comments indicate production encryption should happen server-side.

What is needed:

- Move supplier credential writes to an Edge Function.
- Encrypt or otherwise protect credentials server-side.
- Restrict reads to service-role execution paths.
- Return presence/status to the frontend, not secret values.

Definition of done:

- Browser never writes raw supplier API keys directly to database tables.
- Database field naming reflects actual storage behavior.
- Existing supplier workflows still submit orders correctly.

### 6. Edge Function Auth Is Not Yet Consistent Everywhere

Phase 1 added shared helpers, but most functions still have their own local
auth patterns.

What is needed:

- Gradual migration to shared helpers:
  - `requireUser`
  - `requireRole`
  - local JSON response helpers
- Standard error shape.
- Standard role/tenant ownership semantics.

Definition of done:

- Admin/service-role functions use consistent auth helpers.
- No function trusts caller-provided user headers.
- Function checker stays green.

### 7. Testing and CI Are Still Thin

Current issue:

- There is no clear full test script.
- Full lint is noisy.
- Build can pass, but critical flows lack targeted regression coverage.

What is needed:

- Add focused smoke tests before broad refactors.
- Start with revenue/security paths, not visual polish.

Minimum test set:

- Supabase function exposure checker.
- Stripe checkout tamper prevention.
- Admin role verification.
- PDF import/edit/export smoke flow.
- PDF service rejects unauthorized or oversize inputs.
- Storefront product page renders with tenant context.

Definition of done:

- One command can run the critical smoke suite.
- CI blocks deployment if function exposure checker fails.
- Build remains green.

### 8. Workspace Hygiene Needs Cleanup

Current issue:

- The workspace contains many unrelated active edits.
- Several duplicate/conflict-style files exist.
- There are backup files inside `src` and root-level handoff/doc duplicates.

Do not clean this up casually.

What is needed:

- A dedicated cleanup branch.
- `git ls-files` checks before deleting anything.
- Human confirmation for tracked duplicate removals.

Known cleanup candidates:

- `src/components/content/PrivacyPolicyContent 2.tsx`
- `src/components/content/TermsContent 2.tsx`
- `src/pages/admin/Pod2Katalog 2.tsx`
- `src/backup-2026-01-11-product-config/*`
- `supabase/config 2.toml`
- `supabase/functions/test-env/index 2.ts`
- `HANDOVER 2.md`
- generated `dist-check-*`
- duplicate files under `node_modules`

Definition of done:

- Cleanup commit contains only cleanup.
- No product, pricing, or POD behavior changes are included.
- Build still passes.

## Recommended Step-by-Step Roadmap

### Step 0: Stabilize Branch and Review Phase 1

Goal:

- Confirm the committed hardening work is acceptable before building on it.

Actions:

1. Review commit `1a7e14b`.
2. Run:
   - `npm run check:supabase-functions`
   - `npm run build` or direct Vite build if local pnpm blocks.
3. Confirm whether `supabase/config.toml` exposure decisions are correct for
   the deployed environment.

Output:

- A reviewed Phase 1 commit.
- Decision on whether to push/open PR.

### Step 1: Checkout Amount Hardening

Goal:

- Stop trusting browser-provided Stripe amounts.

Files likely touched:

- `supabase/functions/stripe-create-payment-intent/index.ts`
- `src/pages/FileUploadConfiguration.tsx`
- existing pricing helpers used by checkout/product pages
- possible new shared pricing/checkout validator module

Implementation shape:

1. Define a new request shape:
   - `tenant_id`
   - `product_id` or `product_slug`
   - `quantity`
   - selected option IDs/values
   - uploaded file path
   - delivery selection
   - customer metadata
2. Server resolves product and tenant.
3. Server calculates authoritative amount.
4. Server creates PaymentIntent using calculated amount.
5. Response returns calculated amount and client secret.

Verification:

- Test valid checkout.
- Test tampered lower amount is ignored or rejected.
- Test wrong tenant/product pairing is rejected.

Risk:

- High business impact. Do this in a focused branch.
- Do not change pricing formulas unless explicitly approved.

### Step 2: PDF Service Hardening

Goal:

- Make PDF service safe enough for deployment.

Files likely touched:

- `supabase/functions/designer-pdf-service/index.ts`
- `supabase/functions/pod2-pdf-preflight/index.ts`
- `src/lib/designer/pdfService.ts`
- PDF tool UI only if request contract changes

Implementation shape:

1. Require verified user.
2. Accept storage path/object ID instead of arbitrary `pdfUrl`.
3. Resolve tenant/file ownership server-side.
4. Add max byte size.
5. Add content-type and PDF signature checks.
6. Disable remote fetch except for explicitly allowlisted storage/public
   Supabase URLs.
7. Separate `inspect` from mutation operations.
8. Keep heavy operations marked external-provider-required until real provider
   integration exists.

Verification:

- Authorized PDF inspect succeeds.
- Unauthorized file path fails.
- Oversize PDF fails.
- Remote non-storage URL fails.
- Browser fallback still works.

Risk:

- Medium/high because file storage and print workflow are involved.
- Keep separate from POD v2 preflight behavior unless explicitly changing POD.

### Step 3: Admin Role Verification Cleanup

Goal:

- Remove browser-side role trust shortcuts.

Files likely touched:

- `src/hooks/useUserRole.tsx`
- `supabase/functions/verify-admin/index.ts`
- admin route guard components/pages

Implementation shape:

1. Keep `verify-admin` as server source of truth.
2. In `useUserRole`, make email fallback non-verified or remove it.
3. Ensure admin routes wait for server verification.
4. Preserve tenant-context masking for master admin where needed.

Verification:

- Valid master admin sees platform tools.
- Valid tenant admin sees tenant tools.
- Unknown user cannot see admin tools.
- Network failure does not grant admin.

Risk:

- Medium. Can temporarily lock out admins if done carelessly.
- Keep a server-side/admin recovery path, not browser whitelist.

### Step 4: Tenant HTML Sanitization

Goal:

- Prevent tenant/content XSS while preserving intended rich text.

Files likely touched:

- new sanitizer module, for example `src/lib/content/sanitizeHtml.ts`
- `src/themes/glassmorphism/components/GlassContentBlock.tsx`
- `src/themes/classic/components/ClassicContentBlock.tsx`
- tests for sanitizer behavior

Implementation shape:

1. Define allowed tags and attributes.
2. Sanitize before `dangerouslySetInnerHTML`.
3. Document which fields allow rich HTML.
4. Add tests for unsafe input.

Verification:

- `<script>` is removed.
- inline event handlers are removed.
- unsafe URLs are removed.
- normal formatting remains.

Risk:

- Medium. Could affect tenant content rendering if allowed tags are too strict.

### Step 5: Supplier Credential Handling

Goal:

- Move supplier API key writes out of browser code.

Files likely touched:

- `src/lib/pod/hooks.ts`
- `src/lib/pod2/hooks.ts`
- new or existing Supabase Edge Function for supplier connection updates
- database docs if encryption/storage policy changes

Implementation shape:

1. Frontend submits credential to authenticated Edge Function.
2. Edge Function verifies master/admin role.
3. Edge Function stores protected credential.
4. Frontend receives only status/presence.
5. Supplier proxy/order functions read credentials server-side.

Verification:

- Frontend cannot read stored key.
- Update connection works.
- POD/POD v2 supplier request still works.

Risk:

- Medium/high because supplier fulfillment depends on credentials.

### Step 6: Function Auth Helper Migration

Goal:

- Reduce divergent auth logic across Supabase functions.

Files likely touched:

- selected Supabase functions with existing auth checks
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/http.ts`

Implementation shape:

1. Migrate one function family at a time:
   - Stripe Connect
   - POD/POD2 admin functions
   - SEO/platform functions
2. Keep behavior equivalent.
3. Add static checks for forbidden patterns where practical:
   - untrusted `x-user-id`
   - missing role verification in service-role mutation functions

Verification:

- Function exposure checker passes.
- Existing admin/POD flows pass smoke tests.

Risk:

- Medium. This is mostly refactor, so do it in small commits.

### Step 7: Critical Smoke Test Layer

Goal:

- Add a minimal test suite that protects core business flows.

Files likely touched:

- `package.json`
- `tests/` or `scripts/`
- Playwright smoke tests if browser flows are used
- function-level Node/Deno tests where practical

Implementation shape:

1. Add `check:critical`.
2. Include:
   - function exposure checker
   - admin role verification test/mocking
   - checkout amount tamper test
   - PDF designer smoke test
   - storefront render smoke test
3. Keep test data local or mocked where possible.

Verification:

- `npm run check:critical` runs locally.
- CI can run the same command.

Risk:

- Low/medium. Main risk is flaky browser tests. Keep the first suite small.

### Step 8: Workspace Cleanup

Goal:

- Remove duplicate/conflict artifacts without changing product behavior.

Actions:

1. List tracked cleanup candidates:
   - `git ls-files | rg " 2\\.|backup-2026|HANDOVER 2"`
2. List untracked cleanup candidates:
   - `git status --short`
3. Confirm each category before deletion.
4. Delete only after confirmation.
5. Run build.
6. Commit cleanup separately.

Verification:

- Build passes.
- No product/pricing/POD behavior changes.
- Git diff contains only removals or doc/archive movement.

Risk:

- Medium. Cleanup can accidentally remove user work if not reviewed.

### Step 9: Module Size and Maintainability

Goal:

- Reduce risk in large UI/admin modules without broad rewrites.

High-size modules to address gradually:

- `src/components/admin/ProductAttributeBuilder.tsx`
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/admin/BrandingEditorV2.tsx`
- `src/components/admin/ProductPriceManager.tsx`
- `src/pages/FileUploadConfiguration.tsx`
- `src/pages/Designer.tsx`
- `src/components/Header.tsx`

Implementation shape:

1. Extract pure helpers first.
2. Extract data hooks second.
3. Extract focused controls/panels only when touching the workflow.
4. Add tests around extracted helpers.

Verification:

- Existing UI behavior unchanged.
- Build passes.
- New helper tests pass.

Risk:

- Medium. Avoid broad refactors without tests.

## Suggested Next Three Commits

### Commit 1: Review/PR Phase 1

Purpose:

- Push or PR the existing hardening commit.

Include:

- Commit `1a7e14b`

Verification:

- `npm run check:supabase-functions`
- production build

### Commit 2: Server-side Checkout Contract

Purpose:

- Make Stripe PaymentIntent amount server-authoritative.

Include:

- Updated `stripe-create-payment-intent`
- Updated checkout caller
- Tests or scripted tamper check

Verification:

- Valid checkout succeeds.
- Tampered amount cannot underpay.

### Commit 3: PDF Service Ownership Guard

Purpose:

- Make PDF service safe before deployment.

Include:

- Auth guard
- storage path ownership validation
- max size checks
- remote URL restriction

Verification:

- Authorized inspect succeeds.
- unauthorized/oversize/remote unsafe input fails.

## Deployment Checklist

Before deploying the hardening work:

1. Confirm all intended public functions still work with current
   `verify_jwt` settings.
2. Confirm frontend `supabase.functions.invoke(...)` calls include expected
   authorization headers.
3. Run:
   - `npm run check:supabase-functions`
   - production build
4. Review Supabase dashboard deployed function list.
5. Confirm no local/dev-only functions are exposed as normal production tools.
6. Confirm secrets are not printed in logs or diagnostics.
7. Confirm Stripe webhook remains no-JWT and signature-verified.

## Priority Summary

Immediate:

1. Push/PR Phase 1 hardening.
2. Fix Stripe amount authority.
3. Harden PDF service inputs.

Next:

4. Remove verified admin email fallback.
5. Add tenant HTML sanitization.
6. Move supplier credential writes server-side.

Then:

7. Migrate remaining Edge Functions to shared auth helpers.
8. Add critical smoke tests.
9. Clean duplicate/conflict artifacts.
10. Gradually split large modules when touching those workflows.

## Recommended Decision

Do not start with UI polish or new product features.

Start with checkout authority and file/PDF boundaries. Those are the areas
where a production mistake can directly affect money, customer files, supplier
workflow, or tenant trust.
