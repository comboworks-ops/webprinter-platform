type ReadEnvironment = (name: string) => string | undefined;
type KeyKind = "publishable" | "secret";

/** Resolve credentials without changing user authentication or caller permissions. */
export function readSupabaseKey(readEnv: ReadEnvironment, kind: KeyKind): string | undefined {
  const prefix = `sb_${kind}_`;
  const singular = kind === "secret" ? "SUPABASE_SECRET_KEY" : "SUPABASE_PUBLISHABLE_KEY";
  const plural = kind === "secret" ? "SUPABASE_SECRET_KEYS" : "SUPABASE_PUBLISHABLE_KEYS";
  const explicit = readEnv(singular)?.trim();
  if (explicit) return validateModernKey(explicit, prefix);

  const dictionary = readEnv(plural)?.trim();
  if (dictionary) {
    let parsed: unknown;
    try { parsed = JSON.parse(dictionary); } catch { throw configurationError(); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw configurationError();
    // Never select an arbitrary key when the configured/default name is absent.
    const name = readEnv(`WEBPRINTER_SUPABASE_${kind.toUpperCase()}_KEY_NAME`)?.trim() || "default";
    if (!Object.prototype.hasOwnProperty.call(parsed, name)) throw configurationError();
    return validateModernKey((parsed as Record<string, unknown>)[name], prefix);
  }

  if (readEnv("DENO_DEPLOYMENT_ID") || readEnv("WEBPRINTER_REQUIRE_MODERN_SUPABASE_KEYS") === "true") throw configurationError();
  // Compatibility for local Supabase only; migrated hosted functions require modern keys.
  // A present but invalid modern configuration never falls back to a legacy key.
  return readEnv(kind === "secret" ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY")?.trim() || undefined;
}

function validateModernKey(value: unknown, prefix: string): string {
  if (typeof value !== "string" || !value.startsWith(prefix) || value.length <= prefix.length
    || /\s/.test(value)) throw configurationError();
  return value;
}

function configurationError(): Error {
  // Do not put key values or raw JSON parse errors in logs/responses.
  return new Error("supabase_key_configuration_invalid");
}
