# Commercial Changeset Report

Generated: 2026-07-10T01:18:29.462Z
Git status command: `git status --short --branch`
Branch: ## ui-cleanup...origin/ui-cleanup [behind 1]
Status: REVIEW REQUIRED

This is a local, read-only changeset artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Review Summary

Dirty entries: 422
Tracked modified entries: 130
Untracked entries: 292
Commercial proof-chain entries: 37
Application source entries: 73
Supabase entries: 7

## Bucket Counts

| Bucket | Entries | Review meaning |
| --- | ---: | --- |
| application-source | 73 | Runtime application code that needs normal browser/build review. |
| commercial-proof-chain | 37 | Commercial cockpit, proof scripts, generated proof reports or package wiring. |
| documentation | 17 | Handover, continuity, roadmap or audit documentation. |
| local-tooling | 4 | Local agent, CI/tooling or generated support files. |
| other | 11 | Needs manual classification before release. |
| supabase | 7 | Database/functions/tooling area; review grants, RLS and deployment safety. |
| supplier-bank-evidence | 273 | Supplier Bank/Pixart evidence or planning files, not storefront runtime by itself. |

## Suggested Review Order

| Order | Bucket | Entries | Why now | Suggested verification |
| ---: | --- | ---: | --- | --- |
| 1 | commercial-proof-chain | 37 | Smallest coherent release-safety slice; proves the cockpit, reports and gates before touching broader app code. | `npm run check:commercial-release` |
| 2 | application-source | 73 | Runtime changes affect tenants and storefront behavior; review after the proof chain is trusted. | `npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof` |
| 3 | supabase | 7 | Database/functions can affect live data; review grants/RLS/function exposure before any deploy. | `npm run check:commercial-supabase:write && npm run check:supabase-grants && npm run check:supabase-functions` |
| 4 | supplier-bank-evidence | 273 | Large evidence set; keep as a separate documentation/review packet from runtime changes. | `npm run supplier-bank:doctor && npm run supplier-bank:status-report` |
| 5 | documentation | 17 | Documentation should match the reviewed implementation and not hide unresolved production risks. | `npm run check:commercial-changeset-report` |
| 6 | local-tooling | 4 | Local/tooling artifacts should be intentionally included or ignored before staging. | `git status --short --branch` |
| 7 | other | 11 | Unclassified paths need manual owner decision before they can enter a release. | `git status --short --branch` |

## Bucket Verification Commands

| Bucket | Command | Purpose |
| --- | --- | --- |
| commercial-proof-chain | `npm run check:commercial-release` | Regenerate proof, changeset, release reports and run the production build. |
| application-source | `npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof` | Generate the runtime review packet, then compile and re-run owned-tenant proof routes. |
| supabase | `npm run check:commercial-supabase:write && npm run check:supabase-grants && npm run check:supabase-functions` | Generate the Supabase review packet, then check public grants/RLS decisions and Edge Function exposure. |
| supplier-bank-evidence | `npm run supplier-bank:doctor && npm run supplier-bank:status-report` | Check Supplier Bank tooling/report visibility without writing supplier data. |
| documentation | `npm run check:commercial-readiness` | Keep documented commercial proof commands aligned with the cockpit and scripts. |
| local-tooling | `git status --short --branch` | Confirm local/tooling paths are intentionally included or ignored before staging. |
| other | `git status --short --branch` | Manually classify unowned paths before staging. |

## First Review Packet: Commercial Proof-Chain

Purpose: review the smallest coherent release-safety slice first: cockpit UI, proof scripts, npm command wiring and generated local proof artifacts.
Packet entries: 37
Hold outside first packet: 385
Suggested packet verification: `npm run check:commercial-release`
Suggested staging command preview:

```sh
git add -- \
  '.agent/HANDOVER.md' \
  '.gitignore' \
  'AI_CONTINUITY.md' \
  'HANDOVER.md' \
  'docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md' \
  'docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md' \
  'docs/COMMERCIAL_CHANGESET_LATEST.md' \
  'docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md' \
  'docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md' \
  'docs/COMMERCIAL_PROOF_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_PACKET_LATEST.md' \
  'docs/COMMERCIAL_STAGED_PACKET_LATEST.md' \
  'docs/COMMERCIAL_SUPABASE_LATEST.md' \
  'docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md' \
  'package-lock.json' \
  'package.json' \
  'scripts/check-commercial-application-source.mjs' \
  'scripts/check-commercial-branch-freshness.mjs' \
  'scripts/check-commercial-changeset.mjs' \
  'scripts/check-commercial-deploy-readiness.mjs' \
  'scripts/check-commercial-owner-merge-readiness.mjs' \
  'scripts/check-commercial-proof-report.mjs' \
  'scripts/check-commercial-proof.mjs' \
  'scripts/check-commercial-readiness-bindings.js' \
  'scripts/check-commercial-release-handoff.mjs' \
  'scripts/check-commercial-release-owner-sequence.mjs' \
  'scripts/check-commercial-release-packet.mjs' \
  'scripts/check-commercial-release-report.mjs' \
  'scripts/check-commercial-release.mjs' \
  'scripts/check-commercial-staged-packet.mjs' \
  'scripts/check-commercial-supabase.mjs' \
  'scripts/check-commercial-upstream-reconciliation.mjs' \
  'scripts/check-tenant-proof-routes.mjs' \
  'src/pages/admin/CommercialReadiness.tsx'
```

Suggested staged-file validation:

```sh
git diff --cached --name-only -- \
  '.agent/HANDOVER.md' \
  '.gitignore' \
  'AI_CONTINUITY.md' \
  'HANDOVER.md' \
  'docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md' \
  'docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md' \
  'docs/COMMERCIAL_CHANGESET_LATEST.md' \
  'docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md' \
  'docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md' \
  'docs/COMMERCIAL_PROOF_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_PACKET_LATEST.md' \
  'docs/COMMERCIAL_STAGED_PACKET_LATEST.md' \
  'docs/COMMERCIAL_SUPABASE_LATEST.md' \
  'docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md' \
  'package-lock.json' \
  'package.json' \
  'scripts/check-commercial-application-source.mjs' \
  'scripts/check-commercial-branch-freshness.mjs' \
  'scripts/check-commercial-changeset.mjs' \
  'scripts/check-commercial-deploy-readiness.mjs' \
  'scripts/check-commercial-owner-merge-readiness.mjs' \
  'scripts/check-commercial-proof-report.mjs' \
  'scripts/check-commercial-proof.mjs' \
  'scripts/check-commercial-readiness-bindings.js' \
  'scripts/check-commercial-release-handoff.mjs' \
  'scripts/check-commercial-release-owner-sequence.mjs' \
  'scripts/check-commercial-release-packet.mjs' \
  'scripts/check-commercial-release-report.mjs' \
  'scripts/check-commercial-release.mjs' \
  'scripts/check-commercial-staged-packet.mjs' \
  'scripts/check-commercial-supabase.mjs' \
  'scripts/check-commercial-upstream-reconciliation.mjs' \
  'scripts/check-tenant-proof-routes.mjs' \
  'src/pages/admin/CommercialReadiness.tsx'
```

Suggested unstaging rollback:

```sh
git restore --staged -- \
  '.agent/HANDOVER.md' \
  '.gitignore' \
  'AI_CONTINUITY.md' \
  'HANDOVER.md' \
  'docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md' \
  'docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md' \
  'docs/COMMERCIAL_CHANGESET_LATEST.md' \
  'docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md' \
  'docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md' \
  'docs/COMMERCIAL_PROOF_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md' \
  'docs/COMMERCIAL_RELEASE_PACKET_LATEST.md' \
  'docs/COMMERCIAL_STAGED_PACKET_LATEST.md' \
  'docs/COMMERCIAL_SUPABASE_LATEST.md' \
  'docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md' \
  'package-lock.json' \
  'package.json' \
  'scripts/check-commercial-application-source.mjs' \
  'scripts/check-commercial-branch-freshness.mjs' \
  'scripts/check-commercial-changeset.mjs' \
  'scripts/check-commercial-deploy-readiness.mjs' \
  'scripts/check-commercial-owner-merge-readiness.mjs' \
  'scripts/check-commercial-proof-report.mjs' \
  'scripts/check-commercial-proof.mjs' \
  'scripts/check-commercial-readiness-bindings.js' \
  'scripts/check-commercial-release-handoff.mjs' \
  'scripts/check-commercial-release-owner-sequence.mjs' \
  'scripts/check-commercial-release-packet.mjs' \
  'scripts/check-commercial-release-report.mjs' \
  'scripts/check-commercial-release.mjs' \
  'scripts/check-commercial-staged-packet.mjs' \
  'scripts/check-commercial-supabase.mjs' \
  'scripts/check-commercial-upstream-reconciliation.mjs' \
  'scripts/check-tenant-proof-routes.mjs' \
  'src/pages/admin/CommercialReadiness.tsx'
```

### Candidate Files

| Decision | Status | Path | Why it belongs in packet |
| --- | --- | --- | --- |
| INCLUDE | M | `.agent/HANDOVER.md` | Documents the commercial proof, release and application-source review commands required by the binding guard. |
| INCLUDE | M | `.gitignore` | Allows commercial proof scripts to be tracked instead of ignored. |
| INCLUDE | M | `AI_CONTINUITY.md` | Documents the commercial proof, release and application-source review commands required by the binding guard. |
| INCLUDE | M | `HANDOVER.md` | Documents the commercial proof, release and application-source review commands required by the binding guard. |
| INCLUDE | A | `docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md` | Generated runtime application-source review artifact for the second packet. |
| INCLUDE | A | `docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `docs/COMMERCIAL_CHANGESET_LATEST.md` | Generated review-bucket artifact for current dirty worktree. |
| INCLUDE | A | `docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md` | Classified as commercial proof-chain by path. |
| INCLUDE | AM | `docs/COMMERCIAL_PROOF_LATEST.md` | Generated tenant proof artifact with the 9/9 proof evidence. |
| INCLUDE | A | `docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `docs/COMMERCIAL_RELEASE_LATEST.md` | Generated release summary tying proof, changeset and build together. |
| INCLUDE | A | `docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `docs/COMMERCIAL_RELEASE_PACKET_LATEST.md` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `docs/COMMERCIAL_STAGED_PACKET_LATEST.md` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `docs/COMMERCIAL_SUPABASE_LATEST.md` | Generated Supabase review artifact with grant and function exposure checks. |
| INCLUDE | A | `docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md` | Classified as commercial proof-chain by path. |
| INCLUDE | M | `package-lock.json` | Exposes and locks the commercial proof/report npm commands. |
| INCLUDE | M | `package.json` | Exposes and locks the commercial proof/report npm commands. |
| INCLUDE | A | `scripts/check-commercial-application-source.mjs` | Generates and verifies the runtime application-source review packet. |
| INCLUDE | A | `scripts/check-commercial-branch-freshness.mjs` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `scripts/check-commercial-changeset.mjs` | Generates and verifies the dirty-worktree review packet. |
| INCLUDE | A | `scripts/check-commercial-deploy-readiness.mjs` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `scripts/check-commercial-owner-merge-readiness.mjs` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `scripts/check-commercial-proof-report.mjs` | Verifies the generated commercial proof report. |
| INCLUDE | A | `scripts/check-commercial-proof.mjs` | Runs the read-only commercial proof gate and proof report writer. |
| INCLUDE | A | `scripts/check-commercial-readiness-bindings.js` | Protects cockpit/script/report drift markers. |
| INCLUDE | A | `scripts/check-commercial-release-handoff.mjs` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `scripts/check-commercial-release-owner-sequence.mjs` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `scripts/check-commercial-release-packet.mjs` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `scripts/check-commercial-release-report.mjs` | Verifies the release summary artifact. |
| INCLUDE | A | `scripts/check-commercial-release.mjs` | Runs the release gate across proof, changeset and production build. |
| INCLUDE | A | `scripts/check-commercial-staged-packet.mjs` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `scripts/check-commercial-supabase.mjs` | Generates and verifies the Supabase review packet. |
| INCLUDE | A | `scripts/check-commercial-upstream-reconciliation.mjs` | Classified as commercial proof-chain by path. |
| INCLUDE | A | `scripts/check-tenant-proof-routes.mjs` | Runs owned-tenant browser proof routes with transient Supabase retry. |
| INCLUDE | M | `src/pages/admin/CommercialReadiness.tsx` | Shows the read-only proof chain, reports and commands in the admin cockpit. |

### Hold Outside First Packet

| Bucket | Entries | Hold reason |
| --- | ---: | --- |
| application-source | 73 | Review after proof-chain packet because these files affect runtime tenant behavior. |
| documentation | 17 | Review after implementation packet so docs match the accepted release state. |
| local-tooling | 4 | Decide intentionally whether local/tooling paths belong in source control. |
| other | 11 | Manually classify before staging. |
| supabase | 7 | Review separately with grants/RLS/function exposure checks before DB/function deploy. |
| supplier-bank-evidence | 273 | Keep as a separate evidence packet; it is large and not a runtime release slice by itself. |

## Second Review Packet: Application Source

Purpose: review the runtime application changes only after the commercial proof-chain packet is trusted. This packet can affect tenants, storefronts, designer handoff, checkout, account pages, SEO and admin operations.
Packet entries: 73
Suggested packet verification: `npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof`
Suggested staging command preview:

```sh
git add -- \
  'src/App.tsx' \
  'src/components/Banner2Showcase.tsx' \
  'src/components/Footer.tsx' \
  'src/components/Header.tsx' \
  'src/components/HeroSlider.tsx' \
  'src/components/ProductGrid.tsx' \
  'src/components/ProductMarquee.tsx' \
  'src/components/SEO.tsx' \
  'src/components/StorefrontProductTabs.tsx' \
  'src/components/TemplatesDownloadSection.tsx' \
  'src/components/account/AccountLoadingShell.tsx' \
  'src/components/admin/BannerEditor.tsx' \
  'src/components/admin/Dashboard.tsx' \
  'src/components/admin/LogoSection.tsx' \
  'src/components/admin/OrderManager.tsx' \
  'src/components/admin/ProductAboutSection.tsx' \
  'src/components/admin/ProductAttributeBuilder.tsx' \
  'src/components/admin/ProductOverview.tsx' \
  'src/components/admin/ProductPriceManager.tsx' \
  'src/components/admin/SiteDesignEditorV2.tsx' \
  'src/components/admin/SiteDesignPreviewFrame.tsx' \
  'src/components/admin/TenantSiteDesignV2.tsx' \
  'src/components/admin/ThemeSelector.tsx' \
  'src/components/consent/CookieBanner.tsx' \
  'src/components/consent/CookieSettingsDialog.tsx' \
  'src/components/content/ContactContent.tsx' \
  'src/components/content/ProductPriceContent.tsx' \
  'src/components/designer/EditorCanvas.tsx' \
  'src/components/designer/LayerPanel.tsx' \
  'src/components/designer/PDFImportModal.tsx' \
  'src/components/designer/PdfToolsPanel.tsx' \
  'src/components/platform/PlatformHeader.tsx' \
  'src/components/platform/PlatformSlider.tsx' \
  'src/components/product-price-page/DynamicProductOptions.tsx' \
  'src/components/product-price-page/MatrixLayoutV1Renderer.tsx' \
  'src/components/product-price-page/PriceMatrix.tsx' \
  'src/components/product-price-page/ProductPricePanel.tsx' \
  'src/components/product-price-page/StaticProductInfo.tsx' \
  'src/components/sites/SitePackagePreview.tsx' \
  'src/components/storefront/StorefrontHomeContent.tsx' \
  'src/components/storefront/StorefrontSeo.tsx' \
  'src/components/storefront/StorefrontThemeFrame.tsx' \
  'src/contexts/PreviewBrandingContext.tsx' \
  'src/hooks/useBrandingDraft.ts' \
  'src/hooks/useStorefrontCatalog.ts' \
  'src/lib/checkout/siteCheckoutSession.ts' \
  'src/lib/designer/export/exportVectorPdfBackground.ts' \
  'src/lib/designer/export/hideExportGuides.ts' \
  'src/lib/designer/productTemplateLinks.ts' \
  'src/lib/platform-seo/metadata.ts' \
  'src/lib/seo/domHead.ts' \
  'src/lib/siteDesignTargets.ts' \
  'src/lib/sites/productSiteModes.ts' \
  'src/lib/sites/sitePackages.ts' \
  'src/lib/sites/storefrontProductFlow.ts' \
  'src/lib/supplier-bank/sourceRegistry.ts' \
  'src/pages/Designer.tsx' \
  'src/pages/FileUploadConfiguration.tsx' \
  'src/pages/Index.tsx' \
  'src/pages/MyAccount.tsx' \
  'src/pages/MyAddresses.tsx' \
  'src/pages/MyOrders.tsx' \
  'src/pages/MySettings.tsx' \
  'src/pages/ProductPrice.tsx' \
  'src/pages/admin/SitesAdmin.tsx' \
  'src/pages/admin/SupplierBank.tsx' \
  'src/styles/storefrontVisualStyles.css' \
  'src/themes/classic/components/ClassicShopLayout.tsx' \
  'src/themes/glassmorphism/components/GlassBanner2.tsx' \
  'src/themes/glassmorphism/components/GlassShopLayout.tsx' \
  'src/themes/taste-style-themes.ts' \
  'src/utils/productCategories.ts' \
  'vite.config.ts'
```

Suggested staged-file validation:

```sh
git diff --cached --name-only -- \
  'src/App.tsx' \
  'src/components/Banner2Showcase.tsx' \
  'src/components/Footer.tsx' \
  'src/components/Header.tsx' \
  'src/components/HeroSlider.tsx' \
  'src/components/ProductGrid.tsx' \
  'src/components/ProductMarquee.tsx' \
  'src/components/SEO.tsx' \
  'src/components/StorefrontProductTabs.tsx' \
  'src/components/TemplatesDownloadSection.tsx' \
  'src/components/account/AccountLoadingShell.tsx' \
  'src/components/admin/BannerEditor.tsx' \
  'src/components/admin/Dashboard.tsx' \
  'src/components/admin/LogoSection.tsx' \
  'src/components/admin/OrderManager.tsx' \
  'src/components/admin/ProductAboutSection.tsx' \
  'src/components/admin/ProductAttributeBuilder.tsx' \
  'src/components/admin/ProductOverview.tsx' \
  'src/components/admin/ProductPriceManager.tsx' \
  'src/components/admin/SiteDesignEditorV2.tsx' \
  'src/components/admin/SiteDesignPreviewFrame.tsx' \
  'src/components/admin/TenantSiteDesignV2.tsx' \
  'src/components/admin/ThemeSelector.tsx' \
  'src/components/consent/CookieBanner.tsx' \
  'src/components/consent/CookieSettingsDialog.tsx' \
  'src/components/content/ContactContent.tsx' \
  'src/components/content/ProductPriceContent.tsx' \
  'src/components/designer/EditorCanvas.tsx' \
  'src/components/designer/LayerPanel.tsx' \
  'src/components/designer/PDFImportModal.tsx' \
  'src/components/designer/PdfToolsPanel.tsx' \
  'src/components/platform/PlatformHeader.tsx' \
  'src/components/platform/PlatformSlider.tsx' \
  'src/components/product-price-page/DynamicProductOptions.tsx' \
  'src/components/product-price-page/MatrixLayoutV1Renderer.tsx' \
  'src/components/product-price-page/PriceMatrix.tsx' \
  'src/components/product-price-page/ProductPricePanel.tsx' \
  'src/components/product-price-page/StaticProductInfo.tsx' \
  'src/components/sites/SitePackagePreview.tsx' \
  'src/components/storefront/StorefrontHomeContent.tsx' \
  'src/components/storefront/StorefrontSeo.tsx' \
  'src/components/storefront/StorefrontThemeFrame.tsx' \
  'src/contexts/PreviewBrandingContext.tsx' \
  'src/hooks/useBrandingDraft.ts' \
  'src/hooks/useStorefrontCatalog.ts' \
  'src/lib/checkout/siteCheckoutSession.ts' \
  'src/lib/designer/export/exportVectorPdfBackground.ts' \
  'src/lib/designer/export/hideExportGuides.ts' \
  'src/lib/designer/productTemplateLinks.ts' \
  'src/lib/platform-seo/metadata.ts' \
  'src/lib/seo/domHead.ts' \
  'src/lib/siteDesignTargets.ts' \
  'src/lib/sites/productSiteModes.ts' \
  'src/lib/sites/sitePackages.ts' \
  'src/lib/sites/storefrontProductFlow.ts' \
  'src/lib/supplier-bank/sourceRegistry.ts' \
  'src/pages/Designer.tsx' \
  'src/pages/FileUploadConfiguration.tsx' \
  'src/pages/Index.tsx' \
  'src/pages/MyAccount.tsx' \
  'src/pages/MyAddresses.tsx' \
  'src/pages/MyOrders.tsx' \
  'src/pages/MySettings.tsx' \
  'src/pages/ProductPrice.tsx' \
  'src/pages/admin/SitesAdmin.tsx' \
  'src/pages/admin/SupplierBank.tsx' \
  'src/styles/storefrontVisualStyles.css' \
  'src/themes/classic/components/ClassicShopLayout.tsx' \
  'src/themes/glassmorphism/components/GlassBanner2.tsx' \
  'src/themes/glassmorphism/components/GlassShopLayout.tsx' \
  'src/themes/taste-style-themes.ts' \
  'src/utils/productCategories.ts' \
  'vite.config.ts'
```

Suggested unstaging rollback:

```sh
git restore --staged -- \
  'src/App.tsx' \
  'src/components/Banner2Showcase.tsx' \
  'src/components/Footer.tsx' \
  'src/components/Header.tsx' \
  'src/components/HeroSlider.tsx' \
  'src/components/ProductGrid.tsx' \
  'src/components/ProductMarquee.tsx' \
  'src/components/SEO.tsx' \
  'src/components/StorefrontProductTabs.tsx' \
  'src/components/TemplatesDownloadSection.tsx' \
  'src/components/account/AccountLoadingShell.tsx' \
  'src/components/admin/BannerEditor.tsx' \
  'src/components/admin/Dashboard.tsx' \
  'src/components/admin/LogoSection.tsx' \
  'src/components/admin/OrderManager.tsx' \
  'src/components/admin/ProductAboutSection.tsx' \
  'src/components/admin/ProductAttributeBuilder.tsx' \
  'src/components/admin/ProductOverview.tsx' \
  'src/components/admin/ProductPriceManager.tsx' \
  'src/components/admin/SiteDesignEditorV2.tsx' \
  'src/components/admin/SiteDesignPreviewFrame.tsx' \
  'src/components/admin/TenantSiteDesignV2.tsx' \
  'src/components/admin/ThemeSelector.tsx' \
  'src/components/consent/CookieBanner.tsx' \
  'src/components/consent/CookieSettingsDialog.tsx' \
  'src/components/content/ContactContent.tsx' \
  'src/components/content/ProductPriceContent.tsx' \
  'src/components/designer/EditorCanvas.tsx' \
  'src/components/designer/LayerPanel.tsx' \
  'src/components/designer/PDFImportModal.tsx' \
  'src/components/designer/PdfToolsPanel.tsx' \
  'src/components/platform/PlatformHeader.tsx' \
  'src/components/platform/PlatformSlider.tsx' \
  'src/components/product-price-page/DynamicProductOptions.tsx' \
  'src/components/product-price-page/MatrixLayoutV1Renderer.tsx' \
  'src/components/product-price-page/PriceMatrix.tsx' \
  'src/components/product-price-page/ProductPricePanel.tsx' \
  'src/components/product-price-page/StaticProductInfo.tsx' \
  'src/components/sites/SitePackagePreview.tsx' \
  'src/components/storefront/StorefrontHomeContent.tsx' \
  'src/components/storefront/StorefrontSeo.tsx' \
  'src/components/storefront/StorefrontThemeFrame.tsx' \
  'src/contexts/PreviewBrandingContext.tsx' \
  'src/hooks/useBrandingDraft.ts' \
  'src/hooks/useStorefrontCatalog.ts' \
  'src/lib/checkout/siteCheckoutSession.ts' \
  'src/lib/designer/export/exportVectorPdfBackground.ts' \
  'src/lib/designer/export/hideExportGuides.ts' \
  'src/lib/designer/productTemplateLinks.ts' \
  'src/lib/platform-seo/metadata.ts' \
  'src/lib/seo/domHead.ts' \
  'src/lib/siteDesignTargets.ts' \
  'src/lib/sites/productSiteModes.ts' \
  'src/lib/sites/sitePackages.ts' \
  'src/lib/sites/storefrontProductFlow.ts' \
  'src/lib/supplier-bank/sourceRegistry.ts' \
  'src/pages/Designer.tsx' \
  'src/pages/FileUploadConfiguration.tsx' \
  'src/pages/Index.tsx' \
  'src/pages/MyAccount.tsx' \
  'src/pages/MyAddresses.tsx' \
  'src/pages/MyOrders.tsx' \
  'src/pages/MySettings.tsx' \
  'src/pages/ProductPrice.tsx' \
  'src/pages/admin/SitesAdmin.tsx' \
  'src/pages/admin/SupplierBank.tsx' \
  'src/styles/storefrontVisualStyles.css' \
  'src/themes/classic/components/ClassicShopLayout.tsx' \
  'src/themes/glassmorphism/components/GlassBanner2.tsx' \
  'src/themes/glassmorphism/components/GlassShopLayout.tsx' \
  'src/themes/taste-style-themes.ts' \
  'src/utils/productCategories.ts' \
  'vite.config.ts'
```

### Runtime Risk Groups

| Group | Files | Review focus |
| --- | ---: | --- |
| admin operations | 12 | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| build/config | 1 | Verify the production build and localhost dev server behavior. |
| checkout/account | 5 | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
| designer/pdf/template | 10 | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| pricing/product flow | 8 | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| runtime shared | 22 | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| tenant storefront/SEO/design | 15 | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |

### Application Candidate Files

| Decision | Status | Path | Risk group | Review focus |
| --- | --- | --- | --- | --- |
| REVIEW | M | `src/App.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/Banner2Showcase.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/Footer.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/Header.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/HeroSlider.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/ProductGrid.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/ProductMarquee.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/SEO.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/StorefrontProductTabs.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/TemplatesDownloadSection.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | A | `src/components/account/AccountLoadingShell.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/admin/BannerEditor.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/Dashboard.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/LogoSection.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/OrderManager.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/ProductAboutSection.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/ProductAttributeBuilder.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/ProductOverview.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/ProductPriceManager.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/components/admin/SiteDesignEditorV2.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/SiteDesignPreviewFrame.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/TenantSiteDesignV2.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/ThemeSelector.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/consent/CookieBanner.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/consent/CookieSettingsDialog.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/content/ContactContent.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/content/ProductPriceContent.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/components/designer/EditorCanvas.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/components/designer/LayerPanel.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/components/designer/PDFImportModal.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | A | `src/components/designer/PdfToolsPanel.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/components/platform/PlatformHeader.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/platform/PlatformSlider.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/product-price-page/DynamicProductOptions.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/components/product-price-page/MatrixLayoutV1Renderer.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/components/product-price-page/PriceMatrix.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/components/product-price-page/ProductPricePanel.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/components/product-price-page/StaticProductInfo.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/components/sites/SitePackagePreview.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/storefront/StorefrontHomeContent.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/storefront/StorefrontSeo.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/storefront/StorefrontThemeFrame.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/contexts/PreviewBrandingContext.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/hooks/useBrandingDraft.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/hooks/useStorefrontCatalog.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/checkout/siteCheckoutSession.ts` | checkout/account | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
| REVIEW | M | `src/lib/designer/export/exportVectorPdfBackground.ts` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/lib/designer/export/hideExportGuides.ts` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/lib/designer/productTemplateLinks.ts` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/lib/platform-seo/metadata.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | A | `src/lib/seo/domHead.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/siteDesignTargets.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | A | `src/lib/sites/productSiteModes.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/sites/sitePackages.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | A | `src/lib/sites/storefrontProductFlow.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/supplier-bank/sourceRegistry.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/pages/Designer.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/pages/FileUploadConfiguration.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/pages/Index.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/pages/MyAccount.tsx` | checkout/account | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
| REVIEW | M | `src/pages/MyAddresses.tsx` | checkout/account | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
| REVIEW | M | `src/pages/MyOrders.tsx` | checkout/account | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
| REVIEW | M | `src/pages/MySettings.tsx` | checkout/account | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
| REVIEW | M | `src/pages/ProductPrice.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/pages/admin/SitesAdmin.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/pages/admin/SupplierBank.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | A | `src/styles/storefrontVisualStyles.css` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/themes/classic/components/ClassicShopLayout.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/themes/glassmorphism/components/GlassBanner2.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/themes/glassmorphism/components/GlassShopLayout.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | A | `src/themes/taste-style-themes.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/utils/productCategories.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `vite.config.ts` | build/config | Verify the production build and localhost dev server behavior. |

## Review Gates

| Status | Gate | Evidence |
| --- | --- | --- |
| REVIEW | Branch freshness | Local branch is behind remote; review before push/deploy. |
| REVIEW | Worktree scope | 422 dirty entries need review before a production push. |
| REVIEW | App source touched | 73 application-source entries are in the current worktree. |
| REVIEW | Supabase touched | 7 Supabase entries are in the current worktree; check grants/RLS before DB deploys. |
| PASS | Commercial proof chain visible | 37 entries are part of the commercial proof chain/reporting surface. |

## Files By Bucket

### application-source

- `M` src/App.tsx
- `M` src/components/Banner2Showcase.tsx
- `M` src/components/Footer.tsx
- `M` src/components/Header.tsx
- `M` src/components/HeroSlider.tsx
- `M` src/components/ProductGrid.tsx
- `M` src/components/ProductMarquee.tsx
- `M` src/components/SEO.tsx
- `M` src/components/StorefrontProductTabs.tsx
- `M` src/components/TemplatesDownloadSection.tsx
- `A` src/components/account/AccountLoadingShell.tsx
- `M` src/components/admin/BannerEditor.tsx
- `M` src/components/admin/Dashboard.tsx
- `M` src/components/admin/LogoSection.tsx
- `M` src/components/admin/OrderManager.tsx
- `M` src/components/admin/ProductAboutSection.tsx
- `M` src/components/admin/ProductAttributeBuilder.tsx
- `M` src/components/admin/ProductOverview.tsx
- `M` src/components/admin/ProductPriceManager.tsx
- `M` src/components/admin/SiteDesignEditorV2.tsx
- `M` src/components/admin/SiteDesignPreviewFrame.tsx
- `M` src/components/admin/TenantSiteDesignV2.tsx
- `M` src/components/admin/ThemeSelector.tsx
- `M` src/components/consent/CookieBanner.tsx
- `M` src/components/consent/CookieSettingsDialog.tsx
- `M` src/components/content/ContactContent.tsx
- `M` src/components/content/ProductPriceContent.tsx
- `M` src/components/designer/EditorCanvas.tsx
- `M` src/components/designer/LayerPanel.tsx
- `M` src/components/designer/PDFImportModal.tsx
- ... 43 more entries omitted

### commercial-proof-chain

- `M` .agent/HANDOVER.md
- `M` .gitignore
- `M` AI_CONTINUITY.md
- `M` HANDOVER.md
- `A` docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md
- `A` docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md
- `A` docs/COMMERCIAL_CHANGESET_LATEST.md
- `A` docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md
- `A` docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md
- `AM` docs/COMMERCIAL_PROOF_LATEST.md
- `A` docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md
- `A` docs/COMMERCIAL_RELEASE_LATEST.md
- `A` docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md
- `A` docs/COMMERCIAL_RELEASE_PACKET_LATEST.md
- `A` docs/COMMERCIAL_STAGED_PACKET_LATEST.md
- `A` docs/COMMERCIAL_SUPABASE_LATEST.md
- `A` docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md
- `M` package-lock.json
- `M` package.json
- `A` scripts/check-commercial-application-source.mjs
- `A` scripts/check-commercial-branch-freshness.mjs
- `A` scripts/check-commercial-changeset.mjs
- `A` scripts/check-commercial-deploy-readiness.mjs
- `A` scripts/check-commercial-owner-merge-readiness.mjs
- `A` scripts/check-commercial-proof-report.mjs
- `A` scripts/check-commercial-proof.mjs
- `A` scripts/check-commercial-readiness-bindings.js
- `A` scripts/check-commercial-release-handoff.mjs
- `A` scripts/check-commercial-release-owner-sequence.mjs
- `A` scripts/check-commercial-release-packet.mjs
- ... 7 more entries omitted

### documentation

- `M` AGENTS.md
- `M` SYSTEM_OVERVIEW.md
- `M` docs/PRICING_READ_API.md
- `M` docs/PRODUCT_DETAIL_READ_API.md
- `A` docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md
- `M` docs/WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md
- `??` HANDOVER 2.md
- `??` PRODUCT_CONTENT_PACKAGE_2026-05-12.md
- `??` SEO_PRINT_PACKAGE_2026-05-12.md
- `??` docs/GOLDEN_PRODUCT_FLOW_PLAN_2026-06-28.md
- `??` docs/ONLINETRYKSAGER_DK_TENANT_AUDIT_2026-06-30.md
- `??` docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md
- `??` docs/PRODUCT_SOURCE_INVENTORY_2026-06-28.md
- `??` docs/SALGSMAPPER_DK_TENANT_AUDIT_2026-06-28.md
- `??` docs/SUPPLIER_PRODUCT_BANK_WMD_FULL_STATUS_2026-07-02.md
- `??` docs/SUPPLIER_PRODUCT_BANK_WMD_PILOT_SMOKE_2026-07-01.md
- `??` docs/WEBPRINTER_PLATFORM_DESIGN_AUDIT_2026-07-01.md

### local-tooling

- `A` .github/workflows/supabase-data-api-grants.yml
- `??` .agents/
- `??` .codex/
- `??` deno.lock

### other

- `A` .vercelignore
- `M` config/supplier-bank/sources.json
- `A` pnpm-lock.yaml
- `M` scripts/check-supabase-function-exposure.js
- `M` scripts/supplier-bank-cli.mjs
- `??` output/
- `??` pnpm-workspace.yaml
- `??` scripts/apply-product-content-package.js
- `??` scripts/apply-product-label-translations.js
- `??` scripts/audit-product-source-inventory.cjs
- `??` tmp/

### supabase

- `M` supabase/.temp/cli-latest
- `M` supabase/config.toml
- `M` supabase/functions/pricing-read/index.ts
- `M` supabase/functions/product-detail-read/index.ts
- `A` supabase/migrations/20260509120000_index_generic_product_prices_lookup.sql
- `??` supabase/config 2.toml
- `??` supabase/functions/test-env/index 2.ts

### supplier-bank-evidence

- `M` docs/PIXART_IMPORT_RUNBOOK.md
- `A` docs/SUPPLIER_BANK_STATUS_REPORT_20260710-025335.md
- `A` docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md
- `??` blueprints/supplier-bank-wmd-folder-pilot.yml
- `??` docs/PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_20260703-051855.md
- `??` docs/PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_20260703-073037.md
- `??` docs/PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_20260703-073303.md
- `??` docs/PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_20260703-073451.md
- `??` docs/PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_20260703-073630.md
- `??` docs/PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_20260703-074105.md
- `??` docs/PIXART_RIGIDS_BANK_CANDIDATE_REVIEW_20260703-075835.md
- `??` docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_20260703-100205.md
- `??` docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_20260703-110648.md
- `??` docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_20260703-124404.md
- `??` docs/PIXART_RIGIDS_BANK_WRITE_PREFLIGHT_LATEST.md
- `??` docs/PIXART_RIGIDS_CANDIDATE_PACKET_20260703-073303.md
- `??` docs/PIXART_RIGIDS_CANDIDATE_PACKET_20260703-073452.md
- `??` docs/PIXART_RIGIDS_CANDIDATE_PACKET_20260703-073631.md
- `??` docs/PIXART_RIGIDS_CANDIDATE_PACKET_20260703-074105.md
- `??` docs/PIXART_RIGIDS_CANDIDATE_PACKET_20260703-075836.md
- `??` docs/PIXART_RIGIDS_STORFORMAT_REVIEW_20260703-070216.md
- `??` docs/PIXART_RIGIDS_STORFORMAT_REVIEW_20260703-074339.md
- `??` docs/PIXART_RIGIDS_STORFORMAT_REVIEW_20260703-075859.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-091112.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-091507.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-092829.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-093402.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-095520.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-095801.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-100216.md
- ... 243 more entries omitted
