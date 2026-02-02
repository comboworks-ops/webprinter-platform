import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { calcBannerPrice } from "@/utils/productPricing";

type CustomDimensionsPricingProps = {
  onPriceChange: (price: number) => void;
  initialWidth?: string;
  initialHeight?: string;
  initialMaterial?: string;
};

const materials = [
  { id: "PVC", label: "PVC-banner" },
  { id: "Mesh", label: "Mesh-banner" },
  { id: "Tekstil", label: "Tekstil-banner" },
];

export function CustomDimensionsPricing({ 
  onPriceChange,
  initialWidth,
  initialHeight,
  initialMaterial
}: CustomDimensionsPricingProps) {
  const [width, setWidth] = useState(initialWidth || "200");
  const [height, setHeight] = useState(initialHeight || "100");
  const [selectedMaterial, setSelectedMaterial] = useState(
    initialMaterial && materials.find(m => m.id === initialMaterial)
      ? initialMaterial
      : "PVC"
  );

  useEffect(() => {
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    
    // Validate dimensions
    if (w <= 0 || h <= 0 || w > 5000 || h > 5000) {
      onPriceChange(0);
      return;
    }

    const m2 = (w * h) / 10000;
    if (m2 > 50) {
      onPriceChange(0);
      return;
    }

    const price = calcBannerPrice(w, h, selectedMaterial);
    onPriceChange(price);
  }, [width, height, selectedMaterial, onPriceChange]);

  const w = parseFloat(width) || 0;
  const h = parseFloat(height) || 0;
  const m2 = (w * h) / 10000;

  const getTierRate = () => {
    if (m2 > 0 && m2 <= 5) return "125 kr/m²";
    if (m2 <= 10) return "115 kr/m²";
    if (m2 <= 20) return "110 kr/m²";
    if (m2 <= 50) return "99 kr/m²";
    return "—";
  };

  const isValid = w > 0 && h > 0 && w <= 5000 && h <= 5000 && m2 <= 50;

  return (
    <div className="space-y-6">
      {/* Dimensions Input */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-base font-semibold mb-3 block">Længde (cm)</Label>
          <Input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="200"
            min="1"
            max="5000"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">Max 5000 cm</p>
        </div>
        <div>
          <Label className="text-base font-semibold mb-3 block">Højde (cm)</Label>
          <Input
            type="number"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            placeholder="100"
            min="1"
            max="5000"
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-1">Max 5000 cm</p>
        </div>
      </div>

      {/* Material Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Vælg materiale</Label>
        <div className="flex flex-wrap gap-2">
          {materials.map((material) => (
            <Button
              key={material.id}
              variant={selectedMaterial === material.id ? "default" : "outline"}
              onClick={() => setSelectedMaterial(material.id)}
              className="h-auto py-3 px-4"
            >
              {material.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Calculation Display */}
      <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm">
        <div className="font-semibold mb-2">Prisberegning:</div>
        <div>Størrelse: {width} × {height} cm</div>
        <div>Areal: {m2.toFixed(2)} m²</div>
        <div>Materiale: {materials.find(m => m.id === selectedMaterial)?.label}</div>
        <div>Pris pr. m²: {getTierRate()}</div>
        {!isValid && (w > 0 || h > 0) && (
          <div className="text-destructive mt-2">
            {m2 > 50 ? "Maksimalt areal er 50 m²" : "Ugyldige dimensioner"}
          </div>
        )}
      </div>

      {/* Info about tiered pricing */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div className="font-semibold">Prisklasser:</div>
        <div>• 0-5 m²: 125 kr/m²</div>
        <div>• 5-10 m²: 115 kr/m²</div>
        <div>• 10-20 m²: 110 kr/m²</div>
        <div>• 20-50 m²: 99 kr/m²</div>
      </div>
    </div>
  );
}
