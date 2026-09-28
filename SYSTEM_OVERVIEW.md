# Printmaker Web Craft - Complete System Overview

Latest 17 September update (07:59 UTC): **all three production sites are LIVE with checkout, private uploads and live order-email processing enabled.** Thomas completed legacy API-key disable and signing-key migration, rotation and revocation. The old credential is rejected as both API key and bearer; modern credentials and signed artwork downloads pass. All 201 products, 357,913 generic price rows and 91 stored files remain. The scheduled email worker returns 200 with no messages sent. No credential approval remains. Fresh live authenticated acceptance and a real paid-order/production proof are still separate; no real payment was made. See [the current checkpoint](docs/PRODUCTION_ROLLOUT_CHECKPOINT_2026-09-17.md) before relying on historical notes below.

> **Use this document to give AI assistants (like ChatGPT) full context about this project.**
> Simply paste this entire document when starting a new conversation about the codebase.

---

## 🎯 Project Summary

**Printmaker Web Craft** (also known as **Webprinter.dk**) is a multi-tenant SaaS print shop platform built with React, TypeScript, and Supabase. It allows businesses to:

1. Run white-label print shops
2. Let customers design print products online using a professional canvas editor
3. Manage orders, products, pricing, and branding per tenant
4. Provide a B2B Reorder Portal (Company Hub) for business clients to reorder customized products

Latest non-destructive system review:
- `docs/SYSTEM_REVIEW_RECOMMENDATIONS_2026-06-27.md`

The main review guidance is to harden service-role Edge Functions, Stripe
amount calculation, admin role verification, and PDF-service input ownership
before adding more large product surfaces.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | TailwindCSS + shadcn/ui components |
| **State Management** | TanStack Query (React Query) + React Context |
| **Backend/Database** | Supabase (PostgreSQL + Auth + Storage + RLS) |
| **Canvas Editor** | Fabric.js 6.x |
| **PDF Generation** | jsPDF + custom canvas-to-PDF pipeline |
| **Color Management** | Custom ICC profile handling + CMYK soft proofing |
| **Routing** | React Router v6 |
| **Deployment** | Vercel (planned) |

---

## 📁 Project Structure

```
/src
├── components/
│   ├── admin/              # Admin panel components
│   │   ├── DesignResources.tsx      # Design Library management
│   │   ├── DesignerTemplateManager.tsx  # Format template management
│   │   ├── TenantBrandingSettingsV2.tsx # Branding editor
│   │   └── ...
│   ├── companyhub/         # B2B Portal components
│   │   ├── AdminCompanyHubManager.tsx   # CRUD for companies/items/members
│   │   ├── CompanyHubGrid.tsx           # User-facing portal grid
│   │   └── ...
│   ├── designer/           # Print Designer components
│   │   ├── EditorCanvas.tsx         # Main Fabric.js canvas (PROTECTED)
│   │   ├── DesignLibraryDrawer.tsx  # Library sidebar in designer
│   │   ├── SoftProofPanel.tsx       # CMYK proofing panel
│   │   └── ...
│   └── ui/                 # shadcn/ui primitives
├── hooks/
│   ├── useDesignLibrary.ts         # Design library data fetching
│   ├── useProductColorProfile.ts   # ICC profile loading
│   ├── useBrandingDraft.ts         # Branding state management
│   ├── useCompanyHub.ts            # B2B portal logic (CRUD + fetching)
│   └── ...
├── pages/
│   ├── Designer.tsx        # Main print designer page (PROTECTED)
│   ├── Admin.tsx           # Admin dashboard router
│   ├── CompanyHub.tsx      # User-facing B2B hub page
│   ├── Shop.tsx            # Storefront
│   └── ...
├── lib/
│   ├── branding/           # Branding system utilities
│   ├── color/              # ICC/CMYK color management
│   └── adminTenant.ts      # Tenant resolution logic
├── utils/
│   └── preflightChecks.ts  # Preflight validation rules (PROTECTED)
├── integrations/
│   └── supabase/
│       ├── client.ts       # Supabase client instance
│       └── types.ts        # Generated types
└── App.tsx                 # Main app with routing
```

---

## 🗄️ Database Schema (Key Tables)

### Multi-Tenancy
```sql
tenants (id, name, slug, domain, owner_id, ...)
user_roles (user_id, role, tenant_id)  -- Roles: admin, master_admin, user
profiles (id, email, first_name, last_name, ...) -- Syncs email from auth.users
```

### Products & Pricing
```sql
products (id, tenant_id, name, slug, base_price_per_unit, ...)
product_variants (id, product_id, name, prices_matrix, ...)
product_color_profiles (product_id, icc_profile_name, ...)
```

### Design System
```sql
designer_saved_designs (id, user_id, tenant_id, name, editor_json, preview_thumbnail_url, ...)
designer_templates (id, name, width_mm, height_mm, bleed_mm, category, is_active, ...)
design_library_items (id, tenant_id, name, kind, storage_path, visibility, ...)
```

### Branding
```sql
tenant_branding (tenant_id, fonts, colors, header, footer, ...)

### Company Hub (B2B)
```sql
company_accounts (id, tenant_id, name, logo_url, ...)
company_members (company_id, user_id, role, ...)
company_hub_items (id, company_id, product_id, design_id, title, thumbnail_url, ...)
```
```

### Storage Buckets
- `product-images` - Product photos and design thumbnails
- `tenant-assets` - Tenant logos and banners
- `icc-profiles` - ICC color profiles

---

## 🎨 Print Designer System

### Core Files (PROTECTED - Don't modify without review)
- `src/pages/Designer.tsx` - Main designer page, state management
- `src/components/designer/EditorCanvas.tsx` - Fabric.js canvas wrapper
- `src/utils/preflightChecks.ts` - Validation rules

### Features
1. **Canvas Zones**: Bleed (3mm default), Trim line, Safe zone (3mm inset)
2. **Preflight Checks**: Resolution warnings, safe zone violations, font size limits
3. **CMYK Soft Proofing**: ICC profile simulation overlay
4. **Design Save**: Saves to `designer_saved_designs` with thumbnail in `product-images` bucket
5. **PDF Export**: High-DPI canvas export to PDF with bleed
6. **Vector-Preserved PDF Import**: Imported PDFs keep original bytes for vector PDF export.

### PDF Designer + Service Foundation

Current implemented slice:
- `src/components/designer/PDFImportModal.tsx`
  - Imports PDF pages with PDF.js.
  - Supports page selection, rotate, crop-to-document ratio, stamp text,
    signature text, and text color.
  - Rebuilds edited pages with `pdf-lib` and passes edited bytes through the
    same vector-preserving import path.
- `src/components/designer/PdfToolsPanel.tsx`
  - Appears when a PDF background is selected.
  - Supports center/fit, previous/next page switching, reopen/edit selected PDF,
    replace selected PDF, CutContour extraction, vector export handoff, PDF
    service scan, and a compact design-product-flow checklist.
- `src/lib/designer/pdfService.ts`
  - Shared browser/edge PDF service report model.
  - Browser inspection fallback for page count, first-page size, file size, and
    warnings.
- `supabase/functions/designer-pdf-service/index.ts`
  - Generic designer PDF Edge Function, separate from POD v2.
  - Supports `inspect` now and reports future capability states for OCR,
    compression, repair, PDF/A, true redaction, and form flattening.

Remaining expansion points:
- Deploy `designer-pdf-service` when server-side inspection is needed:
  `supabase functions deploy designer-pdf-service`.
- Connect a real external PDF processor before enabling OCR, compression,
  repair, PDF/A conversion, true redaction, or form flattening.
- Add deeper save/load/export regression tests for designs containing edited PDF
  backgrounds.
- Keep Stirling-PDF as architecture inspiration only unless licensing and
  deployment/privacy review explicitly approve direct reuse.

### Document Specification
```typescript
interface DocumentSpec {
  name: string;
  width_mm: number;
  height_mm: number;
  bleed_mm: number;      // Default: 3
  safe_area_mm: number;  // Default: 3
  dpi: number;           // Default: 300
  color_profile: string; // e.g., "FOGRA39"
  product_id?: string;
  template_id?: string;
}
```

### URL Parameters
- `/designer?format=A4` - Start with standard format
- `/designer?templateId=<uuid>` - Load format template
- `/designer?designId=<uuid>` - Load saved design
- `/designer?productId=<uuid>` - Design for specific product

---

## 📚 Design Library System

### Three Tabs
1. **Mine** (My Designs) - User's saved designs from `designer_saved_designs`
2. **Skabeloner** (Templates) - Format templates from `designer_templates`
3. **Ressourcer** (Resources) - Shared assets from `design_library_items`

### Data Flow
```
Designer saves → designer_saved_designs table
                 + thumbnail → product-images bucket

useDesignLibrary hook → fetches based on tab:
  - 'mine' → designer_saved_designs (user's own)
  - 'skabeloner' → designer_templates (active templates)
  - 'ressourcer' → design_library_items (public resources)
```

### Thumbnail System
- Generated as low-res JPEG (quality: 0.6, scale: 0.2)
- Stored in `product-images` bucket at path: `{tenantId}/previews/{userId}-{timestamp}.jpg`
- Full public URL saved in `preview_thumbnail_url` column

---

## 🎯 Preflight Check Rules

### Errors (Block save/export)
- Image DPI < 96
- Text outside document bounds

### Warnings
- Image DPI < 150 (optimal: 300)
- Text in safe zone boundary
- Objects touching/crossing safe zone
- Font size < 6pt

### Protected Files
See `/preflight-protected` workflow for rules about modifying preflight logic.

---

## 🏢 Multi-Tenant Architecture

### Tenant Resolution
```typescript
// Master tenant UUID
const MASTER_TENANT = '00000000-0000-0000-0000-000000000000';

// Resolution order:
1. URL domain matching (tenant custom domain)
2. User's tenant_id from user_roles
3. Tenant owned by user (tenants.owner_id)
4. Fallback to master tenant
```

### Role System
- `master_admin` - Full access to everything
- `admin` - Tenant administrator
- `user` - Regular user

### RLS Policies
All tables use Row Level Security based on:
- `tenant_id` matching user's tenant
- `user_id` matching authenticated user
- `visibility` for public/private resources

---

## 🎨 Branding System

### Structure
```typescript
interface BrandingData {
  fonts: {
    heading: string;
    body: string;
    accent: string;
    urlHeading: string;
    urlBody: string;
    urlAccent: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    // ... more
  };
  header: {
    logo: string;
    transparent: boolean;
    scroll: { solid: boolean; blur: boolean; }
    cta: { enabled: boolean; text: string; link: string; }
    links: Array<{ label: string; href: string; }>
  };
  footer: { /* similar structure */ };
}
```

### Draft/Publish Workflow
1. Changes saved to `branding_drafts` table
2. Preview mode loads draft data
3. Publish copies draft → `tenant_branding` (live)

### Shopdesign

Site Design V2 separates complete shop presentation recipes from visual themes.
Ten versioned recipes control header, product menu, category navigation,
catalogue, product cards, product page, checkout, footer and motion while
preserving tenant products, prices, content and brand settings. Five product
menu layouts can be selected independently. Architecture, compatibility rules
and the template list are documented in
`docs/SHOP_TEMPLATE_SYSTEM_2026-07-27.md`.

---

## 🔧 Key Hooks & Utilities

### `useDesignLibrary(options)`
Fetches designs based on tab selection.

### `useProductColorProfile(productId)`
Loads ICC profile data for a product.

### `resolveAdminTenant()`
Returns the current admin's tenant context.

### `preflightChecks(canvas, options)`
Runs all validation rules on the canvas.

---

## 📝 Important Patterns

### 1. Protected Files
Some files have `// PROTECTED` comments. Check workflows before modifying:
- `EditorCanvas.tsx`
- `preflightChecks.ts`
- `Designer.tsx` (preflight section)

### 2. Supabase Type Casting
Due to generated types, we often cast:
```typescript
const { data } = await supabase
  .from('designer_saved_designs' as any)
  .select('*');
```

### 3. Thumbnail URL Handling
The system uses `preview_thumbnail_url` (full public URL) not `preview_path` (relative path).

### 4. Canvas Coordinate System
- Canvas uses pixels internally
- All specs are in mm
- Conversion: `pixels = mm * (dpi / 25.4)`

---

## 🚀 Common Development Tasks

### Add a new preflight rule
1. Check `/preflight-protected` workflow
2. Add rule to `src/utils/preflightChecks.ts`
3. Add message to `runPreflight()` in Designer.tsx

### Add a new design library type
1. Update `DesignLibraryItem` type in `useDesignLibrary.ts`
2. Update fetch logic for relevant tab
3. Update display in `DesignLibraryDrawer.tsx`

### Add branding option
1. Update types in `src/lib/branding/types.ts`
2. Update defaults in `mergeBrandingWithDefaults`
3. Add UI in branding editor component
4. Apply in relevant frontend components

---

## 📋 Environment Variables

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

---

## 🔗 Key Routes

| Route | Purpose |
|-------|---------|
| `/designer` | Print Designer (canvas editor) |
| `/admin` | Admin dashboard |
| `/admin/companyhub` | Company Hub management |
| `/admin/ressourcer/designs` | Design Library admin |
| `/admin/print-designer` | Template manager |
| `/shop` | Storefront |
| `/company` | B2B Portal (Company Hub) |
| `/produkter/:slug` | Product detail page |

---

## 🎨 CMYK Soft Proofing System (CRITICAL DEEP DIVE)

> ⚠️ **PROTECTED SYSTEM** - This is one of the most complex parts of the codebase.
> Review `.agent/workflows/soft-proof-protected.md` before making ANY changes.

### Overview

The soft proofing system simulates how colors will look when printed in CMYK, while the canvas itself **remains in RGB**. This is a **preview-only** feature that uses an HTML canvas overlay positioned on top of the Fabric.js canvas.

### Core Principle: SEPARATION OF CONCERNS

```
┌─────────────────────────────────────────────────────────────────┐
│                        FABRIC.JS CANVAS                         │
│                    (RGB - The actual design)                    │
│   This is what gets saved, exported, and is the source of truth │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                     (when proofing enabled)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     PROOFING OVERLAY CANVAS                     │
│        (RGB simulation of how CMYK will look on paper)          │
│    pointer-events: none - purely visual, never interacted with  │
└─────────────────────────────────────────────────────────────────┘
```

**CRITICAL**: The overlay is a **visual preview only**. It does NOT modify the Fabric canvas. When you save/export, you work with the original Fabric canvas, NOT the overlay.

### Implementation (2026-09-09)

- `useColorProofing.ts` captures only the visible document intersection at device pixel density. `proofPreviewGeometry.ts` supplies viewport-relative CSS bounds and a 12-million-pixel / 8192-axis budget. The overlay uses those bounds directly; no intermediate logical-size resampling.
- `colorProofing.worker.ts` uses the existing LittleCMS WASM wrapper. Keep the three-argument `cmsDoTransform(transform, input, count)` API. Profile revisions and request tickets discard stale frames after edits, zoom, or profile changes. During editing/pending refresh the original canvas remains visible.
- The gray pasteboard and guides remain outside the simulated artwork. Proofing does not change original Fabric colors/geometry, imported PDF bytes, or selection behavior.
- The optional green warning marks a large RGB color shift. It is an approximation, not a measured gamut boundary or contract proof.

### Profile identity and storage

`src/lib/color/iccProofing.ts` lists FOGRA39 300%, FOGRA51 and FOGRA52 as output recipes and sRGB as the browser design input space. FOGRA39 and sRGB remain existing public assets. New ECI profiles are installed per shop from their official sources because their profile redistribution terms are separate from the engine's license. Developer copies live in ignored `tmp/local-color-profiles`; the dev-only Vite plugin never copies them to a production build.

`profileResolver.ts` resolves the exact selected identity, validates ICC structure/class/channels/size and SHA-256, and enforces tenant-scoped lookup. Unknown, unavailable or changed profiles fail explicitly. There is no fallback from a failed selected profile to FOGRA39. `useProductColorProfile.ts` rejects stale product requests.

Custom files use the existing **`color-profiles`** storage bucket and `color_profiles` table. New uploads use `<tenant>/<uuid>/<sha256>.icc`. Uploaded UUIDs remain in `products.output_color_profile_id`; standard recipe IDs and method guidance live in `technical_specs.color_management`. Saved design JSON contains `__webprinterColor` with version, ID, name and checksum, without ICC binary duplication. The stored hash is checked when reopening the profile.

### Print, proof and order files

`src/lib/designer/export/createProductionPdf.ts` is the common production builder for downloads and order artwork. The implementation combines existing LittleCMS, jsPDF and pdf-lib with MIT-licensed svg2pdf.js and @pdf-lib/fontkit:

- Supported new shapes and text remain vector paths. Text uses actual font files; self-hosted Inter is supplied under OFL-1.1. Unsupported effects/fonts use bounded, physical-resolution raster fallback per object with an explicit warning.
- CMYK mode transforms new artwork using the selected ICC bytes. Raster streams contain actual four-channel samples; generated vector paints use CMYK operators. Black vector text/line art stays K-only. A real embedded ICC OutputIntent describes the target.
- sRGB mode tags new artwork as sRGB and avoids a CMYK conversion. Imported PDFs retain their existing colors; neither mode promises conversion of all imported content.
- Imported PDF pages preserve vectors and available source profile context. Unsupported imports fail explicitly rather than silently drop content.
- CutContour remains a named spot separation. Trim/bleed boxes and document crop are preserved, including on assembled template pages.
- Apparel PNG uses original RGB artwork with alpha, never the proof simulation. Editor guides and page-border strokes are excluded; intentional document fill is retained (transparent for apparel).

`exportActions.ts` uses the production builder for print/vector exports and `buildProofPdfBytes` only for an explicitly selected proof PDF. Proof PDFs are raster RGB simulations and must not be sent as production CMYK files. Multi-page assembly preserves page boxes and receives the selected output intent for CMYK production.

This is not PDF/X certification, a full PDF color-conversion engine, or a calibrated physical print proof. Relative colorimetric intent with black-point compensation remains the current default. The optional Stirling adapter is not required for this path.

See `docs/COLOR_MANAGEMENT_IMPLEMENTATION_2026-09-09.md` for verification, setup, limits and rollback.

---

## 💡 Tips for AI Assistants

1. **Always check for PROTECTED comments** before modifying core files
2. **Use the correct column names** - it's `preview_thumbnail_url` not `preview_path`
3. **Storage bucket is `product-images`** for user design thumbnails
4. **Tenant ID format**: UUID, master tenant is all zeros
5. **Check workflows** in `.agent/workflows/` for specific procedures
6. **Soft proofing overlay is VISUAL ONLY** - never affects Fabric canvas data
7. **Production export uses `createProductionPdf()`**; `exportCMYK()` is for explicit proof output, never the overlay canvas
8. **Worker uses lcms-wasm** - the API returns output, not modifies input
9. **Company Hub uses RLS** - admins of matching `tenant_id` can manage companies; members can see `hub_items`.

## Designer PDF Processing

The online designer keeps Fabric and vector PDF export as its production
authoring path. Optional heavy PDF operations go through the authenticated
`designer-pdf-service` Edge Function and a private Stirling-PDF provider.

- Inputs are downloaded with the caller's Supabase RLS context.
- Provider credentials remain server-side.
- Results are stored immutably under the authenticated user's ID.
- Redaction is intentionally rasterized; form flattening is forms-only.
- PDF/A is archival and does not replace PDF/X or print preflight.
- The provider is disabled until its enablement and license secrets are set.

See `docs/STIRLING_PDF_INTEGRATION.md` for deployment and rollback.

---

## 🏢 Company Hub (B2B portal) Deep Dive

### Concept
A whitelabel portal where business clients can log in and find their "pre-approved" products (e.g. employees' business cards, branded gift cards). These products are pre-configured with specific variants and designs.

### Architecture
- **Admin Hub**: Located in `/admin/companyhub`. Uses `AdminCompanyHubManager`.
- **User Portal**: Located in `/company`. Uses `CompanyHub` page and `CompanyHubGrid`.
- **Data Hook**: `useCompanyHub(tenantId)` handles all Supabase interactions.

### V2 Foundation (2026-07-13)

Company Hub V2 is additive and remains behind the existing `company-hub`
module boundary. The prepared foundation migration adds offices, company-owned
addresses, office-scoped members and catalogue items, visual categories,
versioned controlled-template bindings and fields, private asset metadata,
order requests, consultant requests, and activity events. Every new record is
scoped by both `tenant_id` and `company_id`, with explicit Data API grants and
RLS policies.

Focused application boundaries now live in `src/lib/company-hub/`:

- `types.ts` defines V2 roles and entities while preserving legacy rows.
- `access.ts` maps `company_user` to `company_buyer` and centralizes role
  capabilities.
- `repository.ts` isolates Company Hub reads from UI components.
- `checkout.ts` rejects zero, missing, stale, or mismatched quote handoffs before
  adding Company Hub context to the existing checkout state.

The V2 migration is prepared locally but is not active in the linked Supabase
project until its remote migration history is reconciled and the migration is
applied. Existing V1 screens continue to operate during the staged rollout.
Company Hub catalogue rows continue to reference current tenant products; they
never copy or recalculate pricing.

### Features
1. **User Discovery**: Admin can search for users by name/email within their tenant to add them to a company.
2. **Design Linkage**: A Hub Item can point to a `design_id`. Clicking "Order" in the portal will load that specific design directly into the checkout/designer.
3. **Automatic Email Sync**: Profiles table includes an `email` field synced from Supabase Auth via trigger to simplify admin member management.

---

*Last updated: January 6, 2026*

## Connection repair checkpoint — 2026-09-08

Local repairs cover truthful/conflict-checked branding persistence, atomic server-verified checkout order/files, approved-byte hashes, customer replacement/read-receipt authorization, checkout address integrity and Designer save/login safeguards. The follow-up adds server STORFORMAT quotes using the existing formula, verified per-area option dimensions, and `storefront_order_email_outbox` queued in the finalizer transaction. `storefront-order-email-dispatch` claims frozen messages with scoped test/live modes and bounded retries. Read `docs/SYSTEM_CONNECTION_REPAIRS_2026-09-08.md` for the six-migration matched packet. Nothing here is deployed; missing stored prices, optional operational follow-ups and hosted two-shop/two-account acceptance remain open. Preserve the dirty worktree, existing pricing formulas/POD behavior and selected designs.
