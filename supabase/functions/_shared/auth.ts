import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse } from "./http.ts";

export type VerifiedUser = {
  id: string;
  email?: string;
};

export type AuthResult =
  | { ok: true; user: VerifiedUser; authHeader: string }
  | { ok: false; response: Response };

export type RoleResult =
  | { ok: true; user: VerifiedUser; roles: Array<{ role: string; tenant_id: string | null }> }
  | { ok: false; response: Response };

export async function requireUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  return { ok: true, authHeader, user: { id: user.id, email: user.email ?? undefined } };
}

export async function requireRole(
  req: Request,
  allowedRoles: string[],
  tenantId?: string,
): Promise<RoleResult> {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: roles, error } = await serviceClient
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", auth.user.id);

  if (error) {
    return { ok: false, response: jsonResponse({ error: "Could not verify role" }, 500) };
  }

  const normalizedRoles = (roles || []) as Array<{ role: string; tenant_id: string | null }>;
  const isAllowed = normalizedRoles.some((entry) => {
    if (!allowedRoles.includes(entry.role)) return false;
    if (entry.role === "master_admin") return true;
    return !tenantId || entry.tenant_id === tenantId;
  });

  if (!isAllowed) {
    return { ok: false, response: jsonResponse({ error: "Forbidden" }, 403) };
  }

  return { ok: true, user: auth.user, roles: normalizedRoles };
}
