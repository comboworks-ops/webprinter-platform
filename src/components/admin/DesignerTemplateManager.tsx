import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    ExternalLink,
    LayoutGrid,
    Loader2,
    Pencil,
    Plus,
    Save,
    Sparkles,
    Trash2,
    Upload,
} from "lucide-react";
import {
    DESIGNER_TEMPLATE_CATEGORY_OPTIONS,
    getTemplateCategoryLabel,
    getTemplateLibraryKindLabel,
    getTemplateSourceKindLabel,
    MASTER_TENANT_ID,
    normalizeTemplateTags,
    TEMPLATE_LIBRARY_KIND_OPTIONS,
} from "@/lib/designer/templateLibrary";

type DesignerTemplateRow = {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    template_type: string;
    category: string;
    width_mm: number;
    height_mm: number;
    bleed_mm: number;
    safe_area_mm: number;
    dpi_default: number;
    color_profile: string | null;
    template_pdf_url: string | null;
    preview_image_url: string | null;
    is_public: boolean;
    is_active: boolean;
    library_kind: string | null;
    source_kind: string | null;
    editor_json: any;
    external_launch_url: string | null;
    tags: string[] | null;
    sort_order: number | null;
    updated_at: string | null;
};

type SavedDesignRow = {
    id: string;
    name: string;
    width_mm: number;
    height_mm: number;
    bleed_mm: number | null;
    dpi: number | null;
    color_profile: string | null;
    editor_json: any;
    preview_thumbnail_url: string | null;
};

type TemplateFormState = {
    id?: string;
    name: string;
    description: string;
    template_type: string;
    category: string;
    width_mm: number;
    height_mm: number;
    bleed_mm: number;
    safe_area_mm: number;
    dpi_default: number;
    color_profile: string;
    template_pdf_url: string;
    preview_image_url: string;
    is_public: boolean;
    is_active: boolean;
    library_kind: "blank" | "starter" | "canva";
    editor_json: any;
    external_launch_url: string;
    tags: string;
    sort_order: number;
};

const EMPTY_FORM: TemplateFormState = {
    name: "",
    description: "",
    template_type: "format",
    category: "documents",
    width_mm: 210,
    height_mm: 297,
    bleed_mm: 3,
    safe_area_mm: 3,
    dpi_default: 300,
    color_profile: "FOGRA39",
    template_pdf_url: "",
    preview_image_url: "",
    is_public: true,
    is_active: true,
    library_kind: "blank",
    editor_json: null,
    external_launch_url: "",
    tags: "",
    sort_order: 0,
};

function mapTemplateToForm(template: DesignerTemplateRow): TemplateFormState {
    return {
        id: template.id,
        name: template.name,
        description: template.description || "",
        template_type: template.template_type || "format",
        category: template.category || "documents",
        width_mm: Number(template.width_mm || 210),
        height_mm: Number(template.height_mm || 297),
        bleed_mm: Number(template.bleed_mm || 3),
        safe_area_mm: Number(template.safe_area_mm || 3),
        dpi_default: Number(template.dpi_default || 300),
        color_profile: template.color_profile || "FOGRA39",
        template_pdf_url: template.template_pdf_url || "",
        preview_image_url: template.preview_image_url || "",
        is_public: Boolean(template.is_public),
        is_active: Boolean(template.is_active),
        library_kind: (template.library_kind as TemplateFormState["library_kind"]) || "blank",
        editor_json: template.editor_json || null,
        external_launch_url: template.external_launch_url || "",
        tags: (template.tags || []).join(", "),
        sort_order: Number(template.sort_order || 0),
    };
}

export function DesignerTemplateManager() {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [isMasterScope, setIsMasterScope] = useState(false);
    const [templates, setTemplates] = useState<DesignerTemplateRow[]>([]);
    const [savedDesigns, setSavedDesigns] = useState<SavedDesignRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [kindFilter, setKindFilter] = useState<string>("all");
    const [form, setForm] = useState<TemplateFormState>(EMPTY_FORM);
    const [selectedSavedDesignId, setSelectedSavedDesignId] = useState<string>("none");

    const categoryOptions = useMemo(() => {
        const values = new Set<string>(DESIGNER_TEMPLATE_CATEGORY_OPTIONS.map((option) => option.value));
        templates.forEach((template) => {
            if (template.category) values.add(template.category);
        });
        return Array.from(values);
    }, [templates]);

    const filteredTemplates = useMemo(() => {
        return templates.filter((template) => {
            const matchesKind = kindFilter === "all" || template.library_kind === kindFilter;
            if (!matchesKind) return false;

            if (!search) return true;
            const haystack = [
                template.name,
                template.description,
                template.category,
                ...(template.tags || []),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(search.toLowerCase());
        });
    }, [templates, kindFilter, search]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const resolution = await resolveAdminTenant();
            if (!resolution.tenantId) {
                setTemplates([]);
                return;
            }

            setTenantId(resolution.tenantId);
            setIsMasterScope(resolution.tenantId === MASTER_TENANT_ID);

            const [{ data: templateRows, error: templateError }, { data: userData }, { data: savedRows, error: savedError }] = await Promise.all([
                supabase
                    .from("designer_templates" as any)
                    .select("*")
                    .eq("tenant_id", resolution.tenantId)
                    .order("sort_order", { ascending: true })
                    .order("category", { ascending: true })
                    .order("name", { ascending: true }),
                supabase.auth.getUser(),
                supabase
                    .from("designer_saved_designs" as any)
                    .select("id, name, width_mm, height_mm, bleed_mm, dpi, color_profile, editor_json, preview_thumbnail_url")
                    .order("updated_at", { ascending: false }),
            ]);

            if (templateError) throw templateError;
            if (savedError) throw savedError;

            const currentUserId = userData.user?.id;
            setTemplates((templateRows as DesignerTemplateRow[] || []).filter((row) => !["material", "finish", "product"].includes(row.template_type)));
            setSavedDesigns(((savedRows as SavedDesignRow[]) || []).filter((row: any) => !currentUserId || row.user_id === undefined || row.user_id === currentUserId));
        } catch (error) {
            console.error("[DesignerTemplateManager] Failed to fetch data", error);
            toast.error("Kunne ikke hente templatebiblioteket");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openCreateDialog = () => {
        setForm({
            ...EMPTY_FORM,
            is_public: isMasterScope,
        });
        setSelectedSavedDesignId("none");
        setDialogOpen(true);
    };

    const openEditDialog = (template: DesignerTemplateRow) => {
        setForm(mapTemplateToForm(template));
        setSelectedSavedDesignId("none");
        setDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Vil du slette denne template?")) return;

        const { error } = await supabase
            .from("designer_templates" as any)
            .delete()
            .eq("id", id);

        if (error) {
            toast.error("Kunne ikke slette templaten");
            return;
        }

        toast.success("Template slettet");
        fetchData();
    };

    const handlePdfUpload = async (file: File) => {
        if (!tenantId) return;

        if (file.type !== "application/pdf") {
            toast.error("Kun PDF-filer understottes");
            return;
        }

        const fileName = `template-pdfs/${tenantId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
            .from("design-library")
            .upload(fileName, file, { upsert: true });

        if (error) {
            toast.error(`Upload fejlede: ${error.message}`);
            return;
        }

        const { data } = supabase.storage.from("design-library").getPublicUrl(fileName);
        setForm((current) => ({ ...current, template_pdf_url: data.publicUrl }));
        toast.success("PDF-overlay uploadet");
    };

    const handlePickSavedDesign = (value: string) => {
        setSelectedSavedDesignId(value);
        if (value === "none") return;

        const selected = savedDesigns.find((design) => design.id === value);
        if (!selected) return;

        setForm((current) => ({
            ...current,
            name: current.name || selected.name,
            width_mm: Number(selected.width_mm || current.width_mm),
            height_mm: Number(selected.height_mm || current.height_mm),
            bleed_mm: Number(selected.bleed_mm || current.bleed_mm),
            dpi_default: Number(selected.dpi || current.dpi_default),
            color_profile: selected.color_profile || current.color_profile,
            editor_json: selected.editor_json,
            preview_image_url: current.preview_image_url || selected.preview_thumbnail_url || "",
            library_kind: "starter",
        }));
    };

    const handleSave = async () => {
        if (!tenantId) {
            toast.error("Kunne ikke resolve tenant");
            return;
        }

        if (!form.name.trim()) {
            toast.error("Template-navn er paakraevet");
            return;
        }

        if (form.library_kind === "starter" && !form.editor_json) {
            toast.error("Vaelg et gemt design eller tilfaj editor data til startdesign");
            return;
        }

        if (form.library_kind === "canva" && !form.external_launch_url.trim()) {
            toast.error("Canva-templates skal have en ekstern launch URL");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                tenant_id: tenantId,
                name: form.name.trim(),
                description: form.description.trim() || null,
                template_type: form.template_type.trim() || "format",
                category: form.category,
                width_mm: Number(form.width_mm),
                height_mm: Number(form.height_mm),
                bleed_mm: Number(form.bleed_mm),
                safe_area_mm: Number(form.safe_area_mm),
                dpi_default: Number(form.dpi_default),
                color_profile: form.color_profile || "FOGRA39",
                template_pdf_url: form.template_pdf_url.trim() || null,
                preview_image_url: form.preview_image_url.trim() || null,
                is_public: Boolean(form.is_public),
                is_active: Boolean(form.is_active),
                library_kind: form.library_kind,
                source_kind: form.library_kind === "canva" ? "canva" : "native",
                editor_json: form.library_kind === "starter" ? form.editor_json : null,
                external_launch_url: form.library_kind === "canva" ? form.external_launch_url.trim() : null,
                tags: normalizeTemplateTags(form.tags),
                sort_order: Number(form.sort_order || 0),
            };

            if (form.id) {
                const { error } = await supabase
                    .from("designer_templates" as any)
                    .update(payload)
                    .eq("id", form.id);
                if (error) throw error;
                toast.success("Template opdateret");
            } else {
                const { error } = await supabase
                    .from("designer_templates" as any)
                    .insert(payload);
                if (error) throw error;
                toast.success("Template oprettet");
            }

            setDialogOpen(false);
            setForm({ ...EMPTY_FORM, is_public: isMasterScope });
            setSelectedSavedDesignId("none");
            fetchData();
        } catch (error: any) {
            console.error("[DesignerTemplateManager] Failed to save", error);
            toast.error(error.message || "Kunne ikke gemme templaten");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <LayoutGrid className="h-5 w-5 text-primary" />
                            <CardTitle>Templatebibliotek</CardTitle>
                        </div>
                        <CardDescription>
                            {isMasterScope
                                ? "Byg mastertemplates som alle tenant shops kan tilbyde, inklusive Canva-links og startdesigns."
                                : "Byg butikkens egne templates oven paa masterbiblioteket."}
                        </CardDescription>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{isMasterScope ? "Masterbibliotek" : "Tenantbibliotek"}</Badge>
                            <Badge variant="outline">{tenantId}</Badge>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Sog i templates..."
                            className="sm:w-64"
                        />
                        <Select value={kindFilter} onValueChange={setKindFilter}>
                            <SelectTrigger className="sm:w-44">
                                <SelectValue placeholder="Alle typer" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle typer</SelectItem>
                                {TEMPLATE_LIBRARY_KIND_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Ny template
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTemplates.map((template) => (
                    <Card key={template.id} className="overflow-hidden">
                        <div className="aspect-[4/3] border-b bg-muted/30">
                            {template.preview_image_url ? (
                                <img
                                    src={template.preview_image_url}
                                    alt={template.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center text-muted-foreground">
                                    {template.source_kind === "canva" ? (
                                        <Sparkles className="h-10 w-10 opacity-50" />
                                    ) : (
                                        <LayoutGrid className="h-10 w-10 opacity-40" />
                                    )}
                                </div>
                            )}
                        </div>
                        <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <CardTitle className="text-lg">{template.name}</CardTitle>
                                    <CardDescription>{getTemplateCategoryLabel(template.category)}</CardDescription>
                                </div>
                                <Badge variant="outline" className="font-mono">
                                    {template.width_mm}x{template.height_mm}
                                </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="secondary">{getTemplateLibraryKindLabel(template.library_kind)}</Badge>
                                <Badge variant="outline">{getTemplateSourceKindLabel(template.source_kind)}</Badge>
                                {!template.is_active ? (
                                    <Badge variant="outline">Inaktiv</Badge>
                                ) : null}
                                {isMasterScope && template.is_public ? (
                                    <Badge variant="secondary">Til alle tenants</Badge>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="min-h-10 text-sm text-muted-foreground">
                                {template.description || "Ingen beskrivelse endnu."}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {(template.tags || []).map((tag) => (
                                    <Badge key={`${template.id}-${tag}`} variant="outline">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="secondary" size="sm" onClick={() => openEditDialog(template)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Rediger
                                </Button>
                                {template.external_launch_url ? (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                    >
                                        <a href={template.external_launch_url} target="_blank" rel="noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Aabn
                                        </a>
                                    </Button>
                                ) : null}
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Slet
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredTemplates.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        Ingen templates fundet for dette bibliotek endnu.
                    </CardContent>
                </Card>
            ) : null}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{form.id ? "Rediger template" : "Ny template"}</DialogTitle>
                        <DialogDescription>
                            Opret blanke formater, native startdesigns eller Canva-links fra samme bibliotek.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4 md:grid-cols-2">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="template-name">Navn</Label>
                                <Input
                                    id="template-name"
                                    value={form.name}
                                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="template-description">Beskrivelse</Label>
                                <Textarea
                                    id="template-description"
                                    rows={4}
                                    value={form.description}
                                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Template-type</Label>
                                    <Input
                                        value={form.template_type}
                                        onChange={(event) => setForm((current) => ({ ...current, template_type: event.target.value }))}
                                        placeholder="format, flyer, menu_card..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kategori</Label>
                                    <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categoryOptions.map((category) => (
                                                <SelectItem key={category} value={category}>
                                                    {getTemplateCategoryLabel(category)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Template-type</Label>
                                    <Select
                                        value={form.library_kind}
                                        onValueChange={(value: TemplateFormState["library_kind"]) => setForm((current) => ({
                                            ...current,
                                            library_kind: value,
                                        }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TEMPLATE_LIBRARY_KIND_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Tags</Label>
                                    <Input
                                        value={form.tags}
                                        onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                                        placeholder="menu, kampagne, folded..."
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Bredde (mm)</Label>
                                    <Input
                                        type="number"
                                        value={form.width_mm}
                                        onChange={(event) => setForm((current) => ({ ...current, width_mm: Number(event.target.value || 0) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Hojde (mm)</Label>
                                    <Input
                                        type="number"
                                        value={form.height_mm}
                                        onChange={(event) => setForm((current) => ({ ...current, height_mm: Number(event.target.value || 0) }))}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Bleed</Label>
                                    <Input
                                        type="number"
                                        value={form.bleed_mm}
                                        onChange={(event) => setForm((current) => ({ ...current, bleed_mm: Number(event.target.value || 0) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Safe area</Label>
                                    <Input
                                        type="number"
                                        value={form.safe_area_mm}
                                        onChange={(event) => setForm((current) => ({ ...current, safe_area_mm: Number(event.target.value || 0) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>DPI</Label>
                                    <Input
                                        type="number"
                                        value={form.dpi_default}
                                        onChange={(event) => setForm((current) => ({ ...current, dpi_default: Number(event.target.value || 0) }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {form.library_kind === "starter" ? (
                                <div className="space-y-2">
                                    <Label>Kilde fra gemt design</Label>
                                    <Select value={selectedSavedDesignId} onValueChange={handlePickSavedDesign}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Vaelg gemt design" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Ingen valgt</SelectItem>
                                            {savedDesigns.map((design) => (
                                                <SelectItem key={design.id} value={design.id}>
                                                    {design.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Startdesigns kopierer editor-indholdet fra et gemt Webprinter-design.
                                    </p>
                                </div>
                            ) : null}

                            {form.library_kind === "canva" ? (
                                <div className="space-y-2">
                                    <Label>Canva launch URL</Label>
                                    <Input
                                        value={form.external_launch_url}
                                        onChange={(event) => setForm((current) => ({ ...current, external_launch_url: event.target.value }))}
                                        placeholder="https://www.canva.com/..."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Brug dette til mastercurerede Canva-templates, indtil en fuld Canva OAuth-returflow bliver bygget.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3 rounded-lg border p-4">
                                    <div className="space-y-2">
                                        <Label>PDF-overlay</Label>
                                        <Input
                                            value={form.template_pdf_url}
                                            onChange={(event) => setForm((current) => ({ ...current, template_pdf_url: event.target.value }))}
                                            placeholder="https://... eller upload en PDF"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Label
                                            htmlFor="template-pdf-upload"
                                            className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"
                                        >
                                            <Upload className="mr-2 h-4 w-4" />
                                            Upload PDF
                                        </Label>
                                        <input
                                            id="template-pdf-upload"
                                            type="file"
                                            accept="application/pdf"
                                            className="hidden"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0];
                                                if (file) {
                                                    handlePdfUpload(file);
                                                }
                                            }}
                                        />
                                        {form.template_pdf_url ? (
                                            <Badge variant="outline">Overlay klar</Badge>
                                        ) : null}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Brug overlays til foldelinjer, blanke guides og tekniske formatlag.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Preview billede</Label>
                                <Input
                                    value={form.preview_image_url}
                                    onChange={(event) => setForm((current) => ({ ...current, preview_image_url: event.target.value }))}
                                    placeholder="https://..."
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Farveprofil</Label>
                                    <Input
                                        value={form.color_profile}
                                        onChange={(event) => setForm((current) => ({ ...current, color_profile: event.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Sortering</Label>
                                    <Input
                                        type="number"
                                        value={form.sort_order}
                                        onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value || 0) }))}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="font-medium">Aktiv</p>
                                        <p className="text-sm text-muted-foreground">Vis template i designerens bibliotek.</p>
                                    </div>
                                    <Switch
                                        checked={form.is_active}
                                        onCheckedChange={(checked) => setForm((current) => ({ ...current, is_active: checked }))}
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border p-3">
                                    <div>
                                        <p className="font-medium">Del til tenants</p>
                                        <p className="text-sm text-muted-foreground">
                                            {isMasterScope
                                                ? "Goer mastertemplaten tilgaengelig for alle tenant shops."
                                                : "Template bliver i denne tenant, men er tilgaengelig i butikkens designer."}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={form.is_public}
                                        disabled={!isMasterScope}
                                        onCheckedChange={(checked) => setForm((current) => ({ ...current, is_public: checked }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Luk
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Gem template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default DesignerTemplateManager;
