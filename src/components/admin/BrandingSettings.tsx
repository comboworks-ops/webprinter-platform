import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription/*, CardFooter*/ } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Upload, Image as ImageIcon, Type, Palette, Layout, Trash2, Sparkles, Send, RotateCcw, AlertCircle } from "lucide-react";
import { FontSelector } from "./FontSelector";
import { BrandingPreview } from "./BrandingPreview";
import { IconPackSelector } from "./IconPackSelector";
import { BrandingHistory } from "./BrandingHistory";
import { BrandingPreviewFrame } from "./BrandingPreviewFrame";
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
    const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
    const [activeTab, setActiveTab] = useState("typography");

    // Refresh preview when draft changes
    useEffect(() => {
        const timeout = setTimeout(() => {
            setPreviewRefreshKey(prev => prev + 1);
        }, 500); // Debounce
        return () => clearTimeout(timeout);
    }, [draft]);

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

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={saveDraft}
                        disabled={isSaving || !hasUnsavedChanges}
                    >
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Gem kladde
                    </Button>

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

            {/* Main Layout: Settings + Preview */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Settings Panel */}
                <div>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsList className="grid grid-cols-5 w-full">
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
                                <span className="hidden sm:inline">Hero</span>
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
                        <TabsContent value="typography" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Skrifttyper</CardTitle>
                                    <CardDescription>Vælg skrifttyper til forskellige elementer</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
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
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Colors Tab */}
                        <TabsContent value="colors" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Farveskema</CardTitle>
                                    <CardDescription>Tilpas farverne på din shop</CardDescription>
                                </CardHeader>
                                <CardContent className="grid sm:grid-cols-2 gap-6">
                                    {[
                                        { key: "primary" as const, label: "Primær", desc: "Knapper, links, aktive elementer" },
                                        { key: "secondary" as const, label: "Sekundær", desc: "Baggrunde, accenter" },
                                        { key: "background" as const, label: "Baggrund", desc: "Sidens baggrund" },
                                        { key: "card" as const, label: "Kort/Bokse", desc: "Produktkort, paneler" },
                                        { key: "dropdown" as const, label: "Dropdown", desc: "Menuer, valgmuligheder" },
                                    ].map((color) => (
                                        <div key={color.key} className="space-y-2">
                                            <Label>{color.label}</Label>
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg border shadow-sm overflow-hidden flex-shrink-0">
                                                    <input
                                                        type="color"
                                                        value={draft.colors[color.key]}
                                                        onChange={(e) => updateDraft({ colors: { ...draft.colors, [color.key]: e.target.value } })}
                                                        className="h-full w-full cursor-pointer p-0 border-none"
                                                    />
                                                </div>
                                                <Input
                                                    value={draft.colors[color.key]}
                                                    onChange={(e) => updateDraft({ colors: { ...draft.colors, [color.key]: e.target.value } })}
                                                    className="font-mono"
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">{color.desc}</p>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Hero Tab */}
                        <TabsContent value="hero" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Hero Banner</CardTitle>
                                    <CardDescription>Konfigurér forsiden banner</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Type Selector */}
                                    <div className="space-y-2">
                                        <Label>Banner Type</Label>
                                        <Select
                                            value={draft.hero.type}
                                            onValueChange={(v) => updateDraft({ hero: { ...draft.hero, type: v as "image" | "slideshow" | "video" } })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="image">Enkelt Billede</SelectItem>
                                                <SelectItem value="slideshow">Slideshow</SelectItem>
                                                <SelectItem value="video">Video</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Media Upload */}
                                    <div className="space-y-2">
                                        <Label>{draft.hero.type === "video" ? "Upload Video" : "Upload Billede(r)"}</Label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {draft.hero.media.map((url, index) => (
                                                <div key={index} className="relative aspect-video rounded-lg border overflow-hidden group">
                                                    {draft.hero.type === "video" ? (
                                                        <video src={url} className="w-full h-full object-cover" muted />
                                                    ) : (
                                                        <img src={url} alt={`Hero ${index + 1}`} className="w-full h-full object-cover" />
                                                    )}
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => removeHeroMedia(index)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            ))}

                                            {(draft.hero.type !== "video" || draft.hero.media.length === 0) && (
                                                <label className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                                                    <span className="text-xs text-muted-foreground">Upload</span>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept={draft.hero.type === "video" ? "video/*" : "image/*"}
                                                        onChange={(e) => handleFileUpload(e, "hero")}
                                                        disabled={uploading}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    {/* Slideshow Options */}
                                    {draft.hero.type === "slideshow" && (
                                        <div className="space-y-2">
                                            <Label>Overgangseffekt</Label>
                                            <Select
                                                value={draft.hero.transition}
                                                onValueChange={(v) => updateDraft({ hero: { ...draft.hero, transition: v as "slide" | "fade" } })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="fade">Fade</SelectItem>
                                                    <SelectItem value="slide">Slide</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Parallax Toggle */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label>Parallax Effekt</Label>
                                            <p className="text-xs text-muted-foreground">Billede bevæger sig ved scroll</p>
                                        </div>
                                        <Switch
                                            checked={draft.hero.parallax}
                                            onCheckedChange={(v) => updateDraft({ hero: { ...draft.hero, parallax: v } })}
                                        />
                                    </div>

                                    {/* Overlay */}
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Overlay Farve</Label>
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded border overflow-hidden">
                                                    <input
                                                        type="color"
                                                        value={draft.hero.overlay_color}
                                                        onChange={(e) => updateDraft({ hero: { ...draft.hero, overlay_color: e.target.value } })}
                                                        className="h-full w-full cursor-pointer p-0 border-none"
                                                    />
                                                </div>
                                                <Input
                                                    value={draft.hero.overlay_color}
                                                    onChange={(e) => updateDraft({ hero: { ...draft.hero, overlay_color: e.target.value } })}
                                                    className="font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Overlay: {Math.round(draft.hero.overlay_opacity * 100)}%</Label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.05"
                                                value={draft.hero.overlay_opacity}
                                                onChange={(e) => updateDraft({ hero: { ...draft.hero, overlay_opacity: parseFloat(e.target.value) } })}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* Icon Packs Tab */}
                        <TabsContent value="icons" className="space-y-6">
                            <IconPackSelector
                                selectedPackId={draft.selectedIconPackId}
                                onChange={(packId) => updateDraft({ selectedIconPackId: packId })}
                            />
                        </TabsContent>

                        {/* Logo Tab */}
                        <TabsContent value="logo" className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Logo</CardTitle>
                                    <CardDescription>Upload dit virksomhedslogo</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
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
                                </CardContent>
                            </Card>

                            {/* Navigation Options */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Navigation</CardTitle>
                                </CardHeader>
                                <CardContent>
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
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Preview Panel */}
                <div className="lg:sticky lg:top-4 h-[calc(100vh-8rem)]">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Live Preview</CardTitle>
                            <CardDescription className="text-xs">Kunderne ser dette efter publicering</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 overflow-hidden">
                            <BrandingPreviewFrame
                                previewUrl={`/preview?draft=1`}
                                refreshKey={previewRefreshKey}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default BrandingSettings;
