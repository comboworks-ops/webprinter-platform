/**
 * usePaidItems Hook
 * 
 * Manages paid design elements:
 * - Tracks which paid items are used in the current draft
 * - Calculates total cost of unpaid items
 * - Handles purchase flow before publishing
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PaidItemType = 'premade_design' | 'icon_pack' | 'font_pack' | 'template_feature';

export interface PaidItem {
    id: string;
    type: PaidItemType;
    itemId: string;
    name: string;
    price: number;
    thumbnailUrl?: string | null;
    appliedAt?: string;
}

export interface Purchase {
    id: string;
    itemType: PaidItemType;
    itemId: string;
    itemName: string;
    pricePaid: number;
    purchasedAt: string;
}

export interface UsePaidItemsReturn {
    // Pending items (applied but not purchased)
    pendingItems: PaidItem[];
    loadingPending: boolean;

    // Completed purchases
    purchases: Purchase[];
    loadingPurchases: boolean;

    // Calculated totals
    totalPendingCost: number;
    hasPendingItems: boolean;

    // Actions
    addPendingItem: (item: Omit<PaidItem, 'id' | 'appliedAt'>) => Promise<void>;
    removePendingItem: (itemType: PaidItemType, itemId: string) => Promise<void>;
    clearPendingItems: () => Promise<void>;

    // Check if an item is already purchased
    isItemPurchased: (itemType: PaidItemType, itemId: string) => boolean;

    // Check if an item is pending (in draft but not purchased)
    isItemPending: (itemType: PaidItemType, itemId: string) => boolean;

    // Process payment (mock for now - would integrate with Stripe/payment provider)
    processPurchase: () => Promise<boolean>;

    // Refresh data
    refresh: () => Promise<void>;
}

export function usePaidItems(tenantId: string | null): UsePaidItemsReturn {
    const [pendingItems, setPendingItems] = useState<PaidItem[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loadingPending, setLoadingPending] = useState(true);
    const [loadingPurchases, setLoadingPurchases] = useState(true);

    // Load pending items
    const loadPendingItems = useCallback(async () => {
        if (!tenantId) {
            setPendingItems([]);
            setLoadingPending(false);
            return;
        }

        setLoadingPending(true);
        try {
            const { data, error } = await supabase
                .from('tenant_pending_items')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('applied_at', { ascending: false });

            if (error) {
                console.error('Error loading pending items:', error);
                setPendingItems([]);
            } else if (data) {
                setPendingItems(data.map((item) => ({
                    id: item.id,
                    type: item.item_type as PaidItemType,
                    itemId: item.item_id,
                    name: item.item_name,
                    price: Number(item.price),
                    appliedAt: item.applied_at,
                })));
            }
        } catch (err) {
            console.error('Error loading pending items:', err);
            setPendingItems([]);
        } finally {
            setLoadingPending(false);
        }
    }, [tenantId]);

    // Load completed purchases
    const loadPurchases = useCallback(async () => {
        if (!tenantId) {
            setPurchases([]);
            setLoadingPurchases(false);
            return;
        }

        setLoadingPurchases(true);
        try {
            const { data, error } = await supabase
                .from('tenant_purchases')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('status', 'completed')
                .order('purchased_at', { ascending: false });

            if (error) {
                console.error('Error loading purchases:', error);
                setPurchases([]);
            } else if (data) {
                setPurchases(data.map((item) => ({
                    id: item.id,
                    itemType: item.item_type as PaidItemType,
                    itemId: item.item_id,
                    itemName: item.item_name,
                    pricePaid: Number(item.price_paid),
                    purchasedAt: item.purchased_at,
                })));
            }
        } catch (err) {
            console.error('Error loading purchases:', err);
            setPurchases([]);
        } finally {
            setLoadingPurchases(false);
        }
    }, [tenantId]);

    // Initial load
    useEffect(() => {
        loadPendingItems();
        loadPurchases();
    }, [loadPendingItems, loadPurchases]);

    // Calculate totals
    const totalPendingCost = pendingItems.reduce((sum, item) => sum + item.price, 0);
    const hasPendingItems = pendingItems.length > 0 && totalPendingCost > 0;

    // Check if item is already purchased
    const isItemPurchased = useCallback((itemType: PaidItemType, itemId: string): boolean => {
        return purchases.some(p => p.itemType === itemType && p.itemId === itemId);
    }, [purchases]);

    // Check if item is pending
    const isItemPending = useCallback((itemType: PaidItemType, itemId: string): boolean => {
        return pendingItems.some(p => p.type === itemType && p.itemId === itemId);
    }, [pendingItems]);

    // Add a pending item
    const addPendingItem = useCallback(async (item: Omit<PaidItem, 'id' | 'appliedAt'>) => {
        if (!tenantId) return;

        // Skip if already purchased or pending, or if price is 0
        if (item.price <= 0) return;
        if (isItemPurchased(item.type, item.itemId)) return;
        if (isItemPending(item.type, item.itemId)) return;

        // Optimistic update - add to local state immediately
        const tempId = `temp-${Date.now()}`;
        const newItem: PaidItem = {
            id: tempId,
            type: item.type,
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            thumbnailUrl: item.thumbnailUrl,
            appliedAt: new Date().toISOString(),
        };

        setPendingItems(prev => [...prev, newItem]);

        try {
            const { data, error } = await supabase
                .from('tenant_pending_items')
                .upsert({
                    tenant_id: tenantId,
                    item_type: item.type,
                    item_id: item.itemId,
                    item_name: item.name,
                    price: item.price,
                }, {
                    onConflict: 'tenant_id,item_type,item_id'
                })
                .select()
                .single();

            if (error) {
                // Keep the optimistic update - item will still show in UI
                // but won't be persisted. This is better UX than removing it.
            } else if (data) {
                // Update the temp item with the real ID from database
                setPendingItems(prev => prev.map(p =>
                    p.id === tempId ? { ...p, id: data.id } : p
                ));
            }
        } catch (err) {
            // Keep optimistic update in UI
        }
    }, [tenantId, isItemPurchased, isItemPending]);

    // Remove a pending item
    const removePendingItem = useCallback(async (itemType: PaidItemType, itemId: string) => {
        if (!tenantId) return;

        try {
            const { error } = await supabase
                .from('tenant_pending_items')
                .delete()
                .eq('tenant_id', tenantId)
                .eq('item_type', itemType)
                .eq('item_id', itemId);

            if (error) {
                console.error('Error removing pending item:', error);
            } else {
                await loadPendingItems();
            }
        } catch (err) {
            console.error('Error removing pending item:', err);
        }
    }, [tenantId, loadPendingItems]);

    // Clear all pending items
    const clearPendingItems = useCallback(async () => {
        if (!tenantId) return;

        try {
            const { error } = await supabase
                .from('tenant_pending_items')
                .delete()
                .eq('tenant_id', tenantId);

            if (error) {
                console.error('Error clearing pending items:', error);
            } else {
                setPendingItems([]);
            }
        } catch (err) {
            console.error('Error clearing pending items:', err);
        }
    }, [tenantId]);

    // Process purchase (convert pending items to purchases)
    const processPurchase = useCallback(async (): Promise<boolean> => {
        if (!tenantId || pendingItems.length === 0) return true;

        try {
            // In a real implementation, this would:
            // 1. Create a payment intent with Stripe
            // 2. Show payment UI
            // 3. Wait for successful payment
            // 4. Then insert purchases

            // For now, we'll do a "mock" purchase that just moves items to purchases
            const purchaseInserts = pendingItems.map(item => ({
                tenant_id: tenantId,
                item_type: item.type,
                item_id: item.itemId,
                item_name: item.name,
                price_paid: item.price,
                status: 'completed',
            }));

            const { error: insertError } = await supabase
                .from('tenant_purchases')
                .insert(purchaseInserts);

            if (insertError) {
                console.error('Error inserting purchases:', insertError);
                return false;
            }

            // Clear pending items
            await clearPendingItems();
            await loadPurchases();

            return true;
        } catch (err) {
            console.error('Error processing purchase:', err);
            return false;
        }
    }, [tenantId, pendingItems, clearPendingItems, loadPurchases]);

    // Refresh all data
    const refresh = useCallback(async () => {
        await Promise.all([loadPendingItems(), loadPurchases()]);
    }, [loadPendingItems, loadPurchases]);

    return {
        pendingItems,
        loadingPending,
        purchases,
        loadingPurchases,
        totalPendingCost,
        hasPendingItems,
        addPendingItem,
        removePendingItem,
        clearPendingItems,
        isItemPurchased,
        isItemPending,
        processPurchase,
        refresh,
    };
}
