---
description: PROTECTED - Fysisk skalering ved import af billeder og filer
---

# ⚠️ BESKYTTET KODE - MÅ IKKE ÆNDRES ⚠️

Denne funktionalitet er markeret som **låst** og må ikke modificeres uden eksplicit godkendelse fra brugeren.

## Formål
Når billeder, PDF'er eller SVG-filer importeres i designeren, skal de automatisk skaleres til deres korrekte fysiske størrelse baseret på DPI-metadata. Et A5-billede i 300 DPI skal f.eks. fylde præcis 1/4 af et A3-layout.

---

## Beskyttede Filer og Sektioner

### 1. `src/utils/imageMetadata.ts` (HELE FILEN)
Læser DPI fra PNG (pHYs chunk) og JPEG (APP0/JFIF segment).

```typescript
// LÅST - Må ikke ændres
export async function getImageDpi(file: File): Promise<number | null>
```

### 2. `src/components/designer/EditorCanvas.tsx`

#### `addImage` metoden (linje ~500-540)
```typescript
addImage: async (url: string, sourceDpi?: number) => {
    // Hvis sourceDpi er angivet, beregnes skala for fysisk størrelse
    // DISPLAY_DPI / sourceDpi
    // Ellers bruges document DPI som fallback
}
```

#### `importSVG` metoden (linje ~450-475)
```typescript
importSVG: (svgString: string) => {
    // SVG antages at være 96 DPI (web standard)
    // Skaleres til DISPLAY_DPI (50.8)
}
```

### 3. `src/pages/Designer.tsx`

#### `handleImageUpload` funktionen (linje ~380-400)
```typescript
const handleImageUpload = useCallback(async (e) => {
    const sourceDpi = await getImageDpi(file);
    editorRef.current?.addImage(dataUrl, sourceDpi || undefined);
});
```

#### `handlePDFImport` funktionen (linje ~405-440)
```typescript
const handlePDFImport = useCallback((data: PDFImportData) => {
    // Beregner fysisk størrelse fra PDF's mm-dimensioner
    const desiredWidthPx = mmToPx(data.widthMm, DISPLAY_DPI);
    // Skalerer raster til korrekt visuel størrelse
});
```

---

## Konstanter (må ikke ændres)

| Konstant | Værdi | Placering |
|----------|-------|-----------|
| `DISPLAY_DPI` | 50.8 | EditorCanvas.tsx, Designer.tsx |
| `MM_TO_PX` | ~2.0 (DISPLAY_DPI / 25.4) | Designer.tsx |

---

## Adfærd

1. **Billede med DPI-metadata**: Skaleres til `DISPLAY_DPI / sourceDpi`
2. **Billede uden DPI-metadata**: Antager document DPI (typisk 300), skaleres til `DISPLAY_DPI / dpi`
3. **SVG**: Antager 96 DPI, skaleres til `DISPLAY_DPI / 96`
4. **PDF**: Bruger fysiske mm-dimensioner fra PDF'ens viewport

---

## Eksempel
- A5 billede (148×210mm) i 300 DPI = 1748×2480 pixels
- Importeret i A3 layout (297×420mm)
- Resultat: Billede fylder ~25% af dokumentet (korrekt fysisk forhold)

---

## Ændringslog
- **2026-01-03**: Markeret som beskyttet kode. Ingen ændringer tilladt.
