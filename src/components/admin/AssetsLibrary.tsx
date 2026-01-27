import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    Loader2, Upload, Trash2, Plus, Package, Image as ImageIcon,
    DollarSign, Lock, Unlock, FolderOpen, Search
} from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

// Types
interface IconAsset {
    id: string;
    name: string;
    file_url: string;
    pack_id: string;
    created_at: string;
}

interface IconPack {
    id: string;
    name: string;
    description: string;
    preview_url: string | null;
    is_premium: boolean;
    price: number | null;
    is_active: boolean;
    created_at: string;
    icon_count?: number;
}

export function AssetsLibrary() {
    const { isMasterAdmin, loading: roleLoading } = useUserRole();
    const [packs, setPacks] = useState<IconPack[]>([]);
    const [selectedPack, setSelectedPack] = useState<IconPack | null>(null);
    const [assets, setAssets] = useState<IconAsset[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [showNewPackDialog, setShowNewPackDialog] = useState(false);
    const [newPackName, setNewPackName] = useState("");
    const [newPackDescription, setNewPackDescription] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch icon packs
    const fetchPacks = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('icon_packs' as any)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPacks((data as unknown as IconPack[]) || []);

            // Select first pack if none selected
            if (!selectedPack && data && data.length > 0) {
                setSelectedPack(data[0] as unknown as IconPack);
            }
        } catch (error) {
            console.error("Error fetching packs:", error);
            // Table might not exist yet - that's OK
        } finally {
            setIsLoading(false);
        }
    }, [selectedPack]);

    // Fetch assets for selected pack
    const fetchAssets = useCallback(async () => {
        if (!selectedPack) {
            setAssets([]);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('icon_assets' as any)
                .select('*')
                .eq('pack_id', selectedPack.id)
                .order('name');

            if (error) throw error;
            setAssets((data as unknown as IconAsset[]) || []);
        } catch (error) {
            console.error("Error fetching assets:", error);
        }
    }, [selectedPack]);

    useEffect(() => {
        if (!roleLoading && isMasterAdmin) {
            fetchPacks();
        }
    }, [roleLoading, isMasterAdmin, fetchPacks]);

    useEffect(() => {
        fetchAssets();
    }, [fetchAssets]);

    // Create new icon pack
    const handleCreatePack = async () => {
        if (!newPackName.trim()) {
            toast.error("Indtast et navn til pakken");
            return;
        }

        try {
            const { data, error } = await supabase
                .from('icon_packs' as any)
                .insert({
                    name: newPackName,
                    description: newPackDescription,
                    is_premium: false,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("Ikon pakke oprettet");
            setShowNewPackDialog(false);
            setNewPackName("");
            setNewPackDescription("");

            const newPack = data as unknown as IconPack;
            setPacks(prev => [newPack, ...prev]);
            setSelectedPack(newPack);
        } catch (error) {
            console.error("Error creating pack:", error);
            toast.error("Kunne ikke oprette pakke");
        }
    };

    // Upload icon to pack
    const handleUploadIcon = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedPack || !event.target.files?.length) return;

        setIsUploading(true);
        try {
            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop()?.toLowerCase();

            // Validate file type
            if (!['svg', 'png', 'webp'].includes(fileExt || '')) {
                toast.error("Kun SVG, PNG og WebP filer er tilladt");
                return;
            }

            const fileName = `${selectedPack.id}/${Date.now()}-${file.name}`;

            const { error: uploadError } = await supabase.storage
                .from('icon-assets')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('icon-assets')
                .getPublicUrl(fileName);

            // Create asset record
            const { data, error } = await supabase
                .from('icon_assets' as any)
                .insert({
                    name: file.name.replace(/\.[^/.]+$/, ""),
                    file_url: publicUrl,
                    pack_id: selectedPack.id,
                })
                .select()
                .single();

            if (error) throw error;

            toast.success("Ikon uploadet");
            setAssets(prev => [...prev, data as unknown as IconAsset]);
        } catch (error) {
            console.error("Error uploading icon:", error);
            toast.error("Kunne ikke uploade ikon");
        } finally {
            setIsUploading(false);
        }
    };

    // Delete icon
    const handleDeleteIcon = async (iconId: string) => {
        try {
            const { error } = await supabase
                .from('icon_assets' as any)
                .delete()
                .eq('id', iconId);

            if (error) throw error;

            toast.success("Ikon slettet");
            setAssets(prev => prev.filter(a => a.id !== iconId));
        } catch (error) {
            console.error("Error deleting icon:", error);
            toast.error("Kunne ikke slette ikon");
        }
    };

    // Toggle pack premium status
    const togglePackPremium = async (pack: IconPack) => {
        try {
            const { error } = await supabase
                .from('icon_packs' as any)
                .update({ is_premium: !pack.is_premium })
                .eq('id', pack.id);

            if (error) throw error;

            setPacks(prev => prev.map(p =>
                p.id === pack.id ? { ...p, is_premium: !p.is_premium } : p
            ));

            if (selectedPack?.id === pack.id) {
                setSelectedPack({ ...pack, is_premium: !pack.is_premium });
            }
        } catch (error) {
            console.error("Error updating pack:", error);
            toast.error("Kunne ikke opdatere pakke");
        }
    };

    // Update pack price
    const updatePackPrice = async (pack: IconPack, price: number) => {
        try {
            const { error } = await supabase
                .from('icon_packs' as any)
                .update({ price })
                .eq('id', pack.id);

            if (error) throw error;

            setPacks(prev => prev.map(p =>
                p.id === pack.id ? { ...p, price } : p
            ));
        } catch (error) {
            console.error("Error updating pack price:", error);
        }
    };

    // Guard: Only master admin can access
    if (!roleLoading && !isMasterAdmin) {
        return <Navigate to="/admin" replace />;
    }

    if (isLoading || roleLoading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    const filteredAssets = assets.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Package className="w-8 h-8" />
                        Assets Library
                    </h1>
                    <p className="text-muted-foreground">
                        Administrer ikonpakker til platform (kun tilgængeligt for Master Admin)
                    </p>
                </div>

                <Dialog open={showNewPackDialog} onOpenChange={setShowNewPackDialog}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Ny Ikon Pakke
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Opret ny ikon pakke</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Pakke navn</Label>
                                <Input
                                    value={newPackName}
                                    onChange={(e) => setNewPackName(e.target.value)}
                                    placeholder="F.eks. 'Modern Line Icons'"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Beskrivelse</Label>
                                <Input
                                    value={newPackDescription}
                                    onChange={(e) => setNewPackDescription(e.target.value)}
                                    placeholder="En kort beskrivelse af pakken"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowNewPackDialog(false)}>Annuller</Button>
                            <Button onClick={handleCreatePack}>Opret</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid lg:grid-cols-4 gap-6">
                {/* Pack List */}
                <div className="lg:col-span-1 space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Ikon Pakker ({packs.length})
                    </h3>

                    {packs.length === 0 ? (
                        <Card className="p-6 text-center text-muted-foreground">
                            <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Ingen pakker endnu</p>
                            <p className="text-sm">Klik "Ny Ikon Pakke" for at starte</p>
                        </Card>
                    ) : (
                        packs.map((pack) => (
                            <Card
                                key={pack.id}
                                className={`cursor-pointer transition-all hover:shadow-md ${selectedPack?.id === pack.id ? 'ring-2 ring-primary' : ''
                                    }`}
                                onClick={() => setSelectedPack(pack)}
                            >
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-medium">{pack.name}</h4>
                                            <p className="text-xs text-muted-foreground">{pack.description || 'Ingen beskrivelse'}</p>
                                        </div>
                                        {pack.is_premium && (
                                            <Badge variant="secondary" className="gap-1">
                                                <Lock className="w-3 h-3" />
                                                {pack.price || 0} DKK
                                            </Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Pack Details & Assets */}
                <div className="lg:col-span-3 space-y-6">
                    {selectedPack ? (
                        <>
                            {/* Pack Settings */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span>{selectedPack.name}</span>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-sm">Premium</Label>
                                                <Switch
                                                    checked={selectedPack.is_premium}
                                                    onCheckedChange={() => togglePackPremium(selectedPack)}
                                                />
                                            </div>
                                            {selectedPack.is_premium && (
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4" />
                                                    <Input
                                                        type="number"
                                                        className="w-24"
                                                        value={selectedPack.price || 0}
                                                        onChange={(e) => updatePackPrice(selectedPack, parseInt(e.target.value) || 0)}
                                                    />
                                                    <span className="text-sm">DKK</span>
                                                </div>
                                            )}
                                        </div>
                                    </CardTitle>
                                    <CardDescription>{selectedPack.description}</CardDescription>
                                </CardHeader>
                            </Card>

                            {/* Upload & Search */}
                            <div className="flex items-center gap-4">
                                <Button asChild disabled={isUploading} className="gap-2">
                                    <label className="cursor-pointer">
                                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        Upload ikon
                                        <input
                                            type="file"
                                            className="hidden"
                                            accept=".svg,.png,.webp"
                                            onChange={handleUploadIcon}
                                        />
                                    </label>
                                </Button>

                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Søg i ikoner..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {/* Assets Grid */}
                            <Card>
                                <CardContent className="p-6">
                                    {filteredAssets.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground">
                                            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>Ingen ikoner i denne pakke</p>
                                            <p className="text-sm">Upload SVG, PNG eller WebP filer</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                                            {filteredAssets.map((asset) => (
                                                <div
                                                    key={asset.id}
                                                    className="group relative aspect-square rounded-lg border bg-muted/50 p-3 hover:bg-muted transition-colors"
                                                >
                                                    <img
                                                        src={asset.file_url}
                                                        alt={asset.name}
                                                        className="w-full h-full object-contain"
                                                    />
                                                    <Button
                                                        variant="destructive"
                                                        size="icon"
                                                        className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() => handleDeleteIcon(asset.id)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                    <span className="absolute bottom-0 left-0 right-0 text-[10px] text-center truncate px-1 bg-background/80">
                                                        {asset.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <Card className="p-12 text-center text-muted-foreground">
                            <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>Vælg eller opret en ikon pakke</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AssetsLibrary;
