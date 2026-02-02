import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, FileDown, Loader2, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BulkCSVToolsProps {
    tableName: string;
    productSlug: string;
    productName: string;
    productId?: string;
    onImportComplete?: () => void;
}

export function BulkCSVTools({ tableName, productSlug, productName, productId, onImportComplete }: BulkCSVToolsProps) {
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);

    const formatCSVValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const getTableColumns = (tableName: string): string[] => {
        const columnMap: Record<string, string[]> = {
            'folder_prices': ['format', 'paper', 'fold_type', 'quantity', 'price_dkk'],
            'print_flyers': ['format', 'paper', 'quantity', 'list_price_dkk', 'price_dkk'],
            'visitkort_prices': ['paper', 'quantity', 'price_dkk'],
            'poster_prices': ['format', 'paper', 'quantity', 'price_dkk'],
            'poster_rates': ['paper', 'price_per_sqm'],
            'sticker_rates': ['format', 'material', 'quantity', 'price_dkk'],
            'sign_prices': ['material', 'from_sqm', 'to_sqm', 'price_per_sqm', 'discount_percent'],
            'sign_rates': ['material', 'price_per_sqm'],
            'banner_prices': ['material', 'from_sqm', 'to_sqm', 'price_per_sqm', 'discount_percent'],
            'banner_rates': ['material', 'price_per_sqm'],
            'foil_prices': ['material', 'from_sqm', 'to_sqm', 'price_per_sqm', 'discount_percent'],
            'beachflag_prices': ['size', 'system', 'base_price'],
            'booklet_rates': ['format', 'paper', 'pages', 'base_price', 'price_per_unit'],
            'salesfolder_rates': ['format', 'paper', 'side_type', 'base_price', 'price_per_unit'],
            'generic_product_prices': ['variant_name', 'variant_value', 'quantity', 'price_dkk']
        };
        return columnMap[tableName] || [];
    };

    const getExampleRow = (tableName: string): string => {
        const exampleMap: Record<string, string> = {
            'folder_prices': 'A4,Silk 170g,Rullefalset,100,299',
            'print_flyers': 'A5,Silk 170g,250,399,349',
            'visitkort_prices': 'Silk 350g,500,199',
            'poster_prices': 'A2,Silk 170g,10,149',
            'poster_rates': 'Silk 170g,45',
            'sticker_rates': 'A6,Vinyl,100,199',
            'sign_prices': 'Forex,0,1,350,0',
            'banner_prices': 'Mesh,0,5,89,0',
            'foil_prices': 'Standard,0,2,199,0',
            'beachflag_prices': 'Medium,Komplet,899',
            'booklet_rates': 'A5,Silk 170g,8,149,1.5',
            'salesfolder_rates': 'A4,Silk 300g,4-sidet,249,2',
            'generic_product_prices': 'Farve,Sort,100,299'
        };
        return exampleMap[tableName] || '';
    };

    // Download template with header + example row
    const handleDownloadTemplate = () => {
        const columns = getTableColumns(tableName);
        if (columns.length === 0) {
            toast.error('Tabelstruktur ikke understøttet');
            return;
        }

        const header = columns.join(',');
        const example = getExampleRow(tableName);
        const csvContent = example ? `${header}\n${example}` : header;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${productSlug}_skabelon.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        toast.success('Skabelon downloadet');
    };

    // Export existing data
    const handleExport = async () => {
        try {
            setExporting(true);

            let query = supabase.from(tableName as any).select('*');
            if (tableName === 'generic_product_prices' && productId) {
                query = query.eq('product_id', productId);
            }

            const { data, error } = await query.order('id', { ascending: true });
            if (error) throw error;

            if (!data || data.length === 0) {
                toast.error('Ingen data at eksportere');
                return;
            }

            const columns = getTableColumns(tableName);
            if (columns.length === 0) {
                toast.error('Tabelstruktur ikke understøttet');
                return;
            }

            const header = columns.join(',');
            const rows = data.map(row =>
                columns.map(col => formatCSVValue(row[col])).join(',')
            );

            const csvContent = [header, ...rows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${productSlug}_priser_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);

            toast.success(`Eksporterede ${data.length} priser`);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            toast.error('Kunne ikke eksportere priser');
        } finally {
            setExporting(false);
        }
    };

    // Import CSV
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const text = await file.text();
            const lines = text.trim().split('\n');

            if (lines.length < 2) {
                throw new Error('CSV skal indeholde mindst en header og en datarække');
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const columns = getTableColumns(tableName);

            // Validate headers
            const missingColumns = columns.filter(col => !headers.includes(col.toLowerCase()));
            if (missingColumns.length > 0) {
                throw new Error(`Manglende kolonner: ${missingColumns.join(', ')}`);
            }

            const rows = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                if (values.length < columns.length) continue;

                const row: Record<string, any> = {};
                columns.forEach((col, idx) => {
                    const headerIdx = headers.indexOf(col.toLowerCase());
                    if (headerIdx !== -1) {
                        let value: any = values[headerIdx]?.trim().replace(/^"|"$/g, '');
                        // Parse numbers
                        if (['quantity', 'price_dkk', 'list_price_dkk', 'price_per_sqm', 'base_price', 'price_per_unit', 'discount_percent', 'from_sqm', 'to_sqm', 'pages'].includes(col)) {
                            value = parseFloat(value) || 0;
                        }
                        row[col] = value;
                    }
                });

                if (productId && tableName === 'generic_product_prices') {
                    row.product_id = productId;
                }

                rows.push(row);
            }

            if (rows.length === 0) {
                throw new Error('Ingen gyldige rækker fundet i CSV');
            }

            const { error } = await supabase.from(tableName as any).insert(rows);
            if (error) throw error;

            toast.success(`Importerede ${rows.length} priser`);
            onImportComplete?.();
        } catch (error: any) {
            console.error('Error importing CSV:', error);
            toast.error(error.message || 'Kunne ikke importere priser');
        } finally {
            setImporting(false);
            e.target.value = '';
        }
    };

    const columns = getTableColumns(tableName);
    if (columns.length === 0) return null;

    return (
        <Card className="bg-muted/30">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            Masseimport og eksport
                            <Tooltip>
                                <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>Brug CSV til at importere eller eksportere mange priser på én gang. Åbn skabelonen i Excel, udfyld data, og importer filen tilbage.</p>
                                </TooltipContent>
                            </Tooltip>
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Håndter mange priser på én gang via CSV filer
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadTemplate}
                    >
                        <FileDown className="mr-2 h-4 w-4" />
                        Download skabelon
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        disabled={exporting}
                    >
                        {exporting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        Eksporter priser
                    </Button>

                    <div className="relative">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleImport}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            disabled={importing}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={importing}
                        >
                            {importing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Upload className="mr-2 h-4 w-4" />
                            )}
                            Importer CSV
                        </Button>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                    Kolonner: {columns.join(', ')}
                </p>
            </CardContent>
        </Card>
    );
}
