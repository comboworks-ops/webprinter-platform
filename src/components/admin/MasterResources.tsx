import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Upload, Trash2, Image as ImageIcon, Video, Sparkles,
    Eye, EyeOff, Loader2, Plus, RefreshCw, FolderPlus, Folder
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

// Types
interface ResourceCategory {
    id: string;
    name: string;
    slug: string;
    description?: string;
    icon: string;
    sort_order: number;
}

interface MasterAsset {
    id: string;
    category_id: string | null;
    name: string;
    description?: string;
    url: string;
    thumbnail_url?: string;
    tags: string[];
    sort_order: number;
    is_published: boolean;
    width_px?: number;
    height_px?: number;
    mime_type?: string;
    created_at: string;
    updated_at: string;
}

// Icon mapping for categories
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    'image': <ImageIcon className="w-4 h-4" />,
    'video': <Video className="w-4 h-4" />,
    'sparkles': <Sparkles className="w-4 h-4" />,
    'folder': <Folder className="w-4 h-4" />,
};

export function MasterResources() {
    const { isMasterAdmin, loading: roleLoading } = useUserRole();
    const [categories, setCategories] = useState<ResourceCategory[]>([]);
    const [assets, setAssets] = useState<MasterAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    // New category dialog state
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryDesc, setNewCategoryDesc] = useState("");
    const [creatingCategory, setCreatingCategory] = useState(false);

    // Fetch categories
    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('resource_categories' as any)
                .select('*')
                .order('sort_order');

            if (error) throw error;
            const cats = (data as unknown as ResourceCategory[]) || [];
            setCategories(cats);

            // Set first category as active if none selected
            if (cats.length > 0 && !activeCategory) {
                setActiveCategory(cats[0].id);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
            // If table doesn't exist yet, show helpful message
            toast.error('Kunne ikke hente kategorier. Kør SQL migration først.');
        }
    };

    // Fetch assets
    const fetchAssets = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('master_assets' as any)
                .select('*')
                .order('sort_order');

            if (error) throw error;
            setAssets((data as unknown as MasterAsset[]) || []);
        } catch (error) {
            console.error('Error fetching assets:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isMasterAdmin) {
            fetchCategories();
            fetchAssets();
        }
    }, [isMasterAdmin]);

    // Filter assets by active category
    const filteredAssets = assets.filter(a => a.category_id === activeCategory);
    const activeCategoryData = categories.find(c => c.id === activeCategory);

    // Create new category
    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            toast.error('Kategorinavn er påkrævet');
            return;
        }

        setCreatingCategory(true);
        try {
            const slug = newCategoryName.toLowerCase()
                .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

            const { error } = await supabase
                .from('resource_categories' as any)
                .insert({
                    name: newCategoryName.trim(),
                    slug,
                    description: newCategoryDesc.trim() || null,
                    icon: 'folder',
                    sort_order: categories.length,
                });

            if (error) throw error;

            toast.success('Kategori oprettet');
            setShowNewCategory(false);
            setNewCategoryName("");
            setNewCategoryDesc("");
            fetchCategories();
        } catch (error: any) {
            console.error('Error creating category:', error);
            if (error.code === '23505') {
                toast.error('En kategori med dette navn findes allerede');
            } else {
                toast.error('Kunne ikke oprette kategori');
            }
        } finally {
            setCreatingCategory(false);
        }
    };

    // Upload asset
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeCategory) return;

        const isVideo = file.type.startsWith('video/');
        const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;

        if (file.size > maxSize) {
            toast.error(`Filen er for stor. Max ${isVideo ? '50MB' : '5MB'}`);
            return;
        }

        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const fileExt = file.name.split('.').pop();
            const fileName = `resource-${Date.now()}.${fileExt}`;
            const filePath = `master-assets/${activeCategory}/${fileName}`;

            // Upload file
            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            // Get image dimensions if image
            let width, height;
            if (!isVideo) {
                const img = new Image();
                img.src = URL.createObjectURL(file);
                await new Promise((resolve) => { img.onload = resolve; });
                width = img.width;
                height = img.height;
            }

            // Create asset record
            const { error: insertError } = await supabase
                .from('master_assets' as any)
                .insert({
                    category_id: activeCategory,
                    name: file.name.replace(/\.[^.]+$/, ''),
                    url: publicUrl,
                    is_published: false,
                    sort_order: filteredAssets.length,
                    width_px: width,
                    height_px: height,
                    mime_type: file.type,
                    file_size_bytes: file.size,
                    created_by: user?.id,
                    updated_by: user?.id,
                });

            if (insertError) throw insertError;

            toast.success('Ressource uploadet');
            fetchAssets();
        } catch (error) {
            console.error('Error uploading:', error);
            toast.error('Kunne ikke uploade ressource');
        } finally {
            setUploading(false);
        }
    };

    // Toggle publish status
    const togglePublish = async (asset: MasterAsset) => {
        try {
            const { error } = await supabase
                .from('master_assets' as any)
                .update({ is_published: !asset.is_published })
                .eq('id', asset.id);

            if (error) throw error;

            toast.success(asset.is_published ? 'Skjult fra lejere' : 'Synlig for lejere');
            fetchAssets();
        } catch (error) {
            console.error('Error toggling publish:', error);
            toast.error('Kunne ikke ændre synlighed');
        }
    };

    // Delete asset
    const deleteAsset = async (asset: MasterAsset) => {
        try {
            // Try to delete file from storage
            try {
                const urlObj = new URL(asset.url);
                const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/product-images\/(.+)/);
                if (pathMatch) {
                    await supabase.storage.from('product-images').remove([pathMatch[1]]);
                }
            } catch (e) {
                console.warn('Could not delete file from storage:', e);
            }

            const { error } = await supabase
                .from('master_assets' as any)
                .delete()
                .eq('id', asset.id);

            if (error) throw error;

            toast.success('Ressource slettet');
            fetchAssets();
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Kunne ikke slette ressource');
        }
    };

    // Access control
    if (roleLoading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    if (!isMasterAdmin) {
        return <Navigate to="/admin" replace />;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Ressourcer</h1>
                    <p className="text-muted-foreground">
                        Administrer platform-ressourcer organiseret i kategorier
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                                <FolderPlus className="w-4 h-4 mr-2" />
                                Ny kategori
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Opret ny kategori</DialogTitle>
                                <DialogDescription>
                                    Opret en ny ressourcekategori for at organisere dine filer.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category-name">Kategorinavn</Label>
                                    <Input
                                        id="category-name"
                                        placeholder="F.eks. Produktbilleder"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category-desc">Beskrivelse (valgfrit)</Label>
                                    <Input
                                        id="category-desc"
                                        placeholder="Kort beskrivelse af kategorien"
                                        value={newCategoryDesc}
                                        onChange={(e) => setNewCategoryDesc(e.target.value)}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowNewCategory(false)}>
                                    Annuller
                                </Button>
                                <Button onClick={handleCreateCategory} disabled={creatingCategory}>
                                    {creatingCategory && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Opret kategori
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button onClick={() => { fetchCategories(); fetchAssets(); }} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Opdater
                    </Button>
                </div>
            </div>

            {categories.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Folder className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Ingen kategorier endnu</h3>
                        <p className="text-muted-foreground mb-4">
                            Kør SQL migration i Supabase for at oprette standardkategorier,
                            eller opret en ny kategori manuelt.
                        </p>
                        <Button onClick={() => setShowNewCategory(true)}>
                            <FolderPlus className="w-4 h-4 mr-2" />
                            Opret første kategori
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Tabs value={activeCategory || undefined} onValueChange={setActiveCategory}>
                    <TabsList className="flex flex-wrap h-auto gap-1">
                        {categories.map((category) => (
                            <TabsTrigger
                                key={category.id}
                                value={category.id}
                                className="gap-2"
                            >
                                {CATEGORY_ICONS[category.icon] || <Folder className="w-4 h-4" />}
                                {category.name}
                                <Badge variant="secondary" className="ml-1 text-xs">
                                    {assets.filter(a => a.category_id === category.id).length}
                                </Badge>
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {categories.map((category) => (
                        <TabsContent key={category.id} value={category.id} className="mt-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        {CATEGORY_ICONS[category.icon] || <Folder className="w-5 h-5" />}
                                        {category.name}
                                    </CardTitle>
                                    {category.description && (
                                        <CardDescription>{category.description}</CardDescription>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                            {assets
                                                .filter(a => a.category_id === category.id)
                                                .map((asset) => (
                                                    <div
                                                        key={asset.id}
                                                        className="relative aspect-video rounded-lg border overflow-hidden group bg-muted"
                                                    >
                                                        {asset.mime_type?.startsWith('video/') ? (
                                                            <video
                                                                src={asset.url}
                                                                className="w-full h-full object-cover"
                                                                muted
                                                                loop
                                                                playsInline
                                                            />
                                                        ) : (
                                                            <img
                                                                src={asset.thumbnail_url || asset.url}
                                                                alt={asset.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}

                                                        {/* Overlay */}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    variant={asset.is_published ? "default" : "secondary"}
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => togglePublish(asset)}
                                                                    title={asset.is_published ? 'Skjul' : 'Publicér'}
                                                                >
                                                                    {asset.is_published ? (
                                                                        <Eye className="h-3 w-3" />
                                                                    ) : (
                                                                        <EyeOff className="h-3 w-3" />
                                                                    )}
                                                                </Button>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="icon"
                                                                            className="h-7 w-7"
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Slet ressource?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                Dette kan ikke fortrydes. Lejere der bruger denne ressource vil miste adgang.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Annuller</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => deleteAsset(asset)}>
                                                                                Slet
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
                                                            <div>
                                                                <p className="text-white text-sm font-medium truncate">
                                                                    {asset.name}
                                                                </p>
                                                                {asset.width_px && asset.height_px && (
                                                                    <p className="text-white/70 text-xs">
                                                                        {asset.width_px} × {asset.height_px}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Status Badge */}
                                                        <Badge
                                                            className="absolute top-2 left-2"
                                                            variant={asset.is_published ? "default" : "outline"}
                                                        >
                                                            {asset.is_published ? 'Synlig' : 'Skjult'}
                                                        </Badge>
                                                    </div>
                                                ))}

                                            {/* Upload Button */}
                                            <label className="aspect-video rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                                                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                                <span className="text-sm text-muted-foreground">
                                                    {uploading ? 'Uploader...' : 'Upload'}
                                                </span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*,video/*"
                                                    onChange={handleUpload}
                                                    disabled={uploading}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter>
                                    <p className="text-sm text-muted-foreground">
                                        {assets.filter(a => a.category_id === category.id).length} ressourcer · {assets.filter(a => a.category_id === category.id && a.is_published).length} synlige for lejere
                                    </p>
                                </CardFooter>
                            </Card>
                        </TabsContent>
                    ))}
                </Tabs>
            )}
        </div>
    );
}

export default MasterResources;
