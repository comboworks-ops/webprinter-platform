export type PlatformLegalDocumentType = "platform_terms" | "privacy_policy";

export const PLATFORM_TERMS_VERSION = "2026-03-23";
export const PLATFORM_PRIVACY_VERSION = "2026-03-23";

export const PLATFORM_TERMS_ROUTE = "/handelsbetingelser";
export const PLATFORM_PRIVACY_ROUTE = "/privacy-policy";

export interface PlatformLegalAcceptanceRow {
  tenant_id: string;
  document_type: PlatformLegalDocumentType;
  document_version: string;
  accepted_at: string;
  accepted_by_user_id: string;
  accepted_email: string;
  source: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
}

export function buildPlatformLegalAcceptanceRows(input: {
  tenantId: string;
  userId: string;
  email: string;
  source?: string;
  userAgent?: string | null;
}): PlatformLegalAcceptanceRow[] {
  const acceptedAt = new Date().toISOString();
  const source = input.source || "tenant_signup";
  const base = {
    tenant_id: input.tenantId,
    accepted_at: acceptedAt,
    accepted_by_user_id: input.userId,
    accepted_email: input.email,
    source,
    ip_address: null,
    user_agent: input.userAgent || null,
  };

  return [
    {
      ...base,
      document_type: "platform_terms",
      document_version: PLATFORM_TERMS_VERSION,
      metadata: {
        document_path: PLATFORM_TERMS_ROUTE,
      },
    },
    {
      ...base,
      document_type: "privacy_policy",
      document_version: PLATFORM_PRIVACY_VERSION,
      metadata: {
        document_path: PLATFORM_PRIVACY_ROUTE,
      },
    },
  ];
}
