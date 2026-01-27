import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CustomDimensionsCalculatorProps = {
  onAreaChange: (area: number, width: number, height: number) => void;
  initialWidth?: number;
  initialHeight?: number;
};

export function CustomDimensionsCalculator({
  onAreaChange,
  initialWidth = 100,
  initialHeight = 100
}: CustomDimensionsCalculatorProps) {
  const [widthInput, setWidthInput] = useState(String(initialWidth));
  const [heightInput, setHeightInput] = useState(String(initialHeight));

  const width = parseFloat(widthInput) || 0;
  const height = parseFloat(heightInput) || 0;

  useEffect(() => {
    if (width > 0 && height > 0) {
      const areaM2 = (width / 100) * (height / 100); // Convert cm to m²
      onAreaChange(areaM2, width, height);
    }
  }, [width, height, onAreaChange]);

  const areaM2 = width > 0 && height > 0 ? (width / 100) * (height / 100) : 0;

  return (
    <div className="bg-muted/50 border rounded-lg p-6 mb-6">
      <h3 className="font-semibold mb-4">Din størrelse</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        <div className="space-y-2">
          <Label htmlFor="width">Bredde (cm)</Label>
          <Input
            id="width"
            type="number"
            min="0"
            max="5000"
            value={widthInput}
            onChange={(e) => setWidthInput(e.target.value)}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height">Højde (cm)</Label>
          <Input
            id="height"
            type="number"
            min="0"
            max="5000"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label>Beregnet areal</Label>
          <div className="h-10 flex items-center px-3 bg-primary/10 rounded-md border border-primary/20">
            <span className="font-semibold text-primary">{areaM2.toFixed(2)} m²</span>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Prisen beregnes automatisk baseret på din størrelse.
      </p>
    </div>
  );
}
