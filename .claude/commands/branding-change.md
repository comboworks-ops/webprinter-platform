---
description: Guide through safe branding system changes
---

# Branding Change Workflow

You've been asked to modify the branding/design system (tenant appearance, colors, fonts, hero, footer).

---

## 1. Branding Domain Files

**Key files in this domain:**

| File | Purpose |
|------|---------|
| `src/lib/branding/types.ts` | BrandingData type definitions |
| `src/lib/branding/index.ts` | Main exports |
| `src/lib/branding/master-adapter.ts` | Master tenant branding |
| `src/lib/branding/tenant-adapter.ts` | Tenant-specific branding |
| `src/lib/branding/use-branding-editor.ts` | Editor hook |
| `src/hooks/useBrandingDraft.ts` | Draft/publish state management |
| `src/hooks/useBrandingHistory.ts` | Branding version history |
| `src/contexts/PreviewBrandingContext.tsx` | Context provider for shop |
| `src/components/admin/BrandingEditorV2.tsx` | Main branding editor |
| `src/components/admin/BrandingPreview.tsx` | Preview component |
| `src/components/admin/BrandingPreviewFrame.tsx` | Iframe preview |
| `src/components/admin/BrandingSettings.tsx` | Settings panel |
| `src/components/admin/BannerEditor.tsx` | Hero banner editing |
| `src/components/admin/UnifiedBrandingEditor.tsx` | Unified editor |

---

## 2. Data Flow Architecture

Understanding how branding data flows is critical:

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN PANEL                              │
│  BrandingEditorV2 → useBrandingDraft hook                   │
│         │                                                    │
│         ▼                                                    │
│  Supabase: branding_drafts table (or tenants.settings)      │
│         │                                                    │
│         │ ──── saveDraft() ────▶ Stores draft               │
│         │                                                    │
│         │ ──── publishDraft() ──▶ Copies to published       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     LIVE SHOP                                │
│  Shop.tsx → useShopSettings()                               │
│         │                                                    │
│         ▼                                                    │
│  Extracts: settings.branding.published                      │
│         │                                                    │
│         ▼                                                    │
│  PreviewBrandingProvider (wraps shop content)               │
│         │                                                    │
│         ▼                                                    │
│  HeroSlider, Header, Footer use usePreviewBranding()        │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** Shop.tsx MUST wrap content with `PreviewBrandingProvider` for branding to work.

---

## 3. Preview System

The admin panel uses postMessage and BroadcastChannel for live preview:

```
BrandingPreviewFrame.tsx
    │
    ├── postMessage({ type: 'BRANDING_UPDATE', branding })
    │       └── Sends to iframe (PreviewShop.tsx)
    │
    └── BroadcastChannel('branding-preview')
            └── Sends to new windows opened with draft=1
```

**PreviewBrandingContext.tsx** listens for these messages and updates context.

---

## 4. Boundary Check - Files You MUST NOT Touch

When modifying branding, **NEVER** touch these files:

| File | Domain | Why |
|------|--------|-----|
| `src/lib/pricing/*` | Pricing | Price calculations |
| `src/utils/productPricing.ts` | Pricing | Price matrices |
| `src/components/designer/*` | Designer | Canvas rendering |
| `src/utils/preflightChecks.ts` | Designer | Print validation |
| `src/lib/designer/*` | Designer | Export logic |
| `src/lib/pod/*` | POD v1 | Legacy POD |
| `src/lib/pod2/*` | POD v2 | Current POD |

---

## 5. Common Branding Tasks

### Fixing "published banner shows default"
1. Check that `Shop.tsx` wraps content with `PreviewBrandingProvider`
2. Verify `useShopSettings()` returns branding data
3. Ensure `mergeBrandingWithDefaults()` is called on branding
4. Check `HeroSlider` uses `usePreviewBranding()` hook

### Adding new branding option
1. Add type to `src/lib/branding/types.ts`
2. Add default value in `useBrandingDraft.ts` → `DEFAULT_BRANDING`
3. Add UI control in appropriate admin component
4. Ensure `mergeBrandingWithDefaults()` handles new field

### Fixing preview not updating
1. Check `BrandingPreviewFrame.tsx` sends postMessage
2. Verify `PreviewBrandingContext.tsx` listens for messages
3. Check `iframeReady` state is true before sending
4. Verify preview URL includes `preview_mode=1`

---

## 6. Testing Checklist

After making branding changes, verify:

- [ ] Admin branding editor loads without errors
- [ ] Preview iframe shows changes in real-time
- [ ] Publish action saves to database
- [ ] Live shop reflects published changes (hard refresh)
- [ ] Colors apply correctly (header, footer, buttons)
- [ ] Fonts load and display properly
- [ ] Hero banner shows custom image/text/overlay
- [ ] No TypeScript errors (`npx tsc --noEmit`)

---

## 7. Database Structure

Branding is stored in the `tenants` table:

```sql
tenants.settings = {
  branding: {
    draft: { ... },      -- Current draft being edited
    published: { ... }   -- Live version shown to customers
  }
}
```

Or in separate `branding_drafts` table for version history.

---

## 8. Reference

Full domain documentation: `docs/ARCHITECTURE_BOUNDARIES.md`
Branding types: `src/lib/branding/types.ts`
