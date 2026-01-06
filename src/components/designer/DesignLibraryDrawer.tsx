import { useState, useMemo } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Search,
    LayoutGrid,
    User,
    FolderOpen,
    Plus,
    FileJson,
    Image as ImageIcon,
    FileCode,
    Loader2
} from "lucide-react";
import { useDesignLibrary, DesignLibraryItem } from "@/hooks/useDesignLibrary";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface DesignLibraryDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productId?: string | null;
    onInsertDesign: (design: DesignLibraryItem) => void;
    onReplaceDesign: (design: DesignLibraryItem) => void;
}

export function DesignLibraryDrawer({
    open,
    onOpenChange,
    productId,
    onInsertDesign,
    onReplaceDesign
}: DesignLibraryDrawerProps) {
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<'skabeloner' | 'mine' | 'ressourcer'>('skabeloner');

    const { data: items, isLoading } = useDesignLibrary({
        search,
        productId,
        tab: activeTab
    });

    const getPreviewUrl = (path: string | null) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;

        // Try product-images bucket as it's verified to exist
        const bucket = path.includes('previews/') ? 'product-images' : 'design-library';
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col p-0">
                <SheetHeader className="p-6 pb-2">
                    <SheetTitle className="flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-primary" />
                        Design Bibliotek
                    </SheetTitle>
                    <SheetDescription>
                        Vælg en skabelon eller åbn et af dine egne designs.
                    </SheetDescription>
                </SheetHeader>

                <div className="px-6 mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Søg designs..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="px-6">
                        <TabsList className="w-full">
                            <TabsTrigger value="skabeloner" className="flex-1 gap-2">
                                <LayoutGrid className="h-4 w-4" />
                                Skabeloner
                            </TabsTrigger>
                            <TabsTrigger value="mine" className="flex-1 gap-2">
                                <User className="h-4 w-4" />
                                Mine
                            </TabsTrigger>
                            <TabsTrigger value="ressourcer" className="flex-1 gap-2">
                                <FolderOpen className="h-4 w-4" />
                                Ressourcer
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-1 p-6">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                <p>Henter designs...</p>
                            </div>
                        ) : items && items.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4">
                                {items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="group relative border rounded-lg overflow-hidden bg-muted/30 hover:border-primary transition-all flex flex-col"
                                    >
                                        <div className="aspect-[4/3] relative bg-white flex items-center justify-center overflow-hidden border-b">
                                            {(item.preview_thumbnail_url || item.preview_path) ? (
                                                <img
                                                    src={getPreviewUrl(item.preview_thumbnail_url || item.preview_path!)!}
                                                    alt={item.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : item.kind === 'template' ? (
                                                <div className="flex flex-col items-center text-muted-foreground/50">
                                                    <LayoutGrid className="h-10 w-10 mb-2" />
                                                    <span className="text-xs font-mono">
                                                        {item.width_mm}×{item.height_mm} mm
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-muted-foreground/30">
                                                    {item.kind === 'fabric_json' ? <FileJson className="h-10 w-10" /> :
                                                        item.kind === 'svg' ? <FileCode className="h-10 w-10" /> :
                                                            <ImageIcon className="h-10 w-10" />}
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => onReplaceDesign(item)}>
                                                    Åbn
                                                </Button>
                                                {item.kind !== 'template' && (
                                                    <Button size="sm" onClick={() => onInsertDesign(item)}>
                                                        Indsæt
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-3">
                                            <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Badge variant="outline" className="text-[10px] uppercase py-0 px-1">
                                                    {item.kind === 'template' ? 'Format' :
                                                        item.kind === 'fabric_json' ? 'Editérbar' : item.kind}
                                                </Badge>
                                                {item.kind === 'template' && item.width_mm && item.height_mm && (
                                                    <Badge variant="secondary" className="text-[10px] py-0 px-1 font-mono">
                                                        {item.width_mm}×{item.height_mm}
                                                    </Badge>
                                                )}
                                                {item.visibility === 'public' && (
                                                    <Badge variant="secondary" className="text-[10px] py-0 px-1">Public</Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-muted-foreground">
                                <LayoutGrid className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p>Ingen designs fundet</p>
                            </div>
                        )}
                    </ScrollArea>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
