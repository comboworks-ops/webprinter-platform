# Commercial Application Source Report

Generated: 2026-07-10T01:18:29.536Z
Git status command: `git status --short --branch`
Branch: ## ui-cleanup...origin/ui-cleanup [behind 1]
Status: REVIEW REQUIRED

This is a local, read-only application-source review artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Review Summary

Application source entries: 73
Expanded runtime files: 73
Risk groups: 7

## Guardrail Checks

| Status | Guardrail | Evidence |
| --- | --- | --- |
| PASS | Core pricing engine untouched | No dirty `src/utils/pricingDatabase.ts`, `src/utils/productPriceDisplay.ts`, `src/lib/api/pricingRead.ts`, `src/lib/api/productDetailRead.ts` or `src/lib/api/catalogRead.ts` paths are reported. |
| PASS | POD admin/runtime untouched in application bucket | No dirty `src/lib/pod*` or `src/pages/admin/Pod*` application paths are reported. |
| REVIEW | Protected designer/PDF surface visible | Designer/PDF files are dirty and must be reviewed with template/download/export proof, especially Salgsmapper. |
| PASS | Untracked runtime files visible | No untracked runtime files are present in the application-source packet. |

## Runtime Risk Groups

| Group | Files | Review focus | Suggested proof |
| --- | ---: | --- | --- |
| admin operations | 12 | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. | Open relevant admin surfaces as `admin@webprinter.dk` and verify tenant context. |
| build/config | 1 | Verify the production build and localhost dev server behavior. | Run `npm run build` and keep localhost on the expected port. |
| checkout/account | 6 | Verify customer checkout/account paths keep tenant context and do not regress order handoff. | Open checkout handoff and customer account pages without changing live data. |
| designer/pdf/template | 10 | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. | Open Salgsmapper standard folder and verify PDF template download plus designer handoff. |
| pricing/product flow | 8 | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. | Open Webprinter Aluminium and verify price preview plus checkout handoff. |
| runtime shared | 21 | Review as shared runtime code and verify with build plus the owned-tenant proof routes. | Run build and owned-tenant proof routes. |
| tenant storefront/SEO/design | 15 | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. | Open Webprinter, Salgsmapper and Onlinetryksager storefronts on desktop/mobile. |

## Required Verification

- `npm run build` must pass for the runtime application packet.
- `npm run check:commercial-proof` must pass after runtime source changes.
- Designer/PDF/template changes require manual Salgsmapper template/download/designer handoff review before external demo.
- Pricing/product-flow changes must remain warning/read-only unless a specific price mutation was explicitly approved.
- POD application paths require `POD2_README.md` review before staging if they appear dirty.

## Application Candidate Files

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
| REVIEW | A | `src/components/account/AccountLoadingShell.tsx` | checkout/account | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
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

## Suggested Packet Commands

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

```sh
npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof
```
