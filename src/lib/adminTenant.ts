import { supabase } from "@/integrations/supabase/client";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const ROOT_DOMAIN = import.meta.env.VITE_ROOT_DOMAIN || "webprinter.dk";

interface AdminTenantResolution {
    tenantId: string | null;
    role: string | null;
    isMasterAdmin: boolean;
}

/**
 * Resolve which tenant an admin should operate on.
 * Priority:
 * 1) Explicit tenant_id on user_roles row
 * 2) Tenant owned by the user
 * 3) Master tenant if user is master_admin
 */
export async function resolveAdminTenant(): Promise<AdminTenantResolution> {
    let user = (await supabase.auth.getSession()).data.session?.user ?? null;

    if (!user) {
        try {
            user = (await supabase.auth.getUser()).data.user;
        } catch (error) {
            console.warn("[resolveAdminTenant] Failed to refresh authenticated user from Supabase:", error);
        }
    }

    if (!user) {
        console.warn("[resolveAdminTenant] No authenticated user found.");
        return { tenantId: null, role: null, isMasterAdmin: false };
    }
    console.log("[resolveAdminTenant] Resolving for user:", user.id);

    let role: string | null = null;
    let tenantId: string | null = null;
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";

    // First honor the active tenant context from the current hostname.
    // This is critical for platform-owned shops managed by a master admin.
    if (!isLocalhost && hostname) {
        const normalizedHost = hostname.replace(/^www\./, "");
        const possibleDomains = Array.from(new Set([hostname, normalizedHost, `www.${normalizedHost}`]));

        const { data: tenantByDomain } = await (supabase as any)
            .from("tenants")
            .select("id")
            .in("domain", possibleDomains)
            .maybeSingle();

        if (tenantByDomain?.id) {
            tenantId = tenantByDomain.id;
            console.log("[resolveAdminTenant] Resolved by hostname:", hostname, tenantId);
        } else if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
            const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, "");
            if (subdomain && subdomain !== "www") {
                const constructedDomain = `${subdomain}.${ROOT_DOMAIN}`;
                const { data: tenantByConstructedDomain } = await (supabase as any)
                    .from("tenants")
                    .select("id")
                    .eq("domain", constructedDomain)
                    .maybeSingle();

                if (tenantByConstructedDomain?.id) {
                    tenantId = tenantByConstructedDomain.id;
                    console.log("[resolveAdminTenant] Resolved by subdomain:", hostname, tenantId);
                }
            }
        }
    }

    // Check user_roles for role + optional tenant_id (handle multiple roles)
    const { data: roleRows } = await (supabase as any)
        .from('user_roles')
        .select('role, tenant_id')
        .eq('user_id', user.id);

    if (Array.isArray(roleRows) && roleRows.length > 0) {
        console.log("[resolveAdminTenant] Found user_roles:", roleRows);
        const hasMaster = roleRows.some((row: any) => row.role === 'master_admin');
        const preferred = roleRows.find((row: any) => row.tenant_id && row.tenant_id === tenantId)
            || roleRows.find((row: any) => row.tenant_id)
            || roleRows[0];
        role = hasMaster ? 'master_admin' : preferred?.role || null;
        tenantId = tenantId || preferred?.tenant_id || null;
    }

    // If no tenant yet, try owned tenant
    if (!tenantId) {
        const { data: owned } = await supabase
            .from('tenants' as any)
            .select('id')
            .eq('owner_id', user.id)
            .neq('id', MASTER_TENANT_ID) // FIX: Ignore Master Tenant (even if owned) to find the REAL shop
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        console.log("[resolveAdminTenant] Fallback owned tenant:", owned);

        if (owned) {
            tenantId = (owned as any).id;
        }
    }

    // FIX: Only default to Master if we STILL don't have a tenant ID.
    // If the user owns a shop (like Salgsmapper), `tenantId` is already set above.
    // We should NOT overwrite it with MASTER_TENANT_ID.

    // Only fall back if completely unresolved
    const isMasterAdmin = role === 'master_admin';
    if (!tenantId && isMasterAdmin) {
        tenantId = MASTER_TENANT_ID;
    }

    // Ensure we don't accidentally return Master ID if we found a specific one
    if (tenantId && tenantId !== MASTER_TENANT_ID && isMasterAdmin) {
        // User is a master admin but viewing a specific shop (Salgsmapper)
        // Keep tenantId as Salgsmapper, but keep role as master_admin (so they have powers)
        // This is correct.
    }

    const result = { tenantId, role, isMasterAdmin };
    console.log("[resolveAdminTenant] Final Resolution:", result);
    return result;
}

export { MASTER_TENANT_ID };
