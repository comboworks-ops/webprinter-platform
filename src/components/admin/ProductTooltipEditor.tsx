import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Info } from "lucide-react";

interface ProductTooltipEditorProps {
  productId: string;
  tooltipProduct: string | null;
  tooltipPrice: string | null;
  tooltipQuickTilbud: string | null;
  onUpdate: () => void;
}

export function ProductTooltipEditor({
  productId,
  tooltipProduct,
  tooltipPrice,
  tooltipQuickTilbud,
  onUpdate
}: ProductTooltipEditorProps) {
  const [productTooltip, setProductTooltip] = useState(tooltipProduct || "");
  const [priceTooltip, setPriceTooltip] = useState(tooltipPrice || "");
  const [quickTilbudTooltip, setQuickTilbudTooltip] = useState(tooltipQuickTilbud || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          tooltip_product: productTooltip || null,
          tooltip_price: priceTooltip || null,
          tooltip_quick_tilbud: quickTilbudTooltip || null
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Tooltips opdateret');
      onUpdate();
    } catch (error) {
      console.error('Error updating tooltips:', error);
      toast.error('Kunne ikke opdatere tooltips');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = 
    productTooltip !== (tooltipProduct || "") ||
    priceTooltip !== (tooltipPrice || "") ||
    quickTilbudTooltip !== (tooltipQuickTilbud || "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          Tooltips
        </CardTitle>
        <CardDescription>
          Tilføj hjælpetekster der vises når kunder holder musen over elementer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tooltip-product">Produkt tooltip</Label>
          <Input
            id="tooltip-product"
            value={productTooltip}
            onChange={(e) => setProductTooltip(e.target.value)}
            placeholder="F.eks. Klik for at se priser og bestille"
          />
          <p className="text-xs text-muted-foreground">
            Vises når kunden holder musen over produktkortet
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tooltip-price">Pris tooltip</Label>
          <Input
            id="tooltip-price"
            value={priceTooltip}
            onChange={(e) => setPriceTooltip(e.target.value)}
            placeholder="F.eks. Pris ekskl. moms"
          />
          <p className="text-xs text-muted-foreground">
            Vises når kunden holder musen over prisen
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tooltip-quick-tilbud">Quick-tilbud tooltip</Label>
          <Input
            id="tooltip-quick-tilbud"
            value={quickTilbudTooltip}
            onChange={(e) => setQuickTilbudTooltip(e.target.value)}
            placeholder="F.eks. Få et hurtigt tilbud på dette produkt"
          />
          <p className="text-xs text-muted-foreground">
            Vises når kunden holder musen over Quick-tilbud knappen
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Gem Tooltips
        </Button>
      </CardContent>
    </Card>
  );
}
