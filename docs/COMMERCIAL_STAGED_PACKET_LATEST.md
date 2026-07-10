# Commercial Staged Packet Report

Generated: 2026-07-10T01:18:29.736Z
Git staged command: `git diff --cached --name-status`
Git status command: `git status --short --branch`
Branch: ## ui-cleanup...origin/ui-cleanup [behind 1]
Status: PASS

This is a local, read-only staged-packet artifact. It does not stage, unstage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Review Summary

Staged entries: 127
Forbidden staged files: 0
Staged file drift: 0
Deployable Supabase staged entries: 4
Held outside staged packet: 7
Branch behind remote: yes

## Staged Bucket Counts

| Bucket | Entries | Review meaning |
| --- | ---: | --- |
| application-source | 73 | Runtime source changes that need build and tenant browser proof. |
| commercial-proof-chain | 41 | Cockpit, proof scripts, generated commercial reports or package wiring. |
| release-infrastructure | 3 | Reviewed release, deploy or CI infrastructure used by the current packet. |
| supabase-deployable | 4 | Deploy-review migrations or Edge Functions with grant/function checks. |
| supplier-bank-evidence | 6 | Reviewed Supplier Bank runbooks, reports, candidate blueprints or tooling for the current platform goal. |

## Guardrail Checks

| Status | Guardrail | Evidence |
| --- | --- | --- |
| PASS | Forbidden staged files | Forbidden staged files: 0. |
| PASS | Staged file drift | Staged file drift: 0. |
| PASS | Core pricing source | Core pricing/POD guardrails checked against staged paths. |
| PASS | POD source | POD runtime/admin paths are not staged in this packet. |
| PASS | Supabase held outside staged packet | Local/temp Supabase artifacts remain visible outside the staged deployable packet. |

## Staged Files

| Status | Bucket | Path |
| --- | --- | --- |
| M | commercial-proof-chain | `.agent/HANDOVER.md` |
| A | release-infrastructure | `.github/workflows/supabase-data-api-grants.yml` |
| M | commercial-proof-chain | `.gitignore` |
| A | release-infrastructure | `.vercelignore` |
| M | commercial-proof-chain | `AI_CONTINUITY.md` |
| M | commercial-proof-chain | `HANDOVER.md` |
| M | supplier-bank-evidence | `config/supplier-bank/sources.json` |
| A | commercial-proof-chain | `docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_CHANGESET_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_PROOF_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_RELEASE_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_RELEASE_PACKET_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_STAGED_PACKET_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_SUPABASE_LATEST.md` |
| A | commercial-proof-chain | `docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md` |
| M | supplier-bank-evidence | `docs/PIXART_IMPORT_RUNBOOK.md` |
| M | commercial-proof-chain | `docs/PRICING_READ_API.md` |
| M | commercial-proof-chain | `docs/PRODUCT_DETAIL_READ_API.md` |
| A | supplier-bank-evidence | `docs/SUPPLIER_BANK_STATUS_REPORT_20260710-025335.md` |
| A | supplier-bank-evidence | `docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md` |
| A | supplier-bank-evidence | `docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md` |
| M | commercial-proof-chain | `docs/WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md` |
| M | commercial-proof-chain | `package-lock.json` |
| M | commercial-proof-chain | `package.json` |
| A | release-infrastructure | `pnpm-lock.yaml` |
| A | commercial-proof-chain | `scripts/check-commercial-application-source.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-branch-freshness.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-changeset.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-deploy-readiness.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-owner-merge-readiness.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-proof-report.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-proof.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-readiness-bindings.js` |
| A | commercial-proof-chain | `scripts/check-commercial-release-handoff.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-release-owner-sequence.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-release-packet.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-release-report.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-release.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-staged-packet.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-supabase.mjs` |
| A | commercial-proof-chain | `scripts/check-commercial-upstream-reconciliation.mjs` |
| M | commercial-proof-chain | `scripts/check-supabase-function-exposure.js` |
| A | commercial-proof-chain | `scripts/check-tenant-proof-routes.mjs` |
| M | supplier-bank-evidence | `scripts/supplier-bank-cli.mjs` |
| M | application-source | `src/App.tsx` |
| M | application-source | `src/components/Banner2Showcase.tsx` |
| M | application-source | `src/components/Footer.tsx` |
| M | application-source | `src/components/Header.tsx` |
| M | application-source | `src/components/HeroSlider.tsx` |
| M | application-source | `src/components/ProductGrid.tsx` |
| M | application-source | `src/components/ProductMarquee.tsx` |
| M | application-source | `src/components/SEO.tsx` |
| M | application-source | `src/components/StorefrontProductTabs.tsx` |
| M | application-source | `src/components/TemplatesDownloadSection.tsx` |
| A | application-source | `src/components/account/AccountLoadingShell.tsx` |
| M | application-source | `src/components/admin/BannerEditor.tsx` |
| M | application-source | `src/components/admin/Dashboard.tsx` |
| M | application-source | `src/components/admin/LogoSection.tsx` |
| M | application-source | `src/components/admin/OrderManager.tsx` |
| M | application-source | `src/components/admin/ProductAboutSection.tsx` |
| M | application-source | `src/components/admin/ProductAttributeBuilder.tsx` |
| M | application-source | `src/components/admin/ProductOverview.tsx` |
| M | application-source | `src/components/admin/ProductPriceManager.tsx` |
| M | application-source | `src/components/admin/SiteDesignEditorV2.tsx` |
| M | application-source | `src/components/admin/SiteDesignPreviewFrame.tsx` |
| M | application-source | `src/components/admin/TenantSiteDesignV2.tsx` |
| M | application-source | `src/components/admin/ThemeSelector.tsx` |
| M | application-source | `src/components/consent/CookieBanner.tsx` |
| M | application-source | `src/components/consent/CookieSettingsDialog.tsx` |
| M | application-source | `src/components/content/ContactContent.tsx` |
| M | application-source | `src/components/content/ProductPriceContent.tsx` |
| M | application-source | `src/components/designer/EditorCanvas.tsx` |
| M | application-source | `src/components/designer/LayerPanel.tsx` |
| M | application-source | `src/components/designer/PDFImportModal.tsx` |
| A | application-source | `src/components/designer/PdfToolsPanel.tsx` |
| M | application-source | `src/components/platform/PlatformHeader.tsx` |
| M | application-source | `src/components/platform/PlatformSlider.tsx` |
| M | application-source | `src/components/product-price-page/DynamicProductOptions.tsx` |
| M | application-source | `src/components/product-price-page/MatrixLayoutV1Renderer.tsx` |
| M | application-source | `src/components/product-price-page/PriceMatrix.tsx` |
| M | application-source | `src/components/product-price-page/ProductPricePanel.tsx` |
| M | application-source | `src/components/product-price-page/StaticProductInfo.tsx` |
| M | application-source | `src/components/sites/SitePackagePreview.tsx` |
| M | application-source | `src/components/storefront/StorefrontHomeContent.tsx` |
| M | application-source | `src/components/storefront/StorefrontSeo.tsx` |
| M | application-source | `src/components/storefront/StorefrontThemeFrame.tsx` |
| M | application-source | `src/contexts/PreviewBrandingContext.tsx` |
| M | application-source | `src/hooks/useBrandingDraft.ts` |
| M | application-source | `src/hooks/useStorefrontCatalog.ts` |
| M | application-source | `src/lib/checkout/siteCheckoutSession.ts` |
| M | application-source | `src/lib/designer/export/exportVectorPdfBackground.ts` |
| M | application-source | `src/lib/designer/export/hideExportGuides.ts` |
| M | application-source | `src/lib/designer/productTemplateLinks.ts` |
| M | application-source | `src/lib/platform-seo/metadata.ts` |
| A | application-source | `src/lib/seo/domHead.ts` |
| M | application-source | `src/lib/siteDesignTargets.ts` |
| A | application-source | `src/lib/sites/productSiteModes.ts` |
| M | application-source | `src/lib/sites/sitePackages.ts` |
| A | application-source | `src/lib/sites/storefrontProductFlow.ts` |
| M | application-source | `src/lib/supplier-bank/sourceRegistry.ts` |
| M | application-source | `src/pages/Designer.tsx` |
| M | application-source | `src/pages/FileUploadConfiguration.tsx` |
| M | application-source | `src/pages/Index.tsx` |
| M | application-source | `src/pages/MyAccount.tsx` |
| M | application-source | `src/pages/MyAddresses.tsx` |
| M | application-source | `src/pages/MyOrders.tsx` |
| M | application-source | `src/pages/MySettings.tsx` |
| M | application-source | `src/pages/ProductPrice.tsx` |
| M | commercial-proof-chain | `src/pages/admin/CommercialReadiness.tsx` |
| M | application-source | `src/pages/admin/SitesAdmin.tsx` |
| M | application-source | `src/pages/admin/SupplierBank.tsx` |
| A | application-source | `src/styles/storefrontVisualStyles.css` |
| M | application-source | `src/themes/classic/components/ClassicShopLayout.tsx` |
| M | application-source | `src/themes/glassmorphism/components/GlassBanner2.tsx` |
| M | application-source | `src/themes/glassmorphism/components/GlassShopLayout.tsx` |
| A | application-source | `src/themes/taste-style-themes.ts` |
| M | application-source | `src/utils/productCategories.ts` |
| M | supabase-deployable | `supabase/config.toml` |
| M | supabase-deployable | `supabase/functions/pricing-read/index.ts` |
| M | supabase-deployable | `supabase/functions/product-detail-read/index.ts` |
| A | supabase-deployable | `supabase/migrations/20260509120000_index_generic_product_prices_lookup.sql` |
| M | application-source | `vite.config.ts` |


## Held Outside Staged Packet

| Status | Path | Reason |
| --- | --- | --- |
| A | `.github/workflows/supabase-data-api-grants.yml` | Local tooling or repository automation outside this release packet. |
| M | `supabase/.temp/cli-latest` | Local Supabase CLI state. |
| ?? | `.agents/` | Local tooling or repository automation outside this release packet. |
| ?? | `.codex/` | Local tooling or repository automation outside this release packet. |
| ?? | `deno.lock` | Local dependency lock change outside the reviewed packet. |
| ?? | `supabase/config 2.toml` | Space-suffixed duplicate config. |
| ?? | `supabase/functions/test-env/index 2.ts` | Space-suffixed test/debug Edge Function file. |

## Required Verification

- `npm run check:commercial-staged-packet` must pass before a push/deploy decision uses the staged packet.
- `git diff --cached --check` must pass before commit.
- `npm run check:commercial-release` must pass after report regeneration.
- Held files such as `supabase/.temp/cli-latest`, `supabase/config 2.toml` and `supabase/functions/test-env/index 2.ts` must stay outside the staged packet unless explicitly approved.
