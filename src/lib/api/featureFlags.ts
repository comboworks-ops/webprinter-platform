function readBooleanEnvFlag(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

// Repo docs refer to USE_API_TENANT_CONTEXT. In Vite, the env variable must be prefixed with VITE_.
export const USE_API_TENANT_CONTEXT = readBooleanEnvFlag(import.meta.env.VITE_USE_API_TENANT_CONTEXT);
