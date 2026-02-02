import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

interface MatrixDefaultSelectorProps {
  productId: string;
  productSlug: string;
  defaultVariant: string | null;
  defaultQuantity: number | null;
  onUpdate: () => void;
}

export function MatrixDefaultSelector({
  productId,
  productSlug,
  defaultVariant,
  defaultQuantity,
  onUpdate
}: MatrixDefaultSelectorProps) {
  const [variants, setVariants] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<number[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(defaultVariant || "");
  const [selectedQuantity, setSelectedQuantity] = useState(defaultQuantity?.toString() || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMatrixOptions();
  }, [productSlug]);

  const fetchMatrixOptions = async () => {
    try {
      setLoading(true);
      let tableName = "";
      
      if (productSlug === "flyers") tableName = "print_flyers";
      else if (productSlug === "foldere") tableName = "folder_prices";
      else if (productSlug === "visitkort") tableName = "visitkort_prices";
      
      if (!tableName) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from(tableName as any)
        .select('paper, quantity')
        .order('paper')
        .order('quantity');

      if (error) throw error;

      if (data) {
        // Extract unique variants and quantities
        const uniqueVariants = [...new Set(data.map((row: any) => row.paper))];
        const uniqueQuantities = [...new Set(data.map((row: any) => row.quantity))].sort((a: any, b: any) => a - b);
        
        setVariants(uniqueVariants as string[]);
        setQuantities(uniqueQuantities as number[]);
      }
    } catch (error) {
      console.error('Error fetching matrix options:', error);
      toast.error('Kunne ikke hente matrix muligheder');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          default_variant: selectedVariant || null,
          default_quantity: selectedQuantity ? parseInt(selectedQuantity) : null
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Standard valg opdateret');
      onUpdate();
    } catch (error) {
      console.error('Error updating defaults:', error);
      toast.error('Kunne ikke opdatere standard valg');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = 
    selectedVariant !== (defaultVariant || "") ||
    selectedQuantity !== (defaultQuantity?.toString() || "");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (variants.length === 0) {
    return null; // Don't show if not a matrix product
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Standard Matrix Valg</CardTitle>
        <CardDescription>
          Vælg hvilket papir og antal der skal vises som standard pris på forsiden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="default-variant">Papir/Variant</Label>
            <Select value={selectedVariant} onValueChange={setSelectedVariant}>
              <SelectTrigger id="default-variant">
                <SelectValue placeholder="Vælg papir" />
              </SelectTrigger>
              <SelectContent>
                {variants.map((variant) => (
                  <SelectItem key={variant} value={variant}>
                    {variant}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-quantity">Antal</Label>
            <Select value={selectedQuantity} onValueChange={setSelectedQuantity}>
              <SelectTrigger id="default-quantity">
                <SelectValue placeholder="Vælg antal" />
              </SelectTrigger>
              <SelectContent>
                {quantities.map((qty) => (
                  <SelectItem key={qty} value={qty.toString()}>
                    {qty} stk
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || !selectedVariant || !selectedQuantity || saving}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Gem Standard Valg
        </Button>
      </CardContent>
    </Card>
  );
}
