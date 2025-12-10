import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type SkilteCustomDimensionsPricingProps = {
  onPriceChange: (price: number) => void;
  initialWidth?: string;
  initialHeight?: string;
  initialMaterial?: string;
};

type SignPrice = {
  from_sqm: number;
  to_sqm: number;
  price_per_sqm: number;
  discount_percent: number;
  material: string;
};

export function SkilteCustomDimensionsPricing({
  onPriceChange,
  initialWidth,
  initialHeight,
  initialMaterial
}: SkilteCustomDimensionsPricingProps) {
  const [width, setWidth] = useState(initialWidth || "100");
  const [height, setHeight] = useState(initialHeight || "100");
  const [selectedMaterial, setSelectedMaterial] = useState(initialMaterial || "");
  const [signPrices, setSignPrices] = useState<SignPrice[]>([]);
  const [materials, setMaterials] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    fetchSignPrices();
  }, []);

  const fetchSignPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('sign_prices')
        .select('*')
        .order('from_sqm');

      if (error) throw error;

      const priceData = data || [];
      setSignPrices(priceData);

      // Extract unique materials
      const uniqueMaterials = [...new Set(priceData.map(p => p.material))];
      const materialOptions = uniqueMaterials.map(m => ({ id: m, label: m }));
      setMaterials(materialOptions);

      // Set initial material if not set
      if (!initialMaterial && materialOptions.length > 0) {
        setSelectedMaterial(materialOptions[0].id);
      }
    } catch (error) {
      console.error('Error fetching sign prices:', error);
    }
  };

  useEffect(() => {
    if (!selectedMaterial) return;

    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;

    // Validate dimensions (in cm, max 5000x5000)
    if (w <= 0 || h <= 0 || w > 5000 || h > 5000) {
      onPriceChange(0);
      return;
    }

    const m2 = (w * h) / 10000;
    if (m2 > 50) {
      onPriceChange(0);
      return;
    }

    // Find the matching tier for this area and material
    const tier = signPrices.find(
      (p) => p.material === selectedMaterial && m2 >= p.from_sqm && m2 <= p.to_sqm
    );

    if (!tier) {
      onPriceChange(0);
      return;
    }

    // Calculate price: base price * area * (1 - discount%)
    const price = tier.price_per_sqm * m2 * (1 - tier.discount_percent / 100);
    onPriceChange(Math.round(price));
  }, [width, height, selectedMaterial, onPriceChange, signPrices]);

  const w = parseFloat(width) || 0;
  const h = parseFloat(height) || 0;
  const m2 = (w * h) / 10000;

  const getTierInfo = () => {
    const tier = signPrices.find(
      (p) => p.material === selectedMaterial && m2 >= p.from_sqm && m2 <= p.to_sqm
    );
    if (!tier) return "—";
    return `${tier.price_per_sqm} kr/m² (${tier.discount_percent}% rabat)`;
  };

  const isValid = w > 0 && h > 0 && w <= 5000 && h <= 5000 && m2 <= 50;

  return (
    <div className="space-y-6">
      {/* Dimensions Input */}
      <div>
        <h3 className="font-semibold mb-4">Din størrelse</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-base font-semibold mb-3 block">Bredde (cm)</Label>
            <Input
              type="number"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="100"
              min="1"
              max="5000"
              className="w-full"
            />
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
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Prisen beregnes automatisk baseret på din størrelse.
        </p>
      </div>

      {/* Material Selection */}
      {materials.length > 0 && (
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
      )}

      {/* Calculation Display */}
      <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm">
        <div className="font-semibold mb-2">Prisberegning:</div>
        <div>Størrelse: {width} × {height} cm</div>
        <div>Areal: {m2.toFixed(2)} m²</div>
        <div>Materiale: {materials.find(m => m.id === selectedMaterial)?.label || selectedMaterial}</div>
        <div>Pris: {getTierInfo()}</div>
        {!isValid && (w > 0 || h > 0) && (
          <div className="text-destructive mt-2">
            {m2 > 50 ? "Maksimalt areal er 50 m²" : "Ugyldige dimensioner"}
          </div>
        )}
      </div>

      {/* Info about available tiers */}
      {signPrices.length > 0 && selectedMaterial && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="font-semibold">Prisklasser ({selectedMaterial}):</div>
          {signPrices
            .filter(p => p.material === selectedMaterial)
            .map((tier, idx) => (
              <div key={idx}>
                • {tier.from_sqm}-{tier.to_sqm} m²: {tier.price_per_sqm} kr/m²
                {tier.discount_percent > 0 && ` (${tier.discount_percent}% rabat)`}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
