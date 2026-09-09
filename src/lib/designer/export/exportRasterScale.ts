/** Physical raster resolution, independent of the editor's display scale and zoom. */
export function computeExportRasterScale(widthPx: number, heightPx: number, pixelsPerMm: number, maxTrimMm: number) {
    if (![widthPx, heightPx, pixelsPerMm, maxTrimMm].every(value => Number.isFinite(value) && value > 0)) {
        throw new Error('Invalid physical export dimensions');
    }
    const targetPpi = maxTrimMm > 2000 ? 100 : maxTrimMm > 1000 ? 150 : 300;
    const multiplier = Math.min(targetPpi / (25.4 * pixelsPerMm), 10000 / widthPx, 10000 / heightPx);
    return { multiplier, targetPpi, effectivePpi: multiplier * pixelsPerMm * 25.4 };
}
