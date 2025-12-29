import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
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
    Upload, Trash2, LayoutGrid, Search,
    Eye, EyeOff, Loader2, Plus, RefreshCw, FileText, Image as ImageIcon, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DesignLibraryItem } from "@/hooks/useDesignLibrary";
import { resolveAdminTenant } from "@/lib/adminTenant";

export default function DesignResources() {
    const [items, setItems] = useState<DesignLibraryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [uploading, setUploading] = useState(false);

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

    useEffect(() => {
        fetchItems();
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

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Design Bibliotek</h1>
                    <p className="text-muted-foreground">
                        Administrer skabeloner, ikoner og andre grafiske elementer til Designer
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
                    <Button onClick={fetchItems} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Opdater
                    </Button>
                </div>
            </div>

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
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="py-24 text-center">
                            <LayoutGrid className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                            <h3 className="text-lg font-semibold mb-2">Ingen designs fundet</h3>
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
                                                        <AlertDialogAction onClick={() => deleteItem(item)}>Slet</AlertDialogAction>
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
                </CardContent>
                <CardFooter className="border-t bg-muted/30 py-3">
                    <p className="text-xs text-muted-foreground">
                        Viser {filteredItems.length} af {items.length} designs
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
