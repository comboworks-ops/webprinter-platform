# Company Hub V2 Design

Date: 2026-07-11
Status: Approved architecture, written specification pending user review
Owner: Webprinter

## 1. Purpose

Company Hub V2 is a private, tenant-safe web-to-print workspace for Danish
businesses with recurring print needs. It lets a company assemble an approved
catalogue from the tenant's existing products, personalise controlled fields in
approved designs, route orders to offices and delivery addresses, manage shared
files, request consultant help, and complete orders through Webprinter's current
pricing, designer, checkout, payment, and production flows.

The first complete industry pilot is a real-estate company. The architecture is
generic and must also support restaurants, retail chains, franchises, service
companies, associations, and other multi-location customers.

## 2. Product Principles

1. Company Hub is a governed workspace, not a second webshop.
2. Existing product, pricing, delivery, checkout, order, and production logic
   remains authoritative.
3. A company catalogue references existing tenant products. It does not clone
   or rewrite product pricing.
4. Approved artwork remains locked. Only explicitly configured fields may be
   changed by a company user.
5. Original PDF and vector data is preserved whenever the existing designer
   export path can preserve it.
6. Every company-facing record is scoped by both `tenant_id` and `company_id`.
7. The customer experience is visual and task-focused. Technical identifiers,
   raw URLs, database IDs, and implementation details are never required from
   normal users.
8. Danish is the default interface language, including correct Danish letters.
9. The private portal is `noindex,nofollow`. Search visibility belongs to a
   public Company Hub service page, not authenticated company data.
10. The rollout is additive, versioned, and reversible without changing POD v1,
    POD v2, or current pricing tables.

## 3. Existing Foundation

The implementation builds on these existing contracts:

- `company_accounts`, `company_members`, and `company_hub_items` provide the
  current Company Hub membership and basic product assignment.
- `products` and the current product pricing models remain the product and price
  source of truth.
- `designer_saved_designs`, `designer_templates`, and `design_library_items`
  remain the design and asset foundation.
- `SiteCheckoutState` remains the browser handoff into configuration and
  checkout.
- `FileUploadConfiguration` remains the verified quote, payment, order, and
  order-file flow.
- The current vector-preserving PDF import/export pipeline remains the
  production artwork path.
- Stirling PDF remains an optional private processor behind
  `designer-pdf-service`; it is not the Company Hub editor.
- Existing orders, order files, messages, delivery tracking, POD v1, and POD v2
  continue to operate unchanged.

The current Company Hub passes zero prices directly to checkout. V2 removes
that behavior. A Company Hub order must receive a valid quote from the same
product configuration flow used by the public shop before payment or order
creation is possible.

## 4. Roles And Access

### Tenant roles

- `master_admin`: manages all tenant Company Hubs when operating in master
  context.
- `admin`: creates and administers Company Hubs for its tenant.
- `staff`: performs supported operational work for its tenant.

### Company roles

- `company_owner`: manages company settings, offices, users, approvals, and the
  catalogue.
- `company_admin`: manages offices, members, addresses, assets, and approved
  catalogue assignments.
- `company_approver`: reviews and approves requests that require approval.
- `company_buyer`: personalises and orders approved products.
- `company_viewer`: can view the catalogue, files, and order history but cannot
  place an order.

Existing `company_admin` and `company_user` rows remain valid. During V2 rollout,
`company_admin` maps to `company_admin` and `company_user` maps to
`company_buyer`. New roles are stored explicitly after the additive migration.

An optional office assignment limits a member to one or more offices. A company
owner or administrator may have access to every office.

## 5. Information Architecture

### Customer portal `/company`

The authenticated Company Hub uses a quiet operational layout with a stable
company and office switcher.

Primary views:

1. `Overblik`
   - frequently ordered products
   - recent orders and current status
   - drafts awaiting completion
   - approvals requiring attention
   - quick access to consultant help
2. `Produkter`
   - visual categories and product previews
   - filters for office, product type, and ordering status
   - favourites and recently ordered items
3. `Design og filer`
   - approved templates
   - company logos and approved images
   - uploaded PDFs and production files
   - design and export history
4. `Ordrer`
   - company order history
   - office, recipient, status, and reorder actions
5. `Kontorer og adresser`
   - office directory
   - delivery and billing addresses
   - office-specific contact details and defaults
6. `Godkendelser`
   - visible only to relevant roles
   - pending, approved, rejected, and expired requests
7. `Indstillinger`
   - company identity and preferences according to role

### Tenant admin `/admin/companyhub`

The existing raw CRUD surface becomes an onboarding and operations workspace:

1. Company overview and status.
2. Company identity, logo, and contacts.
3. Offices and shared addresses.
4. Members, roles, and office access.
5. Visual catalogue import from current tenant products.
6. Template assignment and controlled-field setup.
7. Approval and spending rules.
8. Files and consultant requests.
9. Test order and publish-readiness checklist.

The admin never has to paste a design UUID or thumbnail URL. Designs, products,
assets, and previews are selected through searchable visual pickers.

## 6. Data Model

The V2 migration extends existing Company Hub data additively. All new public
tables include explicit Data API grants, RLS, indexes, timestamps, and a rollback
note in the same migration.

### Extensions to existing tables

`company_accounts` gains:

- `slug`
- `status`: `draft`, `active`, `paused`, or `archived`
- `industry_key`
- `contact_email`
- `contact_phone`
- `billing_email`
- `settings jsonb`
- `updated_at`

`company_members` gains:

- expanded role constraint
- `status`: `active` or `disabled`
- `is_all_offices`
- `updated_at`

`company_hub_items` remains the compatibility catalogue table and gains:

- `category_id`
- `status`: `draft`, `active`, or `archived`
- `short_description`
- `template_binding_id`
- `requires_approval`
- `is_featured`
- `office_scope`: `all` or `selected`
- `updated_at`

Existing rows default to active-compatible values and remain readable.

### New tables

#### `company_offices`

Stores a company's locations and office-specific identity fields.

Important fields: `id`, `tenant_id`, `company_id`, `name`, `code`, `email`,
`phone`, `website`, `is_default`, `status`, `profile_data jsonb`, timestamps.

`profile_data` contains approved business variables such as area name or local
branch description. It must not contain secrets.

#### `company_addresses`

Stores shared delivery and billing addresses owned by the company or office.
This is separate from `customer_addresses`, which remains a user's private
address book.

Important fields: `id`, `tenant_id`, `company_id`, optional `office_id`, `type`,
`label`, recipient/company fields, Danish postal address, country code, phone,
default flags, status, timestamps.

#### `company_member_offices`

Links a member to permitted offices. The row repeats `tenant_id` and
`company_id` for enforceable tenant and company checks.

#### `company_catalog_categories`

Stores company-specific visual categories such as `Visitkort`, `Salgsmateriale`,
`Skilte`, `Klistermærker`, or `Restaurantemballage`.

#### `company_catalog_item_offices`

Limits a catalogue item to selected offices when `office_scope = 'selected'`.

#### `company_template_bindings`

Links one Company Hub item to an approved source design and defines the
personalisation policy.

Important fields: source `design_id` or `template_id`, version, status, preview,
output mode, source fingerprint, approved by/at, and timestamps.

A binding is immutable after it has been used for an order. Editing creates a
new version so historical orders remain reproducible.

#### `company_template_fields`

Defines every editable field in a binding.

Important fields: stable key, Danish label, field type, Fabric object reference,
required flag, default source, validation rules, allowed values, max length,
office/user/company auto-fill mapping, sort order, and locked geometry/style
flags.

Supported initial field types:

- single-line text
- multi-line text
- email
- telephone
- URL
- approved image or logo
- approved option list

End users may change only field values. Geometry, fonts, colours, and object
styles stay locked unless that specific property is explicitly allowed in the
field definition.

#### `company_assets`

Stores metadata for company-owned files in a private storage bucket. Asset types
include logo, image, source PDF, approved artwork, and supporting document.
Every storage path begins with `tenant_id/company_id/` and access is verified by
RLS and storage policies.

#### `company_order_requests`

Tracks a Company Hub order before and after it enters the existing order flow.
It stores company, office, catalogue item, template version, selected field
values, quantity, product configuration snapshot, verified quote snapshot,
delivery address snapshot, approval state, and optional final `order_id`.

It does not calculate price and does not replace `orders`.

#### `company_consultant_requests`

Stores structured requests for Webprinter assistance: new portal setup, new
product, template preparation, file correction, or general advice. It contains
company context, optional product/asset links, message, status, and assignment.

#### `company_activity_events`

Stores a small audit trail for security and support: catalogue publication,
template version approval, member/office changes, approvals, consultant request
status, and handoff to an order. It does not duplicate complete order history.

## 7. Service Boundaries

The UI does not query and mutate every table directly from one large hook.
Company Hub V2 introduces focused repository and service modules:

### `CompanyHubRepository`

Reads and writes company-owned data through tenant-safe queries. It contains no
pricing, PDF, or checkout calculations.

### `CompanyCatalogService`

Lists eligible tenant products and creates catalogue references. It never
copies price rows or changes product publication state.

### `CompanyTemplateService`

Loads approved bindings, resolves auto-filled values, validates user edits, and
creates a user-owned working design derived from the approved source. It never
mutates the approved source design.

### `CompanyQuoteService`

Builds the same product selection and `pricingQuote` contract used by the normal
product page. The authoritative backend quote verification remains unchanged.
If a valid quote cannot be produced, the order action is blocked with a Danish
recovery message and a link back to product configuration.

### `CompanyCheckoutAdapter`

Writes an extended `SiteCheckoutState` containing optional Company Hub context:
`companyId`, `companyOfficeId`, `companyCatalogItemId`,
`companyOrderRequestId`, and delivery-address selection. Existing consumers
ignore these optional fields until their integration slice is enabled.

### `CompanyApprovalService`

Applies the company's explicit approval policy. Products without an approval
requirement continue directly to checkout after a verified quote. Products that
require approval create a pending request and cannot create a paid order until
approved.

## 8. Controlled Personalisation Workflow

1. The tenant admin selects an approved saved design or template.
2. The admin identifies editable objects and assigns stable field keys.
3. The admin sets validation, auto-fill source, and which properties remain
   locked.
4. The system creates a versioned template binding with a preview.
5. A company user opens the catalogue item and chooses an office.
6. Company, office, and user values prefill the permitted fields.
7. The user edits only the visible fields and sees a live proof.
8. Saving creates a separate working design or immutable value snapshot; it
   never updates the approved source.
9. Export composites permitted overlays with the protected source PDF/vector
   background through the existing designer export path.
10. Preflight and approval complete before checkout.

For the real-estate pilot:

- Visitkort: name, title, mobile, email, office, optional portrait.
- Salgsmappe: area, office, adviser, telephone, email.
- Til-salg-skilt: property/address text, adviser, office, telephone.
- Klistermærke: approved office or campaign option.

## 9. Catalogue And Ordering Flow

### Admin import

1. Open `Tilføj produkt`.
2. Search and filter products already available to the current tenant.
3. Select a product, default configuration, category, offices, preview, and
   optional template binding.
4. Validate that the selected product can produce a real price.
5. Save as draft, run a test order, then publish to the company.

The action creates a Company Hub reference only. It does not publish a product
to the storefront and does not import supplier data.

### Customer order

1. Select company and office.
2. Select a visual product.
3. Confirm or personalise the approved design.
4. Choose product configuration and quantity.
5. Resolve and display a verified price through existing pricing logic.
6. Select an allowed company delivery address.
7. Complete approval when required.
8. Continue through existing checkout, payment, order creation, file handling,
   and production routing.
9. Link the resulting order to the Company Hub request for history and reorder.

Reorder starts from the saved product configuration and template version, then
obtains a fresh current quote. Historical prices are displayed as history and
are never reused as current prices.

## 10. File And PDF Rules

- Company files use private storage and signed URLs.
- Upload validation covers MIME type, extension, size, ownership, and path.
- The original upload is immutable; transformed outputs use new storage paths.
- Approved PDF artwork is preserved as the vector background when supported by
  the current designer exporter.
- Controlled text and image changes are overlays, not destructive edits to the
  source PDF.
- Stirling may later perform licensed, private, server-side repair or inspection
  behind `designer-pdf-service`, but Company Hub remains functional when it is
  disabled.
- Rasterising operations are never silent and are not part of the initial
  controlled-template workflow.
- Production exports retain the existing preflight, bleed, safe-area, colour,
  and CutContour safeguards.

## 11. Approval And Error Handling

- Missing company or office access returns an access-denied state without
  leaking record existence.
- A missing or archived product shows the item as unavailable and directs the
  company administrator to contact the tenant.
- A missing price blocks checkout; zero is never treated as a valid placeholder.
- A changed product configuration invalidates the previous quote and design
  readiness signature.
- A changed template version never mutates pending or historical requests.
- Failed uploads keep the user's entered form values and provide a retry.
- Approval rejection preserves the draft and includes a reason.
- Database writes that span request state and order linking are idempotent.
- Customer-facing errors are concise Danish; diagnostic detail stays in logs.

## 12. Visual Direction

Company Hub is an operational product surface rather than a marketing landing
page.

- Use compact, scannable navigation and restrained visual styling.
- Use actual product and design previews as the primary visual signal.
- Avoid nested cards and decorative dashboard clutter.
- Use icons for navigation and common actions, with tooltips where needed.
- Keep product tiles stable in size across loading and dynamic states.
- Show status with text and icon, not colour alone.
- Support keyboard navigation, visible focus, reduced motion, WCAG AA contrast,
  and responsive layouts from mobile through wide desktop.
- Respect the tenant's active storefront design tokens while keeping Company Hub
  controls legible and predictable.

## 13. SEO And Marketing Boundary

The private routes `/company` and Company Hub subroutes render
`noindex,nofollow` and are excluded from public sitemaps.

A later public service page may present the offer using Danish search themes:

- firmaportal til tryksager
- web-to-print for virksomheder
- visitkortportal til medarbejdere
- bestilling af tryksager til flere afdelinger
- brandstyrede tryksager

The public page contains no company names, private product data, order history,
or customer files. SEO analytics remain in the existing platform SEO system.

## 14. Delivery Slices

### Slice 1: Foundation

- additive schema, grants, RLS, indexes, and generated types
- focused repository/service contracts
- compatibility mapping for current Company Hub rows and roles

### Slice 2: Offices And Membership

- company settings
- offices and shared addresses
- expanded roles and office access
- company/office switcher

### Slice 3: Visual Catalogue

- categories
- visual product import from existing tenant products
- product previews, drafts, publication, and office scope
- elimination of zero-price checkout handoff

### Slice 4: Controlled Templates And Files

- template binding/versioning
- field configuration
- customer personalisation
- company assets and vector-preserving export

### Slice 5: Approvals, Consultant Setup, And Orders

- approval policy and queue
- consultant requests
- linked order history and reorder with fresh quotes
- operational dashboard

### Slice 6: Real-Estate Pilot And Hardening

- visitkort, salgsmappe, til-salg-skilt, and sticker examples
- end-to-end pilot data
- accessibility, responsive, security, and production-flow verification

Each slice remains deployable behind the existing `company-hub` module flag.
Incomplete V2 screens do not replace working V1 behavior until their data and
acceptance gates pass.

## 15. Verification

### Automated checks

- migration grant checker passes for every new public object
- RLS tests prove tenant, company, role, and office isolation
- unit tests cover field validation, role mapping, quote invalidation, and
  checkout context
- integration tests cover catalogue import and approved-template derivation
- production build passes
- focused TypeScript and lint checks pass for changed files

### Browser verification

At desktop and mobile widths, Playwright verifies:

1. tenant admin creates a company and office
2. admin assigns members and office access
3. admin imports an existing product without copying pricing
4. admin binds a controlled real-estate template
5. company buyer selects an office and edits permitted fields
6. locked design properties cannot be changed
7. the preview and exported PDF match the approved composition
8. a current non-zero quote is produced by existing pricing logic
9. an approval-required request cannot bypass approval
10. an approved request reaches existing checkout and creates an order
11. the order and production file appear in existing admin handling
12. another company and tenant cannot read the records or signed files
13. private routes contain `noindex,nofollow`

Production-flow verification must include both a normal product and a product
that uses a specialised current pricing path. No test may rewrite live price
rows or trigger a real supplier submission.

## 16. Rollout And Rollback

Rollout begins with one internal real-estate pilot company under the existing
Company Hub module flag. New tables and columns are additive. V1 rows remain
readable throughout the rollout.

Rollback procedure:

1. Disable Company Hub V2 UI through the module/version flag.
2. Restore the V1 route components without changing company data.
3. Leave additive tables in place to preserve audit and order references.
4. Do not delete linked assets, template versions, requests, or order links.
5. A later reviewed cleanup migration may archive unused V2 records after the
   retention period; no automatic destructive rollback is permitted.

No slice changes POD v1 tables, POD v2 tables, supplier submissions, existing
price rows, or the authoritative payment verification flow.

## 17. Definition Of Complete

Company Hub V2 is complete only when a Danish business can be onboarded without
raw IDs, create offices and shared addresses, receive members with scoped roles,
add existing tenant products to a visual private catalogue, personalise only
approved template fields, manage company files, request consultant assistance,
obtain a real current price, pass approval when required, complete the existing
checkout, produce the correct production file, and see the resulting order in
both Company Hub and current Webprinter order handling.

The completion claim also requires verified tenant isolation, company isolation,
office access, responsive UI, accessible controls, private-route SEO protection,
and evidence that current pricing and POD flows remain unchanged.
