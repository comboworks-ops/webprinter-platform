# Checkpoint - December 17, 2025

**Status:** Stable Feature Set

This checkpoint captures the state of the application after successfully implementing two major features:

1.  **Full Live Preview Navigation**: The preview pane now supports full navigation to all key pages (`/kontakt`, `/om-os`, `/grafisk-vejledning`, `/handelsbetingelser`) and dynamic product detail pages (`/produkt/:slug`). This was achieved by extracting page content into reusable components (e.g., `ContactContent.tsx`, `ProductPriceContent.tsx`).

2.  **Dropdown Menu Hover Color Customization**: 
    - Added a new branding setting: `dropdownHoverColor`.
    - Integrated a color picker in the Branding Editor (Header -> Dropdown Indhold).
    - Updated `Header.tsx` to apply this color effectively, overriding default system focus styles.

## Key Changes Since Last Backup

### Core Components
- `src/components/Header.tsx`: Added dynamic CSS variables for dropdown hover/focus states.
- `src/components/admin/HeaderSection.tsx`: Added UI control for the new setting.

### Branding Logic
- `src/lib/branding/types.ts` & `src/hooks/useBrandingDraft.ts`: Updated data models to include `dropdownHoverColor`.
- `src/lib/branding/tenant-adapter.ts`: Improved "Reset to Default" logic to sync with Master Tenant settings.

### Preview System
- `src/pages/PreviewShop.tsx`: Refactored to render extracted content components based on virtual routes.
- `src/components/content/`: Created new folder with extracted content components (`ContactContent`, `AboutContent`, `GrafiskVejledningContent`, etc.).

## How to Resume
To continue work from this point:
1.  Ensure you are on the `main` branch (or the branch where this checkpoint was committed).
2.  Run `npm run dev` to start the development server.
3.  The branding editor and preview should be fully functional with the features described above.

## Known Issues
- None critical. formatting of 'Terms' page in preview might need minor CSS adjustment but is functional.

