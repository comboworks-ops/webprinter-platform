/**
 * Hide Export Guides
 * 
 * Utility to temporarily hide guide objects (trim line, safe zone, template overlays)
 * during export so they don't appear in the final PDF.
 * 
 * Non-printing editor objects are identified by:
 * - __isGuide = true (trim and safe zone rectangles)
 * - __isGuideLabel = true (guide labels)
 * - __isDocumentBackground = true (printable paper/background fill)
 * - __isPdfTemplate = true (technical PDF template overlays)
 */

import type { fabric } from 'fabric';

interface GuideState {
    object: fabric.Object;
    wasVisible: boolean;
    wasExcludedFromExport: boolean;
    outline?: { stroke: fabric.Object['stroke']; strokeWidth: number | undefined };
}

/**
 * Hides all guide objects on the canvas and returns state for restoration
 */
export function hideGuides(canvas: fabric.Canvas | null): GuideState[] {
    if (!canvas) return [];

    const hiddenGuides: GuideState[] = [];

    canvas.getObjects().forEach((obj: any) => {
        // Check for guide markers
        const isGuide = obj.__isGuide === true;
        const isGuideLabel = obj.__isGuideLabel === true;
        const isDocBg = obj.__isDocumentBackground === true;
        const isPdfTemplate = obj.__isPdfTemplate === true;

        if (isDocBg) {
            hiddenGuides.push({
                object: obj,
                wasVisible: obj.visible !== false,
                wasExcludedFromExport: obj.excludeFromExport === true,
                outline: { stroke: obj.stroke, strokeWidth: obj.strokeWidth },
            });

            // The artboard fill is part of the intended artwork. Keeping the object's
            // own fill means white exports white while an explicit transparent fill
            // remains transparent.
            obj.visible = true;
            obj.excludeFromExport = false;
            // The paper fill prints; its editor frame must never enter the bleed.
            obj.stroke = null;
            obj.strokeWidth = 0;
            obj.dirty = true;
            return;
        }

        if (isGuide || isGuideLabel || isPdfTemplate) {
            hiddenGuides.push({
                object: obj,
                wasVisible: obj.visible !== false,
                wasExcludedFromExport: obj.excludeFromExport === true,
            });

            // Hide the object
            obj.visible = false;
        }
    });

    // Re-render canvas with hidden guides
    if (hiddenGuides.length > 0) {
        canvas.renderAll();
    }


    return hiddenGuides;
}

/**
 * Restores previously hidden guide objects
 */
export function restoreGuides(hiddenGuides: GuideState[]): void {
    hiddenGuides.forEach(({ object, wasVisible, wasExcludedFromExport }) => {
        (object as any).visible = wasVisible;
        (object as any).excludeFromExport = wasExcludedFromExport;
    });

    hiddenGuides.forEach(({ object, outline }) => {
        if (outline) {
            object.stroke = outline.stroke;
            object.strokeWidth = outline.strokeWidth;
            object.dirty = true;
        }
    });

    // Re-render if we had any guides
    if (hiddenGuides.length > 0) {
        const canvas = hiddenGuides[0]?.object.canvas;
        if (canvas) {
            (canvas as fabric.Canvas).renderAll();
        }
    }


}

/**
 * Wrapper to execute export function with guides hidden
 * Ensures guides are restored even if export throws
 */
export async function withHiddenGuides<T>(
    canvas: fabric.Canvas | null,
    exportFn: () => Promise<T>
): Promise<T> {
    const hiddenGuides = hideGuides(canvas);

    try {
        return await exportFn();
    } finally {
        restoreGuides(hiddenGuides);
    }
}
