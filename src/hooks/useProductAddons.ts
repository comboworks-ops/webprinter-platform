/**
 * Hook for managing product add-on imports and overrides
 *
 * Handles importing library add-ons into products and managing per-product overrides.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ProductAddonImport,
  ProductAddonImportInput,
  ProductAddonItemOverride,
  ProductAddonItemOverrideInput,
  ResolvedAddonGroup,
  ResolvedAddonItem,
  AddonLibraryGroup,
  AddonLibraryItem,
  AddonLibraryPriceTier,
  AddonLibraryFixedPrice,
  AddonPricingMode,
} from '@/lib/addon-library/types';

interface UseProductAddonsOptions {
  productId: string;
  tenantId?: string;
}

export function useProductAddons({ productId, tenantId }: UseProductAddonsOptions) {
  const [imports, setImports] = useState<ProductAddonImport[]>([]);
  const [overrides, setOverrides] = useState<ProductAddonItemOverride[]>([]);
  const [resolvedGroups, setResolvedGroups] = useState<ResolvedAddonGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // ==========================================================================
  // Fetch imports and overrides for this product
  // ==========================================================================
  const fetchImports = useCallback(async () => {
    if (!productId) return;

    try {
      setLoading(true);

      // Fetch imports
      const { data: importsData, error: importsError } = await supabase
        .from('product_addon_imports' as any)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');

      if (importsError) throw importsError;

      // Fetch overrides
      const { data: overridesData, error: overridesError } = await supabase
        .from('product_addon_item_overrides' as any)
        .select('*')
        .eq('product_id', productId);

      if (overridesError) throw overridesError;

      setImports((importsData || []) as ProductAddonImport[]);
      setOverrides((overridesData || []) as ProductAddonItemOverride[]);
    } catch (error) {
      console.error('Error fetching product addon imports:', error);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  // ==========================================================================
  // Fetch fully resolved add-ons for customer display
  // ==========================================================================
  const fetchResolvedAddons = useCallback(async (): Promise<ResolvedAddonGroup[]> => {
    if (!productId) return [];

    try {
      // 1. Fetch imports for this product
      const { data: importsData, error: importsError } = await supabase
        .from('product_addon_imports' as any)
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');

      if (importsError) throw importsError;
      if (!importsData || importsData.length === 0) return [];

      const importsList = importsData as ProductAddonImport[];
      const groupIds = importsList.map((i) => i.addon_group_id);

      // 2. Fetch library groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('addon_library_groups' as any)
        .select('*')
        .in('id', groupIds);

      if (groupsError) throw groupsError;

      // 3. Fetch library items for these groups
      const { data: itemsData, error: itemsError } = await supabase
        .from('addon_library_items' as any)
        .select('*')
        .in('group_id', groupIds)
        .eq('enabled', true)
        .order('sort_order');

      if (itemsError) throw itemsError;

      // 4. Fetch overrides for this product
      const { data: overridesData, error: overridesError } = await supabase
        .from('product_addon_item_overrides' as any)
        .select('*')
        .eq('product_id', productId);

      if (overridesError) throw overridesError;

      // 5. Build override map
      const overrideMap: Record<string, ProductAddonItemOverride> = {};
      (overridesData || []).forEach((o: any) => {
        overrideMap[o.addon_item_id] = o as ProductAddonItemOverride;
      });

      // 6. Build resolved groups
      const resolved: ResolvedAddonGroup[] = importsList.map((imp) => {
        const group = (groupsData || []).find((g: any) => g.id === imp.addon_group_id) as AddonLibraryGroup | undefined;
        if (!group) return null;

        const groupItems = (itemsData || []).filter((i: any) => i.group_id === group.id) as AddonLibraryItem[];

        const resolvedItems: ResolvedAddonItem[] = groupItems
          .map((item) => {
            const override = overrideMap[item.id];

            // Skip if disabled via override
            if (override && !override.is_enabled) return null;

            return {
              id: item.id,
              group_id: item.group_id,
              name: item.name,
              display_label: item.display_label,
              description: item.description,
              icon_url: item.icon_url,
              thumbnail_url: item.thumbnail_url,
              pricing_mode: (override?.override_pricing_mode || item.pricing_mode) as AddonPricingMode,
              base_price: override?.override_price ?? item.base_price,
              markup_pct: override?.override_markup_pct ?? item.markup_pct,
              sort_order: override?.override_sort_order ?? item.sort_order,
              enabled: true,
              is_from_library: true as const,
              library_item_id: item.id,
              has_override: !!override,
            };
          })
          .filter(Boolean) as ResolvedAddonItem[];

        // Sort by sort_order
        resolvedItems.sort((a, b) => a.sort_order - b.sort_order);

        return {
          id: `import-${imp.id}`,
          name: group.name,
          display_label: imp.override_label || group.display_label,
          description: group.description,
          category: group.category,
          display_type: imp.override_display_type || group.display_type,
          sort_order: imp.sort_order,
          is_required: imp.is_required,
          is_from_library: true as const,
          library_group_id: group.id,
          import_mode: imp.import_mode,
          items: resolvedItems,
        } as ResolvedAddonGroup;
      }).filter(Boolean) as ResolvedAddonGroup[];

      // Sort by import sort_order
      resolved.sort((a, b) => a.sort_order - b.sort_order);

      setResolvedGroups(resolved);
      return resolved;
    } catch (error) {
      console.error('Error fetching resolved addons:', error);
      return [];
    }
  }, [productId]);

  // ==========================================================================
  // Import a library group into this product
  // ==========================================================================
  const importGroup = async (data: Omit<ProductAddonImportInput, 'product_id'>): Promise<ProductAddonImport | null> => {
    if (!productId || !tenantId) return null;

    try {
      const { data: newImport, error } = await supabase
        .from('product_addon_imports' as any)
        .insert({
          tenant_id: tenantId,
          product_id: productId,
          addon_group_id: data.addon_group_id,
          import_mode: data.import_mode || 'reference',
          override_label: data.override_label || null,
          override_display_type: data.override_display_type || null,
          is_required: data.is_required ?? false,
          sort_order: data.sort_order ?? imports.length,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Tilvalgsgruppe importeret');
      await fetchImports();
      return newImport as unknown as ProductAddonImport;
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Denne tilvalgsgruppe er allerede importeret');
      } else {
        toast.error(error.message || 'Kunne ikke importere tilvalgsgruppe');
      }
      return null;
    }
  };

  // ==========================================================================
  // Update an import (override settings)
  // ==========================================================================
  const updateImport = async (
    importId: string,
    data: Partial<Omit<ProductAddonImportInput, 'product_id' | 'addon_group_id'>>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('product_addon_imports' as any)
        .update({
          ...(data.import_mode !== undefined && { import_mode: data.import_mode }),
          ...(data.override_label !== undefined && { override_label: data.override_label }),
          ...(data.override_display_type !== undefined && { override_display_type: data.override_display_type }),
          ...(data.is_required !== undefined && { is_required: data.is_required }),
          ...(data.sort_order !== undefined && { sort_order: data.sort_order }),
        })
        .eq('id', importId);

      if (error) throw error;

      await fetchImports();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opdatere import');
      return false;
    }
  };

  // ==========================================================================
  // Remove an import
  // ==========================================================================
  const removeImport = async (importId: string): Promise<boolean> => {
    try {
      // Find the import to get the group ID
      const imp = imports.find((i) => i.id === importId);

      // Delete overrides for items in this group
      if (imp) {
        const { data: items } = await supabase
          .from('addon_library_items' as any)
          .select('id')
          .eq('group_id', imp.addon_group_id);

        if (items && items.length > 0) {
          const itemIds = items.map((i: any) => i.id);
          await supabase
            .from('product_addon_item_overrides' as any)
            .delete()
            .eq('product_id', productId)
            .in('addon_item_id', itemIds);
        }
      }

      // Delete the import
      const { error } = await supabase
        .from('product_addon_imports' as any)
        .delete()
        .eq('id', importId);

      if (error) throw error;

      toast.success('Tilvalgsgruppe fjernet');
      await fetchImports();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke fjerne import');
      return false;
    }
  };

  // ==========================================================================
  // Set override for a specific item
  // ==========================================================================
  const setItemOverride = async (
    data: Omit<ProductAddonItemOverrideInput, 'product_id'>
  ): Promise<ProductAddonItemOverride | null> => {
    if (!productId || !tenantId) return null;

    try {
      // Upsert the override
      const { data: override, error } = await supabase
        .from('product_addon_item_overrides' as any)
        .upsert(
          {
            tenant_id: tenantId,
            product_id: productId,
            addon_item_id: data.addon_item_id,
            override_price: data.override_price,
            override_pricing_mode: data.override_pricing_mode,
            override_markup_pct: data.override_markup_pct,
            is_enabled: data.is_enabled ?? true,
            override_sort_order: data.override_sort_order,
          },
          {
            onConflict: 'product_id,addon_item_id',
          }
        )
        .select()
        .single();

      if (error) throw error;

      await fetchImports();
      return override as unknown as ProductAddonItemOverride;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke sætte override');
      return null;
    }
  };

  // ==========================================================================
  // Remove override for a specific item
  // ==========================================================================
  const removeItemOverride = async (addonItemId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('product_addon_item_overrides' as any)
        .delete()
        .eq('product_id', productId)
        .eq('addon_item_id', addonItemId);

      if (error) throw error;

      await fetchImports();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke fjerne override');
      return false;
    }
  };

  // ==========================================================================
  // Disable/enable an item for this product
  // ==========================================================================
  const toggleItemEnabled = async (addonItemId: string, enabled: boolean): Promise<boolean> => {
    return !!(await setItemOverride({
      addon_item_id: addonItemId,
      is_enabled: enabled,
    }));
  };

  // ==========================================================================
  // Reorder imports
  // ==========================================================================
  const reorderImports = async (orderedImportIds: string[]): Promise<boolean> => {
    try {
      const updates = orderedImportIds.map((id, index) =>
        supabase
          .from('product_addon_imports' as any)
          .update({ sort_order: index })
          .eq('id', id)
      );

      await Promise.all(updates);
      await fetchImports();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke omsortere imports');
      return false;
    }
  };

  return {
    // State
    imports,
    overrides,
    resolvedGroups,
    loading,
    refresh: fetchImports,
    fetchResolvedAddons,

    // Import operations
    importGroup,
    updateImport,
    removeImport,
    reorderImports,

    // Override operations
    setItemOverride,
    removeItemOverride,
    toggleItemEnabled,
  };
}

// =============================================================================
// Price Calculation Utility
// =============================================================================

interface CalculateAddonPriceParams {
  item: ResolvedAddonItem;
  tiers?: AddonLibraryPriceTier[];
  fixedPrices?: AddonLibraryFixedPrice[];
  quantity: number;
  areaM2?: number;
}

/**
 * Calculate the price for an add-on item based on its pricing mode.
 */
export function calculateAddonPrice({
  item,
  tiers,
  fixedPrices,
  quantity,
  areaM2,
}: CalculateAddonPriceParams): { unitPrice: number; totalPrice: number } {
  const markupMultiplier = 1 + (item.markup_pct || 0) / 100;

  switch (item.pricing_mode) {
    case 'fixed': {
      // Fixed price, added once
      const unitPrice = item.base_price * markupMultiplier;
      return { unitPrice, totalPrice: unitPrice };
    }

    case 'per_quantity': {
      // Price per unit
      const unitPrice = item.base_price * markupMultiplier;
      return { unitPrice, totalPrice: unitPrice * quantity };
    }

    case 'per_area': {
      // Price per m²
      if (!areaM2) return { unitPrice: 0, totalPrice: 0 };
      const unitPrice = item.base_price * markupMultiplier;
      return { unitPrice, totalPrice: unitPrice * areaM2 };
    }

    case 'tiered': {
      // Tiered pricing with interpolation
      if (!areaM2 || !tiers || tiers.length === 0) {
        return { unitPrice: 0, totalPrice: 0 };
      }

      // Sort tiers by from_m2
      const sortedTiers = [...tiers].sort((a, b) => a.from_m2 - b.from_m2);

      // Find the applicable tier or interpolate
      let pricePerM2 = 0;

      for (let i = 0; i < sortedTiers.length; i++) {
        const tier = sortedTiers[i];
        const nextTier = sortedTiers[i + 1];

        if (areaM2 >= tier.from_m2 && (!tier.to_m2 || areaM2 <= tier.to_m2)) {
          // Exact tier match
          pricePerM2 = tier.price_per_m2;
          break;
        }

        if (nextTier && areaM2 >= tier.from_m2 && areaM2 < nextTier.from_m2) {
          // Interpolate between tiers if both are anchors
          if (tier.is_anchor && nextTier.is_anchor) {
            const range = nextTier.from_m2 - tier.from_m2;
            const position = areaM2 - tier.from_m2;
            const ratio = position / range;
            pricePerM2 = tier.price_per_m2 + (nextTier.price_per_m2 - tier.price_per_m2) * ratio;
          } else {
            pricePerM2 = tier.price_per_m2;
          }
          break;
        }
      }

      // If beyond all tiers, use the last one
      if (pricePerM2 === 0 && sortedTiers.length > 0) {
        pricePerM2 = sortedTiers[sortedTiers.length - 1].price_per_m2;
      }

      const unitPrice = pricePerM2 * markupMultiplier;
      return { unitPrice, totalPrice: unitPrice * areaM2 };
    }

    default:
      return { unitPrice: 0, totalPrice: 0 };
  }
}
