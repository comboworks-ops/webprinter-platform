import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Image, Check, X, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type DesignLibraryItem = {
  id: string;
  name: string;
  kind: string;
  tags: string[];
  preview_path?: string | null;
  storage_path?: string | null;
  visibility: string;
};

type DesignLibrarySelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: DesignLibraryItem) => void;
  selectedId?: string | null;
  title?: string;
  filterKinds?: string[];
};

export function DesignLibrarySelector({
  open,
  onOpenChange,
  onSelect,
  selectedId,
  title = "V\u00e6lg fra designbibliotek",
  filterKinds = ["image", "svg"],
}: DesignLibrarySelectorProps) {
  const [items, setItems] = useState<DesignLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Fetch design library items
  useEffect(() => {
    if (!open) return;

    const fetchItems = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("design_library_items" as any)
          .select("id, name, kind, tags, preview_path, storage_path, visibility")
          .in("kind", filterKinds)
          .order("name");

        const { data, error } = await query;
        if (error) throw error;
        setItems((data || []) as DesignLibraryItem[]);
      } catch (error) {
        console.error("Error fetching design library items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [open, filterKinds]);

  // Get all unique tags from items
  const allTags = Array.from(
    new Set(items.flatMap((item) => item.tags || []))
  ).sort();

  // Filter items by search and tag
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tags || []).some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesTag = !selectedTag || (item.tags || []).includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const handleSelect = (item: DesignLibraryItem) => {
    onSelect(item);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="S\u00f8g efter navn eller tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedTag && (
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1"
                onClick={() => setSelectedTag(null)}
              >
                {selectedTag}
                <X className="h-3 w-3" />
              </Badge>
            )}
            {!selectedTag &&
              allTags.slice(0, 10).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-secondary"
                  onClick={() => setSelectedTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
          </div>
        )}

        {/* Items grid */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              Indl\u00e6ser...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Image className="h-12 w-12 mb-2 opacity-50" />
              <p>Ingen elementer fundet</p>
              {searchQuery && (
                <Button
                  variant="link"
                  onClick={() => setSearchQuery("")}
                  className="mt-2"
                >
                  Ryd s\u00f8gning
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 pb-4">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "relative flex flex-col items-center rounded-lg border p-3 text-left transition-colors hover:bg-secondary/50",
                    selectedId === item.id && "border-primary bg-primary/5"
                  )}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-md bg-muted mb-2">
                    {item.preview_path || item.storage_path ? (
                      <img
                        src={item.preview_path || item.storage_path || ""}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Image className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                    )}
                    {selectedId === item.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <Check className="h-8 w-8 text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <p className="w-full truncate text-sm font-medium">
                    {item.name}
                  </p>

                  {/* Tags */}
                  {(item.tags || []).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {item.tags.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {item.tags.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{item.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuller
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
