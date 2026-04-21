function readBooleanEnvFlag(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

// Repo docs refer to USE_API_TENANT_CONTEXT. In Vite, the env variable must be prefixed with VITE_.
export const USE_API_TENANT_CONTEXT = readBooleanEnvFlag(import.meta.env.VITE_USE_API_TENANT_CONTEXT);

// Switch POD v2 master submission between the legacy 7-step fictional-API
// adapter (`pod2-submit-to-printcom`) and the real single-call adapter
// (`pod2-order-submit`). Defaults to the new adapter; flip the env var to
// "false" to roll back if the new flow misbehaves. Both edge functions
// remain deployed until the new one has put real orders through.
const rawPod2UseOrderSubmit = import.meta.env.VITE_USE_POD2_ORDER_SUBMIT;
export const USE_POD2_ORDER_SUBMIT = rawPod2UseOrderSubmit === undefined
    ? true
    : readBooleanEnvFlag(rawPod2UseOrderSubmit);
