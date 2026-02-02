# Unified Branding System - Feature Parity Implementation

## Summary

This implementation achieves **feature parity** between Master Template Branding and Tenant Branding using shared code, while keeping configuration data fully separate (no automatic syncing).

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    UnifiedBrandingEditor                        │
│                  (Shared UI Component)                          │
├──────────────────────────────────────────────────────────────────┤
│                    useBrandingEditor                            │
│                  (Shared State Hook)                            │
├────────────────────────┬─────────────────────────────────────────┤
│   MasterAdapter        │          TenantAdapter                 │
│   (Master Storage)     │          (Tenant Storage)              │
├────────────────────────┼─────────────────────────────────────────┤
│   Master Tenant        │          Tenant Settings               │
│   Settings (DB)        │          (DB, per tenant)              │
└────────────────────────┴─────────────────────────────────────────┘
```

---

## New Files Created

| File | Description |
|------|-------------|
| `src/lib/branding/types.ts` | Shared types, adapter interface, capability configs |
| `src/lib/branding/tenant-adapter.ts` | Tenant-specific storage adapter |
| `src/lib/branding/master-adapter.ts` | Master-specific storage adapter |
| `src/lib/branding/use-branding-editor.ts` | Shared React hook for branding state |
| `src/lib/branding/index.ts` | Module exports |
| `src/components/admin/UnifiedBrandingEditor.tsx` | Shared branding editor component |
| `src/components/admin/TenantBrandingSettings.tsx` | Tenant branding page wrapper |
| `src/components/admin/MasterBrandingTemplate.tsx` | Master branding template page |
| `src/components/admin/HeaderSection.tsx` | Header branding UI section (nav items, CTA, styling) |
| `src/components/admin/FooterSection.tsx` | Footer branding UI section (links, social, layout) |

---

## Modified Files

| File | Changes |
|------|---------|
| `src/pages/Admin.tsx` | Added routes for `/admin/branding-template` |
| `src/components/admin/AdminSidebar.tsx` | Added "Branding Skabelon" link (master-only) |
| `src/hooks/useBrandingDraft.ts` | Added `HeaderSettings`, `FooterSettings`, nav items, CTA, social types and defaults |
| `src/components/Header.tsx` | Added scroll behaviors, font, color/opacity, dropdown mode |
| `src/components/Footer.tsx` | Added dynamic footer layout, links, social icons from branding settings |

---

## Key Concepts

### 1. Storage Adapter Interface

The `BrandingStorageAdapter` interface abstracts all data operations:

```typescript
interface BrandingStorageAdapter {
    mode: 'master' | 'tenant';
    entityId: string;
    entityName: string;
    
    // Core operations
    loadDraft(): Promise<BrandingData>;
    loadPublished(): Promise<BrandingData>;
    saveDraft(data: BrandingData): Promise<void>;
    publish(data: BrandingData, label?: string): Promise<void>;
    discardDraft(): Promise<BrandingData>;
    resetToDefault(): Promise<BrandingData>;
    
    // History
    loadHistory(): Promise<BrandingHistoryEntry[]>;
    restoreVersion(versionId: string): Promise<BrandingData>;
    
    // Assets
    uploadAsset(file: File, type: 'logo' | 'hero-image' | 'hero-video'): Promise<string>;
    deleteAsset(url: string): Promise<void>;
}
```

### 2. Capability Configuration

Capabilities define what features are available:

```typescript
// Master capabilities
const MASTER_CAPABILITIES = {
    sections: { typography: true, colors: true, logo: true, hero: true, navigation: true, iconPacks: true },
    hero: {
        canUploadImages: true,
        canUploadVideos: true,
        canSelectMasterBackgrounds: false,  // Master IS the source
        canManageMasterAssets: true,
        maxImages: 10,
        maxVideos: 3,
    },
    iconPacks: { canSelectPacks: true, canManagePacks: true },
    canViewHistory: true,
    canRestoreHistory: true,
    canApplyMasterTemplate: false,
};

// Tenant capabilities
const TENANT_CAPABILITIES = {
    sections: { typography: true, colors: true, logo: true, hero: true, navigation: true, iconPacks: true },
    hero: {
        canUploadImages: true,
        canUploadVideos: true,
        canSelectMasterBackgrounds: true,   // Can pick from master library
        canManageMasterAssets: false,       // Cannot manage master assets
        maxImages: 10,
        maxVideos: 3,
    },
    iconPacks: { canSelectPacks: true, canManagePacks: false },
    canViewHistory: true,
    canRestoreHistory: true,
    canApplyMasterTemplate: true,  // Can copy from master template
};
```

### 3. Data Separation

- **Master Data**: Stored at `tenants[MASTER_UUID].settings.branding_template_*`
- **Tenant Data**: Stored at `tenants[tenant_id].settings.branding_*`

No automatic sync between them. Each is independent.

### 4. One-time Template Application

Tenants can optionally apply the master template:

```typescript
// In UnifiedBrandingEditor.tsx
const handleApplyMasterTemplate = async () => {
    const masterData = await loadMasterTemplate();
    editor.updateDraft(masterData);  // One-time copy to draft
    toast.success('Master skabelon anvendt');
};
```

After application, the tenant's branding is independent.

### 5. Header Branding Section

The Header section allows customization of the storefront header:

```typescript
interface HeaderSettings {
    // Logo
    logoType: 'image' | 'text';
    logoText: string;
    logoImageUrl: string | null;
    logoLink: string;
    
    // Navigation
    navItems: HeaderNavItem[];              // Editable nav menu items
    dropdownMode: 'text' | 'pictures';
    
    // Styling
    fontId: string;
    bgColor: string;
    bgOpacity: number;
    transparentOverHero: boolean;
    style: 'auto' | 'solid' | 'glass';
    height: 'sm' | 'md' | 'lg';
    alignment: 'left' | 'center' | 'right';
    
    // Scroll behavior
    scroll: {
        sticky: boolean;
        hideOnScroll: boolean;
        fadeOnScroll: boolean;
        shrinkOnScroll: boolean;
        heightPx: number;
        collapsedHeightPx: number;
    };
    
    // CTA Button
    cta: {
        enabled: boolean;
        label: string;
        href: string;
        variant: 'filled' | 'outline';
    };
}

interface HeaderNavItem {
    id: string;
    label: string;
    href: string;
    isVisible: boolean;
    order: number;
}
```

### 6. Footer Branding Section

The Footer section allows customization of the storefront footer:

```typescript
interface FooterSettings {
    style: 'minimal' | 'columns' | 'centered';
    background: 'themeDark' | 'themeLight' | 'solid';
    bgColor: string;
    text: string;
    copyrightText: string;      // Supports {year} and {shopName} placeholders
    showCopyright: boolean;
    links: FooterLinkItem[];
    social: FooterSocialSettings;
    showSocialIcons: boolean;
}

interface FooterLinkItem {
    id: string;
    label: string;
    href: string;
    isVisible: boolean;
    order: number;
}

interface FooterSocialSettings {
    facebook: { enabled: boolean; url: string };
    instagram: { enabled: boolean; url: string };
    linkedin: { enabled: boolean; url: string };
    twitter: { enabled: boolean; url: string };
    youtube: { enabled: boolean; url: string };
}
```

**Footer Layouts:**
- `minimal`: Horizontal layout with brand, links, and social side by side
- `columns`: Traditional 3-column layout
- `centered`: All content centered vertically

**Social Icons:**
- Each platform (Facebook, Instagram, LinkedIn, Twitter/X, YouTube) can be toggled on/off
- Icons only appear when BOTH enabled AND a valid URL is set

---

## Usage Examples

### For Master Admin:

```tsx
import { createMasterAdapter, MASTER_CAPABILITIES, UnifiedBrandingEditor } from '@/lib/branding';

const adapter = createMasterAdapter();
<UnifiedBrandingEditor adapter={adapter} capabilities={MASTER_CAPABILITIES} />
```

### For Tenant Admin:

```tsx
import { createTenantAdapter, TENANT_CAPABILITIES, UnifiedBrandingEditor } from '@/lib/branding';

const adapter = createTenantAdapter(tenantId, tenantName);
<UnifiedBrandingEditor adapter={adapter} capabilities={TENANT_CAPABILITIES} />
```

---

## Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/admin/branding` | BrandingSettings (existing) | Tenant |
| `/admin/branding-template` | MasterBrandingTemplate | Master only |

---

## Acceptance Criteria Verification

| Requirement | Status |
|-------------|--------|
| ✅ Master and tenant editors have same features/UX | Shared `UnifiedBrandingEditor` |
| ✅ No master changes leak to tenant automatically | Separate storage in adapters |
| ✅ Shared code is used (single editor) | `UnifiedBrandingEditor` + shared hook |
| ✅ Master-only asset management hidden for tenants | Capability gating |
| ✅ Tenants can select published master assets | `canSelectMasterBackgrounds: true` |
| ✅ Optional one-time "Apply Template" button | `canApplyMasterTemplate: true` |
| ✅ Header section in both master and tenant editors | `HeaderSection` component |
| ✅ Font/color/opacity updates reflect in preview | `getHeaderStyles()` in Header.tsx |
| ✅ Dropdown TEXT vs PICTURES works | `dropdownMode` setting |
| ✅ Scroll behaviors work (sticky/hide/fade/shrink) | `scroll` settings in Header.tsx |

---

## Manual Verification Checklist

### Prerequisites
- [ ] Start dev server: `npm run dev`
- [ ] Log in as Master Admin

### Master Branding Template
- [ ] Navigate to Platform → Branding Skabelon
- [ ] Verify all editing sections work (Typography, Colors, Logo, Hero, **Header**, Icons)
- [ ] Make changes and save draft
- [ ] Publish template
- [ ] Verify preview works

### Header Section Testing
- [ ] Change header font → verify it updates in preview
- [ ] Change background color and opacity → verify preview
- [ ] Toggle dropdown mode (text/pictures) → verify dropdown changes
- [ ] Enable "Sticky" → verify header stays at top
- [ ] Enable "Hide on scroll" → verify header hides when scrolling down
- [ ] Enable "Fade on scroll" → verify header becomes more transparent
- [ ] Enable "Shrink on scroll" → verify header height decreases

### Tenant Branding
- [ ] Log in as Tenant Admin
- [ ] Navigate to Min Konto → Branding
- [ ] Verify all editing sections work (same as master, including **Header**)
- [ ] Verify "Anvend skabelon" button is visible
- [ ] Click "Anvend skabelon" → verify master template is copied
- [ ] Make changes → verify changes are independent of master
- [ ] In Hero section: verify master backgrounds library is available

### Access Control
- [ ] As Tenant: verify "Branding Skabelon" link is NOT visible in sidebar
- [ ] As Tenant: navigate directly to `/admin/branding-template` → should redirect

### Data Independence
- [ ] As Master: change branding template (including header settings)
- [ ] As Tenant: verify your branding is UNCHANGED
- [ ] As Tenant: change your branding
- [ ] As Master: verify template is UNCHANGED

---

## Future Enhancements

1. **Bulk template push**: Master can push template to all/selected tenants
2. **Template versioning**: Track template versions, allow tenants to update
3. **Partial template application**: Apply only specific sections
4. **Template diff view**: Show what would change before applying
5. **Header logo size controls**: Allow customizing logo dimensions
6. **Navigation item styling**: Font weight, hover effects, active states

