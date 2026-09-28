# Launch review baseline — 5 September 2026

Recorded in the repository on 2026-09-06 from the preceding review in the same Codex task. This is a dated evidence snapshot, not a new audit or a statement that deployed state is unchanged. Use the [launch register](LAUNCH_REGISTER.md) for current work and later verification.

## E1: Environment and release

- Checkout: `printmaker-web-craft-main`; remote `https://github.com/comboworks-ops/webprinter-platform.git`; branch `ui-cleanup`; HEAD `c0ee02839e4329c6c8543101e4fca4d9d0222cda`.
- Staged, unstaged and untracked work existed. The committed graph excluded it; direct source review included the working tree.
- Existing port 8104 served a previously loaded folder preview, but fresh page navigation failed. The server exposed an `index.html` permission error. `node_modules` linked to a missing dependency directory under another macOS account; a fresh Vite start failed with module-not-found. No dependency repair was performed.
- Public site was reviewed separately. Its deployed revision was not established. Authenticated administration was unavailable; the public admin entry showed login.

## E2: Aluminium dimensions

Reproduced twice on `https://www.webprinter.dk`:

1. Open `/shop` and select Aluminium Skilte (`/produkt/aluminium`).
2. Keep 100 × 100 cm, white aluminium, one item.
3. Choose `Upload fil og bestil` to reach `/checkout/konfigurer`.
4. Choose `Åbn storformatdesigner`.

Checkout states 1000 × 1000 mm. Designer states 210 × 297 mm and shows a portrait canvas. The designer URL includes `format=100+x+100+cm`, `designerMode=storformat`, `pricingModel=storformat_area`, `order=1` and the checkout return path, but no explicit numeric width/height. No export was performed; the observed defect is the launch state, not a measured exported PDF.

Current source at review time already called `applyDesignerDocumentParams` with dimensions in [FileUploadConfiguration.tsx](../src/pages/FileUploadConfiguration.tsx). The helper's unit check passed. Reconcile this existing work with the runtime before writing another fix.

## E3: Product contracts

- Aluminium displayed 436 kr product price plus 129 kr standard shipping, total 565 kr excluding VAT. That displayed selection and total persisted into checkout. Server-authoritative pricing and payment amount were not verified.
- Loaded local route: `http://127.0.0.1:8104/preview-shop?preview_mode=1&page=%2Fprodukt%2Fsalgsmapper-med-eget-design`. It exposed model, print, spine, finishing, paper, quantity, price and a selected PDF-template link. This is not proof of the complete catalog or every PDF.
- [Sales-folder handover](WEBPRINTER_SALES_FOLDERS_HANDOVER_2026-09-05.md) retains its separate receipt-based inventory, publication restrictions and exact price/template requirements.

## E4: Checkout and file panel

At the observed 1280 × 720 desktop viewport, the upload panel's designer button squeezes explanatory text into a narrow column and overlaps the heading. This was visible on the live aluminium checkout. Source shows a non-shrinking action group sharing a horizontal row with shrinking text inside the narrow secondary panel; this is a likely cause, not a verified correction. No file was uploaded and no payment or order was submitted.

## E5: Operations and proof limits

The following local test command passed **48/48** on 5 September:

```sh
node --test --experimental-strip-types \
  src/lib/designer/productTemplateLinks.test.ts \
  src/lib/designer/orderFlowNavigation.test.ts \
  src/lib/checkout/siteCheckoutSession.test.ts \
  src/lib/print-production/orderSubmission.test.ts \
  src/lib/preview/siteDesignPreviewNavigation.test.ts \
  src/lib/pricing/exactCombinationResolver.test.ts
```

Execution used the bundled Node runtime at `/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

These are narrow local contracts. No authenticated admin task, saved design, PDF export, completed payment/order, email, supplier submission, delivery, mobile journey or tenant-isolation test was completed. No full production build was run in that review.

The existing [commercial proof report](COMMERCIAL_PROOF_LATEST.md) is dated 2026-07-10 and records twelve read-only checks; it does not establish a completed paid/fulfilled order or September readiness.

## E6: Presentation

- Public platform homepage: clear print-house audience, onboarding and demo links.
- `/opret-shop`: three initial fields; form entry inspected only. Its promises of all products, ready prices and automatic updates need to match pilot scope.
- `/shop`: generic branding/hero content appeared before saved tenant content. Final view still showed `Fremhæv din kampagne` and setup instructions.
- Aluminium options mixed Danish and English (`PRINTING`, `CUT`, `PRODUCTION`, `Front side only printing`, `Rectangular`, `Standard production`).
- Designer exposed internal `storformat_area` terminology. Current local routing already includes animation and reduced-motion behavior; timing and bundle cost were not measured.
- Accessibility evidence is limited to visible presentation and available labels; no compliance assessment was completed.

## E7: Site design and admin

Source-only findings:

- [SiteDesignEditorV2.tsx](../src/components/admin/SiteDesignEditorV2.tsx) had 10,970 lines; [CommercialReadiness.tsx](../src/pages/admin/CommercialReadiness.tsx) had 11,373. Size signals maintenance scope, not a confirmed performance defect.
- Site design presents overlapping concepts: Shopdesign, Shop type, Tema, saved designs and premade designs, alongside many detailed controls. [Ten existing versioned layouts](SHOP_TEMPLATE_SYSTEM_2026-07-27.md) provide a reuse path.
- The site's `Fortryd` action calls `discardDraft` in [use-branding-editor.ts](../src/lib/branding/use-branding-editor.ts). The [tenant adapter](../src/lib/branding/tenant-adapter.ts) loads published branding and saves it back as the draft. This is discard-to-published, not one-step undo. This behavior was read, not clicked.

## Original visual evidence

The full review and screenshots remain in the originating machine's local artifact folder. These links are supporting evidence, not required for understanding this repository snapshot, and may not resolve on another machine.

- [Full review](/Users/thomasprintmaker/.codex/visualizations/2026/09/05/01a0737e-5ca2-7930-82b4-0ffc9ff27e81/webprinter-review/review.md)
- [Checkout screenshot](/Users/thomasprintmaker/.codex/visualizations/2026/09/05/01a0737e-5ca2-7930-82b4-0ffc9ff27e81/webprinter-review/06-checkout-final.png)
- [Designer screenshot](/Users/thomasprintmaker/.codex/visualizations/2026/09/05/01a0737e-5ca2-7930-82b4-0ffc9ff27e81/webprinter-review/07-designer-final.png)
