# Product readiness release — 2026-10-02

## Change and validation

This release brings the existing October 1 storefront, wide-format artwork and production PDF changes onto current main. It includes exact generated wide-format PDF templates, size-aware designer launches, shape/CutContour validation, artwork rotation, grouped selectors and concise material information. Gulvfolie supplier diagnostics remain available in admin pricing while hidden from product presentation.

The source-quote formulas and commercial rows are unchanged. Preparing an immutable quote snapshot avoids repeatedly validating the large matrix. The frontend and deployment-local source mirrors match. Existing main fixes for matrix row selection and fingerprinted PDF template launches are preserved.

Validation in the isolated checkout: 92 focused tests passed, TypeScript passed, frontend health reported zero new ESLint regressions, Vite production build passed, and git diff --check passed. These are local checks; hosted behavior requires release verification.

## Commercial and operational holds

Gulvfolie product is_published=true, is_ready=false, is_available_to_tenants=false; its wide-format config remains unpublished. No product flags, commercial values, database rows, migrations or Supabase Edge deployments are changed by this code release. Danish supplier delivery and final commercial prices still require review before readiness/publication.

The three-format roll-label pilot remains a Supplier Bank draft with no product import. All 153 exact source prices were refreshed on October 2 and matched the saved source quotes. Target tenant, conversion approval and Danish delivery are still required before importing/pricing/publishing.

The Salgsmapper canary reached approved artwork in the hosted checkout, with a 777.50 DKK total for A4, 1 mm Chromo, 4+0, 50 copies. Existing login was used. Delivery/payment, receipt, admin order access and production handoff remain unproved until the user supplies recipient/address and spending approval.

## Rollback

Revert this release commit and redeploy the prior main revision. No schema or data rollback is needed. The stateless /api/wide-format-template endpoint can be removed with the revert; existing uploaded template URLs remain available. Keep any order artwork or proof already created intact.

## Preview packaging repair

The first Vercel preview rejected a .ts shared-module import after transpilation. The endpoint and its two runtime dependencies now use .js specifiers, following the existing Edge endpoint convention. A transpiled-module regression test reproduced the failure before repair and verifies actual PDF output, HEAD, invalid input and method rejection after repair. No runtime or routing change was required.

Run the source suite with `node --import ./scripts/tests/typescript-source-hooks.mjs --test ...`; the hook resolves deployment-style .js imports to their TypeScript sources for native Node tests. The packaging regression separately runs emitted JavaScript without that fallback.
