# Webprinter Platform - AI Continuity Document

> Last Updated: December 18, 2024
> Backup Tag: `backup-2024-12-18`
> Status: Major site designer upgrades completed (V2, Colors, Hover states)
> Commit: `Latest`

This document is designed for AI assistants (chatbots, codex machines) to understand the project state and continue development.

---

## 🎯 Project Overview

**Webprinter Platform** is a multi-tenant SaaS printing shop application built with:
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui components + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **State**: React Context + Custom Hooks

### Core Purpose
Allow shop owners (tenants) to customize their storefront branding (colors, fonts, logo, header, footer, hero banners) via an admin panel with live preview.

---

## 🏗️ Architecture

### Key Directories
```
src/
├── components/
│   ├── admin/           # Admin panel components
│   │   ├── UnifiedBrandingEditor.tsx  # Main branding editor (4 tabs)
│   │   ├── ForsideSection.tsx         # "Forside" tab (Logo, Header, Footer, Banner)
│   │   ├── HeaderSection.tsx          # Header settings UI
│   │   ├── BrandingSettings.tsx       # Alt branding editor
│   │   └── FontSelector.tsx           # Font picker (32 fonts)
│   ├── Header.tsx       # Storefront header component
│   ├── Footer.tsx       # Storefront footer component
│   └── HeroSlider.tsx   # Hero banner slider
├── hooks/
│   └── useBrandingDraft.ts  # ⭐ CRITICAL: All branding types, defaults, and state
├── contexts/
│   └── PreviewBrandingContext.tsx  # Live preview state management
└── pages/
    ├── PreviewShop.tsx   # Preview storefront (used by admin)
    └── Shop.tsx          # Live storefront
```

---

## 📊 Current Status (December 16, 2024)

### ✅ Completed Features

#### Branding System
- [x] **Draft persistence** - Changes survive page refresh (localStorage)
- [x] **Live preview** - Real-time updates via postMessage/BroadcastChannel
- [x] **4-tab editor** - Forside, Typography, Colors, Icons

#### Header Settings
- [x] Height selector (Lille/Medium/Stor → 56/72/96px)
- [x] Menu alignment (Left/Center/Right)
- [x] Background color + transparency slider
- [x] Font selector for menu text
- [x] Text color (skriftfarve)
- [x] **Transparent over Hero toggle** - ON: overlays hero, OFF: stacks above hero
- [x] CTA button (enable/disable, text, link)
- [x] Logo options (Image or Text with font/color)
- [x] Dropdown background color + transparency

#### Hero/Banner
- [x] Image slideshow with media library
- [x] Overlay settings (title, subtitle, colors)
- [x] Parallax effect
- [x] Auto-play configuration

#### Footer
- [x] Social links (Facebook, Instagram, LinkedIn)
- [x] Footer text and copyright
- [x] Background/text colors

#### Preview System
- [x] Virtual navigation (doesn't unmount branding context)
- [x] sessionStorage persistence for preview branding
- [x] Dynamic font loading for selected fonts

### 🚧 Known Issues / Pending

1. **Dropdown font/color** - User removed these settings (reverted in latest commit)
2. **Mobile responsive** - Header may need testing on small screens
3. **Publishing workflow** - Draft → Published flow exists but needs verification

---

## 📁 Critical Files

### Type Definitions & Defaults
**File**: `src/hooks/useBrandingDraft.ts`

Contains ALL branding interfaces:
- `BrandingData` - Root branding object
- `HeaderSettings` - Header configuration
- `FooterSettings` - Footer configuration
- `HeroSettings` - Banner settings
- `DEFAULT_BRANDING` - Default values

### Header Component
**File**: `src/components/Header.tsx`

Key sections:
- Lines 56-95: `headerSettings` merge with defaults
- Lines 60-66: Height mapping (sm/md/lg → px)
- Lines 145-167: Position logic for "Transparent over Hero"
- Lines 208-224: `getDropdownStyles()` for dropdown styling

### Preview Context
**File**: `src/contexts/PreviewBrandingContext.tsx`

- Receives branding updates via `postMessage`
- Stores in `sessionStorage` for persistence

---

## Designer Sizing Guard (Do Not Remove)
**File**: `src/pages/Designer.tsx`

- `documentSpec` is initialized from URL params (`widthMm/heightMm/format`) before async loads.
- This prevents the A4 → target size flicker and keeps the designer smooth.
- Provides `branding` and `tenantName` to preview components

---

## ⚠️ Strict Rules

### 1. Color Pickers
**ALWAYS** use `ColorPickerWithSwatches` component:
```tsx
<ColorPickerWithSwatches
    label="Label"
    value={color}
    onChange={(c) => update(c)}
    savedSwatches={savedSwatches}
    onSaveSwatch={onSaveSwatch}
    onRemoveSwatch={onRemoveSwatch}
/>
```
See: `.agent/workflows/color-picker.md`

### 2. Adding New Settings
1. Add type to interface in `useBrandingDraft.ts`
2. Add default value in `DEFAULT_*` constant
3. Add UI control in appropriate Section component
4. Apply setting in target component (Header.tsx, Footer.tsx, etc.)

### 3. Preview Updates
When adding new branding fields, ensure they're passed through:
1. `updateDraft()` in useBrandingDraft
2. `BrandingPreviewFrame.tsx` sends via postMessage
3. `PreviewBrandingContext.tsx` receives and applies

---

## 🔧 Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

---

## 📌 2026-02-07 Session Summary

See `.agent/SESSION_LOG_2026-02-07.md` for full details. Highlights:
- Added format/matrix “save to library” for materials & formats, plus copy-price in generator.
- Storformat product pages now open designer with selected custom size.
- Added storformat product tags migration.

## 📌 2026-02-12 Session Summary

See `.agent/SESSION_LOG_2026-02-12.md` for full details. Highlights:
- Added `Sites` preview infrastructure with dedicated `/preview-shop` site-preview mode.
- Integrated multiple external site ZIP bundles under `public/site-previews/*` (iframe manifests).
- Added bundle runbook: `docs/SITES_PREVIEW_BUNDLES.md`.

---

## 🗂️ Recent Session Summary

### Dec 16, 2024 Session Goals (Completed)
1. ✅ Branding draft persistence (localStorage)
2. ✅ Header height setting working in preview
3. ✅ Menu alignment working in preview
4. ✅ Header text color option added
5. ✅ Removed auto-white text at low opacity
6. ✅ "Transparent over Hero" toggle working properly
7. ✅ Fixed hero alignment when toggle is OFF
8. ✅ Fixed dropdown spelling (Baggrundsfarve)
9. ✅ Added dropdown transparency slider

### User Reverted
- Dropdown font selector
- Dropdown text color picker
- These were removed manually by the user

### Dec 18, 2024 Session Summary

#### 🚀 Major Upgrades
1. ✅ **Branding Editor V2** - Implemented a new "click-to-edit" visual editor that coexists with V1. Includes side-by-side preview and categorized tools.
2. ✅ **CTA Button Customization** - Added full color control for the header CTA button:
   - `bgColor`: Background color
   - `textColor`: Text color
   - `hoverBgColor`: Hover background color with smooth transition and lift effect
3. ✅ **Element Hover Effects** - Added granular hover control for header action items (Search, Language, User/Account):
   - `actionHoverBgColor`: Circular background color on hover (renamed from "Hover over element")
   - `actionHoverTextColor`: Icon/Text color on hover (renamed from "Hover over element tekst")
4. ✅ **UI Polish** - Added visual separators in the site designer UI for better grouping of color settings.
5. ✅ **Stability Fixes** - Fixed an issue where the preview screen would turn blank due to missing default initialization for new branding fields.

#### 🔧 Implementation Details
- **Header.tsx**: Now uses CSS Variables (`--header-cta-bg`, `--header-action-hover-bg`, etc.) linked to the branding state for real-time reactivity.
- **HeaderSection.tsx**: Added `ColorPickerWithSwatches` components with the new labels and separators.
- **useBrandingDraft.ts**: Updated `BrandingData` schema and `mergeBrandingWithDefaults` to handle the new nested properties safely.

---

## 🔗 Related Documents

- `PROJECT_STATUS.md` - Detailed architecture notes
- `BRANDING_QUICK_REFERENCE.md` - Quick lookup for branding fields
- `.agent/workflows/color-picker.md` - Color picker usage rules

---

## 💡 Tips for Continuing Development

1. **Always check useBrandingDraft.ts first** - it defines all types
2. **Test in preview** - Changes should reflect immediately
3. **Build before committing** - `npm run build` catches type errors
4. **Use git tags for backups** - `git tag backup-YYYY-MM-DD`
5. **Danish labels in UI** - The UI is in Danish (e.g., "Baggrundsfarve" = Background color)
6. **CSS Variables** - Use CSS variables in `Header.tsx` for hover states to avoid JS-in-CSS performance issues and ensure clean transitions.
