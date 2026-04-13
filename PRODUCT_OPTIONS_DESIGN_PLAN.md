# Product Options Design Enhancement Plan

**Date:** April 5, 2026  
**Goal:** Enhance Site Design V2 to control product option button styling and picture button behavior

---

## 🎯 What You Want

### 1. Text/Option Buttons Styling
When a product uses regular button selectors (not pictures), you want to control:
- **Button color** (background)
- **Hover font color** (text color on hover)
- **Border radius** (rounding of button corners)

### 2. Picture Buttons (from Product Backend)
For products using picture/image selectors, you want to control:
- **Size** of the picture buttons
- **Hover effects** (color overlay, etc.)
- **Display mode**: Text + Picture, Picture only, or Text only
- **Upload thumbnail** from Site Design that appears in backend when viewing the product

---

## ✅ What Already Exists

### Picture Buttons (Partial)
Located in: `productPage.matrix.pictureButtons`

| Setting | Status | Description |
|---------|--------|-------------|
| `hoverEnabled` | ✅ | Toggle hover overlay |
| `hoverColor` | ✅ | Color of hover overlay |
| `hoverOpacity` | ✅ | Opacity of hover overlay |
| `selectedColor` | ✅ | Color when selected |
| `selectedOpacity` | ✅ | Opacity when selected |
| `outlineEnabled` | ✅ | Show border outline |
| `outlineOpacity` | ✅ | Border opacity |
| `hoverZoomEnabled` | ✅ | Zoom on hover |
| `hoverZoomScale` | ✅ | How much zoom |
| `hoverZoomDurationMs` | ✅ | Animation speed |

**What's missing for picture buttons:**
- Size control (small/medium/large)
- Display mode (text+pic / pic only / text only)
- Connection to backend product thumbnails

### Text/Option Buttons
**Currently:** Nothing specifically for regular button styling.

The matrix has cell colors (`cellBg`, `cellHoverBg`, `cellText`, etc.) but these are for the **price matrix grid**, not for the option selector buttons.

---

## 📝 What Needs To Be Added

### A. New Data Model: `optionButtons`

Add to `productPage` in `useBrandingDraft.ts`:

```typescript
interface OptionButtonSettings {
  // Colors
  backgroundColor: string;        // Default button bg
  hoverBackgroundColor: string;   // Hover button bg
  textColor: string;              // Default text color
  hoverTextColor: string;         // Text color on hover
  selectedBackgroundColor: string; // Selected button bg
  selectedTextColor: string;      // Selected button text
  
  // Shape
  borderRadiusPx: number;         // 0 = square, 4 = slight round, 999 = pill
  
  // Border (optional)
  borderWidthPx: number;          // 0 = no border, 1 = thin, 2 = thick
  borderColor: string;
  hoverBorderColor: string;
  
  // Size
  paddingPx: number;              // Internal spacing
  fontSizePx: number;             // Text size
  minHeightPx: number;            // Button height
}
```

### B. Enhanced Picture Buttons Settings

Add to existing `pictureButtons`:

```typescript
interface PictureButtonSettings {
  // Existing (keep)
  hoverEnabled: boolean;
  hoverColor: string;
  hoverOpacity: number;
  selectedColor: string;
  selectedOpacity: number;
  outlineEnabled: boolean;
  outlineOpacity: number;
  hoverZoomEnabled: boolean;
  hoverZoomScale: number;
  hoverZoomDurationMs: number;
  
  // NEW:
  size: 'small' | 'medium' | 'large' | 'xl';  // Picture size
  displayMode: 'text_and_image' | 'image_only' | 'text_only' | 'text_below_image';
  imageBorderRadiusPx: number;  // Rounding of picture corners
  gapBetweenPx: number;         // Space between picture buttons
}
```

### C. Backend Connection for Thumbnails

Current flow:
```
ProductAttributeBuilder (admin) 
  → uploads image to storage 
  → saves URL in valueSettings[valudId].customImage
  → stored in pricing_structure JSON
```

Desired flow:
```
Site Design V2 (upload thumbnail)
  → saves to product_attribute_values.thumbnail_url (NEW COLUMN)
  → visible in ProductAttributeBuilder
  → used in storefront selectors
```

**Required:**
1. Add `thumbnail_url` column to `product_attribute_values` table
2. Create upload mechanism in Site Design V2
3. Connect to ProductAttributeBuilder to show the thumbnail

---

## 🎨 UI Design Proposal

### New Section: "Produkt valgknapper" (Product Option Buttons)

This would be a new subsection under "Produktside matrix & knapper" or a separate section.

#### Tab 1: Tekst Knapper (Text Buttons)
```
┌─────────────────────────────────────┐
│ Farver                              │
│ ┌──────────┐  ┌──────────┐         │
│ │ Baggrund │  │ Hover BG │         │
│ │ [blue  ] │  │ [dark   ]│         │
│ └──────────┘  └──────────┘         │
│ ┌──────────┐  ┌──────────┐         │
│ │ Tekst    │  │ Hover    │         │
│ │ [white ] │  │ Tekst    │         │
│ └──────────┘  │ [yellow] │         │
│               └──────────┘         │
├─────────────────────────────────────┤
│ Form                                │
│ Hjørnerunding: [████░░░░░░] 12px   │
│ Kantbredde:    [░░░░░░░░░░] 0px    │
│ Knaphøjde:     [██████░░░░] 40px   │
│ Tekststørrelse:[████░░░░░░] 14px   │
└─────────────────────────────────────┘
```

#### Tab 2: Billed Knapper (Picture Buttons)
```
┌─────────────────────────────────────┐
│ Størrelse                           │
│ ( ) Lille  (•) Medium  ( ) Stor     │
│              ( ) XL                 │
├─────────────────────────────────────┤
│ Visning                             │
│ (•) Billede + tekst side om side    │
│ ( ) Billede + tekst under           │
│ ( ) Kun billede                     │
│ ( ) Kun tekst                       │
├─────────────────────────────────────┤
│ Billed udseende                     │
│ Hjørnerunding: [████░░░░░░] 8px    │
│ Afstand:       [██░░░░░░░░] 8px    │
├─────────────────────────────────────┤
│ Hover effekter (existing)           │
│ [x] Aktiver hover overlay           │
│ Farve: [blue ] Opacitet: [15%]     │
│ [x] Zoom ved hover                  │
└─────────────────────────────────────┘
```

#### Tab 3: Billed Upload (Thumbnail Connection)
```
┌─────────────────────────────────────┐
│ Upload billede til valgmulighed     │
│                                     │
│ Vælg produkt: [Dropdown________]   │
│ Vælg gruppe:  [Dropdown________]   │
│ Vælg værdi:   [Dropdown________]   │
│                                     │
│ [     Træk billede hertil      ]   │
│ [        eller klik for at      ]   │
│ [         vælge fil             ]   │
│                                     │
│ Uploadet billede:                   │
│ ┌────────┐                         │
│ │        │  Filnavn: material.jpg  │
│ │ [img]  │  Størrelse: 45KB       │
│ │        │  [Fjern] [Erstat]       │
│ └────────┘                         │
│                                     │
│ Dette billede vises:                │
│ • I backend under Produkt > Attributter│
│ • I butikken som valgmulighed      │
└─────────────────────────────────────┘
```

---

## 🔧 Implementation Steps

### Phase 1: Text Button Styling (2-3 hours)
1. Add `optionButtons` to data model in `useBrandingDraft.ts`
2. Create UI controls in SiteDesignEditorV2
3. Apply styles in `MatrixLayoutV1Renderer.tsx` for button selectors
4. Test with existing products

### Phase 2: Picture Button Enhancements (2-3 hours)
1. Extend `pictureButtons` interface with new fields
2. Add size, displayMode, borderRadius, gap controls to UI
3. Update `MatrixLayoutV1Renderer.tsx` to respect new settings
4. Update `StorformatConfigurator.tsx` similarly

### Phase 3: Backend Thumbnail Connection (4-6 hours)
1. Create migration: add `thumbnail_url` to `product_attribute_values`
2. Build upload component in Site Design V2
3. Create API/service to save thumbnail URL to database
4. Update `ProductAttributeBuilder` to show the thumbnail
5. Ensure storefront pulls from correct source

### Phase 4: Integration & Testing (2-3 hours)
1. Test end-to-end: upload → backend → storefront
2. Verify all settings apply correctly
3. Test with different product types

---

## 📁 Files To Modify

### Data Model
- `src/hooks/useBrandingDraft.ts` - Add new interfaces and defaults

### Editor UI
- `src/components/admin/SiteDesignEditorV2.tsx` - Add new controls (new tab or section)

### Storefront Rendering
- `src/components/product-price-page/MatrixLayoutV1Renderer.tsx` - Apply button styles
- `src/components/product-price-page/StorformatConfigurator.tsx` - Apply button styles

### Backend Connection (Phase 3)
- `supabase/migrations/` - New migration for thumbnail_url column
- `src/components/admin/ProductAttributeBuilder.tsx` - Show thumbnails

---

## 🤔 Questions For You

1. **Priority:** Do you want Phase 1 & 2 (styling) first, or is the backend thumbnail upload (Phase 3) most important?

2. **Text buttons:** Should the styling apply to ALL button selectors globally, or should it be per-product?

3. **Picture display modes:** Which of these do you need?
   - Text + Image side by side
   - Text below image
   - Image only
   - Text only

4. **Thumbnail upload:** Do you want to upload from:
   - Site Design V2 (as designed above)
   - ProductAttributeBuilder directly
   - Both places?

5. **Naming:** What should we call this new section in Danish?
   - "Produkt valgknapper"
   - "Valgmuligheder styling"
   - "Knap design"
   - Other?

---

Let me know your answers and I'll start implementing!
