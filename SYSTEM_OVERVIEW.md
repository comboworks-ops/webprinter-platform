# Printmaker Web Craft - Complete System Overview

> **Use this document to give AI assistants (like ChatGPT) full context about this project.**
> Simply paste this entire document when starting a new conversation about the codebase.

---

## 🎯 Project Summary

**Printmaker Web Craft** (also known as **Webprinter.dk**) is a multi-tenant SaaS print shop platform built with React, TypeScript, and Supabase. It allows businesses to:

1. Run white-label print shops
2. Let customers design print products online using a professional canvas editor
3. Manage orders, products, pricing, and branding per tenant
4. Provide a B2B Reorder Portal (Company Hub) for business clients to reorder customized products

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

### File Architecture

```
src/
├── hooks/
│   └── useColorProofing.ts          # 🔒 PROTECTED - Main hook (490 lines)
│       • Creates Web Worker
│       • Manages proofing state
│       • Captures canvas → sends to worker → receives transformed data → renders overlay
│       • Provides exportCMYK() for PDF export
│
├── workers/
│   └── colorProofing.worker.ts      # 🔒 PROTECTED - Web Worker (381 lines)
│       • Loads lcms-wasm (Little CMS compiled to WebAssembly)
│       • Creates ICC transforms (sRGB → CMYK simulation)
│       • Processes pixel data in batches
│       • Returns transformed ImageData
│
├── lib/color/
│   └── iccProofing.ts               # 🔒 PROTECTED - Configuration (126 lines)
│       • ICC profile definitions
│       • Settings storage (localStorage)
│       • Type definitions
│
└── pages/
    └── Designer.tsx                  # Uses useColorProofing hook
        • proofingOverlayRef → HTML canvas overlay
        • colorProofing.settings.enabled → shows/hides overlay
```

### ICC Profiles

**Location**: `/public/icc/`

| File | Purpose |
|------|---------|
| `sRGB_IEC61966-2-1.icc` | Input profile (how screen displays colors) |
| `ISOcoated_v2_300_eci.icc` | FOGRA39 - European coated paper standard |

**Custom Profiles**: Products can have custom ICC profiles stored in Supabase `icc-profiles` bucket. These are loaded via `useProductColorProfile` hook and passed to `useColorProofing`.

### How Proofing Works (Step by Step)

```
1. User enables "Soft Proof" toggle
   ↓
2. useColorProofing captures Fabric canvas (document area only, excluding pasteboard):
   fabricCanvas.toDataURL({ left: pasteboardOffset, top: pasteboardOffset, ... })
   ↓
3. ImageData extracted and sent to Web Worker:
   worker.postMessage({ type: 'transform', imageData, ... })
   ↓
4. Worker creates proofing transform using lcms-wasm:
   cmsCreateProofingTransform(sRGB, sRGB, CMYK_Profile, SOFTPROOFING_FLAG)
   This means: Input RGB → Output RGB, but *simulating* what it would look like if converted to CMYK and back
   ↓
5. Worker transforms pixels in batches (4096 pixels at a time for memory management):
   - Extract RGB from RGBA
   - cmsDoTransform(transform, inputBatch, count) → returns transformed RGB
   - If gamut warning enabled: calculate color delta, mark out-of-gamut pixels
   ↓
6. Worker returns transformed ImageData back to main thread
   ↓
7. Hook draws transformed ImageData to overlay canvas positioned over document area:
   - overlay positioned at (pasteboardOffset, pasteboardOffset)
   - size matches document dimensions (docWidth × docHeight)
   - pointer-events: none - user interacts with Fabric canvas underneath
```

### Overlay Positioning (CRITICAL)

```tsx
// In Designer.tsx
<canvas
    ref={proofingOverlayRef}
    className="absolute pointer-events-none"
    style={{
        left: PASTEBOARD_PADDING,      // Start where document starts
        top: PASTEBOARD_PADDING,
        width: docWidth,               // Document size only (no pasteboard)
        height: docHeight,
        mixBlendMode: 'normal',
        zIndex: 10,                    // Above Fabric, below guide lines (z-20+)
    }}
/>
```

The overlay covers **only the document area** (the actual print area), not the gray pasteboard around it.

### Settings Structure

```typescript
interface ProofingSettings {
    enabled: boolean;               // Master toggle
    outputProfileId: string;        // e.g., 'fogra39' or custom UUID
    showGamutWarning: boolean;      // Show out-of-gamut areas in green
    gamutWarningColor: string;      // Default: '#00ff00'
    // Custom profile support (loaded per-product)
    customProfileId?: string;
    customProfileName?: string;
    customProfileBytes?: ArrayBuffer | null;  // Never saved to localStorage!
}
```

Settings (except `customProfileBytes`) persist to `localStorage` key: `designer_proofing_settings`

### Export vs Preview: THE CRITICAL DIFFERENCE

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           PREVIEW (Live Overlay)                          │
├──────────────────────────────────────────────────────────────────────────┤
│ • Uses proofing transform: RGB → RGB (simulating CMYK roundtrip)         │
│ • Scaled down for performance (max 1000px dimension)                      │
│ • Updates on every canvas change (debounced 200ms)                        │
│ • Hides during interaction (mouse:down) for performance                   │
│ • DOES NOT AFFECT the actual Fabric canvas data                           │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                           EXPORT (PDF Generation)                         │
├──────────────────────────────────────────────────────────────────────────┤
│ • Uses exportCMYK() function from useColorProofing                        │
│ • Captures HIGH RESOLUTION canvas (300 DPI by default)                    │
│ • Creates TWO transforms in worker:                                       │
│   1. RGB → CMYK: Actual CMYK data for print                               │
│   2. RGB → RGB (proofed): For embedding in PDF as preview                 │
│ • Returns { cmykData, proofedRgbDataUrl, width, height }                  │
│ • Currently: PDF uses proofedRgbDataUrl (CMYK-simulated RGB image)        │
│ • The cmykData is available but not yet used (future: CMYK PDF support)   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Export Flow in Designer.tsx

```typescript
// In handleSaveAsPDF():
const cropOptions = {
    left: PASTEBOARD_PADDING_PX,     // Capture from bleed start
    top: PASTEBOARD_PADDING_PX,
    width: (width_mm * MM_TO_PX) + (bleed * 2),   // Full bleed area
    height: (height_mm * MM_TO_PX) + (bleed * 2)
};

const { cmykData, proofedRgbDataUrl, width, height } = await colorProofing.exportCMYK(
    SRGB_PROFILE_URL,           // Input profile
    profile.url,                // Output profile (FOGRA39 or custom)
    productProfile.profileBytes, // Custom profile data if available
    cropOptions                 // What area to capture
);

// Create PDF at full bleed size
const doc = new jsPDF({ format: [pdfWidth, pdfHeight] });
doc.addImage(proofedRgbDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
```

### Worker Message Protocol

```typescript
// INIT - Load ICC profiles into worker
{ type: 'init', id: string, inputProfileData: ArrayBuffer, outputProfileData: ArrayBuffer }
→ { type: 'ready', id }

// TRANSFORM - Live preview proofing
{ type: 'transform', id, imageData: ImageData, showGamutWarning, gamutWarningColor }
→ { type: 'transformed', id, imageData: ImageData, gamutMask?: ImageData }

// EXPORT - High-res CMYK + proofed RGB
{ type: 'transform-to-cmyk', id, imageData, inputProfileData, outputProfileData }
→ { type: 'cmyk-transformed', id, cmykData, proofedImageData, width, height }

// ERROR
→ { type: 'error', id, error: string }
```

### Performance Optimizations

1. **Web Worker**: All color transforms run off main thread
2. **Batch Processing**: Pixels processed in 4096-pixel batches to manage memory
3. **Preview Scaling**: Live preview limited to 1000px max dimension
4. **Debouncing**: Canvas changes debounced (200ms) before re-processing
5. **Interaction Hiding**: Overlay hidden during drag/move operations
6. **Transferable Objects**: ImageData buffers transferred (not copied) between threads

### Gamut Warning System

When `showGamutWarning` is enabled:
- Worker compares original RGB to transformed RGB
- If `delta > 35` (color shift threshold), pixel is marked as out-of-gamut
- Gamut mask rendered as semi-transparent overlay (green by default, alpha 150)
- Helps users identify colors that will shift significantly in print

### ⚠️ CRITICAL WARNINGS FOR DEVELOPERS

1. **NEVER modify the Fabric canvas based on proofing data**
   - The overlay is preview-only
   - Users must be able to toggle proof off and see their true RGB colors

2. **NEVER include the overlay in exports**
   - Export captures from Fabric canvas directly using `toDataURL`
   - Overlay is positioned with CSS, not part of Fabric layer

3. **The proofedRgbDataUrl is NOT the same as cmykData**
   - `proofedRgbDataUrl`: RGB image that LOOKS like what CMYK will print (for preview/PDF)
   - `cmykData`: Actual CMYK pixel values (for future true CMYK PDF support)

4. **Profile loading must complete before transform works**
   - Check `isWorkerReady` before attempting transforms
   - Profiles are loaded async; UI should show loading state

5. **Custom profiles are NOT saved to localStorage**
   - ArrayBuffer too large and can't be JSON serialized
   - Must be re-loaded each session from Supabase

### Future Considerations

- **True CMYK PDF**: Currently exports RGB image with CMYK simulation. Future: embed actual CMYK data
- **ICC Profile Editor**: Allow admins to manage/upload custom profiles
- **Paper Simulation**: Add paper white point simulation (not just ink gamut)
- **Multiple Render Intents**: Currently uses Relative Colorimetric; could add Perceptual option

---

## 💡 Tips for AI Assistants

1. **Always check for PROTECTED comments** before modifying core files
2. **Use the correct column names** - it's `preview_thumbnail_url` not `preview_path`
3. **Storage bucket is `product-images`** for user design thumbnails
4. **Tenant ID format**: UUID, master tenant is all zeros
5. **Check workflows** in `.agent/workflows/` for specific procedures
6. **Soft proofing overlay is VISUAL ONLY** - never affects Fabric canvas data
7. **Export uses `exportCMYK()` function**, not the overlay canvas
8. **Worker uses lcms-wasm** - the API returns output, not modifies input
9. **Company Hub uses RLS** - admins of matching `tenant_id` can manage companies; members can see `hub_items`.

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

