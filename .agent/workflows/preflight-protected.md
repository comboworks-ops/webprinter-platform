---
description: Protected Preflight Check rules - do not modify without specific user request
---

# Preflight Check Protected Implementation

This document contains the core logic and rules for the preflight check system. These rules are critical for ensuring print quality and should NOT be modified unless specifically requested by the user.

## Core Files
- `src/utils/preflightChecks.ts`: Contains the mathematical logic and boundary calculations.
- `src/pages/Designer.tsx`: Calls the preflight checks and handles UI state.

## Checkout Adapter Notes (2026-02-10)

These are safe adapter-level behaviors outside protected designer core logic:

- File: `src/pages/FileUploadConfiguration.tsx`
- Uses actual selected design dimensions from checkout state (`designWidthMm`, `designHeightMm`, `designBleedMm`) before fallback to standard/product specs.
- Size-based DPI rule in checkout preflight:
- `<= A3` uses `300 DPI`
- `> A3` uses `150 DPI`
- Adds browser-side PDF page-size validation (page 1 in mm) and shows a PDF preview image.
- Adds a soft-proof preview toggle for visual simulation only (does not modify export or designer ICC pipeline).

Rollback:
- Revert `src/pages/FileUploadConfiguration.tsx` to a known-good commit if checkout preflight behavior regresses.
- Protected designer core remains unchanged (`preflightChecks.ts`, `Designer.tsx`).

## Critical Rules

### 1. Document Boundaries & Double-Bleed Prevention
- `docWidth` and `docHeight` from `calculateCanvasDimensions` already include bleed.
- **NEVER** add bleed twice when calculating the document area or guide positions.
- The visual white document area in `EditorCanvas` should match `docWidth` exactly.

### 2. Boundary Definitions
- **Bleed Box (Outer Red Line)**: Extends from `PASTEBOARD_OFFSET` to `PASTEBOARD_OFFSET + (docWidth)`.
- **Trim Area (Cut Line)**: Inset by `bleedPx` from the bleed box edge.
- **Safe Zone (Inner Green Line)**: Inset by `safeArea` (default 3mm) from the trim line.

### 3. Warning & Error Rules

#### Text Near Edge
- Trigger: If text touches or crosses the safe zone (green line).
- Message: "Tekst tæt på kanten"
- Details: "Teksten er placeret på eller uden for sikkerhedszonen (grøn streg) og risikerer at blive skåret af. Flyt teksten længere ind."

#### General Object Near Edge (Shapes/Groups)
- Trigger: If any non-text/non-image object touches or crosses the safe zone.
- Message: "Objekt tæt på kanten"
- Details: "Dette objekt er placeret på eller uden for den grønne sikkerhedszone. Det kan betyde, at det kommer kritisk tæt på kanten ved beskæring."

#### Outside Canvas/Bleed
- **OUTSIDE_CANVAS**: Triggered only if the object is *completely* outside the bleed box.
- **OUTSIDE_BLEED**: Triggered if the object *partially* crosses the bleed (outer red line).

#### Image Resolution
- **ERROR**: Below 96 DPI.
- **WARNING**: Below 150 DPI.
- **Optimal Goal**: 300 DPI.

### 4. UI Behavior
- **Automatic Execution**: Preflight runs on canvas changes with a 500ms debounce.
- **No Success Toasts**: Never show a "Success" or "Passed" toast automatically.
- **Conditional Tab Switching**: Only switch the sidebar to the "Preflight" tab if there are errors or warnings.
- **System Object Ignorance**: Preflight MUST ignore `__isGuide`, `__isDocumentBackground`, and internal pasteboard masks.

### 5. Pasteboard Interaction
- The gray overfill area MUST be non-interactive (use CSS overlays with `pointer-events: none`).
- Users should not be able to select or click the gray boxes.
