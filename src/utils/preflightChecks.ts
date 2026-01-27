/**
 * Preflight Checks for Print Designer
 * 
 * PROTECTED - See .agent/workflows/preflight-protected.md
 * DO NOT MODIFY core rules without specific user request
 * 
 * Validates designs before export to catch common print issues
 */

import { fabric } from 'fabric';

export interface PreflightWarning {
    id: string;
    type: 'error' | 'warning' | 'info';
    code: string;
    message: string;
    details?: string;
    objectId?: string;
    canIgnore: boolean;
}

export interface PreflightResult {
    passed: boolean;
    warnings: PreflightWarning[];
    errors: PreflightWarning[];
    infos: PreflightWarning[];
}

interface PreflightOptions {
    documentWidth: number;  // mm
    documentHeight: number; // mm
    bleed: number;          // mm
    safeArea: number;       // mm (typically 3mm from trim)
    minDPI: number;         // Minimum acceptable DPI
    targetDPI: number;      // Target DPI (for high quality)
    optimalDPI?: number;    // Optimal DPI (usually 300)
    mmToPx: number;         // Conversion factor used in canvas
}

/**
 * Run all preflight checks on a Fabric.js canvas
 */
export function runPreflightChecks(
    canvas: fabric.Canvas,
    options: PreflightOptions
): PreflightResult {
    const warnings: PreflightWarning[] = [];
    const errors: PreflightWarning[] = [];
    const infos: PreflightWarning[] = [];

    const objects = canvas.getObjects();

    if (objects.length === 0) {
        infos.push({
            id: 'empty-canvas',
            type: 'info',
            code: 'EMPTY_CANVAS',
            message: 'Tomt design',
            details: 'Dit design er tomt. Tilføj indhold før eksport.',
            canIgnore: false,
        });
    }

    // Calculate canvas boundaries in pixels
    // NOTE: The canvas has 100px pasteboard padding around the document
    // Fabric.js getBoundingRect() includes this offset, so we must account for it
    const PASTEBOARD_OFFSET = 100;

    const bleedPx = options.bleed * options.mmToPx;
    const trimLeft = PASTEBOARD_OFFSET + bleedPx;
    const trimTop = PASTEBOARD_OFFSET + bleedPx;
    const trimRight = PASTEBOARD_OFFSET + (options.documentWidth + options.bleed) * options.mmToPx;
    const trimBottom = PASTEBOARD_OFFSET + (options.documentHeight + options.bleed) * options.mmToPx;

    const safeLeft = trimLeft + (options.safeArea * options.mmToPx);
    const safeTop = trimTop + (options.safeArea * options.mmToPx);
    const safeRight = trimRight - (options.safeArea * options.mmToPx);
    const safeBottom = trimBottom - (options.safeArea * options.mmToPx);

    // Bleed box boundaries (the outer red dashed line)
    const bleedLeft = PASTEBOARD_OFFSET;
    const bleedTop = PASTEBOARD_OFFSET;
    const bleedRight = PASTEBOARD_OFFSET + (options.documentWidth + options.bleed * 2) * options.mmToPx;
    const bleedBottom = PASTEBOARD_OFFSET + (options.documentHeight + options.bleed * 2) * options.mmToPx;

    let imageCount = 0;

    // Helper to traverse all objects (including inside groups)
    const traverseObject = (obj: fabric.Object) => {
        // Skip system objects (guides, document background, template overlays)
        if ((obj as any).__isGuide ||
            (obj as any).__isDocumentBackground ||
            (obj as any).__isPdfTemplate ||
            (obj as any).__isCutContour) {
            return;
        }

        const objId = (obj as any).__layerId || `object-${Math.random().toString(36).substr(2, 9)}`;

        // Use getBoundingRect(true) to get coordinates relative to the CANVAS, 
        // even if the object is inside a group.
        const bounds = obj.getBoundingRect(true);

        // Check 1: Objects outside trim area (not reaching bleed)
        // This is only a warning for objects that should bleed but don't

        // Check 2: Text in bleed area (will be cut off)
        if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
            const tolerance = 0.5;
            if (bounds.left <= safeLeft + tolerance || bounds.top <= safeTop + tolerance ||
                bounds.left + bounds.width >= safeRight - tolerance || bounds.top + bounds.height >= safeBottom - tolerance) {
                warnings.push({
                    id: `text-outside-safe-${objId}`,
                    type: 'warning',
                    code: 'TEXT_OUTSIDE_SAFE_AREA',
                    message: 'Tekst tæt på kanten',
                    details: 'Teksten er placeret på eller uden for sikkerhedszonen (grøn streg) og risikerer at blive skåret af. Flyt teksten længere ind.',
                    objectId: objId,
                    canIgnore: true,
                });
            }
        }

        // Check 3: Low resolution images
        if (obj.type === 'image') {
            imageCount++;
            const img = obj as fabric.Image;
            const element = img.getElement() as HTMLImageElement;

            if (element) {
                // Calculate global scale by decomposing the transform matrix (accounts for nested groups)
                const matrix = img.calcTransformMatrix();
                const transform = fabric.util.qrDecompose(matrix);

                const displayWidthPx = (img.width || element.naturalWidth || element.width) * Math.abs(transform.scaleX);
                const displayHeightPx = (img.height || element.naturalHeight || element.height) * Math.abs(transform.scaleY);

                // Get native dimensions
                const natWidth = img.width || element.naturalWidth || element.width || 0;
                const natHeight = img.height || element.naturalHeight || element.height || 0;

                if (natWidth > 0 && displayWidthPx > 0) {
                    // Calculate display size in mm using the fixed conversion factor
                    const displayWidthMm = displayWidthPx / options.mmToPx;
                    const displayHeightMm = displayHeightPx / options.mmToPx;

                    // Calculate DPI: (Pixels / MM) * 25.4
                    const dpiX = (natWidth / displayWidthMm) * 25.4;
                    const dpiY = (natHeight / displayHeightMm) * 25.4;
                    const effectiveDPI = Math.min(dpiX, dpiY);

                    if (effectiveDPI < options.minDPI) {
                        errors.push({
                            id: `low-resolution-${objId}`,
                            type: 'error',
                            code: 'LOW_RESOLUTION',
                            message: `Lav opløsning (${Math.round(effectiveDPI)} DPI)`,
                            details: `Dit billede bliver printet i ${Math.round(effectiveDPI)} DPI, hvilket er for lavt (min. ${options.minDPI}). Gør billedet mindre eller skift til et bedre billede.`,
                            objectId: objId,
                            canIgnore: true,
                        });
                    } else if (effectiveDPI < options.targetDPI) {
                        warnings.push({
                            id: `medium-resolution-${objId}`,
                            type: 'warning',
                            code: 'MEDIUM_RESOLUTION',
                            message: `Medium opløsning (${Math.round(effectiveDPI)} DPI)`,
                            details: `Optimal kvalitet er over ${options.optimalDPI || 300} DPI. Dit billede har ${Math.round(effectiveDPI)} DPI, hvilket er over minimum (${options.minDPI}), men kan give et let sløret resultat.`,
                            objectId: objId,
                            canIgnore: true,
                        });
                    }
                }
            }

            // Check 3b: Image near edge (Improper Bleed)
            // If image is near the edge, it must either be SAFELY INSIDE or FULLY BLEEDING OUT.
            const bleedTolerance = 1 * options.mmToPx; // 1mm flexibility for "reaching the edge"

            const isNearLeft = bounds.left > bleedLeft + bleedTolerance && bounds.left < safeLeft;
            const isNearTop = bounds.top > bleedTop + bleedTolerance && bounds.top < safeTop;
            const isNearRight = (bounds.left + bounds.width) < (bleedRight - bleedTolerance) && (bounds.left + bounds.width) > safeRight;
            const isNearBottom = (bounds.top + bounds.height) < (bleedBottom - bleedTolerance) && (bounds.top + bounds.height) > safeBottom;

            if (isNearLeft || isNearTop || isNearRight || isNearBottom) {
                warnings.push({
                    id: `image-edge-warning-${objId}`,
                    type: 'warning',
                    code: 'IMAGE_NEAR_EDGE',
                    message: 'Billede tæt på kant',
                    details: 'Billedet slutter tæt på kanten. Hvis det skal gå til kant (tryk til kant), skal det trækkes helt ud til den røde streg (bleed). Ellers hold det inden for den grønne sikkerhedszone.',
                    objectId: objId,
                    canIgnore: true,
                });
            }
        }

        // Check 4: Very thin strokes
        if (obj.strokeWidth && obj.strokeWidth > 0 && obj.strokeWidth < 0.5) {
            warnings.push({
                id: `thin-stroke-${objId}`,
                type: 'warning',
                code: 'THIN_STROKE',
                message: 'Meget tynd streg',
                details: 'Streger tyndere end 0.5pt kan være svære at se på print.',
                objectId: objId,
                canIgnore: true,
            });
        }

        // Check 6: General near edge check (for all other objects like shapes/groups)
        if (obj.type !== 'i-text' && obj.type !== 'text' && obj.type !== 'textbox' && obj.type !== 'image') {
            const tolerance = 0.5; // Small tolerance for floating point
            if (bounds.left <= safeLeft + tolerance || bounds.top <= safeTop + tolerance ||
                bounds.left + bounds.width >= safeRight - tolerance || bounds.top + bounds.height >= safeBottom - tolerance) {
                warnings.push({
                    id: `object-near-edge-${objId}`,
                    type: 'warning',
                    code: 'OBJECT_NEAR_EDGE',
                    message: 'Objekt tæt på kanten',
                    details: 'Dette objekt er placeret på eller uden for den grønne sikkerhedszone. Det kan betyde, at det kommer kritisk tæt på kanten ved beskæring.',
                    objectId: objId,
                    canIgnore: true,
                });
            }
        }

        // Check 5: Objects outside bleed area
        // Completely outside = won't print at all
        if (bounds.left + bounds.width < bleedLeft || bounds.top + bounds.height < bleedTop ||
            bounds.left > bleedRight || bounds.top > bleedBottom) {
            warnings.push({
                id: `outside-canvas-${objId}`,
                type: 'warning',
                code: 'OUTSIDE_CANVAS',
                message: 'Objekt uden for canvas',
                details: 'Et objekt er placeret helt uden for dokumentet og vil ikke være synligt på print.',
                objectId: objId,
                canIgnore: true,
            });
        }
        // Partially outside bleed = will be cut off (but ignored if it's meant to bleed)
        else if (bounds.left < bleedLeft || bounds.top < bleedTop ||
            bounds.left + bounds.width > bleedRight || bounds.top + bounds.height > bleedBottom) {
            warnings.push({
                id: `outside-bleed-${objId}`,
                type: 'warning',
                code: 'OUTSIDE_BLEED',
                message: 'Objekt rækker uden for bleed',
                details: 'Objektet rækker uden for bleed-området (rød streg). Den del, der er udenfor, bliver skåret af.',
                objectId: objId,
                canIgnore: true,
            });
        }

        // Recurse if group (note: Fabric 5+ handles nested rects accurately with getBoundingRect(true))
        // but we still want to check each object inside for resolution/text issues.
        if (obj.type === 'group' && (obj as fabric.Group).getObjects) {
            (obj as fabric.Group).getObjects().forEach(traverseObject);
        }
    };

    objects.forEach(traverseObject);

    // Check for very small text
    objects.filter(obj => obj.type === 'i-text' || obj.type === 'text').forEach((obj, index) => {
        const textObj = obj as fabric.IText;
        const fontSize = textObj.fontSize || 12;
        const objId = (obj as any).__layerId || `text-${index}`;

        if (fontSize < 6) {
            warnings.push({
                id: `small-text-${objId}`,
                type: 'warning',
                code: 'SMALL_TEXT',
                message: 'Meget lille tekst',
                details: `Tekst med størrelse ${fontSize}pt kan være svær at læse på print. Minimum anbefalet er 6pt.`,
                objectId: objId,
                canIgnore: true,
            });
        }
    });

    const passed = errors.length === 0;

    return {
        passed,
        warnings,
        errors,
        infos,
    };
}

/**
 * Get severity color for a warning type
 */
export function getWarningColor(type: 'error' | 'warning' | 'info'): string {
    switch (type) {
        case 'error':
            return 'text-red-600 bg-red-50 border-red-200';
        case 'warning':
            return 'text-amber-600 bg-amber-50 border-amber-200';
        case 'info':
            return 'text-blue-600 bg-blue-50 border-blue-200';
        default:
            return 'text-gray-600 bg-gray-50 border-gray-200';
    }
}

/**
 * Get icon name for a warning type
 */
export function getWarningIcon(type: 'error' | 'warning' | 'info'): string {
    switch (type) {
        case 'error':
            return 'AlertCircle';
        case 'warning':
            return 'AlertTriangle';
        case 'info':
            return 'Info';
        default:
            return 'HelpCircle';
    }
}
