---
description: Protected soft proof core files - do not modify without review
---

# Soft Proof Core Files - PROTECTED 🔒

The following files contain the core soft proofing functionality for ICC-based color management.
These files have been tested and verified to work correctly. **DO NOT MODIFY** without careful review.

## Protected Files

### 1. `src/workers/colorProofing.worker.ts`
- Web Worker that performs ICC color transformations using lcms-wasm
- **CRITICAL API**: `cmsDoTransform(transform, inputArr, size)` RETURNS output (3 params only!)
- Handles soft proof preview and CMYK export
- Processes in batches of 4096 pixels for large documents

### 2. `src/hooks/useColorProofing.ts`
- React hook that manages soft proof state and worker communication
- Captures only the **document area** (excludes pasteboard)
- Uses `pasteboardOffset`, `docWidth`, `docHeight` for proper cropping
- Renders overlay to document dimensions only

### 3. `src/lib/color/iccProofing.ts`
- Configuration and types for ICC profiles
- Defines OUTPUT_PROFILES, settings interface, and message types
- Profile URLs: `/icc/ISOcoated_v2_300_eci.icc`, etc.

### 4. Designer.tsx - Overlay Section (lines ~1053-1072)
```tsx
{/* Soft proofing overlay - positioned over document area only */}
{colorProofing.settings.enabled && (
    <canvas
        ref={proofingOverlayRef}
        className="absolute pointer-events-none"
        style={{
            left: PASTEBOARD_PADDING,  // 100px offset
            top: PASTEBOARD_PADDING,   // 100px offset
            width: docWidth,           // Document width only
            height: docHeight,         // Document height only
            mixBlendMode: 'normal',
            zIndex: 10,  // Below guide lines (z-20+) but above canvas
        }}
    />
)}
```

## Critical Implementation Details

### lcms-wasm API (DO NOT CHANGE!)
```typescript
// ✅ CORRECT - Returns output array (3 parameters)
const outputArray = lcmsModule.cmsDoTransform(proofTransform, inputArray, pixelCount);

// ❌ WRONG - DO NOT USE 4 PARAMETERS (causes "offset out of bounds")
// lcmsModule.cmsDoTransform(transform, input, output, count); // BROKEN!
```

### Document Area Cropping (DO NOT CHANGE!)
```typescript
// Capture only the document area (excluding pasteboard)
const srcX = pasteboardOffset;  // 100
const srcY = pasteboardOffset;  // 100
ctx.drawImage(sourceCanvas, srcX, srcY, srcWidth, srcHeight, 0, 0, width, height);
```

### Hook Parameters (Required)
```typescript
useColorProofing({
    fabricCanvas: ...,
    overlayCanvasRef: ...,
    canvasWidth,        // Full canvas (with pasteboard)
    canvasHeight,       // Full canvas (with pasteboard)
    docWidth,           // Document only (no pasteboard)
    docHeight,          // Document only (no pasteboard)
    pasteboardOffset: PASTEBOARD_PADDING,  // 100px
    ...
});
```

## What Must Be Preserved

1. **Overlay position**: `left/top: PASTEBOARD_PADDING` (100px)
2. **Overlay size**: `docWidth × docHeight` (not canvasWidth/Height)
3. **Z-index**: 10 (below guide lines at z-20+)
4. **Canvas cropping**: Source crop at pasteboardOffset
5. **lcms-wasm 3-parameter API**: Returns output, doesn't take output buffer

## If Changes Are Needed

1. ⚠️ Create a backup branch first: `git checkout -b backup-soft-proof`
2. ⚠️ Review this entire document before making ANY changes
3. Test with:
   - Bright saturated colors (#0000FF blue)
   - Objects extending beyond document edge
   - Gamut warning enabled
4. Verify:
   - "Transform completed successfully" in console
   - NO "offset is out of bounds" errors
   - Grey pasteboard remains visible
   - Bleed lines remain visible
   - Only document area shows color transformation

## Last Verified Working: 2026-01-03
## Commit: 09cdc90
