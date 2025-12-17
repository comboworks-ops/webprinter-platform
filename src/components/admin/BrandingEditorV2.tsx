
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Loader2, Save, RotateCcw, Send, Trash2, List,
    X, ChevronRight, Layout, Type, Palette, Sparkles, Image as ImageIcon,
    ExternalLink, Monitor, Smartphone, Tablet
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { da } from "date-fns/locale";

import { BrandingPreviewFrame } from "@/components/admin/BrandingPreviewFrame";
import { FontSelector } from "@/components/admin/FontSelector";
import { IconPackSelector } from "@/components/admin/IconPackSelector";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { ProductAssetsSection } from "@/components/admin/ProductAssetsSection";
import { HeaderSection } from "@/components/admin/HeaderSection";
import { FooterSection } from "@/components/admin/FooterSection";
import { BannerEditor } from "@/components/admin/BannerEditor";
import { LogoSection } from "@/components/admin/LogoSection";
import { ContentBlocksSection } from "@/components/admin/ContentBlocksSection";

import {
    type BrandingStorageAdapter,
    type BrandingCapabilities,
    useBrandingEditor,
} from "@/lib/branding";

interface BrandingEditorV2Props {
    adapter: BrandingStorageAdapter;
    capabilities: BrandingCapabilities;
    onSwitchVersion?: () => void;
}

export function BrandingEditorV2({ adapter, capabilities, onSwitchVersion }: BrandingEditorV2Props) {
    const editor = useBrandingEditor({ adapter, capabilities });
    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // Dialog States
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [publishLabel, setPublishLabel] = useState("");
    const [showSaveDesignDialog, setShowSaveDesignDialog] = useState(false);
    const [saveDesignName, setSaveDesignName] = useState("");
    const [showSavedDesignsDialog, setShowSavedDesignsDialog] = useState(false);
    const [showResetDialog, setShowResetDialog] = useState(false);

    const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

    // Listen for click events from preview
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'EDIT_SECTION') {
                const { sectionId } = event.data;
                console.log("Branding Editor received click:", sectionId);

                // Map branding IDs to internal sections
                if (sectionId === 'header.logo') {
                    setActiveSection('logo');
                } else if (sectionId === 'header' || sectionId === 'header.menu') {
                    setActiveSection('header');
                } else if (sectionId === 'forside.hero') {
                    setActiveSection('banner');
                } else if (sectionId === 'footer') {
                    setActiveSection('footer');
                } else if (sectionId === 'content' || sectionId.startsWith('block-')) {
                    setActiveSection('content');
                    if (sectionId.startsWith('block-')) {
                        setFocusedBlockId(sectionId);
                    }
                } else {
                    // Fallback or generic handling
                    setActiveSection(sectionId);
                }

                setSidebarOpen(true);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // ... existing publish/save handlers ...

    // ... inside renderSidebarContent switch ...


    // Handle Publish
    const handlePublish = async () => {
        if (editor.hasUnsavedChanges) {
            await editor.saveDraft();
        }
        await editor.publish(publishLabel || undefined);
        setShowPublishDialog(false);
        setPublishLabel("");
    };

    // Handle Save Design
    const handleSaveDesign = async () => {
        if (!saveDesignName.trim()) {
            toast.error("Giv venligst dit design et navn");
            return;
        }
        await editor.saveDesign(saveDesignName);
        setSaveDesignName("");
        setShowSaveDesignDialog(false);
    };

    const formatDate = (timestamp: string) => {
        try {
            return format(new Date(timestamp), "d. MMM yyyy", { locale: da });
        } catch {
            return timestamp;
        }
    };

    if (editor.isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const renderSidebarContent = () => {
        if (!activeSection) {
            return (
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground p-4">
                        Klik på elementer i forhåndsvisningen for at redigere dem, eller vælg en sektion herunder.
                    </p>
                    <div className="grid gap-2 px-4">
                        <Button variant="outline" className="justify-start" onClick={() => setActiveSection('logo')}>
                            <ImageIcon className="mr-2 h-4 w-4" /> Logo
                        </Button>
                        <Button variant="outline" className="justify-start" onClick={() => setActiveSection('header')}>
                            <Layout className="mr-2 h-4 w-4" /> Header & Navigation
                        </Button>
                        {capabilities.sections.typography && (
                            <Button variant="outline" className="justify-start" onClick={() => setActiveSection('typography')}>
                                <Type className="mr-2 h-4 w-4" /> Typografi
                            </Button>
                        )}
                        {capabilities.sections.colors && (
                            <Button variant="outline" className="justify-start" onClick={() => setActiveSection('colors')}>
                                <Palette className="mr-2 h-4 w-4" /> Farver
                            </Button>
                        )}
                        <Button variant="outline" className="justify-start" onClick={() => setActiveSection('banner')}>
                            <ImageIcon className="mr-2 h-4 w-4" /> Banner (Hero)
                        </Button>
                        <Button variant="outline" className="justify-start" onClick={() => setActiveSection('content')}>
                            <Layout className="mr-2 h-4 w-4" /> Indholdsblokke
                        </Button>
                        <Button variant="outline" className="justify-start" onClick={() => setActiveSection('footer')}>
                            <Layout className="mr-2 h-4 w-4" /> Footer
                        </Button>
                        {capabilities.sections.iconPacks && (
                            <Button variant="outline" className="justify-start" onClick={() => setActiveSection('icons')}>
                                <Sparkles className="mr-2 h-4 w-4" /> Produkt billeder & ikoner
                            </Button>
                        )}
                    </div>
                </div>
            );
        }

        switch (activeSection) {
            case 'logo':
                return (
                    <div className="space-y-4 px-4 pb-8">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Logo</h3>
                            <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <LogoSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'header':
                return (
                    <div className="space-y-4 px-4 pb-8">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Header</h3>
                            <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <HeaderSection
                            header={editor.draft.header}
                            onChange={(header) => editor.updateDraft({ header })}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'banner':
                return (
                    <div className="space-y-4 px-4 pb-8">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Banner</h3>
                            <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <BannerEditor
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'content':
                return (
                    <div className="space-y-4 px-4 pb-8">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Indholdsblokke</h3>
                            <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <ContentBlocksSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                            tenantId={editor.entityId}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                            focusedBlockId={focusedBlockId}
                        />
                    </div>
                );
            case 'footer':
                return (
                    <div className="space-y-4 px-4 pb-8">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Footer</h3>
                            <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <FooterSection
                            footer={editor.draft.footer}
                            onChange={(footer) => editor.updateDraft({ footer })}
                            savedSwatches={editor.draft.savedSwatches}
                            onSaveSwatch={(color) => {
                                const swatches = editor.draft.savedSwatches || [];
                                if (!swatches.includes(color) && swatches.length < 20) {
                                    editor.updateDraft({ savedSwatches: [...swatches, color] });
                                }
                            }}
                            onRemoveSwatch={(color) => {
                                editor.updateDraft({
                                    savedSwatches: (editor.draft.savedSwatches || []).filter(c => c !== color)
                                });
                            }}
                        />
                    </div>
                );
            case 'typography':
                return (
                    <div className="space-y-4 px-4 pb-8">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Typografi</h3>
                            <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <div className="space-y-6">
                            <FontSelector
                                label="Overskrifter"
                                value={editor.draft.fonts.heading}
                                onChange={(v) => editor.updateDraft({
                                    fonts: { ...editor.draft.fonts, heading: v }
                                })}
                            />
                            <FontSelector
                                label="Brødtekst"
                                value={editor.draft.fonts.body}
                                onChange={(v) => editor.updateDraft({
                                    fonts: { ...editor.draft.fonts, body: v }
                                })}
                            />
                            <FontSelector
                                label="Priser"
                                value={editor.draft.fonts.pricing}
                                onChange={(v) => editor.updateDraft({
                                    fonts: { ...editor.draft.fonts, pricing: v }
                                })}
                            />
                        </div>
                    </div>
                );
            case 'colors':
                return (
                    <div className="space-y-4 px-4 pb-8">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Farver</h3>
                            <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <div className="space-y-4">
                            {Object.entries(editor.draft.colors).map(([key, value]) => (
                                <div key={key} className="flex items-center gap-4">
                                    <Label className="w-32 capitalize">
                                        {key === 'primary' && 'Primær'}
                                        {key === 'secondary' && 'Sekundær'}
                                        {key === 'background' && 'Baggrund'}
                                        {key === 'card' && 'Kort'}
                                        {key === 'dropdown' && 'Dropdown'}
                                        {key === 'hover' && 'Hover (mus over)'}
                                    </Label>
                                    <ColorPickerWithSwatches
                                        value={value}
                                        onChange={(color) => editor.updateDraft({
                                            colors: { ...editor.draft.colors, [key]: color }
                                        })}
                                        compact={true}
                                        showFullSwatches={false}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'icons':
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-4">
                            <h3 className="font-semibold">Produkt billeder & ikoner</h3>
                            <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>Luk</Button>
                        </div>
                        <ProductAssetsSection
                            draft={editor.draft}
                            updateDraft={editor.updateDraft}
                        />
                    </div>
                );
            default:
                return <div>Ukendt sektion: {activeSection}</div>;
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] -m-6"> {/* Negative margin to break out of container padding if needed, or just h-full */}
            {/* Top Toolbar */}
            <div className="h-16 border-b bg-background flex items-center justify-between px-4 z-20">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">
                        {editor.mode === 'master' ? 'Design Skabelon' : 'Visuel Editor'}
                    </h1>
                    <Badge variant={editor.mode === 'master' ? 'default' : 'secondary'}>
                        {editor.mode === 'master' ? 'Platform' : 'Lejer'}
                    </Badge>
                </div>

                <div className="flex items-center gap-2">
                    {onSwitchVersion && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onSwitchVersion}
                            className="mr-2"
                        >
                            Tilbage til Classic
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor.discardDraft()}
                        disabled={!editor.hasUnsavedChanges || editor.isSaving}
                        className="gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden sm:inline">Fortryd</span>
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveDesignDialog(true)}
                        disabled={editor.isSaving}
                        className="gap-2"
                    >
                        <Save className="h-4 w-4" />
                        <span className="hidden sm:inline">Gem kladde</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            editor.loadSavedDesigns();
                            setShowSavedDesignsDialog(true);
                        }}
                        disabled={editor.isSaving}
                        className="gap-2"
                    >
                        <List className="h-4 w-4" />
                        <span className="hidden sm:inline">Hent</span>
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => setShowPublishDialog(true)}
                        disabled={editor.isSaving}
                        className="gap-2"
                    >
                        <Send className="h-4 w-4" />
                        Publicér
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowResetDialog(true)}
                        disabled={editor.isSaving}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Nulstil til standard"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar - Collapsible */}
                <div
                    className={`
                        absolute inset-y-0 left-0 z-10 w-80 bg-background border-r transform transition-transform duration-300 ease-in-out
                        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                        lg:relative lg:translate-x-0
                    `}
                >
                    <div className="h-full flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                                {activeSection ? 'Redigerer' : 'Værktøjer'}
                            </h2>
                            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="py-4">
                                {renderSidebarContent()}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Main Preview Area */}
                <div className="flex-1 bg-muted/10 relative flex flex-col">
                    {/* Toggle Sidebar Button (visible when closed on mobile or if we add collapse toggle for desktop) */}
                    {!sidebarOpen && (
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute top-4 left-4 z-20 lg:hidden shadow-md"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}

                    <div className="flex-1 p-8 overflow-hidden">
                        <div className="w-full h-full bg-white rounded-lg shadow-2xl border overflow-hidden">
                            <BrandingPreviewFrame
                                branding={editor.draft}
                                previewUrl={`/preview-shop?draft=1&tenantId=${editor.entityId}`}
                                tenantName={editor.entityName}
                                onSaveDraft={editor.saveDraft}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- DIALOGS (Copied from V1) --- */}
            {/* 1. Save Design Modal */}
            <Dialog open={showSaveDesignDialog} onOpenChange={setShowSaveDesignDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gem design</DialogTitle>
                        <DialogDescription>
                            Giv dit nuværende design et navn for at gemme det.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Navn på design <span className="text-destructive">*</span></Label>
                            <Input
                                id="name"
                                value={saveDesignName}
                                onChange={(e) => setSaveDesignName(e.target.value)}
                                placeholder="F.eks. Sommer Kampagne"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveDesignDialog(false)}>Annuller</Button>
                        <Button onClick={handleSaveDesign} disabled={!saveDesignName.trim() || editor.isSaving}>
                            Gem
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 2. Saved Designs List Modal */}
            <Dialog open={showSavedDesignsDialog} onOpenChange={setShowSavedDesignsDialog}>
                <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Gemte designs</DialogTitle>
                        <DialogDescription>
                            Klik 'Indlæs' for at anvende et design. Dette vil overskrive din nuværende kladde.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto py-4 minimal-scrollbar">
                        {editor.savedDesigns.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p>Ingen gemte designs fundet.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {editor.savedDesigns.map((design) => (
                                    <div
                                        key={design.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                <Palette className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-sm">{design.name}</h4>
                                                <p className="text-xs text-muted-foreground">{formatDate(design.createdAt)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={async () => {
                                                    await editor.loadDesign(design.id);
                                                    setShowSavedDesignsDialog(false);
                                                }}
                                            >
                                                Indlæs
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                onClick={() => {
                                                    if (confirm('Er du sikker på at du vil slette dette design?')) {
                                                        editor.deleteSavedDesign(design.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* 3. Reset Dialog */}
            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Nulstil til standard?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Dette vil fjerne alle dine branding-tilpasninger og gendanne standardindstillingerne.
                            <br /><br />
                            Vi gemmer en automatisk sikkerhedskopi før vi nulstiller.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                await editor.resetToDefault();
                                setShowResetDialog(false);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Nulstil
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Publish Dialog */}
            <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <Send className="h-5 w-5 text-primary" />
                            Publicér branding?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                                <strong>Bemærk:</strong> Publicering vil ændre din live hjemmeside øjeblikkeligt.
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label htmlFor="publish-label">Navngiv denne version (valgfrit)</Label>
                                <Input
                                    id="publish-label"
                                    placeholder="F.eks. 'Nyt logo design'"
                                    value={publishLabel}
                                    onChange={(e) => setPublishLabel(e.target.value)}
                                />
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePublish}>
                            Publicér nu
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
