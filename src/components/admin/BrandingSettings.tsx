import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription/*, CardFooter*/ } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
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
import { Loader2, Upload, Image as ImageIcon, Type, Palette, Layout, Trash2, Sparkles, Send, RotateCcw, AlertCircle, Menu, Footprints } from "lucide-react";
import { FontSelector } from "./FontSelector";
import { BrandingPreview } from "./BrandingPreview";
import { IconPackSelector } from "./IconPackSelector";
import { BrandingHistory } from "./BrandingHistory";
import { BrandingPreviewFrame } from "./BrandingPreviewFrame";
import { HeroEditor } from "./HeroEditor";
import { HeaderSection } from "./HeaderSection";
import { FooterSection } from "./FooterSection";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import { useBrandingDraft, type BrandingData } from "@/hooks/useBrandingDraft";

export function BrandingSettings() {
    const {
        draft,
        published,
        tenantId,
        tenantName,
        isLoading,
        isSaving,
        hasUnsavedChanges,
        updateDraft,
        saveDraft,
        publishDraft,
        discardDraft,
        resetToDefault,
        refetch,
    } = useBrandingDraft();

    const [uploading, setUploading] = useState(false);
    const [publishLabel, setPublishLabel] = useState("");
    const [showPublishDialog, setShowPublishDialog] = useState(false);
    const [saveLabel, setSaveLabel] = useState("");
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [activeTab, setActiveTab] = useState("typography");

    const handleSaveSwatch = (color: string) => {
        const current = draft.savedSwatches || [];
        if (!current.includes(color) && current.length < 20) {
            updateDraft({ savedSwatches: [...current, color] });
        }
    };

    const handleRemoveSwatch = (color: string) => {
        updateDraft({ savedSwatches: (draft.savedSwatches || []).filter(c => c !== color) });
    };

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>,
        type: "logo" | "hero"
    ) => {
        if (!event.target.files || event.target.files.length === 0) return;

        setUploading(true);
        try {
            const { supabase } = await import("@/integrations/supabase/client");
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}-${Date.now()}.${fileExt}`;
            const filePath = `branding/${tenantId || 'master'}/${fileName}`;

            // Validate file size
            const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
            if (file.size > maxSize) {
                toast.error(`Filen er for stor. Max ${file.type.startsWith('video/') ? '50MB' : '5MB'}`);
                return;
            }

            // Validate image dimensions for hero
            if (type === "hero" && file.type.startsWith('image/')) {
                const img = new Image();
                img.src = URL.createObjectURL(file);
                await new Promise((resolve) => { img.onload = resolve; });

                if (img.width < 1200 || img.height < 400) {
                    toast.error("Hero billede skal være mindst 1200x400 pixels");
                    return;
                }
            }

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            if (type === "logo") {
                updateDraft({ logo_url: publicUrl });
            } else if (type === "hero") {
                updateDraft({
                    hero: {
                        ...draft.hero,
                        media: [...draft.hero.media, publicUrl]
                    }
                });
            }

            toast.success("Fil uploadet");
        } catch (error) {
            console.error("Error uploading file:", error);
            toast.error("Kunne ikke uploade fil");
        } finally {
            setUploading(false);
        }
    };

    const removeHeroMedia = (index: number) => {
        updateDraft({
            hero: {
                ...draft.hero,
                media: draft.hero.media.filter((_, i) => i !== index)
            }
        });
    };

    const handlePublish = async () => {
        await publishDraft(publishLabel || undefined);
        setShowPublishDialog(false);
        setPublishLabel("");
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header with Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        Branding
                        {hasUnsavedChanges && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Ændringer ikke gemt
                            </Badge>
                        )}
                    </h1>
                    <p className="text-muted-foreground">Tilpas din shops udseende og identitet</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <BrandingHistory tenantId={tenantId} onRestore={refetch} />

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <RotateCcw className="w-4 h-4" />
                                Nulstil
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Nulstil til standard?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Dette vil nulstille al branding til platformens standardindstillinger.
                                    Den nuværende branding gemmes som en version, så du kan gendanne den senere.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction onClick={resetToDefault}>Nulstil</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {hasUnsavedChanges && (
                        <Button variant="ghost" size="sm" onClick={discardDraft}>
                            Kassér ændringer
                        </Button>
                    )}

                    <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                        <AlertDialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isSaving || !hasUnsavedChanges}
                            >
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Gem kladde
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Gem kladde</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Gem en version af dit design for at kunne vende tilbage til det senere.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="py-4">
                                <Label htmlFor="saveLabel">Navn på design (valgfrit)</Label>
                                <Input
                                    id="saveLabel"
                                    value={saveLabel}
                                    onChange={(e) => setSaveLabel(e.target.value)}
                                    placeholder="F.eks. 'Udkast 1'"
                                    className="mt-2"
                                />
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction onClick={async () => {
                                    await saveDraft({ label: saveLabel });
                                    setShowSaveDialog(false);
                                    setSaveLabel("");
                                }}>
                                    Gem
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" className="gap-2">
                                <Send className="w-4 h-4" />
                                Publicér
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Publicér branding?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Din nuværende kladde bliver live og synlig for alle kunder.
                                    Giv eventuelt denne version et navn så du kan finde den igen.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="py-4">
                                <Label htmlFor="publishLabel">Version navn (valgfrit)</Label>
                                <Input
                                    id="publishLabel"
                                    value={publishLabel}
                                    onChange={(e) => setPublishLabel(e.target.value)}
                                    placeholder="F.eks. 'Sommerkampagne 2024'"
                                    className="mt-2"
                                />
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction onClick={handlePublish} disabled={isSaving}>
                                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Publicér nu
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Main Layout: Settings then Preview */}
            <div className="space-y-8">
                {/* Settings Panel */}
                <div>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="grid grid-cols-7 w-full">
                            <TabsTrigger value="typography" className="gap-2">
                                <Type className="w-4 h-4" />
                                <span className="hidden sm:inline">Typografi</span>
                            </TabsTrigger>
                            <TabsTrigger value="colors" className="gap-2">
                                <Palette className="w-4 h-4" />
                                <span className="hidden sm:inline">Farver</span>
                            </TabsTrigger>
                            <TabsTrigger value="hero" className="gap-2">
                                <Layout className="w-4 h-4" />
                                <span className="hidden sm:inline">Banner</span>
                            </TabsTrigger>
                            <TabsTrigger value="navigation" className="gap-2">
                                <Menu className="w-4 h-4" />
                                <span className="hidden sm:inline">Navigation</span>
                            </TabsTrigger>
                            <TabsTrigger value="footer" className="gap-2">
                                <Footprints className="w-4 h-4" />
                                <span className="hidden sm:inline">Footer</span>
                            </TabsTrigger>
                            <TabsTrigger value="icons" className="gap-2">
                                <Sparkles className="w-4 h-4" />
                                <span className="hidden sm:inline">Ikoner</span>
                            </TabsTrigger>
                            <TabsTrigger value="logo" className="gap-2">
                                <ImageIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Logo</span>
                            </TabsTrigger>
                        </TabsList>

                        {/* Typography Tab */}
                        <TabsContent value="typography" className="space-y-4">
                            <CollapsibleCard
                                title="Skrifttyper"
                                description="Vælg skrifttyper til forskellige elementer"
                                icon={<Type className="h-4 w-4" />}
                                defaultOpen={true}
                            >
                                <div className="space-y-6">
                                    <FontSelector
                                        label="Overskrifter"
                                        value={draft.fonts.heading}
                                        onChange={(v) => updateDraft({ fonts: { ...draft.fonts, heading: v } })}
                                        description="Bruges til H1, H2, H3 og navigation"
                                    />
                                    <FontSelector
                                        label="Brødtekst"
                                        value={draft.fonts.body}
                                        onChange={(v) => updateDraft({ fonts: { ...draft.fonts, body: v } })}
                                        description="Bruges til almindelig tekst og beskrivelser"
                                    />
                                    <FontSelector
                                        label="Priser"
                                        value={draft.fonts.pricing}
                                        onChange={(v) => updateDraft({ fonts: { ...draft.fonts, pricing: v } })}
                                        description="Bruges til priser og tal"
                                    />
                                </div>
                            </CollapsibleCard>

                            {/* Typography Colors */}
                            <CollapsibleCard
                                title="Tekstfarver"
                                description="Tilpas farver på tekst"
                                icon={<Palette className="h-4 w-4" />}
                            >
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <ColorPickerWithSwatches
                                            label="Overskrifter"
                                            value={draft.colors.headingText || '#1F2937'}
                                            onChange={(color) => updateDraft({ colors: { ...draft.colors, headingText: color } })}
                                            savedSwatches={draft.savedSwatches}
                                            onSaveSwatch={handleSaveSwatch}
                                            onRemoveSwatch={handleRemoveSwatch}
                                        />
                                        <p className="text-xs text-muted-foreground">Farve på H1, H2, H3 overskrifter</p>
                                    </div>
                                    <div className="space-y-2">
                                        <ColorPickerWithSwatches
                                            label="Brødtekst"
                                            value={draft.colors.bodyText || '#4B5563'}
                                            onChange={(color) => updateDraft({ colors: { ...draft.colors, bodyText: color } })}
                                            savedSwatches={draft.savedSwatches}
                                            onSaveSwatch={handleSaveSwatch}
                                            onRemoveSwatch={handleRemoveSwatch}
                                        />
                                        <p className="text-xs text-muted-foreground">Farve på almindelig tekst og beskrivelser</p>
                                    </div>
                                    <div className="space-y-2">
                                        <ColorPickerWithSwatches
                                            label="Links"
                                            value={draft.colors.linkText || '#0EA5E9'}
                                            onChange={(color) => updateDraft({ colors: { ...draft.colors, linkText: color } })}
                                            savedSwatches={draft.savedSwatches}
                                            onSaveSwatch={handleSaveSwatch}
                                            onRemoveSwatch={handleRemoveSwatch}
                                        />
                                        <p className="text-xs text-muted-foreground">Farve på links i tekst</p>
                                    </div>
                                </div>
                            </CollapsibleCard>
                        </TabsContent>

                        {/* Colors Tab */}
                        <TabsContent value="colors" className="space-y-4">
                            <CollapsibleCard
                                title="Farveskema"
                                description="Tilpas farverne på din shop"
                                icon={<Palette className="h-4 w-4" />}
                                defaultOpen={true}
                            >
                                <div className="grid sm:grid-cols-2 gap-6">
                                    {[
                                        { key: "primary" as const, label: "Primær", desc: "Knapper, links, aktive elementer" },
                                        { key: "secondary" as const, label: "Sekundær", desc: "Baggrunde, accenter" },
                                        { key: "background" as const, label: "Baggrund", desc: "Sidens baggrund" },
                                        { key: "card" as const, label: "Kort/Bokse", desc: "Produktkort, paneler" },
                                        { key: "dropdown" as const, label: "Dropdown", desc: "Menuer, valgmuligheder" },
                                        { key: "hover" as const, label: "Hover (mus over)", desc: "Når musen holdes over elementer" },
                                    ].map((color) => (
                                        <div key={color.key} className="space-y-2">
                                            <ColorPickerWithSwatches
                                                label={color.label}
                                                value={draft.colors[color.key] || '#000000'}
                                                onChange={(value) => updateDraft({ colors: { ...draft.colors, [color.key]: value } })}
                                                compact={false}
                                                showFullSwatches={false}
                                                savedSwatches={draft.savedSwatches}
                                                onSaveSwatch={handleSaveSwatch}
                                                onRemoveSwatch={handleRemoveSwatch}
                                            />
                                            <p className="text-xs text-muted-foreground">{color.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleCard>
                        </TabsContent>

                        {/* Hero Tab */}
                        <TabsContent value="hero" className="space-y-6">
                            <HeroEditor
                                draft={draft}
                                updateDraft={updateDraft}
                                tenantId={tenantId}
                            />
                        </TabsContent>

                        {/* Navigation Tab */}
                        <TabsContent value="navigation" className="space-y-6">
                            <HeaderSection
                                header={draft.header}
                                onChange={(header) => updateDraft({ header })}
                                savedSwatches={draft.savedSwatches}
                                onSaveSwatch={handleSaveSwatch}
                                onRemoveSwatch={handleRemoveSwatch}
                            />
                        </TabsContent>

                        {/* Footer Tab */}
                        <TabsContent value="footer" className="space-y-6">
                            <FooterSection
                                footer={draft.footer}
                                onChange={(footer) => updateDraft({ footer })}
                                savedSwatches={draft.savedSwatches}
                                onSaveSwatch={handleSaveSwatch}
                                onRemoveSwatch={handleRemoveSwatch}
                            />
                        </TabsContent>

                        {/* Icon Packs Tab */}
                        <TabsContent value="icons" className="space-y-6">
                            <IconPackSelector
                                selectedPackId={draft.selectedIconPackId}
                                onChange={(packId) => updateDraft({ selectedIconPackId: packId })}
                            />
                        </TabsContent>

                        {/* Logo Tab */}
                        <TabsContent value="logo" className="space-y-4">
                            <CollapsibleCard
                                title="Logo"
                                description="Upload dit virksomhedslogo"
                                icon={<ImageIcon className="h-4 w-4" />}
                                defaultOpen={true}
                            >
                                <div className="space-y-4">
                                    <div className="border-2 border-dashed border-muted rounded-lg p-6 flex flex-col items-center justify-center min-h-[200px] bg-muted/5 relative">
                                        {draft.logo_url ? (
                                            <div className="relative w-full h-full flex items-center justify-center">
                                                <img src={draft.logo_url} alt="Shop Logo" className="max-h-[160px] object-contain" />
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="absolute top-0 right-0"
                                                    onClick={() => updateDraft({ logo_url: null })}
                                                >
                                                    Fjern
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="text-center text-muted-foreground">
                                                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                                                <p>Intet logo uploadet</p>
                                            </div>
                                        )}
                                    </div>

                                    <Button asChild variant="outline" disabled={uploading}>
                                        <label className="cursor-pointer">
                                            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                            {draft.logo_url ? 'Skift Logo' : 'Upload Logo'}
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, "logo")} />
                                        </label>
                                    </Button>
                                </div>
                            </CollapsibleCard>

                            {/* Navigation Options */}
                            <CollapsibleCard
                                title="Navigation"
                                description="Indstillinger for dropdown-menuen"
                                icon={<Menu className="h-4 w-4" />}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Vis produktbilleder i dropdown</Label>
                                        <p className="text-xs text-muted-foreground">Vis ikoner ved siden af produktnavne</p>
                                    </div>
                                    <Switch
                                        checked={draft.navigation.dropdown_images}
                                        onCheckedChange={(v) => updateDraft({ navigation: { ...draft.navigation, dropdown_images: v } })}
                                    />
                                </div>
                            </CollapsibleCard>
                        </TabsContent>
                    </Tabs>

                    {/* Live Preview Panel - Below Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                Live Preview
                            </CardTitle>
                            <CardDescription>Ændringer vises i realtid. Kunderne ser dette efter du publicerer.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="h-[600px]">
                                <BrandingPreviewFrame
                                    previewUrl={`/preview-shop?draft=1&tenantId=${tenantId || ''}`}
                                    branding={draft}
                                    tenantName={tenantName}
                                    onSaveDraft={saveDraft}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default BrandingSettings;
