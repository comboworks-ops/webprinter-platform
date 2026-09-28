# Commercial Application Source Report

Generated: 2026-07-27T23:33:14.090Z
Git status command: `git status --short --branch`
Branch: ## ui-cleanup...origin/ui-cleanup [ahead 49]
Status: REVIEW REQUIRED

This is a local, read-only application-source review artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Review Summary

Application source entries: 67
Expanded runtime files: 69
Risk groups: 7

## Guardrail Checks

| Status | Guardrail | Evidence |
| --- | --- | --- |
| PASS | Core pricing engine untouched | No dirty `src/utils/pricingDatabase.ts`, `src/utils/productPriceDisplay.ts`, `src/lib/api/pricingRead.ts`, `src/lib/api/productDetailRead.ts` or `src/lib/api/catalogRead.ts` paths are reported. |
| REVIEW | POD admin/runtime untouched in application bucket | One or more POD admin/runtime paths are dirty and need POD-specific review before staging. |
| REVIEW | Protected designer/PDF surface visible | Designer/PDF files are dirty and must be reviewed with template/download/export proof, especially Salgsmapper. |
| REVIEW | Untracked runtime files visible | Untracked runtime files are included in the application-source packet and must be staged intentionally or ignored. |

## Runtime Risk Groups

| Group | Files | Review focus | Suggested proof |
| --- | ---: | --- | --- |
| admin operations | 16 | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. | Open relevant admin surfaces as `admin@webprinter.dk` and verify tenant context. |
| build/config | 1 | Verify the production build and localhost dev server behavior. | Run `npm run build` and keep localhost on the expected port. |
| checkout/account | 1 | Verify customer checkout/account paths keep tenant context and do not regress order handoff. | Open checkout handoff and customer account pages without changing live data. |
| designer/pdf/template | 7 | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. | Open Salgsmapper standard folder and verify PDF template download plus designer handoff. |
| pricing/product flow | 3 | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. | Open Webprinter Aluminium and verify price preview plus checkout handoff. |
| runtime shared | 32 | Review as shared runtime code and verify with build plus the owned-tenant proof routes. | Run build and owned-tenant proof routes. |
| tenant storefront/SEO/design | 9 | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. | Open Webprinter, Salgsmapper and Onlinetryksager storefronts on desktop/mobile. |

## Required Verification

- `npm run build` must pass for the runtime application packet.
- `npm run check:commercial-proof` must pass after runtime source changes.
- Designer/PDF/template changes require manual Salgsmapper template/download/designer handoff review before external demo.
- Pricing/product-flow changes must remain warning/read-only unless a specific price mutation was explicitly approved.
- POD application paths require `POD2_README.md` review before staging if they appear dirty.

## Application Candidate Files

| Decision | Status | Path | Risk group | Review focus |
| --- | --- | --- | --- | --- |
| REVIEW | M | `src/components/Header.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/ProductGrid.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/StorefrontProductTabs.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/admin/AdminSidebar.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/ImpositionPreview.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/MachineForm.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/MachinePricingManager.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/ShopModules.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/SiteDesignEditorV2.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/SiteDesignPreviewFrame.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/admin/print-production/PrintProductionOrders.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/components/companyhub/AdminCompanyHubManager.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/companyhub/v2/AdminCompanyMembers.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/companyhub/v2/AdminCompanyOffices.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/companyhub/v2/AdminCompanyWorkspace.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/companyhub/v2/CompanyLocationsView.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/companyhub/v2/CompanyWorkspaceShell.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/components/designer/PDFImportModal.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/components/designer/PdfToolsPanel.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/components/product-price-page/MachineConfigurator.tsx` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | M | `src/components/storefront/StorefrontHomeContent.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/components/storefront/StorefrontThemeFrame.tsx` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/hooks/useAdminCompanyWorkspace.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/hooks/useBrandingDraft.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | M | `src/lib/api/featureFlags.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/branding/types.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/checkout/siteCheckoutSession.ts` | checkout/account | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
| REVIEW | M | `src/lib/company-hub/assetService.test.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/company-hub/assetService.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/icon-studio/catalog.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/icon-studio/provider.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/icon-studio/service.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/icon-studio/types.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/modules/catalog.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/pod2/hooks.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/pod2/types.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/print-production/orderSubmission.test.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/print-production/orderSubmission.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/print-production/readiness.test.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/print-production/readiness.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/print-production/snapshot.test.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/print-production/types.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/print-production/usePrintProductionData.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/lib/sites/storefrontProductFlow.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/pages/Admin.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/pages/Designer.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/pages/FileUploadConfiguration.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | M | `src/pages/PreviewShop.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | M | `src/pages/admin/IconStudioPage.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `src/pages/admin/SupplierBank.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | M | `vite.config.ts` | build/config | Verify the production build and localhost dev server behavior. |
| REVIEW | ?? | `src/components/admin/MachineCostWorkbench.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/admin/MasterPodRouteGate.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/admin/ShopTemplatePicker.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/admin/icon-studio/IconStudioOutputActions.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/admin/supplier-bank/SupplierUrlImportDialog.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/designer/PhotopeaEditorDialog.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | ?? | `src/lib/designer/photopeaBridge.test.ts` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | ?? | `src/lib/designer/photopeaBridge.ts` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | ?? | `src/lib/erpnext/shadowContract.test.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/lib/erpnext/shadowContract.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/lib/erpnext/shadowPolicy.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/lib/preview/siteDesignPreviewNavigation.test.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | ?? | `src/lib/preview/siteDesignPreviewNavigation.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | ?? | `src/lib/pricing/machineCostSimulator.ts` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | ?? | `src/lib/pricing/machineProfileCatalog.ts` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | ?? | `src/lib/storefront/shopTemplates.test.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | ?? | `src/lib/storefront/shopTemplates.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | ?? | `src/styles/storefrontShopTemplates.css` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |

## Suggested Packet Commands

```sh
git add -- \
  'src/components/Header.tsx' \
  'src/components/ProductGrid.tsx' \
  'src/components/StorefrontProductTabs.tsx' \
  'src/components/admin/AdminSidebar.tsx' \
  'src/components/admin/ImpositionPreview.tsx' \
  'src/components/admin/MachineForm.tsx' \
  'src/components/admin/MachinePricingManager.tsx' \
  'src/components/admin/ShopModules.tsx' \
  'src/components/admin/SiteDesignEditorV2.tsx' \
  'src/components/admin/SiteDesignPreviewFrame.tsx' \
  'src/components/admin/print-production/PrintProductionOrders.tsx' \
  'src/components/companyhub/AdminCompanyHubManager.tsx' \
  'src/components/companyhub/v2/AdminCompanyMembers.tsx' \
  'src/components/companyhub/v2/AdminCompanyOffices.tsx' \
  'src/components/companyhub/v2/AdminCompanyWorkspace.tsx' \
  'src/components/companyhub/v2/CompanyLocationsView.tsx' \
  'src/components/companyhub/v2/CompanyWorkspaceShell.tsx' \
  'src/components/designer/PDFImportModal.tsx' \
  'src/components/designer/PdfToolsPanel.tsx' \
  'src/components/product-price-page/MachineConfigurator.tsx' \
  'src/components/storefront/StorefrontHomeContent.tsx' \
  'src/components/storefront/StorefrontThemeFrame.tsx' \
  'src/hooks/useAdminCompanyWorkspace.ts' \
  'src/hooks/useBrandingDraft.ts' \
  'src/lib/api/featureFlags.ts' \
  'src/lib/branding/types.ts' \
  'src/lib/checkout/siteCheckoutSession.ts' \
  'src/lib/company-hub/assetService.test.ts' \
  'src/lib/company-hub/assetService.ts' \
  'src/lib/icon-studio/catalog.ts' \
  'src/lib/icon-studio/provider.ts' \
  'src/lib/icon-studio/service.ts' \
  'src/lib/icon-studio/types.ts' \
  'src/lib/modules/catalog.ts' \
  'src/lib/pod2/hooks.ts' \
  'src/lib/pod2/types.ts' \
  'src/lib/print-production/orderSubmission.test.ts' \
  'src/lib/print-production/orderSubmission.ts' \
  'src/lib/print-production/readiness.test.ts' \
  'src/lib/print-production/readiness.ts' \
  'src/lib/print-production/snapshot.test.ts' \
  'src/lib/print-production/types.ts' \
  'src/lib/print-production/usePrintProductionData.ts' \
  'src/lib/sites/storefrontProductFlow.ts' \
  'src/pages/Admin.tsx' \
  'src/pages/Designer.tsx' \
  'src/pages/FileUploadConfiguration.tsx' \
  'src/pages/PreviewShop.tsx' \
  'src/pages/admin/IconStudioPage.tsx' \
  'src/pages/admin/SupplierBank.tsx' \
  'vite.config.ts' \
  'src/components/admin/MachineCostWorkbench.tsx' \
  'src/components/admin/MasterPodRouteGate.tsx' \
  'src/components/admin/ShopTemplatePicker.tsx' \
  'src/components/admin/icon-studio/' \
  'src/components/admin/supplier-bank/' \
  'src/components/designer/PhotopeaEditorDialog.tsx' \
  'src/lib/designer/photopeaBridge.test.ts' \
  'src/lib/designer/photopeaBridge.ts' \
  'src/lib/erpnext/' \
  'src/lib/preview/siteDesignPreviewNavigation.test.ts' \
  'src/lib/preview/siteDesignPreviewNavigation.ts' \
  'src/lib/pricing/machineCostSimulator.ts' \
  'src/lib/pricing/machineProfileCatalog.ts' \
  'src/lib/storefront/shopTemplates.test.ts' \
  'src/lib/storefront/shopTemplates.ts' \
  'src/styles/storefrontShopTemplates.css'
```

```sh
npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof
```
