# Webprinter Print Designer - Agent Handover Document

**Last Updated**: 2026-01-06  
**Project Path**: `/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main`

---

## Project Overview

This is a **print-ready design editor** for a Danish print shop (Webprinter.dk). Users can create designs for business cards, flyers, banners, etc., with proper CMYK color management and print specifications.

**Tech Stack**:
- React + TypeScript + Vite
- Fabric.js (canvas manipulation)
- lcms-wasm (ICC color transformations in Web Worker)
- Supabase (backend/database)
- Tailwind CSS + shadcn/ui

---

## Recently Completed Features

### 1. Soft Proofing (CMYK Simulation) ✅

**Purpose**: Simulate how RGB colors will look when printed in CMYK.

**Key Files**:
| File | Purpose |
|------|---------|
| `src/hooks/useColorProofing.ts` | Main hook - manages worker, settings, overlay rendering |
| `src/workers/colorProofing.worker.ts` | Web Worker with lcms-wasm for ICC transforms |
| `src/lib/color/iccProofing.ts` | ICC profile configuration |
| `public/icc/*.icc` | ICC profile files (sRGB, FOGRA39) |

**How it works**:
1. User enables soft proofing from the "Farver" tab
2. Hook captures canvas pixels, sends to Web Worker
3. Worker transforms RGB → CMYK → RGB using ICC profiles
4. Transformed image is drawn on overlay canvas
5. Optional gamut warning shows out-of-gamut colors in green

**Fixes applied**:
- Chunked pixel processing to prevent "offset is out of bounds" errors
- Cache-busting on ICC profile fetches
- Proper worker lifecycle management for toggle stability
- Adaptive DPI for large format products (2m+ = 100 DPI, 1m+ = 150 DPI)

**Known limitations**:
- PSO Coated v3 and US Web Coated SWOP profiles disabled (bad download sources)
- Preview limited to 1000px max dimension for performance

---

### 2. Physical Scaling on Import ⚠️ PROTECTED

**Purpose**: Imported files maintain their physical size based on DPI metadata.

**⚠️ THIS CODE IS PROTECTED AND MUST NOT BE MODIFIED**  
See: `.agent/workflows/physical-scaling-import.md`

**Key Files**:
| File | Purpose |
|------|---------|
| `src/utils/imageMetadata.ts` | Extracts DPI from PNG/JPEG metadata |
| `src/components/designer/EditorCanvas.tsx` | `addImage()` and `importSVG()` methods |
| `src/pages/Designer.tsx` | `handleImageUpload()` and `handlePDFImport()` |

**Behavior**:
- Image with DPI metadata: Scaled to `DISPLAY_DPI / sourceDpi`
- Image without DPI: Uses document DPI (typically 300)
- SVG: Assumes 96 DPI (web standard)
- PDF: Uses physical mm dimensions from viewport

**Example**: A5 image (300 DPI) imported into A3 layout = 1/4 of document area

---

### 3. Live Dimension Labels ✅

**Purpose**: Show width × height in mm below selected objects, updating in real-time.

**Location**: `src/pages/Designer.tsx` (lines ~1073-1090)

**How it works**:
- `EditorCanvas` emits `boundingRect` in `SelectedObjectProps`
- Designer renders floating label positioned below object
- Updates on `object:scaling`, `object:moving`, `object:rotating` events

---

### 4. PDF Export with CMYK Colors ✅

**Purpose**: Exported PDFs use color-transformed pixels matching soft proof.

**Location**: `src/pages/Designer.tsx` → `handleExport()`

**How it works**:
1. Calls `colorProofing.exportCMYK()` with profile URLs
2. Worker transforms RGB → CMYK and RGB → proofed RGB
3. Returns `proofedRgbDataUrl` which is embedded in PDF via jsPDF

---

### 5. Company Hub (B2B Reorder Portal) ✅

**Purpose**: Provide a dedicated portal for business clients to reorder previously designed products.

**Key Files**:
| File | Purpose |
|------|---------|
| `src/hooks/useCompanyHub.ts` | Main hook for CRUD and portal fetching |
| `src/pages/CompanyHub.tsx` | User-facing portal page (`/company`) |
| `src/components/companyhub/AdminCompanyHubManager.tsx` | Admin management UI |
| `supabase/migrations/20260130000000_company_hub.sql` | DB Schema |

**Highlights**:
- **Member Management**: Whitelist users by email or name.
- **Product Pinning**: Admins can pin specific products with default options and linked designs.
- **Direct Portal Link**: Admin panel includes a "Besøg Portal" link for quick access.
- **Email Sync**: Database trigger syncs `auth.users.email` to `public.profiles.email` for easy member identification.

---

## Important Constants

| Constant | Value | Location |
|----------|-------|----------|
| `DISPLAY_DPI` | 50.8 | EditorCanvas.tsx, Designer.tsx |
| `MM_TO_PX` | ~2.0 | Designer.tsx |
| `MAX_PREVIEW_DIMENSION` | 1000 | useColorProofing.ts |
| `DEBOUNCE_MS` | 200 | useColorProofing.ts |
| `PASTEBOARD_PADDING` | 100 | EditorCanvas.tsx, Designer.tsx |

---

## File Structure (Key Files)

```
src/
├── pages/
│   └── Designer.tsx           # Main designer page
├── components/designer/
│   ├── EditorCanvas.tsx       # Fabric.js canvas wrapper
│   ├── ColorProofingPanel.tsx # Soft proofing UI
│   ├── PropertiesPanel.tsx    # Object properties
│   └── LayerPanel.tsx         # Layer management
├── hooks/
│   └── useColorProofing.ts    # Soft proofing hook
├── workers/
│   └── colorProofing.worker.ts # ICC transformation worker
├── lib/color/
│   └── iccProofing.ts         # Profile configuration
├── utils/
│   ├── imageMetadata.ts       # DPI extraction (PROTECTED)
│   └── unitConversions.ts     # mm/px/pt conversions
public/
└── icc/
    ├── sRGB_IEC61966-2-1.icc
    └── ISOcoated_v2_300_eci.icc
```

---

## Running the Project

```bash
cd /Users/cookabelly/Documents/Antigravity\ stuff/printmaker-web-craft-main
npm run dev
```

The dev server is typically running on `http://localhost:5173`

---

## Workflows

| Command | Description |
|---------|-------------|
| `/physical-scaling-import` | PROTECTED - Physical scaling on import (DO NOT MODIFY) |
| `/color-picker` | How to add color pickers in branding/admin UI |

---

## Domain Ownership Quick Reference

When modifying code, check which domain you're working in:

| If changing... | You're in domain... | Also check... |
|----------------|---------------------|---------------|
| Canvas rendering | Designer | `components/designer/`, `preflightChecks.ts` |
| PDF export | Designer | `lib/designer/export/`, `.agent/workflows/` |
| Color proofing | Designer | `useColorProofing.ts`, `colorProofing.worker.ts` |
| Price display | Pricing | `lib/pricing/`, `utils/productPricing.ts` |
| Price matrices | Pricing | `utils/productPricing.ts`, `storformatPricing.ts` |
| Colors/fonts/hero | Branding | `lib/branding/`, `useBrandingDraft.ts` |
| Shop appearance | Branding | `contexts/PreviewBrandingContext.tsx` |
| POD imports | POD v2 | `lib/pod2/` ONLY (never `lib/pod/`) |

**Cross-domain changes require explicit discussion** with the user before proceeding.

**Full documentation**: `docs/ARCHITECTURE_BOUNDARIES.md`

**Domain-specific skills**:
- `/pricing-change` - Checklist for pricing modifications
- `/designer-change` - Checklist for designer modifications
- `/branding-change` - Checklist for branding modifications

---

## Backup & Restore Workflow

Before making risky changes, create a git tag backup:

```bash
# Create backup
git tag -a "backup/$(date +%Y-%m-%d)/before-pricing-change" -m "Backup before pricing changes"

# List backups
git tag -l "backup/*" --sort=-creatordate

# Restore specific files from backup
git checkout backup/2026-02-02/before-pricing-change -- src/utils/productPricing.ts
```

**Skills**:
- `/backup` - Create a backup point before changes
- `/restore` - Restore from a backup tag

**When to backup**: Always before modifying pricing, designer export, branding data flow, or database migrations.

---

## Pending/Future Work

1. **Re-enable ICC profiles**: Find reliable sources for PSO Coated v3 and US Web Coated SWOP
2. **True CMYK PDF export**: Current solution embeds proofed RGB; true CMYK requires server-side processing or advanced PDF library
3. **Preflight DPI warning**: Alert if imported images are below minimum print DPI
4. **Save/load with ICC profile selection**: Persist user's profile choice with saved designs

---

## Important Notes for New Agent

1. **PROTECTED CODE**: The physical scaling import feature is locked. Check `/physical-scaling-import` workflow before modifying any DPI/scaling logic.

2. **Web Worker lifecycle**: The `colorProofing.worker.ts` has careful initialization/disposal logic. Changes require understanding the message flow:
   - `init` → loads profiles, creates transform → sends `ready`
   - `transform` → processes pixels → sends `transformed`
   - `transform-to-cmyk` → export path → sends `cmyk-transformed`

3. **Fabric.js canvas**: The internal canvas is at `DISPLAY_DPI` (50.8), not screen DPI (96) or print DPI (300). All scaling calculations must account for this.

4. **Company Hub RLS**: The Company Hub uses strict RLS. Ensure you are testing with a user that has been added as a member of a company, or is a `master_admin` to see cross-tenant data.

5. **Danish UI**: All user-facing strings are in Danish (Gem = Save, Eksporter = Export, etc.)

---

## Contact / Context

This project is for **Webprinter.dk**, a Danish print shop. The designer allows customers to create print-ready designs with proper color management for commercial printing.
