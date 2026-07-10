import { fabric } from 'fabric';

type ViewportTransform = [number, number, number, number, number, number];

const IDENTITY_VIEWPORT: ViewportTransform = [1, 0, 0, 1, 0, 0];

/**
 * Fabric export inherits the live editor viewport transform. Temporarily reset
 * it so crop coordinates are interpreted in document space, then restore the
 * exact screen zoom and pan even when export fails.
 */
export async function withCanonicalExportViewport<T>(
    canvas: fabric.Canvas,
    exportFn: () => Promise<T>,
): Promise<T> {
    const originalViewport = (canvas.viewportTransform?.slice() || IDENTITY_VIEWPORT.slice()) as ViewportTransform;

    canvas.setViewportTransform(IDENTITY_VIEWPORT.slice() as ViewportTransform);
    canvas.calcOffset();
    canvas.requestRenderAll();

    try {
        return await exportFn();
    } finally {
        canvas.setViewportTransform(originalViewport);
        canvas.calcOffset();
        canvas.requestRenderAll();
    }
}
