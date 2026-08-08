import {
  type BusinessEvidenceStatus,
  normalizeBusinessEvidenceState,
} from "./danishBusinessIdentity.ts";

export type TenantBusinessEvidenceDisplay = Readonly<{
  normalizedIdentifier: string;
  status: BusinessEvidenceStatus;
  provider: string | null;
  checkedAt: string | null;
}>;

type EvidenceRow = Readonly<{
  normalized_identifier: unknown;
  result_status: unknown;
  provider: unknown;
  checked_at: unknown;
}>;

export type TenantBusinessEvidenceReadQuery = Readonly<{
  eq: (column: string, value: string) => TenantBusinessEvidenceReadQuery;
  in: (
    column: string,
    values: readonly string[],
  ) => TenantBusinessEvidenceReadQuery;
  order: (
    column: string,
    options: Readonly<{ ascending: boolean }>,
  ) => TenantBusinessEvidenceReadQuery;
  limit: (value: number) => TenantBusinessEvidenceReadQuery;
  maybeSingle: () => Promise<
    Readonly<{
      data: EvidenceRow | null;
      error: unknown;
    }>
  >;
}>;

export type TenantBusinessEvidenceReadClient = Readonly<{
  from: (table: "tenant_business_evidence") => Readonly<{
    select: (columns: string) => TenantBusinessEvidenceReadQuery;
  }>;
}>;

export async function readLatestTenantBusinessEvidence(
  client: TenantBusinessEvidenceReadClient,
  tenantId: string,
  normalizedIdentifier: string | null,
): Promise<TenantBusinessEvidenceDisplay | null> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(tenantId) ||
    typeof normalizedIdentifier !== "string" ||
    !/^DK\d{8}$/.test(normalizedIdentifier)
  ) {
    return null;
  }
  try {
    const { data, error } = await client
      .from("tenant_business_evidence")
      .select("normalized_identifier,result_status,provider,checked_at")
      .eq("tenant_id", tenantId)
      .in("evidence_type", ["vies", "danish_company"])
      .eq("normalized_identifier", normalizedIdentifier)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (
      error || !data || data.normalized_identifier !== normalizedIdentifier
    ) {
      return null;
    }
    return Object.freeze({
      normalizedIdentifier,
      status: normalizeBusinessEvidenceState(data.result_status).status,
      provider: boundedDisplayText(data.provider, 80),
      checkedAt: readIsoInstant(data.checked_at),
    });
  } catch {
    return null;
  }
}

function boundedDisplayText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text && text.length <= maximum ? text : null;
}

function readIsoInstant(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
