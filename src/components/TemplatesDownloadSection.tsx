import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Search, Loader2, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";

// Template format options for filtering
const FORMAT_GROUPS: Record<string, string[]> = {
    "A-serie": ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"],
    "B-serie": ["B0", "B1", "B2"],
    "Special": ["M65", "VISITKORT", "SALGSMAPPE_A4", "SALGSMAPPE_A5", "BANNER_STANDARD", "ROLLUP", "CUSTOM"],
};

interface PdfTemplate {
    id: string;
    scope_type: "MASTER" | "TENANT";
    tenant_id: string | null;
    title: string;
    format_key: string;
    category: string | null;
    description: string | null;
    file_name: string;
    file_url: string;
    file_size_bytes: number | null;
    is_published: boolean;
}

interface TemplatesDownloadSectionProps {
    currentTenantId?: string;
    defaultOpen?: boolean;
}

export function TemplatesDownloadSection({ currentTenantId, defaultOpen = false }: TemplatesDownloadSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [templates, setTemplates] = useState<PdfTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterFormat, setFilterFormat] = useState<string>("all");

    // Group templates by category
    const groupByCategory = (templates: PdfTemplate[]) => {
        const grouped: Record<string, PdfTemplate[]> = {};
        templates.forEach((t) => {
            const cat = t.category || "Andet";
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(t);
        });
        return grouped;
    };

    // Fetch published templates (MASTER + current TENANT)
    useEffect(() => {
        async function fetchTemplates() {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from("pdf_templates" as any)
                    .select("*")
                    .eq("is_published", true)
                    .order("category", { ascending: true })
                    .order("format_key", { ascending: true });

                if (error) throw error;

                // Filter: Show all MASTER templates + current tenant's templates
                const filtered = ((data as unknown as PdfTemplate[]) || []).filter((t) => {
                    if (t.scope_type === "MASTER") return true;
                    if (t.scope_type === "TENANT" && currentTenantId && t.tenant_id === currentTenantId) return true;
                    return false;
                });

                setTemplates(filtered);
            } catch (error) {
                console.error("Error fetching templates:", error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchTemplates();
    }, [currentTenantId]);

    // Apply search and format filters
    const filteredTemplates = templates.filter((t) => {
        const matchesSearch =
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesFormat = filterFormat === "all" || t.format_key === filterFormat;
        return matchesSearch && matchesFormat;
    });

    const groupedTemplates = groupByCategory(filteredTemplates);
    const categories = Object.keys(groupedTemplates).sort();

    // Format file size
    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return "";
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (isLoading) {
        return (
            <div className="border border-border rounded-lg overflow-hidden mb-4">
                <div className="w-full flex items-center justify-between p-4 bg-muted/30">
                    <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Skabeloner (PDF)</span>
                    </div>
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    if (templates.length === 0) {
        return null; // Don't show section if no templates
    }

    return (
        <div className="border border-border rounded-lg overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Skabeloner (PDF)</span>
                    <Badge variant="secondary" className="text-xs">{templates.length}</Badge>
                </div>
                {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
            </button>
            {isOpen && (
                <div className="p-4 bg-background space-y-4">
                    <p className="text-muted-foreground text-sm">
                        Download vores trykkeklare skabeloner i PDF-format. Skabelonerne indeholder korrekt
                        opsætning med beskæring, sikkerhedszoner og formatstørrelser.
                    </p>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Søg i skabeloner..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Select value={filterFormat} onValueChange={setFilterFormat}>
                            <SelectTrigger className="w-full sm:w-48">
                                <SelectValue placeholder="Vælg format" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle formater</SelectItem>
                                {Object.entries(FORMAT_GROUPS).map(([group, formats]) => (
                                    <div key={group}>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                            {group}
                                        </div>
                                        {formats.map((f) => (
                                            <SelectItem key={f} value={f}>
                                                {f}
                                            </SelectItem>
                                        ))}
                                    </div>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Templates by Category */}
                    {filteredTemplates.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Ingen skabeloner matcher din søgning</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {categories.map((category) => (
                                <div key={category}>
                                    <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                                        {category}
                                    </h4>
                                    <div className="grid gap-2">
                                        {groupedTemplates[category].map((template) => (
                                            <div
                                                key={template.id}
                                                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <FileText className="h-5 w-5 text-red-500 shrink-0" />
                                                    <div className="min-w-0">
                                                        <p className="font-medium truncate">{template.title}</p>
                                                        {template.description && (
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {template.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge variant="secondary" className="hidden sm:flex">
                                                        {template.format_key}
                                                    </Badge>
                                                    {template.file_size_bytes && (
                                                        <span className="text-xs text-muted-foreground hidden md:block">
                                                            {formatFileSize(template.file_size_bytes)}
                                                        </span>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                        className="gap-1"
                                                    >
                                                        <a
                                                            href={template.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            download={template.file_name}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                            <span className="hidden sm:inline">Download</span>
                                                        </a>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Quick tip */}
                    <div className="bg-muted/30 p-4 rounded-lg text-sm text-muted-foreground">
                        <p>
                            <strong>Tip:</strong> Åbn skabelonen i Adobe Illustrator, InDesign eller lignende
                            for at se lag og beskæringsområder. Kontakt os hvis du har brug for et specielt format.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TemplatesDownloadSection;
