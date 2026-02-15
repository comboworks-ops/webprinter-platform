import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant, MASTER_TENANT_ID } from "@/lib/adminTenant";
import {
  MODULE_BY_ID,
  SHOP_MODULE_DEFINITIONS,
  type ModuleAccessSource,
  type ShopModuleId,
  type ShopModuleTier,
} from "@/lib/modules/catalog";

interface TenantModuleAccessRow {
  tenant_id: string;
  module_id: ShopModuleId;
  has_access: boolean;
  is_enabled: boolean;
  access_source: ModuleAccessSource;
  granted_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantModuleState {
  tenantId: string;
  moduleId: ShopModuleId;
  name: string;
  tier: ShopModuleTier;
  hasAccess: boolean;
  enabled: boolean;
  accessSource: ModuleAccessSource;
  row: TenantModuleAccessRow | null;
}

interface UseTenantModulesOptions {
  tenantId?: string | null;
}

type UpsertPayload = {
  tenantId: string;
  moduleId: ShopModuleId;
  hasAccess: boolean;
  enabled: boolean;
  accessSource: ModuleAccessSource;
  notes?: string | null;
};

const defaultStateForModule = (tenantId: string, moduleId: ShopModuleId): TenantModuleState => {
  const moduleDef = MODULE_BY_ID[moduleId];
  return {
    tenantId,
    moduleId,
    name: moduleDef.name,
    tier: moduleDef.tier,
    hasAccess: moduleDef.defaultAccess,
    enabled: moduleDef.defaultAccess && moduleDef.defaultEnabled,
    accessSource: moduleDef.defaultAccess ? "included" : "manual",
    row: null,
  };
};

export function useTenantModules(options?: UseTenantModulesOptions) {
  const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(options?.tenantId ?? null);
  const [isMasterContext, setIsMasterContext] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    if (options && Object.prototype.hasOwnProperty.call(options, "tenantId")) {
      setResolvedTenantId(options.tenantId ?? null);
      setIsMasterContext(false);
      return () => {
        active = false;
      };
    }

    resolveAdminTenant().then(({ tenantId, isMasterAdmin }) => {
      if (!active) return;
      setResolvedTenantId(tenantId);
      setIsMasterContext(Boolean(isMasterAdmin && tenantId === MASTER_TENANT_ID));
    });

    return () => {
      active = false;
    };
  }, [options?.tenantId]);

  const query = useQuery({
    queryKey: ["tenant-modules", resolvedTenantId],
    enabled: !!resolvedTenantId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tenant_module_access")
        .select("*")
        .eq("tenant_id", resolvedTenantId)
        .order("module_id", { ascending: true });

      if (error) throw error;

      const rows = (data as TenantModuleAccessRow[] | null) || [];
      const byId = new Map<ShopModuleId, TenantModuleAccessRow>();
      rows.forEach((row) => {
        if (MODULE_BY_ID[row.module_id as ShopModuleId]) {
          byId.set(row.module_id as ShopModuleId, row);
        }
      });

      const moduleStates: TenantModuleState[] = SHOP_MODULE_DEFINITIONS.map((moduleDef) => {
        const row = byId.get(moduleDef.id) || null;
        if (!row) {
          return defaultStateForModule(resolvedTenantId!, moduleDef.id);
        }
        const hasAccess = moduleDef.tier === "free" ? true : Boolean(row.has_access);
        const enabled = hasAccess && Boolean(row.is_enabled);
        const accessSource = moduleDef.tier === "free"
          ? "included"
          : (row.access_source || "manual");

        return {
          tenantId: resolvedTenantId!,
          moduleId: moduleDef.id,
          name: moduleDef.name,
          tier: moduleDef.tier,
          hasAccess,
          enabled,
          accessSource,
          row,
        };
      });

      return moduleStates;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (payload: UpsertPayload) => {
      const moduleDef = MODULE_BY_ID[payload.moduleId];
      if (!moduleDef) {
        throw new Error(`Unknown module: ${payload.moduleId}`);
      }

      const hasAccess = moduleDef.tier === "free" ? true : payload.hasAccess;
      const enabled = hasAccess && payload.enabled;
      const accessSource = moduleDef.tier === "free" ? "included" : payload.accessSource;

      const { data: authData } = await supabase.auth.getUser();
      const grantedBy = authData?.user?.id || null;

      const upsertBody = {
        tenant_id: payload.tenantId,
        module_id: payload.moduleId,
        has_access: hasAccess,
        is_enabled: enabled,
        access_source: accessSource,
        granted_by: grantedBy,
        notes: payload.notes ?? null,
      };

      const { error } = await (supabase as any)
        .from("tenant_module_access")
        .upsert(upsertBody, { onConflict: "tenant_id,module_id" });

      if (error) throw error;
      return upsertBody;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenant-modules", variables.tenantId] });
    },
  });

  const moduleStates = query.data || [];

  const moduleStateMap = useMemo(() => {
    const map = new Map<ShopModuleId, TenantModuleState>();
    moduleStates.forEach((state) => map.set(state.moduleId, state));
    return map;
  }, [moduleStates]);

  const isModuleEnabled = (moduleId: ShopModuleId): boolean => {
    const moduleState = moduleStateMap.get(moduleId);
    if (!moduleState) {
      const moduleDef = MODULE_BY_ID[moduleId];
      return moduleDef ? moduleDef.defaultAccess && moduleDef.defaultEnabled : true;
    }
    return moduleState.hasAccess && moduleState.enabled;
  };

  const getModuleState = (moduleId: ShopModuleId): TenantModuleState | null =>
    moduleStateMap.get(moduleId) || null;

  const setModuleEnabled = async (moduleId: ShopModuleId, enabled: boolean) => {
    if (!resolvedTenantId) return;
    const moduleState = getModuleState(moduleId) || defaultStateForModule(resolvedTenantId, moduleId);

    await upsertMutation.mutateAsync({
      tenantId: resolvedTenantId,
      moduleId,
      hasAccess: moduleState.hasAccess,
      enabled,
      accessSource: moduleState.accessSource,
    });
  };

  const setModuleAccess = async (
    moduleId: ShopModuleId,
    hasAccess: boolean,
    accessSource: ModuleAccessSource = "manual",
  ) => {
    if (!resolvedTenantId) return;
    const moduleDef = MODULE_BY_ID[moduleId];
    if (!moduleDef) return;
    if (moduleDef.tier === "free") {
      // Free modules are always accessible; only visibility can be changed.
      return;
    }

    const moduleState = getModuleState(moduleId) || defaultStateForModule(resolvedTenantId, moduleId);
    await upsertMutation.mutateAsync({
      tenantId: resolvedTenantId,
      moduleId,
      hasAccess,
      enabled: hasAccess ? moduleState.enabled || true : false,
      accessSource,
    });
  };

  return {
    tenantId: resolvedTenantId,
    isMasterContext,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    moduleStates,
    moduleStateMap,
    getModuleState,
    isModuleEnabled,
    refresh: query.refetch,
    setModuleEnabled,
    setModuleAccess,
    isSaving: upsertMutation.isPending,
  };
}
