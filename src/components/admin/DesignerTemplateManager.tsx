import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { resolveAdminTenant } from "@/lib/adminTenant";
import {
    Plus,
    Pencil,
    Trash2,
    FileUp,
    Paintbrush,
    Layout,
    CreditCard,
    Circle,
    Square,
    FileText,
    Newspaper,
    Loader2,
    ExternalLink,
    Palette,
    AlertTriangle,
    Type,
    Download,
    Image as ImageIcon,
    MousePointer2,
    ChevronDown,
    ChevronUp,
    Settings,
    Upload,
    X
} from "lucide-react";

interface DesignerTemplate {
    id: string;
    name: string;
    description: string | null;
    template_type: string;
    category: string;
    width_mm: number;
    height_mm: number;
    bleed_mm: number;
    safe_area_mm: number;
    dpi_default: number;
    dpi_min_required: number;
    color_profile: string;
    template_pdf_url: string | null;
    preview_image_url: string | null;
    icon_name: string | null;
    is_public: boolean;
    is_active: boolean;
    supports_cut_contour: boolean;
    cut_contour_path: string | null;
}

const CATEGORIES = [
    { value: "business_cards", label: "Visitkort" },
    { value: "stickers", label: "Klistermærker" },
    { value: "flyers", label: "Flyers" },
    { value: "documents", label: "Dokumenter" },
    { value: "posters", label: "Plakater" },
    { value: "banners", label: "Bannere" },
    { value: "other", label: "Andet" },
];

const COLOR_PROFILES = [
    { value: "FOGRA39", label: "FOGRA39 (Coated)" },
    { value: "FOGRA51", label: "FOGRA51 (Coated v3)" },
    { value: "FOGRA52", label: "FOGRA52 (Uncoated v3)" },
    { value: "sRGB", label: "sRGB (Screen)" },
];

const ICON_OPTIONS = [
    { value: "CreditCard", label: "Visitkort", icon: CreditCard },
    { value: "Circle", label: "Cirkel", icon: Circle },
    { value: "Square", label: "Firkant", icon: Square },
    { value: "FileText", label: "Dokument", icon: FileText },
    { value: "Newspaper", label: "Flyer", icon: Newspaper },
    { value: "Layout", label: "Layout", icon: Layout },
];

const defaultTemplate: Partial<DesignerTemplate> = {
    name: "",
    description: "",
    template_type: "",
    category: "documents",
    width_mm: 210,
    height_mm: 297,
    bleed_mm: 3,
    safe_area_mm: 3,
    dpi_default: 300,
    dpi_min_required: 150,
    color_profile: "FOGRA39",
    icon_name: "FileText",
    is_public: true,
    is_active: true,
    supports_cut_contour: false,
};

export function DesignerTemplateManager() {
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<DesignerTemplate[]>([]);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Partial<DesignerTemplate> | null>(null);
    const [saving, setSaving] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [uploadingPdf, setUploadingPdf] = useState(false);

    // PDF Template upload handler
    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Kun PDF-filer understøttes');
            return;
        }

        setUploadingPdf(true);
        try {
            const fileName = `template-pdfs/${tenantId || 'default'}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('design-library')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('design-library')
                .getPublicUrl(fileName);

            setEditingTemplate(prev => ({ ...prev, template_pdf_url: publicUrl }));
            toast.success('PDF-skabelon uploadet');
        } catch (err: any) {
            toast.error('Upload fejlede: ' + err.message);
        } finally {
            setUploadingPdf(false);
        }
    };

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const { tenantId: tid } = await resolveAdminTenant();
            if (!tid) return;
            setTenantId(tid);

            const { data, error } = await supabase
                .from("designer_templates" as any)
                .select("*")
                .order("category", { ascending: true })
                .order("name", { ascending: true });

            if (error) throw error;
            setTemplates((data as unknown as DesignerTemplate[]) || []);
        } catch (err) {
            console.error("Fetch error:", err);
            toast.error("Kunne ikke hente skabeloner");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const openCreate = () => {
        setEditingTemplate({ ...defaultTemplate });
        setDialogOpen(true);
    };

    const openEdit = (template: DesignerTemplate) => {
        setEditingTemplate(template);
        setDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Er du sikker på at du vil slette denne skabelon?")) return;

        const { error } = await supabase
            .from("designer_templates" as any)
            .delete()
            .eq("id", id);

        if (error) {
            toast.error("Kunne ikke slette: " + error.message);
        } else {
            toast.success("Skabelon slettet");
            fetchTemplates();
        }
    };

    const handleSave = async () => {
        if (!editingTemplate?.name || !editingTemplate?.template_type) {
            toast.error("Udfyld navn og type");
            return;
        }

        try {
            setSaving(true);
            const data = {
                ...editingTemplate,
                tenant_id: tenantId || '00000000-0000-0000-0000-000000000000',
            };

            if (editingTemplate.id) {
                const { error } = await supabase
                    .from("designer_templates" as any)
                    .update(data)
                    .eq("id", editingTemplate.id);
                if (error) throw error;
                toast.success("Skabelon opdateret");
            } else {
                const { error } = await supabase
                    .from("designer_templates" as any)
                    .insert(data);
                if (error) throw error;
                toast.success("Skabelon oprettet");
            }

            setDialogOpen(false);
            fetchTemplates();
        } catch (err: any) {
            toast.error("Fejl: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const getIconComponent = (iconName: string | null) => {
        const found = ICON_OPTIONS.find(i => i.value === iconName);
        return found ? found.icon : FileText;
    };

    if (loading) {
        return (
            <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            </div>
        );
    }

    return (
        <div className="space-y-8 -m-6">
            {/* Full Landing Page Content */}
            <div className="bg-gradient-to-b from-slate-50 to-white">
                {/* Hero Section */}
                <section className="py-16 px-6">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                            <Paintbrush className="h-4 w-4" />
                            Professionelt Designværktøj
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                            Print Designer
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                            Giv dine kunder mulighed for at skabe trykkeklare designs direkte i browseren.
                            Med CMYK-farver, bleed-områder og høj opløsning – alt sammen uden at installere
                            noget software.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" onClick={() => window.open('/designer?format=A4', '_blank')} className="gap-2">
                                <MousePointer2 className="h-5 w-5" />
                                Åbn Print Designer
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-4">
                            <span className="text-green-600 font-medium">✓ Inkluderet gratis</span> på denne konto
                        </p>
                    </div>
                </section>

                {/* Feature Image Placeholder */}
                <section className="px-6 pb-12">
                    <div className="max-w-5xl mx-auto">
                        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">Designer preview billede</p>
                                <p className="text-sm">Tilføj et screenshot af designeren her</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-16 px-6 bg-white border-t">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl font-bold text-gray-900 mb-4">Alt hvad du har brug for</h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                Print Designer er fyldt med professionelle funktioner der gør det nemt at skabe
                                trykkeklare designs.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Feature 1 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                                    <Square className="h-6 w-6 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Professionelt Canvas</h3>
                                <p className="text-muted-foreground text-sm">
                                    Lag-baseret editor med bleed, trim og sikkerhedszoner.
                                    Præcis placering af alle elementer.
                                </p>
                            </div>

                            {/* Feature 2 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                                    <FileUp className="h-6 w-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">PDF Import</h3>
                                <p className="text-muted-foreground text-sm">
                                    Upload eksisterende PDF-filer og brug dem som udgangspunkt.
                                    Vælg enkeltside fra flersidede dokumenter.
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Preflight Tjek</h3>
                                <p className="text-muted-foreground text-sm">
                                    Automatisk validering af opløsning, tekststørrelse og marginer.
                                    Få advarsler før du bestiller.
                                </p>
                            </div>

                            {/* Feature 4 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                                    <Palette className="h-6 w-6 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">CMYK Soft Proofing</h3>
                                <p className="text-muted-foreground text-sm">
                                    Se hvordan dine farver vil se ud på tryk med vores ICC-baserede
                                    farvekonvertering og gamut-advarsel.
                                </p>
                            </div>

                            {/* Feature 5 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mb-4">
                                    <Type className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Tekst & Typografi</h3>
                                <p className="text-muted-foreground text-sm">
                                    Bred vifte af fonte med fuld kontrol over størrelse, farve,
                                    linjeafstand og tekstformatering.
                                </p>
                            </div>

                            {/* Feature 6 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                                    <Download className="h-6 w-6 text-indigo-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Print-klar Eksport</h3>
                                <p className="text-muted-foreground text-sm">
                                    Eksporter dit design som højopløselig PDF klar til professionelt tryk
                                    med korrekte farver.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-16 px-6 bg-gradient-to-r from-primary/5 to-primary/10 border-t">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Klar til at komme i gang?</h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            Start med at designe dit første trykkeklare artwork i dag.
                        </p>
                        <Button size="lg" onClick={() => window.open('/designer?format=A4', '_blank')} className="gap-2">
                            <MousePointer2 className="h-5 w-5" />
                            Åbn Print Designer
                        </Button>
                    </div>
                </section>
            </div>

            {/* Templates Section - Collapsible */}
            {showTemplates && (
                <div className="px-6 pb-8 bg-white border-t">
                    <div className="max-w-6xl mx-auto pt-8">
                        {/* Templates Header */}
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                                    <Layout className="h-6 w-6 text-primary" />
                                    Format Skabeloner
                                </h2>
                                <p className="text-muted-foreground mt-1">
                                    Administrer format-skabeloner der vises i Design Biblioteket
                                </p>
                            </div>
                            <Button onClick={openCreate}>
                                <Plus className="h-4 w-4 mr-2" />
                                Ny Skabelon
                            </Button>
                        </div>

                        {/* Templates Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Alle Skabeloner ({templates.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12"></TableHead>
                                            <TableHead>Navn</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Kategori</TableHead>
                                            <TableHead>Størrelse</TableHead>
                                            <TableHead>DPI</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Handlinger</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {templates.map((template) => {
                                            const IconComponent = getIconComponent(template.icon_name);
                                            const category = CATEGORIES.find(c => c.value === template.category);

                                            return (
                                                <TableRow key={template.id}>
                                                    <TableCell>
                                                        <div className="p-2 rounded bg-primary/10 text-primary w-fit">
                                                            <IconComponent className="h-5 w-5" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {template.name}
                                                        {template.description && (
                                                            <p className="text-xs text-muted-foreground">{template.description}</p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                                            {template.template_type}
                                                        </code>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">{category?.label || template.category}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="font-mono text-sm">
                                                            {template.width_mm}×{template.height_mm} mm
                                                        </span>
                                                        <span className="text-xs text-muted-foreground ml-1">
                                                            (+{template.bleed_mm}mm bleed)
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{template.dpi_default}</TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1">
                                                            {template.is_active ? (
                                                                <Badge className="bg-green-500">Aktiv</Badge>
                                                            ) : (
                                                                <Badge variant="secondary">Inaktiv</Badge>
                                                            )}
                                                            {template.supports_cut_contour && (
                                                                <Badge variant="outline" className="text-xs">Kontur</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={() => openEdit(template)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(template.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {templates.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                    Ingen skabeloner endnu. Klik "Ny Skabelon" for at oprette den første.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Edit/Create Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTemplate?.id ? "Rediger Skabelon" : "Opret Ny Skabelon"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Navn *</Label>
                                <Input
                                    value={editingTemplate?.name || ""}
                                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="f.eks. Visitkort Standard"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Type ID *</Label>
                                <Input
                                    value={editingTemplate?.template_type || ""}
                                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, template_type: e.target.value }))}
                                    placeholder="f.eks. business_card"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Beskrivelse</Label>
                            <Input
                                value={editingTemplate?.description || ""}
                                onChange={(e) => setEditingTemplate(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Kort beskrivelse af skabelonen"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Kategori</Label>
                                <Select
                                    value={editingTemplate?.category || "documents"}
                                    onValueChange={(v) => setEditingTemplate(prev => ({ ...prev, category: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => (
                                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Ikon</Label>
                                <Select
                                    value={editingTemplate?.icon_name || "FileText"}
                                    onValueChange={(v) => setEditingTemplate(prev => ({ ...prev, icon_name: v }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ICON_OPTIONS.map(({ value, label, icon: Icon }) => (
                                            <SelectItem key={value} value={value}>
                                                <div className="flex items-center gap-2">
                                                    <Icon className="h-4 w-4" />
                                                    {label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Dimensions */}
                        <div className="border-t pt-4">
                            <h4 className="font-semibold mb-3">Dimensioner (mm)</h4>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label>Bredde</Label>
                                    <Input
                                        type="number"
                                        value={editingTemplate?.width_mm || 0}
                                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, width_mm: parseFloat(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Højde</Label>
                                    <Input
                                        type="number"
                                        value={editingTemplate?.height_mm || 0}
                                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, height_mm: parseFloat(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Bleed</Label>
                                    <Input
                                        type="number"
                                        value={editingTemplate?.bleed_mm || 3}
                                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, bleed_mm: parseFloat(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Safe Area</Label>
                                    <Input
                                        type="number"
                                        value={editingTemplate?.safe_area_mm || 3}
                                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, safe_area_mm: parseFloat(e.target.value) }))}
                                    />
                                </div>
                            </div>

                            {/* Cut Contour SVG */}
                            <div className="space-y-2">
                                <Label>CutContour SVG (til fri stansning)</Label>
                                <p className="text-xs text-muted-foreground">SVG-kode der eksporteres som spot-farve til plotter.</p>
                                <textarea
                                    className="w-full h-24 p-2 text-xs font-mono border rounded-md resize-none"
                                    placeholder="<svg>...</svg>"
                                    value={editingTemplate?.cut_contour_path || ''}
                                    onChange={(e) => setEditingTemplate(prev => ({ ...prev, cut_contour_path: e.target.value || null }))}
                                />
                            </div>

                            {/* Template PDF Upload */}
                            <div className="space-y-2 border-t pt-4">
                                <Label>Format-skabelon PDF (visuel guide)</Label>
                                <p className="text-xs text-muted-foreground">
                                    Upload PDF med fold/skære-linier. Vises som overlay når kunder åbner dette format.
                                </p>

                                {editingTemplate?.template_pdf_url ? (
                                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm truncate flex-1">{editingTemplate.template_pdf_url.split('/').pop()}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingTemplate(prev => ({ ...prev, template_pdf_url: null }))}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="file"
                                            accept="application/pdf,.pdf"
                                            onChange={handlePdfUpload}
                                            disabled={uploadingPdf}
                                            className="flex-1"
                                        />
                                        {uploadingPdf && <Loader2 className="h-4 w-4 animate-spin" />}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Technical */}
                        <div className="border-t pt-4">
                            <h4 className="font-semibold mb-3">Teknisk</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Standard DPI</Label>
                                    <Input
                                        type="number"
                                        value={editingTemplate?.dpi_default || 300}
                                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, dpi_default: parseInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Min DPI</Label>
                                    <Input
                                        type="number"
                                        value={editingTemplate?.dpi_min_required || 150}
                                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, dpi_min_required: parseInt(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Farveprofil</Label>
                                    <Select
                                        value={editingTemplate?.color_profile || "FOGRA39"}
                                        onValueChange={(v) => setEditingTemplate(prev => ({ ...prev, color_profile: v }))}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {COLOR_PROFILES.map(p => (
                                                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Template PDF */}
                        <div className="border-t pt-4">
                            <h4 className="font-semibold mb-3">Template PDF (valgfrit)</h4>
                            <div className="space-y-2">
                                <Label>PDF URL</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={editingTemplate?.template_pdf_url || ""}
                                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, template_pdf_url: e.target.value }))}
                                        placeholder="https://..."
                                    />
                                    <Button variant="outline" size="icon">
                                        <FileUp className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Upload en PDF-skabelon som brugere kan bruge som baggrund/guide
                                </p>
                            </div>
                        </div>

                        {/* Flags */}
                        <div className="border-t pt-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Aktiv</Label>
                                    <p className="text-xs text-muted-foreground">Skabelonen vises i designeren</p>
                                </div>
                                <Switch
                                    checked={editingTemplate?.is_active ?? true}
                                    onCheckedChange={(v) => setEditingTemplate(prev => ({ ...prev, is_active: v }))}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Offentlig</Label>
                                    <p className="text-xs text-muted-foreground">Synlig for alle brugere</p>
                                </div>
                                <Switch
                                    checked={editingTemplate?.is_public ?? true}
                                    onCheckedChange={(v) => setEditingTemplate(prev => ({ ...prev, is_public: v }))}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label>Konturskæring</Label>
                                    <p className="text-xs text-muted-foreground">Understøtter CutContour sti (stickers)</p>
                                </div>
                                <Switch
                                    checked={editingTemplate?.supports_cut_contour ?? false}
                                    onCheckedChange={(v) => setEditingTemplate(prev => ({ ...prev, supports_cut_contour: v }))}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuller</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Gem Skabelon
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default DesignerTemplateManager;
