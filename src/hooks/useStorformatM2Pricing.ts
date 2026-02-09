import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  StorformatMaterialSimple,
  StorformatM2Price,
  StorformatFinishSimple,
  StorformatFinishPrice,
  StorformatConfigV2,
} from '@/lib/storformat-pricing/types';

interface UseStorformatM2PricingProps {
  productId: string;
  tenantId: string;
}

export function useStorformatM2Pricing({ productId, tenantId }: UseStorformatM2PricingProps) {
  const [config, setConfig] = useState<StorformatConfigV2 | null>(null);
  const [materials, setMaterials] = useState<StorformatMaterialSimple[]>([]);
  const [m2Prices, setM2Prices] = useState<StorformatM2Price[]>([]);
  const [finishes, setFinishes] = useState<StorformatFinishSimple[]>([]);
  const [finishPrices, setFinishPrices] = useState<StorformatFinishPrice[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!productId || !tenantId) return;
    setLoading(true);

    try {
      // Fetch config
      const { data: configData } = await supabase
        .from('storformat_configs')
        .select('*')
        .eq('product_id', productId)
        .single();

      if (configData) {
        setConfig(configData as any);
      }

      // Fetch materials (simplified, no tiers embedded)
      const { data: materialsData } = await supabase
        .from('storformat_materials')
        .select('id, tenant_id, product_id, name, group_label, tags, thumbnail_url, design_library_item_id, bleed_mm, safe_area_mm, max_width_mm, max_height_mm, allow_split, sort_order')
        .eq('product_id', productId)
        .order('sort_order');

      if (materialsData) {
        setMaterials(materialsData as any[]);
      }

      // Fetch M² prices
      const { data: pricesData } = await supabase
        .from('storformat_m2_prices')
        .select('*')
        .eq('product_id', productId)
        .order('from_m2');

      if (pricesData) {
        setM2Prices(pricesData as any[]);
      }

      // Fetch finishes
      const { data: finishesData } = await supabase
        .from('storformat_finishes')
        .select('id, tenant_id, product_id, name, group_label, tags, thumbnail_url, sort_order')
        .eq('product_id', productId)
        .order('sort_order');

      if (finishesData) {
        setFinishes(finishesData as any[]);
      }

      // Fetch finish prices
      const { data: finishPricesData } = await supabase
        .from('storformat_finish_prices')
        .select('*')
        .eq('product_id', productId);

      if (finishPricesData) {
        setFinishPrices(finishPricesData as any[]);
      }
    } catch (error) {
      console.error('Error fetching storformat pricing data:', error);
    } finally {
      setLoading(false);
    }
  }, [productId, tenantId]);

  // Set pricing mode
  const setPricingMode = useCallback(async (mode: 'legacy' | 'm2_rates') => {
    if (!productId) return;

    const { error } = await supabase
      .from('storformat_configs')
      .update({ pricing_mode: mode })
      .eq('product_id', productId);

    if (error) {
      console.error('Error updating pricing mode:', error);
      throw error;
    }

    setConfig(prev => prev ? { ...prev, pricing_mode: mode } : null);
  }, [productId]);

  // Create material (simplified)
  const createMaterial = useCallback(async (name: string, options?: Partial<StorformatMaterialSimple>) => {
    if (!productId || !tenantId) return null;

    const newMaterial = {
      tenant_id: tenantId,
      product_id: productId,
      name,
      bleed_mm: options?.bleed_mm ?? 3,
      safe_area_mm: options?.safe_area_mm ?? 3,
      group_label: options?.group_label ?? null,
      tags: options?.tags ?? [],
      thumbnail_url: options?.thumbnail_url ?? null,
      design_library_item_id: options?.design_library_item_id ?? null,
      max_width_mm: options?.max_width_mm ?? null,
      max_height_mm: options?.max_height_mm ?? null,
      allow_split: options?.allow_split ?? true,
      sort_order: materials.length,
    };

    const { data, error } = await supabase
      .from('storformat_materials')
      .insert(newMaterial)
      .select()
      .single();

    if (error) {
      console.error('Error creating material:', error);
      throw error;
    }

    setMaterials(prev => [...prev, data as any]);
    return data;
  }, [productId, tenantId, materials.length]);

  // Update material
  const updateMaterial = useCallback(async (materialId: string, updates: Partial<StorformatMaterialSimple>) => {
    const { error } = await supabase
      .from('storformat_materials')
      .update(updates)
      .eq('id', materialId);

    if (error) {
      console.error('Error updating material:', error);
      throw error;
    }

    setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, ...updates } : m));
  }, []);

  // Delete material
  const deleteMaterial = useCallback(async (materialId: string) => {
    const { error } = await supabase
      .from('storformat_materials')
      .delete()
      .eq('id', materialId);

    if (error) {
      console.error('Error deleting material:', error);
      throw error;
    }

    setMaterials(prev => prev.filter(m => m.id !== materialId));
    setM2Prices(prev => prev.filter(p => p.material_id !== materialId));
  }, []);

  // Set M² prices for a material (replaces all tiers)
  const setM2PricesForMaterial = useCallback(async (
    materialId: string,
    prices: Array<{ from_m2: number; to_m2?: number | null; price_per_m2: number; is_anchor: boolean }>
  ) => {
    if (!productId || !tenantId) return;

    // Delete existing prices for this material
    await supabase
      .from('storformat_m2_prices')
      .delete()
      .eq('material_id', materialId);

    // Insert new prices
    const newPrices = prices.map(p => ({
      tenant_id: tenantId,
      product_id: productId,
      material_id: materialId,
      from_m2: p.from_m2,
      to_m2: p.to_m2,
      price_per_m2: p.price_per_m2,
      is_anchor: p.is_anchor,
    }));

    if (newPrices.length > 0) {
      const { data, error } = await supabase
        .from('storformat_m2_prices')
        .insert(newPrices)
        .select();

      if (error) {
        console.error('Error inserting m2 prices:', error);
        throw error;
      }

      // Update local state
      setM2Prices(prev => [
        ...prev.filter(p => p.material_id !== materialId),
        ...(data as any[]),
      ]);
    }
  }, [productId, tenantId]);

  // Create finish
  const createFinish = useCallback(async (name: string, options?: Partial<StorformatFinishSimple>) => {
    if (!productId || !tenantId) return null;

    const newFinish = {
      tenant_id: tenantId,
      product_id: productId,
      name,
      group_label: options?.group_label ?? null,
      thumbnail_url: options?.thumbnail_url ?? null,
      pricing_mode: 'fixed',  // Default required by old schema
      fixed_price_per_unit: 0,
      interpolation_enabled: true,
      sort_order: finishes.length,
    };

    const { data, error } = await supabase
      .from('storformat_finishes')
      .insert(newFinish)
      .select()
      .single();

    if (error) {
      console.error('Error creating finish:', error);
      throw error;
    }

    setFinishes(prev => [...prev, data as any]);
    return data;
  }, [productId, tenantId, finishes.length]);

  // Set finish price
  const setFinishPrice = useCallback(async (
    finishId: string,
    pricingMode: 'fixed' | 'per_m2',
    fixedPrice: number,
    pricePerM2: number
  ) => {
    if (!productId || !tenantId) return;

    // Upsert finish price
    const { error } = await supabase
      .from('storformat_finish_prices')
      .upsert({
        tenant_id: tenantId,
        product_id: productId,
        finish_id: finishId,
        pricing_mode: pricingMode,
        fixed_price: fixedPrice,
        price_per_m2: pricePerM2,
      }, {
        onConflict: 'product_id,finish_id',
      });

    if (error) {
      console.error('Error setting finish price:', error);
      throw error;
    }

    // Update local state
    setFinishPrices(prev => {
      const existing = prev.find(fp => fp.finish_id === finishId);
      if (existing) {
        return prev.map(fp => fp.finish_id === finishId ? {
          ...fp,
          pricing_mode: pricingMode,
          fixed_price: fixedPrice,
          price_per_m2: pricePerM2,
        } : fp);
      }
      return [...prev, {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        product_id: productId,
        finish_id: finishId,
        pricing_mode: pricingMode,
        fixed_price: fixedPrice,
        price_per_m2: pricePerM2,
      }];
    });
  }, [productId, tenantId]);

  // Delete finish
  const deleteFinish = useCallback(async (finishId: string) => {
    const { error } = await supabase
      .from('storformat_finishes')
      .delete()
      .eq('id', finishId);

    if (error) {
      console.error('Error deleting finish:', error);
      throw error;
    }

    setFinishes(prev => prev.filter(f => f.id !== finishId));
    setFinishPrices(prev => prev.filter(fp => fp.finish_id !== finishId));
  }, []);

  // Get M² prices for a specific material
  const getPricesForMaterial = useCallback((materialId: string) => {
    return m2Prices.filter(p => p.material_id === materialId).sort((a, b) => a.from_m2 - b.from_m2);
  }, [m2Prices]);

  // Get finish price for a specific finish
  const getFinishPrice = useCallback((finishId: string) => {
    return finishPrices.find(fp => fp.finish_id === finishId) || null;
  }, [finishPrices]);

  // Get all unique tags from materials for autocomplete
  const getAllMaterialTags = useCallback(() => {
    const allTags = materials.flatMap(m => m.tags || []);
    return Array.from(new Set(allTags)).sort();
  }, [materials]);

  // Get all unique tags from finishes for autocomplete
  const getAllFinishTags = useCallback(() => {
    const allTags = finishes.flatMap(f => f.tags || []);
    return Array.from(new Set(allTags)).sort();
  }, [finishes]);

  // Search materials by tag
  const searchMaterialsByTag = useCallback((tag: string) => {
    return materials.filter(m => m.tags?.includes(tag));
  }, [materials]);

  // Search finishes by tag
  const searchFinishesByTag = useCallback((tag: string) => {
    return finishes.filter(f => f.tags?.includes(tag));
  }, [finishes]);

  return {
    config,
    materials,
    m2Prices,
    finishes,
    finishPrices,
    loading,
    fetchData,
    setPricingMode,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    setM2PricesForMaterial,
    createFinish,
    setFinishPrice,
    deleteFinish,
    getPricesForMaterial,
    getFinishPrice,
    getAllMaterialTags,
    getAllFinishTags,
    searchMaterialsByTag,
    searchFinishesByTag,
  };
}
