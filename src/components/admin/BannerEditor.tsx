import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorPickerWithSwatches } from "@/components/ui/ColorPickerWithSwatches";
import {
    Upload, Trash2, GripVertical, Plus, Image as ImageIcon,
    Video, Play, Info, AlertCircle, ExternalLink, AlertTriangle, Download
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
    type BrandingData,
    type HeroImage,
    type HeroVideo,
    type HeroButton,
    type HeroButtonLinkType,
    type HeroSettings,
    type HeroSlideshowSettings,
    type HeroOverlaySettings,
    type HeroVideoSettings,
    HERO_RECOMMENDED_WIDTH,
    HERO_RECOMMENDED_HEIGHT,
    HERO_MAX_IMAGES,
    HERO_MAX_VIDEOS,
    DEFAULT_HERO,
    DEFAULT_SLIDESHOW,
    DEFAULT_OVERLAY,
    DEFAULT_VIDEO_SETTINGS,
} from "@/hooks/useBrandingDraft";

// Minimum image height for parallax to work correctly
const PARALLAX_MIN_HEIGHT = 800;

interface BannerEditorProps {
    draft: BrandingData;
    updateDraft: (partial: Partial<BrandingData>) => void;
    tenantId: string | null;
}

// Internal pages for link selector
const INTERNAL_PAGES = [
    { path: "/", label: "Forside" },
    { path: "/shop", label: "Shop / Produkter" },
    { path: "/kontakt", label: "Kontakt" },
    { path: "/om-os", label: "Om os" },
    { path: "/betingelser", label: "Betingelser" },
];

// Master background assets (will be fetched from DB)
interface MasterAsset {
    id: string;
    name: string;
    url: string;
    thumbnail_url?: string;
}

// Extended button type with color settings
export interface BannerButton extends HeroButton {
    textColor?: string;
    bgColor?: string;
    bgOpacity?: number;
}

// Extended overlay settings with text colors
export interface BannerOverlaySettings extends HeroOverlaySettings {
    titleColor?: string;
    subtitleColor?: string;
    buttons: BannerButton[];
}

export function BannerEditor({ draft, updateDraft, tenantId }: BannerEditorProps) {
    const [uploading, setUploading] = useState(false);
    const [products, setProducts] = useState<Array<{ id: string; name: string; slug: string }>>([]);
    const [masterBackgrounds, setMasterBackgrounds] = useState<MasterAsset[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [parallaxWarning, setParallaxWarning] = useState(false);

    // Ensure hero has all defaults
    const hero: HeroSettings = {
        ...DEFAULT_HERO,
        ...draft.hero,
        slideshow: { ...DEFAULT_SLIDESHOW, ...draft.hero?.slideshow },
        overlay: { ...DEFAULT_OVERLAY, ...draft.hero?.overlay },
        videoSettings: { ...DEFAULT_VIDEO_SETTINGS, ...draft.hero?.videoSettings },
    };

    // Helper to generate unique ID
    const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update hero with proper merging
    const updateHero = useCallback((updates: Partial<HeroSettings>) => {
        updateDraft({
            hero: {
                ...hero,
                ...updates,
            } as HeroSettings,
        });
    }, [hero, updateDraft]);

    // Update slideshow settings
    const updateSlideshow = useCallback((updates: Partial<HeroSlideshowSettings>) => {
        updateHero({
            slideshow: { ...hero.slideshow, ...updates },
        });
    }, [hero.slideshow, updateHero]);

    // Update overlay settings (with extended color support)
    const updateOverlay = useCallback((updates: Partial<BannerOverlaySettings>) => {
        updateHero({
            overlay: { ...hero.overlay, ...updates } as any,
        });
    }, [hero.overlay, updateHero]);

    // Update video settings
    const updateVideoSettings = useCallback((updates: Partial<HeroVideoSettings>) => {
        updateHero({
            videoSettings: { ...hero.videoSettings, ...updates },
        });
    }, [hero.videoSettings, updateHero]);

    // Fetch products for button link selector
    useEffect(() => {
        async function fetchProducts() {
            if (!tenantId) return;
            const { data } = await (supabase
                .from('products') as any)
                .select('id, name, slug')
                .eq('tenant_id', tenantId)
                .eq('is_published', true)
                .order('name');
            if (data) setProducts(data as Array<{ id: string; name: string; slug: string }>);
        }
        fetchProducts();
    }, [tenantId]);

    // Fetch master backgrounds
    useEffect(() => {
        async function fetchMasterBackgrounds() {
            const { data } = await supabase
                .from('master_assets' as any)
                .select('id, name, url, thumbnail_url')
                .eq('type', 'HERO_BACKGROUND')
                .eq('is_published', true)
                .order('sort_order');
            if (data) setMasterBackgrounds(data as unknown as MasterAsset[]);
        }
        fetchMasterBackgrounds();
    }, []);

    // Get images and videos from hero (with fallback to legacy format, then to defaults)
    const heroImages: HeroImage[] = hero.images?.length > 0
        ? hero.images
        : (hero.media && hero.media.length > 0)
            ? hero.media.map((url, i) => ({ id: `legacy-${i}`, url, sortOrder: i }))
            : DEFAULT_HERO.images; // Fall back to default template images

    const heroVideos: HeroVideo[] = hero.videos || [];

    // Get extended overlay settings
    const extendedOverlay = hero.overlay as BannerOverlaySettings;

    // Check image dimensions for parallax warning
    const checkImageForParallax = useCallback((url: string) => {
        const img = new Image();
        img.onload = () => {
            if (img.height < PARALLAX_MIN_HEIGHT && hero.parallax) {
                setParallaxWarning(true);
            } else {
                setParallaxWarning(false);
            }
        };
        img.src = url;
    }, [hero.parallax]);

    // Check first image when parallax is enabled
    useEffect(() => {
        if (hero.parallax && heroImages.length > 0) {
            checkImageForParallax(heroImages[0].url);
        } else {
            setParallaxWarning(false);
        }
    }, [hero.parallax, heroImages, checkImageForParallax]);

    // Upload image with size validation
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (heroImages.length >= HERO_MAX_IMAGES) {
            toast.error(`Maksimalt ${HERO_MAX_IMAGES} billeder tilladt`);
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast.error('Kun billeder er tilladt');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Billedet må højst være 5MB');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `banner-${Date.now()}.${fileExt}`;
            const filePath = `branding/${tenantId || 'master'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            const newImage: HeroImage = {
                id: generateId(),
                url: publicUrl,
                alt: "",
                sortOrder: heroImages.length,
            };

            updateHero({
                images: [...heroImages, newImage],
                media: [...(hero.media || []), publicUrl],
            });

            // Check dimensions for parallax
            if (hero.parallax) {
                checkImageForParallax(publicUrl);
            }

            toast.success('Billede uploadet');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Kunne ikke uploade billede');
        } finally {
            setUploading(false);
        }
    };

    // Upload video
    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (heroVideos.length >= HERO_MAX_VIDEOS) {
            toast.error(`Maksimalt ${HERO_MAX_VIDEOS} videoer tilladt`);
            return;
        }

        if (!file.type.startsWith('video/')) {
            toast.error('Kun videoer er tilladt');
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            toast.error('Videoen må højst være 50MB');
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `banner-video-${Date.now()}.${fileExt}`;
            const filePath = `branding/${tenantId || 'master'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            const newVideo: HeroVideo = {
                id: generateId(),
                url: publicUrl,
                sortOrder: heroVideos.length,
            };

            updateHero({
                videos: [...heroVideos, newVideo],
            });

            toast.success('Video uploadet');
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Kunne ikke uploade video');
        } finally {
            setUploading(false);
        }
    };

    // Add master background
    const addMasterBackground = (asset: MasterAsset) => {
        if (heroImages.length >= HERO_MAX_IMAGES) {
            toast.error(`Maksimalt ${HERO_MAX_IMAGES} billeder tilladt`);
            return;
        }

        const newImage: HeroImage = {
            id: generateId(),
            url: asset.url,
            alt: asset.name,
            sortOrder: heroImages.length,
            masterAssetId: asset.id,
        };

        updateHero({
            images: [...heroImages, newImage],
            media: [...(hero.media || []), asset.url],
        });

        toast.success(`"${asset.name}" tilføjet`);
    };

    // Remove image
    const removeImage = (imageId: string) => {
        const removedImage = heroImages.find(img => img.id === imageId);
        const newImages = heroImages.filter(img => img.id !== imageId);

        updateHero({
            images: newImages.map((img, i) => ({ ...img, sortOrder: i })),
            media: removedImage
                ? (hero.media || []).filter(url => url !== removedImage.url)
                : hero.media,
        });
    };

    // Remove video
    const removeVideo = (videoId: string) => {
        const newVideos = heroVideos.filter(v => v.id !== videoId);
        updateHero({
            videos: newVideos.map((v, i) => ({ ...v, sortOrder: i })),
        });
    };

    // Download image
    const downloadImage = async (url: string, index: number) => {
        try {
            // Fetch the image as a blob
            const response = await fetch(url);
            const blob = await response.blob();

            // Create a download link
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);

            // Generate filename from URL or use default
            const urlParts = url.split('/');
            let filename = urlParts[urlParts.length - 1];
            if (!filename || filename.includes('?')) {
                // Extract extension from content-type or use jpg
                const ext = blob.type.split('/')[1] || 'jpg';
                filename = `banner-image-${index + 1}.${ext}`;
            }

            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            toast.success('Billede downloadet');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Kunne ikke downloade billede');
        }
    };

    // Drag handlers for images
    const handleDragStart = (index: number) => setDraggedIndex(index);

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newImages = [...heroImages];
        const draggedItem = newImages[draggedIndex];
        newImages.splice(draggedIndex, 1);
        newImages.splice(index, 0, draggedItem);

        updateHero({
            images: newImages.map((img, i) => ({ ...img, sortOrder: i })),
            media: newImages.map(img => img.url),
        });
        setDraggedIndex(index);
    };

    const handleDragEnd = () => setDraggedIndex(null);

    // Button management with extended color support
    const addButton = () => {
        const currentButtons = (hero.overlay.buttons || []) as BannerButton[];
        if (currentButtons.length >= 2) {
            toast.error('Maksimalt 2 knapper tilladt');
            return;
        }

        const newButton: BannerButton = {
            id: generateId(),
            label: currentButtons.length === 0 ? "Se produkter" : "Kontakt os",
            variant: currentButtons.length === 0 ? 'primary' : 'secondary',
            linkType: currentButtons.length === 0 ? 'ALL_PRODUCTS' : 'INTERNAL_PAGE',
            target: currentButtons.length === 0 ? {} : { path: '/kontakt' },
            textColor: '#FFFFFF',
            bgColor: currentButtons.length === 0 ? '#0EA5E9' : 'transparent',
            bgOpacity: 1,
        };

        updateOverlay({ buttons: [...currentButtons, newButton] });
    };

    const updateButton = (buttonId: string, updates: Partial<BannerButton>) => {
        const buttons = (hero.overlay.buttons || []) as BannerButton[];
        updateOverlay({
            buttons: buttons.map(btn =>
                btn.id === buttonId ? { ...btn, ...updates } : btn
            ),
        });
    };

    const removeButton = (buttonId: string) => {
        updateOverlay({
            buttons: ((hero.overlay.buttons || []) as BannerButton[]).filter(btn => btn.id !== buttonId),
        });
    };

    return (
        <div className="space-y-6">
            {/* Media Type Selector */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Banner Type</CardTitle>
                    <CardDescription>Vælg om banner skal vise billeder eller video</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs
                        value={hero.mediaType}
                        onValueChange={(v) => updateHero({ mediaType: v as 'images' | 'video' })}
                    >
                        <TabsList className="grid grid-cols-2 w-full max-w-xs">
                            <TabsTrigger value="images" className="gap-2">
                                <ImageIcon className="w-4 h-4" />
                                Billeder
                            </TabsTrigger>
                            <TabsTrigger value="video" className="gap-2">
                                <Video className="w-4 h-4" />
                                Video
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Images Mode */}
            {hero.mediaType === 'images' && (
                <>
                    {/* Image Gallery */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <ImageIcon className="w-5 h-5" />
                                Banner Billeder
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Anbefalet: <strong>{HERO_RECOMMENDED_WIDTH} × {HERO_RECOMMENDED_HEIGHT} px</strong>
                                <Badge variant="outline" className="ml-2">{heroImages.length} / {HERO_MAX_IMAGES}</Badge>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Fit Mode */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Billedtilpasning</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Hvordan billeder skaleres (cover fylder området uden strækning)
                                    </p>
                                </div>
                                <Select
                                    value={hero.fitMode}
                                    onValueChange={(v) => updateHero({ fitMode: v as 'cover' | 'contain' })}
                                >
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cover">Fyld (beskær)</SelectItem>
                                        <SelectItem value="contain">Tilpas (ingen beskæring)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Master Backgrounds */}
                            {masterBackgrounds.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Vælg fra bibliotek</Label>
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {masterBackgrounds.map((asset) => (
                                            <button
                                                key={asset.id}
                                                onClick={() => addMasterBackground(asset)}
                                                className="flex-shrink-0 w-24 h-14 rounded-lg border overflow-hidden hover:ring-2 ring-primary transition-all"
                                                title={asset.name}
                                            >
                                                <img
                                                    src={asset.thumbnail_url || asset.url}
                                                    alt={asset.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Image Gallery */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {heroImages.map((image, index) => (
                                    <div
                                        key={image.id}
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`relative aspect-video rounded-lg border overflow-hidden group cursor-move
                                            ${draggedIndex === index ? 'opacity-50 ring-2 ring-primary' : ''}`}
                                    >
                                        <img
                                            src={image.url}
                                            alt={image.alt || `Banner ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <GripVertical className="w-6 h-6 text-white" />
                                        </div>
                                        {/* Action buttons */}
                                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    downloadImage(image.url, index);
                                                }}
                                                title="Download billede"
                                            >
                                                <Download className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => removeImage(image.id)}
                                                title="Slet billede"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Badge className="absolute bottom-1 left-1" variant="secondary">
                                            {index + 1}
                                        </Badge>
                                    </div>
                                ))}

                                {heroImages.length < HERO_MAX_IMAGES && (
                                    <label className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                        <span className="text-sm text-muted-foreground">
                                            {uploading ? 'Uploader...' : 'Upload'}
                                        </span>
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            disabled={uploading}
                                        />
                                    </label>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Slideshow Settings */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2">
                                <Play className="w-5 h-5" />
                                Slideshow
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Automatisk afspilning</Label>
                                    <p className="text-xs text-muted-foreground">Skift automatisk mellem billeder</p>
                                </div>
                                <Switch
                                    checked={hero.slideshow.autoplay}
                                    onCheckedChange={(v) => updateSlideshow({ autoplay: v })}
                                />
                            </div>

                            {hero.slideshow.autoplay && (
                                <div className="space-y-2">
                                    <Label>Interval: {(hero.slideshow.intervalMs / 1000).toFixed(1)}s</Label>
                                    <Slider
                                        value={[hero.slideshow.intervalMs]}
                                        onValueChange={([v]) => updateSlideshow({ intervalMs: v })}
                                        min={2000}
                                        max={15000}
                                        step={500}
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Overgangseffekt</Label>
                                <Select
                                    value={hero.slideshow.transition}
                                    onValueChange={(v) => updateSlideshow({ transition: v as 'fade' | 'slide' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fade">Fade (blød)</SelectItem>
                                        <SelectItem value="slide">Slide (glid)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Parallax Effect with Warning */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Parallax Effekt</Label>
                                        <p className="text-xs text-muted-foreground">Billede bevæger sig ved scroll</p>
                                    </div>
                                    <Switch
                                        checked={hero.parallax}
                                        onCheckedChange={(v) => updateHero({ parallax: v })}
                                    />
                                </div>

                                {parallaxWarning && hero.parallax && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <p>
                                            Parallax fungerer bedst med billeder der er højere end {PARALLAX_MIN_HEIGHT}px.
                                            Dit nuværende billede er muligvis for kort til en flydende parallax-effekt.
                                        </p>
                                    </div>
                                )}

                                {hero.parallax && (
                                    <div className="text-xs text-muted-foreground p-2 rounded bg-muted">
                                        <strong>Tip:</strong> For bedste parallax-effekt, brug billeder der er mindst {PARALLAX_MIN_HEIGHT}px høje.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Video Mode */}
            {hero.mediaType === 'video' && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2">
                            <Video className="w-5 h-5" />
                            Banner Video
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            Op til {HERO_MAX_VIDEOS} videoer støttes
                            <Badge variant="outline" className="ml-2">{heroVideos.length} / {HERO_MAX_VIDEOS}</Badge>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-muted/50 p-3 rounded-md text-xs space-y-1 text-muted-foreground border">
                            <p className="font-medium text-foreground">Formatkrav:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                <li>Formater: MP4, WebM (H.264 anbefalet)</li>
                                <li>Max filstørrelse: 50MB</li>
                                <li>Anbefalet opløsning: 1920x1080px (16:9)</li>
                                <li>Video vil blive vist uden lyd (muted)</li>
                            </ul>
                        </div>

                        {/* Video List */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {heroVideos.map((video, index) => (
                                <div
                                    key={video.id}
                                    className="relative aspect-video rounded-lg border overflow-hidden group"
                                >
                                    <video
                                        src={video.url}
                                        className="w-full h-full object-cover"
                                        muted
                                        loop
                                        playsInline
                                    />
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => removeVideo(video.id)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                    <Badge className="absolute bottom-1 left-1" variant="secondary">
                                        {index + 1}
                                    </Badge>
                                </div>
                            ))}

                            {heroVideos.length < HERO_MAX_VIDEOS && (
                                <label className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                    <span className="text-sm text-muted-foreground">
                                        {uploading ? 'Uploader...' : 'Upload video'}
                                    </span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="video/*"
                                        onChange={handleVideoUpload}
                                        disabled={uploading}
                                    />
                                </label>
                            )}
                        </div>

                        {/* Video Settings */}
                        <Separator />

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Video tilpasning</Label>
                                <p className="text-xs text-muted-foreground">Hvordan video skaleres</p>
                            </div>
                            <Select
                                value={hero.videoSettings.fitMode}
                                onValueChange={(v) => updateVideoSettings({ fitMode: v as 'cover' | 'contain' })}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cover">Fyld (beskær)</SelectItem>
                                    <SelectItem value="contain">Tilpas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Loop</Label>
                                <p className="text-xs text-muted-foreground">Gentag video automatisk</p>
                            </div>
                            <Switch
                                checked={hero.videoSettings.loop}
                                onCheckedChange={(v) => updateVideoSettings({ loop: v })}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Parallax Effekt</Label>
                                <p className="text-xs text-muted-foreground">Video bevæger sig ved scroll</p>
                            </div>
                            <Switch
                                checked={hero.videoSettings.parallaxEnabled}
                                onCheckedChange={(v) => updateVideoSettings({ parallaxEnabled: v })}
                            />
                        </div>

                        {heroVideos.length > 1 && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Automatisk skift</Label>
                                        <p className="text-xs text-muted-foreground">Skift mellem videoer</p>
                                    </div>
                                    <Switch
                                        checked={hero.slideshow.autoplay}
                                        onCheckedChange={(v) => updateSlideshow({ autoplay: v })}
                                    />
                                </div>

                                {hero.slideshow.autoplay && (
                                    <div className="space-y-2">
                                        <Label>Interval: {(hero.slideshow.intervalMs / 1000).toFixed(0)}s</Label>
                                        <Slider
                                            value={[hero.slideshow.intervalMs]}
                                            onValueChange={([v]) => updateSlideshow({ intervalMs: v })}
                                            min={5000}
                                            max={30000}
                                            step={1000}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Banner Overlay Settings */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Banner Overlay</CardTitle>
                    <CardDescription>Overlay farve og gennemsigtighed over bannerbilledet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ColorPickerWithSwatches
                        label="Overlay Farve"
                        value={hero.overlay_color}
                        onChange={(color) => updateHero({ overlay_color: color })}
                        showOpacity={true}
                        opacity={hero.overlay_opacity}
                        onOpacityChange={(opacity) => updateHero({ overlay_opacity: opacity })}
                        showFullSwatches={true}
                    />
                </CardContent>
            </Card>

            {/* Banner Text & Buttons */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle>Banner Tekst & Knapper</CardTitle>
                    <CardDescription>Tekst og knapper vist oven på banneret</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Title with color */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Banner Titel</Label>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Farve:</Label>
                                <ColorPickerWithSwatches
                                    value={(extendedOverlay as any)?.titleColor || '#FFFFFF'}
                                    onChange={(color) => updateOverlay({ titleColor: color } as any)}
                                    compact={true}
                                    showFullSwatches={false}
                                />
                            </div>
                        </div>
                        <Input
                            value={hero.overlay.title}
                            onChange={(e) => updateOverlay({ title: e.target.value })}
                            placeholder="Din fængende overskrift her..."
                        />
                    </div>

                    {/* Subtitle with color */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Banner Undertitel</Label>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs text-muted-foreground">Farve:</Label>
                                <ColorPickerWithSwatches
                                    value={(extendedOverlay as any)?.subtitleColor || '#FFFFFF'}
                                    onChange={(color) => updateOverlay({ subtitleColor: color } as any)}
                                    compact={true}
                                    showFullSwatches={false}
                                />
                            </div>
                        </div>
                        <Textarea
                            value={hero.overlay.subtitle}
                            onChange={(e) => updateOverlay({ subtitle: e.target.value })}
                            placeholder="Kort beskrivelse..."
                            rows={2}
                        />
                    </div>

                    <Separator />

                    {/* Buttons Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Vis knapper</Label>
                            <p className="text-xs text-muted-foreground">Call-to-action knapper</p>
                        </div>
                        <Switch
                            checked={hero.overlay.showButtons}
                            onCheckedChange={(v) => updateOverlay({ showButtons: v })}
                        />
                    </div>

                    {/* Button Editor with color controls */}
                    {hero.overlay.showButtons && (
                        <div className="space-y-3">
                            {((hero.overlay.buttons || []) as BannerButton[]).map((button, index) => (
                                <Card key={button.id} className="p-4">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Badge variant={button.variant === 'primary' ? 'default' : 'outline'}>
                                                Knap {index + 1}
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeButton(button.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="grid sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Tekst</Label>
                                                <Input
                                                    value={button.label}
                                                    onChange={(e) => updateButton(button.id, { label: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Stil</Label>
                                                <Select
                                                    value={button.variant}
                                                    onValueChange={(v) => updateButton(button.id, { variant: v as 'primary' | 'secondary' })}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="primary">Primær</SelectItem>
                                                        <SelectItem value="secondary">Sekundær</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Button Color Controls */}
                                        <div className="grid sm:grid-cols-3 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Tekst farve</Label>
                                                <div className="flex items-center gap-2">
                                                    <ColorPickerWithSwatches
                                                        value={button.textColor || '#FFFFFF'}
                                                        onChange={(color) => updateButton(button.id, { textColor: color })}
                                                        compact={true}
                                                        showFullSwatches={false}
                                                    />
                                                    <Input
                                                        value={button.textColor || '#FFFFFF'}
                                                        onChange={(e) => updateButton(button.id, { textColor: e.target.value })}
                                                        className="font-mono text-xs flex-1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Baggrund farve</Label>
                                                <div className="flex items-center gap-2">
                                                    <ColorPickerWithSwatches
                                                        value={button.bgColor || '#0EA5E9'}
                                                        onChange={(color) => updateButton(button.id, { bgColor: color })}
                                                        compact={true}
                                                        showFullSwatches={false}
                                                        showOpacity={false}
                                                    />
                                                    <Input
                                                        value={button.bgColor || '#0EA5E9'}
                                                        onChange={(e) => updateButton(button.id, { bgColor: e.target.value })}
                                                        className="font-mono text-xs flex-1"
                                                    />
                                                </div>
                                                <div className="pt-2 px-1">
                                                    <div className="flex justify-between mb-1">
                                                        <Label className="text-[10px] text-muted-foreground">Gennemsigtighed</Label>
                                                        <span className="text-[10px] text-muted-foreground">{Math.round((button.bgOpacity ?? 1) * 100)}%</span>
                                                    </div>
                                                    <Slider
                                                        value={[button.bgOpacity ?? 1]}
                                                        onValueChange={([v]) => updateButton(button.id, { bgOpacity: v })}
                                                        min={0}
                                                        max={1}
                                                        step={0.1}
                                                        className="h-4"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid sm:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Link type</Label>
                                                <Select
                                                    value={button.linkType}
                                                    onValueChange={(v) => updateButton(button.id, {
                                                        linkType: v as HeroButtonLinkType,
                                                        target: {}
                                                    })}
                                                >
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ALL_PRODUCTS">Alle produkter</SelectItem>
                                                        <SelectItem value="PRODUCT">Specifikt produkt</SelectItem>
                                                        <SelectItem value="INTERNAL_PAGE">Intern side</SelectItem>
                                                        <SelectItem value="EXTERNAL_URL">Ekstern URL</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Destination</Label>
                                                {button.linkType === 'ALL_PRODUCTS' && (
                                                    <Input value="/shop" disabled className="bg-muted" />
                                                )}
                                                {button.linkType === 'PRODUCT' && (
                                                    <Select
                                                        value={button.target?.productId || ""}
                                                        onValueChange={(v) => {
                                                            const prod = products.find(p => p.id === v);
                                                            updateButton(button.id, {
                                                                target: { productId: v, productSlug: prod?.slug }
                                                            });
                                                        }}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Vælg" /></SelectTrigger>
                                                        <SelectContent>
                                                            {products.map(p => (
                                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                                {button.linkType === 'INTERNAL_PAGE' && (
                                                    <Select
                                                        value={button.target?.path || ""}
                                                        onValueChange={(v) => updateButton(button.id, { target: { path: v } })}
                                                    >
                                                        <SelectTrigger><SelectValue placeholder="Vælg" /></SelectTrigger>
                                                        <SelectContent>
                                                            {INTERNAL_PAGES.map(p => (
                                                                <SelectItem key={p.path} value={p.path}>{p.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                                {button.linkType === 'EXTERNAL_URL' && (
                                                    <Input
                                                        value={button.target?.url || ""}
                                                        onChange={(e) => updateButton(button.id, { target: { url: e.target.value } })}
                                                        placeholder="https://"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            {((hero.overlay.buttons || []) as BannerButton[]).length < 2 && (
                                <Button variant="outline" className="w-full" onClick={addButton}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Tilføj knap
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// Re-export as HeroEditor for backwards compatibility
export { BannerEditor as HeroEditor };
