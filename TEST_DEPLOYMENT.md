# Webprinter domain test — 9 September 2026

This branch packages the current storefront, platform, admin, account and designer work for an online test. It is not production-order acceptance.

## Build

- Node 24 and pnpm 11.19.0.
- `pnpm install --frozen-lockfile --ignore-scripts` uses the existing pnpm dependency versions. Dependency lifecycle scripts are disabled. The stale npm lockfile is excluded from this branch.
- `pnpm run build:test` enables the visible test label and the test-interface safeguards. Vercel is explicitly configured to use this build.
- `pnpm run build` retains normal build behavior. Before a future production release, review the deployment configuration, backend requirements and acceptance results.

The test interface blocks Stripe functions, payment approval and supplier submission functions, and order-confirmation sending through the shared browser client. Checkout also stops before any payment request. These are protections against accidental actions in this interface, not new server authorization rules.

The preview uses the existing shop backend. Account login and ordinary saved changes use that backend. This is **not an isolated database sandbox**. No database migration or Edge Function is deployed by this frontend release.

The current frontend needs additional backend migrations and functions for the new payment finalizer, reliable order confirmation, some customer-account features and conflict-checked branding saves. These remain separate deployment work. Do not describe this preview as proof those operations work online.

## Online checks

Verify the platform landing, demo storefront, product/configuration handoff, empty checkout, designer launch and login screen. Use the demo link on the landing page so the shop context is explicit on the preview host. The test label explains that payments and supplier ordering are off and the shop data is shared.

Responses carry `X-Robots-Tag: noindex, nofollow, noarchive`. Existing Vercel deployment protection stays enabled. Public production domains stay assigned to their current production deployment.

## Verification before push

- Fresh frozen dependency installation passed with lifecycle scripts disabled.
- Test Vite build passed. Existing large-bundle warnings remain.
- 66 focused tests passed, including the outbound-action guard and checkout/email protocol suites.
- Explicit Data API grant checks passed for 8 local migration files; function configuration checks passed for 59 functions. These are source checks, not migration deployment.
- The broader application TypeScript backlog is not resolved by this test release.

Rollback for this frontend test is to return its alias to a prior deployment or stop using its preview URL. No backend data or production payment state is migrated by this deployment. The original working checkout and its staged changes are preserved separately.

## Protected preview routing

The test branch serves its SPA document directly for frontend routes. The production tenant SEO wrapper fetches `index.html` through a second unauthenticated server request, which returned the Vercel login document even when the outer preview request was authenticated. The test routes avoid this extra fetch; the no-index header and deployment protection remain. Production routing is unchanged on `main`.
