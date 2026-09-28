# Selected order-flow designs

Thomas approved these pairs on 8 September 2026. They are implemented in the local checkout; no hosted settings were saved and no release was published.

| Page | Default | Alternative |
| --- | --- | --- |
| Product and price | 2 · Nordic Product Studio | 1 · Precise Matrix |
| Checkout | 6 · Calm Guided Checkout | 4 · Precise Checkout |
| File proof | 7 · Precise Proof | 9 · Calm Approval Rail |
| Designer | 12 · Calm Studio Rail | 11 · Nordic Quiet Canvas |
| Payment | 13 · Precise Payment | 15 · Calm Split Payment |
| Confirmation | 16 · Precise Order Receipt | 18 · Calm Confirmation Split |

## Review and settings

Open `http://127.0.0.1:8110/output/design-exploration/order-flow-2026-09-08/implemented.html`. Product, checkout and designer links open existing app routes. The other three previews use local example data and the shared presentation components. Their payment fields are disabled; they do not upload, charge or create orders.

The Site Design editor contains the same six-pair picker under Bestillingsflow. The draft stores `themeSettings.orderFlowDesigns`, independently of the existing storefront preset. Missing or unsupported choices resolve to the approved defaults. Other theme fields and page choices are retained. The existing save/publish process is unchanged and was not invoked in this pass.

Development builds also show a Standard / Alternativ switch on each page. Its `orderDesign` URL parameter is restricted to the matching approved pair, retains router state and other query parameters, and is ignored in production builds. Changing a development preview is not a hosted branding save.

## Implementation boundaries

The aluminium storformat calculator is the visual reference and the browser-tested calculator. Other pricing paths retain their own input models with shared typography and the compact price panel; they still require product-specific regression checks before release. Existing real shipping dates, product images, supplier option labels, template guidance and error messages take precedence over illustrative mockup copy.

Checkout retains contact/recipient fields, optional sender/billing/address-book controls, file requirements, disabled-payment prerequisites and original file handling. The layout rearranges those existing components. A pre-existing contact-section collapse after entering the first name character was corrected by retaining the expanded state when entering a field.

Designer layouts rearrange the existing toolbar, canvas and inspector without creating a second canvas or altering PDF/export/preflight logic. Narrow phones retain the existing unsupported-device screen. A tablet viewport check does not prove physical iPad behavior.

Payment uses the existing StripePaymentForm and callbacks in the real flow. Confirmation retains order persistence and email warnings. Full-page dialogs retain Radix focus management, Escape and close behavior; their visual transition fades in place. No Stripe transaction, real upload/proof approval, production PDF or hosted branding persistence was verified in this visual pass.

## Evidence and recovery

See [design QA](../design-qa.md) and `output/design-exploration/order-flow-2026-09-08/implementation/`. The original generated choices remain in `display-order.json`; review.html links to the implementation and preserves browser notes/choices.

Files present before this pass were copied into `tmp/order-flow-design-before/`. These are comparison snapshots, not a command to overwrite the dirty checkout. Roll back only the specific UI additions if needed, preserving earlier storefront, pricing, PDF and unrelated edits. No schema, edge function or database rollback is required.
