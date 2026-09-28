# Future Direction: AI Print-Shop Operator

Recorded: 2026-08-25

## Status

**Parked product hypothesis. No implementation is approved from this document.**

Webprinter is not yet ready for this expansion. The current priority remains
finishing and proving the existing tenant, product, pricing, template,
designer, checkout, order, payment, and fulfillment connections. Future agents
must not interpret this note as an active task or begin building it without a
new explicit decision from the owner.

## Product Idea

A print house could begin with a tenant shell and configure its shop through a
conversation instead of learning every administration screen. For example:

> We sell flyers, banners, and workwear. Use our logo, put flyers first, add our
> markup, and create a clean Danish storefront with dropdown navigation.

The agent would prepare a draft using Webprinter's existing products, pricing,
templates, design system, checkout, and fulfillment infrastructure. The print
house would review the result in a real preview and explicitly approve
publication.

The intended positioning is:

> Webprinter is the print-commerce engine. The agent is the easiest way to
> configure and operate it.

This is not intended to become a general-purpose website generator. The value
comes from Webprinter's structured print data and operational connections:
formats, materials, quantities, pricing, tenant markup, design templates, PDF
checks, suppliers, POD, checkout, orders, and fulfillment.

## Safe Product Shape

The agent should use a small set of typed, validated Webprinter actions, such
as:

- Create or edit a shop draft.
- Apply a logo, colors, fonts, and an approved shop theme.
- Add an approved product from the Webprinter catalog.
- Create and reorder categories and navigation.
- Set tenant markup within permitted rules.
- Place products and categories on the storefront.
- Preview storefront, product, designer, and checkout states.
- Validate the complete order flow.
- Publish only after explicit human approval.
- Restore a previous version.

The agent must not:

- Write arbitrary production React code from a chat prompt.
- Write directly to unrestricted database fields.
- Silently change supplier cost, Webprinter price, tenant markup, or existing
  orders.
- Publish scraped Supplier Bank data without review.
- Replace or bypass the existing pricing, POD, template, checkout, or
  fulfillment rules.
- Hide uncertainty about missing products, prices, templates, or connections.

Every proposed change should be created as a draft with a visible diff,
validation result, audit trail, explicit approval, and rollback path.

## Prerequisites Before Restarting

Do not start implementation until a readiness review confirms all of these:

1. One real Webprinter order works end to end from product selection through
   file/design handling, checkout, payment, administration, and fulfillment.
2. Salgsmapper proves the complete sales-folder flow, including correct prices,
   format-specific templates, designer handoff, checkout, and order handling.
3. Onlinetryksager proves a complete general-print product flow.
4. Product ownership and distribution rules are unambiguous, including the
   difference between master products, independent tenant copies, POD products,
   and updateable products.
5. Product source and version relationships are stored so updates cannot create
   accidental duplicates or overwrite tenant customizations.
6. Template selection is reliable for every supported product format and
   variant, including download and non-printing designer overlays.
7. Tenant branding, domains, authentication, payments, shipping, email, SEO,
   analytics, and legal settings are operationally ready.
8. Site Design V2 can preview and version the homepage, category pages, product
   pages, designer handoff, and checkout without losing tenant data.
9. Supplier Bank imports remain staged and approval-gated, with traceable price
   provenance.
10. The platform has validated command APIs, permissions, audit logs, preview,
    publish approval, and rollback for every action exposed to the agent.

## Smallest Future Pilot

When the prerequisites are satisfied, `PVCbanner.dk` is the preferred narrow
pilot:

1. Start with an empty tenant shell.
2. Upload the logo and choose an approved shop design.
3. Let the agent add five reviewed banner or sign products.
4. Let it create categories, navigation, homepage placement, and controlled
   tenant markup.
5. Verify desktop, mobile, product, designer/upload, and checkout previews.
6. Complete one controlled order.
7. Publish only after owner approval.

## Restart Decision

Revisit this hypothesis only after the commercial-readiness proof flows are
complete. The first implementation step should then be defining approximately
ten safe agent commands and their validation/rollback contracts, not building a
free-form chatbot or autonomous site generator.
