import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
    Loader2, Type, Palette, Trash2, Sparkles,
    Send, RotateCcw, Image as ImageIcon, List,
    ExternalLink, Home, Save
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

import { FontSelector } from "@/components/admin/FontSelector";
import { IconPackSelector } from "@/components/admin/IconPackSelector";
import { BrandingPreviewFrame } from "@/components/admin/BrandingPreviewFrame";
import { ForsideSection } from "@/components/admin/ForsideSection";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";

import {
    type BrandingStorageAdapter,
    type BrandingCapabilities,
    type BrandingData,
    useBrandingEditor,
    loadMasterTemplate,
} from "@/lib/branding";

interface UnifiedBrandingEditorProps {
    adapter: BrandingStorageAdapter;
    capabilities: BrandingCapabilities;
}

export function UnifiedBrandingEditor({ adapter, capabilities }: UnifiedBrandingEditorProps) {
    console.log('🎨 UnifiedBrandingEditor LOADED - CLASSIC V1');

    // NOTE: This component is now strictly V1 (Classic Editor)
    // V2 (Visual Editor) is handled by BrandingEditorV2.tsx and TenantBrandingSettingsV2.tsx

    const editor = useBrandingEditor({ adapter, capabilities });
    const [activeTab, setActiveTab] = useState("forside");

    // Dialog States
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [publishLabel, setPublishLabel] = useState("");

    const [showSaveDesignDialog, setShowSaveDesignDialog] = useState(false);
    const [saveDesignName, setSaveDesignName] = useState("");

    const [showSavedDesignsDialog, setShowSavedDesignsDialog] = useState(false);
    const [showResetDialog, setShowResetDialog] = useState(false);

    // Apply master template (tenant only)
    const handleApplyMasterTemplate = async () => {
        try {
            const masterData = await loadMasterTemplate();
            editor.updateDraft(masterData);
            toast.success('Master skabelon anvendt');
        } catch (error) {
            console.error('Error applying master template:', error);
            toast.error('Kunne ikke anvende skabelon');
        }
    };

    // Handle publish with custom label
    const handlePublish = async () => {
        if (editor.hasUnsavedChanges) {
            await editor.saveDraft();
        }
        await editor.publish(publishLabel || undefined);
        setShowPublishDialog(false);
        setPublishLabel("");
    };

    // Handle Save Design (Named)
    const handleSaveDesign = async () => {
        if (!saveDesignName.trim()) {
            toast.error("Giv venligst dit design et navn");
            return;
        }

        await editor.saveDesign(saveDesignName);
        setSaveDesignName("");
        setShowSaveDesignDialog(false);

        // Optionally open the list to show it's saved? Or just toast success (which hook does).
    };

    // Get the live storefront URL
    const getLiveStorefrontUrl = () => {
        // For tenant, this would be their subdomain.domain or custom domain
        // For master, this is the platform template preview
        if (editor.mode === 'tenant') {
            return `/`; // Main storefront
        }
        return `/preview-shop?published=1`;
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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">
                        {editor.mode === 'master' ? 'Branding Skabelon' : 'Branding'}
                    </h1>
                    <p className="text-muted-foreground">
                        {editor.mode === 'master'
                            ? 'Konfigurér platform-skabelonen'
                            : `Tilpas udseendet af ${editor.entityName}`
                        }
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* Link to live storefront */}
                    <Button variant="outline" size="sm" asChild>
                        <a href={getLiveStorefrontUrl()} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {editor.mode === 'tenant' ? editor.entityName : 'Live site'}
                        </a>
                    </Button>

                    <Badge variant={editor.mode === 'master' ? 'default' : 'secondary'}>
                        {editor.mode === 'master' ? 'Platform' : 'Lejer'}
                    </Badge>
                </div>
            </div>

            {/* ACTION BAR */}
            <div className="flex flex-wrap items-center gap-3 p-4 bg-card border rounded-lg shadow-sm">

                {/* 1. Gem design (Save Named) */}
                <Button
                    variant="outline"
                    onClick={() => setShowSaveDesignDialog(true)}
                    disabled={editor.isSaving}
                    className="gap-2"
                >
                    <Save className="h-4 w-4" />
                    Gem design
                </Button>

                {/* 2. Gemte designs (List) */}
                <Button
                    variant="ghost"
                    onClick={() => {
                        editor.loadSavedDesigns();
                        setShowSavedDesignsDialog(true);
                    }}
                    disabled={editor.isSaving}
                    className="gap-2"
                >
                    <List className="h-4 w-4" />
                    Gemte designs
                </Button>

                <div className="flex-1" /> {/* Spacer */}

                {/* 3. Fortryd (Undo/Discard) */}
                <Button
                    variant="ghost"
                    onClick={() => editor.discardDraft()}
                    disabled={!editor.hasUnsavedChanges || editor.isSaving}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                >
                    <RotateCcw className="h-4 w-4" />
                    Fortryd
                </Button>

                {/* 4. Publicér (Publish CTA) */}
                <Button
                    onClick={() => setShowPublishDialog(true)}
                    disabled={editor.isSaving}
                    className="gap-2 min-w-[100px]"
                >
                    <Send className="h-4 w-4" />
                    Publicér
                </Button>

                {/* 5. Nulstil (Reset Danger) */}
                <Button
                    variant="ghost"
                    onClick={() => setShowResetDialog(true)}
                    disabled={editor.isSaving}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    size="icon"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>

            {/* --- DIALOGS --- */}

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

            {/* Publicer Dialog */}
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

            {/* Main Content: Editor + Preview */}
            <div className="space-y-8">
                {/* Editor Tabs */}
                <div className="space-y-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid grid-cols-4 w-full">
                            {/* Forside Tab - combines Logo, Header, Banner, Footer */}
                            <TabsTrigger value="forside" className="gap-2">
                                <Home className="h-4 w-4" />
                                <span className="hidden sm:inline">Forside</span>
                            </TabsTrigger>
                            {capabilities.sections.typography && (
                                <TabsTrigger value="typography" className="gap-2">
                                    <Type className="h-4 w-4" />
                                    <span className="hidden sm:inline">Typografi</span>
                                </TabsTrigger>
                            )}
                            {capabilities.sections.colors && (
                                <TabsTrigger value="colors" className="gap-2">
                                    <Palette className="h-4 w-4" />
                                    <span className="hidden sm:inline">Farver</span>
                                </TabsTrigger>
                            )}
                            {capabilities.sections.iconPacks && (
                                <TabsTrigger value="icons" className="gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    <span className="hidden sm:inline">Ikoner</span>
                                </TabsTrigger>
                            )}
                        </TabsList>

                        {/* Typography Tab */}
                        {capabilities.sections.typography && (
                            <TabsContent value="typography" className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Typografi</CardTitle>
                                        <CardDescription>Vælg skrifttyper til din shop</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
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
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}

                        {/* Colors Tab */}
                        {capabilities.sections.colors && (
                            <TabsContent value="colors" className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Farver</CardTitle>
                                        <CardDescription>Tilpas farveskemaet</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
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
                                                <Input
                                                    value={value}
                                                    onChange={(e) => editor.updateDraft({
                                                        colors: { ...editor.draft.colors, [key]: e.target.value }
                                                    })}
                                                    className="font-mono w-28"
                                                />
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}

                        {/* Forside Tab - combines Logo, Header, Banner, Footer */}
                        <TabsContent value="forside" className="space-y-6">
                            <ForsideSection
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
                        </TabsContent>


                        {/* Icon Packs Tab */}
                        {capabilities.sections.iconPacks && (
                            <TabsContent value="icons" className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Ikon Pakke</CardTitle>
                                        <CardDescription>
                                            Vælg ikonstil til produktkategorier
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <IconPackSelector
                                            selectedPackId={editor.draft.selectedIconPackId}
                                            onChange={(v) => editor.updateDraft({ selectedIconPackId: v })}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        )}
                    </Tabs>
                </div>

                {/* Preview Panel - Full Width at Bottom */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="space-y-1">
                            <CardTitle>Forhåndsvisning</CardTitle>
                            <CardDescription>
                                Ændringer vises i realtid. Kunderne ser dette efter du publicerer.
                            </CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                            <a href={`/preview-shop?draft=1&tenantId=${editor.entityId}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Åbn i nyt vindue
                            </a>
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="h-[800px] w-full border-t">
                            <BrandingPreviewFrame
                                branding={editor.draft}
                                previewUrl={`/preview-shop?draft=1&tenantId=${editor.entityId}`}
                                tenantName={editor.entityName}
                                onSaveDraft={editor.saveDraft}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default UnifiedBrandingEditor;
