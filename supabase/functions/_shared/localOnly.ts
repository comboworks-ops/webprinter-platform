import { jsonResponse } from "./http.ts";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const LOCAL_ENVIRONMENTS = new Set(["local", "development", "test"]);
const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "kong", "host.docker.internal"]);
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "db", "host.docker.internal"]);

function isLocalUrl(value: string, hosts: Set<string>, protocols: string[]): boolean {
  try {
    const url = new URL(value);
    return hosts.has(url.hostname) && protocols.includes(url.protocol);
  } catch {
    return false;
  }
}

function matchesSecret(expected: string, actual: string): boolean {
  if (expected.length < 32 || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
}

function envFlag(name: string): boolean {
  return TRUE_VALUES.has(String(Deno.env.get(name) || "").toLowerCase());
}

export function requireLocalOnly(req: Request): Response | null {
  const allowLocalTools = envFlag("ALLOW_LOCAL_DEV_FUNCTIONS");
  const deploymentEnv = String(Deno.env.get("DEPLOYMENT_ENV") || Deno.env.get("ENVIRONMENT") || "").toLowerCase();
  const configuredSecret = Deno.env.get("LOCAL_FUNCTION_SECRET") || "";
  const providedSecret = req.headers.get("x-local-function-secret") || "";

  if (!allowLocalTools) {
    return jsonResponse({ error: "Function disabled" }, 403);
  }

  // Trusted runtime configuration, never the caller's Host/Origin header.
  // Even an accidentally copied opt-in/secret must not enable hosted tools.
  const environments = [Deno.env.get("DEPLOYMENT_ENV"), Deno.env.get("ENVIRONMENT")].filter(Boolean);
  const databaseUrl = Deno.env.get("SUPABASE_DB_URL");
  if (Deno.env.get("DENO_DEPLOYMENT_ID") || !LOCAL_ENVIRONMENTS.has(deploymentEnv) ||
    environments.some(value => !LOCAL_ENVIRONMENTS.has(value!.toLowerCase())) ||
    !isLocalUrl(Deno.env.get("SUPABASE_URL") || "", LOCAL_API_HOSTS, ["http:", "https:"]) ||
    (databaseUrl && !isLocalUrl(databaseUrl, LOCAL_DB_HOSTS, ["postgres:", "postgresql:"]))) {
    return jsonResponse({ error: "Function disabled outside local development" }, 403);
  }

  if (!matchesSecret(configuredSecret, providedSecret)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  return null;
}
