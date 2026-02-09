/**
 * Hook for managing the Addon Library
 *
 * Provides CRUD operations for library groups, items, and pricing tiers.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  AddonLibraryGroup,
  AddonLibraryGroupInput,
  AddonLibraryGroupWithItems,
  AddonLibraryItem,
  AddonLibraryItemInput,
  AddonLibraryItemWithPricing,
  AddonLibraryPriceTier,
  AddonLibraryPriceTierInput,
  AddonLibraryFixedPrice,
  AddonLibraryFixedPriceInput,
} from '@/lib/addon-library/types';

export function useAddonLibrary(tenantId: string | undefined) {
  const [groups, setGroups] = useState<AddonLibraryGroupWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  // ==========================================================================
  // Fetch all groups with their items
  // ==========================================================================
  const fetchGroups = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoading(true);

      // Fetch groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('addon_library_groups' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order');

      if (groupsError) throw groupsError;

      // Fetch items for all groups
      const { data: itemsData, error: itemsError } = await supabase
        .from('addon_library_items' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order');

      if (itemsError) throw itemsError;

      // Fetch usage count (how many products use each group)
      const { data: importsData, error: importsError } = await supabase
        .from('product_addon_imports' as any)
        .select('addon_group_id')
        .eq('tenant_id', tenantId);

      if (importsError) throw importsError;

      // Build usage count map
      const usageCountMap: Record<string, number> = {};
      (importsData || []).forEach((imp: any) => {
        usageCountMap[imp.addon_group_id] = (usageCountMap[imp.addon_group_id] || 0) + 1;
      });

      // Combine groups with items and usage count
      const groupsWithItems: AddonLibraryGroupWithItems[] = (groupsData || []).map((g: any) => ({
        ...g,
        items: (itemsData || []).filter((i: any) => i.group_id === g.id) as AddonLibraryItem[],
        usage_count: usageCountMap[g.id] || 0,
      }));

      setGroups(groupsWithItems);
    } catch (error) {
      console.error('Error fetching addon library groups:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // ==========================================================================
  // Group CRUD
  // ==========================================================================

  const createGroup = async (data: AddonLibraryGroupInput): Promise<AddonLibraryGroup | null> => {
    if (!tenantId) return null;

    try {
      const { data: newGroup, error } = await supabase
        .from('addon_library_groups' as any)
        .insert({
          tenant_id: tenantId,
          name: data.name,
          display_label: data.display_label,
          description: data.description || null,
          category: data.category || 'addon',
          display_type: data.display_type || 'buttons',
          sort_order: data.sort_order ?? groups.length,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Tilvalgsgruppe oprettet');
      await fetchGroups();
      return newGroup as unknown as AddonLibraryGroup;
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('En gruppe med dette navn findes allerede');
      } else {
        toast.error(error.message || 'Kunne ikke oprette gruppe');
      }
      return null;
    }
  };

  const updateGroup = async (id: string, data: Partial<AddonLibraryGroupInput>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('addon_library_groups' as any)
        .update({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.display_label !== undefined && { display_label: data.display_label }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.display_type !== undefined && { display_type: data.display_type }),
          ...(data.sort_order !== undefined && { sort_order: data.sort_order }),
        })
        .eq('id', id);

      if (error) throw error;

      await fetchGroups();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opdatere gruppe');
      return false;
    }
  };

  const deleteGroup = async (id: string): Promise<boolean> => {
    try {
      // Check usage first
      const group = groups.find((g) => g.id === id);
      if (group && group.usage_count && group.usage_count > 0) {
        toast.error(`Gruppen bruges af ${group.usage_count} produkt(er). Fjern først importen.`);
        return false;
      }

      const { error } = await supabase
        .from('addon_library_groups' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Tilvalgsgruppe slettet');
      await fetchGroups();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke slette gruppe');
      return false;
    }
  };

  // ==========================================================================
  // Item CRUD
  // ==========================================================================

  const createItem = async (data: AddonLibraryItemInput): Promise<AddonLibraryItem | null> => {
    if (!tenantId) return null;

    try {
      const { data: newItem, error } = await supabase
        .from('addon_library_items' as any)
        .insert({
          tenant_id: tenantId,
          group_id: data.group_id,
          name: data.name,
          display_label: data.display_label,
          description: data.description || null,
          icon_url: data.icon_url || null,
          thumbnail_url: data.thumbnail_url || null,
          pricing_mode: data.pricing_mode || 'fixed',
          base_price: data.base_price ?? 0,
          markup_pct: data.markup_pct ?? 0,
          sort_order: data.sort_order ?? 0,
          enabled: data.enabled ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Tilvalg oprettet');
      await fetchGroups();
      return newItem as unknown as AddonLibraryItem;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke oprette tilvalg');
      return null;
    }
  };

  const updateItem = async (id: string, data: Partial<AddonLibraryItemInput>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('addon_library_items' as any)
        .update({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.display_label !== undefined && { display_label: data.display_label }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.icon_url !== undefined && { icon_url: data.icon_url }),
          ...(data.thumbnail_url !== undefined && { thumbnail_url: data.thumbnail_url }),
          ...(data.pricing_mode !== undefined && { pricing_mode: data.pricing_mode }),
          ...(data.base_price !== undefined && { base_price: data.base_price }),
          ...(data.markup_pct !== undefined && { markup_pct: data.markup_pct }),
          ...(data.sort_order !== undefined && { sort_order: data.sort_order }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
        })
        .eq('id', id);

      if (error) throw error;

      await fetchGroups();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opdatere tilvalg');
      return false;
    }
  };

  const deleteItem = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('addon_library_items' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Tilvalg slettet');
      await fetchGroups();
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke slette tilvalg');
      return false;
    }
  };

  // ==========================================================================
  // Get item with pricing details
  // ==========================================================================

  const getItemWithPricing = async (itemId: string): Promise<AddonLibraryItemWithPricing | null> => {
    try {
      // Fetch item
      const { data: item, error: itemError } = await supabase
        .from('addon_library_items' as any)
        .select('*')
        .eq('id', itemId)
        .single();

      if (itemError) throw itemError;

      // Fetch tiers
      const { data: tiers, error: tiersError } = await supabase
        .from('addon_library_price_tiers' as any)
        .select('*')
        .eq('addon_item_id', itemId)
        .order('from_m2');

      if (tiersError) throw tiersError;

      // Fetch fixed prices
      const { data: fixedPrices, error: fixedError } = await supabase
        .from('addon_library_fixed_prices' as any)
        .select('*')
        .eq('addon_item_id', itemId)
        .order('quantity');

      if (fixedError) throw fixedError;

      return {
        ...(item as unknown as AddonLibraryItem),
        tiers: (tiers || []) as AddonLibraryPriceTier[],
        fixed_prices: (fixedPrices || []) as AddonLibraryFixedPrice[],
      };
    } catch (error) {
      console.error('Error fetching item with pricing:', error);
      return null;
    }
  };

  // ==========================================================================
  // Price Tier CRUD
  // ==========================================================================

  const addPriceTier = async (data: AddonLibraryPriceTierInput): Promise<AddonLibraryPriceTier | null> => {
    if (!tenantId) return null;

    try {
      const { data: newTier, error } = await supabase
        .from('addon_library_price_tiers' as any)
        .insert({
          tenant_id: tenantId,
          addon_item_id: data.addon_item_id,
          from_m2: data.from_m2,
          to_m2: data.to_m2 || null,
          price_per_m2: data.price_per_m2,
          is_anchor: data.is_anchor ?? true,
          markup_pct: data.markup_pct ?? 0,
          sort_order: data.sort_order ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return newTier as unknown as AddonLibraryPriceTier;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke tilføje pristrin');
      return null;
    }
  };

  const updatePriceTier = async (id: string, data: Partial<AddonLibraryPriceTierInput>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('addon_library_price_tiers' as any)
        .update({
          ...(data.from_m2 !== undefined && { from_m2: data.from_m2 }),
          ...(data.to_m2 !== undefined && { to_m2: data.to_m2 }),
          ...(data.price_per_m2 !== undefined && { price_per_m2: data.price_per_m2 }),
          ...(data.is_anchor !== undefined && { is_anchor: data.is_anchor }),
          ...(data.markup_pct !== undefined && { markup_pct: data.markup_pct }),
          ...(data.sort_order !== undefined && { sort_order: data.sort_order }),
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opdatere pristrin');
      return false;
    }
  };

  const deletePriceTier = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('addon_library_price_tiers' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke slette pristrin');
      return false;
    }
  };

  // ==========================================================================
  // Fixed Price CRUD
  // ==========================================================================

  const addFixedPrice = async (data: AddonLibraryFixedPriceInput): Promise<AddonLibraryFixedPrice | null> => {
    if (!tenantId) return null;

    try {
      const { data: newPrice, error } = await supabase
        .from('addon_library_fixed_prices' as any)
        .insert({
          tenant_id: tenantId,
          addon_item_id: data.addon_item_id,
          quantity: data.quantity,
          price: data.price,
          sort_order: data.sort_order ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return newPrice as unknown as AddonLibraryFixedPrice;
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Der findes allerede en pris for dette antal');
      } else {
        toast.error(error.message || 'Kunne ikke tilføje fast pris');
      }
      return null;
    }
  };

  const updateFixedPrice = async (id: string, data: Partial<AddonLibraryFixedPriceInput>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('addon_library_fixed_prices' as any)
        .update({
          ...(data.quantity !== undefined && { quantity: data.quantity }),
          ...(data.price !== undefined && { price: data.price }),
          ...(data.sort_order !== undefined && { sort_order: data.sort_order }),
        })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opdatere fast pris');
      return false;
    }
  };

  const deleteFixedPrice = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('addon_library_fixed_prices' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke slette fast pris');
      return false;
    }
  };

  // ==========================================================================
  // Bulk operations
  // ==========================================================================

  const updateItemPriceTiers = async (
    itemId: string,
    tiers: AddonLibraryPriceTierInput[]
  ): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      // Delete existing tiers
      const { error: deleteError } = await supabase
        .from('addon_library_price_tiers' as any)
        .delete()
        .eq('addon_item_id', itemId);

      if (deleteError) throw deleteError;

      // Insert new tiers
      if (tiers.length > 0) {
        const { error: insertError } = await supabase
          .from('addon_library_price_tiers' as any)
          .insert(
            tiers.map((t, index) => ({
              tenant_id: tenantId,
              addon_item_id: itemId,
              from_m2: t.from_m2,
              to_m2: t.to_m2 || null,
              price_per_m2: t.price_per_m2,
              is_anchor: t.is_anchor ?? true,
              markup_pct: t.markup_pct ?? 0,
              sort_order: t.sort_order ?? index,
            }))
          );

        if (insertError) throw insertError;
      }

      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opdatere pristrin');
      return false;
    }
  };

  const updateItemFixedPrices = async (
    itemId: string,
    prices: AddonLibraryFixedPriceInput[]
  ): Promise<boolean> => {
    if (!tenantId) return false;

    try {
      // Delete existing fixed prices
      const { error: deleteError } = await supabase
        .from('addon_library_fixed_prices' as any)
        .delete()
        .eq('addon_item_id', itemId);

      if (deleteError) throw deleteError;

      // Insert new fixed prices
      if (prices.length > 0) {
        const { error: insertError } = await supabase
          .from('addon_library_fixed_prices' as any)
          .insert(
            prices.map((p, index) => ({
              tenant_id: tenantId,
              addon_item_id: itemId,
              quantity: p.quantity,
              price: p.price,
              sort_order: p.sort_order ?? index,
            }))
          );

        if (insertError) throw insertError;
      }

      return true;
    } catch (error: any) {
      toast.error(error.message || 'Kunne ikke opdatere faste priser');
      return false;
    }
  };

  return {
    // State
    groups,
    loading,
    refresh: fetchGroups,

    // Group operations
    createGroup,
    updateGroup,
    deleteGroup,

    // Item operations
    createItem,
    updateItem,
    deleteItem,
    getItemWithPricing,

    // Price tier operations
    addPriceTier,
    updatePriceTier,
    deletePriceTier,
    updateItemPriceTiers,

    // Fixed price operations
    addFixedPrice,
    updateFixedPrice,
    deleteFixedPrice,
    updateItemFixedPrices,
  };
}
