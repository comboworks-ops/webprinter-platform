# Site Design connection audit and local implementation — 21 September 2026

The shop now has one main design entry: **Site Design** at `/admin/site-design-v2`. The existing desktop workspace remains: pages and sections on the left, the real shop preview in the centre, and a stationary, independently scrolling inspector on the right. Common controls appear first; detailed controls are disclosed on demand.

**Latest status (22 September):** the full application has zero TypeScript errors;
ESLint is down to 1,980 errors, all explicit `any`, and 156 warnings. Forty-two
retired source files are preserved outside `src`. All 536 application tests pass;
the scoped candidate also passes 51 affected tests. Both candidates pass 31
synthetic browser checks and full production builds. A reconstructable scoped
Site Design release is prepared against the hash-verified recorded production
baseline. No deployment or live write occurred. See the latest continuation and
[release packet](SITE_DESIGN_RELEASE_PACKET_2026-09-22.md).

The earlier sections retain the evidence and limitations at each checkpoint. The final remaining-items table supersedes earlier open-item statuses.

## What each system is for

| Area | Purpose and data | Decision |
| --- | --- | --- |
| Site Design | Edit the selected shop. `TenantSiteDesignV2` resolves admin tenant context; `useBrandingEditor` works through the tenant adapter. | Main editor. |
| Branding / Branding V2 | A parallel route to another editor for essentially the same shop appearance. | Old `/admin/branding` and `/admin/branding-v2` now lead to Site Design, preserving query parameters. Duplicate navigation removed. |
| Classic Branding | `TenantBrandingSettings` / `UnifiedBrandingEditor`, retained as old source. | `/admin/branding-classic` now redirects to Site Design too. The old resolver and reset are no longer reachable through that route. |
| Platform Master Design | Master adapter writes separate `branding_template_draft`, `branding_template_published`, template history and saved designs on the master tenant. This is distinct from its shop's `settings.branding`. | Renamed **Designskabeloner til shops**, with purpose explained. Adapter memoized; uses the same Site Design editor. It does not automatically restyle every shop. |
| Shopdesign | Five approved print compositions and the retained older visual presets. | Approved designs stay first; older systems stay in advanced disclosure. Existing selected designs remain until the user changes them. |
| Produktvisning | Homepage/catalogue presentation. Alternative overview layouts replace the standard featured-product composition. | Kept. A clear explanation and a return-to-standard action expose where featured-product/gallery settings apply. |
| Bestillingsflow | Existing independent layout choices for product/pricing, checkout, proof, designer, payment and confirmation. | Kept; choices preserved by shared button changes and the standard homepage reset. |
| Forsidens banner | Shared copy or explicit per-image copy, images/video, transitions, autoplay, parallax, height and overlay. | New common controls connected to the existing banner renderer. |
| Ekstra banner / galleri | Existing Banner 2: independent promotional cards, references, images or logo galleries. | Main navigation, clearer mode labels, content first, styling/animation in disclosures. |
| Fordelsbjælke | Existing USP strip: short benefits, icons and optional animation. | Main navigation with plain-language labels and disclosed styling. |
| Featured product / its gallery / side panel | Product-specific homepage feature with its own image gallery and optional adjacent promotion. Uses the existing featured configurator and quote flow. | Kept separate from Banner 2. No duplicate gallery engine added. |
| Header & menu | Header appearance, menu preset, dropdown backgrounds, category/product text and hover colors. | Quick controls plus existing detailed HeaderSection. |
| Fælles knapper | Explicitly apply colors, hover colors, radius and size to primary banner/product/featured/order actions. | New shared control writes existing visual fields; no destinations, selections or prices change. |
| Logo, typography, footer, content blocks, lower information, page background | Existing shop content and branding sections. | Kept, retaining tenant identity and content. No blanket rewrite. |
| Saved designs / published history | Existing persistent snapshots and versions. | Kept separate from local undo. Loading a saved design is now an undoable, unsaved change. |

## Connections repaired

1. **The print banner bypassed the banner engine.** `PrintHero` previously used its own static first-image/text rendering. It now uses `HeroSlider` with the print composition. Existing transitions, video, image fit, slide timing, parallax and button destinations reach the actual new homepage. Inactive slides are inert; slideshow/video behavior respects reduced motion.
2. **Shared text and hidden old slide text competed.** Print themes default to shared copy. Per-image copy is an explicit choice; hidden authored slide text remains stored. Clicking a shared heading opens its visible text field rather than the old per-image field.
3. **Black dropdown colors could turn white.** `parseInt(channel) || 255` treated zero as missing. The shared conversion retains zero RGB channels. Kinetic's dark preset remains intact until dropdown colors are explicitly customized.
4. **The same button settings did not reach every relevant renderer.** Shared settings now reach banner CTAs, ProductGrid, newer ProductPresentation CTAs/text actions, the main featured CTA and the product order button. Filled buttons receive radius/padding; text links keep their existing visual role. Product order gradient fields are updated along with their base color. Conflicting compact-layout color and radius rules were resolved. Product-specific secondary, selection and payment-widget styles retain their separate purpose.
5. **“Fortryd” discarded the saved draft rather than undoing a step.** Local history now supports Undo/Redo, up to 50 snapshots. Consecutive typing in the same scalar field coalesces for 600ms; separate or multi-field changes remain separate steps. Loading a new editor resets that local history.
6. **Reset used an adapter action that immediately replaced published settings.** Site Design now applies `standardSiteDesign` to the local draft only. It restores Refined Familiar, standard homepage structure/product presentation, palette/fonts, header/dropdown colors and the main buttons, plus a still banner. It preserves shop identity, authored copy, selected products/quantities and independent order-flow choices. It uses the preset hero image and can be undone. Optional content is retained; this is not a deletion of shop content. Publication remains the existing explicit action.
7. **Sections were difficult to find.** Banner 2 and the USP strip are first-class sections. Selecting a section requests an in-preview scroll to the corresponding rendered block. Click-to-edit still opens the existing matching settings.
8. **Mobile preview shrank to a thumbnail.** Workspace previews now fit the available width and use the available height as a scrollable viewport, retaining actual 390px mobile / 768px tablet widths. The status displays the resulting viewport dimensions.
9. **“Live” was ambiguous.** The preview badge now says “Preview klar”; the editor separately reports unsaved draft versus published equality.

## Put aside, duplicated, or still limited

| Item | Finding | Treatment / remaining boundary |
| --- | --- | --- |
| `colors.dropdown` (“Dropdown base”) | The old generic field does not control the current product dropdown. | Removed from the current color UI; stored value retained. Use Header & menu. |
| `colors.hover` generic setting | Not a universal hover control. Individual components have their own fields. | Removed from the current color UI. Use Fælles knapper or section controls. Existing stored values remain compatible. |
| Parallel Branding V2 shop editor | Duplicate entry, separate navigation and loading path. | Redirected to the canonical editor. The master template now uses Site Design too; the duplicate editor source has no active route in the reviewed source graph. |
| Classic editor route | Compatibility code with an older tenant resolver and destructive reset semantics. | Source retained; route redirects to Site Design. Old reset and tenant resolver are no longer exposed by that route. |
| `PreviewInteractionManager.tsx` | Not the active message receiver for `/preview-shop`; the active path is `PreviewShop.tsx`. | Left unchanged. No evidence justifying hard deletion of all possible consumers. |
| Earlier theme/layout presets | Some overlapping controls are intentional preset choices; individual old geometry fields can be overridden by selected print compositions. Print compositions own featured position, box scale and spacing; controls for those overrides are hidden for print presets. Image fit/scale and catalogue columns are now connected. | Retained under older/advanced choices. Not presented as universally working overrides; no automatic rewrite of saved designs. |
| Featured gallery under alternative product presentations | The alternative overview replaces that whole standard featured block. Its saved gallery is not lost. | Explain the relationship and allow an explicit switch back to the standard presentation. |
| Empty files | No zero-byte files found in the reviewed admin component and branding-library directories. | No speculative deletion. This is not an exhaustive orphan-file audit of every subsystem in the repository. |
| Whole-site button claims | Secondary controls, product choice states, the side promotion and checkout/payment/designer-specific actions may have independent styles. | Continuation connected side promotion, checkout, proof, payment and the standalone designer primary actions. Secondary actions and selection states remain separate. |
| Undo scope | Branding draft edits only; session-local, not a database transaction/history rollback. | Does not undo asset uploads, product/pricing editor mutations or external operations. |

## Data flow and preservation

`SiteDesignEditorV2` → local branding history → `SiteDesignPreviewFrame` → existing `BRANDING_UPDATE` messages → `PreviewShop` / `PreviewBrandingProvider` → the real theme, header, banner, catalogue and product components.

The existing tenant adapter still saves `settings.branding.draft` and publishes `settings.branding.published`, through the existing conflict-checked persistence path. Master templates retain their separate storage keys. The first two passes did not change authorization or RLS; the later remaining-items pass below describes the role-resolution repair and isolated library permission migration. Pricing formulas, POD tables and the publishing backend are unchanged.

New optional visual fields are additive (`hero.heightPx`, `hero.textSource`, product CTA font/padding/radius and featured hover color). Existing colors, media, links, catalog IDs and order selections survive shared edits. The legacy gradient fields consumed by the order renderer are now represented in its defaults as well.

## First-pass verification

- **27 focused tests pass**: local history/coalescing, immutable common edits, preservation of IDs/copy/quantities/secondary states, standard reset/undo, zero-channel colors, print preset selection/inheritance, dropdown choices, product presentations and order-flow choices.
- **23 edited TS/TSX files** inspected by standalone TypeScript transpilation: no syntax/transpilation diagnostics. This is not a complete semantic type check.
- Real browser preview: banner title updates, Undo/Redo; black dropdown computed `rgb(0, 0, 0)` with white product text; shared CTA green plus 18px font/18px padding; gallery mode/benefits text; local reset to `#087FC5` and undo to the prior green draft; click-to-edit from logo back to shared banner heading.
- Parallax wiring: “none” yielded no image-parent transform; “Blød dybde” produced `translate3d(...) scale(1.12)` in the actual iframe.
- New product overview text action rendered the shared green and 18px text size. The real Aluminium product order action rendered a green gradient, 18px font/padding, 10px radius, then 0px when square corners were selected. No order/checkout action was clicked.
- Editor document width equals scroll width at **1440, 1280, 1024, 768, 390 and 320px**. Actual mobile/tablet preview documents were 390/768px wide with no horizontal overflow. This checks geometry, not every control at every width or a physical device.
- `/admin/branding-v2` was browser-verified to resolve to `/admin/site-design-v2`.
- Production build stopped at `transforming...`; full TypeScript and ESLint checks also stalled without results. Local dependency files include macOS `dataless` placeholders (confirmed for ESLint's API file). Those checks were stopped; no successful full build/lint/type-check is claimed.
- The master-template URL redirected to the admin overview in the current session under its existing access gate. Its purpose/storage distinction was verified in source; the template editor itself was not browser-certified.
- Hosted save/publish/reload, uploads, all video files, all legacy presets, every menu variant and the complete checkout/payment flow remain unverified in this task.

Screenshots and a selective source patch are in `output/site-design-audit-2026-09-21/`. These are local draft preview evidence, not evidence of publication.

## Implementation and rollback

New files: `draftHistory.ts`, `siteDesignControls.ts`, its tests and `SiteDesignQuickControls.tsx`. Existing renderers and workspace components were adjusted rather than replaced with another editor or storage model.

Use the selective `implementation.diff` in the evidence folder when reviewing or rolling back the first pass. It is generated against the pre-task copies of edited files, not against Git HEAD; the repository already contained extensive unrelated changes. Revert only these hunks after checking subsequent edits. The first pass had no database changes. See the final section for the later isolated migration. Do not reset whole files from HEAD or remove the existing design/publishing/pricing work.


## Continuation completed after approval

- **One editor:** master templates now use `SiteDesignEditorV2`; Classic Branding routes to it. A denied master session displays a useful explanation instead of silently redirecting. The tenant library is named **Designskabeloner**. Master **Publicér** updates `branding_template_published`; **Gem som skabelon** writes the separate `premade_designs` library, from which a shop can apply a template to its draft. These are different operations, now explained in the dialog. Existing paid-template logic and access rules were preserved.
- **Relevant product controls:** catalogue column/layout selections reach `PrintCatalogSection` and `ProductGrid`. Print featured images consume image fit and scale. Geometry controlled by the selected composition is hidden in the inspector. Repeated image-size and color controls are hidden for print presets; the earlier controls remain available at the click-to-edit targets.
- **Readable banner defaults:** choosing one of the five print presets sets appropriate light/dark text and clears the legacy dark overlay. Custom inherited values stay preserved. Existing explicitly saved designs are not silently migrated; reselecting a preset applies its corrected defaults.
- **Shared primary actions:** a small shared button component connects checkout, file/proof approval, payment submit, confirmation return, and standalone designer checkout to published or preview branding. Side-promotion buttons use the same visual tokens. The embedded administration designer keeps its existing toolbar button. No payment, upload, order, pricing or selection handlers were changed. Square corners now survive the legacy layout CSS.
- **Independent previews:** embedded frames accept branding from their own parent only. Each Site Design editor has a separate channel for detached previews. A master editor, another shop editor, or another editor for the same shop cannot replace this preview through the old shared channel. Existing legacy detached previews keep the legacy channel for compatibility. This is preview isolation, not an authorization mechanism.
- **Type/lint cleanup:** fixed the undo action type and represented existing visual button fields explicitly; completed hook dependencies for stable draft setters.

### Continuation evidence

All write tests used a temporary localhost fixture with fabricated identities, local browser storage, a substituted network client and blocked API/form side effects. It did not load project environment files. Only synthetic design records were saved/published. No hosted shop/template was saved or published.

1. Changed the test-shop banner to **Connected design test**, set primary buttons to green, large, square corners; saved a draft and reloaded. The separate customer view still showed the earlier publication. Published the synthetic draft and reloaded the customer view; it then showed the new title and green button.
2. Actual public test-shop hero button: `rgb(0, 85, 51)`, 18px font, 18px vertical padding, 0px radius. Checkout and disabled payment preview actions consumed the same styling. No payment action was performed.
3. Loaded the master editor through its role gate using a fabricated master account. Saved **Master template test**, reloaded, published locally and reloaded again. The editor reported equality with the published template. The test shop continued to show **Connected design test**.
4. Reproduced and fixed preview cross-talk with multiple editors open. After the fix the shop showed its own title, the master retained its own title, and a detached shop preview followed subsequent shop edits only. Later draft edits did not alter the separately loaded published shop.
5. Selected all five print presets: Familiar rendered white heading text; the four lighter compositions rendered `rgb(11, 25, 51)`. At a 1280px preview width, each had 1280px scroll width. This verifies heading defaults and geometry, not every image/media combination.
6. Selecting **5 kolonner** produced five actual catalogue grid tracks, each approximately 221.44px at 1280px. Choosing **Fuld flade** changed the featured image's computed `object-fit` to `cover`.
7. **43 focused tests pass**, including persistence separation, zero-row/concurrent-write failures, history, shared styles and reset preservation. Full semantic checking completes using fresh dependencies in a temporary source copy: **368 diagnostics versus 372 in the before snapshot, no introduced diagnostic signatures**. This is still a failing repository-wide type check, not a green build.
8. New/shared control files pass focused lint. The touched-file comparison reports 429 diagnostics versus 430 before, with no new rule/message signatures after normalizing line numbers. Remaining repository lint debt is not treated as a pass.
9. Production build remains blocked while reading macOS cloud placeholders such as `bannere.png` and `displayplakater.png`. The existing manifest and lockfile also disagree, so `npm ci` does not complete. A fresh temporary dependency install allowed lint/type checks; no replacement lockfile or dependency tree was applied to the repository. The isolated UI reports missing assets instead of waiting for cloud downloads. The unavailable `precise-hero.webp` artwork is not visually certified.

### Open items at the second-pass checkpoint (superseded below)

| Item | Current boundary |
| --- | --- |
| Hosted master account access | The connected account still receives the master-access explanation, including with explicit platform context. The navigation and role hook disagree in this session; the precise server/session cause remains unverified. Permission checks were not weakened. |
| Template library handoff | The `premade_designs` save/apply paths are connected in source and use the unified workspace. Hosted library writes, paid templates and assignment to another shop have not been exercised. |
| Full production build and clean repository checks | Cloud asset hydration, manifest/lock reconciliation, and the existing type/lint backlog remain. No production-ready claim. |
| Media and menu coverage | Banner engine, parallax, gallery mode, dropdown colors and five preset headings were checked. Every video file, every legacy effect/menu preset and every device combination were not. |
| Real commercial flow | Hosted save/reload/publication, actual upload/proof/payment/order completion and tenant permission acceptance remain separate checks. |
| Retired duplicate editors | `BrandingEditorV2`, `TenantBrandingSettings` and `UnifiedBrandingEditor` are retained source; current routes no longer mount them. Their removal can be a later source-cleanup change. |
| Old preview manager | `PreviewInteractionManager` is not the active Site Design receiver. Retained without claiming the entire repository is free of indirect consumers. |
| Old generic colors | `colors.dropdown` and generic `colors.hover` remain stored for compatibility but are not presented as controls for the current menu or all hover states. |
| Full repository orphan audit | No empty files were found in the reviewed branding/admin area in the first pass. This work does not certify every file in every subsystem as useful. |

### Continuation review and rollback

`output/site-design-audit-2026-09-21/continuation.diff` contains the second pass against its own before snapshots; `continuation-files.json` lists the files. The first-pass `implementation.diff` is retained. Review/reverse the continuation first, then the first pass if needed, checking subsequent changes in each file. Never reset these files wholesale to Git HEAD in this shared dirty checkout. No database rollback is needed.

## Remaining-items pass — access, library, commercial boundary and build

### Fixes completed

1. **Connected master access:** the deployed `verify-admin` v22 returns `isAdmin`, but omits `isMasterAdmin`. The hook treated that omission as an explicit false and never read the account's existing `master_admin` role. It now uses the existing role lookup when the response lacks master evidence. A modern explicit false remains false; other-shop and unresolved tenant contexts still cannot expose platform tools. The old localhost/email shortcut was removed. No role was granted and no edge function was deployed. The real connected account now opens **Designskabeloner til shops** and reads both saved hosted templates. The tab was restored to Site Design with **Preview klar** and no unsaved edit.
2. **Assigned templates reach shops:** `loadShopDesignLibrary` combines public/visible templates with this shop's assignments, including private assigned designs, without duplicates. A failed load reports an error; responses from a previous editor entity cannot replace the current library. Assignment now checks both the database error and returned tenant/design IDs before showing success. Duplicate assignments use the existing `(tenant_id, design_id)` conflict key.
3. **Unsupported payment no longer succeeds:** `processPurchase` previously inserted `completed` purchase rows from the browser without contacting a payment provider, then cleared the pending queue. It now returns false without writes. Unpurchased/unassigned paid templates and the payment confirmation button are disabled with a clear Danish explanation. Explicit master assignments remain usable without inventing a purchase. Existing purchase history is retained; both hosted environments currently have zero purchase rows. This is a safety repair, not a completed billing integration.
4. **Library permission repair prepared and isolated-tested:** the live `premade_designs` policy permits all operations for any authenticated user. The new migration adds restrictive boundaries around the existing policies: visible templates can be read publicly; shop managers can read their assigned private templates; only platform admins can edit or grant templates; browser clients cannot manufacture purchase records. Explicit grants/revokes accompany RLS. It reuses existing security predicates and creates no table or function.
5. **Manifest/lock mismatch fixed:** `package-lock.json` was reconciled to the unchanged `package.json`. A clean install in a temporary directory installed 614 packages with lifecycle scripts disabled. Existing application dependency requirements were not changed.

### Hosted versus local verification

The permission migration `20260921160543_site_design_library_access.sql` was applied **only** to the existing `webprinter-launch-test` backend (`cyurochbkxggcobnxaxq`), where the MCP migration ledger records version `20260921161413`. Do not replay it there under the different local timestamp; reconcile migration history during a planned release. The shared live project (`ziattmsmiirfweiuunfo`) was inspected read-only and still has the old policy. Live library counts remain two templates, zero assignments, zero purchases and zero pending items.

- **57 focused application tests pass**, including seven role-hook cases, three unsupported-payment cases and four library-query/assignment cases in addition to the prior 43.
- **27 local PostgreSQL assertions pass** against the exact candidate migration. The harness reproduces unauthorized template editing under the old policy, then checks public visibility, private assignments, delegated admins, platform writes, cross-shop denial and rejection of forged purchases.
- **Isolated hosted transaction acceptance passes:** using existing fabricated identities and PostgreSQL roles/JWT claims, a master creates visible/private templates and idempotently assigns one to shop A; its owner reads both; shop B/customer/anonymous contexts cannot read the private template; non-master writes and forged purchases fail. The real branding compare-and-swap RPC saves/reloads a draft without changing publication, rejects stale and cross-tenant writes, and publishes for the authorized owner. An authorized customer can then read that publication. All test DML was rolled back; the three tested library/purchase tables contain zero rows afterward. These are database/RLS checks, not signed-session HTTP or browser upload acceptance.
- **Synthetic browser handoff passes:** the real editor shows free, private-assigned and paid templates; the paid action is disabled. Applying the assigned template, saving, reloading and publishing updates only the fixture's customer view. A seeded unpaid item opens the honest disabled-payment dialog. The fixture uses fabricated identities, local browser storage, no project environment files and blocked external/API/form side effects.
- **All nine selectable menu presets checked at three preview widths:** 1280px desktop, 768px tablet and 390px mobile, with no document horizontal overflow in 27 combinations. Mobile uses the shared drawer. This checks menu opening and geometry with a small synthetic catalogue, not deep-catalogue navigation or physical-device usability.
- **Production-mode frontend build passes in 14.33 seconds in a recovered source copy.** The checkout contains 101 dataless files under `src`/`public`. They were recovered only into a temporary build tree: all 95 active recovered files match SHA-256 values in the existing September 16 source manifest; six unused backup source files match their Git-index blobs. The build uses the current readable application source and a fresh install from the corrected lock. Original cloud placeholders are untouched. Existing large-bundle warnings remain. This is not a deployed build or a full Vercel/server-function build.
- **No new type/lint diagnostic signatures:** in the same recovered environment, semantic TypeScript is 386 before and 386 after; the six touched TS/TSX paths have 59 lint diagnostics before and 55 after. Counts differ from the prior environment because recovered backup files and dependency state differ; only same-environment deltas are compared. Repository-wide checks still fail on existing debt. The existing grants checker passes when scoped to this migration; a complete migration-folder scan is still affected by unrelated cloud files.

Evidence is in `output/site-design-audit-2026-09-21/remaining/`: application test output, PostgreSQL harness, hosted acceptance SQL, verification notes, build/install logs, asset recovery/provenance manifests, type/lint comparisons and the selective patch. No credentials are included.

### Remaining items at the preceding checkpoint (superseded below)

| Item | Current boundary and next action |
| --- | --- |
| Live library permission repair | **Release item:** live still allows broad authenticated template writes. The exact migration is tested and installed only on the isolated backend. Review and approve its live rollout; do not mistake the local UI fix for server enforcement on live. |
| Hosted library UI writes / thumbnails | Connected master access and existing-library reads pass; isolated database writes/assignment/RLS pass. Actual signed-session save, assignment, reload and thumbnail upload through the hosted UI still need acceptance. No live template or asset was created. |
| Real design billing | Unsupported and visibly disabled. Requires a server-created payment, provider confirmation and server-only purchase finalization before enabling; no payment provider account, fee model or webhook has been assumed. |
| Clean ordinary checkout/release build | Lock mismatch resolved and recovered-copy production-mode build passes. Hydrate/restore the original cloud placeholders, complete the deployment/server build, and address the existing type/lint backlog before calling the whole repository clean. |
| Media / long menus / devices | Nine menu presets pass geometry at three preview widths. Every video, old effect, long catalogue, keyboard path and physical-device combination remains outside completed coverage. |
| Real commercial flow | Isolated branding persistence and tenant denials pass. Actual file upload, proof, payment, order completion, email/fulfillment and signed-session end-to-end acceptance remain separate. Their existing handlers and pricing were unchanged. |
| Retired duplicate editors and old preview manager | Source retained; existing routes use the canonical editor. Removal and a complete orphan audit remain separate cleanup, not a reason to remove unverified consumers. |
| Old generic colors / selected presets | Stored compatibility values and independent order-flow selections remain. No automatic migration of authored designs. |

### Remaining-items review and rollback

`remaining/remaining.diff` is against this pass's before snapshots; `remaining/changed-files.json` records hashes. Review its hunks before the second- and first-pass patches. Preserve unrelated source edits; do not restore whole files from Git HEAD. Reversing the payment safety fix would restore fake purchase success and should not be used as a normal rollback.

At this checkpoint the only hosted schema change was the isolated permission migration and transactional test records had been rolled back. The signed-session acceptance below subsequently retained named private fixtures. If a legitimate library action needs repair, keep the restrictive boundaries, pause library editing and apply a targeted forward fix. Do not restore unrestricted authenticated writes. No live backend rollback is needed because live was not changed.

## Signed-session hosted acceptance and complete local build

### Additional preview repairs

- The legacy master-preview redirect could replace the canonical editor's explicit master tenant with an arbitrary shop owned by the operator. `PreviewShop` now preserves the explicit Site Design context. This changes preview routing only; tenant resolution and database permissions are unchanged.
- Thumbnail capture used a document-wide iframe query and a shared response resolver. Capture is now scoped to the current editor's iframe, origin and unique request ID, with a separate listener/timer per request. Stale responses and other frames cannot finish a later capture. Only bounded JPEG data URLs are accepted. Preview control messages also require the expected same-origin parent/frame. Three regression tests cover wrong sources/origins/IDs, stale timeouts and invalid responses.
- Connected localhost 8113 still renders the master preview correctly. Clicking its hero heading with click-edit enabled opens the matching Banner inspector; click-edit was switched off afterward. No content, saved draft or publication was changed there.

### Real hosted workflow evidence

The localhost 8128 acceptance copy used the current application against the existing isolated project `cyurochbkxggcobnxaxq`. The public Supabase key and genuine Auth sessions for existing `.invalid` fixture accounts exercised real database and storage policies. A local-only launcher signs in the allowlisted fixtures and verifies their returned user IDs; it does not mock the client or use a service-role key. This verifies signed-session behavior, not the normal login form, signup or recovery UI.

1. The master saved the private library template **Site Design hosted thumbnail 2026-09-21** with draft hero text **Hosted Site Design acceptance**. Record `ad38e83a-4803-4e41-a1cb-153d16f5e633` persisted, and its uploaded JPEG loaded at 640 × 360 (35,753 bytes).
2. The master assigned that template to **Launch TEST shop A** through the actual library UI. Its genuine owner could read and apply it; the other shop owner, customer and anonymous client could not read the private template row.
3. Shop A applied the template, saved its draft and reloaded successfully. Database readback showed the saved draft title while published branding remained unchanged. The existing publication confirmation then wrote the isolated published branding, and a separate anonymous browser displayed the title on the customer route.
4. The genuine shop owner restored Shop A's exact original settings through the existing conflict-checked branding RPC. A full object equality assertion confirmed restoration. Shop B's branding was unchanged.
5. Authenticated API probes denied an owner's template edit and assignment, denied a forged completed purchase, and verified the thumbnail persisted. All 13 checks passed. No purchases, emails, orders, supplier changes or real payments were created.

Two clearly named private template fixtures remain on the isolated backend: the working-thumbnail record above and `31181fcc-224b-4d34-9374-cc47b7d518a2` from an initial harness-CSP failure to read a JPEG data URL. One assignment to Shop A and one thumbnail remain for review. These are separate from restored shop branding. Existing `product-images` storage is public by URL; private library-row access does not imply that the thumbnail binary is private. No live template or asset was created.

### Verification and build scope

- **64 focused application tests pass.** This includes the prior suite, four preview-navigation checks and three new capture checks.
- Same-environment TypeScript diagnostics: **386 before / 386 after**, no introduced signatures. Across this pass's four source/test paths, lint is **45 before / 44 after**, no introduced signatures. These counts do not mean repository-wide checks are green.
- **Full local `vercel build --prod` passes**, including the frontend and `favicon`, `llms`, `robots`, `sitemap`, `storefront-brandmark` and `tenant-shell` edge routes. This uses a recovered source tree, current readable source, a fresh dependency installation and cached September 16 Vercel project settings. No deployment occurred; deployed runtime behavior is outside this result.
- The prior 101 `src`/`public` placeholder recoveries retain their recorded provenance. One additional dataless file, `api/sitemap.ts`, was recovered into the temporary tree from its index blob and matched the release manifest SHA-256 `57e088c21f2ab253f13c8bd21df434a321c2689309aa8286e9c64c125736a19b`. Original cloud placeholders remain untouched. Existing bundle warnings remain.
- Evidence, credential-free acceptance scripts, comparison results, build logs and the selective source/docs patch are in `output/site-design-audit-2026-09-21/hosted/`. The temporary local test server is stopped after acceptance; the user-facing connected editor remains at `http://127.0.0.1:8113/admin/site-design-v2`.

### Remaining items before the approved rollout (superseded below)

| Item | Current boundary and next action |
| --- | --- |
| Live library permission repair | **Awaiting explicit approval.** Automatic approval review rejected applying `20260921160543_site_design_library_access.sql` to live `ziattmsmiirfweiuunfo`: the user had authorized isolated testing, not this exact persistent production RLS/grant change and its blast radius. The reviewed migration restricts edits/assignments to master admins, scopes private library reads and blocks browser-created purchase records on `premade_designs`, `tenant_premade_designs` and `tenant_purchases`. It changes permissions, not template data or shop publication. Live still has its prior broad authenticated write policy. Do not retry without approval. |
| Real design billing | Unsupported and disabled. No instruction to implement a provider/fee/webhook flow was received. Keep disabled until server-confirmed payment and purchase finalization are implemented and accepted. |
| Original checkout hydration / repository debt | Recovered-copy frontend and server build now pass. Restore original cloud files and address existing type/lint diagnostics separately before calling the ordinary checkout clean. |
| Production frontend rollout | No deployment or live branding/library write acceptance performed. The local build and isolated workflow results do not certify a deployed release. |
| Other commercial workflows | Actual order file upload, proof, payment, order completion, email/fulfillment, normal login/recovery UI and physical-device acceptance remain separate. Pricing and those handlers were unchanged. |
| Media / long menus / devices | Prior nine-preset geometry checks remain valid within their synthetic catalogue scope. Comprehensive video, old effects, large/deep catalogue, keyboard and physical-device coverage remains open. |
| Retained legacy source and compatibility | Retired duplicate editor source, legacy preview manager and authored compatibility values remain; selected order-flow presets are preserved. Deletion still requires consumer/orphan review. |

### Review and rollback

`hosted/hosted.diff` compares this pass with its before snapshots; `hosted/changed-files.json` records file hashes. Reverse only the relevant hunks, preserving the extensive unrelated worktree edits. Reverting preview fixes may restore wrong-tenant presentation and capture cross-talk. Hosted shop settings have already been restored through their owner session. Retained isolated templates are clearly named review fixtures; no live data rollback is needed. The prior restrictive permission migration must not be rolled back to unrestricted writes.


## Approved live permission rollout and safe remaining-item checks

The user approved the next steps provided they do not risk destroying existing work. The previously rejected live action was retried only after that explicit approval. This approval does not turn build/test results into a guarantee of zero release risk.

### Live repair completed

- Applied the exact accepted SQL from `supabase/migrations/20260921160543_site_design_library_access.sql` to `ziattmsmiirfweiuunfo`; live ledger version is **20260921185756**, name `site_design_library_access`. The isolated ledger remains **20260921161413**. These are the same SQL under different hosted timestamps; do not replay either migration.
- Fresh preflight confirmed unchanged role predicate definitions between isolated and live and no existing live copy of the migration. After application, all 21 policies and 32 role/table grants on the three affected tables match the tested isolated backend exactly. All three tables retain RLS.
- Before/after fingerprints match for all rows in `premade_designs` (2), `tenant_premade_designs` (0), `tenant_purchases` (0), and settings for every tenant. No template, purchase history, shop design or role row was changed.
- A read-only transaction under `anon` reads both visible templates and no hidden rows. Anonymous template inserts and assignment reads are denied at the grant level. Anonymous/authenticated purchase inserts and authenticated purchase updates/deletes are denied. No live denial test attempted a data write.
- The real connected master account opened **Mine skabeloner** and read **flagbiksen.dk** and **GREENPRINT**. The ordinary Site Design editor reloaded to **Preview klar**, with no pending draft edits. No live library write or shop publish was used for verification.
- The post-migration security advisor output has no findings mentioning these three tables or the Site Design policies. This is not a claim that the whole project's advisor report is empty. The repository grants checker passes when scoped to the reviewed migration; its full changed-migration scan still stalls on unrelated cloud files.

### Expanded menu and banner checks

A temporary localhost 8129 fixture mounted the actual application against synthetic local data only: **120 products**, **12 categories**, four child categories and long Danish names. Backend mutations throw; external connections and form submissions are blocked. This source is retained under the rollout evidence, outside the production entry point.

- Nine selectable menu designs opened by keyboard at 1280, 768 and 390 pixels: **27 combinations**, no document horizontal overflow, correct selected preset, desktop/tablet panels within the viewport.
- Search found product 120 on desktop and mobile. Expanding mobile category 4 exposed child category 12 and product 120. Product links retained the fixture tenant ID. Desktop Escape closed the menu and returned focus to its trigger; mobile Escape collapsed its trigger.
- Six banner transitions (`fade`, `slide`, `zoom-fade`, `cross-zoom`, `soft-wipe`, `ken-burns`) passed Next/Previous checks at 390 and 1280 pixels: **12 combinations**. Both images loaded, the active image changed correctly, Previous restored the first slide, inactive images remained `aria-hidden` and inert, and no document horizontal overflow appeared.
- This covers observable state, bounds, image loading and selected keyboard paths. It does not certify animation smoothness, all keyboard paths, video playback, reduced-motion OS settings or physical devices. Temporary viewport changes were reset and the fixture server stopped.

### Legacy-source decision and cloud availability

A TypeScript import-graph walk from `src/main.tsx` found **564 reachable modules** in the recovered build tree. `TenantBrandingSettings`, `UnifiedBrandingEditor`, `BrandingEditorV2`, `BrandingSettings` and `PreviewInteractionManager` are outside that graph. `TenantBrandingSettingsV2` remains a reachable redirect through `Admin.tsx` and must stay. Static and literal dynamic imports are covered; external/nonliteral consumers are not ruled out. The unused files are deliberately retained under the user's no-destruction condition; no deletion is needed for the canonical editor to work.

Of the 102 previously identified build placeholders, **43 are currently available and 59 remain dataless**. macOS accepted explicit download requests for the remaining files, but the sampled sitemap still reports `NotDownloaded`, `downloading=false`, with no surfaced error. No placeholder was overwritten with older Git/release bytes. The safe recovered build remains available while original-file hydration needs the user's iCloud service to complete downloads. The download request used Apple's documented [FileManager API](https://developer.apple.com/documentation/foundation/filemanager/startdownloadingubiquitousitem(at:)).

Evidence is in `output/site-design-audit-2026-09-21/rollout/`: before/after live metadata and fingerprints, read-only probe, migration identity, browser results and synthetic fixture, retained-source graph, scoped grants check and cloud-file inventory. No credentials are included. This pass changed no application source or pricing logic.

### Remaining items after permission rollout (superseded below)

| Item | Status / next concrete requirement |
| --- | --- |
| Live library permission repair | **Completed and verified**, without changing data. Keep restrictive boundaries; repair any legitimate denied operation with a targeted forward change rather than restoring broad writes. |
| Hosted template workflow | **Completed on isolated hosted backend** in the preceding pass. Live master reads also pass after rollout. Live mutation/publication is not required to repeat the isolated acceptance. |
| Long catalogue / menu / image transitions | **Expanded checks completed** as above. Video, full keyboard coverage, reduced-motion settings and physical devices remain unverified. |
| Legacy duplicate-source audit | **Completed for the production import graph.** Retain inactive files; no destructive cleanup is necessary. Preserve compatibility values and selected order-flow presets. |
| Original cloud files | **External blocker:** 59 build files remain dataless despite accepted download requests. Let iCloud restore the originals; do not overwrite unknown cloud contents. |
| Existing type/lint backlog | **Open:** latest same-environment result is 386 pre-existing TypeScript diagnostics and no introduced signatures. Broad fixes are a separate review across unrelated pricing, designer and repository code; a full recovered build already passes. |
| Real design billing | **Product choice pending:** asked whether templates should stay free/master-assigned or use platform Stripe sales in test mode first. Paid purchases stay disabled while that choice is unanswered. No prices, charges or payment accounts were changed. |
| Production frontend rollout | **Not deployed:** requires a scoped release packet separated from the extensive unrelated worktree changes and the corresponding commercial acceptance. The permission-only rollout above is complete. |
| Other commercial / device acceptance | Real order file/proof/payment/email/fulfillment, normal login/recovery UI and physical-device tests remain outside this Site Design fixture. No real charges or customer communications were sent. |

### Recovery / rollback boundary

This rollout executes no data DML. Fingerprints in `rollout/live-before.json` and `rollout/live-after.json` establish preservation of existing records and tenant settings. If a legitimate template action is denied, pause that action and make a reviewed forward permission fix; do not restore browser-created completed purchases or broad authenticated library edits. Application source was not changed during this rollout, and no old source file or cloud placeholder was deleted. The documentation-only selective diff is `rollout/continuity.diff`.


## Continuation — downloaded originals, reduced motion and scoped type cleanup

### Original build files are available

A fresh filesystem check found all **102** previously identified build files available, including the 59 still missing at the preceding checkpoint. SHA-256 comparison confirms **102/102 match the previous verified recovery bytes**, including `api/sitemap.ts`. iCloud restored the originals; this pass did not replace original files with Git/release copies.

The new build tree contains freshly copied current `src`, `public` and `api` files and the readable shared modules required by those sources. **1,289 copied files match the workspace**, with just the three intended source changes recorded against the start-of-pass snapshot. This closes the known build-file blocker. It is not a claim that every file elsewhere in the repository is hydrated: an unrelated shared tax test was still dataless and is outside this focused test suite.

### Reproduced banner bugs and repair

The actual `HeroSlider` was mounted in a local-only fixture, with synthetic branding, backend writes disabled and external connections blocked. A short generated WebM provided real decoded video playback without uploading any media.

Before the fix, browser-emulated reduced motion exposed two failures:

1. Fallback-banner headings still used a 700 ms transition, a delayed entrance and a 32 px inactive translation. That fallback bypassed the shared motion-aware text helper.
2. On the first video render, the reduced-motion state initially defaulted to false. The playback effect therefore called `play()` once before the media-query effect updated the preference.

The fallback now uses the existing text-animation helper, text entrance delays are cleared for reduced motion, and the initial state reads the browser's preference before playback effects run. Normal animation choices and saved branding are preserved. No media URLs or stored designs were changed.

### Type and lint cleanup

The three-file patch also declares the existing per-image font/color fields and header CTA/menu motion fields, narrows matrix color keys to string values, accepts partial heading-subtext edits through the existing merge, and removes two unsupported color-picker props that were already ignored at runtime. It removes the four `any` casts in `HeroSlider` without changing values.

Same-environment semantic diagnostics are **386 before / 380 after**, with six resolved and no introduced signatures. `HeroSlider` has **zero lint errors or warnings**, down from four errors. Existing lint diagnostics in the other reviewed files are unchanged. This is a scoped reduction, not a clean repository-wide type/lint result.

### Verification

- **66 focused application tests pass:** draft/publish separation, preservation and conflicts, role checks, disabled purchases, assigned templates, presets, order-flow selections, preview capture/navigation and common controls.
- **39 browser checks pass:** 13 checks at each of 1280, 768 and 390 pixels. Coverage includes configured/fallback text under reduced motion, stopped autoplay/parallax, keyboard slide navigation, inert inactive slides, paused reduced-motion video, muted inline active playback, pause/play on Next, live preference changes, no initial reduced-motion play request, horizontal bounds and no browser exceptions.
- The initial two browser failures were recorded before editing; both pass afterward. Browser media emulation is not physical-device or actual OS-settings acceptance. The local WebM does not certify every customer-supplied codec/file.
- **Full local `vercel build --prod --yes` passes:** frontend plus `favicon`, `llms`, `robots`, `sitemap`, `storefront-brandmark` and `tenant-shell`. All copied source bytes match the workspace and the build lockfile matches the repository. The build uses a separate temporary tree, clean dependencies and cached project settings. Package lifecycle scripts were disabled for temporary server packaging after the Supabase CLI postinstall tried an unnecessary network download. Original workspace dependencies were not replaced. Existing chunk/Browserslist warnings remain.
- The real connected editor was not reloaded or edited during this pass. No hosted save/upload, database change, publication, payment, email, supplier operation or deployment occurred.

Evidence and the three-file selective patch: `output/site-design-audit-2026-09-21/media-and-types/`. The fixture and browser script are retained there; they reference the temporary dependency/build paths recorded in their configuration. Credentials and cached deployment environment files are not included.

### Current remaining items

| Item | Current status / next requirement |
| --- | --- |
| Known missing cloud build files | **Closed:** all 102 original files available and hash-verified. Other repository folders were not exhaustively hydrated. |
| Banner media / reduced motion | **39 local browser checks passed**, with two reproduced motion bugs fixed. Physical devices and customer media remain separate acceptance. |
| Existing type/lint backlog | **Open:** 380 semantic diagnostics remain; six fixed in this pass. Scope further fixes by subsystem, preserving pricing and production contracts. |
| Design billing | **Choice still pending:** purchases remain disabled. This continuation did not choose or implement a provider/fee model. Free/master-assigned workflow remains as previously accepted. |
| Live permissions / hosted templates | Previously completed: live permission repair plus isolated hosted save/upload/assignment/publish acceptance. No repeat live write is needed for this local patch. |
| Frontend release | Current-source full local build passes; **not deployed**. Still requires a scoped release packet separated from the unrelated worktree changes and corresponding acceptance. |
| Commercial and device acceptance | Normal login/recovery UI, real order upload/proof/payment/email/fulfillment and physical devices remain outside this fixture. No real charge or customer communication was made. |
| Legacy source / existing designs | Retained. No source deletion, default-content rewrite, price change or automatic migration of authored settings. |

### Selective rollback

Review `media-and-types/implementation.diff` against its before/after hashes, then reverse only the intended hunks if necessary. A reversal would restore the two reduced-motion defects and six type errors. Do not reset whole files or revert earlier permission/purchase safety fixes. No database rollback is needed for this continuation.


## Continuation — 22 September: billing decision, type/lint cleanup and release packet

The user selected **free templates / master assignment**. The canonical editor
now creates free templates, describes assignment clearly and preserves old prices,
assignments, purchases and drafts. The disabled payment handler remains disabled.
No hosted data was rewritten for this decision.

The full application scan improved from **380 to 171 TypeScript diagnostics**
and **2,731 to 2,354 ESLint errors**; 173 warnings remain. All **10 hook-rule
errors are resolved**. Existing checks were not weakened or exclusions added.
The additive live-schema typing snapshot and removed query casts account for
much of the reduction. Existing pricing calculations remain unchanged.

**199 local tests and 31 browser checks pass.** Four new locale regression cases
exercise the actual SEO hook; two fail before the correction and all four pass
afterward. Synthetic browser checks cover free/assigned template access,
assignment-required blocking, draft-only application, missing/valid site previews,
the missing lower-info fallback and fixed-zero master creation at 1280/768/390.
The full local production build passes all six server routes, with no TypeScript
error in the final packaging log and 1,302 matching build inputs. 93 of the 115
changed existing source files emit identical JavaScript; one new test file brings
the selective changeset to 116 files.

**The remaining work is not closed.** The legacy type/lint backlog remains as
counted above. Normal authentication/recovery UI, a chosen real shop/product/order,
customer communications, production fulfillment and physical devices still need
acceptance. The shop/product and available-device question is pending. The current
build includes unrelated prior worktree changes and must not be deployed wholesale
as a scoped Site Design release.

The [22 September release packet](SITE_DESIGN_RELEASE_PACKET_2026-09-22.md)
contains the concrete review scope, artifact, checks, remaining gates and selective
rollback. Evidence and offline build are in
`output/site-design-audit-2026-09-21/remaining-2026-09-22/`.
No live writes, payment, communication, supplier operation or deployment occurred.
The connected editor was not reloaded or edited.


## Latest continuation — legacy cleanup and scoped candidate, 22 September

The authorized local cleanup is applied: 42 proven-unused files are archived
verbatim, 95 active-source diagnostics are repaired, and the full application now
reports zero TypeScript errors. The earlier comparison's missing shared-file
diagnostic is explained in the linked report. ESLint is 1,980 errors / 156 warnings;
all remaining error-level findings are explicit `any`. No lint or TypeScript rule
was weakened. A per-file/rule regression check is added and its failure path tested.

536 application tests pass. The isolated Site Design release candidate passes 51
affected tests and the same 31 browser checks as the full cleaned application.
Both full production builds pass all six server routes. Browser data is synthetic;
this does not close physical-device or authenticated production acceptance.

The candidate is reconstructed from the recorded production snapshot with all
1,184 baseline hashes verified, then only the Site Design scope and approved
presentation/order-flow prerequisites overlaid. API and shared backend bytes are
unchanged. Two separate checked patches preserve the distinction between general
cleanup and the scoped release. Current deployment equality must be rechecked
before rollout; no deployment, live write or real order was performed.

Current open items are the explicit-`any`/warning backlog, release authorization
and freshness review, and real authentication/order/device acceptance. Target
shop/product and available-device input remains pending. The previously completed
live permission repair stays in place and must not be replayed unnecessarily.

See [the cleanup report](SITE_DESIGN_LEGACY_CLEANUP_2026-09-22.md) and
[updated release packet](SITE_DESIGN_RELEASE_PACKET_2026-09-22.md) for evidence and
rollback. These statuses supersede all earlier remaining-item tables above.
