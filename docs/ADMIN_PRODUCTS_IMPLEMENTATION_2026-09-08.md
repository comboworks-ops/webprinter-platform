# Product admin implementation — 8 September 2026

Scope: the eleven product-family selections in `ADMIN_DESIGN_SELECTIONS_2026-09-08.json`, using the selected PNGs under `tmp/admin-design-review-20260908/images/` and the gallery's concept notes. This is a presentation change within the existing product workflows. The reference images contain illustrative records; the implementation uses the current product, category, option, field, SEO and pricing state.

## Selection coverage

| Selection | Source files and implementation | Existing behavior retained |
| --- | --- | --- |
| `products_register` | `src/components/admin/ProductOverview.tsx`, `src/styles/adminProductsWorkspace.css`: one flat register, compact product counts, one search/category/price-status/overview toolbar, neutral rows, explicit action names. Category diagnostics are available in a collapsed section after the register. | Existing tenant-scoped loading, Matrix price-health checks, readiness/publication confirmations, category movement, duplicate/delete, tenant copy, release and distribution handlers. Company Hub remains below the product register. |
| `categories_0` | `ProductOverview.tsx`: existing category dialog now has category navigation and search, selected category editor, and a derived category summary. Main overview management remains available in a details section; category creation remains available from “Ny kategori”. | Existing overview/category creation, rename, ordering, hierarchy, storefront card, navigation and deletion handlers. Existing immediate-save controls remain immediate-save controls. Selection falls back to an available category after removal. |
| `create_parallel` | `src/components/admin/ProductCreator.tsx`: parallel type/category and product-details columns, compact labeled selector using all nine entries from `ProductPresetSelector.tsx`, and shared footer with actual selected setup/category. | Existing manual creation handler, all nine preset keys, name/slug behavior, category choice, category creation and validation. Back, cancel and successful creation retain `force_domain`. |
| `product_info_editorial` | `src/components/admin/ProductPriceManager.tsx`: editorial controls on the left; the existing `ProductPreviewCard` moved to a separate right-hand preview with its original props. | Existing product details, image/gallery/template, technical specifications, storefront and save controls. Gallery/template persistence helpers remain in place. |
| `matrix_context` | `ProductPriceManager.tsx`, `src/components/admin/ProductAttributeBuilder.tsx`: compact pricing-mode choices; class hooks place the existing attribute library and quantity controls beside the existing configuration editor on wide desktop. | Existing Matrix inputs, price lists, import/generation controls, selections, formula behavior and saves. Changes in `ProductAttributeBuilder.tsx` from this implementation are four layout class hooks; that file already had substantial unrelated worktree changes. |
| `delivery_methods` | `ProductPriceManager.tsx`: existing delivery-method editors appear before ordering configuration; each method can be expanded; the first method opens initially. A summary beside them uses the actual methods and ordering state. | Existing delivery values, toggles, upload/design requirements and `handleSaveOrderDelivery`. The summary save button invokes the same save handler and dirty-state conditions. |
| `options_workspace` | `src/components/admin/OptionGroupManager.tsx`: group navigation, selected group's existing editor, and an option preview from the actual option labels/icons/descriptions/extra prices. | Existing group/option CRUD, required/display settings, icon selection and saves. Preview selection is local state; it does not write customer selections or prices. |
| `fields_preview` | `src/components/admin/CustomFieldsManager.tsx`, `ProductPriceManager.tsx`: existing field editor beside an interactive preview with the current product name/image, saved fields and the unsaved field being added. | Existing field types (`number` and `boolean`), required/default settings, creation and deletion handlers. Preview input state is local and explicitly described as unsaved. |
| `productseo_first` | `src/components/admin/ProductSeoTab.tsx`: metadata editor beside search-result/OG preview; preview uses a read-only query for the selected tenant's name/domain. | Existing tenant-scoped SEO load, save and OG-image upload. The preview states that search engines may choose other text. Missing SEO data clears the old OG-image state. |
| `tooltips_split` | `src/components/admin/VisualTooltipDesigner.tsx`: existing tooltip editor left and selected interactive preview right, with Danish labels. | Existing tooltip selection/configuration and save callbacks. |
| `storformat_preview` | `src/components/admin/StorformatManager.tsx`, `ProductPriceManager.tsx`: existing storformat editor beside a size/area/price example, with explicit `#storformat` navigation. | Existing width/height state and existing `previewResult` from `calculateStorformatPrice`; no formula or price persistence changes. The preview shows the existing first-quantity example and actual split information, or explains that a material/valid size is required. |

Shared product styles use the workspace's HSL theme tokens, including borders, selected states and surfaces. Split layouts stack at narrower breakpoints. The product register scrolls horizontally on narrow screens so its controls remain available. Product configuration tab navigation preserves the current query context and updates the URL hash.

The bounded follow-up review added explicit Danish accessible names to the option editor's save/cancel/edit/delete controls, and to each delivery method's name input and delete control. Their handlers are unchanged. The `#storformat` deep link now selects the Storformat section only when the loaded product already has `pricing_type: STORFORMAT`; it does not imply or perform a pricing-mode conversion for other products.

## Verification performed

- Inspected all eleven selected PNGs and the gallery concept notes before implementation.
- TypeScript `transpileModule` syntax diagnostics for the nine affected product TSX files: no diagnostics. Parsed `adminProductsWorkspace.css` with PostCSS successfully.
- `git diff --check` on the product-owned files passed.
- Follow-up verification exercised the actual hash-selection callback locally with unloaded, Matrix, machine and Storformat product states. All four selected the product tab; only the persisted Storformat state selected the Storformat section. No save or pricing mutation handler was invoked. Syntax and diff checks were repeated after the accessible-name corrections.
- Thirty-one focused tests passed using the existing bundled Node runtime, without installing dependencies:

  ```text
  node --experimental-strip-types --test
    src/components/admin/productAboutTemplatePersistence.test.ts
    src/lib/pricing/matrixAdminPriceSafeguards.test.ts
    src/lib/pricing/matrixLoadingPresentation.test.ts
    src/lib/pricing/productOptionSettings.test.ts
    src/lib/pricing/exactCombinationResolver.test.ts
    src/lib/print-production/navigation.test.ts
  ```

  These cover preservation/conflicts for product gallery and template metadata, sparse Matrix combinations and supplier provenance, loading presentation, product-option settings, exact combination selection, and tenant-context navigation. They do not prove that every browser control can persist successfully against the live service.

- The full application typecheck is not clean: it reports existing generated Supabase typing and archived/backup-file errors. Newly introduced SEO-query type errors were corrected; focused semantic diagnostics for `ProductSeoTab.tsx` then reported none. Do not describe the full typecheck as passing.

## Evidence boundary and remaining checks

This document records source inspection and local syntax/unit-test evidence. It does not claim a completed visual pass. The parent implementation task is conducting fixture browser QA separately, including desktop/narrow layouts and route transitions. The first product register and creator browser review led to the compact register/filter and preset-selector refinements documented above; those refinements require final screenshot review.

No live product save, category mutation, pricing write, publishing action, distribution, deletion, schema migration or deployment was performed by the product implementation task. Existing mutation handlers were preserved and wired to their controls; successful live persistence remains a separate proof boundary. The production pricing/POD logic and tables were not intentionally changed. No dependencies or lockfiles were changed.

The selected layouts accommodate the existing application's additional production controls. They are not a claim of pixel-identical rendering or production end-to-end readiness. Supplier/POD behavior, hosted authentication, storefront checkout, file production and live fulfillment remain outside this product presentation verification.
