import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

interface BannerConfig {
  widthFrom?: number;
  widthTo?: number;
  heightFrom?: number;
  heightTo?: number;
  basePrice?: number;
  calcMode?: "per_m2" | "range_price";
  adjustmentPercent?: number;
  defaultWidth?: number;
  defaultHeight?: number;
}

interface BannerConfigEditorProps {
  productId: string;
  bannerConfig: BannerConfig | null;
  onUpdate: () => void;
}

export function BannerConfigEditor({
  productId,
  bannerConfig,
  onUpdate
}: BannerConfigEditorProps) {
  const [config, setConfig] = useState<BannerConfig>(bannerConfig || {
    calcMode: "per_m2",
    adjustmentPercent: 0
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          banner_config: config as any
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Banner konfiguration opdateret');
      onUpdate();
    } catch (error) {
      console.error('Error updating banner config:', error);
      toast.error('Kunne ikke opdatere banner konfiguration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof BannerConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Banner Dimensions Konfiguration</CardTitle>
        <CardDescription>
          Indstil pris beregning for brugerdefinerede banner dimensioner
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="width-from">Bredde Fra (mm)</Label>
            <Input
              id="width-from"
              type="number"
              value={config.widthFrom || ""}
              onChange={(e) => updateConfig("widthFrom", parseFloat(e.target.value))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="width-to">Bredde Til (mm)</Label>
            <Input
              id="width-to"
              type="number"
              value={config.widthTo || ""}
              onChange={(e) => updateConfig("widthTo", parseFloat(e.target.value))}
              placeholder="5000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height-from">Højde Fra (mm)</Label>
            <Input
              id="height-from"
              type="number"
              value={config.heightFrom || ""}
              onChange={(e) => updateConfig("heightFrom", parseFloat(e.target.value))}
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height-to">Højde Til (mm)</Label>
            <Input
              id="height-to"
              type="number"
              value={config.heightTo || ""}
              onChange={(e) => updateConfig("heightTo", parseFloat(e.target.value))}
              placeholder="5000"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="calc-mode">Beregningsmetode</Label>
          <Select 
            value={config.calcMode || "per_m2"} 
            onValueChange={(value) => updateConfig("calcMode", value)}
          >
            <SelectTrigger id="calc-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_m2">Per m² (dynamisk)</SelectItem>
              <SelectItem value="range_price">Fast pris for område</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="base-price">
            {config.calcMode === "per_m2" ? "Basispris per m² (DKK)" : "Fast pris (DKK)"}
          </Label>
          <Input
            id="base-price"
            type="number"
            step="0.01"
            value={config.basePrice || ""}
            onChange={(e) => updateConfig("basePrice", parseFloat(e.target.value))}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="adjustment">Justering (%)</Label>
          <Input
            id="adjustment"
            type="number"
            step="0.1"
            value={config.adjustmentPercent || 0}
            onChange={(e) => updateConfig("adjustmentPercent", parseFloat(e.target.value))}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Tillæg eller rabat på den beregnede pris (f.eks. 10 for +10%, -5 for -5%)
          </p>
        </div>

        <div className="border-t pt-4 space-y-4">
          <h4 className="font-medium">Standard dimensioner for forside</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-width">Standard bredde (mm)</Label>
              <Input
                id="default-width"
                type="number"
                value={config.defaultWidth || ""}
                onChange={(e) => updateConfig("defaultWidth", parseFloat(e.target.value))}
                placeholder="1000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-height">Standard højde (mm)</Label>
              <Input
                id="default-height"
                type="number"
                value={config.defaultHeight || ""}
                onChange={(e) => updateConfig("defaultHeight", parseFloat(e.target.value))}
                placeholder="2000"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Disse dimensioner bruges til at beregne prisen på forsiden
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Gem Banner Konfiguration
        </Button>
      </CardContent>
    </Card>
  );
}
