import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

import { requireUser } from "../_shared/auth.ts";
import { jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const COMPANY_ROLES = new Set([
  "company_owner",
  "company_admin",
  "company_approver",
  "company_buyer",
  "company_viewer",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InviteMemberRequest = {
  tenantId?: unknown;
  companyId?: unknown;
  email?: unknown;
  role?: unknown;
  isAllOffices?: unknown;
  officeIds?: unknown;
  redirectTo?: unknown;
};

type CompanyRow = {
  id: string;
  name: string;
  tenant_id: string;
  status: string;
};

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeInviteRedirect(value: unknown, requestOrigin: string | null): string | undefined {
  const candidate = normalizedText(value);
  if (!candidate || !requestOrigin) return undefined;

  try {
    const redirect = new URL(candidate);
    const origin = new URL(requestOrigin);
    if (!['http:', 'https:'].includes(redirect.protocol)) return undefined;
    if (redirect.origin !== origin.origin || redirect.pathname !== "/auth") return undefined;
    return redirect.toString();
  } catch {
    return undefined;
  }
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function findUserByEmail(serviceClient: SupabaseClient, email: string): Promise<User | null> {
  const { data: profiles, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, email")
    .ilike("email", escapeLikePattern(email))
    .limit(2);

  if (profileError) throw profileError;
  if ((profiles || []).length > 1) {
    throw new Error("Flere brugere har samme e-mail. Kontakt support før invitationen fortsættes.");
  }

  const profileId = profiles?.[0]?.id;
  if (profileId) {
    const { data, error } = await serviceClient.auth.admin.getUserById(profileId);
    if (!error && data.user) return data.user;
  }

  // The profile trigger covers normal users. Pagination is a fallback for older
  // accounts whose profile was never created or whose e-mail was not synced.
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 1000) return null;
  }

  throw new Error("Brugerlisten er for stor til et sikkert e-mailopslag.");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return methodNotAllowed();

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json() as InviteMemberRequest;
    const tenantId = normalizedText(body.tenantId);
    const companyId = normalizedText(body.companyId);
    const email = normalizedText(body.email).toLowerCase();
    const role = normalizedText(body.role);
    const isAllOffices = body.isAllOffices !== false;
    const officeIds = Array.isArray(body.officeIds)
      ? [...new Set(body.officeIds.map(normalizedText).filter(Boolean))]
      : [];

    if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(companyId)) {
      return jsonResponse({ error: "Firma eller tenant er ugyldig." }, 400);
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 255) {
      return jsonResponse({ error: "Indtast en gyldig e-mailadresse." }, 400);
    }
    if (!COMPANY_ROLES.has(role)) {
      return jsonResponse({ error: "Den valgte rolle er ugyldig." }, 400);
    }
    if (officeIds.some((officeId) => !UUID_PATTERN.test(officeId))) {
      return jsonResponse({ error: "Et eller flere kontorer er ugyldige." }, 400);
    }
    if (!isAllOffices && officeIds.length === 0) {
      return jsonResponse({ error: "Vælg mindst ét kontor til medlemmet." }, 400);
    }

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth.authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: canManage, error: permissionError } = await callerClient.rpc(
      "company_hub_can_manage",
      { _tenant_id: tenantId, _company_id: companyId },
    );

    if (permissionError) {
      console.error("Company Hub invite permission check failed", permissionError);
      return jsonResponse({ error: "Adgangen kunne ikke kontrolleres." }, 500);
    }
    if (canManage !== true) {
      return jsonResponse({ error: "Du har ikke adgang til at invitere medlemmer til firmaet." }, 403);
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: company, error: companyError } = await serviceClient
      .from("company_accounts")
      .select("id, tenant_id, name, status")
      .eq("id", companyId)
      .eq("tenant_id", tenantId)
      .neq("status", "archived")
      .maybeSingle<CompanyRow>();

    if (companyError) throw companyError;
    if (!company) return jsonResponse({ error: "Firmaet findes ikke længere." }, 404);

    if (!isAllOffices) {
      const { data: offices, error: officeError } = await serviceClient
        .from("company_offices")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("company_id", companyId)
        .eq("status", "active")
        .in("id", officeIds);
      if (officeError) throw officeError;

      const validOfficeIds = new Set((offices || []).map((office) => office.id));
      if (validOfficeIds.size !== officeIds.length) {
        return jsonResponse({ error: "Et valgt kontor findes ikke længere." }, 400);
      }
    }

    let user = await findUserByEmail(serviceClient, email);
    let invitationSent = false;

    if (!user) {
      const redirectTo = safeInviteRedirect(body.redirectTo, req.headers.get("origin"));
      const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
        ...(redirectTo ? { redirectTo } : {}),
        data: {
          company_hub_invite: true,
          company_hub_company_id: companyId,
          company_hub_tenant_id: tenantId,
          company_hub_company_name: company.name,
        },
      });
      if (error) throw error;
      user = data.user;
      invitationSent = true;
    }

    if (!user?.id) throw new Error("Brugeren kunne ikke oprettes.");

    const { error: memberError } = await serviceClient
      .from("company_members")
      .upsert({
        tenant_id: tenantId,
        company_id: companyId,
        user_id: user.id,
        role,
        status: "active",
        is_all_offices: isAllOffices,
      }, { onConflict: "company_id,user_id" });
    if (memberError) throw memberError;

    const { error: clearScopeError } = await serviceClient
      .from("company_member_offices")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("company_id", companyId)
      .eq("user_id", user.id);
    if (clearScopeError) throw clearScopeError;

    if (!isAllOffices) {
      const { error: officeScopeError } = await serviceClient
        .from("company_member_offices")
        .insert(officeIds.map((officeId) => ({
          tenant_id: tenantId,
          company_id: companyId,
          user_id: user!.id,
          office_id: officeId,
        })));
      if (officeScopeError) throw officeScopeError;
    }

    return jsonResponse({
      success: true,
      email,
      userId: user.id,
      invitationSent,
      existingUser: !invitationSent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invitationen kunne ikke sendes.";
    console.error("Company Hub member invitation failed", message);
    return jsonResponse({ error: message }, 400);
  }
});
