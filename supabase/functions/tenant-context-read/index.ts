import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const ROOT_DOMAIN = Deno.env.get("ROOT_DOMAIN") || Deno.env.get("VITE_ROOT_DOMAIN") || "webprinter.dk";

type ResolveMode = "storefront" | "admin";

type TenantRow = {
  id: string;
  name: string;
  domain: string | null;
  settings: Record<string, unknown> | null;
  owner_id: string | null;
};

type UserRoleRow = {
  role: string | null;
  tenant_id: string | null;
};

type RequestInput = {
  mode?: ResolveMode;
  hostname?: string | null;
  pathname?: string | null;
  tenantId?: string | null;
  tenant_id?: string | null;
  force_domain?: string | null;
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeHostname(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function getDomainVariants(value: string | null | undefined): string[] {
  const normalized = normalizeHostname(value);
  if (!normalized) return [];
  const withoutWww = normalized.replace(/^www\./, "");
  return Array.from(new Set([normalized, withoutWww, `www.${withoutWww}`]));
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isPlatformRoot(hostname: string): boolean {
  return hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`;
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function getActiveSiteId(settings: Record<string, unknown> | null | undefined): string | null {
  const siteFrontends = settings?.site_frontends as Record<string, unknown> | undefined;
  const activeSiteId = siteFrontends?.activeSiteId;
  return typeof activeSiteId === "string" && activeSiteId.trim() ? activeSiteId : null;
}

function pickRequestInput(req: Request, url: URL, body: RequestInput): Required<RequestInput> {
  const headerHost = normalizeHostname(
    req.headers.get("x-forwarded-host")
    || req.headers.get("host")
    || url.searchParams.get("hostname")
    || body.hostname,
  );

  return {
    mode: (body.mode || url.searchParams.get("mode") || "storefront") as ResolveMode,
    hostname: headerHost,
    pathname: String(body.pathname || url.searchParams.get("pathname") || ""),
    tenantId: String(body.tenantId || body.tenant_id || url.searchParams.get("tenantId") || url.searchParams.get("tenant_id") || ""),
    tenant_id: String(body.tenant_id || url.searchParams.get("tenant_id") || ""),
    force_domain: String(body.force_domain || url.searchParams.get("force_domain") || ""),
  };
}

async function parseRequestBody(req: Request): Promise<RequestInput> {
  if (req.method === "GET") return {};
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};
    return (await req.json()) as RequestInput;
  } catch {
    return {};
  }
}

async function findTenantById(serviceClient: ReturnType<typeof createClient>, tenantId: string | null | undefined): Promise<TenantRow | null> {
  const id = String(tenantId || "").trim();
  if (!id) return null;
  const { data } = await serviceClient
    .from("tenants")
    .select("id, name, domain, settings, owner_id")
    .eq("id", id)
    .maybeSingle();
  return (data as TenantRow | null) ?? null;
}

async function findTenantByDomain(serviceClient: ReturnType<typeof createClient>, domain: string | null | undefined): Promise<TenantRow | null> {
  const variants = getDomainVariants(domain);
  if (!variants.length) return null;
  const { data } = await serviceClient
    .from("tenants")
    .select("id, name, domain, settings, owner_id")
    .in("domain", variants)
    .limit(1)
    .maybeSingle();
  if (data) return data as TenantRow;

  const normalized = variants[0].replace(/^www\./, "");
  if (normalized && normalized.endsWith(`.${ROOT_DOMAIN}`)) {
    const { data: byConstructedDomain } = await serviceClient
      .from("tenants")
      .select("id, name, domain, settings, owner_id")
      .eq("domain", normalized)
      .maybeSingle();
    return (byConstructedDomain as TenantRow | null) ?? null;
  }

  return null;
}

async function getAuthenticatedUser(supabaseUrl: string, anonKey: string, authHeader: string | null): Promise<{ id: string; email?: string | null } | null> {
  if (!authHeader) return null;
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  return user ? { id: user.id, email: user.email } : null;
}

async function getUserRoles(serviceClient: ReturnType<typeof createClient>, userId: string): Promise<UserRoleRow[]> {
  const { data } = await serviceClient
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", userId);
  return (data as UserRoleRow[] | null) ?? [];
}

async function getOwnedTenant(serviceClient: ReturnType<typeof createClient>, userId: string): Promise<TenantRow | null> {
  const { data } = await serviceClient
    .from("tenants")
    .select("id, name, domain, settings, owner_id")
    .eq("owner_id", userId)
    .neq("id", MASTER_TENANT_ID)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as TenantRow | null) ?? null;
}

function pickRoleForTenant(roles: UserRoleRow[], tenantId: string | null): { role: string | null; isMasterAdmin: boolean } {
  const isMasterAdmin = roles.some((row) => row.role === "master_admin");
  const matchingRole = (tenantId
    ? roles.find((row) => row.tenant_id === tenantId)
    : null)
    || roles.find((row) => row.role === "master_admin")
    || roles.find((row) => row.tenant_id)
    || roles[0]
    || null;

  return {
    role: matchingRole?.role || null,
    isMasterAdmin,
  };
}

async function resolveStorefrontTenant(
  serviceClient: ReturnType<typeof createClient>,
  input: Required<RequestInput>,
): Promise<{ tenant: TenantRow | null; source: string }> {
  const explicitTenantId = input.tenantId || input.tenant_id;
  if (explicitTenantId) {
    const tenant = await findTenantById(serviceClient, explicitTenantId);
    return { tenant, source: tenant ? "tenant_id" : "tenant_id_missing" };
  }

  if (input.force_domain) {
    const tenant = await findTenantByDomain(serviceClient, input.force_domain);
    return { tenant, source: tenant ? "force_domain" : "force_domain_missing" };
  }

  if (input.hostname && !isLocalhost(input.hostname) && !isPlatformRoot(input.hostname)) {
    const tenant = await findTenantByDomain(serviceClient, input.hostname);
    return { tenant, source: tenant ? "hostname" : "hostname_missing" };
  }

  const masterTenant = await findTenantById(serviceClient, MASTER_TENANT_ID);
  return { tenant: masterTenant, source: "master_fallback" };
}

async function resolveAdminTenant(
  serviceClient: ReturnType<typeof createClient>,
  input: Required<RequestInput>,
  user: { id: string; email?: string | null } | null,
): Promise<{ tenant: TenantRow | null; source: string; roles: UserRoleRow[] }> {
  const roles = user ? await getUserRoles(serviceClient, user.id) : [];

  const explicitTenantId = input.tenantId || input.tenant_id;
  if (explicitTenantId) {
    const tenant = await findTenantById(serviceClient, explicitTenantId);
    return { tenant, source: tenant ? "tenant_id" : "tenant_id_missing", roles };
  }

  if (input.force_domain) {
    const tenant = await findTenantByDomain(serviceClient, input.force_domain);
    return { tenant, source: tenant ? "force_domain" : "force_domain_missing", roles };
  }

  const centralAdminHost = isLocalhost(input.hostname) || isPlatformRoot(input.hostname);
  const honorHostnameTenant = input.hostname && !isLocalhost(input.hostname) && !(isAdminRoute(input.pathname) && centralAdminHost);
  if (honorHostnameTenant) {
    const tenant = await findTenantByDomain(serviceClient, input.hostname);
    if (tenant) {
      return { tenant, source: "hostname", roles };
    }
  }

  if (user) {
    const roleTenantId = roles.find((row) => row.tenant_id)?.tenant_id || null;
    if (roleTenantId) {
      const tenant = await findTenantById(serviceClient, roleTenantId);
      if (tenant) {
        return { tenant, source: "user_role", roles };
      }
    }

    const ownedTenant = await getOwnedTenant(serviceClient, user.id);
    if (ownedTenant) {
      return { tenant: ownedTenant, source: "owned_tenant", roles };
    }
  }

  const isMasterAdmin = roles.some((row) => row.role === "master_admin");
  if (isMasterAdmin) {
    const masterTenant = await findTenantById(serviceClient, MASTER_TENANT_ID);
    return { tenant: masterTenant, source: "master_fallback", roles };
  }

  return { tenant: null, source: "unresolved", roles };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonResponse(500, { error: "Missing Supabase environment configuration" });
    }

    const url = new URL(req.url);
    const body = await parseRequestBody(req);
    const input = pickRequestInput(req, url, body);
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const user = await getAuthenticatedUser(supabaseUrl, anonKey, authHeader);

    const mode: ResolveMode = input.mode === "admin" ? "admin" : "storefront";
    const resolution = mode === "admin"
      ? await resolveAdminTenant(serviceClient, input, user)
      : { ...(await resolveStorefrontTenant(serviceClient, input)), roles: user ? await getUserRoles(serviceClient, user.id) : [] };

    const tenant = resolution.tenant;
    const roleInfo = pickRoleForTenant(resolution.roles, tenant?.id || null);
    const hasTenantAccess = Boolean(
      tenant && user && (
        roleInfo.isMasterAdmin
        || resolution.roles.some((row) => row.tenant_id === tenant.id)
        || tenant.owner_id === user.id
      ),
    );

    return jsonResponse(200, {
      success: true,
      mode,
      source: resolution.source,
      request: {
        hostname: input.hostname || null,
        pathname: input.pathname || null,
        tenantId: input.tenantId || input.tenant_id || null,
        forceDomain: input.force_domain || null,
        rootDomain: ROOT_DOMAIN,
        isLocalhost: isLocalhost(input.hostname),
        isPlatformRoot: isPlatformRoot(input.hostname),
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            isMasterTenant: tenant.id === MASTER_TENANT_ID,
            activeSiteId: getActiveSiteId(tenant.settings),
          }
        : null,
      auth: {
        isAuthenticated: Boolean(user),
        userId: user?.id ?? null,
        email: user?.email ?? null,
        role: roleInfo.role,
        isMasterAdmin: roleInfo.isMasterAdmin,
        hasTenantAccess,
      },
    });
  } catch (error) {
    console.error("tenant-context-read error:", error);
    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
