import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X, Download, Save, Trash2, Copy, Upload, Edit2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRESET_QUANTITIES = [10, 25, 50, 100, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
const MAX_PREVIEW_ROWS = 500;
const OPLAG_STORAGE_KEY = 'product_oplag_';

interface OptionGroup {
    id: string;
    name: string;
    label: string;
}

interface ProductOption {
    id: string;
    group_id: string;
    name: string;
    label: string;
}

interface PriceListTemplate {
    id: string;
    name: string;
    spec: any;
    created_at: string;
    updated_at: string;
}

interface PriceListTemplateBuilderProps {
    productId: string;
    tenantId: string;
    groups: OptionGroup[];
    options: Record<string, ProductOption[]>;
}

export function PriceListTemplateBuilder({
    productId,
    tenantId,
    groups,
    options
}: PriceListTemplateBuilderProps) {
    // State
    const [selectedOplag, setSelectedOplag] = useState<number[]>([]);
    const [customOplag, setCustomOplag] = useState('');
    const [templates, setTemplates] = useState<PriceListTemplate[]>([]);
    const [templateName, setTemplateName] = useState('');
    const [editingTemplate, setEditingTemplate] = useState<PriceListTemplate | null>(null);
    const [loading, setLoading] = useState(false);

    // Load persisted oplag on mount
    useEffect(() => {
        const stored = localStorage.getItem(OPLAG_STORAGE_KEY + productId);
        if (stored) {
            try {
                setSelectedOplag(JSON.parse(stored));
            } catch { }
        }
        fetchTemplates();
    }, [productId]);

    // Persist oplag selection
    useEffect(() => {
        localStorage.setItem(OPLAG_STORAGE_KEY + productId, JSON.stringify(selectedOplag));
    }, [selectedOplag, productId]);

    // Fetch saved templates
    async function fetchTemplates() {
        const { data } = await supabase
            .from('price_list_templates' as any)
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });
        if (data) setTemplates(data as any);
    }

    // Toggle oplag selection
    const toggleOplag = (qty: number) => {
        setSelectedOplag(prev =>
            prev.includes(qty)
                ? prev.filter(q => q !== qty)
                : [...prev, qty].sort((a, b) => a - b)
        );
    };

    // Add custom oplag
    const addCustomOplag = () => {
        const qty = parseInt(customOplag);
        if (qty > 0 && !selectedOplag.includes(qty)) {
            setSelectedOplag(prev => [...prev, qty].sort((a, b) => a - b));
            setCustomOplag('');
        }
    };

    // Generate cartesian product for preview
    const previewData = useMemo(() => {
        if (groups.length === 0 || selectedOplag.length === 0) return { rows: [], overflow: false };

        // Get all values per group
        const groupValues = groups.map(g => options[g.id] || []);
        if (groupValues.some(gv => gv.length === 0)) return { rows: [], overflow: false };

        // Calculate total combinations
        const totalCombinations = groupValues.reduce((acc, gv) => acc * gv.length, 1);
        const overflow = totalCombinations > MAX_PREVIEW_ROWS;

        // Generate cartesian product
        const rows: { values: ProductOption[]; }[] = [];
        const indices = new Array(groupValues.length).fill(0);

        while (rows.length < MAX_PREVIEW_ROWS) {
            rows.push({ values: indices.map((idx, gi) => groupValues[gi][idx]) });

            // Increment indices
            let carry = 1;
            for (let i = indices.length - 1; i >= 0 && carry; i--) {
                indices[i] += carry;
                if (indices[i] >= groupValues[i].length) {
                    indices[i] = 0;
                } else {
                    carry = 0;
                }
            }
            if (carry) break; // All combinations exhausted
        }

        return { rows, overflow, total: totalCombinations };
    }, [groups, options, selectedOplag]);

    // Build spec from current state
    const buildSpec = () => ({
        oplag: selectedOplag,
        groups: groups.map(g => ({ id: g.id, name: g.name, label: g.label })),
        values: Object.fromEntries(
            groups.map(g => [g.id, (options[g.id] || []).map(v => ({ id: v.id, name: v.name, label: v.label }))])
        )
    });

    // Save template
    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            toast.error('Indtast et navn til skabelonen');
            return;
        }

        setLoading(true);
        try {
            const spec = buildSpec();
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('price_list_templates' as any)
                .insert({
                    tenant_id: tenantId,
                    product_id: productId,
                    name: templateName.trim(),
                    spec,
                    created_by: user?.id
                });

            if (error) throw error;
            toast.success('Skabelon gemt');
            setTemplateName('');
            fetchTemplates();
        } catch (e: any) {
            toast.error(e.message || 'Kunne ikke gemme skabelon');
        } finally {
            setLoading(false);
        }
    };

    // Load template
    const loadTemplate = (template: PriceListTemplate) => {
        if (template.spec?.oplag) {
            setSelectedOplag(template.spec.oplag);
        }
        toast.success(`Skabelon "${template.name}" indlæst`);
    };

    // Copy template
    const copyTemplate = async (template: PriceListTemplate) => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('price_list_templates' as any)
                .insert({
                    tenant_id: tenantId,
                    product_id: productId,
                    name: `${template.name} (kopi)`,
                    spec: template.spec,
                    created_by: user?.id
                });
            if (error) throw error;
            toast.success('Skabelon kopieret');
            fetchTemplates();
        } catch (e: any) {
            toast.error(e.message || 'Kunne ikke kopiere');
        } finally {
            setLoading(false);
        }
    };

    // Delete template
    const deleteTemplate = async (id: string) => {
        if (!confirm('Slet denne skabelon?')) return;
        const { error } = await supabase
            .from('price_list_templates' as any)
            .delete()
            .eq('id', id);
        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Skabelon slettet');
            fetchTemplates();
        }
    };

    // Update template
    const handleUpdateTemplate = async () => {
        if (!editingTemplate) return;
        setLoading(true);
        try {
            const spec = buildSpec();
            const { error } = await supabase
                .from('price_list_templates' as any)
                .update({ name: editingTemplate.name, spec, updated_at: new Date().toISOString() })
                .eq('id', editingTemplate.id);
            if (error) throw error;
            toast.success('Skabelon opdateret');
            setEditingTemplate(null);
            fetchTemplates();
        } catch (e: any) {
            toast.error(e.message || 'Kunne ikke opdatere');
        } finally {
            setLoading(false);
        }
    };

    // Export CSV
    const exportCSV = () => {
        if (previewData.rows.length === 0 || selectedOplag.length === 0) {
            toast.error('Ingen data at eksportere');
            return;
        }

        // Build header
        const headers = [...groups.map(g => g.label), ...selectedOplag.map(q => String(q))];

        // Build rows
        const csvRows = [headers.join(';')];
        for (const row of previewData.rows) {
            const cells = [
                ...row.values.map(v => v.label),
                ...selectedOplag.map(() => '') // Empty price cells
            ];
            csvRows.push(cells.join(';'));
        }

        // Download
        const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prisliste_tom_${productId.slice(0, 8)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('CSV eksporteret');
    };

    return (
        <div className="space-y-6">
            {/* Oplag Builder */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Oplag (mængder)</CardTitle>
                    <CardDescription>Vælg hvilke oplag/mængder der skal inkluderes i prislisten</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Preset chips */}
                    <div className="flex flex-wrap gap-2">
                        {PRESET_QUANTITIES.map(qty => (
                            <button
                                key={qty}
                                onClick={() => toggleOplag(qty)}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${selectedOplag.includes(qty)
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                    }`}
                            >
                                {qty.toLocaleString()}
                            </button>
                        ))}
                    </div>

                    {/* Custom input */}
                    <div className="flex gap-2 max-w-xs">
                        <Input
                            type="number"
                            placeholder="Brugerdefineret oplag"
                            value={customOplag}
                            onChange={(e) => setCustomOplag(e.target.value)}
                            className="h-9"
                            onKeyDown={(e) => e.key === 'Enter' && addCustomOplag()}
                        />
                        <Button size="sm" variant="outline" onClick={addCustomOplag}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Selected display */}
                    {selectedOplag.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {selectedOplag.map(qty => (
                                <Badge key={qty} variant="secondary" className="gap-1">
                                    {qty.toLocaleString()}
                                    <button onClick={() => toggleOplag(qty)} className="hover:text-destructive">
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Price List Preview */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Prisliste preview</CardTitle>
                    <CardDescription>
                        Forhåndsvisning af den tomme prisliste baseret på valgte grupper og oplag
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen grupper oprettet. Opret grupper ovenfor først.</p>
                    ) : selectedOplag.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Vælg mindst ét oplag ovenfor.</p>
                    ) : previewData.rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen værdier i grupperne. Tilføj værdier til grupperne først.</p>
                    ) : (
                        <>
                            {previewData.overflow && (
                                <div className="flex items-center gap-2 p-3 mb-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        Viser {MAX_PREVIEW_ROWS} af {previewData.total?.toLocaleString()} rækker. Eksportér for komplet liste.
                                    </p>
                                </div>
                            )}
                            <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {groups.map(g => (
                                                <TableHead key={g.id} className="bg-muted/50">{g.label}</TableHead>
                                            ))}
                                            {selectedOplag.map(qty => (
                                                <TableHead key={qty} className="text-right bg-muted/30">{qty.toLocaleString()}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.rows.slice(0, 50).map((row, i) => (
                                            <TableRow key={i}>
                                                {row.values.map((v, vi) => (
                                                    <TableCell key={vi} className="font-medium">{v.label}</TableCell>
                                                ))}
                                                {selectedOplag.map(qty => (
                                                    <TableCell key={qty} className="text-right text-muted-foreground">—</TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                        {previewData.rows.length > 50 && (
                                            <TableRow>
                                                <TableCell colSpan={groups.length + selectedOplag.length} className="text-center text-muted-foreground">
                                                    ... og {previewData.rows.length - 50} flere rækker
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                {previewData.rows.length} rækker × {selectedOplag.length} kolonner = {previewData.rows.length * selectedOplag.length} prisceller
                            </p>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Save & Export */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Gem & Eksportér</CardTitle>
                    <CardDescription>Gem skabelonen eller eksportér som tom CSV</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Skabelonnavn"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="max-w-xs"
                        />
                        <Button onClick={handleSaveTemplate} disabled={loading || !templateName.trim()}>
                            <Save className="h-4 w-4 mr-2" />
                            Gem skabelon
                        </Button>
                    </div>
                    <Button variant="outline" onClick={exportCSV} disabled={previewData.rows.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Eksportér tom CSV
                    </Button>
                </CardContent>
            </Card>

            {/* Template Bank */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Prisliste bank</CardTitle>
                    <CardDescription>Gemte prisliste-skabeloner for dette produkt</CardDescription>
                </CardHeader>
                <CardContent>
                    {templates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen gemte skabeloner endnu.</p>
                    ) : (
                        <div className="space-y-2">
                            {templates.map(t => (
                                <div key={t.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                    <div>
                                        <p className="font-medium">{t.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(t.created_at).toLocaleDateString('da-DK')} • {t.spec?.oplag?.length || 0} oplag
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => loadTemplate(t)}>
                                            <Upload className="h-4 w-4 mr-1" /> Indlæs
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => copyTemplate(t)}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingTemplate(t)}>
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Template Dialog */}
            <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Redigér skabelon</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>Navn</Label>
                            <Input
                                value={editingTemplate?.name || ''}
                                onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                            />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Skabelonen opdateres med de nuværende oplag og grupper fra builderen.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTemplate(null)}>Annuller</Button>
                        <Button onClick={handleUpdateTemplate} disabled={loading}>Opdatér</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
