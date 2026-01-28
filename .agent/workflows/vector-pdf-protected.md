---
description: Protected Vector PDF Export - do not modify without specific user request
---

# Vector PDF Export System (PROTECTED)

This workflow documents the PROTECTED status of the Vector PDF Export feature. This system preserves vector content from imported PDFs during export.

## Protected Files

The following files are PROTECTED and should NOT be modified without explicit user request:

### Core Export Files
- `src/lib/designer/export/exportVectorPdfBackground.ts` - Main vector PDF export logic
- `src/lib/designer/export/hideExportGuides.ts` - Guide hiding during export
- `src/lib/designer/export/computeExportCropRect.ts` - Crop rectangle calculation

### Supporting Files (Minimal Changes Only)
- `src/lib/designer/export/exportActions.ts` - Export orchestration (vector_pdf case)
- `src/lib/designer/export/types.ts` - Export type definitions

## System Overview

### How Vector PDF Export Works

1. **PDF Import**: When a user imports a PDF via `PDFImportModal.tsx`:
   - Original PDF bytes are stored in `pdfBytesRef`
   - When imported, metadata is attached to the Fabric image object:
     ```typescript
     img.data = {
       kind: 'pdf_page_background',
       originalPdfBytes: ArrayBuffer,
       pageIndex: number,
       originalFileName: string
     }
     ```

2. **Export Detection**: `ExportDialog.tsx` checks for PDF background:
   - Shows "Vektor PDF" option when PDF background is detected
   - Recommends vector export for imported PDFs

3. **Vector Export Process** (`exportVectorPdfBackground.ts`):
   - Loads original PDF using `pdf-lib`
   - Copies the referenced page (preserves vector content)
   - Detects overlay objects (user-added text, shapes, images)
   - If overlays exist:
     - Hides background and guides
     - Renders overlays as transparent PNG
     - Composites overlay on top of vector page
   - Downloads the final PDF

### Dependencies
- `pdf-lib` - PDF manipulation in browser
- `fabric.js` - Canvas management

## Rules for Modification

1. **DO NOT** modify the vector embedding logic without testing on:
   - Standard A4/A3 PDFs
   - Wide format PDFs (large dimensions)
   - Multi-page PDFs (only selected page should export)
   - PDFs with embedded fonts
   - PDFs with transparency

2. **DO NOT** change how PDF metadata is stored on Fabric objects

3. **DO NOT** modify the overlay rendering logic without verifying:
   - Transparency is preserved
   - Correct positioning on vector page
   - Resolution matches (300 DPI)

4. **Guide Hiding** must remain intact:
   - `__isGuide` and `__isDocumentBackground` markers
   - `hideGuides()` / `restoreGuides()` pattern

## Testing Checklist

Before any changes to protected files, verify:

- [ ] Standard PDF import → Vector export (text stays crisp on zoom)
- [ ] PDF with overlay text → Export preserves vector base + overlay
- [ ] Wide format PDF (e.g., 1000mm x 500mm) → Correct dimensions
- [ ] Multi-page PDF → Correct page exported
- [ ] Print PDF mode still works
- [ ] Proof PDF mode still works
- [ ] No guide lines appear in any export mode

## File Diagram

```
PDFImportModal.tsx
      │
      ├── Stores originalPdfBytes in pdfBytesRef
      ├── Attaches metadata to Fabric Image object
      │
      ▼
Designer.tsx (handlePDFImport)
      │
      ├── Receives PDFImportData with originalPdfBytes
      ├── Creates Fabric image with data.kind = 'pdf_page_background'
      │
      ▼
ExportDialog.tsx
      │
      ├── Detects hasPdfBackground
      ├── Shows "Vektor PDF" option
      │
      ▼
exportActions.ts (runDesignerExport)
      │
      ├── case 'vector_pdf':
      │     └── exportVectorPdfBackground()
      │
      ▼
exportVectorPdfBackground.ts
      │
      ├── PDFDocument.load() - Load original PDF
      ├── copyPages() - Copy referenced page
      ├── renderOverlaysOnly() - Capture overlays as PNG
      ├── embedPng() + drawImage() - Composite
      └── Download final PDF
```
