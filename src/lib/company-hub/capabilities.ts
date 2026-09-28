import type { SupabaseClient } from "@supabase/supabase-js";

export type CompanyHubCapability =
  | { status: "available" }
  | { status: "unavailable"; reason: "migration_missing" }
  | { status: "error"; code: string | null; message: string };

interface DatabaseErrorLike {
  code?: string | null;
  message?: string | null;
}

const MISSING_V2_CODES = new Set(["42P01", "42703", "PGRST204", "PGRST205"]);

function readError(error: unknown): DatabaseErrorLike {
  if (!error || typeof error !== "object") return {};
  return error as DatabaseErrorLike;
}

export function classifyCompanyHubCapability(error: unknown): CompanyHubCapability {
  if (!error) return { status: "available" };

  const databaseError = readError(error);
  const code = databaseError.code || null;
  if (code && MISSING_V2_CODES.has(code)) {
    return { status: "unavailable", reason: "migration_missing" };
  }

  return {
    status: "error",
    code,
    message: "Firmahubben kunne ikke kontrolleres lige nu. Prøv igen om et øjeblik.",
  };
}

export async function detectCompanyHubV2(
  client: Pick<SupabaseClient, "from">,
): Promise<CompanyHubCapability> {
  try {
    const { error } = await (client as any)
      .from("company_offices")
      .select("id", { count: "exact", head: true })
      .limit(1);

    return classifyCompanyHubCapability(error);
  } catch (error) {
    return classifyCompanyHubCapability(error);
  }
}
