import { useTenantModules } from "@/hooks/useTenantModules";

export function useIconStudioAccess() {
  const modules = useTenantModules();
  const isResolvingTenant = !modules.tenantId && !modules.isMasterContext;

  return {
    ...modules,
    isLoading: modules.isLoading || isResolvingTenant,
    hasAccess: modules.isMasterContext || modules.isModuleEnabled("icon-studio"),
  };
}
