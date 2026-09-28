# Commercial Changeset Report

Generated: 2026-07-27T23:33:09.353Z
Git status command: `git status --short --branch`
Branch: ## ui-cleanup...origin/ui-cleanup [ahead 49]
Status: REVIEW REQUIRED

This is a local, read-only changeset artifact. It does not stage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Review Summary

Dirty entries: 419
Tracked modified entries: 66
Untracked entries: 353
Commercial proof-chain entries: 14
Application source entries: 75
Supabase entries: 21

## Bucket Counts

| Bucket | Entries | Review meaning |
| --- | ---: | --- |
| application-source | 75 | Runtime application code that needs normal browser/build review. |
| commercial-proof-chain | 14 | Commercial cockpit, proof scripts, generated proof reports or package wiring. |
| documentation | 27 | Handover, continuity, roadmap or audit documentation. |
| local-tooling | 3 | Local agent, CI/tooling or generated support files. |
| other | 8 | Needs manual classification before release. |
| supabase | 21 | Database/functions/tooling area; review grants, RLS and deployment safety. |
| supplier-bank-evidence | 271 | Supplier Bank/Pixart evidence or planning files, not storefront runtime by itself. |

## Suggested Review Order

| Order | Bucket | Entries | Why now | Suggested verification |
| ---: | --- | ---: | --- | --- |
| 1 | commercial-proof-chain | 14 | Smallest coherent release-safety slice; proves the cockpit, reports and gates before touching broader app code. | `npm run check:commercial-release` |
| 2 | application-source | 75 | Runtime changes affect tenants and storefront behavior; review after the proof chain is trusted. | `npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof` |
| 3 | supabase | 21 | Database/functions can affect live data; review grants/RLS/function exposure before any deploy. | `npm run check:commercial-supabase:write && npm run check:supabase-grants && npm run check:supabase-functions` |
| 4 | supplier-bank-evidence | 271 | Large evidence set; keep as a separate documentation/review packet from runtime changes. | `npm run supplier-bank:doctor && npm run supplier-bank:status-report` |
| 5 | documentation | 27 | Documentation should match the reviewed implementation and not hide unresolved production risks. | `npm run check:commercial-changeset-report` |
| 6 | local-tooling | 3 | Local/tooling artifacts should be intentionally included or ignored before staging. | `git status --short --branch` |
| 7 | other | 8 | Unclassified paths need manual owner decision before they can enter a release. | `git status --short --branch` |

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
Packet entries: 14
Hold outside first packet: 405
Suggested packet verification: `npm run check:commercial-release`
Suggested staging command preview:

```sh
git add -- \
  'AI_CONTINUITY.md' \
  'docs/COMMERCIAL_APPLICATION_SOURCE_LATEST 2.md' \
  'docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST 2.md' \
  'docs/COMMERCIAL_CHANGESET_LATEST 2.md' \
  'docs/COMMERCIAL_DEPLOY_READINESS_LATEST 2.md' \
  'docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST 2.md' \
  'docs/COMMERCIAL_PROOF_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_HANDOFF_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_PACKET_LATEST 2.md' \
  'docs/COMMERCIAL_STAGED_PACKET_LATEST 2.md' \
  'docs/COMMERCIAL_SUPABASE_LATEST 2.md' \
  'docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST 2.md'
```

Suggested staged-file validation:

```sh
git diff --cached --name-only -- \
  'AI_CONTINUITY.md' \
  'docs/COMMERCIAL_APPLICATION_SOURCE_LATEST 2.md' \
  'docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST 2.md' \
  'docs/COMMERCIAL_CHANGESET_LATEST 2.md' \
  'docs/COMMERCIAL_DEPLOY_READINESS_LATEST 2.md' \
  'docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST 2.md' \
  'docs/COMMERCIAL_PROOF_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_HANDOFF_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_PACKET_LATEST 2.md' \
  'docs/COMMERCIAL_STAGED_PACKET_LATEST 2.md' \
  'docs/COMMERCIAL_SUPABASE_LATEST 2.md' \
  'docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST 2.md'
```

Suggested unstaging rollback:

```sh
git restore --staged -- \
  'AI_CONTINUITY.md' \
  'docs/COMMERCIAL_APPLICATION_SOURCE_LATEST 2.md' \
  'docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST 2.md' \
  'docs/COMMERCIAL_CHANGESET_LATEST 2.md' \
  'docs/COMMERCIAL_DEPLOY_READINESS_LATEST 2.md' \
  'docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST 2.md' \
  'docs/COMMERCIAL_PROOF_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_HANDOFF_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST 2.md' \
  'docs/COMMERCIAL_RELEASE_PACKET_LATEST 2.md' \
  'docs/COMMERCIAL_STAGED_PACKET_LATEST 2.md' \
  'docs/COMMERCIAL_SUPABASE_LATEST 2.md' \
  'docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST 2.md'
```

### Candidate Files

| Decision | Status | Path | Why it belongs in packet |
| --- | --- | --- | --- |
| INCLUDE | M | `AI_CONTINUITY.md` | Documents the commercial proof, release and application-source review commands required by the binding guard. |
| INCLUDE | ?? | `docs/COMMERCIAL_APPLICATION_SOURCE_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_CHANGESET_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_DEPLOY_READINESS_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_PROOF_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_RELEASE_HANDOFF_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_RELEASE_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_RELEASE_PACKET_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_STAGED_PACKET_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_SUPABASE_LATEST 2.md` | Classified as commercial proof-chain by path. |
| INCLUDE | ?? | `docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST 2.md` | Classified as commercial proof-chain by path. |

### Hold Outside First Packet

| Bucket | Entries | Hold reason |
| --- | ---: | --- |
| application-source | 75 | Review after proof-chain packet because these files affect runtime tenant behavior. |
| documentation | 27 | Review after implementation packet so docs match the accepted release state. |
| local-tooling | 3 | Decide intentionally whether local/tooling paths belong in source control. |
| other | 8 | Manually classify before staging. |
| supabase | 21 | Review separately with grants/RLS/function exposure checks before DB/function deploy. |
| supplier-bank-evidence | 271 | Keep as a separate evidence packet; it is large and not a runtime release slice by itself. |

## Second Review Packet: Application Source

Purpose: review the runtime application changes only after the commercial proof-chain packet is trusted. This packet can affect tenants, storefronts, designer handoff, checkout, account pages, SEO and admin operations.
Packet entries: 75
Suggested packet verification: `npm run check:commercial-application-source:write && npm run build && npm run check:commercial-proof`
Suggested staging command preview:

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
  'src/components/account/AccountLoadingShell 2.tsx' \
  'src/components/admin/MachineCostWorkbench.tsx' \
  'src/components/admin/MasterPodRouteGate.tsx' \
  'src/components/admin/ShopTemplatePicker.tsx' \
  'src/components/admin/icon-studio/' \
  'src/components/admin/supplier-bank/' \
  'src/components/designer/PdfToolsPanel 2.tsx' \
  'src/components/designer/PdfToolsPanel 3.tsx' \
  'src/components/designer/PhotopeaEditorDialog.tsx' \
  'src/lib/designer/photopeaBridge.test.ts' \
  'src/lib/designer/photopeaBridge.ts' \
  'src/lib/erpnext/' \
  'src/lib/preview/siteDesignPreviewNavigation.test.ts' \
  'src/lib/preview/siteDesignPreviewNavigation.ts' \
  'src/lib/pricing/machineCostSimulator.ts' \
  'src/lib/pricing/machineProfileCatalog.ts' \
  'src/lib/seo/domHead 2.ts' \
  'src/lib/sites/productSiteModes 2.ts' \
  'src/lib/sites/storefrontProductFlow 2.ts' \
  'src/lib/storefront/shopTemplates.test.ts' \
  'src/lib/storefront/shopTemplates.ts' \
  'src/styles/storefrontShopTemplates.css' \
  'src/styles/storefrontVisualStyles 2.css' \
  'src/themes/taste-style-themes 2.ts'
```

Suggested staged-file validation:

```sh
git diff --cached --name-only -- \
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
  'src/components/account/AccountLoadingShell 2.tsx' \
  'src/components/admin/MachineCostWorkbench.tsx' \
  'src/components/admin/MasterPodRouteGate.tsx' \
  'src/components/admin/ShopTemplatePicker.tsx' \
  'src/components/admin/icon-studio/' \
  'src/components/admin/supplier-bank/' \
  'src/components/designer/PdfToolsPanel 2.tsx' \
  'src/components/designer/PdfToolsPanel 3.tsx' \
  'src/components/designer/PhotopeaEditorDialog.tsx' \
  'src/lib/designer/photopeaBridge.test.ts' \
  'src/lib/designer/photopeaBridge.ts' \
  'src/lib/erpnext/' \
  'src/lib/preview/siteDesignPreviewNavigation.test.ts' \
  'src/lib/preview/siteDesignPreviewNavigation.ts' \
  'src/lib/pricing/machineCostSimulator.ts' \
  'src/lib/pricing/machineProfileCatalog.ts' \
  'src/lib/seo/domHead 2.ts' \
  'src/lib/sites/productSiteModes 2.ts' \
  'src/lib/sites/storefrontProductFlow 2.ts' \
  'src/lib/storefront/shopTemplates.test.ts' \
  'src/lib/storefront/shopTemplates.ts' \
  'src/styles/storefrontShopTemplates.css' \
  'src/styles/storefrontVisualStyles 2.css' \
  'src/themes/taste-style-themes 2.ts'
```

Suggested unstaging rollback:

```sh
git restore --staged -- \
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
  'src/components/account/AccountLoadingShell 2.tsx' \
  'src/components/admin/MachineCostWorkbench.tsx' \
  'src/components/admin/MasterPodRouteGate.tsx' \
  'src/components/admin/ShopTemplatePicker.tsx' \
  'src/components/admin/icon-studio/' \
  'src/components/admin/supplier-bank/' \
  'src/components/designer/PdfToolsPanel 2.tsx' \
  'src/components/designer/PdfToolsPanel 3.tsx' \
  'src/components/designer/PhotopeaEditorDialog.tsx' \
  'src/lib/designer/photopeaBridge.test.ts' \
  'src/lib/designer/photopeaBridge.ts' \
  'src/lib/erpnext/' \
  'src/lib/preview/siteDesignPreviewNavigation.test.ts' \
  'src/lib/preview/siteDesignPreviewNavigation.ts' \
  'src/lib/pricing/machineCostSimulator.ts' \
  'src/lib/pricing/machineProfileCatalog.ts' \
  'src/lib/seo/domHead 2.ts' \
  'src/lib/sites/productSiteModes 2.ts' \
  'src/lib/sites/storefrontProductFlow 2.ts' \
  'src/lib/storefront/shopTemplates.test.ts' \
  'src/lib/storefront/shopTemplates.ts' \
  'src/styles/storefrontShopTemplates.css' \
  'src/styles/storefrontVisualStyles 2.css' \
  'src/themes/taste-style-themes 2.ts'
```

### Runtime Risk Groups

| Group | Files | Review focus |
| --- | ---: | --- |
| admin operations | 16 | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| build/config | 1 | Verify the production build and localhost dev server behavior. |
| checkout/account | 1 | Verify customer checkout/account paths keep tenant context and do not regress order handoff. |
| designer/pdf/template | 9 | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| pricing/product flow | 3 | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| runtime shared | 36 | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| tenant storefront/SEO/design | 9 | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |

### Application Candidate Files

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
| REVIEW | ?? | `src/components/account/AccountLoadingShell 2.tsx` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/components/admin/MachineCostWorkbench.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/admin/MasterPodRouteGate.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/admin/ShopTemplatePicker.tsx` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/admin/icon-studio/` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/admin/supplier-bank/` | admin operations | Verify admin surfaces remain readable, tenant-scoped and warning-only unless an explicit write flow already existed. |
| REVIEW | ?? | `src/components/designer/PdfToolsPanel 2.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | ?? | `src/components/designer/PdfToolsPanel 3.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | ?? | `src/components/designer/PhotopeaEditorDialog.tsx` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | ?? | `src/lib/designer/photopeaBridge.test.ts` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | ?? | `src/lib/designer/photopeaBridge.ts` | designer/pdf/template | Verify PDF/template handoff, upload flow and export behavior for Salgsmapper and general designer paths. |
| REVIEW | ?? | `src/lib/erpnext/` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/lib/preview/siteDesignPreviewNavigation.test.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | ?? | `src/lib/preview/siteDesignPreviewNavigation.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | ?? | `src/lib/pricing/machineCostSimulator.ts` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | ?? | `src/lib/pricing/machineProfileCatalog.ts` | pricing/product flow | Verify preview rows, checkout handoff and warning-only guards without changing price calculations. |
| REVIEW | ?? | `src/lib/seo/domHead 2.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/lib/sites/productSiteModes 2.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/lib/sites/storefrontProductFlow 2.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/lib/storefront/shopTemplates.test.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | ?? | `src/lib/storefront/shopTemplates.ts` | tenant storefront/SEO/design | Verify tenant branding, public pages, metadata and responsive storefront behavior across Webprinter, Salgsmapper and Onlinetryksager. |
| REVIEW | ?? | `src/styles/storefrontShopTemplates.css` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/styles/storefrontVisualStyles 2.css` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |
| REVIEW | ?? | `src/themes/taste-style-themes 2.ts` | runtime shared | Review as shared runtime code and verify with build plus the owned-tenant proof routes. |

## Review Gates

| Status | Gate | Evidence |
| --- | --- | --- |
| PASS | Branch freshness | Local branch is not reported behind remote. |
| REVIEW | Worktree scope | 419 dirty entries need review before a production push. |
| REVIEW | App source touched | 75 application-source entries are in the current worktree. |
| REVIEW | Supabase touched | 21 Supabase entries are in the current worktree; check grants/RLS before DB deploys. |
| PASS | Commercial proof chain visible | 14 entries are part of the commercial proof chain/reporting surface. |

## Files By Bucket

### application-source

- `M` src/components/Header.tsx
- `M` src/components/ProductGrid.tsx
- `M` src/components/StorefrontProductTabs.tsx
- `M` src/components/admin/AdminSidebar.tsx
- `M` src/components/admin/ImpositionPreview.tsx
- `M` src/components/admin/MachineForm.tsx
- `M` src/components/admin/MachinePricingManager.tsx
- `M` src/components/admin/ShopModules.tsx
- `M` src/components/admin/SiteDesignEditorV2.tsx
- `M` src/components/admin/SiteDesignPreviewFrame.tsx
- `M` src/components/admin/print-production/PrintProductionOrders.tsx
- `M` src/components/companyhub/AdminCompanyHubManager.tsx
- `M` src/components/companyhub/v2/AdminCompanyMembers.tsx
- `M` src/components/companyhub/v2/AdminCompanyOffices.tsx
- `M` src/components/companyhub/v2/AdminCompanyWorkspace.tsx
- `M` src/components/companyhub/v2/CompanyLocationsView.tsx
- `M` src/components/companyhub/v2/CompanyWorkspaceShell.tsx
- `M` src/components/designer/PDFImportModal.tsx
- `M` src/components/designer/PdfToolsPanel.tsx
- `M` src/components/product-price-page/MachineConfigurator.tsx
- `M` src/components/storefront/StorefrontHomeContent.tsx
- `M` src/components/storefront/StorefrontThemeFrame.tsx
- `M` src/hooks/useAdminCompanyWorkspace.ts
- `M` src/hooks/useBrandingDraft.ts
- `M` src/lib/api/featureFlags.ts
- `M` src/lib/branding/types.ts
- `M` src/lib/checkout/siteCheckoutSession.ts
- `M` src/lib/company-hub/assetService.test.ts
- `M` src/lib/company-hub/assetService.ts
- `M` src/lib/icon-studio/catalog.ts
- ... 45 more entries omitted

### commercial-proof-chain

- `M` AI_CONTINUITY.md
- `??` docs/COMMERCIAL_APPLICATION_SOURCE_LATEST 2.md
- `??` docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST 2.md
- `??` docs/COMMERCIAL_CHANGESET_LATEST 2.md
- `??` docs/COMMERCIAL_DEPLOY_READINESS_LATEST 2.md
- `??` docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST 2.md
- `??` docs/COMMERCIAL_PROOF_LATEST 2.md
- `??` docs/COMMERCIAL_RELEASE_HANDOFF_LATEST 2.md
- `??` docs/COMMERCIAL_RELEASE_LATEST 2.md
- `??` docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST 2.md
- `??` docs/COMMERCIAL_RELEASE_PACKET_LATEST 2.md
- `??` docs/COMMERCIAL_STAGED_PACKET_LATEST 2.md
- `??` docs/COMMERCIAL_SUPABASE_LATEST 2.md
- `??` docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST 2.md

### documentation

- `M` .agent/workflows/vector-pdf-protected.md
- `M` AGENTS.md
- `M` POD2_README.md
- `M` SYSTEM_OVERVIEW.md
- `??` AGENTS 2.md
- `??` HANDOVER 2.md
- `??` PRODUCT_CONTENT_PACKAGE_2026-05-12.md
- `??` SEO_PRINT_PACKAGE_2026-05-12.md
- `??` SYSTEM_OVERVIEW 2.md
- `??` docs/ERPNEXT_SHADOW_PILOT.md
- `??` docs/GOLDEN_PRODUCT_FLOW_PLAN_2026-06-28.md
- `??` docs/MACHINE_PRICING_V2_HANDOVER_2026-07-11.md
- `??` docs/ONLINETRYKSAGER_DK_TENANT_AUDIT_2026-06-30.md
- `??` docs/OPEN_DESIGN_STIRLING_PDF_PLAN.md
- `??` docs/PHOTOPEA_PILOT.md
- `??` docs/PRODUCT_SOURCE_INVENTORY_2026-06-28.md
- `??` docs/SALGSMAPPER_DK_TENANT_AUDIT_2026-06-28.md
- `??` docs/SHOP_TEMPLATE_SYSTEM_2026-07-27.md
- `??` docs/STIRLING_PDF_INTEGRATION.md
- `??` docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01 2.md
- `??` docs/SUPPLIER_PRODUCT_BANK_WMD_FULL_STATUS_2026-07-02.md
- `??` docs/SUPPLIER_PRODUCT_BANK_WMD_PILOT_SMOKE_2026-07-01.md
- `??` docs/TSHIRT_DESIGNER_TOOL_ASSESSMENT_2026-07-10.md
- `??` docs/WEBPRINTER_PLATFORM_DESIGN_AUDIT_2026-07-01.md
- `??` docs/open-design-shop-system/
- `??` docs/superpowers/plans/2026-07-14-print-production-control-center.md
- `??` docs/superpowers/specs/2026-07-13-print-production-control-center-design.md

### local-tooling

- `??` .agents/
- `??` .codex/
- `??` deno.lock

### other

- `??` .vercelignore 2
- `??` output/
- `??` pnpm-lock 2.yaml
- `??` pnpm-workspace.yaml
- `??` scripts/apply-product-content-package.js
- `??` scripts/apply-product-label-translations.js
- `??` scripts/audit-product-source-inventory.cjs
- `??` tmp/

### supabase

- `M` supabase/.temp/cli-latest
- `M` supabase/config.toml
- `M` supabase/functions/pod2-create-jobs/index.ts
- `M` supabase/functions/pod2-explorer-request/index.ts
- `M` supabase/functions/pod2-master-forward/index.ts
- `M` supabase/functions/pod2-order-submit/index.ts
- `M` supabase/functions/pod2-printcom-sync-status/index.ts
- `M` supabase/functions/pod2-submit-to-printcom/index.ts
- `M` supabase/functions/pod2-tenant-approve-charge/index.ts
- `M` supabase/functions/pod2x-printcom-proxy/index.ts
- `??` supabase/.temp/cli-latest 2
- `??` supabase/config 2.toml
- `??` supabase/functions/_shared/erpShadow.test.ts
- `??` supabase/functions/_shared/erpShadow.ts
- `??` supabase/functions/_shared/pod2PrintcomSafety.ts
- `??` supabase/functions/_shared/pod2PrintcomSafety_test.ts
- `??` supabase/functions/company-hub-invite-member/
- `??` supabase/functions/supplier-bank-url-import/
- `??` supabase/functions/test-env/index 2.ts
- `??` supabase/migrations/20260509120000_index_generic_product_prices_lookup 2.sql
- `??` supabase/migrations/20260714190000_harden_print_production_submission.sql

### supplier-bank-evidence

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
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-100528.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-101600.md
- `??` docs/SUPPLIER_BANK_APPROVAL_PACKET_20260703-102047.md
- ... 241 more entries omitted
