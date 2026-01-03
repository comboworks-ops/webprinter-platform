/**
 * Detect DPI from image file binary data
 * Supports JPEG (JFIF) and PNG (pHYs)
 */
export async function getImageDpi(file: File): Promise<number | null> {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // PNG check
    if (view.getUint32(0) === 0x89504E47) {
        let offset = 8;
        while (offset < view.byteLength) {
            const length = view.getUint32(offset);
            const type = view.getUint32(offset + 4);
            if (type === 0x70485973) { // pHYs
                const ppuX = view.getUint32(offset + 8);
                const unit = view.getUint8(offset + 16);
                if (unit === 1) { // pixels per meter
                    return Math.round(ppuX * 0.0254);
                }
            }
            offset += length + 12;
        }
    }

    // JPEG check
    if (view.getUint16(0) === 0xFFD8) {
        let offset = 2;
        while (offset < view.byteLength) {
            const marker = view.getUint16(offset);
            if (marker === 0xFFE0) { // APP0 / JFIF
                const units = view.getUint8(offset + 11);
                const densityX = view.getUint16(offset + 12);
                if (units === 1) return densityX; // DPI
                if (units === 2) return Math.round(densityX * 2.54); // pixels per cm
            }
            if (marker >= 0xFFD0 && marker <= 0xFFD9) break;
            offset += view.getUint16(offset + 2) + 2;
        }
    }

    return null;
}
