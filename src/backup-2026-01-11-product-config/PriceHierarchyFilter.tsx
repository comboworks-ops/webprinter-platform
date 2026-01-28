import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface PriceHierarchyFilterProps {
  prices: any[];
  productSlug: string;
  onFilterChange: (filteredPrices: any[]) => void;
}

type FilterLevel = {
  key: string;
  label: string;
  values: string[];
};

export function PriceHierarchyFilter({ prices, productSlug, onFilterChange }: PriceHierarchyFilterProps) {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});

  // Define hierarchy based on product type
  const hierarchy = useMemo((): FilterLevel[] => {
    switch (productSlug) {
      case 'flyers':
        return [
          { key: 'format', label: 'Format', values: [...new Set(prices.map(p => p.format))].sort() },
          { key: 'paper', label: 'Papir', values: [...new Set(prices.map(p => p.paper))].sort() },
        ];
      case 'foldere':
        return [
          { key: 'format', label: 'Format', values: [...new Set(prices.map(p => p.format))].sort() },
          { key: 'fold_type', label: 'Falsetype', values: [...new Set(prices.map(p => p.fold_type))].sort() },
          { key: 'paper', label: 'Papir', values: [...new Set(prices.map(p => p.paper))].sort() },
        ];
      case 'plakater':
        return [
          { key: 'format', label: 'Format', values: [...new Set(prices.map(p => p.format))].sort() },
          { key: 'paper', label: 'Papir', values: [...new Set(prices.map(p => p.paper))].sort() },
        ];
      case 'hæfter':
        return [
          { key: 'format', label: 'Format', values: [...new Set(prices.map(p => p.format))].sort() },
          { key: 'pages', label: 'Sider', values: [...new Set(prices.map(p => p.pages))].sort() },
          { key: 'paper', label: 'Papir', values: [...new Set(prices.map(p => p.paper))].sort() },
        ];
      case 'klistermærker':
        return [
          { key: 'format', label: 'Format', values: [...new Set(prices.map(p => p.format))].sort() },
          { key: 'material', label: 'Materiale', values: [...new Set(prices.map(p => p.material))].sort() },
        ];
      case 'visitkort':
        return [
          { key: 'paper', label: 'Papir', values: [...new Set(prices.map(p => p.paper))].sort() },
        ];
      case 'skilte':
      case 'bannere':
      case 'folie':
        return [
          { key: 'material', label: 'Materiale', values: [...new Set(prices.map(p => p.material))].sort() },
        ];
      case 'beachflag':
        return [
          { key: 'size', label: 'Størrelse', values: [...new Set(prices.map(p => p.size))].sort() },
          { key: 'system', label: 'System', values: [...new Set(prices.map(p => p.system))].sort() },
        ];
      case 'salgsmapper':
        return [
          { key: 'format', label: 'Format', values: [...new Set(prices.map(p => p.format))].sort() },
          { key: 'side_type', label: 'Sidetype', values: [...new Set(prices.map(p => p.side_type))].sort() },
          { key: 'paper', label: 'Papir', values: [...new Set(prices.map(p => p.paper))].sort() },
        ];
      default:
        // Dynamic filter generation for generic products or unlisted products
        if (prices.length === 0) return [];

        const filterLevels: FilterLevel[] = [];
        const samplePrice = prices[0];

        // Field mapping with Danish labels
        const fieldLabels: Record<string, string> = {
          'variant_name': 'Variant',
          'variant_value': 'Værdi',
          'format': 'Format',
          'paper': 'Papir',
          'material': 'Materiale',
          'size': 'Størrelse',
          'fold_type': 'Falsetype',
          'pages': 'Sider',
          'side_type': 'Sidetype',
          'system': 'System',
          'finish': 'Finish',
          'coating': 'Belægning',
          'color': 'Farve',
          'type': 'Type'
        };

        // Priority order for fields (most important first)
        const fieldPriority = [
          'format', 'size', 'material', 'paper', 'variant_name',
          'fold_type', 'pages', 'side_type', 'system', 'type',
          'finish', 'coating', 'color', 'variant_value'
        ];

        // Detect available fields and create filters
        for (const field of fieldPriority) {
          if (field in samplePrice && samplePrice[field] !== null && samplePrice[field] !== undefined) {
            const values = [...new Set(prices.map(p => p[field]).filter(v => v !== null && v !== undefined))];

            // Only add filter if there are multiple values or it's a key field
            if (values.length > 1 || ['format', 'material', 'paper', 'size'].includes(field)) {
              filterLevels.push({
                key: field,
                label: fieldLabels[field] || field.charAt(0).toUpperCase() + field.slice(1),
                values: values.map(String).sort()
              });
            }
          }
        }

        return filterLevels;
    }
  }, [prices, productSlug]);

  // Get available values for each level based on current selections
  const getAvailableValues = (levelIndex: number): string[] => {
    let filtered = [...prices];

    // Apply filters from previous levels
    for (let i = 0; i < levelIndex; i++) {
      const level = hierarchy[i];
      const selectedValue = selectedFilters[level.key];
      if (selectedValue) {
        filtered = filtered.filter(p => p[level.key] === selectedValue);
      }
    }

    const currentKey = hierarchy[levelIndex]?.key;
    if (!currentKey) return [];

    return [...new Set(filtered.map(p => p[currentKey]))].sort();
  };

  // Filter prices based on selections
  useEffect(() => {
    let filtered = [...prices];

    for (const level of hierarchy) {
      const selectedValue = selectedFilters[level.key];
      if (selectedValue) {
        filtered = filtered.filter(p => p[level.key] === selectedValue);
      }
    }

    onFilterChange(filtered);
  }, [selectedFilters, prices, hierarchy, onFilterChange]);

  const handleSelect = (key: string, value: string) => {
    const levelIndex = hierarchy.findIndex(h => h.key === key);

    // Clear all filters from this level onwards
    const newFilters: Record<string, string> = {};
    for (let i = 0; i < levelIndex; i++) {
      const levelKey = hierarchy[i].key;
      if (selectedFilters[levelKey]) {
        newFilters[levelKey] = selectedFilters[levelKey];
      }
    }

    // Toggle selection
    if (selectedFilters[key] === value) {
      // Deselect - don't add this level
    } else {
      newFilters[key] = value;
    }

    setSelectedFilters(newFilters);
  };

  const clearFilters = () => {
    setSelectedFilters({});
  };

  if (hierarchy.length === 0 || prices.length === 0) {
    return null;
  }

  // Get the current active level
  const getActiveLevel = (): number => {
    for (let i = 0; i < hierarchy.length; i++) {
      if (!selectedFilters[hierarchy[i].key]) {
        return i;
      }
    }
    return hierarchy.length; // All selected
  };

  const activeLevel = getActiveLevel();

  return (
    <div className="space-y-4 mb-6 p-4 bg-muted/50 rounded-lg">
      {/* Breadcrumb of selections */}
      {Object.keys(selectedFilters).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Valgt:</span>
          {hierarchy.map((level, index) => {
            const value = selectedFilters[level.key];
            if (!value) return null;
            return (
              <div key={level.key} className="flex items-center gap-1">
                {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => handleSelect(level.key, value)}
                >
                  {level.label}: {value} ✕
                </Badge>
              </div>
            );
          })}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
            Ryd alle
          </Button>
        </div>
      )}

      {/* Current level buttons */}
      {activeLevel < hierarchy.length && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Vælg {hierarchy[activeLevel].label}:
          </p>
          <div className="flex flex-wrap gap-2">
            {getAvailableValues(activeLevel).map((value) => (
              <Button
                key={value}
                variant={selectedFilters[hierarchy[activeLevel].key] === value ? "default" : "outline"}
                size="sm"
                onClick={() => handleSelect(hierarchy[activeLevel].key, value)}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Show count of filtered results */}
      <div className="text-sm text-muted-foreground">
        {Object.keys(selectedFilters).length === 0
          ? `${prices.length} priser i alt`
          : activeLevel === hierarchy.length
            ? "Viser alle priser for dette valg"
            : `Fortsæt med at vælge for at indsnævre`
        }
      </div>
    </div>
  );
}
