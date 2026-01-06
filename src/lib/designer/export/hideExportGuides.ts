/**
 * Hide Export Guides
 * 
 * Utility to temporarily hide guide objects (trim line, safe zone, document background)
 * during export so they don't appear in the final PDF.
 * 
 * Guide objects are identified by:
 * - __isGuide = true (trim and safe zone rectangles)
 * - __isDocumentBackground = true (white paper background)
 */

import { fabric } from 'fabric';

interface GuideState {
    object: fabric.Object;
    wasVisible: boolean;
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
        const isDocBg = obj.__isDocumentBackground === true;

        if (isGuide || isDocBg) {
            hiddenGuides.push({
                object: obj,
                wasVisible: obj.visible !== false
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
    hiddenGuides.forEach(({ object, wasVisible }) => {
        (object as any).visible = wasVisible;
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
