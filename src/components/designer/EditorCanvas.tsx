import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { fabric } from 'fabric';
import { mmToPx, calculateCanvasDimensions, calculateDisplayScale } from '@/utils/unitConversions';

import { FONT_CATALOG } from './fontCatalog';
import { ensureFontLoaded } from './fontLoader';

export const AVAILABLE_FONTS = FONT_CATALOG;

export interface LayerInfo {
    id: string;
    type: string;
    name: string;
    visible: boolean;
    locked: boolean;
    object: fabric.Object;
}

export interface SelectedObjectProps {
    type: string;
    // Common
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    angle?: number;
    opacity?: number;
    fill?: string;
    stroke?: string | null;
    strokeWidth?: number;
    // Text specific
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: string;
    textAlign?: string;
    underline?: boolean;
    // Image specific
    scaleX?: number;
    scaleY?: number;
    // Bounding Box (Canvas coordinates)
    boundingRect?: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    // Rectangle specific
    rx?: number;
    ry?: number;
    // Effects
    blendMode?: string;
    shadow?: {
        enabled: boolean;
        color: string;
        blur: number;
        offsetX: number;
        offsetY: number;
        opacity: number;
    };
}

export interface EditorCanvasProps {
    width: number;
    height: number;
    bleed: number;
    dpi?: number;
    selectedTool: string;
    onSelectionChange?: (hasSelection: boolean, props?: SelectedObjectProps) => void;
    onCanvasChange?: () => void;
    onLayersChange?: (layers: LayerInfo[]) => void;
}

export interface EditorCanvasRef {
    getCanvas: () => fabric.Canvas | null;
    getJSON: () => object;
    loadJSON: (json: object) => void;
    importJSON: (json: any) => void;
    importSVG: (svgString: string) => void;
    addText: (text?: string, options?: Partial<fabric.ITextOptions>) => void;
    addImage: (url: string, sourceDpi?: number) => Promise<void>;
    addRectangle: (options?: Partial<fabric.IRectOptions>) => void;
    addCircle: (options?: Partial<fabric.ICircleOptions>) => void;
    addLine: () => void;
    addHorizontalGuide: () => void;
    addVerticalGuide: () => void;
    deleteSelected: () => void;
    duplicateSelected: () => void;
    undo: () => void;
    redo: () => void;
    exportPNG: () => string | undefined;
    exportHighResPNG: () => string | undefined;
    getLayers: () => LayerInfo[];
    selectLayer: (id: string) => void;
    moveLayerUp: (id: string) => void;
    moveLayerDown: (id: string) => void;
    toggleLayerVisibility: (id: string) => void;
    updateSelectedProps: (props: Partial<SelectedObjectProps>) => void;
    bringToFront: () => void;
    sendToBack: () => void;
}

// Display scale for showing high-DPI canvas at reasonable screen size
// Internal canvas is at full DPI resolution; we zoom out for display
const MAX_DISPLAY_WIDTH = 600;
const MAX_DISPLAY_HEIGHT = 800;

const EditorCanvas = forwardRef<EditorCanvasRef, EditorCanvasProps>(({
    width,
    height,
    bleed,
    dpi = 300,
    selectedTool,
    onSelectionChange,
    onCanvasChange,
    onLayersChange,
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);

    // Use refs for history to avoid stale closures in undo/redo
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);
    const isUndoRedo = useRef(false);
    const objectCounter = useRef(0);

    // Force re-render when history changes (for potential future UI that shows undo/redo availability)
    const [, forceUpdate] = useState(0);

    // Display DPI - the resolution at which the canvas is displayed on screen
    // 50.8 DPI = 2 pixels per mm, which gives a reasonable screen size
    const DISPLAY_DPI = 50.8;

    // Pasteboard padding - extra area around the document to show overflow content
    const pasteboardPadding = 100;

    // Calculate document dimensions for display (2px per mm)
    const { canvasWidth: docWidth, canvasHeight: docHeight, bleedPx } = calculateCanvasDimensions(
        width,
        height,
        bleed,
        DISPLAY_DPI
    );

    // Total canvas dimensions (document + pasteboard on all sides)
    const canvasWidth = docWidth + pasteboardPadding * 2;
    const canvasHeight = docHeight + pasteboardPadding * 2;

    // Safe area in pixels at display DPI (typically 3mm from trim)
    const safeAreaPx = Math.round(mmToPx(3, DISPLAY_DPI));

    // Get selected object properties
    const getSelectedProps = useCallback((obj: fabric.Object): SelectedObjectProps => {
        const props: SelectedObjectProps = {
            type: obj.type || 'object',
            left: Math.round(obj.left || 0),
            top: Math.round(obj.top || 0),
            width: Math.round((obj.width || 0) * (obj.scaleX || 1)),
            height: Math.round((obj.height || 0) * (obj.scaleY || 1)),
            angle: Math.round(obj.angle || 0),
            opacity: obj.opacity,
            fill: typeof obj.fill === 'string' ? obj.fill : undefined,
            stroke: obj.stroke || undefined,
            strokeWidth: obj.strokeWidth,
            blendMode: (obj.globalCompositeOperation as string) || 'source-over',
        };

        const rect = obj.getBoundingRect();
        props.boundingRect = {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        };

        // Shadow extraction
        const activeShadow = obj.shadow as fabric.Shadow;
        if (activeShadow) {
            const color = new fabric.Color((activeShadow.color as string) || '#000000');
            props.shadow = {
                enabled: true,
                color: color.toHex() ? `#${color.toHex()}` : '#000000',
                blur: activeShadow.blur || 0,
                offsetX: activeShadow.offsetX || 0,
                offsetY: activeShadow.offsetY || 0,
                opacity: color.getAlpha() ?? 1
            };
        } else {
            props.shadow = {
                enabled: false,
                color: '#000000',
                blur: 8,
                offsetX: 4,
                offsetY: 4,
                opacity: 0.35
            };
        }

        if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
            const textObj = obj as fabric.IText;
            props.text = textObj.text;
            props.fontFamily = textObj.fontFamily;
            props.fontSize = textObj.fontSize;
            props.fontWeight = textObj.fontWeight;
            props.fontStyle = textObj.fontStyle;
            props.textAlign = textObj.textAlign;
            props.underline = textObj.underline;
        }

        if (obj.type === 'image') {
            props.scaleX = obj.scaleX;
            props.scaleY = obj.scaleY;
        }

        if (obj.type === 'rect') {
            const rectObj = obj as fabric.Rect;
            props.rx = rectObj.rx || 0;
            props.ry = rectObj.ry || 0;
        }

        return props;
    }, []);

    // Emit layers update
    const emitLayersUpdate = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        const objects = canvas.getObjects();
        const layers: LayerInfo[] = objects.map((obj, index) => {
            let name = obj.type || 'Object';
            if (obj.type === 'i-text' || obj.type === 'text') {
                const text = (obj as fabric.IText).text || '';
                name = text.substring(0, 20) + (text.length > 20 ? '...' : '');
            } else if (obj.type === 'rect') {
                name = 'Rektangel';
            } else if (obj.type === 'circle') {
                name = 'Cirkel';
            } else if (obj.type === 'line') {
                name = 'Linje';
            } else if (obj.type === 'image') {
                name = 'Billede';
            }

            return {
                id: (obj as any).__layerId || `layer-${index}`,
                type: obj.type || 'object',
                name,
                visible: obj.visible !== false,
                locked: obj.lockMovementX === true,
                object: obj,
            };
        }).reverse(); // Reverse so top layer is first

        onLayersChange?.(layers);
    }, [onLayersChange]);

    // Initialize Fabric.js canvas
    useEffect(() => {
        if (!canvasRef.current || fabricRef.current) return;

        const canvas = new fabric.Canvas(canvasRef.current, {
            width: canvasWidth,
            height: canvasHeight,
            backgroundColor: '#9ca3af', // Gray pasteboard background
            selection: true,
            preserveObjectStacking: true,
        });

        // Draw the white document area on top of gray background
        const documentRect = new fabric.Rect({
            left: pasteboardPadding,
            top: pasteboardPadding,
            width: docWidth,
            height: docHeight,
            fill: '#ffffff',
            selectable: false,
            evented: false,
            excludeFromExport: false,
        });
        // Add custom property to identify this as the document background
        (documentRect as any).__isDocumentBackground = true;
        canvas.add(documentRect);
        canvas.sendToBack(documentRect);

        fabricRef.current = canvas;

        // Selection events
        canvas.on('selection:created', (e) => {
            const obj = e.selected?.[0];
            if (obj) {
                onSelectionChange?.(true, getSelectedProps(obj));
            }
        });
        canvas.on('selection:updated', (e) => {
            const obj = e.selected?.[0];
            if (obj) {
                onSelectionChange?.(true, getSelectedProps(obj));
            }
        });
        // Live updates during interaction
        canvas.on('object:scaling', (e) => {
            if (e.target) {
                onSelectionChange?.(true, getSelectedProps(e.target));
            }
        });
        canvas.on('object:moving', (e) => {
            if (e.target) {
                onSelectionChange?.(true, getSelectedProps(e.target));
            }
        });
        canvas.on('object:rotating', (e) => {
            if (e.target) {
                onSelectionChange?.(true, getSelectedProps(e.target));
            }
        });

        canvas.on('selection:cleared', () => {
            onSelectionChange?.(false);
        });

        // Object modified - update properties
        canvas.on('object:modified', (e) => {
            if (e.target) {
                onSelectionChange?.(true, getSelectedProps(e.target));
            }
            if (!isUndoRedo.current) {
                saveHistory();
            }
            onCanvasChange?.();
            emitLayersUpdate();
        });

        // History tracking
        canvas.on('object:added', (e) => {
            // Assign layer ID
            if (e.target && !(e.target as any).__layerId) {
                (e.target as any).__layerId = `layer-${objectCounter.current++}`;
            }
            if (!isUndoRedo.current) {
                saveHistory();
            }
            onCanvasChange?.();
            emitLayersUpdate();
        });

        canvas.on('object:removed', () => {
            if (!isUndoRedo.current) {
                saveHistory();
            }
            onCanvasChange?.();
            emitLayersUpdate();
        });

        // Initial history state
        saveHistory();

        return () => {
            canvas.dispose();
            fabricRef.current = null;
        };
    }, [canvasWidth, canvasHeight]);

    // Save current state to history
    const saveHistory = useCallback(() => {
        if (!fabricRef.current || isUndoRedo.current) return;

        const json = JSON.stringify(fabricRef.current.toJSON(['__layerId']));

        // Trim history to current position (discards any redo states)
        const currentIndex = historyIndexRef.current;
        const newHistory = historyRef.current.slice(0, currentIndex + 1);
        newHistory.push(json);

        // Keep max 50 states
        if (newHistory.length > 50) {
            newHistory.shift();
            historyRef.current = newHistory;
            historyIndexRef.current = newHistory.length - 1;
        } else {
            historyRef.current = newHistory;
            historyIndexRef.current = newHistory.length - 1;
        }

        // Trigger re-render for UI updates
        forceUpdate(n => n + 1);
    }, []);

    // Handle tool changes
    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        canvas.isDrawingMode = false;
        canvas.defaultCursor = 'default';

        switch (selectedTool) {
            case 'select':
                canvas.selection = true;
                break;
            case 'text':
                canvas.defaultCursor = 'text';
                canvas.selection = false;
                break;
            case 'rectangle':
            case 'circle':
            case 'line':
                canvas.defaultCursor = 'crosshair';
                canvas.selection = false;
                break;
            default:
                canvas.selection = true;
        }
    }, [selectedTool]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        getCanvas: () => fabricRef.current,

        getJSON: () => {
            return fabricRef.current?.toJSON(['__layerId']) || {};
        },

        loadJSON: (json: object) => {
            fabricRef.current?.loadFromJSON(json, () => {
                fabricRef.current?.renderAll();
                emitLayersUpdate();
                // When we load a full JSON (Replace document), we should reset history to this point
                historyRef.current = [JSON.stringify(fabricRef.current?.toJSON(['__layerId']))];
                historyIndexRef.current = 0;
            });
        },

        importJSON: (json: any) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const data = typeof json === 'string' ? JSON.parse(json) : json;
            const objects = data.objects || [];

            fabric.util.enlivenObjects(objects, (enlivenedObjects: fabric.Object[]) => {
                if (enlivenedObjects.length === 1) {
                    const obj = enlivenedObjects[0];
                    obj.set({
                        left: canvasWidth / 2,
                        top: canvasHeight / 2,
                        originX: 'center',
                        originY: 'center',
                    });
                    canvas.add(obj);
                    canvas.setActiveObject(obj);
                } else if (enlivenedObjects.length > 1) {
                    const group = new fabric.Group(enlivenedObjects, {
                        left: canvasWidth / 2,
                        top: canvasHeight / 2,
                        originX: 'center',
                        originY: 'center',
                    });
                    canvas.add(group);
                    canvas.setActiveObject(group);
                }

                canvas.renderAll();
                emitLayersUpdate();
                saveHistory();
            }, 'fabric');
        },

        importSVG: (svgString: string) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            fabric.loadSVGFromString(svgString, (objects, options) => {
                const obj = fabric.util.groupSVGElements(objects, options);

                // SVGs are typically 96 DPI. Scale to our DISPLAY_DPI (50.8)
                const physicalScale = DISPLAY_DPI / 96;
                let scale = physicalScale;

                // Safety: If SVG is larger than 90% of the document, scale it down to fit
                const maxWidth = docWidth * 0.9;
                const maxHeight = docHeight * 0.9;
                if ((obj.width || 0) * scale > maxWidth || (obj.height || 0) * scale > maxHeight) {
                    scale = Math.min(maxWidth / (obj.width || 1), maxHeight / (obj.height || 1));
                    console.log(`[Editor] SVG too large, downscaling to fit.`);
                }

                obj.set({
                    left: canvasWidth / 2,
                    top: canvasHeight / 2,
                    originX: 'center',
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale
                });

                canvas.add(obj);
                canvas.setActiveObject(obj);
                canvas.renderAll();
                emitLayersUpdate();
                saveHistory();
            });
        },

        addText: (text = 'Dobbeltklik for at redigere', options = {}) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const textObj = new fabric.IText(text, {
                left: canvasWidth / 2,
                top: canvasHeight / 2,
                originX: 'center',
                originY: 'center',
                fontFamily: 'Inter, Arial, sans-serif',
                fontSize: 24,
                fill: '#000000',
                editable: true,
                ...options,
            });

            canvas.add(textObj);
            canvas.setActiveObject(textObj);
            canvas.renderAll();
        },

        addImage: async (url: string, sourceDpi?: number) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            return new Promise((resolve) => {
                fabric.Image.fromURL(url, (img) => {
                    if (img.width && img.height) {
                        if (sourceDpi) {
                            // Calculate scale to maintain physical size
                            // Internal canvas is at DISPLAY_DPI
                            const scale = DISPLAY_DPI / sourceDpi;
                            img.scale(scale);
                            console.log(`[Editor] Scaling image physically: ${sourceDpi} DPI -> ${DISPLAY_DPI} DPI (Scale: ${scale.toFixed(4)})`);
                        } else {
                            // Fallback: Use document DPI to determine physical size
                            const scale = DISPLAY_DPI / dpi;
                            img.scale(scale);

                            // Safety: If image is still larger than document, cap it to 80%
                            if (img.width * scale > docWidth || img.height * scale > docHeight) {
                                const fitScale = Math.min((docWidth * 0.8) / img.width, (docHeight * 0.8) / img.height);
                                img.scale(fitScale);
                            }
                        }
                    }

                    img.set({
                        left: canvasWidth / 2,
                        top: canvasHeight / 2,
                        originX: 'center',
                        originY: 'center',
                    });

                    canvas.add(img);
                    canvas.setActiveObject(img);
                    canvas.renderAll();
                    resolve();
                }, { crossOrigin: 'anonymous' });
            });
        },

        addRectangle: (options = {}) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const rect = new fabric.Rect({
                left: canvasWidth / 2,
                top: canvasHeight / 2,
                originX: 'center',
                originY: 'center',
                width: 100,
                height: 60,
                fill: '#3b82f6',
                stroke: null,      // No border by default
                strokeWidth: 0,    // No border by default
                rx: 0,             // Sharp corners by default
                ry: 0,             // Sharp corners by default
                ...options,
            });

            canvas.add(rect);
            canvas.setActiveObject(rect);
            canvas.renderAll();
        },

        addCircle: (options = {}) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const circle = new fabric.Circle({
                left: canvasWidth / 2,
                top: canvasHeight / 2,
                originX: 'center',
                originY: 'center',
                radius: 50,
                fill: '#10b981',
                stroke: '#047857',
                strokeWidth: 2,
                ...options,
            });

            canvas.add(circle);
            canvas.setActiveObject(circle);
            canvas.renderAll();
        },

        addLine: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const line = new fabric.Line([
                canvasWidth / 2 - 60,
                canvasHeight / 2,
                canvasWidth / 2 + 60,
                canvasHeight / 2,
            ], {
                stroke: '#000000',
                strokeWidth: 3,
                originX: 'center',
                originY: 'center',
            });

            canvas.add(line);
            canvas.setActiveObject(line);
            canvas.renderAll();
        },

        // Horizontal ruler/guide line (for folds, etc.) - non-printing
        addHorizontalGuide: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            // Create the guide line spanning the document width
            const guideY = canvasHeight / 2;
            const line = new fabric.Line([
                pasteboardPadding,           // Start at document left edge
                guideY,
                pasteboardPadding + docWidth, // End at document right edge
                guideY,
            ], {
                stroke: '#ff00ff',           // Magenta for visibility (overprint color)
                strokeWidth: 1,
                strokeDashArray: [8, 4],     // Dashed line
                selectable: true,
                evented: true,
                lockRotation: true,          // Can't rotate
                lockScalingX: true,          // Can't scale
                lockScalingY: true,
                lockMovementX: true,         // Can only move vertically
                hasControls: false,          // No resize handles
                hasBorders: true,
                excludeFromExport: true,     // Non-printing!
            });

            // Mark as guide line
            (line as any).__isGuide = true;
            (line as any).__guideType = 'horizontal';

            // Create measurement label
            const distanceFromBottom = docHeight - (guideY - pasteboardPadding);
            const distanceMM = Math.round(distanceFromBottom / (DISPLAY_DPI / 25.4) * 10) / 10;
            const label = new fabric.Text(`${distanceMM} mm`, {
                fontSize: 10,
                fill: '#ff00ff',
                fontFamily: 'Arial, sans-serif',
                left: pasteboardPadding + 5,
                top: guideY - 14,
                selectable: false,
                evented: false,
                excludeFromExport: true,
            });
            (label as any).__isGuideLabel = true;
            (label as any).__parentGuide = (line as any).__layerId;

            // Group line and label
            const group = new fabric.Group([line, label], {
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                lockMovementX: true,
                hasControls: false,
                hasBorders: true,
                excludeFromExport: true,
            });
            (group as any).__isGuide = true;
            (group as any).__guideType = 'horizontal';

            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.renderAll();

            // Update label on move
            group.on('moving', () => {
                const newY = group.top! + group.height! / 2;
                const newDistFromBottom = docHeight - (newY - pasteboardPadding);
                const newDistMM = Math.round(newDistFromBottom / (DISPLAY_DPI / 25.4) * 10) / 10;
                label.set('text', `${newDistMM} mm`);
                canvas.renderAll();
            });
        },

        // Vertical ruler/guide line (for folds, etc.) - non-printing
        addVerticalGuide: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            // Create the guide line spanning the document height
            const guideX = canvasWidth / 2;
            const line = new fabric.Line([
                guideX,
                pasteboardPadding,            // Start at document top edge
                guideX,
                pasteboardPadding + docHeight, // End at document bottom edge
            ], {
                stroke: '#ff00ff',            // Magenta for visibility
                strokeWidth: 1,
                strokeDashArray: [8, 4],      // Dashed line
                selectable: true,
                evented: true,
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                lockMovementY: true,          // Can only move horizontally
                hasControls: false,
                hasBorders: true,
                excludeFromExport: true,      // Non-printing!
            });

            (line as any).__isGuide = true;
            (line as any).__guideType = 'vertical';

            // Create measurement label
            const distanceFromLeft = guideX - pasteboardPadding;
            const distanceMM = Math.round(distanceFromLeft / (DISPLAY_DPI / 25.4) * 10) / 10;
            const label = new fabric.Text(`${distanceMM} mm`, {
                fontSize: 10,
                fill: '#ff00ff',
                fontFamily: 'Arial, sans-serif',
                left: guideX + 5,
                top: pasteboardPadding + 5,
                selectable: false,
                evented: false,
                excludeFromExport: true,
                angle: 0,
            });
            (label as any).__isGuideLabel = true;

            // Group line and label
            const group = new fabric.Group([line, label], {
                lockRotation: true,
                lockScalingX: true,
                lockScalingY: true,
                lockMovementY: true,
                hasControls: false,
                hasBorders: true,
                excludeFromExport: true,
            });
            (group as any).__isGuide = true;
            (group as any).__guideType = 'vertical';

            canvas.add(group);
            canvas.setActiveObject(group);
            canvas.renderAll();

            // Update label on move
            group.on('moving', () => {
                const newX = group.left! + group.width! / 2;
                const newDistFromLeft = newX - pasteboardPadding;
                const newDistMM = Math.round(newDistFromLeft / (DISPLAY_DPI / 25.4) * 10) / 10;
                label.set('text', `${newDistMM} mm`);
                canvas.renderAll();
            });
        },

        deleteSelected: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const activeObjects = canvas.getActiveObjects();
            if (activeObjects.length) {
                activeObjects.forEach((obj) => canvas.remove(obj));
                canvas.discardActiveObject();
                canvas.renderAll();
            }
        },

        duplicateSelected: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const activeObjects = canvas.getActiveObjects();
            if (activeObjects.length === 0) return;

            // Clone each selected object
            const clonePromises = activeObjects.map((obj) => {
                return new Promise<fabric.Object>((resolve) => {
                    obj.clone((cloned: fabric.Object) => {
                        // Offset the clone slightly so it's visible
                        cloned.set({
                            left: (cloned.left || 0) + 20,
                            top: (cloned.top || 0) + 20,
                            evented: true,
                        });
                        resolve(cloned);
                    });
                });
            });

            Promise.all(clonePromises).then((clones) => {
                canvas.discardActiveObject();

                clones.forEach((clone) => {
                    canvas.add(clone);
                });

                // Select the new clones
                if (clones.length === 1) {
                    canvas.setActiveObject(clones[0]);
                } else {
                    const selection = new fabric.ActiveSelection(clones, { canvas });
                    canvas.setActiveObject(selection);
                }

                canvas.renderAll();
            });
        },

        undo: () => {
            const canvas = fabricRef.current;
            const currentIndex = historyIndexRef.current;
            const history = historyRef.current;

            if (!canvas || currentIndex <= 0) return;

            isUndoRedo.current = true;
            const newIndex = currentIndex - 1;
            const state = history[newIndex];

            if (!state) {
                isUndoRedo.current = false;
                return;
            }

            canvas.loadFromJSON(JSON.parse(state), () => {
                canvas.renderAll();
                historyIndexRef.current = newIndex;
                isUndoRedo.current = false;
                emitLayersUpdate();
                forceUpdate(n => n + 1);
            });
        },

        redo: () => {
            const canvas = fabricRef.current;
            const currentIndex = historyIndexRef.current;
            const history = historyRef.current;

            if (!canvas || currentIndex >= history.length - 1) return;

            isUndoRedo.current = true;
            const newIndex = currentIndex + 1;
            const state = history[newIndex];

            if (!state) {
                isUndoRedo.current = false;
                return;
            }

            canvas.loadFromJSON(JSON.parse(state), () => {
                canvas.renderAll();
                historyIndexRef.current = newIndex;
                isUndoRedo.current = false;
                emitLayersUpdate();
                forceUpdate(n => n + 1);
            });
        },

        exportPNG: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            return canvas.toDataURL({
                format: 'png',
                quality: 1,
            });
        },

        exportHighResPNG: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            // Calculate multiplier for target DPI
            // Screen is ~96 DPI, target is 300 DPI
            const multiplier = dpi / 96;

            return canvas.toDataURL({
                format: 'png',
                quality: 1,
                multiplier,
            });
        },

        getLayers: () => {
            const canvas = fabricRef.current;
            if (!canvas) return [];

            const objects = canvas.getObjects();
            return objects.map((obj, index) => {
                let name = obj.type || 'Object';
                if (obj.type === 'i-text' || obj.type === 'text') {
                    const text = (obj as fabric.IText).text || '';
                    name = text.substring(0, 20) + (text.length > 20 ? '...' : '');
                }

                return {
                    id: (obj as any).__layerId || `layer-${index}`,
                    type: obj.type || 'object',
                    name,
                    visible: obj.visible !== false,
                    locked: obj.lockMovementX === true,
                    object: obj,
                };
            }).reverse();
        },

        selectLayer: (id: string) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const obj = canvas.getObjects().find((o) => (o as any).__layerId === id);
            if (obj) {
                canvas.setActiveObject(obj);
                canvas.renderAll();
            }
        },

        moveLayerUp: (id: string) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const obj = canvas.getObjects().find((o) => (o as any).__layerId === id);
            if (obj) {
                canvas.bringForward(obj);
                canvas.renderAll();
                emitLayersUpdate();
            }
        },

        moveLayerDown: (id: string) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const obj = canvas.getObjects().find((o) => (o as any).__layerId === id);
            if (obj) {
                canvas.sendBackwards(obj);
                canvas.renderAll();
                emitLayersUpdate();
            }
        },

        toggleLayerVisibility: (id: string) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const obj = canvas.getObjects().find((o) => (o as any).__layerId === id);
            if (obj) {
                obj.visible = !obj.visible;
                canvas.renderAll();
                emitLayersUpdate();
            }
        },

        updateSelectedProps: (props: Partial<SelectedObjectProps>) => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const activeObj = canvas.getActiveObject();
            if (!activeObj) return;

            // Apply properties
            if (props.fill !== undefined) activeObj.set('fill', props.fill);
            if (props.stroke !== undefined) activeObj.set('stroke', props.stroke);
            if (props.strokeWidth !== undefined) activeObj.set('strokeWidth', props.strokeWidth);
            if (props.opacity !== undefined) activeObj.set('opacity', props.opacity);
            if (props.blendMode !== undefined) activeObj.set('globalCompositeOperation', props.blendMode as any);

            // Shadow
            if (props.shadow !== undefined) {
                if (props.shadow.enabled) {
                    const colorInstance = new fabric.Color(props.shadow.color || '#000000');
                    colorInstance.setAlpha(props.shadow.opacity !== undefined ? props.shadow.opacity : 1);
                    const shadowColor = colorInstance.toRgba();

                    activeObj.set('shadow', new fabric.Shadow({
                        color: shadowColor,
                        blur: props.shadow.blur !== undefined ? props.shadow.blur : 8,
                        offsetX: props.shadow.offsetX !== undefined ? props.shadow.offsetX : 4,
                        offsetY: props.shadow.offsetY !== undefined ? props.shadow.offsetY : 4
                    }));
                } else {
                    activeObj.set('shadow', null);
                }
            }

            // Text properties
            if (activeObj.type === 'i-text' || activeObj.type === 'text') {
                const textObj = activeObj as fabric.IText;

                const updateText = async () => {
                    if (props.fontFamily !== undefined) {
                        // Find the font ID from the family name if possible
                        const font = FONT_CATALOG.find(f => f.family === props.fontFamily);
                        if (font) {
                            await ensureFontLoaded(
                                font.id,
                                (props.fontWeight as number) || (textObj.fontWeight as number) || 400,
                                (props.fontStyle === 'italic') || (textObj.fontStyle === 'italic')
                            );
                        }
                        textObj.set('fontFamily', props.fontFamily);
                    }

                    if (props.fontSize !== undefined) textObj.set('fontSize', props.fontSize);
                    if (props.fontWeight !== undefined) {
                        const font = FONT_CATALOG.find(f => f.family === (props.fontFamily || textObj.fontFamily));
                        if (font) {
                            await ensureFontLoaded(
                                font.id,
                                props.fontWeight as number,
                                (props.fontStyle === 'italic') || (textObj.fontStyle === 'italic')
                            );
                        }
                        textObj.set('fontWeight', props.fontWeight);
                    }
                    if (props.fontStyle !== undefined) {
                        const font = FONT_CATALOG.find(f => f.family === (props.fontFamily || textObj.fontFamily));
                        if (font) {
                            await ensureFontLoaded(
                                font.id,
                                (props.fontWeight as number) || (textObj.fontWeight as number) || 400,
                                props.fontStyle === 'italic'
                            );
                        }
                        textObj.set('fontStyle', props.fontStyle as any);
                    }
                    if (props.textAlign !== undefined) textObj.set('textAlign', props.textAlign);
                    if (props.underline !== undefined) textObj.set('underline', props.underline);

                    canvas.renderAll();
                    onCanvasChange?.();
                    onSelectionChange?.(true, getSelectedProps(activeObj));
                };

                updateText();
                return; // Exit early as we handle render/emit inside async
            }

            // Rectangle properties
            if (activeObj.type === 'rect') {
                const rectObj = activeObj as fabric.Rect;
                if (props.rx !== undefined) {
                    rectObj.set('rx', props.rx);
                    rectObj.set('ry', props.rx); // Keep rx and ry in sync
                }
                if (props.ry !== undefined) {
                    rectObj.set('ry', props.ry);
                    rectObj.set('rx', props.ry); // Keep rx and ry in sync
                }
            }

            canvas.renderAll();
            onCanvasChange?.();

            // Emit updated props
            onSelectionChange?.(true, getSelectedProps(activeObj));
        },

        bringToFront: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const activeObj = canvas.getActiveObject();
            if (activeObj) {
                canvas.bringToFront(activeObj);
                canvas.renderAll();
                emitLayersUpdate();
            }
        },

        sendToBack: () => {
            const canvas = fabricRef.current;
            if (!canvas) return;

            const activeObj = canvas.getActiveObject();
            if (activeObj) {
                canvas.sendToBack(activeObj);
                canvas.renderAll();
                emitLayersUpdate();
            }
        },
    }));
    // bleedPx, safeAreaPx, and pasteboardPadding are already calculated at the top of the component

    return (
        <div className="relative inline-block">
            {/* Fabric canvas (includes pasteboard + document area) */}
            <canvas ref={canvasRef} />

            {/* Dimming overlay - covers pasteboard area to gray out overflow content */}
            {/* These 4 divs create a "frame" around the document that dims content in the pasteboard */}
            {/* Top overlay */}
            <div
                className="absolute pointer-events-none bg-neutral-500/50"
                style={{
                    top: 0,
                    left: 0,
                    width: canvasWidth,
                    height: pasteboardPadding,
                    zIndex: 10,
                }}
            />
            {/* Bottom overlay */}
            <div
                className="absolute pointer-events-none bg-neutral-500/50"
                style={{
                    bottom: 0,
                    left: 0,
                    width: canvasWidth,
                    height: pasteboardPadding,
                    zIndex: 10,
                }}
            />
            {/* Left overlay */}
            <div
                className="absolute pointer-events-none bg-neutral-500/50"
                style={{
                    top: pasteboardPadding,
                    left: 0,
                    width: pasteboardPadding,
                    height: docHeight,
                    zIndex: 10,
                }}
            />
            {/* Right overlay */}
            <div
                className="absolute pointer-events-none bg-neutral-500/50"
                style={{
                    top: pasteboardPadding,
                    right: 0,
                    width: pasteboardPadding,
                    height: docHeight,
                    zIndex: 10,
                }}
            />

            {/* Trim line - outer document edge where paper will be cut (blue) */}
            <div
                className="absolute pointer-events-none border-2 border-blue-500"
                style={{
                    top: pasteboardPadding,
                    left: pasteboardPadding,
                    width: docWidth,
                    height: docHeight,
                    zIndex: 20,
                }}
            />

            {/* Bleed line - 3mm inside trim, content should extend beyond this (red dashed) */}
            <div
                className="absolute pointer-events-none border-2 border-dashed border-red-400/80"
                style={{
                    top: pasteboardPadding + bleedPx,
                    left: pasteboardPadding + bleedPx,
                    width: docWidth - bleedPx * 2,
                    height: docHeight - bleedPx * 2,
                    zIndex: 20,
                }}
            />

            {/* Safe area - content should stay inside this (green dashed) */}
            <div
                className="absolute pointer-events-none border border-dashed border-green-500/60"
                style={{
                    top: pasteboardPadding + bleedPx + safeAreaPx,
                    left: pasteboardPadding + bleedPx + safeAreaPx,
                    width: docWidth - (bleedPx + safeAreaPx) * 2,
                    height: docHeight - (bleedPx + safeAreaPx) * 2,
                    zIndex: 20,
                }}
            />

            {/* Legend - positioned outside artwork in pasteboard area */}
            <div
                className="absolute text-xs bg-white/90 rounded px-2 py-1 flex gap-3 pointer-events-none shadow-sm"
                style={{
                    bottom: 8,
                    right: 8,
                    zIndex: 25,
                }}
            >
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-blue-500"></span>
                    Trim
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-red-400"></span>
                    Bleed
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-green-500"></span>
                    Safe
                </span>
            </div>

            {/* Overflow indicator label */}
            <div
                className="absolute text-xs text-white/70 pointer-events-none"
                style={{
                    top: 6,
                    left: 8,
                    zIndex: 20,
                }}
            >
                ↑ Overflow (vil blive skåret væk)
            </div>
        </div>
    );
});

EditorCanvas.displayName = 'EditorCanvas';

export default EditorCanvas;
