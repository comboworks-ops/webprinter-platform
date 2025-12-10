import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface OptionGroup {
  id: string;
  name: string;
  label: string;
  display_type: string;
  description?: string | null;
}

interface ProductOption {
  id: string;
  group_id: string;
  name: string;
  label: string;
  description?: string | null;
  icon_url: string | null;
  extra_price: number;
  price_mode?: "fixed" | "per_quantity" | "per_area";
  sort_order: number;
}

interface DynamicProductOptionsProps {
  productId: string;
  onSelectionChange: (selections: Record<string, { optionId: string; name: string; extraPrice: number }>) => void;
}

export function DynamicProductOptions({ productId, onSelectionChange }: DynamicProductOptionsProps) {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [options, setOptions] = useState<Record<string, ProductOption[]>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOptions();
  }, [productId]);

  async function fetchOptions() {
    setLoading(true);

    // Fetch assigned groups for this product
    const { data: assignments } = await supabase
      .from('product_option_group_assignments')
      .select('option_group_id, sort_order')
      .eq('product_id', productId)
      .order('sort_order');

    if (!assignments || assignments.length === 0) {
      setLoading(false);
      return;
    }

    const groupIds = assignments.map(a => a.option_group_id);

    // Fetch groups
    const { data: groupsData } = await supabase
      .from('product_option_groups')
      .select('*')
      .in('id', groupIds);

    if (groupsData) {
      // Sort by assignment order
      const sortedGroups = groupsData.sort((a, b) => {
        const aOrder = assignments.find(x => x.option_group_id === a.id)?.sort_order || 0;
        const bOrder = assignments.find(x => x.option_group_id === b.id)?.sort_order || 0;
        return aOrder - bOrder;
      });
      setGroups(sortedGroups);

      // Fetch options for each group
      const optionsMap: Record<string, ProductOption[]> = {};
      const initialSelections: Record<string, string> = {};

      for (const group of sortedGroups) {
        const { data: optionsData } = await supabase
          .from('product_options')
          .select('*')
          .eq('group_id', group.id)
          .order('sort_order');

        if (optionsData && optionsData.length > 0) {
          optionsMap[group.id] = optionsData;
          // Select first option by default
          initialSelections[group.id] = optionsData[0].id;
        }
      }
      setOptions(optionsMap);
      setSelections(initialSelections);

      // Notify parent of initial selections
      const selectionDetails: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }> = {};
      for (const [groupId, optionId] of Object.entries(initialSelections)) {
        const option = optionsMap[groupId]?.find(o => o.id === optionId);
        if (option) {
          selectionDetails[groupId] = {
            optionId: option.id,
            name: option.label,
            extraPrice: option.extra_price,
            priceMode: option.price_mode || "fixed"
          };
        }
      }
      onSelectionChange(selectionDetails);
    }

    setLoading(false);
  }

  function handleSelect(groupId: string, optionId: string) {
    const newSelections = { ...selections, [groupId]: optionId };
    setSelections(newSelections);

    // Build selection details
    const selectionDetails: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }> = {};
    for (const [gId, oId] of Object.entries(newSelections)) {
      const option = options[gId]?.find(o => o.id === oId);
      if (option) {
        selectionDetails[gId] = {
          optionId: option.id,
          name: option.label,
          extraPrice: option.extra_price,
          priceMode: option.price_mode || "fixed"
        };
      }
    }
    onSelectionChange(selectionDetails);
  }

  if (loading || groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.id}>
          <label className="text-base font-semibold mb-3 block">{group.label}</label>

          {group.display_type === 'buttons' && (
            <div className="flex flex-wrap gap-2">
              {options[group.id]?.map(option => (
                option.description ? (
                  <Popover key={option.id} open={selections[group.id] === option.id}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        onClick={() => handleSelect(group.id, option.id)}
                        className={`h-auto py-3 px-4 border-none shadow-sm transition-all ${selections[group.id] === option.id
                          ? "bg-card shadow-md ring-2 ring-primary/20"
                          : "bg-muted hover:shadow"
                          }`}
                      >
                        {option.label}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="max-w-xs relative after:content-[''] after:absolute after:top-full after:right-4 after:border-8 after:border-transparent after:border-t-popover"
                      side="top"
                      align="end"
                      sideOffset={8}
                    >
                      <p className="text-sm">{option.description}</p>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Button
                    key={option.id}
                    variant="ghost"
                    onClick={() => handleSelect(group.id, option.id)}
                    className={`h-auto py-3 px-4 border-none shadow-sm transition-all ${selections[group.id] === option.id
                      ? "bg-card shadow-md ring-2 ring-primary/20"
                      : "bg-muted hover:shadow"
                      }`}
                  >
                    {option.label}
                  </Button>
                )
              ))}
            </div>
          )}

          {group.display_type === 'icon_grid' && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {options[group.id]?.map(option => (
                option.description ? (
                  <Popover key={option.id} open={selections[group.id] === option.id}>
                    <PopoverTrigger asChild>
                      <button
                        onClick={() => handleSelect(group.id, option.id)}
                        className={cn(
                          "flex flex-col items-center gap-3 p-2 rounded-lg border-none shadow-sm transition-all",
                          selections[group.id] === option.id
                            ? "bg-card shadow-md ring-2 ring-primary/20"
                            : "bg-muted hover:shadow"
                        )}
                      >
                        {option.icon_url ? (
                          <img
                            src={option.icon_url}
                            alt={option.label}
                            className="w-full h-36 object-contain"
                          />
                        ) : (
                          <div className="w-full h-36 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                            Intet ikon
                          </div>
                        )}
                        <span className="text-sm font-medium text-center">{option.label}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="max-w-xs relative after:content-[''] after:absolute after:top-full after:right-4 after:border-8 after:border-transparent after:border-t-popover"
                      side="top"
                      align="end"
                      sideOffset={8}
                    >
                      <p className="text-sm">{option.description}</p>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(group.id, option.id)}
                    className={cn(
                      "flex flex-col items-center gap-3 p-2 rounded-lg border-none shadow-sm transition-all",
                      selections[group.id] === option.id
                        ? "bg-card shadow-md ring-2 ring-primary/20"
                        : "bg-muted hover:shadow"
                    )}
                  >
                    {option.icon_url ? (
                      <img
                        src={option.icon_url}
                        alt={option.label}
                        className="w-full h-36 object-contain"
                      />
                    ) : (
                      <div className="w-full h-36 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
                        Intet ikon
                      </div>
                    )}
                    <span className="text-sm font-medium text-center">{option.label}</span>
                  </button>
                )
              ))}
            </div>
          )}

          {group.description && (
            <p className="text-sm text-muted-foreground mt-3">{group.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
