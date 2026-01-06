import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    Upload, Trash2, LayoutGrid, Search,
    Eye, EyeOff, Loader2, Plus, RefreshCw, FileText, Image as ImageIcon, ExternalLink,
    FolderOpen, User, Layers
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DesignLibraryItem } from "@/hooks/useDesignLibrary";
import { resolveAdminTenant } from "@/lib/adminTenant";

interface SavedDesign {
    id: string;
    name: string;
    preview_thumbnail_url: string | null;
    updated_at: string;
    width_mm: number;
    height_mm: number;
    product_id: string | null;
}

export default function DesignResources() {
    const [items, setItems] = useState<DesignLibraryItem[]>([]);
    const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'mine' | 'skabeloner' | 'ressourcer'>('mine');

    // Upload dialog state
    const [showUpload, setShowUpload] = useState(false);
    const [newItem, setNewItem] = useState<{
        name: string;
        description: string;
        kind: 'fabric_json' | 'svg' | 'pdf' | 'image';
        visibility: 'tenant' | 'public';
        productId?: string;
        tags: string;
    }>({
        name: "",
        description: "",
        kind: 'svg',
        visibility: 'public',
        tags: ""
    });

    // Fetch user's saved designs
    const fetchSavedDesigns = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSavedDesigns([]);
                return;
            }

            const { data, error } = await supabase
                .from('designer_saved_designs' as any)
                .select('id, name, preview_thumbnail_url, updated_at, width_mm, height_mm, product_id')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setSavedDesigns((data as unknown as SavedDesign[]) || []);
        } catch (error) {
            console.error('Error fetching saved designs:', error);
        }
    };

    // Fetch library items (skabeloner and ressourcer)
    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const { tenantId } = await resolveAdminTenant();
            if (!tenantId) {
                setItems([]);
                return;
            }

            const { data, error } = await supabase
                .from('design_library_items' as any)
                .select('*')
                .or(`tenant_id.eq.${tenantId},visibility.eq.public`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setItems((data as unknown as DesignLibraryItem[]) || []);
        } catch (error) {
            console.error('Error fetching design items:', error);
            toast.error('Kunne ikke hente designs');
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch format templates
    const fetchTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('designer_templates' as any)
                .select('*')
                .eq('is_active', true)
                .order('category')
                .order('name');

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        }
    };

    useEffect(() => {
        fetchItems();
        fetchSavedDesigns();
        fetchTemplates();
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Simple kind detection based on extension
        const ext = file.name.split('.').pop()?.toLowerCase();
        let kind: 'svg' | 'pdf' | 'image' | 'fabric_json' = 'image';
        if (ext === 'svg') kind = 'svg';
        else if (ext === 'pdf') kind = 'pdf';

        setNewItem(prev => ({ ...prev, name: file.name.split('.')[0], kind }));

        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { tenantId } = await resolveAdminTenant();

            if (!tenantId) throw new Error("No tenant found");

            const itemId = crypto.randomUUID();
            const filePath = `${tenantId}/${itemId}/source.${ext}`;

            // 1. Upload source file
            const { error: uploadError } = await supabase.storage
                .from('design-library')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Create database record (without preview for now, or use same as source if image)
            const { error: insertError } = await supabase
                .from('design_library_items' as any)
                .insert({
                    id: itemId,
                    tenant_id: tenantId,
                    name: newItem.name || file.name.split('.')[0],
                    description: newItem.description,
                    kind,
                    visibility: newItem.visibility,
                    storage_path: filePath,
                    tags: newItem.tags.split(',').map(t => t.trim()).filter(Boolean),
                    created_by: user?.id
                });

            if (insertError) throw insertError;

            toast.success('Design uploadet');
            setShowUpload(false);
            fetchItems();
        } catch (error) {
            console.error('Error uploading design:', error);
            toast.error('Kunne ikke uploade design');
        } finally {
            setUploading(false);
        }
    };

    const toggleVisibility = async (item: DesignLibraryItem) => {
        try {
            const newVisibility = item.visibility === 'public' ? 'tenant' : 'public';
            const { error } = await supabase
                .from('design_library_items' as any)
                .update({ visibility: newVisibility })
                .eq('id', item.id);

            if (error) throw error;
            toast.success(`Synlighed ændret til ${newVisibility}`);
            fetchItems();
        } catch (error) {
            console.error('Error toggling visibility:', error);
            toast.error('Kunne ikke ændre synlighed');
        }
    };

    const deleteItem = async (item: DesignLibraryItem) => {
        try {
            // Remove from storage
            if (item.storage_path) {
                await supabase.storage.from('design-library').remove([item.storage_path]);
            }
            if (item.preview_path) {
                await supabase.storage.from('design-library').remove([item.preview_path]);
            }

            const { error } = await supabase
                .from('design_library_items' as any)
                .delete()
                .eq('id', item.id);

            if (error) throw error;
            toast.success('Design slettet');
            fetchItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            toast.error('Kunne ikke slette design');
        }
    };

    const deleteSavedDesign = async (design: SavedDesign) => {
        try {
            const { error } = await supabase
                .from('designer_saved_designs' as any)
                .delete()
                .eq('id', design.id);

            if (error) throw error;
            toast.success('Design slettet');
            fetchSavedDesigns();
        } catch (error) {
            console.error('Error deleting saved design:', error);
            toast.error('Kunne ikke slette design');
        }
    };

    const openDesignInEditor = (designId: string) => {
        window.open(`/designer?designId=${designId}`, '_blank');
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredSavedDesigns = savedDesigns.filter(design =>
        design.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredTemplates = templates.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (template.category || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Design Bibliotek</h1>
                    <p className="text-muted-foreground">
                        Administrer dine gemte designs, skabeloner og ressourcer
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={showUpload} onOpenChange={setShowUpload}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Nyt design
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Upload nyt design</DialogTitle>
                                <DialogDescription>
                                    Understøtter SVG, PDF (enkelt side) og billeder.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Synlighed</Label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="visibility"
                                                checked={newItem.visibility === 'public'}
                                                onChange={() => setNewItem(prev => ({ ...prev, visibility: 'public' }))}
                                            />
                                            Offentlig (alle lejere)
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="visibility"
                                                checked={newItem.visibility === 'tenant'}
                                                onChange={() => setNewItem(prev => ({ ...prev, visibility: 'tenant' }))}
                                            />
                                            Kun denne tenant
                                        </label>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="design-name">Navn (valgfrit - udfyldes automatisk)</Label>
                                    <Input
                                        id="design-name"
                                        placeholder="F.eks. Sommerhus Ikon"
                                        value={newItem.name}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="design-tags">Tags (komma-separeret)</Label>
                                    <Input
                                        id="design-tags"
                                        placeholder="ikon, retro, sommer, ..."
                                        value={newItem.tags}
                                        onChange={(e) => setNewItem(prev => ({ ...prev, tags: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <label className="flex-1">
                                    <div className="flex items-center justify-center w-full px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors">
                                        {uploading ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Upload className="w-4 h-4 mr-2" />
                                        )}
                                        Vælg fil og upload
                                    </div>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept=".svg,.pdf,image/*"
                                        onChange={handleUpload}
                                        disabled={uploading}
                                    />
                                </label>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <Button onClick={() => { fetchItems(); fetchSavedDesigns(); }} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Opdater
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="mine" className="gap-2">
                        <User className="w-4 h-4" />
                        Mine ({savedDesigns.length})
                    </TabsTrigger>
                    <TabsTrigger value="skabeloner" className="gap-2">
                        <Layers className="w-4 h-4" />
                        Skabeloner ({templates.length})
                    </TabsTrigger>
                    <TabsTrigger value="ressourcer" className="gap-2">
                        <FolderOpen className="w-4 h-4" />
                        Ressourcer
                    </TabsTrigger>
                </TabsList>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Søg i designs..."
                                    className="pl-9"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Mine Tab - User's Saved Designs */}
                        <TabsContent value="mine" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : filteredSavedDesigns.length === 0 ? (
                                <div className="py-24 text-center">
                                    <User className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen gemte designs</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Dine gemte designs fra Print Designer vises her.
                                    </p>
                                    <Button onClick={() => window.open('/designer?format=A4', '_blank')}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Opret nyt design
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {filteredSavedDesigns.map((design) => (
                                        <Card key={design.id} className="overflow-hidden group cursor-pointer" onClick={() => openDesignInEditor(design.id)}>
                                            <div className="aspect-square bg-gradient-to-br from-primary/5 to-primary/10 relative flex items-center justify-center border-b overflow-hidden">
                                                {design.preview_thumbnail_url ? (
                                                    <img
                                                        src={design.preview_thumbnail_url}
                                                        alt={design.name}
                                                        className="w-full h-full object-contain"
                                                    />
                                                ) : (
                                                    <div className="text-center">
                                                        <Layers className="w-10 h-10 text-primary/40 mx-auto mb-2" />
                                                        <p className="text-xs text-muted-foreground font-mono">
                                                            {design.width_mm}×{design.height_mm}mm
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Overlay Actions */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={(e) => { e.stopPropagation(); openDesignInEditor(design.id); }}
                                                    >
                                                        <ExternalLink className="h-4 w-4 mr-1" />
                                                        Åbn
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Slet design?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Dette sletter designet permanent. Denne handling kan ikke fortrydes.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); deleteSavedDesign(design); }}>Slet</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </div>
                                            <CardContent className="p-3">
                                                <h4 className="font-medium text-sm truncate" title={design.name}>{design.name}</h4>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(design.updated_at).toLocaleDateString('da-DK')}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>

                        {/* Skabeloner Tab */}
                        <TabsContent value="skabeloner" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="py-24 text-center">
                                    <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen format-skabeloner</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Opret skabeloner i Print Designer indstillinger.
                                    </p>
                                    <Button variant="outline" onClick={() => window.location.href = '/admin/print-designer'}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Administrer Formater
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-end">
                                        <Button variant="outline" size="sm" onClick={() => window.location.href = '/admin/print-designer'}>
                                            <Plus className="w-4 h-4 mr-2" />
                                            Administrer Formater
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                        {filteredTemplates.map((template) => (
                                            <Card key={template.id} className="overflow-hidden group cursor-pointer" onClick={() => window.open(`/designer?templateId=${template.id}`, '_blank')}>
                                                <div className="aspect-square bg-gradient-to-br from-primary/5 to-primary/10 relative flex items-center justify-center border-b">
                                                    <div className="text-center">
                                                        <Layers className="w-10 h-10 text-primary/40 mx-auto mb-2" />
                                                        <p className="text-sm font-mono text-muted-foreground">
                                                            {template.width_mm}×{template.height_mm} mm
                                                        </p>
                                                    </div>

                                                    {/* Overlay Actions */}
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={(e) => { e.stopPropagation(); window.open(`/designer?templateId=${template.id}`, '_blank'); }}
                                                        >
                                                            <ExternalLink className="h-4 w-4 mr-1" />
                                                            Åbn i Designer
                                                        </Button>
                                                    </div>
                                                </div>
                                                <CardContent className="p-3">
                                                    <h4 className="font-medium text-sm truncate" title={template.name}>{template.name}</h4>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Badge variant="outline" className="text-[10px] py-0 px-1">
                                                            {template.category}
                                                        </Badge>
                                                        {template.bleed_mm > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] py-0 px-1">
                                                                +{template.bleed_mm}mm bleed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Ressourcer Tab */}
                        <TabsContent value="ressourcer" className="mt-0">
                            {isLoading ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="py-24 text-center">
                                    <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                                    <h3 className="text-lg font-semibold mb-2">Ingen ressourcer fundet</h3>
                                    <p className="text-muted-foreground">
                                        Upload dit første design for at komme i gang.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {filteredItems.map((item) => (
                                        <Card key={item.id} className="overflow-hidden group">
                                            <div className="aspect-square bg-muted relative flex items-center justify-center border-b">
                                                {item.kind === 'svg' ? (
                                                    <FileText className="w-12 h-12 text-muted-foreground/40" />
                                                ) : item.kind === 'pdf' ? (
                                                    <FileText className="w-12 h-12 text-red-400" />
                                                ) : (
                                                    <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
                                                )}

                                                {/* Overlay Actions */}
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                    <Button
                                                        size="icon"
                                                        variant="secondary"
                                                        className="h-8 w-8"
                                                        onClick={() => toggleVisibility(item)}
                                                        title={item.visibility === 'public' ? 'Gør privat' : 'Gør offentlig'}
                                                    >
                                                        {item.visibility === 'public' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button size="icon" variant="destructive" className="h-8 w-8">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Slet design?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Dette sletter filen permanent fra biblioteket.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                                                <AlertDialogAction onClick={(e) => { e.stopPropagation(); deleteItem(item); }}>Slet</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>

                                                <Badge className="absolute top-2 right-2" variant={item.visibility === 'public' ? 'default' : 'outline'}>
                                                    {item.visibility === 'public' ? 'Offentlig' : 'Privat'}
                                                </Badge>
                                                <Badge className="absolute top-2 left-2 bg-white/80 text-black border-none" variant="secondary">
                                                    {item.kind.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <CardContent className="p-3">
                                                <h4 className="font-medium text-sm truncate" title={item.name}>{item.name}</h4>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {item.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {item.tags.length > 3 && (
                                                        <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </CardContent>
                    <CardFooter className="border-t bg-muted/30 py-3">
                        <p className="text-xs text-muted-foreground">
                            {activeTab === 'mine'
                                ? `Viser ${filteredSavedDesigns.length} gemte designs`
                                : `Viser ${filteredItems.length} af ${items.length} designs`
                            }
                        </p>
                    </CardFooter>
                </Card>
            </Tabs>
        </div>
    );
}
