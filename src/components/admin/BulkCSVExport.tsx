import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

interface BulkCSVExportProps {
  tableName: string;
  productSlug: string;
  productName: string;
  productId?: string;
}

export function BulkCSVExport({ tableName, productSlug, productName, productId }: BulkCSVExportProps) {
  const [exporting, setExporting] = useState(false);

  const formatCSVValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // Escape quotes and wrap in quotes if contains comma or quotes
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

  const handleExport = async () => {
    try {
      setExporting(true);

      let query = supabase
        .from(tableName as any)
        .select('*');

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

      // Build CSV content
      const header = columns.join(',');
      const rows = data.map(row =>
        columns.map(col => formatCSVValue(row[col])).join(',')
      );

      const csvContent = [header, ...rows].join('\n');

      // Create and download file
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

  return (
    <Button
      variant="outline"
      onClick={handleExport}
      disabled={exporting}
    >
      {exporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {exporting ? 'Eksporterer...' : 'Eksportér til CSV'}
    </Button>
  );
}
