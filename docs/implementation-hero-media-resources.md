# Hero Media Type & Master Resources Implementation

## Summary

This implementation adds:
1. **Hero Media Type Toggle** (Images vs Video mode)
2. **Master Resource Library** with 5 pre-seeded backgrounds
3. **Publish/Push functionality** for tenants to use master assets

---

## Changed Files

### New Files Created

| File | Description |
|------|-------------|
| `supabase/migrations/20260101200000_master_assets.sql` | Database migration for `master_assets` table with RLS policies and 5 seeded hero backgrounds |
| `src/components/admin/MasterResources.tsx` | Master-only admin page for managing platform assets (backgrounds, icons, videos) |

### Modified Files

| File | Changes |
|------|---------|
| `src/hooks/useBrandingDraft.ts` | Added `mediaType`, `videos[]`, `videoSettings`, and explicit interface types for Hero settings. Added exports for defaults. |
| `src/components/admin/HeroEditor.tsx` | Complete rewrite with media type toggle, image gallery, video upload, slideshow settings, parallax options, overlay controls, and master background library integration |
| `src/components/HeroSlider.tsx` | Updated to support both images and videos, configurable slideshow transitions, parallax effects, and preview branding context |
| `src/pages/Admin.tsx` | Added route for `/admin/resources` (MasterResources component) |
| `src/components/admin/AdminSidebar.tsx` | Added "Ressourcer" link in Platform section (master-only) |
| `src/components/admin/BrandingSettings.tsx` | Replaced legacy Hero tab with new HeroEditor component |

---

## Data Model

### New Table: `master_assets`

```sql
CREATE TABLE master_assets (
    id UUID PRIMARY KEY,
    type TEXT CHECK (type IN ('HERO_BACKGROUND', 'ICON', 'VIDEO')),
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    tags TEXT[],
    sort_order INTEGER,
    is_published BOOLEAN DEFAULT false,
    is_premium BOOLEAN DEFAULT false,
    price_cents INTEGER,
    width_px INTEGER,
    height_px INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### Updated Branding Hero Schema

```typescript
interface HeroSettings {
    recommendedWidthPx: number;
    recommendedHeightPx: number;
    mediaType: 'images' | 'video';
    fitMode: 'cover' | 'contain';
    images: HeroImage[];
    videos: HeroVideo[];
    slideshow: {
        enabled: boolean;
        transition: 'fade' | 'slide';
        autoplay: boolean;
        intervalMs: number;
    };
    parallax: boolean;
    videoSettings: {
        fitMode: 'cover' | 'contain';
        parallaxEnabled: boolean;
        muted: boolean;
        loop: boolean;
    };
    overlay_color: string;
    overlay_opacity: number;
    overlay: {
        title: string;
        subtitle: string;
        showButtons: boolean;
        buttons: HeroButton[];
    };
}
```

---

## Feature Details

### A) Hero Media Type

1. **Images Mode**:
   - Upload up to 10 images
   - Drag-and-drop reordering
   - Slideshow with fade/slide transitions
   - Autoplay with configurable interval (2-15 seconds)
   - Parallax scrolling effect
   - Cover/contain fit modes

2. **Video Mode**:
   - Upload up to 3 videos
   - Autoplay (muted, required for mobile)
   - Loop option
   - Parallax scrolling effect
   - Cover/contain fit modes
   - Video playlist with transitions (when multiple videos)

### B) Master Resource Library

1. **Asset Types**:
   - Hero Backgrounds (images)
   - Icons
   - Videos

2. **Visibility Scope**:
   - `is_published = false`: Only master can see
   - `is_published = true`: Tenants can browse and use

3. **Pre-seeded Assets**:
   - 5 professional hero backgrounds from Unsplash
   - Tagged for easy discovery

### C) Access Control

- MasterResources page redirects non-master-admins to `/admin`
- RLS policies enforce visibility rules at database level
- Sidebar link only appears for master admins

---

## Manual Verification Checklist

### Prerequisites
1. [ ] Run the migration: `npx supabase db push` or apply manually
2. [ ] Start dev server: `npm run dev`
3. [ ] Log in as Master Admin

### Master Resources
- [ ] Navigate to `/admin/resources`
- [ ] Verify 5 default backgrounds are shown (seeded from migration)
- [ ] Upload a new background image
- [ ] Toggle publish/unpublish on an asset
- [ ] Delete an asset
- [ ] Verify tab switching (Backgrounds, Icons, Videos)

### Hero Editor (Tenant Branding)
- [ ] Navigate to `/admin/branding` → Hero tab
- [ ] Switch between Images / Video mode
- [ ] **Images Mode**:
  - [ ] Upload multiple images
  - [ ] Drag to reorder
  - [ ] Remove an image
  - [ ] Select from master library (if backgrounds published)
  - [ ] Toggle autoplay
  - [ ] Adjust interval slider
  - [ ] Change transition (fade/slide)
  - [ ] Toggle parallax
- [ ] **Video Mode**:
  - [ ] Upload a video
  - [ ] Toggle loop
  - [ ] Toggle parallax
- [ ] **Overlay**:
  - [ ] Set title and subtitle
  - [ ] Add buttons (up to 2)
  - [ ] Configure button link types

### Live Preview
- [ ] Verify preview updates in real-time when changing hero settings
- [ ] Check fade/slide transitions work correctly
- [ ] Verify video autoplay (muted)

### Storefront
- [ ] View published storefront
- [ ] Verify hero displays correctly with configured settings
- [ ] Check slideshow works
- [ ] On mobile: verify video autoplays muted

### Access Control
- [ ] Log in as tenant owner (non-master)
- [ ] Verify "Ressourcer" link is NOT visible in sidebar
- [ ] Navigate directly to `/admin/resources` → should redirect to `/admin`
- [ ] Verify tenant CAN see published master backgrounds in HeroEditor

---

## Known Limitations

1. **Video Parallax**: Implemented but may have performance issues on low-end devices
2. **Video Playlist Transitions**: Fade works well; slide may be jarring
3. **Mobile Video Autoplay**: Requires `muted` attribute (iOS restriction)
4. **Type Safety**: Used `as any` casts for `master_assets` table until Supabase types are regenerated

---

## Next Steps

1. Run `npx supabase gen types typescript --local` to regenerate Supabase types (removes need for `as any`)
2. Add thumbnail generation for uploaded videos
3. Add bulk upload for master resources
4. Add premium asset marketplace (future)
