# AI Site Chat and POD Marketplace Notes

Date: 2026-04-28

This note captures a product direction discussed during Site Design V2 and POD v2 work. It is not an implementation plan yet.

## 1. Optional AI Site Chat

The idea is to add an optional AI chat that can help a tenant redesign or “vibe” their shop within strict system boundaries.

Example tenant prompt:

> I want a vibrant printing site focused on flyers and banners with a modern look.

The AI should not edit code, pricing logic, database schemas, or raw tenant data directly. Instead, it should produce a validated `siteDesignPatch` that maps to existing Site Design V2 controls.

Allowed AI-controlled areas could include:

- color preset selection and safe color adjustments
- font preset selection
- hero/banner overlay, title, buttons, and image choices
- USP strip styling and text
- header/dropdown preset choices
- product section layout
- matrix, option button, and price panel styling
- SEO copy suggestions
- product/category emphasis where products already exist

Required guardrails:

- AI output must be structured JSON, not free-form writes.
- Only whitelisted fields can be changed.
- Validate color contrast before applying.
- Validate product/category IDs against the tenant catalog.
- Never change pricing calculations, POD import rules, fulfillment logic, RLS, or tenant scoping.
- Preview first, then apply only after tenant approval.
- Store a rollback snapshot before applying any AI patch.

Good architecture:

1. User prompt enters AI chat.
2. AI returns a constrained `siteDesignPatch`.
3. Backend validates the patch against a schema.
4. UI shows a before/after preview.
5. Tenant approves.
6. Existing Site Design V2 save flow persists the change.

This would let tenants make large design changes conversationally while still using the existing safe design system.

## 2. Simplified Print on Demand Marketplace

Another idea is a simplified POD catalog/marketplace for tenants. Instead of making a tenant run the full POD v2 API explorer/import process, they would browse a curated supplier product catalog.

The core gap today is discovery before import. In the current flow, the product is imported through POD v2, refined inside the system, and then shared onward to tenant shops. That works for controlled publishing, but the tenant cannot really look into the full product details before deciding whether they want it. They effectively have to import first, then inspect and decide.

The marketplace would change that into a browse-first flow. Tenants should be able to see enough curated product information before import: product type, preview images, available formats, materials, option groups, add-ons where supported, approximate price ranges, production notes, and supplier/source. Only after that should they press `Import`.

Example tenant flow:

1. Tenant opens “Print on Demand”.
2. Tenant searches or filters for “flyers”.
3. System shows available supplier products, for example 20 flyer product sets.
4. Tenant sees basic pricing ranges, formats, materials, quantities, and fulfillment notes.
5. Tenant clicks `Import`.
6. System imports a curated product into their shop using the existing validated import flow.

This should be a tenant-friendly layer above POD v2, not a replacement for POD v2 internals.

Potential UI filters:

- product type, e.g. flyers, posters, business cards
- supplier
- formats
- materials
- quantity ranges
- delivery/production profile
- price range
- available add-ons

## 3. Supplier/API Adapter Reality

POD v2 currently exists as a Print.com integration. It should not be assumed that another supplier API will work out of the box.

Each supplier likely needs its own adapter because APIs differ in:

- product discovery endpoints
- option/attribute names
- valid combination rules
- quantity/range validation
- pricing response format
- add-on handling
- images/categories/thumbnails
- order submission and fulfillment status
- shipping/blind-shipping rules

Recommended future architecture:

- Keep the tenant-facing marketplace generic.
- Keep supplier integrations behind explicit adapters.
- Normalize supplier products into a shared internal catalog model.
- Keep pricing import versioned by supplier and adapter.
- Do not reuse POD v1 tables for this.
- Do not modify core pricing logic without a separate approved plan.

Possible supplier adapter shape:

```ts
type PodSupplierAdapter = {
  supplierId: string;
  searchProducts(query: ProductSearchQuery): Promise<SupplierProductSummary[]>;
  getProductDetails(supplierSku: string): Promise<SupplierProductDetails>;
  validateConfiguration(config: SupplierProductConfig): Promise<ValidationResult>;
  fetchPriceMatrix(config: SupplierProductConfig): Promise<NormalizedPriceMatrix>;
  normalizeForCatalog(product: SupplierProductDetails): PodCatalogProductDraft;
};
```

## 4. Relationship to Current POD v2

The current POD v2 system should remain the advanced/master-side import and curation tool.

The future marketplace could be a simpler tenant-facing experience built on top of curated catalog products:

- Master/admin configures and validates supplier products.
- Tenant browses clean product cards.
- Tenant imports with one click.
- Existing import/merge/delete safeguards still apply.

This keeps the complex API behavior away from tenants while still allowing a broad POD catalog experience.
