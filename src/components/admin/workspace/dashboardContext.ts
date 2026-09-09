interface DashboardTenantRow {
    id: string;
    name: string | null;
    settings: unknown;
}

interface DashboardContextDependencies {
    resolveTenant: () => Promise<{ tenantId: string | null }>;
    readTenant: (tenantId: string) => Promise<{ data: DashboardTenantRow | null; error: unknown }>;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

/** Keep the admin scope and the displayed shop identity in one successful lookup. */
export function dashboardContextQueryOptions(contextKey: string, dependencies: DashboardContextDependencies) {
    return {
        queryKey: ["workspace-dashboard-context", contextKey],
        // Do not retain an identity across unmount/sign-in or substitute storefront defaults.
        gcTime: 0,
        retry: false as const,
        queryFn: async () => {
            const { tenantId } = await dependencies.resolveTenant();
            if (!tenantId) return null;

            const { data: tenant, error } = await dependencies.readTenant(tenantId);
            if (error) throw error;
            if (!tenant || tenant.id !== tenantId) {
                throw new Error("Den valgte shop kunne ikke hentes.");
            }

            const branding = asRecord(asRecord(tenant.settings).branding);
            const visibleBranding = asRecord(branding.published || branding.draft || branding);
            return {
                tenantId,
                name: tenant.name || "Din webshop",
                logoUrl: typeof visibleBranding.logo_url === "string" ? visibleBranding.logo_url : null,
            };
        },
    };
}
