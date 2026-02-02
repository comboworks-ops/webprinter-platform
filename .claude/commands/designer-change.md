---
description: Guide through safe print designer changes
---

# Designer Change Workflow

You've been asked to modify the print designer. This is a **PROTECTED DOMAIN** with many critical constants and workflows.

---

## 1. CRITICAL: Read Protected Workflows First!

Before making ANY designer change, read these protection documents:

| Document | Protects |
|----------|----------|
| `.agent/workflows/preflight-protected.md` | Preflight validation rules |
| `.agent/workflows/soft-proof-protected.md` | ICC color proofing (lcms-wasm) |
| `.agent/workflows/vector-pdf-protected.md` | PDF vector preservation |
| `.agent/workflows/physical-scaling-import.md` | DPI-based image scaling |

**These documents explain WHY certain code cannot be changed casually.**

---

## 2. Designer Domain Files

**Files in this domain:**

| File | Purpose | Protection Level |
|------|---------|------------------|
| `src/pages/Designer.tsx` | Main designer page | PROTECTED (constants) |
| `src/components/designer/EditorCanvas.tsx` | Fabric.js canvas wrapper | PROTECTED (scaling) |
| `src/components/designer/LayerPanel.tsx` | Layer management UI | Safe to modify |
| `src/components/designer/PropertiesPanel.tsx` | Object properties UI | Safe to modify |
| `src/components/designer/ColorProofingPanel.tsx` | ICC soft proof UI | Safe to modify |
| `src/components/designer/PreflightPanel.tsx` | Preflight results UI | Safe to modify |
| `src/components/designer/ExportDialog.tsx` | Export options UI | Safe to modify |
| `src/utils/preflightChecks.ts` | Validation rules | PROTECTED |
| `src/utils/imageMetadata.ts` | DPI extraction | PROTECTED |
| `src/hooks/useColorProofing.ts` | ICC proofing hook | PROTECTED |
| `src/workers/colorProofing.worker.ts` | lcms-wasm processing | PROTECTED |
| `src/lib/designer/export/*` | PDF export logic | PROTECTED |

---

## 3. NEVER Modify Without Discussion

These constants and functions are **CRITICAL**. Changing them breaks exports:

### Constants (in Designer.tsx / EditorCanvas.tsx)
```typescript
DISPLAY_DPI        // Affects all canvas rendering
PASTEBOARD_PADDING // Affects crop calculations
```

### Protected Functions
- `preflightChecks.ts` - All validation rules (DPI checks, bleed, color space)
- `colorProofing.worker.ts` - lcms-wasm uses specific 3-parameter API
- `computeExportCropRect.ts` - Precise pixel calculations for PDF
- `exportVectorPdfBackground.ts` - Preserves vectors from imported PDFs

---

## 4. Boundary Check - Files You MUST NOT Touch

When modifying designer, **NEVER** touch these files:

| File | Domain | Why |
|------|--------|-----|
| `src/lib/pricing/*` | Pricing | Price calculations |
| `src/utils/productPricing.ts` | Pricing | Price matrices |
| `src/lib/branding/*` | Branding | Tenant appearance |
| `src/lib/pod/*` | POD v1 | Legacy POD |
| `src/lib/pod2/*` | POD v2 | Current POD |

---

## 5. Safe Modifications

These changes are generally safe:

- **UI-only changes** to LayerPanel, PropertiesPanel, ColorProofingPanel
- **Adding new tool buttons** (as long as they use existing canvas methods)
- **Styling changes** to designer layout
- **Text/label changes** in the UI
- **Adding new export format options** (if using existing export infrastructure)

---

## 6. Testing Checklist

After making designer changes, verify:

- [ ] Upload a test image - verify DPI scaling is correct
- [ ] Run preflight on a design - verify all checks pass/fail correctly
- [ ] Export PDF - verify vectors are preserved (if using imported PDF)
- [ ] Export PDF - verify crop area is correct (no extra whitespace)
- [ ] Soft proof toggle - verify ICC color transform works
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Canvas renders at correct physical dimensions

---

## 7. Designer Architecture

```
Designer.tsx (state management)
    ├── EditorCanvas (Fabric.js wrapper, ref methods)
    │       └── canvas.addImage(), canvas.getObjects(), etc.
    ├── PropertiesPanel (reads selected object, calls canvas methods)
    ├── LayerPanel (reads canvas.getObjects(), manages z-order)
    ├── ColorProofingPanel (toggles soft proof via useColorProofing)
    └── PreflightPanel (runs preflightChecks against canvas)
```

---

## 8. Reference

Full domain documentation: `docs/ARCHITECTURE_BOUNDARIES.md`
Protected workflows: `.agent/workflows/`
