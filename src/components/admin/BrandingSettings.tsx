import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, Image as ImageIcon, Type, Palette, Layout, Trash2, Sparkles } from "lucide-react";
import { FontSelector } from "./FontSelector";
import { BrandingPreview } from "./BrandingPreview";
import { IconPackSelector } from "./IconPackSelector";

interface BrandingState {
    logo_url: string | null;
    fonts: {
        heading: string;
        body: string;
        pricing: string;
    };
    colors: {
        primary: string;
        secondary: string;
        background: string;
        card: string;
        dropdown: string;
    };
    hero: {
        type: "image" | "slideshow" | "video";
        media: string[];
        transition: "slide" | "fade";
        parallax: boolean;
        overlay_color: string;
        overlay_opacity: number;
    };
    navigation: {
        dropdown_images: boolean;
    };
    selectedIconPackId: string;
}

const DEFAULT_BRANDING: BrandingState = {
    logo_url: null,
    fonts: {
        heading: "Poppins",
        body: "Inter",
        pricing: "Roboto Mono",
    },
    colors: {
        primary: "#0EA5E9",
        secondary: "#F1F5F9",
        background: "#F8FAFC",
        card: "#FFFFFF",
        dropdown: "#FFFFFF",
    },
    hero: {
        type: "image",
        media: [],
        transition: "fade",
        parallax: false,
        overlay_color: "#000000",
        overlay_opacity: 0.3,
    },
    navigation: {
        dropdown_images: true,
    },
    selectedIconPackId: "classic",
};

export function BrandingSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [tenantName, setTenantName] = useState("Din Shop");
    const [branding, setBranding] = useState<BrandingState>(DEFAULT_BRANDING);

    useEffect(() => {
        fetchBranding();
    }, []);

    const fetchBranding = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('id, name, settings')
                .eq('owner_id', user.id)
                .maybeSingle();

            if (tenant) {
                setTenantId((tenant as any).id);
                setTenantName((tenant as any).name || "Din Shop");

                const savedBranding = (tenant as any).settings?.branding;
                if (savedBranding) {
                    setBranding({
                        ...DEFAULT_BRANDING,
                        ...savedBranding,
                        fonts: { ...DEFAULT_BRANDING.fonts, ...savedBranding.fonts },
                        colors: { ...DEFAULT_BRANDING.colors, ...savedBranding.colors },
                        hero: { ...DEFAULT_BRANDING.hero, ...savedBranding.hero },
                        navigation: { ...DEFAULT_BRANDING.navigation, ...savedBranding.navigation },
                        selectedIconPackId: savedBranding.selectedIconPackId || DEFAULT_BRANDING.selectedIconPackId,
                    });
                }
            }
        } catch (error) {
            console.error("Error fetching branding:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (
        event: React.ChangeEvent<HTMLInputElement>,
        type: "logo" | "hero",
        index?: number
    ) => {
        if (!event.target.files || event.target.files.length === 0) return;

        setUploading(true);
        try {
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}-${Date.now()}.${fileExt}`;
            const filePath = `branding/${tenantId || 'master'}/${fileName}`;

            // Validate file size (max 5MB for images, 50MB for video)
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
                setBranding(prev => ({ ...prev, logo_url: publicUrl }));
            } else if (type === "hero") {
                setBranding(prev => ({
                    ...prev,
                    hero: {
                        ...prev.hero,
                        media: index !== undefined
                            ? prev.hero.media.map((m, i) => i === index ? publicUrl : m)
                            : [...prev.hero.media, publicUrl]
                    }
                }));
            }

            toast.success("Fil uploadet");
        } catch (error) {
            console.error("Error uploading file:", error);
            toast.error("Kunne ikke uploade fil");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: tenant } = await supabase
                .from('tenants' as any)
                .select('id, settings')
                .eq('owner_id', user.id)
                .single();

            if (!tenant) throw new Error("Tenant not found");

            const currentSettings = (tenant as any).settings || {};
            const newSettings = {
                ...currentSettings,
                branding,
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', (tenant as any).id);

            if (error) throw error;
            toast.success("Branding gemt!");
        } catch (error) {
            console.error("Error saving branding:", error);
            toast.error("Kunne ikke gemme branding");
        } finally {
            setSaving(false);
        }
    };

    const updateFont = (key: keyof BrandingState['fonts'], value: string) => {
        setBranding(prev => ({ ...prev, fonts: { ...prev.fonts, [key]: value } }));
    };

    const updateColor = (key: keyof BrandingState['colors'], value: string) => {
        setBranding(prev => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
    };

    const updateHero = <K extends keyof BrandingState['hero']>(key: K, value: BrandingState['hero'][K]) => {
        setBranding(prev => ({ ...prev, hero: { ...prev.hero, [key]: value } }));
    };

    const removeHeroMedia = (index: number) => {
        setBranding(prev => ({
            ...prev,
            hero: { ...prev.hero, media: prev.hero.media.filter((_, i) => i !== index) }
        }));
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold">Branding</h1>
                <p className="text-muted-foreground">Tilpas din shops udseende og identitet</p>
            </div>

            {/* Tabs Layout - Full Width */}
            <Tabs defaultValue="typography" className="space-y-6">
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
                                value={branding.fonts.heading}
                                onChange={(v) => updateFont("heading", v)}
                                description="Bruges til H1, H2, H3 og navigation"
                            />
                            <FontSelector
                                label="Brødtekst"
                                value={branding.fonts.body}
                                onChange={(v) => updateFont("body", v)}
                                description="Bruges til almindelig tekst og beskrivelser"
                            />
                            <FontSelector
                                label="Priser"
                                value={branding.fonts.pricing}
                                onChange={(v) => updateFont("pricing", v)}
                                description="Bruges til priser og tal"
                            />
                        </CardContent>
                    </Card>

                    {/* Live Preview - Larger, below Typography */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Live Preview</CardTitle>
                            <CardDescription>Se hvordan dine ændringer vil se ud</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="aspect-[16/10] w-full">
                                <BrandingPreview branding={branding} tenantName={tenantName} />
                            </div>
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
                                                value={branding.colors[color.key]}
                                                onChange={(e) => updateColor(color.key, e.target.value)}
                                                className="h-full w-full cursor-pointer p-0 border-none"
                                            />
                                        </div>
                                        <Input
                                            value={branding.colors[color.key]}
                                            onChange={(e) => updateColor(color.key, e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">{color.desc}</p>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Preview in Colors too */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Live Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="aspect-[16/10] w-full">
                                <BrandingPreview branding={branding} tenantName={tenantName} />
                            </div>
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
                                    value={branding.hero.type}
                                    onValueChange={(v) => updateHero("type", v as "image" | "slideshow" | "video")}
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
                                <Label>
                                    {branding.hero.type === "video" ? "Upload Video" : "Upload Billede(r)"}
                                </Label>
                                <div className="grid grid-cols-4 gap-3">
                                    {branding.hero.media.map((url, index) => (
                                        <div key={index} className="relative aspect-video rounded-lg border overflow-hidden group">
                                            {branding.hero.type === "video" ? (
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

                                    {(branding.hero.type !== "video" || branding.hero.media.length === 0) && (
                                        <label className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                                            <span className="text-xs text-muted-foreground">Upload</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept={branding.hero.type === "video" ? "video/*" : "image/*"}
                                                onChange={(e) => handleFileUpload(e, "hero")}
                                                disabled={uploading}
                                            />
                                        </label>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Min. 1200x400 pixels. Max 5MB per billede, 50MB for video.
                                </p>
                            </div>

                            {/* Slideshow Options */}
                            {branding.hero.type === "slideshow" && (
                                <div className="space-y-2">
                                    <Label>Overgangseffekt</Label>
                                    <Select
                                        value={branding.hero.transition}
                                        onValueChange={(v) => updateHero("transition", v as "slide" | "fade")}
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
                                    checked={branding.hero.parallax}
                                    onCheckedChange={(v) => updateHero("parallax", v)}
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
                                                value={branding.hero.overlay_color}
                                                onChange={(e) => updateHero("overlay_color", e.target.value)}
                                                className="h-full w-full cursor-pointer p-0 border-none"
                                            />
                                        </div>
                                        <Input
                                            value={branding.hero.overlay_color}
                                            onChange={(e) => updateHero("overlay_color", e.target.value)}
                                            className="font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Overlay Gennemsigtighed: {Math.round(branding.hero.overlay_opacity * 100)}%</Label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={branding.hero.overlay_opacity}
                                        onChange={(e) => updateHero("overlay_opacity", parseFloat(e.target.value))}
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
                        selectedPackId={branding.selectedIconPackId}
                        onChange={(packId) => setBranding(prev => ({ ...prev, selectedIconPackId: packId }))}
                    />
                </TabsContent>

                {/* Logo Tab */}
                <TabsContent value="logo" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Logo</CardTitle>
                            <CardDescription>Upload dit virksomhedslogo (PNG med gennemsigtig baggrund anbefales)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border-2 border-dashed border-muted rounded-lg p-6 flex flex-col items-center justify-center min-h-[200px] bg-muted/5 relative">
                                {branding.logo_url ? (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <img src={branding.logo_url} alt="Shop Logo" className="max-h-[160px] object-contain" />
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="absolute top-0 right-0"
                                            onClick={() => setBranding(prev => ({ ...prev, logo_url: null }))}
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

                            <div className="flex items-center gap-4">
                                <Button asChild variant="outline" disabled={uploading}>
                                    <label className="cursor-pointer">
                                        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                        {branding.logo_url ? 'Skift Logo' : 'Upload Logo'}
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e, "logo")}
                                        />
                                    </label>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Navigation Options */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Navigation</CardTitle>
                            <CardDescription>Indstillinger for menuer</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Vis produktbilleder i dropdown</Label>
                                    <p className="text-xs text-muted-foreground">Vis ikoner ved siden af produktnavne i menuen</p>
                                </div>
                                <Switch
                                    checked={branding.navigation.dropdown_images}
                                    onCheckedChange={(v) => setBranding(prev => ({
                                        ...prev,
                                        navigation: { ...prev.navigation, dropdown_images: v }
                                    }))}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Save Button - Sticky */}
            <div className="sticky bottom-4 flex justify-end bg-background/80 backdrop-blur-sm p-4 rounded-lg border shadow-lg">
                <Button size="lg" onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Gem Branding
                </Button>
            </div>
        </div>
    );
}

export default BrandingSettings;
