---
description: Protected soft proof core files - do not modify without review
---

# Soft Proof Core Files - PROTECTED

The following files contain the core soft proofing functionality for ICC-based color management.
These files have been tested and verified to work correctly. **DO NOT MODIFY** without careful review.

## Protected Files

1. **`src/workers/colorProofing.worker.ts`**
   - Web Worker that performs ICC color transformations
   - Uses lcms-wasm with CORRECT API: `cmsDoTransform(transform, inputArr, size)` returns output
   - Handles soft proof preview and CMYK export

2. **`src/hooks/useColorProofing.ts`**
   - React hook that manages soft proof state and worker communication
   - Handles canvas capture, overlay rendering, and settings

3. **`src/lib/color/iccProofing.ts`**
   - Configuration and types for ICC profiles
   - Defines OUTPUT_PROFILES, settings interface, and message types

4. **Designer.tsx overlay section** (lines ~1053-1072)
   - The soft proof overlay canvas with z-index: 50
   - Must remain positioned correctly over the Fabric.js canvas

## Critical Implementation Details

### lcms-wasm API (DO NOT CHANGE)
```typescript
// CORRECT API - returns output array
const outputArray = lcmsModule.cmsDoTransform(proofTransform, inputArray, pixelCount);

// WRONG - DO NOT USE 4 PARAMETERS
// lcmsModule.cmsDoTransform(transform, input, output, count); // BROKEN
```

### Overlay Z-Index
The soft proof overlay canvas must have `zIndex: 50` to appear above the Fabric.js canvas.

## If Changes Are Needed

1. Create a backup branch first
2. Test with bright saturated colors (e.g., #0000FF blue)
3. Verify both soft proof toggle AND gamut warning work
4. Check console for "Transform completed successfully" messages
5. Verify NO "offset is out of bounds" errors

## Last Verified Working: 2026-01-03
