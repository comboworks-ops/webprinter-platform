# Commercial Staged Packet Report

Generated: 2026-07-27T23:43:04.538Z
Git staged command: `git diff --cached --name-status`
Git status command: `git status --short --branch`
Branch: ## ui-cleanup...origin/ui-cleanup [ahead 50]
Status: PASS

This is a local, read-only staged-packet artifact. It does not stage, unstage, commit, push, deploy, write products, change prices, mutate orders, update SEO, touch POD data or write Supplier Bank data.

## Review Summary

Staged entries: 55
Forbidden staged files: 0
Staged file drift: 0
Deployable Supabase staged entries: 0
Held outside staged packet: 8
Branch behind remote: no

## Staged Bucket Counts

| Bucket | Entries | Review meaning |
| --- | ---: | --- |
| application-source | 54 | Runtime source changes that need build and tenant browser proof. |
| commercial-proof-chain | 1 | Cockpit, proof scripts, generated commercial reports or package wiring. |

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
| M | commercial-proof-chain | `scripts/check-tenant-proof-routes.mjs` |
| M | application-source | `src/components/Header.tsx` |
| M | application-source | `src/components/ProductGrid.tsx` |
| M | application-source | `src/components/StorefrontProductTabs.tsx` |
| M | application-source | `src/components/admin/AdminSidebar.tsx` |
| M | application-source | `src/components/admin/ImpositionPreview.tsx` |
| A | application-source | `src/components/admin/MachineCostWorkbench.tsx` |
| M | application-source | `src/components/admin/MachineForm.tsx` |
| M | application-source | `src/components/admin/MachinePricingManager.tsx` |
| M | application-source | `src/components/admin/ShopModules.tsx` |
| A | application-source | `src/components/admin/ShopTemplatePicker.tsx` |
| M | application-source | `src/components/admin/SiteDesignEditorV2.tsx` |
| M | application-source | `src/components/admin/SiteDesignPreviewFrame.tsx` |
| A | application-source | `src/components/admin/icon-studio/IconStudioOutputActions.tsx` |
| A | application-source | `src/components/admin/supplier-bank/SupplierUrlImportDialog.tsx` |
| M | application-source | `src/components/companyhub/AdminCompanyHubManager.tsx` |
| M | application-source | `src/components/companyhub/v2/AdminCompanyMembers.tsx` |
| M | application-source | `src/components/companyhub/v2/AdminCompanyOffices.tsx` |
| M | application-source | `src/components/companyhub/v2/AdminCompanyWorkspace.tsx` |
| M | application-source | `src/components/companyhub/v2/CompanyLocationsView.tsx` |
| M | application-source | `src/components/companyhub/v2/CompanyWorkspaceShell.tsx` |
| M | application-source | `src/components/designer/PDFImportModal.tsx` |
| M | application-source | `src/components/designer/PdfToolsPanel.tsx` |
| A | application-source | `src/components/designer/PhotopeaEditorDialog.tsx` |
| M | application-source | `src/components/product-price-page/MachineConfigurator.tsx` |
| M | application-source | `src/components/storefront/StorefrontHomeContent.tsx` |
| M | application-source | `src/components/storefront/StorefrontThemeFrame.tsx` |
| M | application-source | `src/hooks/useAdminCompanyWorkspace.ts` |
| M | application-source | `src/hooks/useBrandingDraft.ts` |
| M | application-source | `src/lib/api/featureFlags.ts` |
| M | application-source | `src/lib/branding/types.ts` |
| M | application-source | `src/lib/checkout/siteCheckoutSession.ts` |
| M | application-source | `src/lib/company-hub/assetService.test.ts` |
| M | application-source | `src/lib/company-hub/assetService.ts` |
| A | application-source | `src/lib/designer/photopeaBridge.test.ts` |
| A | application-source | `src/lib/designer/photopeaBridge.ts` |
| M | application-source | `src/lib/icon-studio/catalog.ts` |
| M | application-source | `src/lib/icon-studio/provider.ts` |
| M | application-source | `src/lib/icon-studio/service.ts` |
| M | application-source | `src/lib/icon-studio/types.ts` |
| M | application-source | `src/lib/modules/catalog.ts` |
| A | application-source | `src/lib/preview/siteDesignPreviewNavigation.test.ts` |
| A | application-source | `src/lib/preview/siteDesignPreviewNavigation.ts` |
| A | application-source | `src/lib/pricing/machineCostSimulator.ts` |
| A | application-source | `src/lib/pricing/machineProfileCatalog.ts` |
| M | application-source | `src/lib/sites/storefrontProductFlow.ts` |
| A | application-source | `src/lib/storefront/shopTemplates.test.ts` |
| A | application-source | `src/lib/storefront/shopTemplates.ts` |
| M | application-source | `src/pages/Designer.tsx` |
| M | application-source | `src/pages/FileUploadConfiguration.tsx` |
| M | application-source | `src/pages/PreviewShop.tsx` |
| M | application-source | `src/pages/admin/IconStudioPage.tsx` |
| M | application-source | `src/pages/admin/SupplierBank.tsx` |
| A | application-source | `src/styles/storefrontShopTemplates.css` |
| M | application-source | `vite.config.ts` |


## Held Outside Staged Packet

| Status | Path | Reason |
| --- | --- | --- |
| M | `supabase/.temp/cli-latest` | Local Supabase CLI state. |
| ?? | `.agents/` | Local tooling or repository automation outside this release packet. |
| ?? | `.codex/` | Local tooling or repository automation outside this release packet. |
| ?? | `deno.lock` | Local dependency lock change outside the reviewed packet. |
| ?? | `supabase/.temp/cli-latest 2` | Local Supabase CLI state. |
| ?? | `supabase/config 2.toml` | Space-suffixed duplicate config. |
| ?? | `supabase/functions/test-env/index 2.ts` | Space-suffixed test/debug Edge Function file. |
| ?? | `supabase/migrations/20260509120000_index_generic_product_prices_lookup 2.sql` | Held because it is not part of the commercial staged packet. |

## Required Verification

- `npm run check:commercial-staged-packet` must pass before a push/deploy decision uses the staged packet.
- `git diff --cached --check` must pass before commit.
- `npm run check:commercial-release` must pass after report regeneration.
- Held files such as `supabase/.temp/cli-latest`, `supabase/config 2.toml` and `supabase/functions/test-env/index 2.ts` must stay outside the staged packet unless explicitly approved.
