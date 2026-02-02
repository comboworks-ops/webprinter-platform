# Printmaker Web Craft - Project Status

**Last Updated:** 2025-12-15 23:20 CET

## Project Overview
A multi-tenant print shop platform with a master template system. Tenants get their own branded storefronts with customizable branding, typography, colors, and layouts.

## Quick Start
```bash
cd "/Users/cookabelly/Documents/Antigravity stuff/printmaker-web-craft-main"
npm run dev
```
Dev server runs at: `http://localhost:8080`

---

## 🖼️ Banner & Animation Refinements (2025-12-16)

### 1. Visual Banner Selection
- **Thumbnails:** Replaced text-based banner selection with a visual grid of thumbnails.
- **Preview:** Thumbnails show the banner image + applied overlay color/opacity in real-time.
- **Selection:** Simple click to select active banner for editing.

### 2. Consolidated Button Management
- **Unified Controls:** Removed scattered "Button Text" inputs; all buttons are now managed in the **Call-to-action knapper** section.
- **Multi-Button:** Support for up to 2 buttons per banner.
- **Global Toggle:** Main toggle correctly hides/shows buttons across all banners.
- **Empty State:** Deleting all buttons leaves a banner truly empty (no legacy fallback).

### 3. Text & Animation
- **Dynamic Animations:** Restored functionality of "Text Animation" settings (Fade, Slide Up, etc.).
- **Banner Selector:** Added a dropdown selector directly in the Animation section for easy switching.
- **Defaults:** New banners default to "Slide Up" animation and include a standard "Se produkter" button.

### 4. Indholdsblokke (Content Blocks)
Implemented dynamic content sections below the banner:
- **Location:** Appears between Banner and Product Grid on front page.
- **Fields:** H2 Heading, Body Text, Optional Image.
- **Alignment:** Text alignment (left/center/right), Image position (left/right).
- **Toggle:** Each block has an `enabled` toggle.
- **Default:** "Velkommen til Danmarks Billigste tryksager" with center alignment.
- **Limit:** Up to 4 content blocks allowed.

---

## 🎨 Branding System Architecture

### Tab Structure (2025-12-15)
The branding editor was consolidated from 7 tabs to 4 tabs:

| Tab | Contains |
|-----|----------|
| **Forside** | Logo, Header, Banner toggle, Content Blocks (up to 4), Footer |
| **Typography** | Fonts (Heading, Body), Text Colors (Headings, Body, Pricing, Links) |
| **Colors** | Primary, Secondary, Accent, Background, etc. |
| **Ikoner** | Icon management (future expansion) |

### Key Files
```
src/hooks/useBrandingDraft.ts          # Core branding data model & hook
src/components/admin/ForsideSection.tsx     # Forside tab content
src/components/admin/UnifiedBrandingEditor.tsx  # Master-facing editor
src/components/admin/BrandingSettings.tsx       # Tenant-facing editor
src/components/Header.tsx                       # Storefront header (renders branding)
```

---

## 🔧 Logo System (2025-12-15)

### Logo Type Toggle
Users can choose between **Text Logo** or **Image Logo**:

| Setting | Where to Configure |
|---------|-------------------|
| Logo Type (text/image) | Forside → Logo |
| Logo Text | Forside → Logo → Logo tekst |
| Logo Font | Forside → Logo → Skrifttype |
| Logo Text Color | Forside → Logo → Logo tekstfarve |
| Logo Image | Forside → Logo → Upload logo |

### Important: Separated Colors
- `logoTextColor` - Color for text logo (separate from navigation)
- `textColor` - Color for navigation menu items (controlled in Header section)

**These are independent** - changing logo color does NOT affect menu text.

### Data Model (`HeaderSettings` in useBrandingDraft.ts)
```typescript
interface HeaderSettings {
  logoType: 'image' | 'text';  // Default: 'text'
  logoText: string;            // Default: 'Min Shop'
  logoFont: string;            // Default: 'Inter'
  logoTextColor: string;       // Default: '#1F2937' (separate from nav)
  logoImageUrl: string | null;
  // ... other header settings
}
```

---

## 📌 CTA Button (2025-12-15)

### Behavior
- **Default (on reset):** Hidden
- **Toggle ON in Header settings:** Shows CTA button

### Configuration
Located in **Forside → Header** section:
- `cta.enabled` - Show/hide the button
- `cta.label` - Button text
- `cta.href` - Link destination

### Styling
CTA button uses the standard Button component:
- Background: Primary color
- Text: White (uses `text-primary-foreground`)
- Added `no-link-color` class to prevent global link styles from overriding

---

## 🎯 Strict Rules

### 1. ColorPickerWithSwatches (Mandatory)
**Location:** `src/components/ui/ColorPickerWithSwatches.tsx`

**ALWAYS USE THIS** for any color picker in the admin/branding UI.

```tsx
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";

<ColorPickerWithSwatches
  label="Label"
  value={colorValue}
  onChange={(color) => handleChange(color)}
  savedSwatches={savedSwatches}
  onSaveSwatch={onSaveSwatch}
  onRemoveSwatch={onRemoveSwatch}
/>
```

**DO NOT USE:** Basic HTML `<input type="color">`

See workflow: `.agent/workflows/color-picker.md`

---

## 📁 Key Component Locations

### Admin Panel
| Component | Path | Purpose |
|-----------|------|---------|
| ForsideSection | `src/components/admin/ForsideSection.tsx` | Forside tab (Logo, Header, Banner, Content, Footer) |
| HeaderSection | `src/components/admin/HeaderSection.tsx` | Header settings UI |
| FooterSection | `src/components/admin/FooterSection.tsx` | Footer settings UI |
| BannerEditor | `src/components/admin/BannerEditor.tsx` | Banner/hero section editor |
| FontSelector | `src/components/admin/FontSelector.tsx` | Font dropdown selector |

### Storefront
| Component | Path | Purpose |
|-----------|------|---------|
| Header | `src/components/Header.tsx` | Main storefront header (renders logo, nav, CTA) |
| PreviewShop | `src/pages/PreviewShop.tsx` | Preview page for branding |

### Data & Types
| File | Purpose |
|------|---------|
| `src/hooks/useBrandingDraft.ts` | Core branding types, defaults, and hook |
| `src/lib/branding/types.ts` | Additional branding capability types |

---

## 🔄 Data Flow (Branding)

1. User edits in BrandingSettings/UnifiedBrandingEditor
2. Changes stored in `draft` state via `useBrandingDraft` hook
3. Preview receives updates via `postMessage` (embedded iframe)
4. Or via `BroadcastChannel('branding-preview')` (separate windows)
5. User clicks "Publicér" to save changes to database

---

## 🗄️ Database (Supabase)

### Key Tables
- `tenants` - Shop/tenant configuration
- `products` - Product catalog  
- `branding_settings` - Stored branding configurations
- `resource_categories` - Asset categories (Banners, Icons, etc.)
- `master_assets` - Uploaded resources/assets

### Pending Migration
Run in Supabase SQL Editor:
```
supabase/migrations/20260101700000_resource_library.sql
```

---

## 📋 Recent Session Changes (2025-12-15)

### Forside Tab Consolidation
- Merged Logo, Header, Banner, Content Blocks, Footer into single "Forside" tab
- Simplified from 7 tabs to 4 tabs
- Both `UnifiedBrandingEditor.tsx` and `BrandingSettings.tsx` updated

### Logo System
- Added Text/Image toggle for logo
- Added FontSelector for text logo font
- Separated `logoTextColor` from navigation `textColor`
- Updated `Header.tsx` to render text logo with custom font/color

### CTA Button
- Hidden by default (enabled: false)
- Only shows when toggled ON in Header settings
- Fixed white text using `no-link-color` class

### ColorPickerWithSwatches
- Established as the ONLY color picker to use
- Created workflow rule at `.agent/workflows/color-picker.md`

---

## ⚠️ Known Issues

- TypeScript warning about "Type instantiation is excessively deep" in ProductGrid.tsx (Supabase types, not blocking)
- CSS lint warnings about @tailwind/@apply (normal for Tailwind)

---

## 📝 Developer Notes

### Adding New Logo Properties
1. Add property to `HeaderSettings` interface in `useBrandingDraft.ts`
2. Add default value to `DEFAULT_HEADER` constant
3. Update `ForsideSection.tsx` logo UI
4. Update `Header.tsx` to render the property

### Adding New CTA Properties
1. Add to `HeaderCtaSettings` interface in `useBrandingDraft.ts`
2. Add default value to `DEFAULT_HEADER_CTA`
3. Update HeaderSection or ForsideSection UI
4. Update `Header.tsx` to use the property
