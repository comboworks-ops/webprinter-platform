# Admin overhaul implementation — 8 September 2026

The approved Open Workspace direction is implemented locally across all 57 selected surfaces, plus the dashboard and shared navigation. This is a source-coverage statement, not a claim that all backend integrations or authenticated saves are verified.

Existing pricing calculations, POD v1/v2 contracts, manual product creation, tenant authorization and publishing confirmations remain the foundation. No schema migration, deployment, live payment, supplier submission, customer message or live product/pricing mutation was performed. Existing unrelated worktree edits and dependency/lock files were preserved.

## Review entry points

- Real local application: [admin login](http://127.0.0.1:8110/admin/login). It requires an actual admin session.
- Isolated visual review: [synthetic admin preview](http://127.0.0.1:8138/admin?force_domain=webprinter.dk). The yellow banner identifies synthetic records; all data mutations are rejected and external service requests are blocked. It is not a staging backend.
- Browser evidence and acceptance limits: [admin design QA](ADMIN_DESIGN_QA_2026-09-08.md).
- Connected-database findings and POD usage clarification: [live verification](ADMIN_LIVE_VERIFICATION_2026-09-08.md).

## What changed

- Two-row admin header and grouped navigation replace the sidebar. Links preserve the selected shop; changing shop remounts tenant-dependent editors. Existing route/server authorization remains authoritative. Keyboard menus, a skip link and narrow-screen navigation are included.
- Products use an open register, compact parallel creation form and focused configuration workspaces. Existing save, category, price, upload, publish and distribution handlers remain connected. Hash navigation cannot silently change the persisted pricing mode.
- Dashboard, orders and messages use the selected operational layout. Order saves require an acknowledged row before history/email side effects. Late saves and sends cannot close another order or clear a newer draft. Failed logout no longer claims success; the first unread count establishes a silent baseline.
- Supporting modules use selected collection/detail, register, editor/preview and priority layouts. Production orders retain guarded review/submission operations in the selected-order inspector.
- Print Designer opens inside admin using the existing canvas, tools, properties, layers and export dialogs. Its standalone customer layout remains available. The admin wrapper resolves the shop, checks saved-design ownership before mounting, and blocks an incompatible tenant save. Existing-design updates in embedded mode require a returned row. New header-link/logout/notification exits participate in the unsaved-change decision.

## Exact selection coverage

All 57 keys and PNGs were checked against the saved selection. Counts: 11 product surfaces, 3 order/message surfaces, 42 supporting surfaces, 1 embedded designer. Every row below links to its original chosen image; source evidence is recorded in the linked family report.

| Surface | Approved choice | Implementation record |
| --- | --- | --- |
| Opret produkt | [create_parallel](../tmp/admin-design-review-20260908/images/create_parallel.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Produktinfo | [product_info_editorial](../tmp/admin-design-review-20260908/images/product_info_editorial.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Produkt & Priser – Matrix | [matrix_context](../tmp/admin-design-review-20260908/images/matrix_context.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Bestilling og levering | [delivery_methods](../tmp/admin-design-review-20260908/images/delivery_methods.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Valgmuligheder | [options_workspace](../tmp/admin-design-review-20260908/images/options_workspace.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Felter | [fields_preview](../tmp/admin-design-review-20260908/images/fields_preview.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Produkt SEO & Meta | [productseo_first](../tmp/admin-design-review-20260908/images/productseo_first.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Tooltips | [tooltips_split](../tmp/admin-design-review-20260908/images/tooltips_split.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Storformat priser | [storformat_preview](../tmp/admin-design-review-20260908/images/storformat_preview.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Ordrer | [orders_1](../tmp/admin-design-review-20260908/images/orders_1.png) | [Order/message workspace](ADMIN_ORDERS_IMPLEMENTATION_2026-09-08.md) |
| Ordredetaljer | [orderdetail_1](../tmp/admin-design-review-20260908/images/orderdetail_1.png) | [Order/message workspace](ADMIN_ORDERS_IMPLEMENTATION_2026-09-08.md) |
| Beskeder | [messages_1](../tmp/admin-design-review-20260908/images/messages_1.png) | [Order/message workspace](ADMIN_ORDERS_IMPLEMENTATION_2026-09-08.md) |
| Firmahub | [companyhub_2](../tmp/admin-design-review-20260908/images/companyhub_2.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Shop moduler | [modules_1](../tmp/admin-design-review-20260908/images/modules_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Site Design V2 | [sitedesign_0](../tmp/admin-design-review-20260908/images/sitedesign_0.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Branding | [branding_0](../tmp/admin-design-review-20260908/images/branding_0.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Klassisk branding | [brandingclassic_1](../tmp/admin-design-review-20260908/images/brandingclassic_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Produktbilleder | [icons_0](../tmp/admin-design-review-20260908/images/icons_0.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Sites | [sites_0](../tmp/admin-design-review-20260908/images/sites_0.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Print Designer | [designer_1](../tmp/admin-design-review-20260908/images/designer_1.png) | [Embedded existing designer](ADMIN_DESIGN_QA_2026-09-08.md#designer-integration) |
| Design Bibliotek | [designlibrary_1](../tmp/admin-design-review-20260908/images/designlibrary_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Templatebibliotek | [formattemplates_0](../tmp/admin-design-review-20260908/images/formattemplates_0.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Farveprofiler | [colorprofiles_1](../tmp/admin-design-review-20260908/images/colorprofiles_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| SEO Manager | [seomanager_0](../tmp/admin-design-review-20260908/images/seomanager_0.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| AI SEO | [aiseo_2](../tmp/admin-design-review-20260908/images/aiseo_2.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Domæne | [domain_1](../tmp/admin-design-review-20260908/images/domain_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Abonnement | [subscription_2](../tmp/admin-design-review-20260908/images/subscription_2.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Indstillinger | [settings_0](../tmp/admin-design-review-20260908/images/settings_0.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Betaling | [payment_0](../tmp/admin-design-review-20260908/images/payment_0.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Lejere | [tenants_0](../tmp/admin-design-review-20260908/images/tenants_0.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Systemopdateringer | [updates_1](../tmp/admin-design-review-20260908/images/updates_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Indbakke | [tenantupdates_0](../tmp/admin-design-review-20260908/images/tenantupdates_0.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Ikonbibliotek | [assets_1](../tmp/admin-design-review-20260908/images/assets_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Ressourcer | [resources_1](../tmp/admin-design-review-20260908/images/resources_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Platform Master Design | [masterbranding_0](../tmp/admin-design-review-20260908/images/masterbranding_0.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Master skabeloner | [mastertemplates_1](../tmp/admin-design-review-20260908/images/mastertemplates_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Skabeloner | [tenanttemplates_1](../tmp/admin-design-review-20260908/images/tenanttemplates_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Platform SEO | [platformseo_1](../tmp/admin-design-review-20260908/images/platformseo_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Supplier Bank | [supplierbank_1](../tmp/admin-design-review-20260908/images/supplierbank_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Printproduktion | [production_0](../tmp/admin-design-review-20260908/images/production_0.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v1 administration | [podadmin_1](../tmp/admin-design-review-20260908/images/podadmin_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v1 katalog | [podcatalog_1](../tmp/admin-design-review-20260908/images/podcatalog_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v1 ordrer | [podorders_1](../tmp/admin-design-review-20260908/images/podorders_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v1 betaling | [podbilling_1](../tmp/admin-design-review-20260908/images/podbilling_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v2 administration | [pod2admin_0](../tmp/admin-design-review-20260908/images/pod2admin_0.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v2 variant og layout | [pod2wizard_2](../tmp/admin-design-review-20260908/images/pod2wizard_2.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v2 katalog | [pod2catalog_1](../tmp/admin-design-review-20260908/images/pod2catalog_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v2 ordrer | [pod2orders_2](../tmp/admin-design-review-20260908/images/pod2orders_2.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| POD v2 betaling | [pod2billing_1](../tmp/admin-design-review-20260908/images/pod2billing_1.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Flyer Alarm POD3 | [pod3_2](../tmp/admin-design-review-20260908/images/pod3_2.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Produktoversigt | [products_register](../tmp/admin-design-review-20260908/images/products_register.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Driftsklarhed | [readiness_1](../tmp/admin-design-review-20260908/images/readiness_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Kategorier | [categories_0](../tmp/admin-design-review-20260908/images/categories_0.png) | [Product workspace](ADMIN_PRODUCTS_IMPLEMENTATION_2026-09-08.md) |
| Prismoduler | [pricingmodules_0](../tmp/admin-design-review-20260908/images/pricingmodules_0.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Maskin-beregning | [machines_0](../tmp/admin-design-review-20260908/images/machines_0.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Kosttest | [costtest_2](../tmp/admin-design-review-20260908/images/costtest_2.png) | [implemented layout](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |
| Jobpulje | [jobpool_1](../tmp/admin-design-review-20260908/images/jobpool_1.png) | [adapted existing workflow](ADMIN_WORKSPACE_SURFACES_IMPLEMENTATION_2026-09-08.md) |

## Material limits and acceptance still required

- Authenticated acceptance is pending: the real browser had no verified admin session. Successful saves, reload-after-save, role/tenant enforcement by the live service, uploads, publishing, Stripe and supplier operations are not established by the synthetic fixture.
- Full-project TypeScript validation is not clean. Existing backup imports and generated-schema/editor typing errors remain; the build and focused test results are separate evidence.
- Legacy POD v1 billing still creates a `pm_demo_` ID without completing Stripe confirmation. The live check found zero v1 products, imports, jobs, or billing profiles; current checkout and Printproduktion use POD v2. This finding is limited to the unused legacy workflow and is not a demonstrated blocker for the current POD v2 path. See the [live verification](ADMIN_LIVE_VERIFICATION_2026-09-08.md).
- POD3 is intentionally parked. The selected UI does not create an automatic supplier integration.
- Branding/site iframes could not be verified end to end in the isolated fixture; their real preview routes and authenticated persistence require the real application session.
- The selected POD2 wizard image depicts artwork composition although the real feature configures a pricing matrix. The real matrix inputs and approval gates were preserved. Source-backed controls replace other illustrative screenshot data/actions where applicable.
- Browser Back/Forward while an unsaved designer is open remains the existing SPA history limitation. The original editor Back dialog, beforeunload warning and the new admin-header exits have safeguards. A wider route-blocking change has not been introduced into the existing router.

## Recovery

No database rollback is needed for this work. Reverse only this implementation’s source hunks and added workspace files if recovery is needed. Do not restore whole dirty files: Designer, product configuration and other files also contain prior unrelated work. No branch switch, bulk staging or commit was performed.

Primary shared additions: `src/components/admin/AdminWorkspaceNavigation.tsx`, `src/lib/admin/workspaceNavigation.ts`, `src/lib/admin/workspaceExit.ts`, `src/styles/adminWorkspace.css`, the product/order/supporting workspace styles, `WorkspaceCollection.tsx`, and `WorkspaceJobSummary.tsx`. Family reports list their own changed modules.
