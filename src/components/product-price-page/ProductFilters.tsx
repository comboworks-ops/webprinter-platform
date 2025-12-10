import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ProductFiltersProps = {
  formats?: { id: string; label: string }[];
  extraOptions?: { id: string; label: string }[];
  selectedFormat?: string;
  selectedExtraOption?: string;
  onFormatChange?: (format: string) => void;
  onExtraOptionChange?: (option: string) => void;
  extraOptionsLabel?: string;
};

export function ProductFilters({
  formats,
  extraOptions,
  selectedFormat,
  selectedExtraOption,
  onFormatChange,
  onExtraOptionChange,
  extraOptionsLabel = "Vælg type"
}: ProductFiltersProps) {
  return (
    <div className="space-y-6">
      {/* Format selection */}
      {formats && formats.length > 1 && (
        <div>
          <Label className="text-base font-semibold mb-3 block">Vælg format</Label>
          <div className="flex flex-wrap gap-2">
            {formats.map((format) => (
              <Button
                key={format.id}
                variant={selectedFormat === format.id ? "default" : "outline"}
                onClick={() => onFormatChange?.(format.id)}
                className="h-auto py-3 px-4"
              >
                {format.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Extra options (fold types, page counts, etc) */}
      {extraOptions && extraOptions.length > 0 && (
        <div>
          <Label className="text-base font-semibold mb-3 block">{extraOptionsLabel}</Label>
          <div className="flex flex-wrap gap-2">
            {extraOptions.map((option) => (
              <Button
                key={option.id}
                variant={selectedExtraOption === option.id ? "default" : "outline"}
                onClick={() => onExtraOptionChange?.(option.id)}
                className="h-auto py-3 px-4"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
