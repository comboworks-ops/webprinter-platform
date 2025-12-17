/**
 * Unified Branding Editor Component
 * 
 * A shared branding editor that works for both Master and Tenant contexts.
 * Uses adapters for data operations and capabilities for feature gating.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
    Loader2, Upload, Type, Palette, Trash2, Sparkles,
    Send, RotateCcw, AlertCircle, Image as ImageIcon, History, FileDown, Menu, Footprints,
    AlertTriangle, ExternalLink, Home, LayoutDashboard
} from "lucide-react";

import { FontSelector } from "@/components/admin/FontSelector";
import { IconPackSelector } from "@/components/admin/IconPackSelector";
import { BrandingPreviewFrame } from "@/components/admin/BrandingPreviewFrame";
import { ForsideSection } from "@/components/admin/ForsideSection";
import { DraftManager } from "@/components/admin/DraftManager";
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
    console.log('🎨 UnifiedBrandingEditor LOADED - VERSION 2.0 - BANNER AND HOVER');
    const editor = useBrandingEditor({ adapter, capabilities });
    const [activeTab, setActiveTab] = useState("forside");
    const [uploading, setUploading] = useState(false);
    const [showApplyTemplate, setShowApplyTemplate] = useState(false);
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [publishLabel, setPublishLabel] = useState("");

    // Handle logo upload
    const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Logo må højst være 2MB');
            return;
        }

        setUploading(true);
        try {
            const publicUrl = await editor.uploadAsset(file, 'logo');
            editor.updateDraft({ logo_url: publicUrl });
            toast.success('Logo uploadet');
        } catch (error) {
            console.error('Error uploading logo:', error);
            toast.error('Kunne ikke uploade logo');
        } finally {
            setUploading(false);
        }
    };

    // Remove logo
    const handleRemoveLogo = async () => {
        if (editor.draft.logo_url) {
            await editor.deleteAsset(editor.draft.logo_url);
            editor.updateDraft({ logo_url: null });
        }
    };

    // Apply master template (tenant only)
    const handleApplyMasterTemplate = async () => {
        try {
            const masterData = await loadMasterTemplate();
            editor.updateDraft(masterData);
            toast.success('Master skabelon anvendt');
            setShowApplyTemplate(false);
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

    // Get the live storefront URL
    const getLiveStorefrontUrl = () => {
        // For tenant, this would be their subdomain.domain or custom domain
        // For master, this is the platform template preview
        if (editor.mode === 'tenant') {
            return `/`; // Main storefront
        }
        return `/preview-shop?published=1`;
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

                    {editor.hasUnsavedChanges && (
                        <Badge variant="outline" className="gap-1 text-orange-600">
                            <AlertCircle className="h-3 w-3" />
                            Ikke gemt
                        </Badge>
                    )}
                    <Badge variant={editor.mode === 'master' ? 'default' : 'secondary'}>
                        {editor.mode === 'master' ? 'Platform' : 'Lejer'}
                    </Badge>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    onClick={() => editor.saveDraft()}
                    disabled={!editor.hasUnsavedChanges || editor.isSaving}
                    variant="outline"
                >
                    {editor.isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Gem kladde
                </Button>

                {/* Publish with Warning */}
                <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
                    <AlertDialogTrigger asChild>
                        <Button disabled={editor.isSaving}>
                            <Send className="h-4 w-4 mr-2" />
                            Publicér
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" />
                                Publicér branding?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3">
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                                    <strong>Advarsel:</strong> Publicering vil ændre din live hjemmeside øjeblikkeligt.
                                    Alle besøgende vil se de nye ændringer med det samme.
                                </div>

                                {editor.mode === 'master'
                                    ? 'Dette opdaterer platform-skabelonen. Eksisterende lejere påvirkes ikke.'
                                    : 'Ændringerne vil blive synlige for dine kunder straks.'
                                }

                                <div className="space-y-2 pt-2">
                                    <Label htmlFor="publish-label">Navngiv denne version (valgfrit)</Label>
                                    <Input
                                        id="publish-label"
                                        placeholder="F.eks. 'Nyt logo design' eller 'Sommer kampagne'"
                                        value={publishLabel}
                                        onChange={(e) => setPublishLabel(e.target.value)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Du kan gendanne denne version senere fra historikken.
                                    </p>
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

                {editor.hasUnsavedChanges && (
                    <Button variant="ghost" onClick={() => editor.discardDraft()}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Kassér ændringer
                    </Button>
                )}

                {/* Draft & History Manager */}
                <DraftManager
                    draft={editor.draft}
                    hasUnsavedChanges={editor.hasUnsavedChanges}
                    isSaving={editor.isSaving}
                    history={editor.history}
                    onLoadHistory={editor.loadHistory}
                    onSaveDraft={editor.saveDesign}
                    onRestoreVersion={editor.restoreVersion}
                    onResetToDefault={editor.resetToDefault}
                    mode={editor.mode}
                    savedDesigns={editor.savedDesigns}
                    onLoadSavedDesigns={editor.loadSavedDesigns}
                    onLoadDesign={editor.loadDesign}
                    onDeleteSavedDesign={editor.deleteSavedDesign}
                />

                {/* Apply Master Template (Tenant only) */}
                {capabilities.canApplyMasterTemplate && (
                    <AlertDialog open={showApplyTemplate} onOpenChange={setShowApplyTemplate}>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline">
                                <FileDown className="h-4 w-4 mr-2" />
                                Anvend skabelon
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Anvend platform-skabelon?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Dette kopierer platform-skabelonen til din branding.
                                    Dine nuværende indstillinger vil blive overskrevet.
                                    Du kan altid fortryde ved at kassere ændringerne.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction onClick={handleApplyMasterTemplate}>
                                    Anvend skabelon
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>

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
