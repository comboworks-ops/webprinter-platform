import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcHaeftePrice, calcSalgsmappePrice } from "@/utils/productPricing";
import { ProductId } from "@/utils/productMetadata";

type FormulaPricingDisplayProps = {
  productId: ProductId;
  onPriceChange: (price: number) => void;
  initialFormat?: string;
  initialMaterial?: string;
  initialExtra?: string;
  initialQuantity?: string;
};

const configs = {
  hæfter: {
    formats: [
      { id: "A6", label: "A6" },
      { id: "A5", label: "A5" },
      { id: "A4", label: "A4" },
    ],
    materials: [
      { id: "135g", label: "135g" },
      { id: "170g", label: "170g" },
      { id: "250g", label: "250g" },
    ],
    extraOptions: [
      { id: "8", label: "8 sider" },
      { id: "16", label: "16 sider" },
      { id: "24", label: "24 sider" },
      { id: "32", label: "32 sider" },
    ],
    quantities: [100, 250, 500, 1000, 2500, 5000, 10000],
  },
  salgsmapper: {
    formats: [
      { id: "M65", label: "M65", base: 875 },
      { id: "A5", label: "A5", base: 995 },
      { id: "A4", label: "A4", base: 1495 },
    ],
    materials: [
      { id: "250g", label: "250g", factor: 1.00 },
      { id: "350g", label: "350g", factor: 1.10 },
      { id: "Matsilk", label: "Matsilk", factor: 1.05 },
    ],
    extraOptions: [
      { id: "Kun front", label: "Kun front", factor: 1.00 },
      { id: "Front+Inderside", label: "Front+Inderside", factor: 1.25 },
    ],
    quantities: [50, 100, 250, 500, 1000],
  },
};

export function FormulaPricingDisplay({ 
  productId, 
  onPriceChange,
  initialFormat,
  initialMaterial,
  initialExtra,
  initialQuantity
}: FormulaPricingDisplayProps) {
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
  const [selectedExtra, setSelectedExtra] = useState(
    initialExtra && config.extraOptions.find(o => o.id === initialExtra)
      ? initialExtra
      : config.extraOptions[0].id
  );
  const [selectedQuantity, setSelectedQuantity] = useState(
    initialQuantity && config.quantities.includes(parseInt(initialQuantity))
      ? initialQuantity
      : config.quantities[0].toString()
  );

  useEffect(() => {
    const qty = parseInt(selectedQuantity);
    let price = 0;

    if (productId === "hæfter") {
      price = calcHaeftePrice(selectedFormat, selectedMaterial, selectedExtra, qty);
    } else if (productId === "salgsmapper") {
      price = calcSalgsmappePrice(selectedFormat, selectedMaterial, selectedExtra, qty);
    }

    onPriceChange(price);
  }, [selectedFormat, selectedMaterial, selectedExtra, selectedQuantity, productId, onPriceChange]);

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
        <Label className="text-base font-semibold mb-3 block">
          {productId === "hæfter" ? "Vælg papir" : "Vælg papirkvalitet"}
        </Label>
        <div className="flex flex-wrap gap-2">
          {config.materials.map((material) => (
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

      {/* Extra Options */}
      <div>
        <Label className="text-base font-semibold mb-3 block">
          {productId === "hæfter" ? "Vælg sidetal" : "Vælg tryk"}
        </Label>
        <div className="flex flex-wrap gap-2">
          {config.extraOptions.map((option) => (
            <Button
              key={option.id}
              variant={selectedExtra === option.id ? "default" : "outline"}
              onClick={() => setSelectedExtra(option.id)}
              className="h-auto py-3 px-4"
            >
              {option.label}
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
        <div className="font-semibold mb-2">Specifikationer:</div>
        <div>Format: {config.formats.find(f => f.id === selectedFormat)?.label}</div>
        <div>Materiale: {config.materials.find(m => m.id === selectedMaterial)?.label}</div>
        <div>
          {productId === "hæfter" ? "Sidetal" : "Tryk"}: 
          {" "}{config.extraOptions.find(o => o.id === selectedExtra)?.label}
        </div>
        <div>Antal: {selectedQuantity} stk</div>
      </div>
    </div>
  );
}
