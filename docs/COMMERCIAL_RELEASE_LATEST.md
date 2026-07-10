# Commercial Release Report

Generated: 2026-07-10T01:18:38.703Z
Base URL: http://127.0.0.1:8083
Timeout: 25000 ms
Proof report: docs/COMMERCIAL_PROOF_LATEST.md
Changeset report: docs/COMMERCIAL_CHANGESET_LATEST.md
Application source report: docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md
Supabase report: docs/COMMERCIAL_SUPABASE_LATEST.md
Staged packet report: docs/COMMERCIAL_STAGED_PACKET_LATEST.md
Branch freshness report: docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md
Upstream reconciliation report: docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md
Owner merge-readiness report: docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md
Release owner sequence report: docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md
Deploy readiness report: docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md
Release handoff report: docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md
Status: PASSED

This is a local, read-only release artifact. It writes/updates local docs and build output only; it does not write products, prices, orders, SEO, POD or Supplier Bank data.

## Operator View

Cockpit: http://127.0.0.1:8083/admin/commercial-readiness?force_domain=webprinter.dk#automated-proof-chain
Primary command: `npm run check:commercial-release`
Proof report verifier: `npm run check:commercial-proof-report`
Changeset report verifier: `npm run check:commercial-changeset-report`
Application source report verifier: `npm run check:commercial-application-source-report`
Supabase report verifier: `npm run check:commercial-supabase-report`
Staged packet report verifier: `npm run check:commercial-staged-packet-report`
Branch freshness report verifier: `npm run check:commercial-branch-freshness-report`
Upstream reconciliation report verifier: `npm run check:commercial-upstream-reconciliation-report`
Owner merge-readiness report verifier: `npm run check:commercial-owner-merge-readiness-report`
Release owner sequence report verifier: `npm run check:commercial-release-owner-sequence-report`
Deploy readiness report verifier: `npm run check:commercial-deploy-readiness-report`
Release handoff report verifier: `npm run check:commercial-release-handoff-report`
Release report verifier: `npm run check:commercial-release-report`

## Repository State

Git status command: `git status --short --branch`
Worktree: dirty
Dirty entries: 422
Branch: ## ui-cleanup...origin/ui-cleanup [behind 1]
Status lines shown: 80/423

```text
## ui-cleanup...origin/ui-cleanup [behind 1]
M  .agent/HANDOVER.md
A  .github/workflows/supabase-data-api-grants.yml
M  .gitignore
A  .vercelignore
 M AGENTS.md
M  AI_CONTINUITY.md
M  HANDOVER.md
 M SYSTEM_OVERVIEW.md
M  config/supplier-bank/sources.json
AM docs/COMMERCIAL_APPLICATION_SOURCE_LATEST.md
AM docs/COMMERCIAL_BRANCH_FRESHNESS_LATEST.md
AM docs/COMMERCIAL_CHANGESET_LATEST.md
AM docs/COMMERCIAL_DEPLOY_READINESS_LATEST.md
AM docs/COMMERCIAL_OWNER_MERGE_READINESS_LATEST.md
AM docs/COMMERCIAL_PROOF_LATEST.md
AM docs/COMMERCIAL_RELEASE_HANDOFF_LATEST.md
AM docs/COMMERCIAL_RELEASE_LATEST.md
AM docs/COMMERCIAL_RELEASE_OWNER_SEQUENCE_LATEST.md
A  docs/COMMERCIAL_RELEASE_PACKET_LATEST.md
AM docs/COMMERCIAL_STAGED_PACKET_LATEST.md
AM docs/COMMERCIAL_SUPABASE_LATEST.md
AM docs/COMMERCIAL_UPSTREAM_RECONCILIATION_LATEST.md
M  docs/PIXART_IMPORT_RUNBOOK.md
M  docs/PRICING_READ_API.md
M  docs/PRODUCT_DETAIL_READ_API.md
A  docs/SUPPLIER_BANK_STATUS_REPORT_20260710-025335.md
A  docs/SUPPLIER_BANK_STATUS_REPORT_LATEST.md
A  docs/SUPPLIER_PRODUCT_BANK_PLAN_2026-07-01.md
M  docs/WEB_TO_PRINT_COMMERCIAL_READINESS_ROADMAP_LATEST.md
M  package-lock.json
M  package.json
A  pnpm-lock.yaml
A  scripts/check-commercial-application-source.mjs
A  scripts/check-commercial-branch-freshness.mjs
A  scripts/check-commercial-changeset.mjs
A  scripts/check-commercial-deploy-readiness.mjs
A  scripts/check-commercial-owner-merge-readiness.mjs
A  scripts/check-commercial-proof-report.mjs
A  scripts/check-commercial-proof.mjs
A  scripts/check-commercial-readiness-bindings.js
A  scripts/check-commercial-release-handoff.mjs
A  scripts/check-commercial-release-owner-sequence.mjs
A  scripts/check-commercial-release-packet.mjs
A  scripts/check-commercial-release-report.mjs
A  scripts/check-commercial-release.mjs
A  scripts/check-commercial-staged-packet.mjs
A  scripts/check-commercial-supabase.mjs
A  scripts/check-commercial-upstream-reconciliation.mjs
M  scripts/check-supabase-function-exposure.js
A  scripts/check-tenant-proof-routes.mjs
M  scripts/supplier-bank-cli.mjs
M  src/App.tsx
M  src/components/Banner2Showcase.tsx
M  src/components/Footer.tsx
M  src/components/Header.tsx
M  src/components/HeroSlider.tsx
M  src/components/ProductGrid.tsx
M  src/components/ProductMarquee.tsx
M  src/components/SEO.tsx
M  src/components/StorefrontProductTabs.tsx
M  src/components/TemplatesDownloadSection.tsx
A  src/components/account/AccountLoadingShell.tsx
M  src/components/admin/BannerEditor.tsx
M  src/components/admin/Dashboard.tsx
M  src/components/admin/LogoSection.tsx
M  src/components/admin/OrderManager.tsx
M  src/components/admin/ProductAboutSection.tsx
M  src/components/admin/ProductAttributeBuilder.tsx
M  src/components/admin/ProductOverview.tsx
M  src/components/admin/ProductPriceManager.tsx
M  src/components/admin/SiteDesignEditorV2.tsx
M  src/components/admin/SiteDesignPreviewFrame.tsx
M  src/components/admin/TenantSiteDesignV2.tsx
M  src/components/admin/ThemeSelector.tsx
M  src/components/consent/CookieBanner.tsx
M  src/components/consent/CookieSettingsDialog.tsx
M  src/components/content/ContactContent.tsx
M  src/components/content/ProductPriceContent.tsx
M  src/components/designer/EditorCanvas.tsx
... 343 more status lines omitted
```

## Gate Steps

| Status | Step | Duration | Evidence |
| --- | --- | ---: | --- |
| PASS | Commercial proof gate with report | 34.0s | Proof report written and tenant proof smoke passed. |
| PASS | Commercial proof report verifier | 0.0s | Local proof report structure and 12/12 PASS rows verified. |
| PASS | Commercial changeset report | 0.1s | Reviewable dirty worktree summary generated and verified. |
| PASS | Commercial application-source report | 0.1s | Runtime application-source review packet generated and verified. |
| PASS | Commercial Supabase report | 0.1s | Supabase grant/function exposure review packet generated and verified. |
| PASS | Commercial staged packet report | 0.1s | Git index packet checked for forbidden local/debug artifacts and held Supabase files. |
| PASS | Commercial branch freshness report | 0.1s | Step passed. |
| PASS | Commercial upstream reconciliation report | 0.1s | Step passed. |
| PASS | Commercial owner merge-readiness report | 1.3s | Temporary upstream index overlay proved the staged packet can be preserved for owner branch freshness work. |
| PASS | Production build | 7.3s | Vite production build completed with existing warnings only. |

## Post-Release Decision Reports

These reports are generated after the proof/build release summary exists, because they read the release proof and turn it into owner handoff decisions.

| Status | Step | Duration | Evidence |
| --- | --- | ---: | --- |
| PASS | Commercial release-owner sequence report | 0.0s | Ordered release-owner sequence and stop rules generated from the proof reports. |
| PASS | Commercial deploy readiness report | 0.1s | Push/deploy decision report generated from release proof, staged packet, branch freshness and owner sequence. |
| PASS | Commercial release handoff report | 0.0s | Release-owner handoff, rollback note template and post-deploy smoke route packet generated. |




## Required Evidence

- Commercial readiness binding guard passed.
- Owned tenant browser proof generated `docs/COMMERCIAL_PROOF_LATEST.md`.
- Commercial proof report verifier passed.
- Commercial changeset report generated and verified.
- Commercial application-source report generated and verified.
- Commercial Supabase report generated and verified.
- Commercial staged packet report generated and verified.
- Commercial branch freshness report generated and verified.
- Commercial upstream reconciliation report generated and verified.
- Commercial owner merge-readiness report generated and verified.
- Commercial release-owner sequence report generated after the proof/build summary and verified.
- Commercial deploy-readiness decision report generated after release-owner sequence and verified.
- Commercial release handoff and rollback template generated after deploy readiness and verified.
- Vite production build passed.
