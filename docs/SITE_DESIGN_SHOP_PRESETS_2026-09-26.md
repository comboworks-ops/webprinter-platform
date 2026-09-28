# Shopdesign selection and preview — 26 September 2026

## Cause and change

The connected master shop had `themeId: print-familiar` and an active
`precision-catalogue` product presentation. The latter replaces the print theme's
product section. In the development comparison, changing from design 1 to 2
changed `data-print-design` but left `data-product-presentation` at
`precision-catalogue`, so the advertised shop compositions were masked.

An explicit choice in the Shopdesign picker now applies the print preset and
sets the separate product presentation to `standard` in the draft. If that
presentation moved products before an existing hero, the two return to hero-first
order for designs with a hero. Other section order and product IDs, prices, copy,
tenant identity, and saved/published data are retained. The Site Design preview
navigates to the homepage after selection. The local five-design comparison uses
the same explicit selection logic.

The existing tenant adapter publishes the complete selected draft to
`settings.branding.published`; `useShopSettings` supplies that published branding
to the storefront. The published shop was not changed in this verification.

## Verification

- Before: connected `/shop?tenantId=...&design=2` showed
  `data-print-design=print-product` together with
  `data-product-presentation=precision-catalogue`.
- After: all five local comparison choices rendered their own `print-products`
  section without the alternate presentation.
- An isolated Site Design picker with the real `SiteDesignPreviewFrame` and
  `/preview-shop` iframe switched through all five themes and rendered their
  corresponding print sections. The temporary fixture was removed afterward.
- Fourteen focused preset tests, application TypeScript, scoped lint, and a Vite
  production build passed. Build emitted existing bundle size and dependency
  warnings.

No hosted draft save, publish, deployment, pricing write, or database change was
made. Authenticated editor publication and hosted storefront readback remain to
be checked when an owner elects a design. Rollback is limited to the explicit
selection helper and its calls in Site Design and the local comparison; the
existing publication adapter and stored tenant branding are unchanged.
