# Webprinter selected order-flow designs

final result: passed

Date: 8 September 2026. Scope: local presentation/layout implementation and the interactions listed below. This is not production order, payment, PDF, hosted editor persistence or release acceptance. Prior storefront QA is preserved in [its report](docs/STOREFRONT_DESIGN_QA_2026-09-08.md).

## Approved target

Exact selections: product 2/1, checkout 6/4, proof 7/9, designer 12/11, payment 13/15, confirmation 16/18 (default/alternative). See [implementation and recovery notes](docs/ORDER_FLOW_DESIGNS_2026-09-08.md).

Generated source images in `output/design-exploration/order-flow-2026-09-08/` are the visual references. All twelve selected references were opened. The final implementation and each source were composed side by side in `implementation/comparison-{page}-{number}.jpg`, at a 1488 × 1058 implementation viewport. Minor source-size differences were fitted proportionally. The local design switch occupies additional space in development builds only.

## Visual comparison

| Surface | Findings and resolution |
| --- | --- |
| Typography | Inter and a consistent heading/body hierarchy replace conflicting inherited recipes. Desktop heading scale was increased after comparison; prices use tabular figures. Designer tools have visible labels and accessible names. |
| Spacing and layout | Product 2 retains photo/matrix left and configuration/actions right; 1 uses a compact hero and separate summary. Checkout 6 uses contact/file/delivery disclosures and a tinted summary; 4 puts the file section first. Proof, designer, payment and receipt panels follow their selected left/right arrangements. |
| Color and surfaces | White surfaces, blue actions, pale-blue alternative rails, restrained borders, and reduced legacy shadows. Blue proof/designer headers have readable text. Full-screen dialogs fade in place instead of using centred-modal slide/zoom transforms. |
| Images and icons | Existing catalogue photography is retained, including its actual subject and proportions. A generated WP sample artwork is used only in the local proof demonstration. Existing Lucide icons and functional canvas guides remain. No invented certification, fake customer upload or substitute CSS artwork. |
| Responsive behavior | Desktop 1488 × 1058, tablet 768 × 1024 and phone 390 × 844 were inspected. Product content stacks sensibly on phones; matrix overflow remains inside its swipe region. The alternative tablet hero was corrected to avoid crossing the summary. Payment fieldsets now shrink within the margin. The tablet designer toolbar wraps all controls. Narrow phones retain the existing explicit designer fallback. |
| Accessibility and motion | Native buttons/fields/disclosures, input labels, image alt text, pressed/selected state, focus outlines and Radix dialog semantics are retained. File selection has a keyboard-accessible button. Reduced-motion styling disables the new dialog animation. This is a scoped check, not a full WCAG audit or physical touch-device test. |

The references include populated/example states. Actual checkout was reviewed without a hosted file upload; actual designer was reviewed empty and with a temporary text object. Their original data, guide geometry, product-specific notices, optional contact controls and technical tools were retained rather than replaced with generated example values. Existing English supplier labels remain catalogue data. The proof/payment/confirmation gallery deliberately labels its example data and disabled payment form.

## Resolved issues

- P2: Independent calculator columns keep the CTA beside the product content instead of inheriting the image's grid-row height.
- P2: Old theme rules overrode the new layout, radio sizes and typography; scoped overrides restore the chosen structure.
- P2: The contact fields collapsed after the first typed name character. Focusing a field retains the expanded state; ordinary keyboard entry and design switching were retested.
- P2: Designer `.flex` overrode the new grid. The scoped grid now places the same canvas and inspector correctly; switching retains the selected object and properties.
- P2: Tablet tools and the alternative product hero clipped or crossed their available columns. Both now wrap/stack within their allotted width.
- P2: The sample payment fieldset exceeded its mobile content margin. Minimum widths and grid tracks were corrected.
- P2: Generic centred-dialog transforms did not suit full-screen layouts. Dialogs now anchor at the viewport origin and fade in place; the phone split-payment dialog was checked at left 0 and width 390.
- Early captures taken during modal transitions or before viewport paint were replaced with settled captures before comparison.

No outstanding P0/P1/P2 finding remains within this scoped visual pass. Per-product regression, real proof/payment acceptance, screen-reader audit and publishing are separate remaining work.

## Interaction evidence

- Actual aluminium product: 100 × 100 cm, white 3 mm, 1 item = 436 kr; Standard delivery = 129 kr; displayed total = 565 kr. Pagination revealed quantities 5–8; selecting 5 items gave 2,140 kr plus 129 kr = 2,269 kr. Selection and total survived switching 2 → 1; reset to 1 item.
- Actual product → checkout retained the product, dimensions, material, quantity and 565 kr total. Express selection produced 635 kr; switching back restored 565 kr. Existing payment prerequisites left the payment CTA disabled without the required file/contact data.
- Actual checkout synthetic name/email survived switching 6 ↔ 4. Temporary inputs were cleared with ordinary keyboard actions; the empty contact summary was verified. Nothing was submitted or saved to an account.
- Actual checkout → designer retained 1000 × 1000 mm, 3 mm bleed and 2 mm safe distance. Text insertion exposed its properties; switching 12 → 11 retained the object/properties. The temporary object was undone and the workspace left without saving.
- Local proof demonstration: approval and reset changed example state, both layouts opened, and the close action returned to the index. The mobile approval control was reachable by scrolling.
- Local payment/confirmation demonstrations: both alternatives, close/back controls and the shared visual receipt rendered. Example card controls remain disabled and cannot charge.
- Same picker as Site Design: selecting payment 15 in the local settings changed its subsequent preview default; restored to 13. Authenticated Site Design saving was not invoked.
- No captured console errors in the final preview; actual checkout logs were also checked during input diagnosis.

## Source and build checks

- Production Vite build passed. Existing large-chunk warnings remain.
- Six focused design-setting/preset tests passed, including exact defaults, invalid cross-page rejection, override behavior and preservation of unrelated settings.
- App TypeScript comparison: 493 existing diagnostics before, 493 after; zero added or removed normalized diagnostics. The whole repository is not type-clean.
- TypeScript AST comparison against this turn's snapshots found 144 existing named arrow functions unchanged across the product, checkout, designer, price panel and storformat configurator; only component/render wrappers differed, and none was removed. This supports handler preservation, not end-to-end business proof.
- Changed tracked source files passed `git diff --check`. No dependency manifest, lockfile, schema, edge function, tenant scoping, POD model or pricing formula was intentionally changed in this pass.

Local check logs: `tmp/order-flow-build.txt`, `tmp/order-flow-tests.txt`, `tmp/order-flow-type-comparison.json`, `tmp/order-flow-handler-audit.json`. Browser images: `output/design-exploration/order-flow-2026-09-08/implementation/`.

## Explicit limits

No real upload/proof approval, Stripe transaction, completed order, email, supplier submission, production PDF, CMYK/ICC validation, authenticated branding save or deployment was performed. Physical iPad/touch behavior and every product/pricing model are unverified. L02/L04 and commercial readiness remain open.
