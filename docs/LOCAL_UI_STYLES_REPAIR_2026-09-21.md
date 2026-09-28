# Localhost 8113 styling recovery — 21 September 2026

## Cause

The address the owner used for the real system, `http://127.0.0.1:8113/`, was running `tmp/start-product-presentations-preview.mjs`. Its Tailwind content override scanned only ProductPresentation, ProductPresentationPicker and the standalone preview entry. Vite still served all normal application routes, but their utility classes were missing.

Browser evidence before repair: the homepage service strip had zero container padding, stacked columns, and horizontal icon/title/description rows. The served main stylesheet lacked `.container`, `.px-4`, `.flex-col`, `.text-xl`, `.gap-8` and `.font-bold`. This made typography and delivery controls appear globally broken even though saved branding had not been changed by the server.

## Repair and running server

- The former focused launcher now delegates to the full-system launcher on port 8113. It no longer replaces the application's Tailwind content list with three preview files.
- The full-system launcher accepts `WEBPRINTER_LOCAL_PORT`, validates it and gives additional ports their own Vite cache. Its existing default remains 8114. The optional presentation preview entry is included in addition to the full app content.
- Existing local recovery of offloaded source/assets is reused. See `PRODUCT_PRESENTATIONS_2026-09-21.md`; this remains a local tooling workaround, not a production build.
- Detached screen session: `webprinter-ui-repair-8113`.
- Start: bundled Node running `tmp/start-product-presentations-preview.mjs` from the repository root.
- Log: `tmp/webprinter-ui-repair-8113.log`.
- The separate 8114 server and its editor tabs were not restarted.

Do not reinstate a partial Tailwind scan on a server that serves the full app. If a future isolated preview requires a reduced scan, give it a separate port and prevent it serving normal application routes.

## Verification

- Both modified launchers pass `node --check`.
- Main Vite stylesheet response grew from 22,798 to 242,069 bytes. The actual CSS in the browser grew from 21,396 to 228,313 characters. All six missing utility examples above are present after repair.
- Refreshed the owner's existing 8113 browser tab. Homepage hero, typography, category cards, service strip and footer render with restored spacing. The service strip has three desktop columns, 32px gaps and 16px container padding; each icon/title/description group uses a column.
- Opened `/produkt/aluminium?widthCm=100&heightCm=100&qty=1` through the actual homepage order link. Real product image, calculator, price matrix, standard/express delivery controls, action buttons and information panel render.
- Delivery options have 12px vertical / 13px horizontal padding, aligned labels, deadline/date copy and prices. Displayed product 436 kr + standard delivery 129 kr = 565 kr; express is 199 kr.
- Homepage and product page have no document overflow at the observed 1221px viewport. Screenshots and DOM measurements were inspected directly in the browser.
- Responsive viewport automation stalled; the six-width matrix is not claimed. No application TSX/CSS, pricing logic, POD behavior, tenant data, branding settings, publishing or production deployment changed. No production build or authenticated save/payment test is claimed for this local server repair.

## Recovery

Restart the same full-system launcher if the local process exits. Preserve the source-recovery manifests while macOS originals remain offloaded. Rollback must not restore the partial stylesheet on port 8113; use a full app server and verify both the homepage and an actual product route.
