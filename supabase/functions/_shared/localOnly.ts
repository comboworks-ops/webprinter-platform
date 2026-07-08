import { jsonResponse } from "./http.ts";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

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

  if (deploymentEnv === "production" || deploymentEnv === "prod") {
    return jsonResponse({ error: "Function disabled in production" }, 403);
  }

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  return null;
}
