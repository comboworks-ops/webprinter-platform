# System Review Recommendations - 2026-06-27

This is a non-destructive review of the Webprinter/Printmaker codebase from
three angles:

- CEO/product: where the product should concentrate next.
- Engineering: where complexity and maintenance risk are accumulating.
- Security/commercial correctness: where trust boundaries need hardening before
  production reliance.

No cleanup or behavior changes were performed as part of this review.

## Executive Summary

The platform has the shape of a serious multi-tenant print product: storefronts,
tenant branding, pricing, checkout, online designer, POD/POD v2, SEO tooling,
and the new PDF designer foundation all point in a coherent direction.

The biggest risk is not lack of features. It is that several sensitive paths
are still in a development-friendly state: service-role edge functions, seed
functions, client-calculated Stripe amounts, local admin fallbacks, and very
large UI modules. The next highest-value work is to harden the money/auth/file
boundaries, then reduce project noise so future changes become safer.

Recommended strategy:

1. Protect revenue and admin boundaries first.
2. Keep PDF designer work additive and separate from POD v2.
3. Clean tracked duplicate/source artifacts only after an explicit cleanup
   branch.
4. Split large modules gradually at touched workflow boundaries.
5. Add smoke tests around checkout, designer PDF import/export, admin gating,
   and tenant storefront rendering.

Related hardening inventory:
- `docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md`

Phase 1 hardening status:
- See `docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md`.
- Local/dev-only Edge Functions are guarded in code.
- Supabase function exposure is explicit in `supabase/config.toml`.
- Remaining high-risk work is Stripe server-side amount calculation and
  PDF-service input ownership.

## Critical / High Priority Findings

### 1. Service-role admin creation function needs an explicit gate

File: `supabase/functions/create-admin-user/index.ts`

Function inventory:
- `docs/SUPABASE_FUNCTION_SECURITY_INVENTORY_2026-06-27.md`

The function uses `SUPABASE_SERVICE_ROLE_KEY`, accepts `email` and `password`,
creates or reuses an auth user, then upserts an `admin` role. Phase 1 added a
local-only guard and a verified `master_admin` role gate.

Risk:

- If this function is deployed as a normal production endpoint, it remains a
  sensitive admin creation tool and should stay guarded.
- CORS is open with `Access-Control-Allow-Origin: *`.

Recommended fix:

- Keep the strict master-admin/server-secret gate before any user creation.
- Consider moving this function out of deployable production functions later.
- Centralize edge-function auth helpers so service-role functions share the
  same verification pattern.

Relevant lines:

- `supabase/functions/create-admin-user/index.ts:5`
- `supabase/functions/create-admin-user/index.ts:20`
- `supabase/functions/create-admin-user/index.ts:44`
- `supabase/functions/create-admin-user/index.ts:58`

### 2. Seed functions can mutate production pricing/data if exposed

File: `supabase/functions/seed-product-prices/index.ts`

The seed function uses the service role and performs broad upserts into pricing
tables. It also deletes rows from `sticker_rates` before reseeding.

Risk:

- Accidental invocation could overwrite or delete production pricing data.
- This conflicts with the repo rule: do not modify pricing without explicit
  approval.

Recommended fix:

- Move seed functions out of `supabase/functions` if they are local-only tools.
- If they must remain, require a master-admin check plus a deployment secret,
  and add a hard production guard.

Relevant lines:

- `supabase/functions/seed-product-prices/index.ts:3`
- `supabase/functions/seed-product-prices/index.ts:89`
- `supabase/functions/seed-product-prices/index.ts:93`

### 3. Stripe PaymentIntent trusts client-provided amount and tenant

Files:

- `supabase/functions/stripe-create-payment-intent/index.ts`
- `src/pages/FileUploadConfiguration.tsx`

The edge function accepts `tenant_id` and `amount_ore` from the request body and
uses that amount to create a Stripe PaymentIntent. The frontend computes
`amount_ore` from `checkoutTotal`.

Risk:

- A modified client can submit a lower amount or mismatched tenant.
- Commercial correctness should live server-side, not in the browser.

Recommended fix:

- Implemented: `stripe-create-payment-intent` requires a structured
  `checkout_quote`, recalculates product price through `pricing-read`, verifies
  selected option IDs against product option groups, resolves delivery, and
  rejects mismatched client totals.
- Browser totals should continue to be treated as display-only.
- Remaining: add focused Edge Function tests for tampered quantity, option, and
  delivery inputs.

Relevant lines:

- `supabase/functions/stripe-create-payment-intent/index.ts:24`
- `supabase/functions/stripe-create-payment-intent/index.ts:26`
- `supabase/functions/stripe-create-payment-intent/index.ts:66`
- `src/pages/FileUploadConfiguration.tsx:1113`
- `src/pages/FileUploadConfiguration.tsx:1123`

### 4. Client-side admin email fallback should not mark roles as verified

File: `src/hooks/useUserRole.tsx`

The hook contains an `EMAIL_ROLE_MAP` and skips the database role fetch for
listed emails, setting `serverVerified` to true.

Risk:

- Client UI can expose admin paths based on email alone.
- RLS may still protect data, but the UI trust model becomes confusing and can
  hide real authorization bugs.

Recommended fix:

- Remove the client-side role whitelist before launch, or only use it as a
  temporary visual fallback while still completing server verification.
- Prefer a `verify-admin` edge function or signed role claims for admin gating.

Relevant lines:

- `src/hooks/useUserRole.tsx:7`
- `src/hooks/useUserRole.tsx:12`
- `src/hooks/useUserRole.tsx:66`
- `src/hooks/useUserRole.tsx:70`

### 5. PDF service endpoints need storage-contract hardening before broad use

Files:

- `supabase/functions/pod2-pdf-preflight/index.ts`
- `supabase/functions/designer-pdf-service/index.ts`

The POD v2 preflight and designer PDF functions now require authenticated
callers, reject non-HTTPS/private-host URLs, apply PDF header checks, enforce
file size limits, and apply lightweight per-instance rate limits. POD v2
preflight also verifies product tenant access before supplier calls or
service-role storage overwrites, and now creates short-lived signed URLs from
storage paths for Print.com preflight.

Risk:

- These functions are powerful file-processing boundaries.
- If deployed broadly with heavier PDF providers, replace the in-memory limiter
  with a persistent distributed limiter.

Recommended fix:

- Prefer the new storage-path contracts in callers.
- Keep remote URL support only for controlled compatibility paths.
- Add focused tests for unauthorized storage paths and oversized PDF files.

Relevant lines:

- `supabase/functions/pod2-pdf-preflight/index.ts:12`
- `supabase/functions/pod2-pdf-preflight/index.ts:39`
- `supabase/functions/pod2-pdf-preflight/index.ts:161`
- `supabase/functions/pod2-pdf-preflight/index.ts:213`
- `supabase/functions/designer-pdf-service/index.ts:23`
- `supabase/functions/designer-pdf-service/index.ts:56`
- `supabase/functions/designer-pdf-service/index.ts:65`

## Medium Priority Findings

### 6. Public or tenant-rendered HTML needs a sanitization rule

Files:

- `src/themes/glassmorphism/components/GlassContentBlock.tsx`
- `src/themes/classic/components/ClassicContentBlock.tsx`

Both render `block.content` with `dangerouslySetInnerHTML`.

Risk:

- If tenant/admin content is ever user-controlled or imported, this can become
  an XSS path.

Recommended fix:

- Define one sanitization policy for tenant content.
- Sanitize on write, on render, or both.
- Document which content fields are trusted HTML and which are plain text.

Relevant lines:

- `src/themes/glassmorphism/components/GlassContentBlock.tsx:179`
- `src/themes/classic/components/ClassicContentBlock.tsx:158`

### 7. Supplier API keys appear to be stored as plain values

Files:

- `src/lib/pod/hooks.ts`
- `src/lib/pod2/hooks.ts`

Both files assign `api_key` to `api_key_encrypted` with a comment saying to
encrypt on the server in production.

Risk:

- The column name implies encryption, but the value may be plain text.
- Supplier credentials should not be written from browser code.

Recommended fix:

- Move supplier credential write/update to a server-only edge function.
- Encrypt before storage and restrict reads to service-role code.

Relevant lines:

- `src/lib/pod/hooks.ts:120`
- `src/lib/pod2/hooks.ts:121`

### 8. Platform SEO uses a hardcoded master tenant ID

File: `src/lib/platform-seo/hooks.ts`

The file defines a local `MASTER_TENANT_ID` with a TODO. This value appears
different from the master-tenant convention used elsewhere in project docs.

Risk:

- Platform SEO data can be written to the wrong tenant scope.
- Tenant isolation bugs can be hard to see in UI testing.

Recommended fix:

- Import the canonical `MASTER_TENANT_ID` from one shared source.
- Add a small test or assertion for platform SEO tenant writes.

Relevant lines:

- `src/lib/platform-seo/hooks.ts:16`
- `src/lib/platform-seo/hooks.ts:65`
- `src/lib/platform-seo/hooks.ts:157`
- `src/lib/platform-seo/hooks.ts:230`

### 9. Quote email rate limiting relies on an untrusted header

File: `supabase/functions/send-quote-emails/index.ts`

The function requires an authorization header, but the rate-limit key comes
from `x-user-id` or falls back to `anonymous`.

Risk:

- The effective user ID can be spoofed unless Supabase or function code verifies
  it and derives the user from the JWT.
- In-memory rate limits reset per instance.

Recommended fix:

- Verify the JWT server-side and derive the user ID from the verified session.
- For abuse-sensitive forms, consider a database-backed or provider-backed rate
  limit.

Relevant lines:

- `supabase/functions/send-quote-emails/index.ts:60`
- `supabase/functions/send-quote-emails/index.ts:69`
- `supabase/functions/send-quote-emails/index.ts:72`

## Project Hygiene Findings

### 10. Tracked duplicate/conflict files live inside `src`

Observed tracked files include:

- `src/components/content/PrivacyPolicyContent 2.tsx`
- `src/components/content/TermsContent 2.tsx`
- `src/pages/admin/Pod2Katalog 2.tsx`
- `src/backup-2026-01-11-product-config/*`

Risk:

- Duplicate source files create confusion for AI agents and humans.
- Backup code inside `src` can be picked up by tooling and search.

Recommended fix:

- On a cleanup branch, move backups to `docs/archive/` or a separate archive
  outside `src`.
- Delete or archive `* 2.tsx` conflict copies after confirming the canonical
  files.

### 11. Generated/local artifacts are present in the workspace

Observed local artifacts include:

- `dist-check-*`
- `package-lock 2.json`
- timestamped `vite.config.ts.timestamp-*.mjs`
- duplicate `node_modules` files with ` 2` in their names
- `HANDOVER 2.md`

Risk:

- These are likely sync/conflict artifacts.
- They add noise to audits, search results, and future agent context.

Recommended fix:

- Do a separate cleanup pass with `git ls-files` checks before deletion.
- Reinstall `node_modules` if the duplicate dependency files came from a file
  sync conflict.

### 12. The app has very large modules that slow safe iteration

Examples observed during review:

- `src/components/admin/ProductAttributeBuilder.tsx`
- `src/components/admin/SiteDesignEditorV2.tsx`
- `src/components/admin/BrandingEditorV2.tsx`
- `src/components/admin/StorformatManager.tsx`
- `src/components/admin/ProductPriceManager.tsx`
- `src/pages/FileUploadConfiguration.tsx`
- `src/pages/Designer.tsx`
- `src/components/Header.tsx`

Risk:

- Big modules make regressions easier and code review harder.
- They also discourage adding tests because behavior is tightly coupled.

Recommended fix:

- Do not rewrite these wholesale.
- Split gradually by workflow: data hooks, pure formatting/price helpers,
  small presentational controls, and side-panel editors.
- Add tests around extracted pure helpers first.

### 13. Validation posture is too loose for the size of the product

Observed:

- No `test` script in `package.json`.
- TypeScript strictness is disabled in `tsconfig.app.json`.
- Full lint appears too noisy for practical whole-repo enforcement.
- Targeted lint on new PDF files passed; targeted lint on the larger designer
  file showed existing `any` and hook-dependency debt.

Risk:

- The product is large enough that manual testing alone will miss regressions.

Recommended fix:

- Add a small smoke-test layer first, not a giant test rewrite.
- Suggested first tests:
  - admin role gating
  - storefront product page render
  - checkout amount server recalculation
  - PDF import/edit/export flow
  - tenant branding preview render

## Product / CEO Recommendations

### Focus the roadmap around three product lanes

1. Revenue core
   - Pricing, quote generation, checkout, Stripe, orders, payment settings.
   - This must become boring and hard to break.

2. Tenant success
   - Site Design V2, tenant branding, storefront SEO, product content, template
     presets.
   - This is where Webprinter becomes a usable SaaS product rather than a custom
     one-off shop.

3. Production confidence
   - PDF designer, preflight, bleed/safe-area warnings, POD/POD v2 handoff,
     file storage, export quality.
   - This is the strongest differentiator for a print platform.

### Avoid new big feature surfaces until hardening is done

The project already has enough feature surface to sell a compelling product.
The near-term business value is reducing buyer risk:

- Can tenants trust prices?
- Can admins trust permissions?
- Can print files be checked before ordering?
- Can checkout totals be trusted?
- Can the designer save, reload, and export consistently?

## Recommended Implementation Order

1. Inventory deployed Supabase functions and mark each as production, admin-only,
   local-only, or deprecated.
2. Add auth/secret gates or undeploy high-risk service-role functions.
3. Move Stripe amount calculation server-side.
4. Replace client email role fallback with server-verified admin role checks.
5. Harden PDF service inputs before deploying the edge path.
6. Clean duplicate/conflict artifacts on a dedicated branch.
7. Add a small smoke-test suite for checkout, admin, storefront, and PDF designer.
8. Start splitting the largest modules only when actively touching those flows.

## Do Not Break Guardrails

- Do not change existing pricing logic without explicit approval.
- Do not modify POD v1 behavior.
- Keep POD v2 additive and separate from POD v1.
- Keep the PDF designer service separate from POD v2 preflight.
- Do not broaden `designer-pdf-service` beyond inspect/preflight-style work until
  rate limits and server-resolved storage inputs are added.
- Do not delete tracked duplicate files or backup folders without a cleanup
  branch and explicit confirmation.
