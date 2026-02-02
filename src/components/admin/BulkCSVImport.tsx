import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Download, AlertCircle, Loader2 } from "lucide-react";

interface BulkCSVImportProps {
  tableName: string;
  productSlug: string;
  productId?: string;
  onImportComplete: () => void;
}

export function BulkCSVImport({ tableName, productSlug, productId, onImportComplete }: BulkCSVImportProps) {
  const [importing, setImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTableConfig = (tableName: string) => {
    const configs: Record<string, { columns: string[], conflictKeys: string, template: string }> = {
      'folder_prices': {
        columns: ['format', 'paper', 'fold_type', 'quantity', 'price_dkk'],
        conflictKeys: 'format,paper,fold_type,quantity',
        template: `format,paper,fold_type,quantity,price_dkk
A5,135g,Midterfalset,250,350
A5,135g,Midterfalset,500,552
A5,170g,Rullefalset,1000,980
M65,250g,Zigzag,2000,1850`
      },
      'print_flyers': {
        columns: ['format', 'paper', 'quantity', 'list_price_dkk', 'price_dkk'],
        conflictKeys: 'format,paper,quantity',
        template: `format,paper,quantity,list_price_dkk,price_dkk
A5,130g,250,500,450
A5,130g,500,800,720
A4,170g,1000,1500,1350`
      },
      'visitkort_prices': {
        columns: ['paper', 'quantity', 'price_dkk'],
        conflictKeys: 'paper,quantity',
        template: `paper,quantity,price_dkk
300g mat,250,350
300g mat,500,550
400g blank,1000,900`
      },
      'poster_prices': {
        columns: ['format', 'paper', 'quantity', 'price_dkk'],
        conflictKeys: 'format,paper,quantity',
        template: `format,paper,quantity,price_dkk
A3,135g,10,250
A3,135g,25,450
A2,170g,50,850`
      },
      'poster_rates': {
        columns: ['paper', 'price_per_sqm'],
        conflictKeys: 'paper',
        template: `paper,price_per_sqm
135g,45
170g,55
250g,75`
      },
      'sticker_rates': {
        columns: ['format', 'material', 'quantity', 'price_dkk'],
        conflictKeys: 'format,material,quantity',
        template: `format,material,quantity,price_dkk
Standard,Vinyl,100,350
Standard,Vinyl,250,650
A4,Papir,500,850`
      },
      'sign_prices': {
        columns: ['material', 'from_sqm', 'to_sqm', 'price_per_sqm', 'discount_percent'],
        conflictKeys: 'material,from_sqm,to_sqm',
        template: `material,from_sqm,to_sqm,price_per_sqm,discount_percent
Akryl,0,1,450,0
Akryl,1,5,420,5
Dibond,0,2,380,0`
      },
      'sign_rates': {
        columns: ['material', 'price_per_sqm'],
        conflictKeys: 'material',
        template: `material,price_per_sqm
Akryl,450
Dibond,380
Aluminium,420`
      },
      'banner_prices': {
        columns: ['material', 'from_sqm', 'to_sqm', 'price_per_sqm', 'discount_percent'],
        conflictKeys: 'material,from_sqm,to_sqm',
        template: `material,from_sqm,to_sqm,price_per_sqm,discount_percent
PVC,0,5,85,0
PVC,5,20,80,5
Mesh,0,10,95,0`
      },
      'banner_rates': {
        columns: ['material', 'price_per_sqm'],
        conflictKeys: 'material',
        template: `material,price_per_sqm
PVC,85
Mesh,95
Vinyl,90`
      },
      'foil_prices': {
        columns: ['material', 'from_sqm', 'to_sqm', 'price_per_sqm', 'discount_percent'],
        conflictKeys: 'material,from_sqm,to_sqm',
        template: `material,from_sqm,to_sqm,price_per_sqm,discount_percent
Matt,0,2,120,0
Matt,2,10,115,5
Gloss,0,5,135,0`
      },
      'beachflag_prices': {
        columns: ['size', 'system', 'base_price'],
        conflictKeys: 'size,system',
        template: `size,system,base_price
S,Standard,850
M,Standard,1200
L,Premium,1850`
      },
      'booklet_rates': {
        columns: ['format', 'paper', 'pages', 'base_price', 'price_per_unit'],
        conflictKeys: 'format,paper,pages',
        template: `format,paper,pages,base_price,price_per_unit
A4,135g,8,500,2.5
A4,135g,16,800,3.0
A5,170g,24,1000,3.5`
      },
      'salesfolder_rates': {
        columns: ['format', 'paper', 'side_type', 'base_price', 'price_per_unit'],
        conflictKeys: 'format,paper,side_type',
        template: `format,paper,side_type,base_price,price_per_unit
A4,300g,2-sidet,600,4.0
A4,350g,4-sidet,900,5.5
A5,300g,2-sidet,500,3.5`
      },
      'generic_product_prices': {
        columns: ['variant_name', 'variant_value', 'quantity', 'price_dkk'],
        conflictKeys: 'product_id,variant_name,variant_value,quantity',
        template: `variant_name,variant_value,quantity,price_dkk
Model,T-Shirt Basic,10,450
Model,T-Shirt Basic,25,1125
Model,T-Shirt Premium,50,2950`
      }
    };

    return configs[tableName] || null;
  };

  const parseCSV = (csvText: string, columns: string[]): any[] => {
    const lines = csvText.trim().split(/\r\n|\n|\r/);
    const rows: any[] = [];
    const errors: string[] = [];

    // Detect delimiter from header (prefer semicolon if present)
    const delimiter = lines[0].indexOf(';') !== -1 ? ';' : ',';

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length < columns.length) {
        errors.push(`Række ${i + 1}: Ikke nok kolonner (forventet ${columns.length}, fandt ${values.length})`);
        continue;
      }

      const rowData: any = {};
      let hasError = false;

      columns.forEach((col, idx) => {
        const value = values[idx];

        // Type conversion based on column name
        if (col.includes('price') || col.includes('sqm') || col === 'quantity' || col.includes('percent')) {
          const numValue = parseFloat(value);
          if (isNaN(numValue)) {
            errors.push(`Række ${i + 1}: Ugyldig numerisk værdi for ${col} (${value})`);
            hasError = true;
          } else {
            rowData[col] = col === 'quantity' ? Math.floor(numValue) : numValue;
          }
        } else {
          if (!value) {
            errors.push(`Række ${i + 1}: Mangler værdi for ${col}`);
            hasError = true;
          }
          rowData[col] = value;
        }
      });

      if (!hasError) {
        rows.push(rowData);
      }
    }

    setValidationErrors(errors);
    return rows;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const config = getTableConfig(tableName);
    if (!config) {
      toast.error('Tabeltype ikke understøttet');
      return;
    }

    setValidationErrors([]);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvText = e.target?.result as string;
        const parsedRows = parseCSV(csvText, config.columns);

        if (validationErrors.length > 0) {
          toast.error(`Fandt ${validationErrors.length} valideringsfejl. Se detaljer nedenfor.`);
          return;
        }

        if (parsedRows.length === 0) {
          toast.error('Ingen gyldige rækker fundet i CSV-filen');
          return;
        }

        if (!confirm(`Importér ${parsedRows.length} priser? Dette vil opdatere eksisterende priser.`)) {
          return;
        }

        setImporting(true);

        // Inject product_id for generic pricing
        const rowsToInsert = tableName === 'generic_product_prices' && productId
          ? parsedRows.map(row => ({ ...row, product_id: productId }))
          : parsedRows;

        const { error } = await supabase
          .from(tableName as any)
          .upsert(
            rowsToInsert,
            {
              onConflict: config.conflictKeys,
              ignoreDuplicates: false
            }
          );

        if (error) throw error;

        toast.success(`Importerede ${parsedRows.length} priser`);
        onImportComplete();

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast.error('Kunne ikke importere CSV-fil');
      } finally {
        setImporting(false);
      }
    };

    reader.onerror = () => {
      toast.error('Kunne ikke læse fil');
      setImporting(false);
    };

    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const config = getTableConfig(tableName);
    if (!config) {
      toast.error('Tabeltype ikke understøttet');
      return;
    }

    const blob = new Blob([config.template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${productSlug}_import_template.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const config = getTableConfig(tableName);
  if (!config) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Bulk CSV Import</CardTitle>
        <CardDescription>
          Upload en CSV-fil for hurtigt at opdatere mange priser på én gang
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={downloadTemplate}
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Skabelon
          </Button>

          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
              disabled={importing}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="w-full"
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {importing ? 'Importerer...' : 'Upload CSV'}
            </Button>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>CSV-format:</strong> {config.columns.join(', ')}
            <br />
            Første række skal være overskrifter. Eksisterende priser med samme nøgle opdateres.
          </AlertDescription>
        </Alert>

        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Valideringsfejl ({validationErrors.length}):</strong>
              <ul className="mt-2 ml-4 list-disc text-sm">
                {validationErrors.slice(0, 10).map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
                {validationErrors.length > 10 && (
                  <li>...og {validationErrors.length - 10} flere</li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
