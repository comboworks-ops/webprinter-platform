import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
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
import EditorCanvas, { EditorCanvasRef, LayerInfo, SelectedObjectProps } from "@/components/designer/EditorCanvas";
import { fabric } from 'fabric';
import LayerPanel from "@/components/designer/LayerPanel";
import PropertiesPanel from "@/components/designer/PropertiesPanel";
import PreflightPanel from "@/components/designer/PreflightPanel";
import ColorProofingPanel from "@/components/designer/ColorProofingPanel";
import PDFImportModal, { PDFImportData } from "@/components/designer/PDFImportModal";
import { DesignLibraryDrawer } from "@/components/designer/DesignLibraryDrawer";
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
    LayoutGrid
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
    const { variantId } = useParams<{ variantId?: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const editorRef = useRef<EditorCanvasRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const proofingOverlayRef = useRef<HTMLCanvasElement>(null);

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

    // Unsaved changes navigation guard
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);

    // Load spec
    useEffect(() => {
        const loadSpec = async () => {
            try {
                setLoading(true);

                if (designId) {
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
    }, [variantId, productId, templateId, designId, format]);

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
            navigate(-1);
        }
    }, [hasChanges, navigate]);

    // Save and then navigate back
    const handleSaveAndLeave = useCallback(async () => {
        setIsSavingAndLeaving(true);
        try {
            await handleSave();
            // After successful save, hasChanges will be false, navigate back
            navigate(-1);
        } catch (err) {
            // Save failed, stay on page
            console.error('Save failed during exit:', err);
        } finally {
            setIsSavingAndLeaving(false);
            setShowUnsavedDialog(false);
        }
    }, [navigate]);

    // Discard changes and navigate back
    const handleDiscardAndLeave = useCallback(() => {
        setHasChanges(false);
        setShowUnsavedDialog(false);
        navigate(-1);
    }, [navigate]);

    // Run preflight checks
    const runPreflight = useCallback(() => {
        const canvas = editorRef.current?.getCanvas();
        if (!canvas) return;

        const result = runPreflightChecks(canvas, {
            documentWidth: documentSpec.width_mm,
            documentHeight: documentSpec.height_mm,
            bleed: documentSpec.bleed_mm,
            safeArea: 3,
            minDPI: 150,
            targetDPI: 300,
            mmToPx: MM_TO_PX,
        });

        setPreflightWarnings(result.warnings);
        setPreflightErrors(result.errors);
        setPreflightInfos(result.infos);
        setActiveTab('preflight');

        if (result.passed && result.warnings.length === 0) {
            toast.success('Preflight bestået! Designet er klar til eksport.');
        } else if (result.errors.length > 0) {
            toast.error(`Preflight fandt ${result.errors.length} fejl`);
        } else {
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
        setSelectedTool(toolId);

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
            case 'image':
                fileInputRef.current?.click();
                break;
            case 'pdf':
                setShowPDFImport(true);
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
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();

            console.log(`[PDF Import] ${Math.round(data.widthMm)}×${Math.round(data.heightMm)}mm rendered at scale ${scale.toFixed(3)}`);
        }, { crossOrigin: 'anonymous' });
    }, []);

    // Save design
    const handleSave = async () => {
        try {
            setSaving(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Du skal være logget ind for at gemme");
                navigate('/auth?redirect=/designer');
                return;
            }

            const editorJson = editorRef.current?.getJSON() || {};

            const designData = {
                user_id: user.id,
                name: documentSpec.name,
                width_mm: documentSpec.width_mm,
                height_mm: documentSpec.height_mm,
                bleed_mm: documentSpec.bleed_mm,
                dpi: documentSpec.dpi,
                color_profile: documentSpec.color_profile,
                template_id: documentSpec.template_id,
                product_id: documentSpec.product_id,
                editor_json: editorJson,
                preflight_warnings: [...preflightWarnings, ...preflightErrors, ...preflightInfos],
                preflight_errors_count: preflightErrors.length,
                preflight_warnings_count: preflightWarnings.length,
                warnings_accepted: dismissedWarnings.size > 0,
                warnings_accepted_at: dismissedWarnings.size > 0 ? new Date().toISOString() : null,
                tenant_id: '00000000-0000-0000-0000-000000000000',
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
                toast.success("Design gemt!");
                setHasChanges(false);

                if (data) {
                    navigate(`/designer?designId=${(data as any).id}`, { replace: true });
                }
            }
        } catch (err: any) {
            console.error("Save error:", err);
            toast.error("Kunne ikke gemme: " + err.message);
        } finally {
            setSaving(false);
        }
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

            // 1. Transform to CMYK and get proofed RGB
            const { cmykData, proofedRgbDataUrl, width, height } = await colorProofing.exportCMYK(
                SRGB_PROFILE_URL,
                profile.url
            );

            if (cmykData.length === 0) {
                toast.warning("ICC-profiler blev ikke fundet. Eksporterer optimeret RGB PDF i stedet.");
            }

            // 2. Create PDF
            const fullWidth = documentSpec.width_mm + (documentSpec.bleed_mm * 2);
            const fullHeight = documentSpec.height_mm + (documentSpec.bleed_mm * 2);

            const doc = new jsPDF({
                orientation: fullWidth > fullHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [fullWidth, fullHeight]
            });

            // 3. Add CMYK-simulated Image
            // We use the proofedRgbDataUrl which contains the color-transformed pixels
            doc.addImage(proofedRgbDataUrl, 'PNG', 0, 0, fullWidth, fullHeight, undefined, 'SLOW');

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

        if (item.kind === 'fabric_json' && item.fabric_json) {
            editorRef.current?.loadJSON(item.fabric_json);

            // If it's a saved design (from 'mine' tab), update the URL
            if (item.created_at) { // Simple check to see if it's from the hook's 'mine' mapping
                navigate(`/designer?designId=${item.id}`, { replace: true });
            }

            toast.success("Design åbnet!");
            setHasChanges(false);
        } else {
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
        { id: "rectangle", icon: Square, label: "Rektangel (R)" },
        { id: "circle", icon: Circle, label: "Cirkel (C)" },
        { id: "line", icon: Minus, label: "Linje (L)" },
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
                case 'r': if (!hasModifier) handleToolClick('rectangle'); break;
                case 'c':
                    if (!hasModifier) {
                        handleToolClick('circle');
                    }
                    // If meta/ctrl is pressed, we let the browser handle the standard Copy action
                    break;
                case 'l': if (!hasModifier) handleToolClick('line'); break;
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
        dragCounterRef.current = 0;
        setIsDraggingFile(false);

        const files = Array.from(e.dataTransfer.files);
        const pdfFile = files.find(f =>
            f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        );
        const imageFile = files.find(f => f.type.startsWith('image/'));

        if (pdfFile) {
            // Open PDF import modal - the modal will handle the file via state
            setShowPDFImport(true);
            // We need to pass the file to the modal - store it temporarily
            (window as any).__pendingPdfFile = pdfFile;
            toast.info('PDF modtaget - vælg side at importere');
        } else if (imageFile) {
            // Handle image drop directly
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                editorRef.current?.addImage(dataUrl);
            };
            reader.readAsDataURL(imageFile);
            toast.success('Billede tilføjet!');
        } else if (files.length > 0) {
            toast.error('Kun PDF- og billedfiler understøttes');
        }
    }, []);

    // Calculate canvas dimensions (needed for useColorProofing hook)
    // Must match EditorCanvas: document size + pasteboard on all sides
    const PASTEBOARD_PADDING = 100; // Must match EditorCanvas
    const docWidth = (documentSpec.width_mm + documentSpec.bleed_mm * 2) * MM_TO_PX;
    const docHeight = (documentSpec.height_mm + documentSpec.bleed_mm * 2) * MM_TO_PX;
    const canvasWidth = docWidth + PASTEBOARD_PADDING * 2;
    const canvasHeight = docHeight + PASTEBOARD_PADDING * 2;

    // Fetch product's assigned color profile (if productId is present)
    const { profile: productProfile } = useProductColorProfile({
        productId: documentSpec.product_id,
        enabled: Boolean(documentSpec.product_id),
    });

    // Color proofing hook - must be called unconditionally (before any early returns)
    // Pass custom profile data if available from the product
    const colorProofing = useColorProofing({
        fabricCanvas: editorRef.current?.getCanvas() || null,
        overlayCanvasRef: proofingOverlayRef,
        canvasWidth,
        canvasHeight,
        docWidth,
        docHeight,
        pasteboardOffset: PASTEBOARD_PADDING,
        customProfileId: productProfile.id || undefined,
        customProfileName: productProfile.name || undefined,
        customProfileBytes: productProfile.profileBytes,
    });

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <>
            <SEO
                title="Print Designer - Webprinter.dk"
                description="Design dit print online med vores brugervenlige designer"
            />

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
            />

            <PDFImportModal
                open={showPDFImport}
                onClose={() => setShowPDFImport(false)}
                onImport={handlePDFImport}
                maxWidth={canvasWidth}
                maxHeight={canvasHeight}
            />

            <DesignLibraryDrawer
                open={isLibraryOpen}
                onOpenChange={setIsLibraryOpen}
                productId={documentSpec.product_id}
                onInsertDesign={handleInsertDesign}
                onReplaceDesign={handleReplaceDesign}
            />

            <div
                className="min-h-screen flex flex-col bg-muted/30 relative"
                onDragEnter={handleGlobalDragEnter}
                onDragOver={handleGlobalDragOver}
                onDragLeave={handleGlobalDragLeave}
                onDrop={handleGlobalDrop}
            >
                {/* Global drop overlay */}
                {isDraggingFile && (
                    <div className="absolute inset-0 z-[100] bg-primary/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                        <div className="bg-background border-2 border-dashed border-primary rounded-xl p-8 shadow-2xl">
                            <FileUp className="h-16 w-16 mx-auto text-primary mb-4" />
                            <p className="text-lg font-semibold text-center">Slip filen her</p>
                            <p className="text-sm text-muted-foreground text-center mt-1">PDF eller billede</p>
                        </div>
                    </div>
                )}

                {/* Top Bar */}
                <header className="h-14 border-b bg-background flex items-center px-4 gap-4 sticky top-0 z-50">
                    <Button variant="ghost" size="icon" onClick={handleBackClick}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>

                    <input
                        type="text"
                        value={documentSpec.name}
                        onChange={(e) => {
                            setDocumentSpec(prev => ({ ...prev, name: e.target.value }));
                            setHasChanges(true);
                        }}
                        className="font-semibold bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-2 py-1 max-w-[250px]"
                    />

                    {hasChanges && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">• Ikke gemt</span>
                    )}

                    {/* Center: Document Info */}
                    <div className="flex-1 flex items-center justify-center gap-6 text-sm text-muted-foreground">
                        <span className="font-medium flex items-center gap-1">
                            <Settings2 className="h-4 w-4" />
                            {documentSpec.width_mm} × {documentSpec.height_mm} mm
                        </span>
                        {documentSpec.format && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                                {documentSpec.format}
                            </span>
                        )}
                        <span>Bleed: {documentSpec.bleed_mm} mm</span>
                        <span>DPI: {documentSpec.dpi}</span>
                        <span className="text-xs px-2 py-0.5 bg-muted rounded">{documentSpec.color_profile}</span>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        {/* Preflight button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={runPreflight}
                            className={`gap-2 ${totalWarningsCount > 0 ? 'text-amber-600 border-amber-300' : ''}`}
                        >
                            <FileCheck className="h-4 w-4" />
                            Preflight
                            {totalWarningsCount > 0 && (
                                <span className="bg-amber-500 text-white text-xs px-1.5 rounded-full">
                                    {totalWarningsCount}
                                </span>
                            )}
                        </Button>

                        <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            <span className="ml-2">Gem</span>
                        </Button>

                        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                            <Download className="h-4 w-4" />
                            Eksporter
                        </Button>

                        {documentSpec.product_id && (
                            <Button size="sm" className="gap-2" onClick={handleAddToOrder}>
                                <ShoppingCart className="h-4 w-4" />
                                Bestil
                            </Button>
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex">
                    {/* Left Toolbar */}
                    <aside className="w-16 bg-background border-r flex flex-col items-center py-4 gap-1">
                        {tools.map((tool) => (
                            <Button
                                key={tool.id}
                                variant={selectedTool === tool.id ? "default" : "ghost"}
                                size="icon"
                                onClick={() => handleToolClick(tool.id)}
                                title={tool.label}
                                className="h-10 w-10"
                            >
                                <tool.icon className="h-5 w-5" />
                            </Button>
                        ))}

                        <div className="h-px w-10 bg-border my-2" />

                        {/* Design Library */}
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Design Bibliotek"
                            className="h-10 w-10 text-primary"
                            onClick={() => setIsLibraryOpen(true)}
                        >
                            <LayoutGrid className="h-5 w-5" />
                        </Button>

                        {/* PDF Import */}
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Importer PDF"
                            className="h-10 w-10"
                            onClick={() => setShowPDFImport(true)}
                        >
                            <FileUp className="h-5 w-5" />
                        </Button>

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

                        <div className="flex-1" />

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
                    </aside>

                    {/* Canvas Area */}
                    <main className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[#e5e5e5]">
                        <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
                            <EditorCanvas
                                ref={editorRef}
                                width={documentSpec.width_mm}
                                height={documentSpec.height_mm}
                                bleed={documentSpec.bleed_mm}
                                dpi={documentSpec.dpi}
                                selectedTool={selectedTool}
                                onSelectionChange={handleSelectionChange}
                                onCanvasChange={() => setHasChanges(true)}
                                onLayersChange={handleLayersChange}
                            />
                            {/* Soft proofing overlay - positioned over document area only */}
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
                            {/* Soft proof indicator */}
                            {colorProofing.settings.enabled && (
                                <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded shadow-lg flex items-center gap-1">
                                    <Palette className="h-3 w-3" />
                                    CMYK Preview
                                    {colorProofing.isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                                </div>
                            )}

                            {/* Live Dimensions Label */}
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
        </>
    );
}

export default Designer;
