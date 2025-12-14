import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    Loader2, Upload, Trash2, Plus, FileText, Download, Edit,
    Search, FolderOpen, FileIcon
} from "lucide-react";

// Template format options
const FORMAT_OPTIONS = [
    { value: "A0", label: "A0 (841 × 1189 mm)" },
    { value: "A1", label: "A1 (594 × 841 mm)" },
    { value: "A2", label: "A2 (420 × 594 mm)" },
    { value: "A3", label: "A3 (297 × 420 mm)" },
    { value: "A4", label: "A4 (210 × 297 mm)" },
    { value: "A5", label: "A5 (148 × 210 mm)" },
    { value: "A6", label: "A6 (105 × 148 mm)" },
    { value: "A7", label: "A7 (74 × 105 mm)" },
    { value: "B0", label: "B0 (1000 × 1414 mm)" },
    { value: "B1", label: "B1 (707 × 1000 mm)" },
    { value: "B2", label: "B2 (500 × 707 mm)" },
    { value: "M65", label: "M65 Format" },
    { value: "VISITKORT", label: "Visitkort (85 × 55 mm)" },
    { value: "SALGSMAPPE_A4", label: "Salgsmappe A4" },
    { value: "SALGSMAPPE_A5", label: "Salgsmappe A5" },
    { value: "BANNER_STANDARD", label: "Banner Standard" },
    { value: "ROLLUP", label: "Roll-up" },
    { value: "CUSTOM", label: "Brugerdefineret" },
];

const CATEGORY_OPTIONS = [
    "Standardformater",
    "Plakater",
    "Salgsmapper",
    "Visitkort",
    "Bannere",
    "Roll-ups",
    "Stickers",
    "Foldere",
    "Andet",
];

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
    sort_order: number;
    created_at: string;
    updated_at: string;
}

interface TemplatesManagerProps {
    scopeType: "MASTER" | "TENANT";
    tenantId?: string;
}

export function TemplatesManager({ scopeType, tenantId }: TemplatesManagerProps) {
    const [templates, setTemplates] = useState<PdfTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterFormat, setFilterFormat] = useState<string>("all");

    // Dialog state
    const [showDialog, setShowDialog] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<PdfTemplate | null>(null);

    // Form state
    const [formTitle, setFormTitle] = useState("");
    const [formFormat, setFormFormat] = useState("A4");
    const [formCategory, setFormCategory] = useState("Standardformater");
    const [formDescription, setFormDescription] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Fetch templates
    const fetchTemplates = useCallback(async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from("pdf_templates" as any)
                .select("*")
                .eq("scope_type", scopeType)
                .order("sort_order", { ascending: true });

            if (scopeType === "TENANT" && tenantId) {
                query = query.eq("tenant_id", tenantId);
            }

            const { data, error } = await query;

            if (error) throw error;
            setTemplates((data as unknown as PdfTemplate[]) || []);
        } catch (error) {
            console.error("Error fetching templates:", error);
            toast.error("Kunne ikke hente skabeloner");
        } finally {
            setIsLoading(false);
        }
    }, [scopeType, tenantId]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    // Reset form
    const resetForm = () => {
        setFormTitle("");
        setFormFormat("A4");
        setFormCategory("Standardformater");
        setFormDescription("");
        setSelectedFile(null);
        setEditingTemplate(null);
    };

    // Open dialog for new template
    const handleNewTemplate = () => {
        resetForm();
        setShowDialog(true);
    };

    // Open dialog for editing
    const handleEditTemplate = (template: PdfTemplate) => {
        setEditingTemplate(template);
        setFormTitle(template.title);
        setFormFormat(template.format_key);
        setFormCategory(template.category || "Standardformater");
        setFormDescription(template.description || "");
        setSelectedFile(null);
        setShowDialog(true);
    };

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== "application/pdf") {
                toast.error("Kun PDF-filer er tilladt");
                return;
            }
            setSelectedFile(file);
        }
    };

    // Upload file to storage
    const uploadFile = async (file: File): Promise<{ url: string; fileName: string }> => {
        const folder = scopeType === "MASTER" ? "master" : `tenant/${tenantId}`;
        const fileName = `${folder}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from("pdf-templates")
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from("pdf-templates")
            .getPublicUrl(fileName);

        return { url: publicUrl, fileName: file.name };
    };

    // Save template (create or update)
    const handleSaveTemplate = async () => {
        if (!formTitle.trim()) {
            toast.error("Titel er påkrævet");
            return;
        }

        if (!editingTemplate && !selectedFile) {
            toast.error("Vælg en PDF-fil");
            return;
        }

        setIsUploading(true);
        try {
            let fileUrl = editingTemplate?.file_url || "";
            let fileName = editingTemplate?.file_name || "";
            let fileSizeBytes = editingTemplate?.file_size_bytes || 0;

            // Upload new file if selected
            if (selectedFile) {
                const result = await uploadFile(selectedFile);
                fileUrl = result.url;
                fileName = result.fileName;
                fileSizeBytes = selectedFile.size;
            }

            const templateData = {
                scope_type: scopeType,
                tenant_id: scopeType === "TENANT" ? tenantId : null,
                title: formTitle,
                format_key: formFormat,
                category: formCategory,
                description: formDescription || null,
                file_name: fileName,
                file_url: fileUrl,
                file_size_bytes: fileSizeBytes,
            };

            if (editingTemplate) {
                // Update existing
                const { error } = await supabase
                    .from("pdf_templates" as any)
                    .update(templateData)
                    .eq("id", editingTemplate.id);

                if (error) throw error;
                toast.success("Skabelon opdateret");
            } else {
                // Create new
                const { error } = await supabase
                    .from("pdf_templates" as any)
                    .insert(templateData);

                if (error) throw error;
                toast.success("Skabelon oprettet");
            }

            setShowDialog(false);
            resetForm();
            fetchTemplates();
        } catch (error) {
            console.error("Error saving template:", error);
            toast.error("Kunne ikke gemme skabelon");
        } finally {
            setIsUploading(false);
        }
    };

    // Toggle published status
    const handleTogglePublished = async (template: PdfTemplate) => {
        try {
            const { error } = await supabase
                .from("pdf_templates" as any)
                .update({ is_published: !template.is_published })
                .eq("id", template.id);

            if (error) throw error;

            setTemplates((prev) =>
                prev.map((t) =>
                    t.id === template.id ? { ...t, is_published: !t.is_published } : t
                )
            );

            toast.success(
                template.is_published ? "Skabelon afpubliceret" : "Skabelon publiceret"
            );
        } catch (error) {
            console.error("Error toggling published:", error);
            toast.error("Kunne ikke ændre status");
        }
    };

    // Delete template
    const handleDeleteTemplate = async (template: PdfTemplate) => {
        if (!confirm("Er du sikker på at du vil slette denne skabelon?")) return;

        try {
            const { error } = await supabase
                .from("pdf_templates" as any)
                .delete()
                .eq("id", template.id);

            if (error) throw error;

            setTemplates((prev) => prev.filter((t) => t.id !== template.id));
            toast.success("Skabelon slettet");
        } catch (error) {
            console.error("Error deleting template:", error);
            toast.error("Kunne ikke slette skabelon");
        }
    };

    // Filter templates
    const filteredTemplates = templates.filter((t) => {
        const matchesSearch =
            t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.file_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFormat = filterFormat === "all" || t.format_key === filterFormat;
        return matchesSearch && matchesFormat;
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <FileText className="w-8 h-8" />
                        Skabeloner (PDF)
                    </h1>
                    <p className="text-muted-foreground">
                        {scopeType === "MASTER"
                            ? "Administrer globale PDF-skabeloner til alle lejere"
                            : "Administrer dine butiks PDF-skabeloner"}
                    </p>
                </div>

                <Dialog open={showDialog} onOpenChange={setShowDialog}>
                    <DialogTrigger asChild>
                        <Button onClick={handleNewTemplate} className="gap-2">
                            <Plus className="w-4 h-4" />
                            Ny Skabelon
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>
                                {editingTemplate ? "Rediger Skabelon" : "Ny Skabelon"}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Titel *</Label>
                                <Input
                                    value={formTitle}
                                    onChange={(e) => setFormTitle(e.target.value)}
                                    placeholder="F.eks. 'A4 Flyer – 3mm bleed'"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Format *</Label>
                                    <Select value={formFormat} onValueChange={setFormFormat}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FORMAT_OPTIONS.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Kategori</Label>
                                    <Select value={formCategory} onValueChange={setFormCategory}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORY_OPTIONS.map((cat) => (
                                                <SelectItem key={cat} value={cat}>
                                                    {cat}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Beskrivelse (valgfri)</Label>
                                <Textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="Kort vejledning til skabelonen..."
                                    rows={2}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>
                                    PDF-fil {editingTemplate ? "(valgfri - erstat eksisterende)" : "*"}
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="file"
                                        accept=".pdf,application/pdf"
                                        onChange={handleFileChange}
                                        className="flex-1"
                                    />
                                </div>
                                {selectedFile && (
                                    <p className="text-sm text-muted-foreground">
                                        Valgt: {selectedFile.name} (
                                        {(selectedFile.size / 1024).toFixed(1)} KB)
                                    </p>
                                )}
                                {editingTemplate && !selectedFile && (
                                    <p className="text-sm text-muted-foreground">
                                        Nuværende fil: {editingTemplate.file_name}
                                    </p>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowDialog(false)}
                            >
                                Annuller
                            </Button>
                            <Button onClick={handleSaveTemplate} disabled={isUploading}>
                                {isUploading && (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                )}
                                {editingTemplate ? "Gem Ændringer" : "Opret Skabelon"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
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
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Alle formater" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Alle formater</SelectItem>
                        {FORMAT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Templates Table */}
            {filteredTemplates.length === 0 ? (
                <Card className="p-12 text-center text-muted-foreground">
                    <FolderOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Ingen skabeloner endnu</p>
                    <p className="text-sm">Klik "Ny Skabelon" for at uploade din første PDF</p>
                </Card>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Titel</TableHead>
                                <TableHead>Format</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Filnavn</TableHead>
                                <TableHead className="text-center">Publiceret</TableHead>
                                <TableHead className="text-right">Handlinger</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTemplates.map((template) => (
                                <TableRow key={template.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <FileIcon className="w-4 h-4 text-red-500" />
                                            {template.title}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{template.format_key}</Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {template.category || "-"}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                                        {template.file_name}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Switch
                                            checked={template.is_published}
                                            onCheckedChange={() => handleTogglePublished(template)}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                asChild
                                            >
                                                <a
                                                    href={template.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    download
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEditTemplate(template)}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteTemplate(template)}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}

export default TemplatesManager;
