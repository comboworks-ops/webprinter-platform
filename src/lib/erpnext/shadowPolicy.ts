export type ErpShadowEnvironment = "development" | "test" | "production";

export type ErpShadowPolicyReason =
  | "enabled"
  | "feature_disabled"
  | "endpoint_missing"
  | "endpoint_invalid"
  | "insecure_endpoint"
  | "non_master_context";

export interface ErpShadowPolicyInput {
  enabled: boolean;
  environment: ErpShadowEnvironment;
  endpoint?: string;
  isMasterContext: boolean;
}

export interface ErpShadowPolicyDecision {
  canDispatch: boolean;
  mode: "disabled" | "shadow";
  reason: ErpShadowPolicyReason;
  endpoint: string | null;
}

/**
 * Pure policy gate for a future server-side dispatcher.
 *
 * It does not read Vite/browser environment variables and it never returns a
 * live mode. Secrets and network calls must stay in a protected server runtime.
 */
export function evaluateErpShadowPolicy(
  input: ErpShadowPolicyInput,
): ErpShadowPolicyDecision {
  if (!input.enabled) {
    return {
      canDispatch: false,
      mode: "disabled",
      reason: "feature_disabled",
      endpoint: null,
    };
  }

  if (!input.isMasterContext) {
    return {
      canDispatch: false,
      mode: "disabled",
      reason: "non_master_context",
      endpoint: null,
    };
  }

  if (!input.endpoint?.trim()) {
    return {
      canDispatch: false,
      mode: "disabled",
      reason: "endpoint_missing",
      endpoint: null,
    };
  }

  let endpoint: URL;
  try {
    endpoint = new URL(input.endpoint);
  } catch {
    return {
      canDispatch: false,
      mode: "disabled",
      reason: "endpoint_invalid",
      endpoint: null,
    };
  }

  const isLoopback =
    endpoint.hostname === "127.0.0.1" || endpoint.hostname === "localhost";
  const secureEnough =
    endpoint.protocol === "https:" ||
    (input.environment !== "production" &&
      endpoint.protocol === "http:" &&
      isLoopback);

  if (!secureEnough) {
    return {
      canDispatch: false,
      mode: "disabled",
      reason: "insecure_endpoint",
      endpoint: null,
    };
  }

  return {
    canDispatch: true,
    mode: "shadow",
    reason: "enabled",
    endpoint: endpoint.toString(),
  };
}
