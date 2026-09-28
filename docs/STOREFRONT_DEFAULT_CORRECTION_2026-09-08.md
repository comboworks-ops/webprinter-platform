# Original storefront picture 1

Thomas corrected the storefront selection on 8 September 2026: the original
first picture is **Refined Familiar**, with blue navigation, the photographic
brochure banner, and the featured product below. It is the system default.
The category-side-menu layout is an optional design.

The original concept requests were made in this order: Refined Familiar,
Product First, Nordic Print Studio, Precise Print Grid, Calm Blue Commerce.
The image jobs ran asynchronously. The later `display-order.json` and QA
records assigned a different numbering, making Precise Print Grid the default.
The earlier user objection to the category side menu and the current
correction supersede that mistaken record.

| Picture | Stable theme ID | Archived reference | Role |
| --- | --- | --- | --- |
| 1 | `print-familiar` | `option-2.png` | Standard |
| 2 | `print-product` | `option-4.png` | Alternative |
| 3 | `print-nordic` | `option-3.png` | Alternative |
| 4 | `print-precise` | `option-1.png` | Alternative |
| 5 | `print-calm` | `option-5.png` | Alternative |

References are under `output/design-exploration/webprinter-2026-09-07/`.
Their filenames are preserved as historical artifacts. The corrected manifest
maps picture numbers to these files explicitly; filenames must not determine
the visible selection number. Preview thumbnails similarly retain their
existing asset paths and use explicit mappings.

The correction changes source defaults, preset ordering and labels. Rendering
uses stable theme IDs so changing display order cannot change a layout's
category rail, search, hero action or product position. All five choices remain
in the shared Site Design selector. Explicit saved alternative selections and
tenant-authored content remain valid. Other approved order-flow/page choices
remain unchanged. No hosted branding, pricing, database records or deployment
is changed by this correction.

## Verification

- Normal storefront `http://127.0.0.1:8110/?tenantId=00000000-0000-0000-0000-000000000000`
  renders Refined Familiar without a design query. Its blue header, brochure
  photograph and horizontal product composition were visually inspected.
- Home → Aluminium Skilte → Hjem → full reload retains the corrected default.
  The existing product matrix still displays the observed 436 kr first quantity.
- All five shared Site Design cards were selected in the local editor; each
  iframe rendered its matching heading. Refined Familiar is labelled
  `1. Refined Familiar` and `Standard`, with the correct preview thumbnail.
- The local review draft was returned to Refined Familiar, saved through
  `Gem lokalt`, and reopened; selected state persisted. This stores only the
  browser-local review draft, not authenticated/hosted branding.
- Actual storefront desktop view was checked at 1280px. The shared Site Design
  iframe was inspected at 768 × 1024 and 390 × 844; document width matched the
  viewport at both sizes. Tablet image checks found zero broken loaded images.
- Final fresh homepage load returned zero new error-level console messages.
  A temporary theme-registry HMR error occurred while source files were being
  edited; it was absent after full reload and did not recur in final checks.
- Two regression tests failed before the correction; all 9 focused preset and
  order-flow tests pass afterward. Production build passes (12.84 seconds),
  with the existing large-bundle warning. Build log:
  `tmp/storefront-default-correction-build.log`.

The authenticated full editor's hosted save/publish path was not exercised.
No order was submitted. This verifies local presentation/default selection,
not deployment or end-to-end commercial readiness.

Rollback: restore the previous default and display-number assignments in the
preset registry and corresponding manifest. Keep stable theme IDs, archived
images and independent order-flow defaults. No database rollback is needed.

## Automatic tenant inheritance

Thomas additionally requested that tenant shops receive the standard change
automatically. New tenants contain no branding snapshot and already inherit
the built-in default. Existing shops may have a saved `classic` theme from the
old default, which previously prevented inheritance; the earlier runtime
override was limited to the local master shop.

The shared branding merge now resolves the standard for every tenant and host,
including the editor. Missing/default themes and legacy `classic` without an
explicit visual-style/preset selection inherit picture 1. A deliberate theme
choice—including an explicitly selected Classic—continues to win. There is no
automatic replacement of a saved `print-precise` alternative merely because it
was once the mistaken default; the stored data cannot identify that intent.

Inheritance is a read-time presentation change. Source caches and hosted
settings remain intact. It preserves tenant identity, navigation, authored
content/images, custom colours and independent product/order settings.
The additive `inheritedPrintDesignId` setting records a resolved inherited
choice, while explicit preset selection removes that marker. This allows
the standard to evolve without locking every inherited tenant to a snapshot.

Both tenant-creation paths (`TenantSignup` and `TenantOverview`) insert company
settings without branding, so no creation migration or bulk tenant write is
needed. The master template remains a separate one-time-copy feature.
Live tenants receive this behavior with the next frontend deployment; local
source changes do not alter the currently deployed frontend.

Tenant-inheritance verification:

- Both branding mergers (the draft hook and shared editor/adapter module) use
  the same inheritance helper. Explicit `visualStyleId` also prevents later
  preset reapplication from replacing saved customization.
- All 13 focused preset/order-flow tests pass. Final production build passes
  in 8.53 seconds, with the existing large-bundle warning; log:
  `tmp/tenant-standard-inheritance-build.log`.
- The existing Onlinetryksager tenant was inspected at
  `http://127.0.0.1:8110/?force_domain=onlinetryksager.dk`: DOM confirms
  `data-print-design="print-familiar"` after a full reload. Its own logo,
  orange header and authored printing-press photograph remain visible.
  No broken loaded images or error-level browser logs were observed.
- That tenant's long custom navigation exposed a 29px desktop overflow from
  the existing sign-in wrapper's reserved width. The print-theme CSS now
  matches the wrapper to its compact sign-in link. At 1280px the document
  width is 1280px, with no header element extending beyond the viewport.
- The master storefront and local shared Site Design preview were reloaded;
  picture 1 remains active, all five choices remain visible, and the local
  editor has no error-level browser logs. The authenticated editor's hosted
  save/publish path remains source-inspected only.
- The stopped local preview server was restarted from this exact checkout;
  listener PID 97059 owns port 8110 at verification time.

Tenant-inheritance rollback: remove the helper calls from the two branding
mergers and the consumer normalization in `useShopSettings`. No tenant rows or
hosted branding were rewritten, so no database rollback is required.
