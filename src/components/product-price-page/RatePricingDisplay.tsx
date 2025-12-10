import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcPosterPrice, calcStickerPrice, calcSkiltePrice, posterRate, stickerRate, signRate } from "@/utils/productPricing";
import { ProductId } from "@/utils/productMetadata";

type RatePricingDisplayProps = {
  productId: ProductId;
  onPriceChange: (price: number) => void;
  initialFormat?: string;
  initialMaterial?: string;
  initialQuantity?: string;
};

const configs = {
  plakater: {
    formats: [
      { id: "A3", label: "A3 (297×420mm)", area: 0.125 },
      { id: "A2", label: "A2 (420×594mm)", area: 0.249 },
      { id: "A1", label: "A1 (594×841mm)", area: 0.499 },
      { id: "A0", label: "A0 (841×1189mm)", area: 1.000 },
    ],
    materials: [
      { id: "135g", label: "135g Silk", rate: posterRate["135g"] },
      { id: "170g", label: "170g Silk", rate: posterRate["170g"] },
      { id: "250g", label: "250g Silk", rate: posterRate["250g"] },
      { id: "115g", label: "115g Offset", rate: posterRate["115g"] },
    ],
    quantities: [1, 5, 10, 25, 50, 100],
  },
  klistermærker: {
    formats: [
      { id: "5x5", label: "5×5 cm", area: 25 },
      { id: "10x10", label: "10×10 cm", area: 100 },
      { id: "15x15", label: "15×15 cm", area: 225 },
      { id: "20x20", label: "20×20 cm", area: 400 },
    ],
    materials: [
      { id: "Vinyl", label: "Vinyl", rate: stickerRate["Vinyl"] },
      { id: "Plast", label: "Plast", rate: stickerRate["Plast"] },
      { id: "Papir", label: "Papir", rate: stickerRate["Papir"] },
    ],
    quantities: [100, 250, 500, 1000, 2500, 5000],
  },
  skilte: {
    formats: [
      { id: "A3", label: "A3 (29.7×42cm)", area: 0.125 },
      { id: "A2", label: "A2 (42×59.4cm)", area: 0.249 },
      { id: "A1", label: "A1 (59.4×84.1cm)", area: 0.499 },
      { id: "A0", label: "A0 (84.1×118.9cm)", area: 1.000 },
    ],
    materials: [
      { id: "PVC3", label: "PVC 3mm", rate: signRate["PVC3"] },
      { id: "PVC5", label: "PVC 5mm", rate: signRate["PVC5"] },
      { id: "Bølgeplast", label: "Bølgeplast", rate: signRate["Bølgeplast"] },
      { id: "Dibond", label: "Dibond", rate: signRate["Dibond"] },
    ],
    quantities: [1, 5, 10, 25, 50],
  },
};

export function RatePricingDisplay({ 
  productId, 
  onPriceChange,
  initialFormat,
  initialMaterial,
  initialQuantity
}: RatePricingDisplayProps) {
  const config = configs[productId as keyof typeof configs];
  const [selectedFormat, setSelectedFormat] = useState(
    initialFormat && config.formats.find(f => f.id === initialFormat) 
      ? initialFormat 
      : config.formats[0].id
  );
  const [selectedMaterial, setSelectedMaterial] = useState(
    initialMaterial && config.materials.find(m => m.id === initialMaterial)
      ? initialMaterial
      : config.materials[0].id
  );
  const [selectedQuantity, setSelectedQuantity] = useState(
    initialQuantity && config.quantities.includes(parseInt(initialQuantity))
      ? initialQuantity
      : config.quantities[0].toString()
  );

  useEffect(() => {
    const qty = parseInt(selectedQuantity);
    let price = 0;

    if (productId === "plakater") {
      price = calcPosterPrice(selectedFormat, selectedMaterial, qty);
    } else if (productId === "klistermærker") {
      price = calcStickerPrice(selectedFormat, selectedMaterial, qty);
    } else if (productId === "skilte") {
      price = calcSkiltePrice(selectedFormat, selectedMaterial, qty);
    }

    onPriceChange(price);
  }, [selectedFormat, selectedMaterial, selectedQuantity, productId, onPriceChange]);

  const selectedFormatData = config.formats.find(f => f.id === selectedFormat);
  const selectedMaterialData = config.materials.find(m => m.id === selectedMaterial);

  return (
    <div className="space-y-6">
      {/* Format Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Vælg format</Label>
        <div className="flex flex-wrap gap-2">
          {config.formats.map((format) => (
            <Button
              key={format.id}
              variant={selectedFormat === format.id ? "default" : "outline"}
              onClick={() => setSelectedFormat(format.id)}
              className="h-auto py-3 px-4"
            >
              {format.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Material Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Vælg materiale</Label>
        <div className="flex flex-wrap gap-2">
          {config.materials.map((material) => (
            <Button
              key={material.id}
              variant={selectedMaterial === material.id ? "default" : "outline"}
              onClick={() => setSelectedMaterial(material.id)}
              className="h-auto py-3 px-4"
            >
              {material.label}
              <span className="ml-2 text-xs opacity-70">
                ({material.rate} kr/{productId === "klistermærker" ? "cm²" : "m²"})
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Quantity Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">Vælg antal</Label>
        <Select value={selectedQuantity} onValueChange={setSelectedQuantity}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {config.quantities.map((qty) => (
              <SelectItem key={qty} value={qty.toString()}>
                {qty} stk
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calculation Breakdown */}
      <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm">
        <div className="font-semibold mb-2">Prisberegning:</div>
        <div>
          Format: {selectedFormatData?.label} 
          {productId === "klistermærker" 
            ? ` (${selectedFormatData?.area} cm²)`
            : ` (${selectedFormatData?.area} m²)`
          }
        </div>
        <div>
          Materiale: {selectedMaterialData?.label} 
          ({selectedMaterialData?.rate} kr/{productId === "klistermærker" ? "cm²" : "m²"})
        </div>
        <div>Antal: {selectedQuantity} stk</div>
      </div>
    </div>
  );
}
