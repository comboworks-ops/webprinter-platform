# Supporting admin workspace implementation — 2026-09-08

This is a source and evidence ledger for the supporting admin screens, not a production-readiness declaration. All 57 selected references exist and match the selection manifest. This implementation covers 42 supporting selection IDs; the parent task owns shell, products, orders/messages and the standalone designer.

New reusable components preserve original child components and handlers. Selection is local presentation state. CSS is scoped to `.admin-workspace` and uses theme tokens to keep retained dark mode usable.

## Verification and boundaries

- TypeScript transpile syntax checks passed for 46 TSX files; PostCSS parsed the stylesheet.
- Full project typecheck still fails on existing generated-schema/editor types.
- Parent agent performs fixture browser QA separately. Fixture data is synthetic; empty views and route rendering do not prove authenticated workflows.
- No network mutation, supplier request, payment, production submission, deploy, schema change or dependency change was performed.

## Legacy billing finding

`PodBetaling.tsx:29` creates a SetupIntent then writes `is_ready: true` and a `pm_demo_` payment method without Stripe confirmation. The status UI now calls that a demo; the protected POD v1 handler is unchanged. The transaction-history placeholder now says that history is not connected. POD3 remains explicitly parked.

The subsequent [live verification](ADMIN_LIVE_VERIFICATION_2026-09-08.md) found zero POD v1 products, imports, jobs, and billing profiles. Current checkout and Printproduktion use POD v2. This legacy-screen finding is not a demonstrated blocker for that current path.

## Per-selection coverage

| ID | Source layout status | Changes and limits |
| --- | --- | --- |
| `companyhub` | adapted existing workflow | Company selector becomes a horizontal group band; setup links become a two-column row overview; existing offices/members/catalogue/template tabs and mutations retained. Reference summary is adapted to existing v2/classic company workspaces; no synthetic company activity or money. |
| `modules` | implemented layout | Grouped free/premium selection list and selected module detail retain original ModuleCard actions. Internal admin navigation retains force_domain via withAdminWorkspaceContext. No installation or activation was executed. |
| `sitedesign` | adapted existing workflow | Workspace-height left tools and central live preview; obsolete global-sidebar effect removed; original draft/save/publish controls retained. Existing two-panel editor retained; extra mockup inspector is not a separate new feature. |
| `branding` | adapted existing workflow | Wider form pane with narrower live preview and workspace sizing; removed obsolete sidebar effect. Section tools remain existing controls, not the reduced mockup fields. |
| `brandingclassic` | implemented layout | Classic settings and sticky live preview now render beside each other; responsive stack. Draft persistence/publishing not exercised. |
| `icons` | adapted existing workflow | Three-column reference/product, real generator settings and generated proposals workspace. Reuses the exact existing job output, approval and apply/download UI in both current results and history; generation remains on this workspace. Actual reference thumbnails and missing-image product context are visible. Existing single-product generator, optional exact logo placement and output settings take precedence over mockup-only batch selection, free instruction, background and lighting controls. Image generation/approval/application not executed; test-engine fallback remains visibly disclosed. |
| `sites` | adapted existing workflow | Site package selector and existing selected package actions form a list/detail workspace; semantic h1. Existing package workflow/status area retained; no new site activation or dependency install. |
| `designlibrary` | implemented layout | Six resource tabs use local list/detail selection with existing cards and actions retained. Only real source thumbnails are shown; absent thumbnails use a file/image icon. |
| `formattemplates` | adapted existing workflow | Template detail appears left and selected template list right; existing edit dialog remains; semantic h1. Selected open-form mockup is adapted to the existing modal editor, which was not replaced. |
| `colorprofiles` | implemented layout | Profile register gains local selection and read-only metadata inspector. No profile upload/activation or proofing logic changes. |
| `seomanager` | implemented layout | Page selection left, metadata editing centre and existing search preview right. No Search Console statuses invented; persistence not exercised. |
| `aiseo` | adapted existing workflow | Existing identity cards use horizontal label/form sections and open spacing. Other tab workflows retained; AI requests not run. |
| `domain` | implemented layout | Current-domain priority strip; domain setup and guide side by side. DNS/domain changes not executed. |
| `subscription` | implemented layout | Current subscription summary beside available plan options. No billing or subscription changes executed. |
| `settings` | implemented layout | Open settings form with read-only live draft contact summary on the right. Summary is local form state, not saved confirmation. |
| `payment` | adapted existing workflow | Existing connection and configuration status becomes an open vertical register. Stripe setup was not exercised. |
| `tenants` | implemented layout | Searchable shop register with local selection and actual tenant ID/domain/date inspector; existing contact/visit links retained. Internal admin navigation retains force_domain via withAdminWorkspaceContext. No new impersonation action; synthetic QA does not prove RLS or tenant administration. |
| `updates` | adapted existing workflow | Versions register plus selected current form preview and original publish dialog. Existing workflow publishes directly; no new durable draft feature invented. |
| `tenantupdates` | implemented layout | Notification list/detail selection retains original read and update actions. Notification mutations not exercised. |
| `assets` | implemented layout | Existing pack selection, visual asset grid and selected icon inspector; original delete action visible. No insert/download actions invented where source lacked them. |
| `resources` | implemented layout | Resource category list/detail selection, actual media preview and visible keyboard/touch actions; original upload/publish/delete handlers retained. Deletion/publishing not executed. |
| `masterbranding` | adapted existing workflow | Narrower master tool pane and existing preview canvas under workspace chrome; obsolete sidebar hook removed. Three-pane screenshot adapted to existing two-pane editor; no new controls or template propagation semantics. |
| `mastertemplates` | adapted existing workflow | Template list and selected document detail with actual PDF open/download link, metadata, publication switch and delete action. Source has no template preview raster, so an honest file icon is shown rather than a fabricated design. |
| `tenanttemplates` | adapted existing workflow | Shared template list/detail UI also applies to tenant route. Source has no preview raster/user activity; no invented usage, authorship or team permissions. |
| `platformseo` | adapted existing workflow | Existing scope notice becomes priority strip; active SEO editor left and quick guide right. Mockup Search Console connection/health claims were not added; existing analytics workflows retained. |
| `supplierbank` | adapted existing workflow | Actual bank-product list/detail selection retains the existing evidence, review and import workflow. No source thumbnails available on BankProduct; import/scans/writes not run. |
| `production` | implemented layout | Production orders view now has local search, production/file/job-status filters, date sorting, selectable order register and right-side context plus the original guarded validation/submission/reconciliation UI. Existing production module tabs/default overview remain. Register appears on view=orders. Jobstatus and source-derived file status replace unsupported separate payment/file-version claims; no file preview URL invented. Supplier validation/submission not executed. Existing 14 orderSubmission tests pass. |
| `podadmin` | adapted existing workflow | Supplier product browser becomes list/detail selection with original configure/import wizard control. Legacy API/pricing/curation/publish tabs and handlers unchanged; no supplier request executed. |
| `podcatalog` | implemented layout | Actual published catalogue list/detail with original import action and images. POD v1 import behavior unchanged and not executed. |
| `podorders` | adapted existing workflow | Existing status groups now sit beside selected-job read-only summary; job IDs select locally; original approval/payment dialogs retained. No customer/product art invented when v1 job data lacks it; no payment/production action executed. |
| `podbilling` | adapted existing workflow | Priority payment status and split setup/guide; pm_demo payment IDs explicitly labelled demo; placeholder transaction section now says not connected. Legacy-only limitation: handleSetupPayment creates pm_demo_ IDs and marks is_ready without Stripe confirmation. No live v1 products, imports, jobs or billing profiles were found; current POD v2 is separate. |
| `pod2admin` | adapted existing workflow | Actual supplier product browser list/detail selection with existing configure and supplier links. No fixture-only supplier/pricing fields or new input model. |
| `pod2wizard` | adapted existing workflow | Variant selections use horizontal focused rows while preserving actual Vælg/Layout pricing-matrix controls. Generated selected image incorrectly depicts artwork composition; source POD2 row/column placement takes precedence. |
| `pod2catalog` | adapted existing workflow | Actual catalogue list/detail selection with original images/import controls. Mockup extra import options are not invented; existing import workflow retained. |
| `pod2orders` | adapted existing workflow | Existing approval/paid/submitted groups with local selected-job inspector and actual source metadata. Existing master forwarding, dry-run, confirmation and submission dialogs retained and not executed. |
| `pod2billing` | implemented layout | Payment status priority strip, actual Stripe setup area left and existing process guide right; master context guard retained. Billing copy now consistently states Webprinter-prisen, following POD2_README tenant-price contract; calculations and Stripe handlers unchanged. Stripe requests/setup/payment not exercised. |
| `pod3` | adapted existing workflow | Open status summary and link rail replacing card-heavy parked view. Internal admin navigation retains force_domain via withAdminWorkspaceContext. Intentionally parked placeholder; no automatic supplier integration or storefront feature added. |
| `readiness` | adapted existing workflow | Existing next-safe-action evidence section moved above metrics and styled as priority strip; read-only evidence sections separated. Large existing evidence report retained; does not become the small synthetic shop status mockup. No new readiness claims. |
| `pricingmodules` | implemented layout | Module options become an open row register with labels and controls side by side. No pricing schema/calculation changes. |
| `machines` | implemented layout | Gradient heading replaced by open heading; compact stats strip and row registers for machines/materials/inks/finishes/fees; existing edit actions retained. Pricing data and calculations unchanged. |
| `costtest` | implemented layout | Actual current job context left, parameter editor centre and existing calculation results right. Advisory calculation only; no data writes or pricing model changes. |
| `jobpool` | adapted existing workflow | Existing production settings and jobs left, sticky advisory production proposal right. Existing draft planning retained; no actual orders or production releases invented. |

See the adjacent JSON file for exact reference paths, source files and machine-readable status. `designer_1` is assigned to the parent; this agent did not alter the direct launch or protected standalone canvas.

## Fidelity follow-up

Icon Studio now uses the three-column workspace and Printproduction orders use a selectable register with filters and inspector. The existing 14 production submission-contract tests pass. Production overview remains the existing default tab; the register is under `view=orders`. Webprinter tenant-price terminology is corrected in POD v2 billing. Internal module, tenant-contact and POD3 links retain the selected shop context.
