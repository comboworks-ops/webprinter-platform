import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";

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
  const shopSettings = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const shouldReduceMotion = useReducedMotion();
  const activeBranding = (isPreviewMode && previewBranding) ? previewBranding : shopSettings.data?.branding;
  const opt = (activeBranding as any)?.productPage?.optionSelectors ?? {};
  const btnCfg = opt.button ?? {};
  const imgCfg = opt.image ?? {};
  const ddCfg = opt.dropdown ?? {};
  const cbCfg = opt.checkbox ?? {};
  const primaryColor = (activeBranding as any)?.colors?.primary || "#0EA5E9";

  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [options, setOptions] = useState<Record<string, ProductOption[]>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const hasEnhancedEffects = (cfg: Record<string, any>) => Boolean(
    cfg.surfaceStyle ||
    cfg.gradientStart ||
    cfg.gradientEnd ||
    cfg.innerShadow ||
    cfg.sheenColor ||
    cfg.shadow ||
    cfg.hoverShadow ||
    cfg.selectedShadow ||
    cfg.hoverScale ||
    cfg.hoverY ||
    cfg.tapScale ||
    cfg.transitionMs ||
    cfg.motionStyle
  );

  const resolveMotionProps = (cfg: Record<string, any>, selected = false) => {
    if (shouldReduceMotion || !hasEnhancedEffects(cfg)) return {};
    const hoverScale = Math.max(1, Math.min(1.08, Number(cfg.hoverScale) || 1.015));
    const hoverY = Math.max(-10, Math.min(0, Number(cfg.hoverY) || -1));
    const tapScale = Math.max(0.92, Math.min(1, Number(cfg.tapScale) || 0.98));
    const transitionMs = Math.max(80, Math.min(420, Number(cfg.transitionMs) || 170));
    const baseShadow = selected
      ? (cfg.selectedShadow || cfg.hoverShadow || cfg.shadow)
      : cfg.shadow;
    const hoverShadow = cfg.hoverShadow || baseShadow;

    return {
      whileHover: {
        scale: hoverScale,
        y: hoverY,
        boxShadow: hoverShadow,
      },
      whileTap: {
        scale: tapScale,
        y: 0,
        boxShadow: baseShadow,
      },
      transition: cfg.motionStyle === "elastic"
        ? { type: "spring" as const, stiffness: 360, damping: 22 }
        : { type: "tween" as const, duration: transitionMs / 1000, ease: "easeOut" as const },
    };
  };

  useEffect(() => {
    fetchOptions();
  }, [productId]);

  async function fetchOptions() {
    setLoading(true);

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

    const { data: groupsData } = await supabase
      .from('product_option_groups')
      .select('*')
      .in('id', groupIds);

    if (groupsData) {
      // Hide option groups auto-created by the POD2 tenant-import edge function.
      // These are identifiable by the `pod2_<productId>_<axis>` naming convention
      // set in supabase/functions/pod2-tenant-import/index.ts and would otherwise
      // render as required selectors below the matrix on the storefront.
      // Admin-configured option groups (non-POD) are unaffected.
      const visibleGroups = groupsData.filter(g => !g.name?.startsWith('pod2_'));
      const sortedGroups = visibleGroups.sort((a, b) => {
        const aOrder = assignments.find(x => x.option_group_id === a.id)?.sort_order || 0;
        const bOrder = assignments.find(x => x.option_group_id === b.id)?.sort_order || 0;
        return aOrder - bOrder;
      });
      setGroups(sortedGroups);

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
          initialSelections[group.id] = optionsData[0].id;
        }
      }
      setOptions(optionsMap);
      setSelections(initialSelections);

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

  // ─── Button pill renderer ─────────────────────────────────────────────────
  function renderButtons(group: OptionGroup) {
    const selectedRingColor = btnCfg.selectedRingColor || primaryColor;
    const borderRadius = `${btnCfg.borderRadius ?? 8}px`;
    const fontSize = `${btnCfg.fontSizePx ?? 14}px`;
    const padding = `${btnCfg.paddingPx ?? 12}px`;
    const borderWidth = btnCfg.borderWidth ?? 1;
    const borderColor = btnCfg.borderColor || "transparent";

    return (
      <div className="flex flex-wrap gap-2">
        {options[group.id]?.map(option => {
          const isSelected = selections[group.id] === option.id;
          const buttonStyle: React.CSSProperties = {
            borderRadius,
            fontSize,
            padding: `8px ${padding}`,
            borderWidth: borderWidth > 0 ? `${borderWidth}px` : undefined,
            borderStyle: borderWidth > 0 ? "solid" : undefined,
            borderColor: isSelected
              ? (btnCfg.selectedRingColor || primaryColor)
              : borderColor,
            backgroundColor: isSelected
              ? (btnCfg.selectedBgColor || primaryColor)
              : (btnCfg.bgColor || undefined),
            backgroundImage: hasEnhancedEffects(btnCfg) && btnCfg.surfaceStyle && !isSelected
              ? `linear-gradient(180deg, ${btnCfg.gradientStart || btnCfg.bgColor || "transparent"}, ${btnCfg.gradientEnd || btnCfg.bgColor || "transparent"})`
              : undefined,
            color: isSelected
              ? (btnCfg.selectedTextColor || "#ffffff")
              : (btnCfg.textColor || undefined),
            outline: isSelected
              ? `2px solid ${selectedRingColor}`
              : (btnCfg.hoverRingEnabled ? undefined : "none"),
            outlineOffset: "2px",
            transition: "all 150ms ease",
            boxShadow: hasEnhancedEffects(btnCfg)
              ? (isSelected
                ? [btnCfg.innerShadow, btnCfg.selectedShadow || btnCfg.hoverShadow || btnCfg.shadow].filter(Boolean).join(", ")
                : [btnCfg.innerShadow, btnCfg.shadow].filter(Boolean).join(", "))
              : undefined,
          };

          const btn = (
            <motion.button
              {...resolveMotionProps(btnCfg, isSelected)}
              key={option.id}
              onClick={() => handleSelect(group.id, option.id)}
              style={buttonStyle}
              className={cn(
                "inline-flex items-center justify-center font-medium transition-all",
                !isSelected && "hover:opacity-80",
                isSelected ? "shadow-md" : "shadow-sm bg-muted hover:shadow"
              )}
            >
              {option.label}
            </motion.button>
          );

          if (!option.description) return btn;
          return (
            <Popover key={option.id} open={isSelected}>
              <PopoverTrigger asChild>{btn}</PopoverTrigger>
              <PopoverContent
                className="max-w-xs"
                side="top"
                align="end"
                sideOffset={8}
              >
                <p className="text-sm">{option.description}</p>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    );
  }

  // ─── Image/icon grid renderer ─────────────────────────────────────────────
  function renderIconGrid(group: OptionGroup) {
    const sizePx = imgCfg.sizePx ?? 144;
    const borderRadius = `${imgCfg.borderRadius ?? 8}px`;
    const selectedRing = imgCfg.selectedRingColor || primaryColor;

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {options[group.id]?.map(option => {
          const isSelected = selections[group.id] === option.id;
          const cardStyle: React.CSSProperties = {
            borderRadius,
            backgroundColor: isSelected
              ? (imgCfg.selectedBgColor || undefined)
              : (imgCfg.bgColor || undefined),
            backgroundImage: hasEnhancedEffects(imgCfg) && imgCfg.surfaceStyle && !isSelected
              ? `linear-gradient(180deg, ${imgCfg.gradientStart || imgCfg.bgColor || "transparent"}, ${imgCfg.gradientEnd || imgCfg.bgColor || "transparent"})`
              : undefined,
            outline: isSelected ? `2px solid ${selectedRing}` : undefined,
            outlineOffset: "2px",
            boxShadow: hasEnhancedEffects(imgCfg)
              ? (isSelected
                ? [imgCfg.innerShadow, imgCfg.selectedShadow || imgCfg.hoverShadow || imgCfg.shadow].filter(Boolean).join(", ")
                : [imgCfg.innerShadow, imgCfg.shadow].filter(Boolean).join(", "))
              : undefined,
          };

          const inner = (
            <motion.button
              {...resolveMotionProps(imgCfg, isSelected)}
              key={option.id}
              onClick={() => handleSelect(group.id, option.id)}
              className={cn(
                "group flex flex-col items-center gap-2 p-2 shadow-sm transition-all",
                isSelected ? "shadow-md" : "bg-muted hover:shadow",
                imgCfg.hoverRingEnabled && !isSelected && "hover:outline hover:outline-2 hover:outline-offset-2"
              )}
              style={cardStyle}
            >
              {option.icon_url ? (
                <img
                  src={option.icon_url}
                  alt={option.label}
                  className="w-full object-contain transition-transform duration-150 group-hover:scale-[1.03]"
                  style={{ height: `${sizePx}px` }}
                />
              ) : (
                <div
                  className="w-full bg-muted rounded flex items-center justify-center text-muted-foreground text-xs"
                  style={{ height: `${sizePx}px` }}
                >
                  Intet ikon
                </div>
              )}
              <span
                className="text-sm font-medium text-center"
                style={{
                  color: imgCfg.labelColor || undefined,
                  fontSize: imgCfg.labelSizePx ? `${imgCfg.labelSizePx}px` : undefined,
                }}
              >
                {option.label}
              </span>
            </motion.button>
          );

          if (!option.description) return inner;
          return (
            <Popover key={option.id} open={isSelected}>
              <PopoverTrigger asChild>{inner}</PopoverTrigger>
              <PopoverContent className="max-w-xs" side="top" align="end" sideOffset={8}>
                <p className="text-sm">{option.description}</p>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    );
  }

  // ─── Dropdown renderer ────────────────────────────────────────────────────
  function renderDropdown(group: OptionGroup) {
    const triggerStyle: React.CSSProperties = {
      backgroundColor: ddCfg.bgColor || undefined,
      color: ddCfg.textColor || undefined,
      borderColor: ddCfg.borderColor || undefined,
      borderRadius: ddCfg.borderRadius ? `${ddCfg.borderRadius}px` : undefined,
    };
    return (
      <Select
        value={selections[group.id] || ""}
        onValueChange={(val) => handleSelect(group.id, val)}
      >
        <SelectTrigger className="w-full max-w-sm" style={triggerStyle}>
          <SelectValue placeholder="Vælg..." />
        </SelectTrigger>
        <SelectContent>
          {options[group.id]?.map(option => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
              {option.extra_price > 0 && (
                <span className="ml-2 text-muted-foreground text-xs">+{option.extra_price} kr.</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // ─── Checkbox renderer ────────────────────────────────────────────────────
  function renderCheckboxes(group: OptionGroup) {
    return (
      <div className="flex flex-col gap-2">
        {options[group.id]?.map(option => {
          const isSelected = selections[group.id] === option.id;
          return (
            <label
              key={option.id}
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => handleSelect(group.id, option.id)}
            >
              <span
                className={cn(
                  "flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-all",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground/40 group-hover:border-primary/60"
                )}
                style={{
                  borderColor: isSelected
                    ? (cbCfg.accentColor || primaryColor)
                    : undefined,
                  backgroundColor: isSelected
                    ? (cbCfg.accentColor || primaryColor)
                    : undefined,
                  borderRadius: `${cbCfg.checkboxRadius ?? 4}px`,
                }}
              >
                {isSelected && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </span>
              <span
                className="text-sm font-medium select-none"
                style={{
                  color: cbCfg.labelColor || undefined,
                  fontSize: cbCfg.labelSizePx ? `${cbCfg.labelSizePx}px` : undefined,
                }}
              >
                {option.label}
                {option.extra_price > 0 && (
                  <span className="ml-2 text-muted-foreground text-xs">+{option.extra_price} kr.</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-branding-id="productPage.optionSelectors">
      {groups.map(group => (
        <div key={group.id}>
          <label className="text-base font-semibold mb-3 block">{group.label}</label>

          {group.display_type === 'buttons' && renderButtons(group)}
          {group.display_type === 'icon_grid' && renderIconGrid(group)}
          {group.display_type === 'dropdown' && renderDropdown(group)}
          {group.display_type === 'checkboxes' && renderCheckboxes(group)}

          {group.description && (
            <p className="text-sm text-muted-foreground mt-3">{group.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
