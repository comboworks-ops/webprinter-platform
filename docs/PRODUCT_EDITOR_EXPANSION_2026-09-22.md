# Local product editor expansion

The product editor now starts on **Produktkort**. The primary navigation continues with **Produktside**, **Produkt & Priser**, **Levering**, and **Tooltips**. Existing options, fields, and SEO remain available. Explicit `#workspace` links still open the product-page workspace. Product-page copy, templates, and technical controls have moved out of the card editor into the product-page tab. Existing pricing, delivery, publication, and workspace save handlers remain in place.

## Product cards

The card tab retains the previous name, short title, copy, image, hover image, scale, displayed price/promotion, category-link, and badge controls. Its iframe uses the actual storefront renderer and the selected Site Design catalogue presentation. Unsaved card changes are sent only to that iframe.

Image effects: zoom, lift, tilt, brighten, grayscale-to-colour, plus none. Independent card effects: shadow, lift, glow, outline, scale, plus none. Both the standard grid and the four alternate product presentations consume these settings. Alternate catalogue cards now also render configured starting prices/promotions.

Badges accept an image through the existing append-only PNG/JPG/WebP uploader or a safe image URL. Size, corner, duration, hover visibility, and none/bounce/spin-in/pulse/continuous-spin/float animation are configurable. Saved fields remain additive within `banner_config`; no migration or pricing arithmetic change is required. Reduced-motion preferences disable motion.

## Tooltips

The Tooltips tab embeds the real `/preview-shop` storefront, initially at the current product. **Gå rundt** permits normal storefront navigation and option selection. **Placér tooltip** intercepts the next element click instead of activating that product choice. The editor can select an individual text/button/image or a larger section, browse other products, and load/save each product's own tooltips.

New tooltips store a page and element target in the existing `banner_config.visual_tooltips` array. Product identity plus stable element attributes are preferred; exact text is the fallback. Generated Radix ids are ignored. Duplicate or missing targets remain hidden instead of attaching to a different element. After an author renames unkeyed text, its tooltip may need reattachment. Markers recompute position on scrolling, resizing, content changes, image loading, and completed CSS transitions. Only tooltips on the active page mount position observers.

The editor supports eight icons, custom icon images, content images with alt text, safe links, colour, five opening effects including none, opening direction, and percentage placement within the target. Draft text and placement preview immediately. Existing unavailable-option explanations remain under **Hjælp til utilgængelige valg**.

Saves read the current product with both product and tenant filters, preserve unrelated banner settings, reject changed tooltip lists, and compare `updated_at` before updating. Errors remain errors and retain the draft. Preview messages check the same origin and the owning iframe/parent. Customer routes accept no editor overrides; the dedicated tooltip preview does. No auth, storage bucket, database, or permission configuration was changed.

## Verification and boundaries

- Connected local product: `/admin/product/new-folders`. Default card tab and direct product-page/delivery tabs verified.
- Card image/card effects changed independently in the actual standard and selected precision-catalogue preview. A custom existing PNG URL and four-second continuous badge rotation were verified without uploading or saving.
- On the actual product preview, a draft attached specifically to A5, displayed its text on click, and remained attached after changing to the 390px mobile preview. Mobile body width and scroll width both measured 390px.
- The preview navigated to the real homepage and followed another product link while remaining inside the tooltip editor.
- TypeScript check and production build pass in the recovered runtime. New/reworked modules pass focused lint. Legacy touched-file diagnostics remain at their prior 146 total; hook message line-number shifts are unchanged findings.
- 23 repository tests cover URL safety, independent effect choices, tooltip save preservation/concurrency, workspace preservation, availability, and exact selection. Four additional DOM checks in the local evidence packet cover reorder, product isolation, ambiguous text, and generated-id/JSON reload behavior. All 27 passed.
- Temporary preview edits were discarded; the review tab was left on the saved product's card, with Save disabled.

No hosted product save, media upload, deployment, order, or payment was performed. Actual hosted tooltip save/reload, uploaded-image acceptance, full catalogue-presentation visual coverage, screen readers, and physical-device behavior remain separate acceptance checks. The preview is backed by real product data; the isolated DOM/save tests do not establish hosted persistence.

## Runtime and rollback

The workspace source is synchronized to the recovered full app served on 8113 by `tmp/start-webprinter-connected-recovered.mjs`; some original workspace files had been cloud-offloaded. Keep both copies synchronized until the normal workspace can run directly.

Before-source snapshots, changed-file list, checks, and DOM evidence are under `/tmp/product-editor-expansion`. Revert only this feature's changes, preserving earlier availability work and other local edits. Additive saved badge/effect/tooltip target fields can remain when reverting the renderer; no destructive data cleanup is necessary.
