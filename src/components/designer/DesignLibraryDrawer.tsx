import { useMemo, useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    ExternalLink,
    FileCode,
    FileJson,
    FolderOpen,
    Image as ImageIcon,
    LayoutGrid,
    Loader2,
    Search,
    Sparkles,
    User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDesignLibrary, DesignLibraryItem } from "@/hooks/useDesignLibrary";
import {
    getTemplateLibraryKindLabel,
    getTemplateSourceKindLabel,
} from "@/lib/designer/templateLibrary";

interface DesignLibraryDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    productId?: string | null;
    onInsertDesign: (design: DesignLibraryItem) => void;
    onReplaceDesign: (design: DesignLibraryItem) => void;
}

function getPreviewUrl(path: string | null | undefined) {
    if (!path) return null;
    if (path.startsWith("http")) return path;

    const bucket = path.includes("previews/") ? "product-images" : "design-library";
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

function TemplateCard({
    item,
    onOpen,
}: {
    item: DesignLibraryItem;
    onOpen: (item: DesignLibraryItem) => void;
}) {
    const previewUrl = getPreviewUrl(item.preview_thumbnail_url || item.preview_path);
    const isCanva = item.source_kind === "canva";

    return (
        <div className="group rounded-xl border bg-card overflow-hidden transition-colors hover:border-primary/60">
            <div className="relative aspect-[4/3] border-b bg-muted/30">
                {previewUrl ? (
                    <img
                        src={previewUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        {isCanva ? (
                            <Sparkles className="h-10 w-10 opacity-50" />
                        ) : (
                            <LayoutGrid className="h-10 w-10 opacity-40" />
                        )}
                    </div>
                )}

                <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{getTemplateLibraryKindLabel(item.library_kind)}</Badge>
                    <Badge variant="outline">{getTemplateSourceKindLabel(item.source_kind)}</Badge>
                </div>
            </div>

            <div className="space-y-3 p-4">
                <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight">{item.name}</p>
                        {item.width_mm && item.height_mm ? (
                            <Badge variant="outline" className="font-mono">
                                {item.width_mm}x{item.height_mm}
                            </Badge>
                        ) : null}
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                        {item.description || item.category_label || "Skabelon til designeren"}
                    </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {item.category_label ? (
                        <Badge variant="secondary">{item.category_label}</Badge>
                    ) : null}
                    {(item.tags || []).slice(0, 3).map((tag) => (
                        <Badge key={`${item.id}-${tag}`} variant="outline">
                            {tag}
                        </Badge>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                        {isCanva
                            ? "Ekstern redigering i Canva"
                            : item.editor_json
                                ? "Indeholder startdesign"
                                : "Blank skabelon med format og guides"}
                    </div>
                    <Button size="sm" onClick={() => onOpen(item)}>
                        {isCanva ? (
                            <>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Canva
                            </>
                        ) : (
                            "Brug"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function DesignLibraryDrawer({
    open,
    onOpenChange,
    productId,
    onInsertDesign,
    onReplaceDesign,
}: DesignLibraryDrawerProps) {
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<"skabeloner" | "mine" | "ressourcer">("skabeloner");
    const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>("all");
    const [templateKindFilter, setTemplateKindFilter] = useState<string>("all");

    const { data: items, isLoading } = useDesignLibrary({
        search,
        productId,
        tab: activeTab,
    });

    const templateCategories = useMemo(() => {
        const categories = new Set(
            (items || [])
                .map((item) => item.category_label)
                .filter(Boolean)
        );
        return ["all", ...Array.from(categories)];
    }, [items]);

    const visibleItems = useMemo(() => {
        if (activeTab !== "skabeloner") return items || [];

        return (items || []).filter((item) => {
            const categoryMatch =
                templateCategoryFilter === "all" || item.category_label === templateCategoryFilter;
            const kindMatch =
                templateKindFilter === "all" || item.library_kind === templateKindFilter;
            return categoryMatch && kindMatch;
        });
    }, [activeTab, items, templateCategoryFilter, templateKindFilter]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="flex w-[460px] flex-col p-0 sm:w-[680px]">
                <SheetHeader className="space-y-3 border-b px-6 py-5">
                    <SheetTitle className="flex items-center gap-2 text-left">
                        <LayoutGrid className="h-5 w-5 text-primary" />
                        Templates
                    </SheetTitle>
                    <SheetDescription className="text-left">
                        Brug blanke formater, startdesigns eller Canva-links uden at forlade din produktopsætning.
                    </SheetDescription>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Søg i templates, designs og ressourcer..."
                            className="pl-9"
                        />
                    </div>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="flex min-h-0 flex-1 flex-col">
                    <div className="border-b px-6 py-4">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="skabeloner" className="gap-2">
                                <LayoutGrid className="h-4 w-4" />
                                Templates
                            </TabsTrigger>
                            <TabsTrigger value="mine" className="gap-2">
                                <User className="h-4 w-4" />
                                Mine designs
                            </TabsTrigger>
                            <TabsTrigger value="ressourcer" className="gap-2">
                                <FolderOpen className="h-4 w-4" />
                                Ressourcer
                            </TabsTrigger>
                        </TabsList>

                        {activeTab === "skabeloner" ? (
                            <>
                                <Separator className="my-4" />
                                <div className="flex flex-wrap gap-2">
                                    {templateCategories.map((category) => (
                                        <Button
                                            key={category}
                                            type="button"
                                            variant={templateCategoryFilter === category ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setTemplateCategoryFilter(category)}
                                        >
                                            {category === "all" ? "Alle kategorier" : category}
                                        </Button>
                                    ))}
                                </div>

                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant={templateKindFilter === "all" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setTemplateKindFilter("all")}
                                    >
                                        Alle typer
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={templateKindFilter === "blank" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setTemplateKindFilter("blank")}
                                    >
                                        Blanko
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={templateKindFilter === "starter" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setTemplateKindFilter("starter")}
                                    >
                                        Startdesign
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={templateKindFilter === "canva" ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setTemplateKindFilter("canva")}
                                    >
                                        Canva
                                    </Button>
                                </div>
                            </>
                        ) : null}
                    </div>

                    <ScrollArea className="min-h-0 flex-1 px-6 py-5">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                                <Loader2 className="mb-3 h-8 w-8 animate-spin" />
                                <p>Henter bibliotek...</p>
                            </div>
                        ) : visibleItems.length > 0 ? (
                            activeTab === "skabeloner" ? (
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    {visibleItems.map((item) => (
                                        <TemplateCard key={item.id} item={item} onOpen={onReplaceDesign} />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    {visibleItems.map((item) => {
                                        const previewUrl = getPreviewUrl(item.preview_thumbnail_url || item.preview_path);
                                        return (
                                            <div
                                                key={item.id}
                                                className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/60"
                                            >
                                                <div className="relative aspect-[4/3] overflow-hidden border-b bg-muted/30">
                                                    {previewUrl ? (
                                                        <img
                                                            src={previewUrl}
                                                            alt={item.name}
                                                            className="h-full w-full object-contain"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full items-center justify-center text-muted-foreground/40">
                                                            {item.kind === "fabric_json" ? (
                                                                <FileJson className="h-10 w-10" />
                                                            ) : item.kind === "svg" ? (
                                                                <FileCode className="h-10 w-10" />
                                                            ) : (
                                                                <ImageIcon className="h-10 w-10" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-3 p-3">
                                                    <div>
                                                        <p className="truncate text-sm font-medium">{item.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.kind === "fabric_json" ? "Editerbart design" : item.kind.toUpperCase()}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2">
                                                        <Button size="sm" variant="secondary" onClick={() => onReplaceDesign(item)}>
                                                            Åbn
                                                        </Button>
                                                        {item.kind !== "template" ? (
                                                            <Button size="sm" onClick={() => onInsertDesign(item)}>
                                                                Indsæt
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        ) : (
                            <div className="py-24 text-center text-muted-foreground">
                                <LayoutGrid className="mx-auto mb-3 h-10 w-10 opacity-20" />
                                <p>Ingen elementer matchede din søgning.</p>
                            </div>
                        )}
                    </ScrollArea>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
