# Designer Build Memory

> Single source of truth for the Print Product Designer implementation

---

## Project Status: PHASE 0 COMPLETE ✅ → READY FOR PHASE 1

**Started:** 2025-12-26
**Last Updated:** 2025-12-26T03:30

---

## Stack Detected

| Component | Technology |
|-----------|------------|
| Frontend | **Vite + React 18 + TypeScript** |
| Routing | **React Router v6** |
| Database | **Supabase (PostgreSQL)** |
| Storage | **Supabase Storage** |
| Styling | **Tailwind CSS + shadcn/ui** |
| State | React hooks + TanStack Query |
| Multi-tenant | ✅ (tenant_id on all tables) |

---

## Phase 0: Discovery Findings ✅ COMPLETE

### A) Codebase Structure Analysis

#### Product Pages & Variant Selection
- **Product page location:** `/src/pages/ProductPrice.tsx`
- **Routing:** `/produkt/:slug` → ProductPrice component
- **Variant selection:** Uses `productConfigs` object for formats (A4, A5, etc.)
- **MPA products:** Use `MachineConfigurator` component for machine-priced add-ons

#### Data Models (Products Table)
```typescript
products {
  id: UUID (PK)
  name: string
  slug: string (URL-friendly)
  description: string
  category: string ("tryksager" | "storformat" | etc)
  pricing_type: string ("matrix" | "fixed" | "formula")
  image_url: string
  is_published: boolean
  tenant_id: UUID (multi-tenant)
  is_available_to_tenants: boolean
  technical_specs: JSON {
    width_mm: number
    height_mm: number
    bleed_mm: number
    min_dpi: number
    is_free_form: boolean
    standard_format: string
  }
  template_files: JSON array
  banner_config: JSON
  // ... other fields
}
```

#### Key Existing Tables
- `products` - main products
- `product_pricing_configs` - MPA pricing config
- `materials` - materials for machine pricing
- `machines` - print machines
- `pricing_profiles` - pricing rules
- `margin_profiles` - margin calculations
- `orders` - order history
- `tenants` - multi-tenant support

#### Storage Strategy
- **Product images:** `product-images` bucket in Supabase Storage
- **Templates:** `template_files` JSON array on products table
- **User uploads:** `/checkout/konfigurer` handles file uploads

#### Order/Cart Flow
1. User selects product variant + quantity on `/produkt/:slug`
2. Clicks "Bestil nu!" → navigates to `/checkout/konfigurer`
3. `FileUploadConfiguration.tsx` handles file upload + preflight
4. Order created via Supabase

---

### B) Integration Points Identified ✅

| Integration Point | Location | File | Purpose |
|-------------------|----------|------|---------|
| "Design online" button | Product price panel | `ProductPricePanel.tsx` | Entry from product variant |
| Designer route | `/designer/:variantId` | New: `Designer.tsx` | Main designer page |
| Saved designs | User account | `MyAccount.tsx` | List of saved designs |
| Menu entry | Grafisk Vejledning | `GrafiskVejledning.tsx` | Standalone access |

#### Specific Integration Code Locations:

1. **Entry button on product page:**
   - File: `/src/components/product-price-page/ProductPricePanel.tsx`
   - Location: After "Bestil nu!" button area
   - Logic: Show only if product supports design

2. **Route addition:**
   - File: `/src/App.tsx`
   - Add: `<Route path="/designer/:variantId" element={<Designer />} />`

3. **Menu entry:**
   - File: `/src/pages/GrafiskVejledning.tsx`
   - Location: Add section or link to designer

4. **Saved designs:**
   - File: `/src/pages/MyAccount.tsx`
   - Location: New tab/section for "Mine designs"

---

### C) Data Model Changes Required

#### New Tables

```sql
-- 1. Designer Templates (die-cut shapes, guides)
CREATE TABLE designer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'sticker_circle', 'sticker_rounded', 'business_card', etc.
  width_mm NUMERIC NOT NULL,
  height_mm NUMERIC NOT NULL,
  bleed_mm NUMERIC DEFAULT 3,
  safe_area_mm NUMERIC DEFAULT 3,
  -- SVG paths for:
  trim_path TEXT, -- actual cut line
  safe_area_path TEXT, -- where to keep text
  cut_contour_path TEXT, -- for stickers
  -- Metadata
  preview_image_url TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Saved Designs
CREATE TABLE designer_saved_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  user_id UUID REFERENCES auth.users(id),
  product_id UUID REFERENCES products(id),
  template_id UUID REFERENCES designer_templates(id),
  name TEXT NOT NULL,
  -- Document spec
  width_mm NUMERIC NOT NULL,
  height_mm NUMERIC NOT NULL,
  bleed_mm NUMERIC DEFAULT 3,
  dpi INTEGER DEFAULT 300,
  color_profile TEXT DEFAULT 'FOGRA39',
  -- Editor state
  editor_json JSONB NOT NULL, -- Fabric.js canvas JSON
  preview_thumbnail_url TEXT,
  -- Export status
  export_pdf_url TEXT,
  last_exported_at TIMESTAMPTZ,
  -- Preflight
  preflight_warnings JSONB,
  warnings_accepted BOOLEAN DEFAULT false,
  warnings_accepted_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Designer Exports (for order integration)
CREATE TABLE designer_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id UUID REFERENCES designer_saved_designs(id) NOT NULL,
  pdf_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  pages INTEGER DEFAULT 1,
  color_profile TEXT,
  has_cut_contour BOOLEAN DEFAULT false,
  exported_at TIMESTAMPTZ DEFAULT NOW(),
  -- Link to order (optional)
  order_id UUID,
  order_item_id UUID
);
```

---

## New Files to Create

| Path | Purpose |
|------|---------|
| `/src/pages/Designer.tsx` | Main designer page |
| `/src/components/designer/EditorCanvas.tsx` | Fabric.js canvas wrapper |
| `/src/components/designer/Toolbar.tsx` | Left toolbar (tools) |
| `/src/components/designer/PropertiesPanel.tsx` | Right panel (layers, props) |
| `/src/components/designer/TemplatePanel.tsx` | Template selection |
| `/src/components/designer/TopBar.tsx` | Size, DPI, warnings indicator |
| `/src/components/designer/PDFImportModal.tsx` | PDF import handler |
| `/src/components/designer/PreflightWarnings.tsx` | Warnings display |
| `/src/components/designer/WarningsAcceptanceModal.tsx` | Acceptance gate |
| `/src/hooks/useDesignerState.ts` | Designer state management |
| `/src/utils/preflightChecks.ts` | Preflight validation logic |
| `/src/utils/pdfExport.ts` | Client-side export preparation |
| `/supabase/functions/export-pdf/` | CMYK PDF/X server-side export |

---

## Assumptions

| Assumption | Value | Configurable |
|------------|-------|--------------|
| Default bleed | 3mm | Yes |
| Default DPI (business cards) | 300 | Yes |
| Default DPI (large format) | 150 | Yes |
| Min DPI warning threshold | 150 | Yes |
| Default color profile | FOGRA39 | Yes |
| Editor engine | **Fabric.js** | No |
| PDF rendering | **PDF.js** | No |
| PDF export | Server-side Node + Cairo/PDFKit | TBD |

---

## What's Done

- [x] ✅ Created Designer Build Memory artifact
- [x] ✅ Codebase discovery complete
- [x] ✅ Integration points identified
- [x] ✅ Data model designed
- [x] ✅ File structure planned
- [x] ✅ **PHASE 1: Database schema created**
- [x] ✅ **PHASE 1: Designer.tsx page created**
- [x] ✅ **PHASE 1: Routes added**
- [x] ✅ **PHASE 1: "Design online" button added**
- [x] ✅ **PHASE 1: Format parameter support**
- [x] ✅ **PHASE 2: Fabric.js installed**
- [x] ✅ **PHASE 2: EditorCanvas component created**
- [x] ✅ **PHASE 2: Tool handlers implemented**
- [x] ✅ **PHASE 2: Keyboard shortcuts**
- [x] ✅ **PHASE 2: Undo/Redo history**
- [x] ✅ **PHASE 2: Save to database**
- [x] ✅ **PHASE 2: Load existing designs**
- [x] ✅ **PHASE 2: Export PNG**
- [x] ✅ **PHASE 2: Canvas guides**
- [x] ✅ **PHASE 3: Layer panel**
- [x] ✅ **PHASE 3: Properties panel**
- [x] ✅ **PHASE 3: Font selection**
- [x] ✅ **PHASE 3: High-res export**
- [x] ✅ **PHASE 3: Tab-based right panel**
- [x] ✅ **PHASE 4: PDF.js installed** (`npm install pdfjs-dist@3.11.174`)
- [x] ✅ **PHASE 4: PDF Import Modal** (`/src/components/designer/PDFImportModal.tsx`)
  - Upload PDF file
  - Preview pages
  - Navigate multi-page PDFs
  - Import selected page as high-res image
- [x] ✅ **PHASE 4: Preflight Checks** (`/src/utils/preflightChecks.ts`)
  - Low resolution image detection
  - Text outside safe area warning
  - Empty canvas check
  - Objects outside canvas warning
  - Thin stroke warning
  - Small text warning
- [x] ✅ **PHASE 4: Preflight Panel** (`/src/components/designer/PreflightPanel.tsx`)
  - Show errors, warnings, infos
  - Dismiss individual warnings
  - Accept all warnings
  - Highlight problematic objects
- [x] ✅ **PHASE 4: Preflight button in toolbar**
- [x] ✅ **PHASE 4: Order integration** ("Bestil" button for products)
- [x] ✅ **PHASE 4: Save preflight results to database**
- [x] ✅ **PHASE 5: Soft Proof (CMYK Preview)** (`/src/components/designer/ColorProofingPanel.tsx`)
  - Toggle on/off via "Farver" tab
  - Output profile selection (FOGRA39, FOGRA51, SWOP)
  - Gamut warning overlay (shows out-of-gamut colors in green)
  - Worker-based color transformation for performance
  - Debounced updates (200ms)
  - Visual indicator when proofing is active
  - Settings saved to localStorage
- [x] ✅ **PHASE 5: Color Proofing Worker** (`/src/workers/simpleProofing.worker.ts`)
  - RGB → CMYK → RGB simulation
  - Profile-specific dot gain and gamut compression
  - Runs in Web Worker for non-blocking UI
- [x] ✅ **PHASE 5: useColorProofing hook** (`/src/hooks/useColorProofing.ts`)
  - Canvas event subscription
  - Debounced proofing updates
  - Overlay canvas management

## What's Next (PHASE 6 - Optional Enhancements)

1. [ ] PDF/X export (server-side for actual CMYK conversion)
2. [ ] Real ICC profiles via lcms-wasm (for production accuracy)
3. [ ] Templates gallery - premade designs
4. [ ] Image filters (brightness, contrast, etc.)
5. [ ] Crop tool for images
6. [ ] Align/distribute tools
7. [ ] Snap to grid/guides
8. [ ] Clone/duplicate objects
9. [ ] Group/ungroup objects

---

## Known Limitations / Deferred Features

| Feature | Status | Reason |
|---------|--------|--------|
| PSD layer import | Deferred | Complexity; flatten server-side later |
| Full PDF object editing | Deferred | Extract vectors/text unreliable |
| Multi-page documents | Deferred | Brochures/folders for v2 |
| Foil/spot inks beyond CutContour | Deferred | Phase 3+ |
| Variable data numbering | Deferred | Phase 3+ |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-26 | Use Fabric.js for editor | Mature, print-focused, good docs, JSON serialization |
| 2025-12-26 | PDF.js for PDF rendering | Standard, well-maintained, good quality |
| 2025-12-26 | Start with business cards + stickers | MVP scope manageable |
| 2025-12-26 | Route: `/designer/:variantId` | Matches existing route pattern |
| 2025-12-26 | Store editor state as JSON | Fabric.js native, efficient |
| 2025-12-26 | Server-side PDF export | CMYK conversion requires Node libraries |

---

## Testing Checklist (for later verification)

- [ ] Routing by variantId initializes correct size/bleed/DPI/template
- [ ] Add text/image/shapes, save, reload preserves state
- [ ] Import PDF, pick page, place at size, warnings show
- [ ] Warnings gate blocks export/add-to-cart until acceptance
- [ ] Export CMYK PDF exists and matches spec
- [ ] Sticker contour export includes CutContour spot path
- [ ] Nothing else on homepage/pages changed except designer entry point

