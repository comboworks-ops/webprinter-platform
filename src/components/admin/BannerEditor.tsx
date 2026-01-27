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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import {
    Upload, Trash2, GripVertical, Plus, Image as ImageIcon,
    Video, Play, Info, AlertCircle, ExternalLink, AlertTriangle, Download, Sparkles, ChevronDown, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FontSelector } from "./FontSelector";
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
    type HeroTextAnimation,
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
    savedSwatches?: string[];
    onSaveSwatch?: (color: string) => void;
    onRemoveSwatch?: (color: string) => void;
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
    category_id?: string | null;
    tags?: string[];
    sort_order?: number;
    is_published?: boolean;
    created_at?: string;
    updated_at?: string;
}

// Extended button type with color settings
export interface BannerButton extends HeroButton {
    textColor?: string;
    bgColor?: string;
    bgOpacity?: number;
}

// Extended overlay settings with text colors and fonts
export interface BannerOverlaySettings extends HeroOverlaySettings {
    titleColor?: string;
    subtitleColor?: string;
    titleFontId?: string;       // Font for banner title
    subtitleFontId?: string;    // Font for banner subtitle
    usePerBannerStyling?: boolean; // Toggle: false = global styling, true = per-banner styling
    buttons: BannerButton[];
}

// Text animation presets - professional effects for banner text
export const TEXT_ANIMATION_PRESETS: { value: HeroTextAnimation; label: string; description: string }[] = [
    {
        value: 'none',
        label: 'Ingen animation',
        description: 'Tekst vises med det samme'
    },
    {
        value: 'fade',
        label: 'Fade In',
        description: 'Blød indtoningseffekt'
    },
    {
        value: 'slide-up',
        label: 'Slide Op',
        description: 'Tekst glider op nedefra'
    },
    {
        value: 'slide-down',
        label: 'Slide Ned',
        description: 'Tekst glider ned oppefra'
    },
    {
        value: 'scale',
        label: 'Zoom Ind',
        description: 'Tekst vokser fra mindre til normal'
    },
    {
        value: 'blur',
        label: 'Fokusér',
        description: 'Tekst skifter fra sløret til skarp'
    },
];

export function BannerEditor({ draft, updateDraft, tenantId, savedSwatches, onSaveSwatch, onRemoveSwatch }: BannerEditorProps) {
    const [uploading, setUploading] = useState(false);
    const [uploadingToLibrary, setUploadingToLibrary] = useState(false);
    const [products, setProducts] = useState<Array<{ id: string; name: string; slug: string }>>([]);
    const [masterBackgrounds, setMasterBackgrounds] = useState<MasterAsset[]>([]);
    const [tenantLibrary, setTenantLibrary] = useState<MasterAsset[]>([]);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [parallaxWarning, setParallaxWarning] = useState(false);
    const [selectedBannerIndex, setSelectedBannerIndex] = useState(0);

    // Ensure hero has all defaults
    const hero: HeroSettings = {
        ...DEFAULT_HERO,
        ...draft.hero,
        // Vital: if draft.hero.images exists (even if empty []), use it.
        // If it's missing entirely (undefined), we might be in legacy mode or first load.
        images: (draft.hero?.images !== undefined)
            ? draft.hero.images
            : (draft.hero?.media && draft.hero.media.length > 0)
                ? draft.hero.media.map((url, i) => ({ id: `legacy-${i}`, url, sortOrder: i }))
                : (draft.hero?.images === undefined ? DEFAULT_HERO.images : []),
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

    // Fetch master backgrounds from 'banners' category
    useEffect(() => {
        async function fetchMasterBackgrounds() {
            try {
                // First get the 'forside-banner' category ID (homepage hero backgrounds)
                const { data: categoryData, error: categoryError } = await supabase
                    .from('resource_categories' as any)
                    .select('id')
                    .or('slug.eq.forside-bannere,slug.eq.banners')
                    .limit(1)
                    .maybeSingle();

                if (categoryError || !categoryData) return;

                const categoryId = (categoryData as any).id;

                // Then fetch assets from that category
                const { data } = await supabase
                    .from('master_assets' as any)
                    .select('id, name, url, thumbnail_url')
                    .eq('category_id', categoryId)
                    .eq('is_published', true)
                    .order('sort_order');

                if (data && data.length > 0) {
                    setMasterBackgrounds(data as unknown as MasterAsset[]);
                }
            } catch (error) {
                console.error('Error fetching master backgrounds:', error);
            }
        }
        fetchMasterBackgrounds();
    }, []);

    // Fetch tenant's own library banners
    useEffect(() => {
        async function fetchTenantLibrary() {
            if (!tenantId) return;
            try {
                const { data } = await supabase
                    .from('tenant_banner_library' as any)
                    .select('id, name, url, thumbnail_url, created_at')
                    .eq('tenant_id', tenantId)
                    .order('created_at', { ascending: false });

                if (data && data.length > 0) {
                    setTenantLibrary(data.map((item: any) => ({
                        id: item.id,
                        name: item.name || 'Navnløs',
                        url: item.url,
                        thumbnail_url: item.thumbnail_url,
                        category_id: null,
                        tags: [],
                        sort_order: 0,
                        is_published: true,
                        created_at: item.created_at,
                        updated_at: item.created_at,
                    })));
                }
            } catch (error) {
                // Table might not exist yet, that's OK
                console.log('Tenant library not available:', error);
            }
        }
        fetchTenantLibrary();
    }, [tenantId]);

    // Upload to tenant's library
    const handleLibraryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !tenantId) return;

        const file = e.target.files[0];
        setUploadingToLibrary(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `library-${Date.now()}.${fileExt}`;
            const filePath = `branding/${tenantId}/library/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            // Try to save to tenant_banner_library table
            const { data: insertedData, error: insertError } = await supabase
                .from('tenant_banner_library' as any)
                .insert({
                    tenant_id: tenantId,
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    url: publicUrl,
                    thumbnail_url: publicUrl,
                })
                .select()
                .single();

            if (insertError) {
                // If table doesn't exist, just add directly to hero
                console.log('Could not save to library, adding directly:', insertError);
                addMasterBackground({
                    id: `uploaded-${Date.now()}`,
                    name: file.name,
                    url: publicUrl,
                    thumbnail_url: publicUrl,
                    category_id: null,
                    tags: [],
                    sort_order: 0,
                    is_published: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as MasterAsset);
                toast.success('Billede tilføjet til banner');
            } else {
                // Add to local state
                setTenantLibrary(prev => [{
                    id: (insertedData as any).id,
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    url: publicUrl,
                    thumbnail_url: publicUrl,
                    category_id: null,
                    tags: [],
                    sort_order: 0,
                    is_published: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                }, ...prev]);
                toast.success('Billede gemt i dit bibliotek');
            }
        } catch (error) {
            console.error('Library upload error:', error);
            toast.error('Kunne ikke uploade billede');
        } finally {
            setUploadingToLibrary(false);
            e.target.value = '';
        }
    };

    // Delete from tenant library
    const handleLibraryDelete = async (asset: MasterAsset) => {
        if (!tenantId) return;

        try {
            await supabase
                .from('tenant_banner_library' as any)
                .delete()
                .eq('id', asset.id);

            // Remove from storage
            const urlObj = new URL(asset.url);
            const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/product-images\/(.+)/);
            if (pathMatch) {
                await supabase.storage.from('product-images').remove([pathMatch[1]]);
            }

            setTenantLibrary(prev => prev.filter(a => a.id !== asset.id));
            toast.success('Billede slettet fra bibliotek');
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Kunne ikke slette billede');
        }
    };

    // Get images and videos from hero (we respect an empty array if explicitly set)
    const heroImages: HeroImage[] = hero.images || [];

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
                textAnimation: 'slide-up', // Default standard animation
                buttons: [{ // Default standard button
                    id: generateId(),
                    label: "Se produkter",
                    variant: 'primary',
                    linkType: 'ALL_PRODUCTS',
                    target: {},
                    textColor: '#FFFFFF',
                    bgColor: '#0EA5E9',
                    bgOpacity: 1
                }]
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
            {/* Combined Banner Media Card */}
            <CollapsibleCard
                title="Banner Medier"
                description="Vælg medietype og upload billeder eller video til dit banner"
                icon={hero.mediaType === 'images' ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                defaultOpen={false}
            >
                <div className="space-y-4">
                    {/* Media Type Selector - Integrated */}
                    <div className="flex items-center justify-between pb-3 border-b">
                        <div>
                            <Label>Banner Type</Label>
                            <p className="text-xs text-muted-foreground">Vælg billeder eller video</p>
                        </div>
                        <Tabs
                            value={hero.mediaType}
                            onValueChange={(v) => updateHero({ mediaType: v as 'images' | 'video' })}
                        >
                            <TabsList className="grid grid-cols-2">
                                <TabsTrigger value="images" className="gap-2 px-4">
                                    <ImageIcon className="w-4 h-4" />
                                    Billeder
                                </TabsTrigger>
                                <TabsTrigger value="video" className="gap-2 px-4">
                                    <Video className="w-4 h-4" />
                                    Video
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Images Mode Content */}
                    {hero.mediaType === 'images' && (
                        <>
                            {/* Image count and recommendations */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Info className="w-4 h-4" />
                                Anbefalet: <strong>{HERO_RECOMMENDED_WIDTH} × {HERO_RECOMMENDED_HEIGHT} px</strong>
                                <Badge variant="outline" className="ml-2">{heroImages.length} / {HERO_MAX_IMAGES}</Badge>
                            </div>

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

                            {/* Master Backgrounds - Collapsible with hover preview */}
                            {masterBackgrounds.length > 0 && (
                                <Collapsible>
                                    <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                                        <div className="flex items-center gap-2">
                                            <ImageIcon className="w-4 h-4 text-primary" />
                                            <span className="font-medium">Vælg fra bibliotek</span>
                                            <span className="text-xs text-muted-foreground">({masterBackgrounds.length} billeder)</span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 transition-transform [data-state=open]>rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-3">
                                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {masterBackgrounds.map((asset) => (
                                                <div key={asset.id} className="relative group">
                                                    <button
                                                        onClick={() => addMasterBackground(asset)}
                                                        className="w-full aspect-video rounded-lg border overflow-hidden hover:ring-2 ring-primary transition-all"
                                                        title={`Klik for at tilføje: ${asset.name}`}
                                                    >
                                                        <img
                                                            src={asset.thumbnail_url || asset.url}
                                                            alt={asset.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                    {/* Hover Preview */}
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none hidden group-hover:block">
                                                        <div className="bg-background border rounded-xl shadow-2xl p-2 min-w-[300px] max-w-[400px]">
                                                            <img
                                                                src={asset.url}
                                                                alt={asset.name}
                                                                className="w-full h-auto rounded-lg max-h-[200px] object-cover"
                                                            />
                                                            <p className="text-sm font-medium mt-2 text-center truncate">{asset.name}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            )}

                            {/* Tenant's Own Library - Collapsible with upload */}
                            <Collapsible defaultOpen={tenantLibrary.length > 0}>
                                <CollapsibleTrigger className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                                    <div className="flex items-center gap-2">
                                        <Upload className="w-4 h-4 text-primary" />
                                        <span className="font-medium">Mit bibliotek</span>
                                        {tenantLibrary.length > 0 && (
                                            <span className="text-xs text-muted-foreground">({tenantLibrary.length} billeder)</span>
                                        )}
                                    </div>
                                    <ChevronDown className="w-4 h-4 transition-transform [data-state=open]>rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-3 space-y-3">
                                    {/* Upload Button */}
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors">
                                            {uploadingToLibrary ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Upload className="w-4 h-4" />
                                            )}
                                            <span className="text-sm font-medium">Upload til bibliotek</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleLibraryUpload}
                                                disabled={uploadingToLibrary}
                                                className="hidden"
                                            />
                                        </label>
                                        <span className="text-xs text-muted-foreground">
                                            Upload billeder for at gemme til senere brug
                                        </span>
                                    </div>

                                    {/* Tenant Library Grid */}
                                    {tenantLibrary.length > 0 ? (
                                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {tenantLibrary.map((asset) => (
                                                <div key={asset.id} className="relative group">
                                                    <button
                                                        onClick={() => addMasterBackground(asset)}
                                                        className="w-full aspect-video rounded-lg border overflow-hidden hover:ring-2 ring-primary transition-all"
                                                        title={`Klik for at tilføje: ${asset.name}`}
                                                    >
                                                        <img
                                                            src={asset.thumbnail_url || asset.url}
                                                            alt={asset.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                    {/* Delete button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleLibraryDelete(asset);
                                                        }}
                                                        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Slet fra bibliotek"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    {/* Hover Preview */}
                                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none hidden group-hover:block">
                                                        <div className="bg-background border rounded-xl shadow-2xl p-2 min-w-[300px] max-w-[400px]">
                                                            <img
                                                                src={asset.url}
                                                                alt={asset.name}
                                                                className="w-full h-auto rounded-lg max-h-[200px] object-cover"
                                                            />
                                                            <p className="text-sm font-medium mt-2 text-center truncate">{asset.name}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-muted-foreground text-sm">
                                            <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p>Ingen billeder i dit bibliotek endnu</p>
                                            <p className="text-xs mt-1">Upload billeder for at genbruge dem senere</p>
                                        </div>
                                    )}
                                </CollapsibleContent>
                            </Collapsible>

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

                            {/* Slideshow Settings - collapsible */}
                            <Separator />
                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2">
                                    <h4 className="font-medium flex items-center gap-2">
                                        <Play className="w-4 h-4" />
                                        Slideshow
                                    </h4>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 pt-3">
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

                                    {/* Parallax Effect */}
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
                                </CollapsibleContent>
                            </Collapsible>
                        </>
                    )}

                    {/* Video Mode Content */}
                    {hero.mediaType === 'video' && (
                        <>
                            {/* Video info */}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Info className="w-4 h-4" />
                                Op til {HERO_MAX_VIDEOS} videoer støttes
                                <Badge variant="outline" className="ml-2">{heroVideos.length} / {HERO_MAX_VIDEOS}</Badge>
                            </div>

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

                            {/* Video Settings - collapsible */}
                            <Separator />
                            <Collapsible defaultOpen={false}>
                                <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2">
                                    <h4 className="font-medium">Video Indstillinger</h4>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 pt-3">
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
                                </CollapsibleContent>
                            </Collapsible>
                        </>
                    )}

                    {/* Banner Overlay Settings - collapsible */}
                    <Separator />
                    <Collapsible defaultOpen={false}>
                        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-md px-2 -mx-2">
                            <div>
                                <h4 className="font-medium text-left">Overlay</h4>
                                <p className="text-xs text-muted-foreground text-left">
                                    Farve og gennemsigtighed lagt over banneret
                                </p>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <Label>Overlay Farve</Label>
                                        <div className="flex items-center gap-1.5">
                                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Kun dette banner</Label>
                                            <Switch
                                                checked={hero.usePerBannerOverlay || false}
                                                onCheckedChange={(checked) => updateHero({ usePerBannerOverlay: checked })}
                                            />
                                        </div>
                                    </div>

                                    {/* Visual Banner Selector (Images + Overlay Preview) */}
                                    {hero.usePerBannerOverlay && (
                                        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mb-2">
                                            {heroImages.map((img, idx) => {
                                                const isActive = idx === selectedBannerIndex;
                                                const ovColor = (img as any).overlayColor || hero.overlay_color || '#000000';
                                                const ovOpacity = (img as any).overlayOpacity ?? hero.overlay_opacity ?? 0.3;

                                                return (
                                                    <button
                                                        key={img.id}
                                                        onClick={() => setSelectedBannerIndex(idx)}
                                                        className={`relative aspect-video rounded-md overflow-hidden border-2 transition-all ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-80 hover:opacity-100 hover:border-muted-foreground/50'
                                                            }`}
                                                    >
                                                        <img src={img.url} className="w-full h-full object-cover" alt="" />

                                                        {/* Live Overlay Preview */}
                                                        <div
                                                            className="absolute inset-0 transition-colors duration-200"
                                                            style={{ backgroundColor: ovColor, opacity: ovOpacity }}
                                                        />

                                                        {/* Simple Badge */}
                                                        <div className="absolute top-0 left-0 text-[8px] font-medium bg-black/60 text-white px-1 rounded-br-sm backdrop-blur-[1px]">
                                                            #{idx + 1}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <ColorPickerWithSwatches
                                    label=""
                                    value={hero.usePerBannerOverlay
                                        ? ((heroImages[selectedBannerIndex] as any).overlayColor || hero.overlay_color)
                                        : hero.overlay_color}
                                    onChange={(color) => {
                                        if (hero.usePerBannerOverlay) {
                                            const newImages = [...heroImages] as any[];
                                            newImages[selectedBannerIndex] = {
                                                ...newImages[selectedBannerIndex],
                                                overlayColor: color
                                            };
                                            updateHero({ images: newImages });
                                        } else {
                                            updateHero({ overlay_color: color });
                                        }
                                    }}
                                    showOpacity={true}
                                    opacity={hero.usePerBannerOverlay
                                        ? ((heroImages[selectedBannerIndex] as any).overlayOpacity ?? hero.overlay_opacity)
                                        : hero.overlay_opacity}
                                    onOpacityChange={(opacity) => {
                                        if (hero.usePerBannerOverlay) {
                                            const newImages = [...heroImages] as any[];
                                            newImages[selectedBannerIndex] = {
                                                ...newImages[selectedBannerIndex],
                                                overlayOpacity: opacity
                                            };
                                            updateHero({ images: newImages });
                                        } else {
                                            updateHero({ overlay_opacity: opacity });
                                        }
                                    }}
                                    showFullSwatches={true}
                                />
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            </CollapsibleCard>

            {/* Banner Text & Buttons */}
            <CollapsibleCard
                title="Banner Tekst & Knapper"
                description="Tekst og knapper vist oven på hvert banner. Vælg et banner for at redigere dets tekst."
                icon={<Sparkles className="h-4 w-4" />}
                defaultOpen={false}
            >
                <div className="space-y-4">
                    {/* Banner Selector - Visual Thumbnails */}
                    {heroImages.length > 0 && (
                        <div className="space-y-3">
                            <Label>Vælg banner at redigere</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {heroImages.map((image, index) => {
                                    const isSelected = selectedBannerIndex === index;
                                    return (
                                        <button
                                            key={image.id}
                                            onClick={() => setSelectedBannerIndex(index)}
                                            className={`relative aspect-video rounded-lg border-2 overflow-hidden transition-all ${isSelected
                                                ? 'border-primary ring-2 ring-primary/30'
                                                : 'border-muted hover:border-muted-foreground/50'
                                                }`}
                                        >
                                            <img
                                                src={image.url}
                                                alt={`Banner ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className={`absolute inset-0 flex items-center justify-center ${isSelected ? 'bg-primary/20' : 'bg-black/30'
                                                }`}>
                                                <Badge variant={isSelected ? 'default' : 'secondary'} className="text-xs">
                                                    {index + 1}
                                                </Badge>
                                            </div>
                                            {/* Indicator if this banner has custom text */}
                                            {(image.headline || image.subline) && (
                                                <div className="absolute top-1 right-1">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full" title="Har tekst" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                💡 Klik på et banner for at redigere dets tekst. Grøn prik = har tekst.
                            </p>
                        </div>
                    )}

                    <Separator />

                    {/* Selected Banner Text Editor */}
                    {heroImages.length > 0 && heroImages[selectedBannerIndex] && (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold flex items-center gap-2">
                                    <Badge>Banner {selectedBannerIndex + 1}</Badge>
                                    Tekst indstillinger
                                </h4>
                                {/* Preview thumbnail */}
                                <div className="w-16 h-10 rounded overflow-hidden border">
                                    <img
                                        src={heroImages[selectedBannerIndex].url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>

                            {/* Banner Title with color, font, and per-banner toggle */}
                            {/* Banner Title with color, font, and per-banner toggle */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Banner Overskrift</Label>
                                    <div className="flex items-center gap-1.5 border-l pl-3 ml-2">
                                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Individuel stil</Label>
                                        <Switch
                                            checked={(extendedOverlay as any)?.usePerBannerStyling || false}
                                            onCheckedChange={(checked) => updateOverlay({ usePerBannerStyling: checked } as any)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 pt-1">
                                    <FontSelector
                                        label="Skrifttype"
                                        inline
                                        value={(extendedOverlay as any)?.usePerBannerStyling
                                            ? ((heroImages[selectedBannerIndex] as any).titleFontId || (extendedOverlay as any)?.titleFontId || 'Poppins')
                                            : ((extendedOverlay as any)?.titleFontId || 'Poppins')}
                                        onChange={(v) => {
                                            if ((extendedOverlay as any)?.usePerBannerStyling) {
                                                const newImages = [...heroImages] as any[];
                                                newImages[selectedBannerIndex] = {
                                                    ...newImages[selectedBannerIndex],
                                                    titleFontId: v
                                                };
                                                updateHero({ images: newImages });
                                            } else {
                                                updateOverlay({ titleFontId: v } as any);
                                            }
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Farve"
                                        inline
                                        value={(extendedOverlay as any)?.usePerBannerStyling
                                            ? ((heroImages[selectedBannerIndex] as any).titleColor || (extendedOverlay as any)?.titleColor || '#FFFFFF')
                                            : ((extendedOverlay as any)?.titleColor || '#FFFFFF')}
                                        onChange={(color) => {
                                            if ((extendedOverlay as any)?.usePerBannerStyling) {
                                                const newImages = [...heroImages] as any[];
                                                newImages[selectedBannerIndex] = {
                                                    ...newImages[selectedBannerIndex],
                                                    titleColor: color
                                                };
                                                updateHero({ images: newImages });
                                            } else {
                                                updateOverlay({ titleColor: color } as any);
                                            }
                                        }}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                </div>

                                <Input
                                    value={heroImages[selectedBannerIndex].headline || ''}
                                    onChange={(e) => {
                                        const newImages = [...heroImages];
                                        newImages[selectedBannerIndex] = {
                                            ...newImages[selectedBannerIndex],
                                            headline: e.target.value
                                        };
                                        updateHero({ images: newImages });
                                    }}
                                    placeholder="Din fængende overskrift her..."
                                />
                            </div>

                            {/* Banner Subtitle with color and font - same toggle as title */}
                            <div className="space-y-3">
                                <Label>Banner Undertitel</Label>

                                <div className="space-y-3 pt-1">
                                    <FontSelector
                                        label="Skrifttype"
                                        inline
                                        value={(extendedOverlay as any)?.usePerBannerStyling
                                            ? ((heroImages[selectedBannerIndex] as any).subtitleFontId || (extendedOverlay as any)?.subtitleFontId || 'Inter')
                                            : ((extendedOverlay as any)?.subtitleFontId || 'Inter')}
                                        onChange={(v) => {
                                            if ((extendedOverlay as any)?.usePerBannerStyling) {
                                                const newImages = [...heroImages] as any[];
                                                newImages[selectedBannerIndex] = {
                                                    ...newImages[selectedBannerIndex],
                                                    subtitleFontId: v
                                                };
                                                updateHero({ images: newImages });
                                            } else {
                                                updateOverlay({ subtitleFontId: v } as any);
                                            }
                                        }}
                                    />
                                    <ColorPickerWithSwatches
                                        label="Farve"
                                        inline
                                        value={(extendedOverlay as any)?.usePerBannerStyling
                                            ? ((heroImages[selectedBannerIndex] as any).subtitleColor || (extendedOverlay as any)?.subtitleColor || '#FFFFFF')
                                            : ((extendedOverlay as any)?.subtitleColor || '#FFFFFF')}
                                        onChange={(color) => {
                                            if ((extendedOverlay as any)?.usePerBannerStyling) {
                                                const newImages = [...heroImages] as any[];
                                                newImages[selectedBannerIndex] = {
                                                    ...newImages[selectedBannerIndex],
                                                    subtitleColor: color
                                                };
                                                updateHero({ images: newImages });
                                            } else {
                                                updateOverlay({ subtitleColor: color } as any);
                                            }
                                        }}
                                        savedSwatches={savedSwatches}
                                        onSaveSwatch={onSaveSwatch}
                                        onRemoveSwatch={onRemoveSwatch}
                                    />
                                </div>

                                <Textarea
                                    value={heroImages[selectedBannerIndex].subline || ''}
                                    onChange={(e) => {
                                        const newImages = [...heroImages];
                                        newImages[selectedBannerIndex] = {
                                            ...newImages[selectedBannerIndex],
                                            subline: e.target.value
                                        };
                                        updateHero({ images: newImages });
                                    }}
                                    placeholder="Kort beskrivelse..."
                                    rows={2}
                                />
                            </div>





                            {/* Text Animation Preset */}
                            <div className="space-y-4 pt-3 border-t">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        <div>
                                            <Label>Tekst Animation</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Vælg hvordan teksten animeres ind
                                            </p>
                                        </div>
                                    </div>

                                    {/* Banner Selector for Animation */}
                                    <div className="flex items-center gap-2">
                                        <Select
                                            value={selectedBannerIndex.toString()}
                                            onValueChange={(v) => setSelectedBannerIndex(parseInt(v))}
                                        >
                                            <SelectTrigger className="w-[140px] h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {heroImages.map((image, index) => (
                                                    <SelectItem key={image.id} value={index.toString()}>
                                                        Banner {index + 1}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="w-8 h-5 rounded overflow-hidden border bg-muted">
                                            <img
                                                src={heroImages[selectedBannerIndex]?.url}
                                                alt=""
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {TEXT_ANIMATION_PRESETS.map((preset) => {
                                        const isSelected = (heroImages[selectedBannerIndex].textAnimation || 'none') === preset.value;
                                        return (
                                            <button
                                                key={preset.value}
                                                onClick={() => {
                                                    const newImages = [...heroImages];
                                                    newImages[selectedBannerIndex] = {
                                                        ...newImages[selectedBannerIndex],
                                                        textAnimation: preset.value
                                                    };
                                                    updateHero({ images: newImages });
                                                }}
                                                className={`p-3 rounded-lg border-2 text-left transition-all ${isSelected
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                    : 'border-muted hover:border-muted-foreground/50 hover:bg-muted/50'
                                                    }`}
                                            >
                                                <div className="font-medium text-sm">
                                                    {preset.label}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    {preset.description}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {heroImages.length === 0 && (
                        <div className="text-center p-8 text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Upload mindst ét banner-billede først</p>
                        </div>
                    )}

                    <Separator />

                    {/* Per-Banner Buttons */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Call-to-action knapper</Label>
                                <p className="text-xs text-muted-foreground">Tilføj knapper til hvert banner</p>
                            </div>
                            <Switch
                                checked={hero.overlay.showButtons}
                                onCheckedChange={(v) => updateOverlay({ showButtons: v })}
                            />
                        </div>

                        {hero.overlay.showButtons && heroImages.length > 0 && (
                            <div className="space-y-4">
                                {/* Banner selector dropdown */}
                                <div className="flex items-center gap-3">
                                    <Label className="whitespace-nowrap">Rediger banner:</Label>
                                    <Select
                                        value={selectedBannerIndex.toString()}
                                        onValueChange={(v) => setSelectedBannerIndex(parseInt(v))}
                                    >
                                        <SelectTrigger className="flex-1 min-w-0">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {heroImages.map((image, index) => (
                                                <SelectItem key={image.id} value={index.toString()}>
                                                    <div className="flex items-center gap-2">
                                                        <span>Banner {index + 1}</span>
                                                        {(image.buttons?.length || 0) > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                                                {image.buttons?.length} knap(per)
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {/* Preview thumbnail */}
                                    <div className="w-12 h-8 rounded overflow-hidden border flex-shrink-0">
                                        <img
                                            src={heroImages[selectedBannerIndex]?.url}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>

                                {/* Selected banner's buttons */}
                                {heroImages[selectedBannerIndex] && (
                                    <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium flex items-center gap-2">
                                                <Badge>Banner {selectedBannerIndex + 1}</Badge>
                                                Knapper
                                            </h4>
                                            <span className="text-xs text-muted-foreground">
                                                {heroImages[selectedBannerIndex].buttons?.length || 0} / 2 knapper
                                            </span>
                                        </div>

                                        {/* Button list for selected banner */}
                                        {(heroImages[selectedBannerIndex].buttons || []).map((button, btnIndex) => (
                                            <Card key={button.id} className="p-4">
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Badge variant={button.variant === 'primary' ? 'default' : 'outline'}>
                                                            Knap {btnIndex + 1}
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                const newImages = [...heroImages];
                                                                const currentButtons = newImages[selectedBannerIndex].buttons || [];
                                                                newImages[selectedBannerIndex] = {
                                                                    ...newImages[selectedBannerIndex],
                                                                    buttons: currentButtons.filter(b => b.id !== button.id)
                                                                };
                                                                updateHero({ images: newImages });
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <Label className="text-xs text-muted-foreground w-12 shrink-0">Tekst</Label>
                                                            <Input
                                                                className="h-8 text-xs flex-1"
                                                                value={button.label}
                                                                onChange={(e) => {
                                                                    const newImages = [...heroImages];
                                                                    const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                    btns[btnIndex] = { ...btns[btnIndex], label: e.target.value };
                                                                    newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                    updateHero({ images: newImages });
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <Label className="text-xs text-muted-foreground w-12 shrink-0">Stil</Label>
                                                            <Select
                                                                value={button.variant}
                                                                onValueChange={(v) => {
                                                                    const newImages = [...heroImages];
                                                                    const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                    btns[btnIndex] = { ...btns[btnIndex], variant: v as 'primary' | 'secondary' };
                                                                    newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                    updateHero({ images: newImages });
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="primary">Primær</SelectItem>
                                                                    <SelectItem value="secondary">Sekundær</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* Button Color Controls */}
                                                        <ColorPickerWithSwatches
                                                            label="Tekst farve"
                                                            inline
                                                            value={button.textColor || '#FFFFFF'}
                                                            onChange={(color) => {
                                                                const newImages = [...heroImages];
                                                                const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                btns[btnIndex] = { ...btns[btnIndex], textColor: color };
                                                                newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                updateHero({ images: newImages });
                                                            }}
                                                            savedSwatches={savedSwatches}
                                                            onSaveSwatch={onSaveSwatch}
                                                            onRemoveSwatch={onRemoveSwatch}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="Baggrund farve"
                                                            inline
                                                            value={button.bgColor || '#0EA5E9'}
                                                            onChange={(color) => {
                                                                const newImages = [...heroImages];
                                                                const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                btns[btnIndex] = { ...btns[btnIndex], bgColor: color };
                                                                newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                updateHero({ images: newImages });
                                                            }}
                                                            savedSwatches={savedSwatches}
                                                            onSaveSwatch={onSaveSwatch}
                                                            onRemoveSwatch={onRemoveSwatch}
                                                        />
                                                        <ColorPickerWithSwatches
                                                            label="Hover farve"
                                                            inline
                                                            value={button.bgHoverColor || '#0284C7'}
                                                            onChange={(color) => {
                                                                const newImages = [...heroImages];
                                                                const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                btns[btnIndex] = { ...btns[btnIndex], bgHoverColor: color };
                                                                newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                updateHero({ images: newImages });
                                                            }}
                                                            savedSwatches={savedSwatches}
                                                            onSaveSwatch={onSaveSwatch}
                                                            onRemoveSwatch={onRemoveSwatch}
                                                        />
                                                    </div>

                                                    <div className="grid sm:grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Link type</Label>
                                                            <Select
                                                                value={button.linkType}
                                                                onValueChange={(v) => {
                                                                    const newImages = [...heroImages];
                                                                    const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                    btns[btnIndex] = { ...btns[btnIndex], linkType: v as HeroButtonLinkType, target: {} };
                                                                    newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                    updateHero({ images: newImages });
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
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
                                                                <Input value="/shop" disabled className="bg-muted h-8" />
                                                            )}
                                                            {button.linkType === 'PRODUCT' && (
                                                                <Select
                                                                    value={button.target?.productId || ""}
                                                                    onValueChange={(v) => {
                                                                        const prod = products.find(p => p.id === v);
                                                                        const newImages = [...heroImages];
                                                                        const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                        btns[btnIndex] = { ...btns[btnIndex], target: { productId: v, productSlug: prod?.slug } };
                                                                        newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                        updateHero({ images: newImages });
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-8"><SelectValue placeholder="Vælg" /></SelectTrigger>
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
                                                                    onValueChange={(v) => {
                                                                        const newImages = [...heroImages];
                                                                        const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                        btns[btnIndex] = { ...btns[btnIndex], target: { path: v } };
                                                                        newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                        updateHero({ images: newImages });
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-8"><SelectValue placeholder="Vælg" /></SelectTrigger>
                                                                    <SelectContent>
                                                                        {INTERNAL_PAGES.map(p => (
                                                                            <SelectItem key={p.path} value={p.path}>{p.label}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            )}
                                                            {button.linkType === 'EXTERNAL_URL' && (
                                                                <Input
                                                                    className="h-8"
                                                                    value={button.target?.url || ""}
                                                                    onChange={(e) => {
                                                                        const newImages = [...heroImages];
                                                                        const btns = [...(newImages[selectedBannerIndex].buttons || [])];
                                                                        btns[btnIndex] = { ...btns[btnIndex], target: { url: e.target.value } };
                                                                        newImages[selectedBannerIndex] = { ...newImages[selectedBannerIndex], buttons: btns };
                                                                        updateHero({ images: newImages });
                                                                    }}
                                                                    placeholder="https://..."
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))}

                                        {/* Add button for selected banner */}
                                        {(heroImages[selectedBannerIndex].buttons?.length || 0) < 2 && (
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => {
                                                    const newButton: BannerButton = {
                                                        id: generateId(),
                                                        label: (heroImages[selectedBannerIndex].buttons?.length || 0) === 0 ? "Se produkter" : "Kontakt os",
                                                        variant: (heroImages[selectedBannerIndex].buttons?.length || 0) === 0 ? 'primary' : 'secondary',
                                                        linkType: (heroImages[selectedBannerIndex].buttons?.length || 0) === 0 ? 'ALL_PRODUCTS' : 'INTERNAL_PAGE',
                                                        target: (heroImages[selectedBannerIndex].buttons?.length || 0) === 0 ? {} : { path: '/kontakt' },
                                                        textColor: '#FFFFFF',
                                                        bgColor: (heroImages[selectedBannerIndex].buttons?.length || 0) === 0 ? '#0EA5E9' : 'transparent',
                                                        bgOpacity: 1,
                                                    };
                                                    const newImages = [...heroImages];
                                                    const currentButtons = newImages[selectedBannerIndex].buttons || [];
                                                    newImages[selectedBannerIndex] = {
                                                        ...newImages[selectedBannerIndex],
                                                        buttons: [...currentButtons, newButton]
                                                    };
                                                    updateHero({ images: newImages });
                                                }}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Tilføj knap til Banner {selectedBannerIndex + 1}
                                            </Button>
                                        )}

                                        {(heroImages[selectedBannerIndex].buttons?.length || 0) === 0 && (
                                            <p className="text-xs text-muted-foreground text-center py-2">
                                                Ingen knapper på dette banner endnu. Klik "Tilføj knap" for at tilføje.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {hero.overlay.showButtons && heroImages.length === 0 && (
                            <div className="text-center p-4 text-muted-foreground border rounded-lg">
                                <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">Upload mindst ét banner-billede først</p>
                            </div>
                        )}
                    </div>
                </div>
            </CollapsibleCard >
        </div >
    );
}

// Re-export as HeroEditor for backwards compatibility
export { BannerEditor as HeroEditor };
