export const ERP_SHADOW_SCHEMA_VERSION = "1.0" as const;
export const ERP_SHADOW_EVENT_TYPE =
  "webprinter.production_order.shadow_requested" as const;

export type ErpShadowMode = "disabled" | "synthetic" | "shadow";

type JsonRecord = Record<string, unknown>;

const forbiddenKeys = new Set([
  "address",
  "billingaddress",
  "cardnumber",
  "credential",
  "customeremail",
  "customername",
  "email",
  "emailaddress",
  "mobile",
  "password",
  "paymentdetails",
  "phone",
  "postaladdress",
  "secret",
  "shippingaddress",
  "telephone",
  "token",
]);

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown, maximum = 200): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum;
}

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey);
  if (!isRecord(value)) return false;

  return Object.entries(value).some(([key, nestedValue]) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return forbiddenKeys.has(normalized) || containsForbiddenKey(nestedValue);
  });
}

export function validateErpShadowEvent(input: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(input)) return ["event must be an object"];

  if (input.schemaVersion !== ERP_SHADOW_SCHEMA_VERSION) {
    errors.push("unsupported schemaVersion");
  }
  if (input.eventType !== ERP_SHADOW_EVENT_TYPE) {
    errors.push("unsupported eventType");
  }
  if (input.sourceSystem !== "webprinter") errors.push("invalid sourceSystem");
  if (input.effect !== "shadow_only") errors.push("live effects are forbidden");
  if (!nonEmptyString(input.eventId)) errors.push("invalid eventId");
  if (!nonEmptyString(input.idempotencyKey)) {
    errors.push("invalid idempotencyKey");
  }
  if (
    !nonEmptyString(input.occurredAt) ||
    Number.isNaN(Date.parse(input.occurredAt))
  ) {
    errors.push("invalid occurredAt");
  }

  const source = input.source;
  let expectedIdempotencyKey = "";
  if (
    !isRecord(source) ||
    !nonEmptyString(source.tenantId) ||
    !nonEmptyString(source.orderId) ||
    !Number.isInteger(source.revision) ||
    Number(source.revision) < 0
  ) {
    errors.push("invalid source");
  } else {
    expectedIdempotencyKey = [
      "webprinter",
      source.tenantId,
      "production-order",
      source.orderId,
      `revision-${source.revision}`,
    ].join(":");
  }

  if (
    input.eventId !== input.idempotencyKey ||
    (expectedIdempotencyKey &&
      input.idempotencyKey !== expectedIdempotencyKey)
  ) {
    errors.push("idempotencyKey does not match the source identity");
  }

  const payload = input.payload;
  if (!isRecord(payload)) {
    errors.push("invalid payload");
  } else {
    if (
      typeof payload.currency !== "string" ||
      !/^[A-Z]{3}$/.test(payload.currency)
    ) {
      errors.push("invalid currency");
    }
    if (
      !Number.isFinite(payload.totalSellingPrice) ||
      Number(payload.totalSellingPrice) < 0
    ) {
      errors.push("invalid totalSellingPrice");
    }

    if (
      !Array.isArray(payload.lines) ||
      payload.lines.length < 1 ||
      payload.lines.length > 250
    ) {
      errors.push("invalid lines");
    } else {
      payload.lines.forEach((candidate, index) => {
        if (!isRecord(candidate)) {
          errors.push(`invalid line at index ${index}`);
          return;
        }
        if (
          !nonEmptyString(candidate.sourceOrderItemId) ||
          !nonEmptyString(candidate.sourceProductId) ||
          !nonEmptyString(candidate.title, 500) ||
          !Number.isInteger(candidate.quantity) ||
          Number(candidate.quantity) <= 0 ||
          !Number.isFinite(candidate.unitSellingPrice) ||
          Number(candidate.unitSellingPrice) < 0
        ) {
          errors.push(`invalid line at index ${index}`);
        }
      });
    }

    const production = payload.production;
    if (
      !isRecord(production) ||
      production.inventoryPosting !== "disabled"
    ) {
      errors.push("inventory posting must be disabled");
    }
    const accounting = payload.accounting;
    if (!isRecord(accounting) || accounting.posting !== "disabled") {
      errors.push("accounting posting must be disabled");
    }
  }

  if (containsForbiddenKey(input)) {
    errors.push("personal or secret data is forbidden");
  }
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 262144) {
    errors.push("event exceeds maximum size");
  }
  return errors;
}

export function buildSyntheticErpShadowEvent(revision = 0) {
  if (!Number.isInteger(revision) || revision < 0 || revision > 100_000) {
    throw new Error("Synthetic revision must be an integer from 0 to 100000");
  }

  const occurredAt = new Date().toISOString();
  const tenantId = "00000000-0000-0000-0000-000000000000";
  const orderId = "synthetic-smoke-1";
  const idempotencyKey = [
    "webprinter",
    tenantId,
    "production-order",
    orderId,
    `revision-${revision}`,
  ].join(":");

  return {
    schemaVersion: ERP_SHADOW_SCHEMA_VERSION,
    eventType: ERP_SHADOW_EVENT_TYPE,
    sourceSystem: "webprinter",
    effect: "shadow_only",
    eventId: idempotencyKey,
    idempotencyKey,
    occurredAt,
    source: {
      tenantId,
      orderId,
      revision,
    },
    payload: {
      currency: "DKK",
      totalSellingPrice: 100,
      lines: [{
        sourceOrderItemId: "synthetic-item-1",
        sourceProductId: "synthetic-folder-a4",
        title: "Synthetic A4 folder",
        quantity: 10,
        unitSellingPrice: 10,
        selectedOptions: { color: "4+0" },
        materialRequirements: [],
      }],
      production: {
        fulfillmentMode: "undecided",
        inventoryPosting: "disabled",
      },
      accounting: { posting: "disabled" },
    },
  };
}

export function parseErpShadowMode(value: string | undefined): ErpShadowMode {
  if (value === "synthetic" || value === "shadow") return value;
  return "disabled";
}

export function isAllowedErpGatewayUrl(
  rawUrl: string,
  mode: ErpShadowMode,
): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  if (mode !== "synthetic" || url.protocol !== "http:") return false;
  return ["127.0.0.1", "localhost", "host.docker.internal"].includes(
    url.hostname,
  );
}

export function retryDelaySeconds(attemptCount: number): number {
  const schedule = [15, 60, 300, 900, 3600];
  const index = Math.max(0, Math.min(schedule.length - 1, attemptCount - 1));
  return schedule[index];
}

export async function signErpShadowBody(
  rawBody: string,
  timestamp: string,
  secret: string,
): Promise<string> {
  if (secret.length < 32) throw new Error("ERP shadow secret is too short");
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
