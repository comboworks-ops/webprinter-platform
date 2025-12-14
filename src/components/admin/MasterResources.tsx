import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
    Eye, EyeOff, Loader2, GripVertical, Plus, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

// Asset types
type AssetType = 'HERO_BACKGROUND' | 'ICON' | 'VIDEO';

interface MasterAsset {
    id: string;
    type: AssetType;
    name: string;
    description?: string;
    url: string;
    thumbnail_url?: string;
    tags: string[];
    sort_order: number;
    is_published: boolean;
    is_premium: boolean;
    price_cents?: number;
    width_px?: number;
    height_px?: number;
    created_at: string;
    updated_at: string;
}

export function MasterResources() {
    const { isMasterAdmin, loading: roleLoading } = useUserRole();
    const [assets, setAssets] = useState<MasterAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<AssetType>('HERO_BACKGROUND');
    const [editingAsset, setEditingAsset] = useState<MasterAsset | null>(null);

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
            toast.error('Kunne ikke hente ressourcer');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isMasterAdmin) {
            fetchAssets();
        }
    }, [isMasterAdmin]);

    // Filter assets by type
    const filteredAssets = assets.filter(a => a.type === activeTab);

    // Upload asset
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: AssetType) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate
        const isVideo = type === 'VIDEO';
        const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;

        if (file.size > maxSize) {
            toast.error(`Filen er for stor. Max ${isVideo ? '50MB' : '5MB'}`);
            return;
        }

        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const fileExt = file.name.split('.').pop();
            const fileName = `master-${type.toLowerCase()}-${Date.now()}.${fileExt}`;
            const filePath = `master-assets/${fileName}`;

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
                    type,
                    name: file.name.replace(/\.[^.]+$/, ''),
                    url: publicUrl,
                    is_published: false,
                    sort_order: filteredAssets.length,
                    width_px: width,
                    height_px: height,
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

    // Update asset name
    const updateAsset = async (assetId: string, updates: Partial<MasterAsset>) => {
        try {
            const { error } = await supabase
                .from('master_assets' as any)
                .update(updates as any)
                .eq('id', assetId);

            if (error) throw error;

            toast.success('Ressource opdateret');
            setEditingAsset(null);
            fetchAssets();
        } catch (error) {
            console.error('Error updating:', error);
            toast.error('Kunne ikke opdatere ressource');
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
                        Administrer platform-ressourcer (baggrunde, ikoner, videoer)
                    </p>
                </div>
                <Button onClick={fetchAssets} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Opdater
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AssetType)}>
                <TabsList className="grid grid-cols-3 w-full max-w-md">
                    <TabsTrigger value="HERO_BACKGROUND" className="gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Baggrunde
                    </TabsTrigger>
                    <TabsTrigger value="ICON" className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        Ikoner
                    </TabsTrigger>
                    <TabsTrigger value="VIDEO" className="gap-2">
                        <Video className="w-4 h-4" />
                        Videoer
                    </TabsTrigger>
                </TabsList>

                {['HERO_BACKGROUND', 'ICON', 'VIDEO'].map((type) => (
                    <TabsContent key={type} value={type} className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {type === 'HERO_BACKGROUND' && 'Hero Baggrunde'}
                                    {type === 'ICON' && 'Ikon Billeder'}
                                    {type === 'VIDEO' && 'Hero Videoer'}
                                </CardTitle>
                                <CardDescription>
                                    {type === 'HERO_BACKGROUND' && 'Baggrundsbilleder til hero bannere. Publicerede ressourcer kan vælges af lejere.'}
                                    {type === 'ICON' && 'Ikon billeder til produkt kategorier.'}
                                    {type === 'VIDEO' && 'Videoer til hero bannere.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {filteredAssets.map((asset) => (
                                            <div
                                                key={asset.id}
                                                className="relative aspect-video rounded-lg border overflow-hidden group bg-muted"
                                            >
                                                {type === 'VIDEO' ? (
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
                                                accept={type === 'VIDEO' ? 'video/*' : 'image/*'}
                                                onChange={(e) => handleUpload(e, type as AssetType)}
                                                disabled={uploading}
                                            />
                                        </label>
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <p className="text-sm text-muted-foreground">
                                    {filteredAssets.length} ressourcer · {filteredAssets.filter(a => a.is_published).length} synlige for lejere
                                </p>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}

export default MasterResources;
