/**
 * Pricing Hub - Main Page
 * 
 * A dedicated section for managing CSV price imports with:
 * - Folders/categories for organization
 * - Drag-and-drop file uploads
 * - Project workspaces for combining imports
 * - Preview and publish to products
 * 
 * STANDALONE MODULE: Does not modify any existing pricing logic
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    FolderPlus,
    FilePlus,
    Upload,
    Download,
    FileSpreadsheet,
    MoreVertical,
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Trash2,
    Edit,
    Copy,
    Package,
    Plus,
    FileDown,
    FileUp,
    Loader2,
    Check,
    X,
    Layers,
    Eye,
    Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePricingHub } from "@/hooks/usePricingHub";
import { cn } from "@/lib/utils";
import { PricePreviewTable } from "@/components/admin/pricing-hub/PricePreviewTable";
import { PublishDialog } from "@/components/admin/pricing-hub/PublishDialog";
import { PriceMatrixBuilder } from "@/components/admin/pricing-hub/PriceMatrixBuilder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PricingHub() {
    const {
        folders,
        projects,
        selectedProject,
        setSelectedProject,
        loading,
        createFolder,
        createProject,
        deleteFolder,
        deleteProject,
        renameFolder,
        renameProject,
        uploadCSV,
        refreshData,
    } = usePricingHub();

    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
    const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
    const [newItemName, setNewItemName] = useState("");
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [activeTab, setActiveTab] = useState<"import" | "builder" | "preview">("import");
    type ExportMapping = {
        mapping: {
            formats: { originalValue: string; displayName: string; widthMm?: number | null; heightMm?: number | null; imageUrl?: string }[];
            materials: { originalValue: string; displayName: string; imageUrl?: string }[];
            finishes: { originalValue: string; displayName: string; imageUrl?: string }[];
        };
        quantities?: number[];
    };

    const [exportMapping, setExportMapping] = useState<ExportMapping | null>(null);

    // Toggle folder expansion
    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    // Handle new folder creation
    const handleCreateFolder = async () => {
        if (!newItemName.trim()) return;
        await createFolder(newItemName.trim(), selectedFolderId);
        setNewItemName("");
        setShowNewFolderDialog(false);
    };

    // Handle new project creation
    const handleCreateProject = async () => {
        if (!newItemName.trim()) return;
        await createProject(newItemName.trim(), selectedFolderId);
        setNewItemName("");
        setShowNewProjectDialog(false);
    };

    // Handle file drop
    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingFile(false);

        if (!selectedProject) {
            toast.error("Vælg et projekt først for at uploade CSV-filer");
            return;
        }

        const files = Array.from(e.dataTransfer.files);
        const csvFiles = files.filter(f => f.name.endsWith(".csv"));

        if (csvFiles.length === 0) {
            toast.error("Kun CSV-filer understøttes");
            return;
        }

        setUploadingFile(true);
        for (const file of csvFiles) {
            await uploadCSV(selectedProject.id, file);
        }
        setUploadingFile(false);
    }, [selectedProject, uploadCSV]);

    // Handle file input
    const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedProject || !e.target.files?.length) return;

        setUploadingFile(true);
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.name.endsWith(".csv")) {
                await uploadCSV(selectedProject.id, file);
            }
        }
        setUploadingFile(false);
        e.target.value = "";
    };

    // Export combined data as CSV in Smart Price Generator format
    const exportAsCSV = useCallback(() => {
        if (!selectedProject?.combined_data?.length) {
            toast.error("Ingen data at eksportere");
            return;
        }
        if (!exportMapping) {
            toast.error("Gå først til Matrix Builder og opret layout");
            return;
        }

        // Get detected attributes and mapping
        const attrs = selectedProject.detected_attributes || {};
        const mapping = exportMapping.mapping;
        const quantities = exportMapping.quantities || attrs.quantities || [];

        if (quantities.length === 0) {
            toast.error("Ingen antal (quantities) fundet i data");
            return;
        }

        const sortedQuantities = [...quantities].sort((a, b) => a - b);
        const hasFinishes = mapping.finishes.length > 0;

        // Build meta object for Smart Price Generator
        const meta = {
            version: 2,
            vertical_axis: {
                sectionId: 'vertical-axis',
                sectionType: 'materials',
                groupId: '',
                label: 'Materiale',
                valueSettings: {}
            },
            layout_rows: [
                {
                    id: 'row-1',
                    title: '',
                    description: '',
                    columns: [
                        {
                            id: 'format-section',
                            sectionType: 'formats',
                            groupId: '',
                            ui_mode: 'buttons',
                            selection_mode: 'required',
                            valueSettings: {},
                            title: 'Format',
                            description: ''
                        },
                        ...(hasFinishes ? [{
                            id: 'finish-section',
                            sectionType: 'finishes',
                            groupId: '',
                            ui_mode: 'buttons',
                            selection_mode: 'required',
                            valueSettings: {},
                            title: 'Finish',
                            description: ''
                        }] : [])
                    ]
                }
            ],
            quantities: sortedQuantities
        };

        // Build headers: Materiale; Format; [Finish;] Qty1; Qty2; ...
        const humanHeaders = [
            'Materiale',
            'Format',
            ...(hasFinishes ? ['Finish'] : []),
            ...sortedQuantities.map(q => String(q))
        ];

        // Build data rows
        const csvRows: string[] = [];

        // Row 1: Meta header
        csvRows.push(`#meta;${JSON.stringify(meta)}`);

        // Row 2: Human headers
        csvRows.push(humanHeaders.join(';'));

        // Get column map for finding data
        const columnMap = attrs.columnMap || {};
        const qtyCol = columnMap.quantity || 'Quantity';
        const sizeCol = columnMap.size || 'Size';
        const materialCol = columnMap.material || columnMap.paperWeight || 'Material';
        const paperWeightCol = columnMap.paperWeight || 'Paper weight';
        const finishCol = columnMap.finish || 'Finish';
        const priceCol = columnMap.price || 'Price (DKK)';

        console.log('[CSV Export] columnMap:', JSON.stringify(columnMap));
        console.log('[CSV Export] Using columns:', { qtyCol, sizeCol, materialCol, paperWeightCol, finishCol, priceCol });

        const data = selectedProject.combined_data;
        const firstRow = data[0] || {};
        console.log('[CSV Export] First row keys:', Object.keys(firstRow).join(', '));
        console.log('[CSV Export] First row values:', {
            qty: firstRow[qtyCol],
            size: firstRow[sizeCol],
            material: firstRow[materialCol],
            paperWeight: firstRow[paperWeightCol],
            finish: firstRow[finishCol],
            price: firstRow[priceCol]
        });

        // Group prices by material+format+finish → quantity → price
        // Key: "material|format|finish" → { qty1: price1, qty2: price2, ... }
        const priceMatrix: Record<string, Record<number, number>> = {};

        // Normalization helper - strips trailing g/gsm/gram from paper weights
        const normalizeToken = (val: string) => {
            return val.trim().toLowerCase().replace(/[.,\s_-]+/g, '');
        };

        const normalizeForKey = (val: string) => {
            return normalizeToken(val.replace(/\s*(g|gsm|gram)$/i, ''));
        };

        data.forEach((row: any, idx: number) => {
            const qty = parseInt(String(row[qtyCol] || '0'));
            const format = String(row[sizeCol] || '').trim();
            const material = String(row[materialCol] || row[paperWeightCol] || '').trim();
            const finish = String(row[finishCol] || '').trim();
            const priceStr = String(row[priceCol] || '');
            const price = parseInt(priceStr.replace(/[^\d]/g, ''), 10);

            if (idx === 0) {
                console.log('[CSV Export] Row 0 extracted:', { qty, format, material, finish, price });
            }

            if (qty && !isNaN(price) && format && material) {
                // Use normalized material value for consistent matching
                const key = `${normalizeForKey(material)}|${normalizeToken(format)}|${normalizeToken(finish)}`;
                if (!priceMatrix[key]) {
                    priceMatrix[key] = {};
                }
                priceMatrix[key][qty] = price;
            }
        });

        console.log('[CSV Export] Price matrix entries:', Object.keys(priceMatrix).length);
        console.log('[CSV Export] Sample data keys:', Object.keys(priceMatrix).slice(0, 3).join(' | '));
        console.log('[CSV Export] Mapping materials:', mapping.materials.map((m: any) => m.originalValue).join(', '));
        console.log('[CSV Export] Mapping formats:', mapping.formats.map((f: any) => f.originalValue).join(', '));
        console.log('[CSV Export] Mapping finishes:', mapping.finishes.map((f: any) => f.originalValue).join(', '));

        // Now generate output rows from the mapping
        let isFirstRow = true;
        for (const material of mapping.materials) {
            const materialVal = material.originalValue;

            for (const format of mapping.formats) {
                const formatVal = format.originalValue;

                if (hasFinishes) {
                    for (const finish of mapping.finishes) {
                        const finishVal = finish.originalValue;
                        // Use normalized material for consistent matching
                        const key = `${normalizeForKey(materialVal)}|${normalizeToken(formatVal)}|${normalizeToken(finishVal)}`;
                        const priceRow = priceMatrix[key] || {};

                        if (isFirstRow) {
                            console.log('[CSV Export] First search key:', key);
                            console.log('[CSV Export] First data key:', Object.keys(priceMatrix)[0]);
                            console.log('[CSV Export] Match:', priceMatrix[key] ? 'YES' : 'NO');
                            console.log('[CSV Export] PriceRow qtys:', Object.keys(priceRow).join(', '));
                            console.log('[CSV Export] sortedQuantities:', sortedQuantities.slice(0, 5).join(', ') + '...');
                            console.log('[CSV Export] First few prices:', sortedQuantities.slice(0, 3).map(q => `${q}=${priceRow[q]}`).join(', '));
                            isFirstRow = false;
                        }

                        const prices = sortedQuantities.map(qty => priceRow[qty] ?? '');

                        csvRows.push([
                            material.displayName || materialVal,
                            format.displayName || formatVal,
                            finish.displayName || finishVal,
                            ...prices
                        ].join(';'));
                    }
                } else {
                    // No finishes - use normalized material
                    const key = `${normalizeForKey(materialVal)}|${normalizeToken(formatVal)}|`;
                    const priceRow = priceMatrix[key] || {};

                    const prices = sortedQuantities.map(qty => priceRow[qty] ?? '');

                    csvRows.push([
                        material.displayName || materialVal,
                        format.displayName || formatVal,
                        ...prices
                    ].join(';'));
                }
            }
        }

        // Create and download file
        const csvContent = csvRows.join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedProject.name.replace(/[^a-zA-Z0-9]/g, "_")}_prisliste.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        const pricesFound = Object.keys(priceMatrix).length;
        toast.success(`CSV eksporteret med ${pricesFound} prisgrupper`);
    }, [selectedProject, exportMapping]);

    // Download CSV template
    const downloadTemplate = () => {
        const template = `Format,Material,Efterbehandling,Antal,Pris
A5,80g Silk,,100,99.00
A5,80g Silk,,250,149.00
A5,80g Silk,Lak,100,129.00
A5,120g Gloss,,100,119.00
A4,80g Silk,,100,149.00
A4,80g Silk,,250,199.00
A4,120g Gloss,,100,169.00`;

        const blob = new Blob([template], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "pricing_template.csv";
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Skabelon downloadet");
    };

    // Render folder tree recursively
    const renderFolderTree = (parentId: string | null = null, depth: number = 0) => {
        const folderList = folders.filter(f => f.parent_id === parentId);
        const projectList = parentId === null
            ? projects.filter(p => !p.folder_id)
            : projects.filter(p => p.folder_id === parentId);

        return (
            <>
                {folderList.map(folder => {
                    const isExpanded = expandedFolders.has(folder.id);
                    const childFolders = folders.filter(f => f.parent_id === folder.id);
                    const childProjects = projects.filter(p => p.folder_id === folder.id);
                    const hasChildren = childFolders.length > 0 || childProjects.length > 0;

                    return (
                        <div key={folder.id}>
                            <div
                                className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 group",
                                    selectedFolderId === folder.id && "bg-muted"
                                )}
                                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                                onClick={() => {
                                    setSelectedFolderId(folder.id);
                                    if (hasChildren) toggleFolder(folder.id);
                                }}
                            >
                                {hasChildren ? (
                                    isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <div className="w-4" />
                                )}
                                {isExpanded ? (
                                    <FolderOpen className="h-4 w-4 text-amber-500" />
                                ) : (
                                    <Folder className="h-4 w-4 text-amber-500" />
                                )}
                                <span className="text-sm flex-1 truncate">{folder.name}</span>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => {
                                            setSelectedFolderId(folder.id);
                                            setShowNewFolderDialog(true);
                                        }}>
                                            <FolderPlus className="h-4 w-4 mr-2" />
                                            Ny undermappe
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                            setSelectedFolderId(folder.id);
                                            setShowNewProjectDialog(true);
                                        }}>
                                            <FilePlus className="h-4 w-4 mr-2" />
                                            Nyt projekt
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => deleteFolder(folder.id)} className="text-destructive">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Slet mappe
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            {isExpanded && renderFolderTree(folder.id, depth + 1)}
                        </div>
                    );
                })}

                {projectList.map(project => (
                    <div
                        key={project.id}
                        className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 group",
                            selectedProject?.id === project.id && "bg-primary/10 border-l-2 border-primary"
                        )}
                        style={{ paddingLeft: `${depth * 16 + 24}px` }}
                        onClick={() => setSelectedProject(project)}
                    >
                        <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                        <span className="text-sm flex-1 truncate">{project.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5">
                            {project.status === "draft" ? "Kladde" : project.status === "ready" ? "Klar" : "Udgivet"}
                        </Badge>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => deleteProject(project.id)} className="text-destructive">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Slet projekt
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ))}
            </>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Pricing Hub</h1>
                    <p className="text-sm text-muted-foreground">
                        Importer, organiser og kombiner prislister fra CSV-filer
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={downloadTemplate}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Hent skabelon
                    </Button>
                    <Button size="sm" onClick={() => setShowNewProjectDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nyt projekt
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Sidebar - Folder Tree */}
                <div className="col-span-3">
                    <Card className="h-[calc(100vh-220px)]">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">Projekter</CardTitle>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => {
                                            setSelectedFolderId(null);
                                            setShowNewFolderDialog(true);
                                        }}
                                    >
                                        <FolderPlus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => {
                                            setSelectedFolderId(null);
                                            setShowNewProjectDialog(true);
                                        }}
                                    >
                                        <FilePlus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <ScrollArea className="h-[calc(100%-60px)]">
                            <div className="px-2 pb-4">
                                {folders.length === 0 && projects.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>Ingen projekter endnu</p>
                                        <p className="text-xs mt-1">Opret et projekt for at starte</p>
                                    </div>
                                ) : (
                                    renderFolderTree()
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </div>

                {/* Main Content - Project Workspace */}
                <div className="col-span-9">
                    <Card className="h-[calc(100vh-220px)]">
                        {selectedProject ? (
                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
                                <CardHeader className="pb-0">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>{selectedProject.name}</CardTitle>
                                            <CardDescription>
                                                {selectedProject.imports?.length || 0} importer ·
                                                {selectedProject.combined_data?.length || 0} rækker
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <TabsList className="mt-4 grid w-full grid-cols-3">
                                        <TabsTrigger value="import" className="flex items-center gap-2">
                                            <Upload className="h-4 w-4" />
                                            Import
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="builder"
                                            className="flex items-center gap-2"
                                            disabled={(selectedProject.combined_data?.length || 0) === 0}
                                        >
                                            <Layers className="h-4 w-4" />
                                            Matrix Builder
                                        </TabsTrigger>
                                        <TabsTrigger value="preview" className="flex items-center gap-2">
                                            <Eye className="h-4 w-4" />
                                            Forhåndsvisning
                                        </TabsTrigger>
                                    </TabsList>
                                </CardHeader>

                                <Separator className="mt-4" />

                                <CardContent className="flex-1 overflow-auto pt-4">
                                    {/* Import Tab */}
                                    <TabsContent value="import" className="mt-0 h-full">
                                        {/* Drop Zone */}
                                        <div
                                            className={cn(
                                                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                                                isDraggingFile ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                                                uploadingFile && "opacity-50 pointer-events-none"
                                            )}
                                            onDragOver={e => {
                                                e.preventDefault();
                                                setIsDraggingFile(true);
                                            }}
                                            onDragLeave={() => setIsDraggingFile(false)}
                                            onDrop={handleDrop}
                                        >
                                            {uploadingFile ? (
                                                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                                            ) : (
                                                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                            )}
                                            <p className="text-sm text-muted-foreground mb-1">
                                                Træk CSV-filer hertil, eller
                                            </p>
                                            <div className="flex items-center justify-center gap-2">
                                                <label className="cursor-pointer">
                                                    <span className="text-sm text-primary hover:underline">
                                                        vælg filer
                                                    </span>
                                                    <input
                                                        type="file"
                                                        accept=".csv"
                                                        multiple
                                                        className="hidden"
                                                        onChange={handleFileInput}
                                                    />
                                                </label>
                                                <span className="text-sm text-muted-foreground">eller</span>
                                                <Button variant="link" size="sm" className="p-0 h-auto" onClick={downloadTemplate}>
                                                    <Download className="h-3 w-3 mr-1" />
                                                    download skabelon
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Imported files list */}
                                        {selectedProject.imports && selectedProject.imports.length > 0 && (
                                            <div className="mt-6">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-sm font-medium">Importerede filer</h3>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={async () => {
                                                            if (!confirm("Slet alle importerede data og start forfra?")) return;
                                                            // Clear the project data
                                                            const { error } = await supabase
                                                                .from("pricing_hub_projects" as any)
                                                                .update({
                                                                    combined_data: [],
                                                                    detected_attributes: {},
                                                                    updated_at: new Date().toISOString(),
                                                                })
                                                                .eq("id", selectedProject.id);
                                                            if (!error) {
                                                                toast.success("Data slettet");
                                                                refreshData();
                                                                setExportMapping(null);
                                                            }
                                                        }}
                                                    >
                                                        <X className="h-4 w-4 mr-1" />
                                                        Ryd data
                                                    </Button>
                                                </div>
                                                <div className="space-y-2">
                                                    {selectedProject.imports.map((imp) => (
                                                        <div
                                                            key={imp.id}
                                                            className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                                                        >
                                                            <FileSpreadsheet className="h-5 w-5 text-green-500" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{imp.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {imp.row_count} rækker · {imp.original_filename}
                                                                </p>
                                                            </div>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {Object.keys(imp.attributes_detected || {}).length} attributter
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Continue to Matrix Builder button */}
                                                {selectedProject.combined_data && selectedProject.combined_data.length > 0 && (
                                                    <div className="mt-6 text-center">
                                                        <Button onClick={() => setActiveTab("builder")}>
                                                            <Layers className="h-4 w-4 mr-2" />
                                                            Fortsæt til Matrix Builder
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </TabsContent>

                                    {/* Matrix Builder Tab */}
                                    <TabsContent value="builder" className="mt-0 h-full">
                                        <PriceMatrixBuilder
                                            combinedData={selectedProject.combined_data || []}
                                            detectedAttributes={selectedProject.detected_attributes || {}}
                                            onMappingComplete={(mapping, quantities) => {
                                                setExportMapping({ mapping, quantities });
                                                setActiveTab("preview");
                                            }}
                                        />
                                    </TabsContent>

                                    {/* Preview Tab */}
                                    <TabsContent value="preview" className="mt-0 h-full">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold">Klar til eksport</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Download CSV og importer i produktets prisgenerator
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setShowPublishDialog(true)}
                                                        disabled={!exportMapping}
                                                        className="border-blue-200 hover:bg-blue-50 text-blue-700 dark:border-blue-800 dark:hover:bg-blue-900/20 dark:text-blue-300"
                                                    >
                                                        <Send className="h-4 w-4 mr-2" />
                                                        Udgiv til produkt
                                                    </Button>
                                                    <Button onClick={exportAsCSV} className="bg-green-600 hover:bg-green-700">
                                                        <Download className="h-4 w-4 mr-2" />
                                                        Download prisliste (CSV)
                                                    </Button>
                                                </div>
                                            </div>
                                            <PricePreviewTable
                                                data={selectedProject.combined_data || []}
                                                detectedAttributes={selectedProject.detected_attributes}
                                            />
                                        </div>
                                    </TabsContent>
                                </CardContent>
                            </Tabs>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                <h3 className="text-lg font-medium mb-1">Vælg et projekt</h3>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    Vælg et projekt fra venstre side for at se og redigere prisimporter,
                                    eller opret et nyt projekt for at komme i gang.
                                </p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* New Folder Dialog */}
            <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Ny mappe</DialogTitle>
                        <DialogDescription>
                            Opret en ny mappe til at organisere dine projekter
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        placeholder="Mappenavn"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
                            Annuller
                        </Button>
                        <Button onClick={handleCreateFolder}>Opret</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Project Dialog */}
            <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Nyt projekt</DialogTitle>
                        <DialogDescription>
                            Opret et nyt projekt til at kombinere CSV-importer
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        placeholder="Projektnavn"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCreateProject()}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
                            Annuller
                        </Button>
                        <Button onClick={handleCreateProject}>Opret</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Publish Dialog */}
            {selectedProject && (
                <PublishDialog
                    open={showPublishDialog}
                    onOpenChange={setShowPublishDialog}
                    projectName={selectedProject.name}
                    combinedData={selectedProject.combined_data || []}
                    detectedAttributes={selectedProject.detected_attributes}
                    exportMapping={exportMapping}
                    onPublishComplete={() => refreshData()}
                />
            )}
        </div>
    );
}

export default PricingHub;
