import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse } from "../_shared/http.ts";
import { requireRole } from "../_shared/auth.ts";
import { requireLocalOnly } from "../_shared/localOnly.ts";

console.log("Create Admin User Function Invoked");

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  const localOnlyError = requireLocalOnly(req);
  if (localOnlyError) return localOnlyError;

  const role = await requireRole(req, ["master_admin"]);
  if (!role.ok) return role.response;

  try {
    const { email, password } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return jsonResponse({ error: "Email and password required" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string | undefined;
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find((user) => user.email?.toLowerCase() === normalizedEmail);

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: userData, error: createError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;
      userId = userData.user?.id;
    }

    if (!userId) throw new Error("Could not obtain User ID");

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert(
        { user_id: userId, role: "admin" },
        { onConflict: "user_id, role" },
      );

    if (roleError) throw roleError;

    return jsonResponse({
      success: true,
      message: `Admin user ${normalizedEmail} created/updated successfully`,
      userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create admin user";
    console.error("Create admin user error:", message);
    return jsonResponse({ error: message }, 400);
  }
});
