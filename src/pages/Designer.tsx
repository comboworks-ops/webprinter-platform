import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import {
    OUTPUT_PROFILES,
    SRGB_PROFILE_URL
} from "@/lib/color/iccProofing";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EditorCanvas, { EditorCanvasRef, LayerInfo, SelectedObjectProps } from "@/components/designer/EditorCanvas";
import { fabric } from 'fabric';
import LayerPanel from "@/components/designer/LayerPanel";
import PropertiesPanel from "@/components/designer/PropertiesPanel";
import PreflightPanel from "@/components/designer/PreflightPanel";
import ColorProofingPanel from "@/components/designer/ColorProofingPanel";
import PDFImportModal, { PDFImportData } from "@/components/designer/PDFImportModal";
import { DesignLibraryDrawer } from "@/components/designer/DesignLibraryDrawer";
import { ExportDialog } from "@/components/designer/ExportDialog";
import { runDesignerExport } from "@/lib/designer/export/exportActions";
import type { ExportOptions } from "@/lib/designer/export/types";
import { mmToPx } from "@/utils/unitConversions";
import { runPreflightChecks, PreflightWarning } from "@/utils/preflightChecks";
import { useColorProofing } from "@/hooks/useColorProofing";
import { useProductColorProfile } from "@/hooks/useProductColorProfile";
import { getImageDpi } from "@/utils/imageMetadata";
import {
    Loader2,
    ArrowLeft,
    Save,
    Download,
    AlertTriangle,
    Type,
    Image as ImageIcon,
    Square,
    Circle,
    Minus,
    Undo2,
    Redo2,
    MousePointer2,
    FileUp,
    Settings2,
    Trash2,
    Upload,
    FileCheck,
    ShoppingCart,
    Palette,
    Copy,
    LayoutGrid,
    Ruler,
    GripHorizontal,
    GripVertical,
    ZoomIn,
    ZoomOut,
    Hand,
    Maximize
} from "lucide-react";
import { toast } from "sonner";

// Display DPI for the designer canvas (50.8 DPI = 2 pixels per mm)
// This provides a reasonable screen size while maintaining correct proportions
const DISPLAY_DPI = 50.8;
const MM_TO_PX = DISPLAY_DPI / 25.4; // ≈ 2 pixels per mm

const STANDARD_FORMATS: Record<string, { width: number; height: number; bleed?: number }> = {
    "A0": { width: 841, height: 1189 },
    "A1": { width: 594, height: 841 },
    "A2": { width: 420, height: 594 },
    "A3": { width: 297, height: 420 },
    "A4": { width: 210, height: 297 },
    "A5": { width: 148, height: 210 },
    "A6": { width: 105, height: 148 },
    "A7": { width: 74, height: 105 },
    "M65": { width: 99, height: 210 },
    "M50": { width: 120, height: 175 },
    "85x55": { width: 85, height: 55 },
    "standard": { width: 85, height: 55 },
    "50x50": { width: 50, height: 50 },
    "80x50": { width: 80, height: 50 },
    "100x70": { width: 100, height: 70 },
};

export function Designer() {
    const queryClient = useQueryClient();
    const { variantId } = useParams<{ variantId?: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const editorRef = useRef<EditorCanvasRef>(null);
    const proofingOverlayRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const autoPreflightTimerRef = useRef<NodeJS.Timeout | null>(null);

    const productId = searchParams.get("productId");
    const templateId = searchParams.get("templateId");
    const designId = searchParams.get("designId");
    const format = searchParams.get("format");
    const variant = searchParams.get("variant");

    // State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [layers, setLayers] = useState<LayerInfo[]>([]);
    const [selectedProps, setSelectedProps] = useState<SelectedObjectProps | null>(null);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [documentSpec, setDocumentSpec] = useState({
        name: "Uden titel",
        width_mm: 210,
        height_mm: 297,
        bleed_mm: 3,
        dpi: 300,
        color_profile: "FOGRA39",
        template_id: null as string | null,
        product_id: null as string | null,
        preview_thumbnail_url: null as string | null,
        tenant_id: null as string | null,
        format: null as string | null,
    });
    const [selectedTool, setSelectedTool] = useState<string>("select");
    const [activeTab, setActiveTab] = useState<'layers' | 'properties' | 'preflight' | 'proofing'>('layers');

    // PDF Import
    const [showPDFImport, setShowPDFImport] = useState(false);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const dragCounterRef = useRef(0);

    // Preflight
    const [preflightWarnings, setPreflightWarnings] = useState<PreflightWarning[]>([]);
    const [preflightErrors, setPreflightErrors] = useState<PreflightWarning[]>([]);
    const [preflightInfos, setPreflightInfos] = useState<PreflightWarning[]>([]);
    const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);

    // Show landing page when no parameters are provided
    const showLanding = !variantId && !productId && !templateId && !designId && !format;

    // Unsaved changes navigation guard
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

    // Save dialog for naming new designs
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveDesignName, setSaveDesignName] = useState("");
    const [savedDesignId, setSavedDesignId] = useState<string | null>(null);
    const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);

    // Color Proofing & Profiles
    const { profile: productProfile } = useProductColorProfile({ productId });

    const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
    const PASTEBOARD_PADDING = 100;

    // Poll for canvas initialization
    useEffect(() => {
        if (fabricCanvas) return;
        const interval = setInterval(() => {
            const canvas = editorRef.current?.getCanvas();
            if (canvas) {
                setFabricCanvas(canvas);
                clearInterval(interval);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [fabricCanvas]);

    // Calculate dimensions for proofing overlay matching EditorCanvas logic
    // We use standard variable names to match usage later in the file
    const docWidth = mmToPx(documentSpec.width_mm + (documentSpec.bleed_mm * 2), DISPLAY_DPI);
    const docHeight = mmToPx(documentSpec.height_mm + (documentSpec.bleed_mm * 2), DISPLAY_DPI);
    const canvasWidth = Math.round(docWidth + (PASTEBOARD_PADDING * 2));
    const canvasHeight = Math.round(docHeight + (PASTEBOARD_PADDING * 2));

    const colorProofing = useColorProofing({
        fabricCanvas,
        overlayCanvasRef: proofingOverlayRef,
        canvasWidth,
        canvasHeight,
        docWidth: Math.round(docWidth),
        docHeight: Math.round(docHeight),
        pasteboardOffset: PASTEBOARD_PADDING,
        customProfileId: productProfile.id || undefined,
        customProfileName: productProfile.name || undefined,
        customProfileBytes: productProfile.profileBytes,
    });

    // Load spec
    useEffect(() => {
        const loadSpec = async () => {
            try {
                setLoading(true);

                if (designId) {
                    // Skip reloading if this is the design we just saved
                    if (savedDesignId === designId) {
                        setLoading(false);
                        return;
                    }

                    const { data: design, error } = await supabase
                        .from('designer_saved_designs' as any)
                        .select('*')
                        .eq('id', designId)
                        .single();

                    if (design && !error) {
                        setDocumentSpec({
                            name: (design as any).name,
                            width_mm: (design as any).width_mm,
                            height_mm: (design as any).height_mm,
                            bleed_mm: (design as any).bleed_mm || 3,
                            dpi: (design as any).dpi || 300,
                            color_profile: (design as any).color_profile || "FOGRA39",
                            template_id: (design as any).template_id,
                            product_id: (design as any).product_id,
                            preview_thumbnail_url: (design as any).preview_thumbnail_url,
                            tenant_id: (design as any).tenant_id,
                            format: null,
                        });
                        setTimeout(() => {
                            if ((design as any).editor_json && editorRef.current) {
                                editorRef.current.loadJSON((design as any).editor_json);
                            }
                        }, 100);
                        setLoading(false);
                        return;
                    }
                }

                if (format && STANDARD_FORMATS[format.toUpperCase()]) {
                    const dims = STANDARD_FORMATS[format.toUpperCase()];
                    let productName = format.toUpperCase();

                    if (productId) {
                        const { data: product } = await supabase
                            .from('products')
                            .select('name')
                            .eq('id', productId)
                            .single();
                        if (product) {
                            productName = `${product.name} - ${format.toUpperCase()}`;
                        }
                    }

                    setDocumentSpec(prev => ({
                        ...prev,
                        name: `Design: ${productName}`,
                        width_mm: dims.width,
                        height_mm: dims.height,
                        bleed_mm: dims.bleed || 3,
                        product_id: productId,
                        format: format.toUpperCase(),
                    }));
                    setLoading(false);
                    return;
                }

                if (productId || variantId) {
                    const pid = productId || variantId;
                    const { data: product, error } = await supabase
                        .from('products')
                        .select('id, name, technical_specs')
                        .eq('id', pid)
                        .single();

                    if (product && !error) {
                        const specs = product.technical_specs as any || {};
                        setDocumentSpec(prev => ({
                            ...prev,
                            name: `Design til ${product.name}`,
                            width_mm: specs.width_mm || 210,
                            height_mm: specs.height_mm || 297,
                            bleed_mm: specs.bleed_mm || 3,
                            dpi: specs.min_dpi || 300,
                            color_profile: productProfile.name || "FOGRA39",
                            product_id: product.id,
                            format: format?.toUpperCase() || null,
                        }));
                        setLoading(false);
                        return;
                    }
                }

                if (templateId) {
                    const { data: template, error } = await supabase
                        .from('designer_templates' as any)
                        .select('*')
                        .eq('id', templateId)
                        .single();

                    if (template && !error) {
                        setDocumentSpec(prev => ({
                            ...prev,
                            name: `Design: ${(template as any).name}`,
                            width_mm: (template as any).width_mm,
                            height_mm: (template as any).height_mm,
                            bleed_mm: (template as any).bleed_mm || 3,
                            dpi: (template as any).dpi_default || 300,
                            color_profile: (template as any).color_profile || "FOGRA39",
                            template_id: (template as any).id,
                            format: null,
                        }));
                        setLoading(false);
                        return;
                    }
                }

                setLoading(false);

            } catch (err) {
                console.error("Error loading spec:", err);
                toast.error("Kunne ikke indlæse design-specifikationer");
                setLoading(false);
            }
        };

        loadSpec();
    }, [variantId, productId, templateId, designId, format, savedDesignId]);

    // Beforeunload handler for tab close/refresh with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                // Modern browsers ignore custom messages, but we still need to set returnValue
                e.returnValue = 'Du har ændringer, der ikke er gemt. Er du sikker på, at du vil forlade siden?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    // Handle back navigation with unsaved changes guard
    const handleBackClick = useCallback(() => {
        if (hasChanges) {
            setShowUnsavedDialog(true);
        } else {
            // Check if we have history to go back to
            // When opened in new tab, history.length is typically 1 or 2
            if (window.history.length > 2) {
                navigate(-1);
            } else {
                // No history - go to admin designer page or close if opened from there
                navigate('/admin/designer-templates');
            }
        }
    }, [hasChanges, navigate]);

    // Navigate back helper - used after save or discard
    const navigateBack = useCallback(() => {
        if (window.history.length > 2) {
            navigate(-1);
        } else {
            navigate('/admin/designer-templates');
        }
    }, [navigate]);

    // Save and then navigate back
    const handleSaveAndLeave = useCallback(async () => {
        setIsSavingAndLeaving(true);
        try {
            await handleSave();
            // After successful save, hasChanges will be false, navigate back
            navigateBack();
        } catch (err) {
            // Save failed, stay on page
            console.error('Save failed during exit:', err);
        } finally {
            setIsSavingAndLeaving(false);
            setShowUnsavedDialog(false);
        }
    }, [navigateBack]);

    // Discard changes and navigate back
    const handleDiscardAndLeave = useCallback(() => {
        setHasChanges(false);
        setShowUnsavedDialog(false);
        navigateBack();
    }, [navigateBack]);

    // Run preflight checks
    // PROTECTED - See .agent/workflows/preflight-protected.md
    const runPreflight = useCallback(() => {
        const canvas = editorRef.current?.getCanvas();
        if (!canvas) return;

        const result = runPreflightChecks(canvas, {
            documentWidth: documentSpec.width_mm,
            documentHeight: documentSpec.height_mm,
            bleed: documentSpec.bleed_mm,
            safeArea: 3,
            minDPI: 96,
            targetDPI: 150,
            optimalDPI: 300,
            mmToPx: MM_TO_PX,
        });

        setPreflightWarnings(result.warnings);
        setPreflightErrors(result.errors);
        setPreflightInfos(result.infos);

        // Only switch to preflight tab and show toast when there are actual problems
        // Don't interrupt the user's workflow when everything is fine
        if (result.errors.length > 0) {
            setActiveTab('preflight');
            toast.error(`Preflight fandt ${result.errors.length} fejl`);
        } else if (result.warnings.length > 0) {
            setActiveTab('preflight');
            toast.warning(`Preflight fandt ${result.warnings.length} advarsler`);
        }
    }, [documentSpec]);

    // Handle selection changes
    const handleSelectionChange = useCallback((hasSel: boolean, props?: SelectedObjectProps) => {
        setHasSelection(hasSel);
        setSelectedProps(hasSel && props ? props : null);
        if (hasSel) setActiveTab('properties');
    }, []);

    // Handle layers change
    const handleLayersChange = useCallback((newLayers: LayerInfo[]) => {
        setLayers(newLayers);
    }, []);

    // Tool actions
    const handleToolClick = useCallback((toolId: string) => {
        // Actions that don't change mode
        if (toolId === 'image') {
            fileInputRef.current?.click();
            return;
        }
        if (toolId === 'pdf') {
            setShowPDFImport(true);
            return;
        }


        // Tools that change mode
        setSelectedTool(toolId);

        // Instant actions that might need setup
        switch (toolId) {
            case 'text':
                editorRef.current?.addText();
                setSelectedTool('select');
                break;
            case 'rectangle':
                editorRef.current?.addRectangle();
                setSelectedTool('select');
                break;
            case 'circle':
                editorRef.current?.addCircle();
                setSelectedTool('select');
                break;
            case 'line':
                editorRef.current?.addLine();
                setSelectedTool('select');
                break;
            case 'guide-h':
                editorRef.current?.addHorizontalGuide();
                setSelectedTool('select');
                break;
            case 'guide-v':
                editorRef.current?.addVerticalGuide();
                setSelectedTool('select');
                break;
        }
    }, []);

    // Handle image upload
    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Extract DPI from metadata
        const sourceDpi = await getImageDpi(file);
        if (sourceDpi) {
            console.log(`[Designer] Detected image DPI: ${sourceDpi}`);
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            editorRef.current?.addImage(dataUrl, sourceDpi || undefined);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
        setSelectedTool('select');
    }, []);

    // Handle PDF import with correct physical scaling
    const handlePDFImport = useCallback((data: PDFImportData) => {
        const canvas = editorRef.current?.getCanvas();
        if (!canvas) return;

        // Display DPI used by the canvas (matches EditorCanvas)
        const DISPLAY_DPI = 50.8;

        // Calculate the desired display size based on the PDF's physical dimensions
        const desiredWidthPx = mmToPx(data.widthMm, DISPLAY_DPI);
        const desiredHeightPx = mmToPx(data.heightMm, DISPLAY_DPI);

        // Calculate scale factor to apply to the rendered raster
        const scaleX = desiredWidthPx / data.renderedWidth;
        const scaleY = desiredHeightPx / data.renderedHeight;
        const scale = Math.min(scaleX, scaleY); // Use uniform scale

        // Add the image with correct scaling
        fabric.Image.fromURL(data.imageDataUrl, (img) => {
            img.set({
                left: canvas.getWidth() / 2,
                top: canvas.getHeight() / 2,
                originX: 'center',
                originY: 'center',
                scaleX: scale,
                scaleY: scale,
            });

            // Store PDF metadata for vector export preservation
            if (data.originalPdfBytes) {
                (img as any).data = {
                    kind: 'pdf_page_background',
                    originalPdfBytes: data.originalPdfBytes,
                    pageIndex: data.pageNumber - 1,  // Convert to 0-based index
                    originalFileName: data.originalFileName,
                };
            }

            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();

            console.log(`[PDF Import] ${Math.round(data.widthMm)}×${Math.round(data.heightMm)}mm rendered at scale ${scale.toFixed(3)}`);
        }, { crossOrigin: 'anonymous' });
    }, []);

    // Prompt to save - shows dialog for new designs
    const handleSave = async () => {
        // For new designs, show the save dialog to get a name
        if (!designId) {
            // Set default name based on format
            const defaultName = `${documentSpec.name || format || 'Design'} - ${new Date().toLocaleDateString('da-DK')}`;
            setSaveDesignName(defaultName);
            setShowSaveDialog(true);
            return;
        }

        // For existing designs, save directly
        await performSave();
    };

    // Actually perform the save operation
    const performSave = async (customName?: string) => {
        try {
            setSaving(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Du skal være logget ind for at gemme");
                navigate('/auth?redirect=/designer');
                return;
            }

            const canvas = editorRef.current?.getCanvas();
            const editorJson = editorRef.current?.getJSON() || {};
            const saveName = customName || documentSpec.name;

            // Resolve tenant ID to ensure storage paths are correct
            let tenantId = (documentSpec as any).tenant_id;

            if (!tenantId) {
                const { data: roleRow } = await supabase
                    .from('user_roles')
                    .select('tenant_id')
                    .eq('user_id', user.id)
                    .maybeSingle();
                tenantId = (roleRow as any)?.tenant_id;
            }

            tenantId = tenantId || '00000000-0000-0000-0000-000000000000';

            // Generate thumbnail if possible
            let preview_thumbnail_url = (documentSpec as any).preview_thumbnail_url;
            if (canvas) {
                try {
                    // Create a small preview
                    const dataUrl = canvas.toDataURL({
                        format: 'jpeg',
                        quality: 0.6,
                        multiplier: 0.2, // Small preview
                    });

                    // Upload to storage
                    // Convert dataURL to Blob more reliably without fetch
                    const byteString = atob(dataUrl.split(',')[1]);
                    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: mimeString });

                    // Put previews under the tenant directory to match existing patterns
                    const fileName = `${tenantId}/previews/${user.id}-${Date.now()}.jpg`;
                    console.log("Saving thumbnail to bucket 'product-images' path:", fileName);

                    const { error: uploadError } = await supabase.storage
                        .from('product-images')
                        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('product-images')
                            .getPublicUrl(fileName);
                        console.log("Thumbnail saved successfully. URL:", publicUrl);
                        preview_thumbnail_url = publicUrl;
                    } else {
                        console.error("Storage upload error:", uploadError);
                    }
                } catch (thumbErr) {
                    console.error("Failed to generate thumbnail:", thumbErr);
                }
            }

            const designData = {
                user_id: user.id,
                name: saveName,
                width_mm: documentSpec.width_mm,
                height_mm: documentSpec.height_mm,
                bleed_mm: documentSpec.bleed_mm,
                dpi: documentSpec.dpi,
                color_profile: documentSpec.color_profile,
                template_id: documentSpec.template_id,
                product_id: documentSpec.product_id,
                editor_json: editorJson,
                preview_thumbnail_url,
                preflight_warnings: [...preflightWarnings, ...preflightErrors, ...preflightInfos],
                preflight_errors_count: preflightErrors.length,
                preflight_warnings_count: preflightWarnings.length,
                warnings_accepted: dismissedWarnings.size > 0,
                warnings_accepted_at: dismissedWarnings.size > 0 ? new Date().toISOString() : null,
                tenant_id: tenantId,
            };

            if (designId) {
                const { error } = await supabase
                    .from('designer_saved_designs' as any)
                    .update(designData)
                    .eq('id', designId);

                if (error) throw error;
                toast.success("Design opdateret!");
                setHasChanges(false);
            } else {
                const { data, error } = await supabase
                    .from('designer_saved_designs' as any)
                    .insert(designData)
                    .select()
                    .single();

                if (error) throw error;
                toast.success(`"${saveName}" gemt!`);
                setHasChanges(false);

                // Update documentSpec with new name and preview
                setDocumentSpec(prev => ({ ...prev, name: saveName, preview_thumbnail_url }));

                if (data) {
                    // Track that we just saved this design to skip reloading
                    const newId = (data as any).id;
                    setSavedDesignId(newId);

                    // Update URL without causing a full reload
                    setSearchParams({ designId: newId }, { replace: true });
                }
            }

            // Invalidate query to refresh library
            queryClient.invalidateQueries({ queryKey: ['design-library'] });
        } catch (err: any) {
            console.error("Save error:", err);
            toast.error("Kunne ikke gemme: " + err.message);
        } finally {
            setSaving(false);
            setShowSaveDialog(false);
        }
    };

    // Handle save dialog confirmation
    const handleSaveDialogConfirm = () => {
        if (!saveDesignName.trim()) {
            toast.error("Indtast venligst et navn til dit design");
            return;
        }
        performSave(saveDesignName.trim());
    };

    // Export print-ready PDF
    const handleExport = async () => {
        // Run preflight first
        runPreflight();

        if (preflightErrors.length > 0) {
            toast.error("Ret venligst preflight-fejl før eksport");
            setActiveTab('preflight');
            return;
        }

        try {
            setSaving(true);
            toast.info("Forbereder trykklar PDF (CMYK)... Dette kan tage et øjeblik.");

            // Find current profile URLs
            const profile = OUTPUT_PROFILES.find(p => p.id === colorProofing.settings.outputProfileId)
                || OUTPUT_PROFILES[0];

            // Calculate crop rect to capture TRIM + BLEED area (excluding pasteboard)
            // Note: PASTEBOARD_PADDING is the start of the Bleed Box
            const PASTEBOARD_PADDING_PX = 100;
            const bleedPx = (documentSpec.bleed_mm || 0) * MM_TO_PX;

            // We want to capture the full bleed area, which starts at pasteboard padding
            const cropOptions = {
                left: PASTEBOARD_PADDING_PX,
                top: PASTEBOARD_PADDING_PX,
                width: (documentSpec.width_mm * MM_TO_PX) + (bleedPx * 2),
                height: (documentSpec.height_mm * MM_TO_PX) + (bleedPx * 2)
            };

            // 1. Transform to CMYK and get proofed RGB (Cropped to Bleed Box)
            const { cmykData, proofedRgbDataUrl, width, height } = await colorProofing.exportCMYK(
                SRGB_PROFILE_URL,
                profile.url,
                productProfile.profileBytes,
                cropOptions
            );

            if (cmykData.length === 0) {
                toast.warning("ICC-profiler blev ikke fundet. Eksporterer optimeret RGB PDF i stedet.");
            }

            // 2. Create PDF with full BLEED dimensions
            const bleedMm = documentSpec.bleed_mm || 0;
            const pdfWidth = documentSpec.width_mm + (bleedMm * 2);
            const pdfHeight = documentSpec.height_mm + (bleedMm * 2);

            const doc = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            // 3. Add CMYK-simulated Image (Now full bleed size)
            doc.addImage(proofedRgbDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');

            // Set Output Intent (Metadata)
            doc.setProperties({
                title: documentSpec.name,
                subject: 'Trykklar PDF',
                creator: 'Webprinter Designer',
                keywords: `CMYK, ${profile.name}, Print`
            });

            // Save
            const fileName = `${documentSpec.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            doc.save(fileName);

            toast.success("Trykklar PDF eksporteret!");
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error("Kunne ikke eksportere PDF: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Export with dialog - uses runDesignerExport for mode selection
    const handleExportWithDialog = async (options: ExportOptions) => {
        // Run preflight first
        runPreflight();

        if (preflightErrors.length > 0) {
            toast.error("Ret venligst preflight-fejl før eksport");
            setActiveTab('preflight');
            return;
        }

        try {
            setSaving(true);
            const modeLabels: Record<string, string> = {
                print_pdf: 'Print PDF',
                proof_pdf: 'Proof PDF',
                original_pdf: 'Original PDF',
                vector_pdf: 'Vektor PDF'
            };
            toast.info(`Forbereder ${modeLabels[options.mode] || options.mode}...`);

            // Detect PDF background for vector export
            let pdfBackgroundMeta = null;
            if (fabricCanvas) {
                const objects = fabricCanvas.getObjects();
                for (const obj of objects) {
                    const data = (obj as any).data;
                    if (data?.kind === 'pdf_page_background' && data.originalPdfBytes) {
                        pdfBackgroundMeta = {
                            kind: 'pdf_page_background' as const,
                            originalPdfBytes: data.originalPdfBytes,
                            pageIndex: data.pageIndex || 0,
                            originalFileName: data.originalFileName
                        };
                        break;
                    }
                }
            }

            const result = await runDesignerExport(options, {
                documentSpec,
                fabricCanvas,
                colorProofing: {
                    settings: colorProofing.settings,
                    exportCMYK: colorProofing.exportCMYK,
                },
                productProfileBytes: productProfile.profileBytes,
                pdfSourceMeta: null, // No PDF source tracking yet
                hasChanges,
                pdfBackgroundMeta,
            });

            if (result.success) {
                toast.success(`${modeLabels[options.mode] || options.mode} eksporteret!`);
                setIsExportDialogOpen(false);
            } else {
                toast.error(result.error || 'Eksport fejlede');
            }
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error("Kunne ikke eksportere PDF: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Library actions
    const handleInsertDesign = (item: any) => {
        if (!editorRef.current) return;

        if (item.kind === 'fabric_json') {
            editorRef.current.importJSON(item.fabric_json);
            toast.success("Design indsat!");
        } else if (item.kind === 'svg' && item.storage_path) {
            // Fetch SVG string from storage or URL
            const { data } = supabase.storage.from('design-library').getPublicUrl(item.storage_path);
            fetch(data.publicUrl)
                .then(res => res.text())
                .then(svg => {
                    editorRef.current?.importSVG(svg);
                    toast.success("SVG indsat!");
                });
        }
        setIsLibraryOpen(false);
    };

    // State to track pending design replacement when there are unsaved changes
    const [pendingReplaceItem, setPendingReplaceItem] = useState<any>(null);
    const [showReplaceConfirmDialog, setShowReplaceConfirmDialog] = useState(false);

    const handleReplaceDesign = async (item: any) => {
        if (hasChanges) {
            // Store the pending item and show confirmation dialog
            setPendingReplaceItem(item);
            setShowReplaceConfirmDialog(true);
            return;
        }

        // No unsaved changes, proceed directly
        await executeReplaceDesign(item);
    };

    const executeReplaceDesign = async (item: any) => {
        // Handle template (format) items - navigate to designer with template
        if (item.kind === 'template' && item.id) {
            navigate(`/designer?templateId=${item.id}`, { replace: true });
            setIsLibraryOpen(false);
            return;
        }

        if (item.kind === 'fabric_json' && item.fabric_json) {
            editorRef.current?.loadJSON(item.fabric_json);

            // If it's a saved design (from 'mine' tab), update the URL
            if (item.created_at) { // Simple check to see if it's from the hook's 'mine' mapping
                navigate(`/designer?designId=${item.id}`, { replace: true });
            }

            toast.success("Design åbnet!");
            setHasChanges(false);
        } else if (item.kind !== 'template') {
            toast.error("Dette filformat kan kun indsættes, ikke åbnes som nyt dokument.");
        }
        setIsLibraryOpen(false);
    };

    // Handle confirm replace (user clicked Replace in replace dialog)
    const handleConfirmReplace = useCallback(async () => {
        if (pendingReplaceItem) {
            await executeReplaceDesign(pendingReplaceItem);
            setPendingReplaceItem(null);
        }
        setShowReplaceConfirmDialog(false);
    }, [pendingReplaceItem]);

    // Add to order
    const handleAddToOrder = async () => {
        // Run preflight
        runPreflight();

        // Save first
        await handleSave();

        // Navigate to checkout with design
        if (documentSpec.product_id) {
            navigate(`/checkout/konfigurer?productId=${documentSpec.product_id}&designId=${designId}`);
        } else {
            toast.info('Vælg et produkt for at tilføje til kurv');
        }
    };

    // Update props
    const handleUpdateProps = useCallback((props: Partial<SelectedObjectProps>) => {
        editorRef.current?.updateSelectedProps(props);
    }, []);

    // Layer actions
    const handleSelectLayer = useCallback((id: string) => {
        setSelectedLayerId(id);
        editorRef.current?.selectLayer(id);
    }, []);

    // Preflight actions
    const handleDismissWarning = useCallback((id: string) => {
        setDismissedWarnings(prev => new Set([...prev, id]));
    }, []);

    const handleAcceptAllWarnings = useCallback(() => {
        const allIds = [...preflightWarnings, ...preflightInfos].map(w => w.id);
        setDismissedWarnings(new Set(allIds));
    }, [preflightWarnings, preflightInfos]);

    const handleHighlightObject = useCallback((objectId: string) => {
        editorRef.current?.selectLayer(objectId);
        setActiveTab('properties');
    }, []);

    // Tools
    const tools = [
        { id: "select", icon: MousePointer2, label: "Vælg (V)" },
        { id: "text", icon: Type, label: "Tilføj tekst (T)" },
        { id: "image", icon: ImageIcon, label: "Tilføj billede (I)" },
        { id: "pdf", icon: FileUp, label: "Tilføj PDF (P)" },
        { id: "rectangle", icon: Square, label: "Rektangel (R)" },
        { id: "circle", icon: Circle, label: "Cirkel (C)" },
        { id: "line", icon: Minus, label: "Linje (L)" },
        { id: "guide-h", icon: GripHorizontal, label: "Horisontal guide (G) - Fold/beskæring" },
        { id: "guide-v", icon: GripVertical, label: "Vertikal guide (Shift+G) - Fold/beskæring" },
    ];

    // Total warnings count
    const totalWarningsCount = preflightErrors.length + preflightWarnings.length - dismissedWarnings.size;

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Ignore if meta, ctrl, or alt keys are pressed for single-letter shortcuts
            const hasModifier = e.metaKey || e.ctrlKey || e.altKey;

            switch (e.key.toLowerCase()) {
                case 'v': if (!hasModifier) setSelectedTool('select'); break;
                case 't': if (!hasModifier) handleToolClick('text'); break;
                case 'i': if (!hasModifier) handleToolClick('image'); break;
                case 'p': if (!hasModifier) handleToolClick('pdf'); break;
                case 'r': if (!hasModifier) handleToolClick('rectangle'); break;
                case 'c':
                    if (!hasModifier) {
                        handleToolClick('circle');
                    }
                    // If meta/ctrl is pressed, we let the browser handle the standard Copy action
                    break;
                case 'l': if (!hasModifier) handleToolClick('line'); break;
                case 'g':
                    if (!hasModifier) {
                        if (e.shiftKey) {
                            handleToolClick('guide-v');
                        } else {
                            handleToolClick('guide-h');
                        }
                    }
                    break;
                case 'delete':
                case 'backspace':
                    if (hasSelection) editorRef.current?.deleteSelected();
                    break;
                case 'z':
                    if (e.metaKey || e.ctrlKey) {
                        if (e.shiftKey) editorRef.current?.redo();
                        else editorRef.current?.undo();
                        e.preventDefault();
                    }
                    break;
                case 's':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        handleSave();
                    }
                    break;
                case 'd':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        if (hasSelection) editorRef.current?.duplicateSelected();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleToolClick, hasSelection]);

    // Global drag and drop for PDF files
    const handleGlobalDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;

        // Check if dragging files (not internal drag)
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingFile(true);
        }
    }, []);

    const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;

        if (dragCounterRef.current === 0) {
            setIsDraggingFile(false);
        }
    }, []);

    const handleGlobalDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
        dragCounterRef.current = 0;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/pdf') {
                // Determine if this is dropping onto the main area or just general
                // For now, any drop opens the modal
                setShowPDFImport(true);
                // We'll need to pass the file to the modal, but the modal logic currently handles "Select file"
                // Ideally we update PDFImportModal to accept a pre-selected file prop
                // For now, we'll just open the modal and let user select (or we'll improve it later)
            }
        }
    }, []);

    // Prevent browser default drag behavior on window
    useEffect(() => {
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => e.preventDefault());
        return () => {
            window.removeEventListener('dragover', (e) => e.preventDefault());
            window.removeEventListener('drop', (e) => e.preventDefault());
        };
    }, []);



    // Use auto-sizing for the canvas style, but let EditorCanvas control internal resolution
    // const canvasWidth = docWidth + (PASTEBOARD_PADDING * 2);
    // const canvasHeight = docHeight + (PASTEBOARD_PADDING * 2);


    // Landing page for showcasing the designer
    if (showLanding) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                <SEO title="Print Designer - Webprinter" />

                {/* Header */}
                <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                    <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Tilbage
                        </Button>
                        <Button onClick={() => navigate('/designer?format=A4')}>
                            Åbn Print Designer
                        </Button>
                    </div>
                </header>

                {/* Hero Section */}
                <section className="py-20 px-6">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                            <Palette className="h-4 w-4" />
                            Professionelt Designværktøj
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                            Skab trykkeklare designs
                            <br />
                            <span className="text-primary">direkte i browseren</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                            Vores professionelle designværktøj giver dig fuld kontrol over dit artwork
                            med CMYK-farver, bleed-områder og høj opløsning – alt sammen uden at installere
                            noget software.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" onClick={() => navigate('/designer?format=A4')} className="gap-2">
                                <MousePointer2 className="h-5 w-5" />
                                Start Print Designer
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-4">
                            <span className="text-green-600 font-medium">✓ Inkluderet gratis</span> på denne konto
                        </p>
                    </div>
                </section>

                {/* Feature Image Placeholder */}
                <section className="px-6 pb-16">
                    <div className="max-w-5xl mx-auto">
                        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">Designer preview billede</p>
                                <p className="text-sm">Tilføj et screenshot af designeren her</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-20 px-6 bg-white border-t">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-bold text-gray-900 mb-4">Alt hvad du har brug for</h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                Print Designer er fyldt med professionelle funktioner der gør det nemt at skabe
                                trykkeklare designs.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Feature 1 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                                    <Square className="h-6 w-6 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Professionelt Canvas</h3>
                                <p className="text-muted-foreground text-sm">
                                    Lag-baseret editor med bleed, trim og sikkerhedszoner.
                                    Præcis placering af alle elementer.
                                </p>
                            </div>

                            {/* Feature 2 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                                    <FileUp className="h-6 w-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">PDF Import</h3>
                                <p className="text-muted-foreground text-sm">
                                    Upload eksisterende PDF-filer og brug dem som udgangspunkt.
                                    Vælg enkeltside fra flersidede dokumenter.
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Preflight Tjek</h3>
                                <p className="text-muted-foreground text-sm">
                                    Automatisk validering af opløsning, tekststørrelse og marginer.
                                    Få advarsler før du bestiller.
                                </p>
                            </div>

                            {/* Feature 4 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                                    <Palette className="h-6 w-6 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">CMYK Soft Proofing</h3>
                                <p className="text-muted-foreground text-sm">
                                    Se hvordan dine farver vil se ud på tryk med vores ICC-baserede
                                    farvekonvertering og gamut-advarsel.
                                </p>
                            </div>

                            {/* Feature 5 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mb-4">
                                    <Type className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Tekst & Typografi</h3>
                                <p className="text-muted-foreground text-sm">
                                    Bred vifte af fonte med fuld kontrol over størrelse, farve,
                                    linjeafstand og tekstformatering.
                                </p>
                            </div>

                            {/* Feature 6 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                                    <Download className="h-6 w-6 text-indigo-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Print-klar Eksport</h3>
                                <p className="text-muted-foreground text-sm">
                                    Eksporter dit design som højopløselig PDF klar til professionelt tryk
                                    med korrekte farver.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-20 px-6 bg-gradient-to-r from-primary/5 to-primary/10 border-t">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Klar til at komme i gang?</h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            Start med at designe dit første trykkeklare artwork i dag.
                        </p>
                        <Button size="lg" onClick={() => navigate('/designer?format=A4')} className="gap-2">
                            <MousePointer2 className="h-5 w-5" />
                            Åbn Print Designer
                        </Button>
                    </div>
                </section>

                {/* Footer */}
                <Footer />
            </div>
        );
    }

    return (
        <div
            className="flex h-screen flex-col"
            onDragEnter={handleGlobalDragEnter}
            onDragOver={handleGlobalDragOver}
            onDragLeave={handleGlobalDragLeave}
            onDrop={handleGlobalDrop}
        >
            <SEO title={documentSpec.name || "Design Editor"} />

            {/* Subheader / Toolbar */}
            <div className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleBackClick}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Tilbage
                    </Button>
                    <div className="h-4 w-px bg-border mx-2" />
                    <div>
                        <h1 className="text-sm font-medium">{documentSpec.name}</h1>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                            <span>{documentSpec.width_mm}x{documentSpec.height_mm}mm</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-border" />
                            <span>{documentSpec.dpi} DPI</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-border" />
                            <span>{documentSpec.color_profile}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {hasChanges ? (
                        <span className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Ugemte ændringer
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5 px-2 py-1">
                            <FileCheck className="h-3.5 w-3.5" />
                            Gemt
                        </span>
                    )}

                    <div className="h-4 w-px bg-border mx-2" />

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsLibraryOpen(true)}
                        title="Åbn Design Bibliotek"
                    >
                        <LayoutGrid className="h-4 w-4 mr-2" />
                        Bibliotek
                    </Button>

                    <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Eksportér
                    </Button>

                    <Button onClick={() => handleSave()} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Gem design
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* PDF Import Modal */}
                <PDFImportModal
                    open={showPDFImport}
                    onOpenChange={setShowPDFImport}
                    onImport={handlePDFImport}
                    allowedWidthMm={documentSpec.width_mm}
                    allowedHeightMm={documentSpec.height_mm}
                />

                {/* Library Drawer */}
                <DesignLibraryDrawer
                    open={isLibraryOpen}
                    onOpenChange={setIsLibraryOpen}
                    onReplaceDesign={handleReplaceDesign}
                    onInsertDesign={handleInsertDesign}
                />

                {/* Export Dialog */}
                <ExportDialog
                    open={isExportDialogOpen}
                    onOpenChange={setIsExportDialogOpen}
                    onExport={handleExportWithDialog}
                    isExporting={saving}
                    hasBleed={(documentSpec.bleed_mm || 0) > 0}
                    pdfSourceMeta={null}
                    hasChanges={hasChanges}
                    hasPdfBackground={(() => {
                        if (!fabricCanvas) return false;
                        return fabricCanvas.getObjects().some((obj: any) =>
                            obj.data?.kind === 'pdf_page_background' && obj.data?.originalPdfBytes
                        );
                    })()}
                />

                {/* Left Toolbar */}
                <aside className="w-16 flex flex-col items-center py-4 border-r bg-background z-10">
                    <div className="flex flex-col gap-2">
                        {tools.map((tool) => (
                            <Button
                                key={tool.id}
                                variant={selectedTool === tool.id ? "default" : "ghost"}
                                size="icon"
                                className="h-10 w-10 relative group"
                                onClick={() => handleToolClick(tool.id)}
                                title={tool.label}
                            >
                                <tool.icon className="h-5 w-5" />
                                <span className="absolute left-12 bg-popover text-popover-foreground px-2 py-1 rounded text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                    {tool.label}
                                </span>
                            </Button>
                        ))}
                    </div>

                    <div className="flex-1" />
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                    />

                    <div className="flex flex-col gap-2 mb-2">
                        {/* Undo */}
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Fortryd (Ctrl+Z)"
                            className="h-10 w-10"
                            onClick={() => editorRef.current?.undo()}
                        >
                            <Undo2 className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Gentag (Ctrl+Shift+Z)"
                            className="h-10 w-10"
                            onClick={() => editorRef.current?.redo()}
                        >
                            <Redo2 className="h-5 w-5" />
                        </Button>

                        <div className="h-px bg-border w-8 mx-auto my-1" />

                        {/* Duplicate/Copy */}
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Kopier valgte (Ctrl+D)"
                            className="h-10 w-10"
                            onClick={() => editorRef.current?.duplicateSelected()}
                            disabled={!hasSelection}
                        >
                            <Copy className="h-5 w-5" />
                        </Button>

                        {/* Delete */}
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Slet valgte (Delete)"
                            className="h-10 w-10 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => editorRef.current?.deleteSelected()}
                            disabled={!hasSelection}
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                </aside>

                {/* Canvas Area */}
                <main className="flex-1 overflow-auto bg-[#e5e5e5] relative flex items-center justify-center p-20">
                    {/* Wrapper for canvas and overlays - provides positioning context */}
                    <div className="relative inline-block">
                        <EditorCanvas
                            ref={editorRef}
                            width={documentSpec.width_mm}
                            height={documentSpec.height_mm}
                            bleed={documentSpec.bleed_mm}
                            dpi={documentSpec.dpi}
                            selectedTool={selectedTool}
                            onSelectionChange={handleSelectionChange}
                            onCanvasChange={() => {
                                setHasChanges(true);
                                // Debounce auto-preflight
                                if (autoPreflightTimerRef.current) clearTimeout(autoPreflightTimerRef.current);
                                autoPreflightTimerRef.current = setTimeout(() => {
                                    runPreflight();
                                }, 500);
                            }}
                            onLayersChange={handleLayersChange}
                        />

                        {/* Soft proofing overlay - positioned over document area only */}
                        {/* PROTECTED - See .agent/workflows/soft-proof-protected.md */}
                        {colorProofing.settings.enabled && (
                            <canvas
                                ref={proofingOverlayRef}
                                className="absolute pointer-events-none"
                                style={{
                                    left: PASTEBOARD_PADDING,
                                    top: PASTEBOARD_PADDING,
                                    width: docWidth,
                                    height: docHeight,
                                    mixBlendMode: 'normal',
                                    zIndex: 10,  // Below guide lines (z-index 20+) but above Fabric canvas
                                }}
                            />
                        )}

                        {/* Live Dimensions Label - inside wrapper for correct positioning */}
                        {hasSelection && selectedProps?.boundingRect && (
                            <div
                                className="absolute pointer-events-none bg-black/80 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-lg flex items-center gap-2 z-[60] backdrop-blur-sm"
                                style={{
                                    left: selectedProps.boundingRect.left + selectedProps.boundingRect.width / 2,
                                    top: selectedProps.boundingRect.top + selectedProps.boundingRect.height + 10,
                                    transform: 'translateX(-50%)'
                                }}
                            >
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400">B:</span>
                                    <span>{((selectedProps.boundingRect.width) / MM_TO_PX).toFixed(1)} mm</span>
                                </div>
                                <div className="w-px h-2 bg-white/20" />
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400">H:</span>
                                    <span>{((selectedProps.boundingRect.height) / MM_TO_PX).toFixed(1)} mm</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {colorProofing.settings.enabled && (
                        <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded shadow-lg flex items-center gap-1">
                            <Palette className="h-3 w-3" />
                            CMYK Preview
                            {colorProofing.isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                        </div>
                    )}
                </main>

                {/* Right Panel */}
                <aside className="w-80 bg-background border-l flex flex-col">
                    {/* Tab Switcher */}
                    <div className="flex border-b">
                        <button
                            onClick={() => setActiveTab('layers')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'layers'
                                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:bg-muted/50'
                                }`}
                        >
                            Lag
                        </button>
                        <button
                            onClick={() => setActiveTab('properties')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors ${activeTab === 'properties'
                                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:bg-muted/50'
                                }`}
                        >
                            Egenskaber
                        </button>
                        <button
                            onClick={() => setActiveTab('preflight')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors relative ${activeTab === 'preflight'
                                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:bg-muted/50'
                                }`}
                        >
                            Preflight
                            {totalWarningsCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                                    {totalWarningsCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('proofing')}
                            className={`flex-1 py-2 text-sm font-medium transition-colors relative ${activeTab === 'proofing'
                                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:bg-muted/50'
                                }`}
                        >
                            <span className="flex items-center justify-center gap-1">
                                <Palette className="h-3 w-3" />
                                Farver
                            </span>
                            {colorProofing.settings.enabled && (
                                <span className="absolute -top-1 -right-1 bg-purple-500 w-2 h-2 rounded-full" />
                            )}
                        </button>
                    </div>

                    {/* Panel Content */}
                    <div className="flex-1 overflow-y-auto">
                        {activeTab === 'layers' && (
                            <LayerPanel
                                layers={layers}
                                selectedLayerId={selectedLayerId}
                                onSelectLayer={handleSelectLayer}
                                onMoveUp={(id) => editorRef.current?.moveLayerUp(id)}
                                onMoveDown={(id) => editorRef.current?.moveLayerDown(id)}
                                onToggleVisibility={(id) => editorRef.current?.toggleLayerVisibility(id)}
                            />
                        )}
                        {activeTab === 'properties' && (
                            <PropertiesPanel
                                selectedObject={selectedProps}
                                onUpdateProps={handleUpdateProps}
                                onBringToFront={() => editorRef.current?.bringToFront()}
                                onSendToBack={() => editorRef.current?.sendToBack()}
                            />
                        )}
                        {activeTab === 'preflight' && (
                            <PreflightPanel
                                warnings={preflightWarnings}
                                errors={preflightErrors}
                                infos={preflightInfos}
                                onAcceptAll={handleAcceptAllWarnings}
                                onHighlightObject={handleHighlightObject}
                                onDismiss={handleDismissWarning}
                                dismissed={dismissedWarnings}
                            />
                        )}
                        {activeTab === 'proofing' && (
                            <ColorProofingPanel
                                settings={colorProofing.settings}
                                isReady={true}
                                isProcessing={colorProofing.isProcessing}
                                error={colorProofing.error}
                                onSetEnabled={colorProofing.setEnabled}
                                onSetOutputProfile={colorProofing.setOutputProfile}
                                onSetShowGamutWarning={colorProofing.setShowGamutWarning}
                                hasCustomProfile={colorProofing.hasCustomProfile}
                                productProfileId={productProfile.id || undefined}
                                productProfileName={productProfile.name || undefined}
                            />
                        )}
                    </div>

                    {/* Quick Add */}
                    <div className="p-4 border-t">
                        <div className="grid grid-cols-4 gap-2">
                            <Button variant="outline" size="sm" className="h-10 p-0" onClick={() => handleToolClick('text')} title="Tekst">
                                <Type className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-10 p-0" onClick={() => handleToolClick('image')} title="Billede">
                                <Upload className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-10 p-0" onClick={() => setShowPDFImport(true)} title="PDF">
                                <FileUp className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" className="h-10 p-0" onClick={() => handleToolClick('rectangle')} title="Rektangel">
                                <Square className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Unsaved Changes Dialog */}
            <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Du har ændringer, der ikke er gemt</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hvis du forlader siden nu, kan dine ændringer gå tabt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
                            Bliv her
                        </AlertDialogCancel>
                        <Button
                            variant="outline"
                            onClick={handleDiscardAndLeave}
                            className="text-destructive hover:text-destructive"
                        >
                            Forlad uden at gemme
                        </Button>
                        <AlertDialogAction
                            onClick={handleSaveAndLeave}
                            disabled={isSavingAndLeaving}
                        >
                            {isSavingAndLeaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Gemmer...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Gem og gå tilbage
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Save Design Dialog - for naming new designs */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Save className="h-5 w-5 text-primary" />
                            Gem dit design
                        </DialogTitle>
                        <DialogDescription>
                            Giv dit design et navn, så du nemt kan finde det igen i Design Biblioteket.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="design-name">Design navn</Label>
                            <Input
                                id="design-name"
                                value={saveDesignName}
                                onChange={(e) => setSaveDesignName(e.target.value)}
                                placeholder="F.eks. Visitkort til firma"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveDialogConfirm();
                                    }
                                }}
                            />
                        </div>
                        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                            <p className="font-medium mb-1">Format:</p>
                            <p>{documentSpec.width_mm}×{documentSpec.height_mm}mm • {documentSpec.bleed_mm}mm bleed</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                            Annuller
                        </Button>
                        <Button onClick={handleSaveDialogConfirm} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Gemmer...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Gem design
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Replace Design Confirm Dialog */}
            <AlertDialog open={showReplaceConfirmDialog} onOpenChange={setShowReplaceConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Erstat nuværende design?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Du har ændringer, der ikke er gemt. Hvis du erstatter designet, vil dine nuværende ændringer gå tabt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setShowReplaceConfirmDialog(false);
                            setPendingReplaceItem(null);
                        }}>
                            Annuller
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmReplace}>
                            Erstat design
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default Designer;
