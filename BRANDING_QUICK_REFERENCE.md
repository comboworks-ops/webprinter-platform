# Branding System Quick Reference

**Quick guide for Printmaker branding system development.**

## Where Things Are

### Logo Settings
- **UI:** `src/components/admin/ForsideSection.tsx` (lines 208-340)
- **Renders:** `src/components/Header.tsx` (lines 323-380)
- **Data:** `HeaderSettings` in `src/hooks/useBrandingDraft.ts`

### Navigation/Menu Text Color
- **UI:** `src/components/admin/HeaderSection.tsx`
- **Field:** `header.textColor`

### CTA Button
- **Toggle:** `header.cta.enabled` (default: false)
- **Renders:** `src/components/Header.tsx` (lines 714-719, 861-868)

---

## Branding Data Model

### HeaderSettings Key Fields
```typescript
{
  // Logo
  logoType: 'image' | 'text',    // Default: 'text'
  logoText: string,              // Default: 'Min Shop'
  logoFont: string,              // Default: 'Inter'
  logoTextColor: string,         // Default: '#1F2937'
  logoImageUrl: string | null,
  
  // Navigation
  textColor: string,             // Menu text color
  navItems: HeaderNavItem[],
  
  // CTA Button
  cta: {
    enabled: boolean,            // Default: false
    label: string,
    href: string,
    variant: 'filled' | 'outline'
  }
}
```

---

## Strict Rules

1. **Color Picker:** ALWAYS use `ColorPickerWithSwatches` component
2. **Logo/Menu Colors:** Keep `logoTextColor` separate from `textColor`
3. **CTA Default:** Hidden by default, toggle to show

---

## Common Tasks

### Add New Header Setting
1. Add type to `HeaderSettings` interface (`useBrandingDraft.ts`)
2. Add default to `DEFAULT_HEADER` constant
3. Add UI in `ForsideSection.tsx` or `HeaderSection.tsx`
4. Use in `Header.tsx` for rendering

### Change Default Branding
Edit `DEFAULT_HEADER`, `DEFAULT_FOOTER`, `DEFAULT_FORSIDE` in `useBrandingDraft.ts`

---

## Tab Structure
| Tab | Component | Controls |
|-----|-----------|----------|
| Forside | ForsideSection | Logo, Header, Banner, Content Blocks, Footer |
| Typography | (inline) | Fonts, text colors |
| Colors | (inline) | Primary, secondary, accent colors |
| Ikoner | (future) | Icon management |
