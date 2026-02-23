import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SYNC_STORAGE_KEY = "supabase-sync-stamp";
const MIN_SYNC_INTERVAL_MS = 1200;
const PERIODIC_SYNC_MS = 120000;

const TABLES_TO_WATCH = [
  "tenants",
  "products",
  "product_categories",
  "product_attribute_groups",
  "product_attribute_values",
  "product_option_groups",
  "product_options",
  "product_option_group_assignments",
  "product_pricing_configs",
  "generic_product_prices",
  "price_list_templates",
  "custom_fields",
  "tenant_notifications",
  "company_accounts",
  "company_hub_items",
  "platform_seo_settings",
  "platform_seo_pages",
] as const;

type SyncReason =
  | "focus"
  | "visibility"
  | "online"
  | "interval"
  | "storage"
  | "realtime"
  | "manual";

/**
 * Global Supabase sync bridge.
 * Keeps active React Query views fresh across tabs and after external Supabase changes.
 */
export function SupabaseDataSyncBridge() {
  const queryClient = useQueryClient();
  const lastSyncAtRef = useRef(0);

  const syncNow = useCallback(
    (reason: SyncReason, options?: { broadcast?: boolean }) => {
      const now = Date.now();
      if (now - lastSyncAtRef.current < MIN_SYNC_INTERVAL_MS) {
        return;
      }
      lastSyncAtRef.current = now;

      const shouldBroadcast = options?.broadcast ?? true;
      if (shouldBroadcast && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            SYNC_STORAGE_KEY,
            JSON.stringify({ at: now, reason }),
          );
        } catch {
          // Best effort only.
        }
      }

      void queryClient.invalidateQueries({ refetchType: "active" });
      void queryClient.refetchQueries({ type: "active" });
    },
    [queryClient],
  );

  useEffect(() => {
    const onFocus = () => syncNow("focus");
    const onOnline = () => syncNow("online");
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncNow("visibility");
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYNC_STORAGE_KEY && event.newValue) {
        syncNow("storage", { broadcast: false });
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        syncNow("interval");
      }
    }, PERIODIC_SYNC_MS);

    // Expose a manual sync hook for debugging in devtools:
    // window.__forceSupabaseSync?.()
    (window as any).__forceSupabaseSync = () => syncNow("manual");

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
      delete (window as any).__forceSupabaseSync;
    };
  }, [syncNow]);

  useEffect(() => {
    const channel = supabase.channel("app-data-sync");

    TABLES_TO_WATCH.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => syncNow("realtime"),
      );
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        syncNow("realtime");
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [syncNow]);

  return null;
}

