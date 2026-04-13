# Site Design V2 - Cleanup & Clarification Guide

**Created:** April 5, 2026  
**Purpose:** Document the complete Site Design V2 system, identify what's working vs. what's partial, and define cleanup priorities.

---

## 📋 Executive Summary

Site Design V2 is a **visual, click-to-edit site designer** that coexists with the classic V1 editor. It has:
- **15 editor sections** organized into 3 groups (Global, Forside, Produktside)
- **~60+ individual settings** across all sections
- **Working features** that are already live in storefront runtime
- **Partial features** that need completion (mainly theme switching)

**The main problem:** The system has grown complex with overlapping concepts and some features that exist in UI but aren't fully wired to the storefront.

---

## 🏗️ Architecture Overview

### Routes
| Route | Editor | Status |
|-------|--------|--------|
| `/admin/branding` | UnifiedBrandingEditor (V1) | Stable |
| `/admin/branding-v2` | SiteDesignEditorV2 (V2) | Beta/Advanced |
| `/admin/branding-template` | Master template editor | Master only |

### Data Flow
```
Editor UI → useBrandingDraft hook → BrandingStorageAdapter → Supabase
                  ↓
            Preview (iframe)
                  ↓
            Storefront (Shop.tsx)
```

---

## 🧩 Complete Section Inventory

### Group 1: Global (6 sections)
| Section | Status | Description | Key Settings |
|---------|--------|-------------|--------------|
| **Logo & Favicon** | ✅ Working | Logo image/text, favicon | logoType, logoText, logoFont, favicon |
| **Header & Menu** | ✅ Working | Navigation, dropdowns, CTA | 40+ settings incl. dropdown styling |
| **Typografi** | ✅ Working | Fonts for heading/body/pricing | fonts.heading, fonts.body, fonts.pricing |
| **Farver** | ✅ Working | Complete color system | 10 color keys + swatches |
| **Tema** | ⚠️ Partial | Theme selector exists but runtime not fully wired | themeId, themeSettings |
| **Footer** | ✅ Working | Footer layout, links, social | style, links, social, copyright |

### Group 2: Forside / Homepage (7 sections)
| Section | Status | Description | Key Settings |
|---------|--------|-------------|--------------|
| **Banner (Hero)** | ✅ Working | Main slideshow/video | images[], overlay, buttons, animations |
| **Banner 2 / Showcase** | ✅ Working | Secondary banner | banner2.slides[] |
| **USP Strip** | ✅ Working | Benefits bar below hero | 3 USP items with icons |
| **SEO Tekst** | ✅ Working | SEO content blocks | 3 text blocks for SEO |
| **Forside produkter** | ✅ Working | Product grid config | featured product, side panel, buttons |
| **Indholdsblokke** | ✅ Working | Content blocks | Up to 4 content blocks |
| **Produktbilleder (Ikoner)** | ✅ Working | Icon pack selection | selectedIconPackId |

### Group 3: Produktside (1 section)
| Section | Status | Description | Key Settings |
|---------|--------|-------------|--------------|
| **Produktside matrix & knapper** | ✅ Working | Matrix styling & buttons | 20+ settings for picture buttons, order buttons |

---

## ✅ What's Fully Working (Active in Runtime)

These features are already persisted AND consumed by the live storefront:

1. **Homepage Content Blocks** (`forside.contentBlocks`)
2. **Featured Product Section** (`forside.productsSection.featuredProductConfig`)
3. **Side Panel Configuration** (`forside.productsSection.featuredProductConfig.sidePanel`)
4. **Product Grid Button Styling** (`forside.productsSection.button`)
5. **USP Strip** (`uspStrip`)
6. **SEO Content** (`seoContent`)
7. **Product Page Matrix Picture Buttons** (`productPage.matrix.pictureButtons`)
8. **Order Button Styling** (`productPage.orderButtons`)
9. **Icon Packs** (`selectedIconPackId`)
10. **Header/Footer complete customization**
11. **Hero banner with slideshow/video**
12. **Complete color/font system**

---

## ⚠️ What's Partial (UI Exists, Runtime Incomplete)

### 1. Theme System
| Aspect | Status | Issue |
|--------|--------|-------|
| Theme selector UI | ✅ Exists | Works in editor |
| Theme registry | ✅ Exists | classic + glassmorphism themes |
| Theme context | ✅ Exists | `src/lib/themes/theme-context.tsx` |
| Storefront runtime | ❌ Not wired | Shop.tsx imports classic components directly |

**What this means:** Selecting "Glassmorphism" theme in admin won't change the storefront visuals yet.

**Fix needed:** Wrap Shop.tsx with ThemeProvider and route components through theme registry.

---

## 🔧 What Needs Cleanup

### High Priority (Confusing/Incomplete)

#### 1. **Theme System Completion**
- [ ] Wire theme context to actual storefront rendering
- [ ] OR hide theme selector until fully working
- [ ] Document which theme is actually active

#### 2. **Settings Organization**
Some settings are scattered or have unclear purposes:

| Current | Issue | Suggested Fix |
|---------|-------|---------------|
| `hero` vs `forside.banner2` | Two banner systems | Clarify: hero = main, banner2 = secondary |
| `navigation.dropdown_images` | Legacy setting | Deprecate, use `header.dropdownMode` |
| `pod3.showOnHomepage` | POD3 toggle in branding | Move to POD3 config section |
| `productImages.setId` | Separate from `selectedIconPackId` | Consolidate or clarify difference |

#### 3. **Per-Page Editing**
The editor has a page selector (Forside, Produkter, Bestilling, etc.) but:
- Settings are mostly global
- No true per-page style overrides
- Page selector changes which sections are visible

**Decision needed:** 
- Option A: Remove page selector (simpler)
- Option B: Implement true per-page overrides (complex)

### Medium Priority (Polish)

#### 4. **Color System Consistency**
Colors are defined in multiple places:
- `colors.primary` (global)
- `header.bgColor`, `header.textColor` (header specific)
- `productPage.matrix.selectedBg` (product specific)
- `forside.productsSection.button.bgColor` (section specific)

**Question:** Should section-specific colors inherit from global or always be explicit?

#### 5. **Dropdown Category Images** (`.TODO_DROPDOWN_IMAGE`)
- UI exists for uploading category images
- Key matching issue between storage and rendering
- Feature not working in storefront

**Fix:** Debug key matching or remove feature until fixed.

#### 6. **Legacy Field Cleanup**
Deprecated fields still in data model:
- `hero.media` (replaced by `hero.images`)
- `hero.type` (replaced by `hero.mediaType`)
- `hero.transition` (replaced by `hero.slideshow.transition`)

---

## 📊 Settings Count by Section

| Section | Settings Count | Complexity |
|---------|---------------|------------|
| Header | ~45 | High |
| Hero/Banner | ~25 | Medium |
| Forside (all) | ~60 | High |
| Product Page | ~30 | Medium |
| Footer | ~20 | Low |
| Colors | 10 | Low |
| Typography | 3 | Low |
| **TOTAL** | **~200** | **Very High** |

---

## 🎯 Recommended Cleanup Actions

### Phase 1: Stabilize (Before Launch)
1. **Hide Theme selector** until runtime is wired
2. **Fix or remove** dropdown category images feature
3. **Document** which settings are per-page vs global
4. **Remove** unused legacy fields from defaults

### Phase 2: Simplify (Post-Launch)
1. **Audit** all 200+ settings for actual usage
2. **Consolidate** scattered color settings
3. **Decide** on per-page editing architecture
4. **Remove** POD3 toggle from branding (move to own section)

### Phase 3: Complete (Future)
1. **Implement** theme runtime wiring
2. **Add** theme-specific editor panels
3. **Consider** true per-page style overrides

---

## 🎨 Current Visual Hierarchy

```
HEADER (sticky, customizable)
  └── Logo + Nav + Dropdown + CTA

HERO BANNER (slideshow/video)
  └── Images/Videos + Overlay + Buttons + Text animations

USP STRIP (3 benefits with icons)
  └── Icons + Titles + Descriptions

SEO CONTENT (text blocks)
  └── 3 SEO-optimized text sections

PRODUCT SECTION
  ├── Featured Product (optional)
  ├── Side Panel (optional)
  └── Product Grid

CONTENT BLOCKS (0-4 blocks)
  └── Heading + Text + Image

FOOTER
  └── Links + Social + Copyright
```

---

## 🔗 Key Files Reference

| File | Purpose |
|------|---------|
| `src/components/admin/SiteDesignEditorV2.tsx` | Main editor UI |
| `src/hooks/useBrandingDraft.ts` | Data model & defaults (1719 lines!) |
| `src/lib/branding/types.ts` | Type definitions |
| `src/lib/siteDesignTargets.ts` | Click-to-edit target mapping |
| `src/lib/themes/theme-context.tsx` | Theme runtime (partial) |
| `src/themes/classic/index.ts` | Classic theme definition |
| `src/themes/glassmorphism/index.ts` | Glass theme definition |

---

## 📝 Next Steps Decision

**What do you want to prioritize?**

1. **Hide incomplete features** (Theme selector, dropdown images) → Quick stability
2. **Fix dropdown category images** → Complete existing feature
3. **Simplify settings** → Reduce 200+ settings to essentials
4. **Wire theme system** → Enable theme switching
5. **Document everything** → Create user-facing docs for all settings

**My recommendation:** Start with #1 (hide what's broken), then #3 (simplify), then decide on #4 vs #2 based on priority.

---

*Document created by AI assistant. Review and confirm priorities before proceeding.*
