# Featured-product review — 22 September 2026

Local implementation for the owner's review. No deployment, external upload,
live save or other live write was performed.

## Review links

- Editor: http://127.0.0.1:8134/__site-design-qa — choose **Fremhævede produkter**.
- Full-size banner: http://127.0.0.1:8134/__featured-product-review.

These routes use fictional products and browser-local storage. The earlier
8133 review and the backend-connected 8113 editor were left intact.

## Changes

- One carousel contains individually editable product banners, as requested.
  Each banner has its own product, copy, image gallery, colours, button settings
  and optional side panel. Add, duplicate, reorder and remove are draft edits.
- The existing single product remains the first banner. Additional banners live
  in the same branding document; no database migration is required.
- A dedicated inspector replaces the old long form. Sections group product and
  text, product images, colours and button, side panel, and placement/options.
  Colour explanations identify the affected element; colours can be inherited
  again or entered with the picker or a hex code.
- Fixed composition scales a 1200-pixel canvas as a whole. Buttons stay on one
  line, image frames have stable dimensions, and each print preset retains its
  composition. Phone text consequently scales down as well. The optional
  compact layout prioritises larger text on small screens.
- All carousel slides remain mounted, preserving their quantity selections.
  The tallest slide reserves the space. Inactive slides are hidden and inert.
  Whole-product autoplay defaults off; opt-in playback pauses on interaction
  and honours reduced-motion preferences. Image galleries remain independent.
- Changing side-panel modes preserves the authored gallery content. An upload
  finishing after its banner has changed or the inspector has closed cannot
  overwrite the newer draft. No real upload was exercised during this work.
- Existing product lookup, pricing calculations and destination construction
  are reused. The explicit shared-button operation also styles added banners.

## Verification and remaining review

- TypeScript: **0 errors** on the completed application check.
- Application tests: **511 passed**, including **16 focused tests** covering
  legacy banners, independent updates, reorder/removal, storage-shaped JSON,
  shared styling, and existing featured-product navigation.
- ESLint: **1,975 existing errors / 156 warnings**, with no regressions. The five
  removed errors tightened the existing baseline; rules were not relaxed.
- The full production build **passed on the final source**, including the
  last overflow safeguard.
- Browser checks exercised two complete products, their separate quantity
  selections and destinations, equal carousel height, nine main colour settings,
  the configured keyboard-focus colour, local draft save/reload, and two-image
  product and side galleries.
- Across **60 cases** (five presets × two banners × six widths, 1440–320), the
  measured composition remained identical within each banner/preset; all CTA
  text stayed on one line and all tested images loaded. Some immediate resize
  samples briefly detected horizontal overflow. A scoped `overflow-x: clip`
  safeguard was added, preserving vertical overlap behaviour.
- **The final browser recheck of that safeguard is pending.** Automatic approval
  review timed out twice and blocked access to the local review. The owner was
  asked for permission to retry. This is an approval/tool limitation, not a
  passing browser result.

Owner review of the composition and simpler controls remains required. Real
shop/product acceptance, physical devices, and release approval remain open.
The previous release packet predates this feedback pass and must include this
frontend delta before deployment. Nothing in this document authorises deployment.

Evidence and the 18-file source snapshot are in
`output/site-design-audit-2026-09-21/featured-product-review-2026-09-22/`.
The manifest records the before hashes captured at the start of this work and
the after hashes of the application source that was built. This is a review
snapshot, not an applied or deployed release. The ordinary release acceptance
still applies.
