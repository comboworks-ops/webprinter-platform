import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { calcBeachflagPrice, calcGenericPrice } from "@/utils/productPricing";
import { ProductId } from "@/utils/productMetadata";

type FixedPricingDisplayProps = {
  productId: ProductId;
  onPriceChange: (price: number) => void;
  initialFormat?: string;
  initialMaterial?: string;
  initialSystem?: string;
  initialAccessories?: string[];
  initialQuantity?: string;
};

const configs = {
  beachflag: {
    formats: [
      { id: "Lille", label: "Lille (290 cm)", price: 895 },
      { id: "Mellem", label: "Mellem (340 cm)", price: 1295 },
    ],
    systems: [
      { id: "Kun flag", label: "Kun flag" },
      { id: "Komplet", label: "Komplet system (+30%)" },
    ],
    accessories: [
      { id: "Grundplade", label: "Grundplade (+75 kr/stk)" },
      { id: "Jordbor", label: "Jordbor (+75 kr/stk)" },
      { id: "Vanddunk", label: "Vanddunk (+75 kr/stk)" },
    ],
    quantities: [1, 2, 5, 10, 20],
  },
  folie: {
    formats: [
      { id: "100x100", label: "100×100 cm", price: 180 },
      { id: "200x100", label: "200×100 cm", price: 360 },
      { id: "300x100", label: "300×100 cm", price: 540 },
    ],
    materials: [
      { id: "Mat", label: "Mat folie" },
      { id: "Glans", label: "Glans folie" },
    ],
    quantities: [1, 2, 5, 10, 20],
  },
  messeudstyr: {
    formats: [
      { id: "Rollup", label: "Roll-up 80×210", price: 895 },
      { id: "Disk", label: "Disk", price: 2495 },
      { id: "Messevæg", label: "Messevæg", price: 4995 },
    ],
    quantities: [1, 2, 5, 10],
  },
  displayplakater: {
    formats: [
      { id: "100x100", label: "100×100 cm", price: 295 },
      { id: "200x100", label: "200×100 cm", price: 495 },
      { id: "300x100", label: "300×100 cm", price: 695 },
    ],
    materials: [
      { id: "Papir", label: "Plakatpapir" },
      { id: "Backlit", label: "Backlit folie" },
      { id: "Tekstil", label: "Tekstilbanner" },
    ],
    quantities: [1, 2, 5, 10, 20],
  },
};

export function FixedPricingDisplay({ 
  productId, 
  onPriceChange,
  initialFormat,
  initialMaterial,
  initialSystem,
  initialAccessories,
  initialQuantity
}: FixedPricingDisplayProps) {
  const config = configs[productId as keyof typeof configs];
  const [selectedFormat, setSelectedFormat] = useState(
    initialFormat && config.formats.find(f => f.id === initialFormat)
      ? initialFormat
      : config.formats[0].id
  );
  const [selectedMaterial, setSelectedMaterial] = useState(
    ('materials' in config && initialMaterial && config.materials.find(m => m.id === initialMaterial))
      ? initialMaterial
      : ('materials' in config ? config.materials[0].id : undefined)
  );
  const [selectedSystem, setSelectedSystem] = useState(
    productId === "beachflag" && initialSystem && 'systems' in config && config.systems.find(s => s.id === initialSystem)
      ? initialSystem
      : (productId === "beachflag" ? "Kun flag" : undefined)
  );
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>(
    initialAccessories || []
  );
  const [selectedQuantity, setSelectedQuantity] = useState(
    initialQuantity && config.quantities.includes(parseInt(initialQuantity))
      ? initialQuantity
      : config.quantities[0].toString()
  );

  useEffect(() => {
    const qty = parseInt(selectedQuantity);
    let price = 0;

    if (productId === "beachflag") {
      price = calcBeachflagPrice(selectedFormat, selectedSystem!, selectedAccessories, qty);
    } else {
      const basePrice = config.formats.find(f => f.id === selectedFormat)?.price || 0;
      price = calcGenericPrice(qty, basePrice);
    }

    onPriceChange(price);
  }, [selectedFormat, selectedMaterial, selectedSystem, selectedAccessories, selectedQuantity, productId, onPriceChange, config.formats]);

  const handleAccessoryToggle = (accessoryId: string) => {
    setSelectedAccessories(prev =>
      prev.includes(accessoryId)
        ? prev.filter(a => a !== accessoryId)
        : [...prev, accessoryId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Format/Size Selection */}
      <div>
        <Label className="text-base font-semibold mb-3 block">
          {productId === "beachflag" ? "Vælg størrelse" : "Vælg type"}
        </Label>
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

      {/* Material Selection (if applicable) */}
      {'materials' in config && config.materials && (
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
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* System Selection (Beachflag only) */}
      {productId === "beachflag" && 'systems' in config && (
        <div>
          <Label className="text-base font-semibold mb-3 block">Vælg system</Label>
          <div className="flex flex-wrap gap-2">
            {config.systems.map((system) => (
              <Button
                key={system.id}
                variant={selectedSystem === system.id ? "default" : "outline"}
                onClick={() => setSelectedSystem(system.id)}
                className="h-auto py-3 px-4"
              >
                {system.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Accessories (Beachflag only) */}
      {productId === "beachflag" && 'accessories' in config && (
        <div>
          <Label className="text-base font-semibold mb-3 block">Tilbehør (valgfrit)</Label>
          <div className="space-y-3">
            {config.accessories.map((accessory) => (
              <div key={accessory.id} className="flex items-center space-x-2">
                <Checkbox
                  id={accessory.id}
                  checked={selectedAccessories.includes(accessory.id)}
                  onCheckedChange={() => handleAccessoryToggle(accessory.id)}
                />
                <label
                  htmlFor={accessory.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {accessory.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Specification Display */}
      <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-sm">
        <div className="font-semibold mb-2">Specifikationer:</div>
        <div>Type: {config.formats.find(f => f.id === selectedFormat)?.label}</div>
        {'materials' in config && config.materials && selectedMaterial && (
          <div>Materiale: {config.materials.find(m => m.id === selectedMaterial)?.label}</div>
        )}
        {productId === "beachflag" && selectedSystem && (
          <div>System: {'systems' in config && config.systems.find(s => s.id === selectedSystem)?.label}</div>
        )}
        {productId === "beachflag" && selectedAccessories.length > 0 && (
          <div>Tilbehør: {selectedAccessories.join(", ")}</div>
        )}
        <div>Antal: {selectedQuantity} stk</div>
      </div>
    </div>
  );
}
