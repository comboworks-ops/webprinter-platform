import { supabase } from "@/integrations/supabase/client";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { tenantId: null, role: null, isMasterAdmin: false };
    }

    let role: string | null = null;
    let tenantId: string | null = null;

    // Check user_roles for role + optional tenant_id (handle multiple roles)
    const { data: roleRows } = await (supabase as any)
        .from('user_roles')
        .select('role, tenant_id')
        .eq('user_id', user.id);

    if (Array.isArray(roleRows) && roleRows.length > 0) {
        const hasMaster = roleRows.some((row: any) => row.role === 'master_admin');
        const preferred = roleRows.find((row: any) => row.tenant_id) || roleRows[0];
        role = hasMaster ? 'master_admin' : preferred?.role || null;
        tenantId = preferred?.tenant_id || null;
    }

    // If no tenant yet, try owned tenant
    if (!tenantId) {
        const { data: owned } = await supabase
            .from('tenants' as any)
            .select('id')
            .eq('owner_id', user.id)
            .maybeSingle();
        if (owned) {
            tenantId = (owned as any).id;
        }
    }

    // Master fallback for master admins
    const isMasterAdmin = role === 'master_admin';
    if (!tenantId && isMasterAdmin) {
        tenantId = MASTER_TENANT_ID;
    }

    return { tenantId, role, isMasterAdmin };
}

export { MASTER_TENANT_ID };
