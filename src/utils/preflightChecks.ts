/**
 * Preflight Checks for Print Designer
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
    const bleedPx = options.bleed * options.mmToPx;
    const trimLeft = bleedPx;
    const trimTop = bleedPx;
    const trimRight = (options.documentWidth + options.bleed) * options.mmToPx;
    const trimBottom = (options.documentHeight + options.bleed) * options.mmToPx;

    const safeLeft = trimLeft + (options.safeArea * options.mmToPx);
    const safeTop = trimTop + (options.safeArea * options.mmToPx);
    const safeRight = trimRight - (options.safeArea * options.mmToPx);
    const safeBottom = trimBottom - (options.safeArea * options.mmToPx);

    objects.forEach((obj, index) => {
        const objId = (obj as any).__layerId || `object-${index}`;
        const bounds = obj.getBoundingRect();

        // Check 1: Objects outside trim area (not reaching bleed)
        // This is only a warning for objects that should bleed but don't

        // Check 2: Text in bleed area (will be cut off)
        if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
            if (bounds.left < safeLeft || bounds.top < safeTop ||
                bounds.left + bounds.width > safeRight || bounds.top + bounds.height > safeBottom) {
                warnings.push({
                    id: `text-outside-safe-${objId}`,
                    type: 'warning',
                    code: 'TEXT_OUTSIDE_SAFE_AREA',
                    message: 'Tekst nær kanten',
                    details: 'Tekst er placeret for tæt på beskæringskanten og kan blive skåret af ved print. Flyt teksten mindst 3mm fra kanten.',
                    objectId: objId,
                    canIgnore: true,
                });
            }
        }

        // Check 3: Low resolution images
        if (obj.type === 'image') {
            const img = obj as fabric.Image;
            const element = img.getElement() as HTMLImageElement;

            if (element) {
                // Calculate effective DPI
                const scaleX = img.scaleX || 1;
                const scaleY = img.scaleY || 1;
                const displayWidthPx = (element.naturalWidth || element.width) * scaleX;
                const displayHeightPx = (element.naturalHeight || element.height) * scaleY;

                // Convert display size to mm
                const displayWidthMm = displayWidthPx / options.mmToPx;
                const displayHeightMm = displayHeightPx / options.mmToPx;

                // Calculate DPI based on original image size vs print size
                const dpiX = ((element.naturalWidth || element.width) / displayWidthMm) * 25.4;
                const dpiY = ((element.naturalHeight || element.height) / displayHeightMm) * 25.4;
                const effectiveDPI = Math.min(dpiX, dpiY);

                if (effectiveDPI < options.minDPI) {
                    errors.push({
                        id: `low-resolution-${objId}`,
                        type: 'error',
                        code: 'LOW_RESOLUTION',
                        message: `Billede har lav opløsning (${Math.round(effectiveDPI)} DPI)`,
                        details: `For at sikre skarpt print skal billedopløsningen være mindst ${options.minDPI} DPI. Dit billede har kun ${Math.round(effectiveDPI)} DPI ved denne størrelse. Gør billedet mindre eller brug et billede med højere opløsning.`,
                        objectId: objId,
                        canIgnore: true,
                    });
                } else if (effectiveDPI < options.targetDPI) {
                    warnings.push({
                        id: `medium-resolution-${objId}`,
                        type: 'warning',
                        code: 'MEDIUM_RESOLUTION',
                        message: `Billede har medium opløsning (${Math.round(effectiveDPI)} DPI)`,
                        details: `For optimal kvalitet anbefales ${options.targetDPI} DPI. Dit billede har ${Math.round(effectiveDPI)} DPI, hvilket kan give acceptable resultater.`,
                        objectId: objId,
                        canIgnore: true,
                    });
                }
            }
        }

        // Check 4: Very thin strokes (may not print well)
        if (obj.strokeWidth && obj.strokeWidth > 0 && obj.strokeWidth < 0.5) {
            warnings.push({
                id: `thin-stroke-${objId}`,
                type: 'warning',
                code: 'THIN_STROKE',
                message: 'Meget tynd streg',
                details: 'Streger tyndere end 0.5pt kan være svære at se på print. Overvej at gøre stregen tykkere.',
                objectId: objId,
                canIgnore: true,
            });
        }

        // Check 5: Objects completely outside canvas
        const canvasWidth = (options.documentWidth + options.bleed * 2) * options.mmToPx;
        const canvasHeight = (options.documentHeight + options.bleed * 2) * options.mmToPx;

        if (bounds.left + bounds.width < 0 || bounds.top + bounds.height < 0 ||
            bounds.left > canvasWidth || bounds.top > canvasHeight) {
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
    });

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
