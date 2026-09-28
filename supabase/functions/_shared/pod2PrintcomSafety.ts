export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

export const PRINTCOM_API_ORIGINS = new Set([
  "https://api.print.com",
  "https://api.stg.print.com",
]);

export const PRINTCOM_EXPLORER_ORIGINS = new Set([
  ...PRINTCOM_API_ORIGINS,
  "https://platform.print.com",
]);

export type PrintcomPaymentMethod = "invoice" | "psp";
export type PaymentVerificationMode = "stripe" | "auto_forward";

export interface SubmissionRequest {
  jobId: string;
  paymentMethod: PrintcomPaymentMethod;
  dryRun: boolean;
}

export interface SubmissionJobLike {
  id: string;
  status: string;
  qty: number;
  tenant_cost: number;
  currency: string;
  printcom_order_id?: string | null;
  provider_job_ref?: string | null;
  printcom_submission_lock_token?: string | null;
  stripe_payment_intent_id?: string | null;
}

export type SubmissionEligibility =
  | { ok: true; paymentVerification: PaymentVerificationMode }
  | { ok: false; code: string; message: string };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSubmissionRequest(value: unknown): SubmissionRequest {
  const body = asRecord(value);
  const jobId = readText(body.jobId);
  const paymentMethod = body.paymentMethod === undefined
    ? "invoice"
    : body.paymentMethod;
  const dryRun = body.dryRun === undefined ? false : body.dryRun;

  if (!UUID_PATTERN.test(jobId)) throw new Error("A valid jobId is required");
  if (paymentMethod !== "invoice" && paymentMethod !== "psp") {
    throw new Error("Unsupported Print.com payment method");
  }
  if (typeof dryRun !== "boolean") throw new Error("dryRun must be a boolean");

  return { jobId, paymentMethod, dryRun };
}

export function getSubmissionEligibility(input: {
  job: SubmissionJobLike;
  tenantAutoForward: boolean;
}): SubmissionEligibility {
  const { job } = input;
  if (job.status !== "paid") {
    return {
      ok: false,
      code: "not_paid",
      message: "The production job is not paid",
    };
  }
  if (!Number.isInteger(Number(job.qty)) || Number(job.qty) <= 0) {
    return {
      ok: false,
      code: "invalid_quantity",
      message: "The production quantity is invalid",
    };
  }
  if (
    !Number.isFinite(Number(job.tenant_cost)) || Number(job.tenant_cost) <= 0
  ) {
    return {
      ok: false,
      code: "invalid_cost",
      message: "The supplier cost is invalid",
    };
  }
  if (!/^[A-Z]{3}$/.test(readText(job.currency).toUpperCase())) {
    return {
      ok: false,
      code: "invalid_currency",
      message: "The production currency is invalid",
    };
  }
  if (readText(job.printcom_order_id) || readText(job.provider_job_ref)) {
    return {
      ok: false,
      code: "duplicate_reference",
      message: "A supplier reference already exists",
    };
  }
  if (readText(job.printcom_submission_lock_token)) {
    return {
      ok: false,
      code: "submission_locked",
      message:
        "A supplier submission is already in progress or awaiting reconciliation",
    };
  }
  if (readText(job.stripe_payment_intent_id)) {
    return { ok: true, paymentVerification: "stripe" };
  }
  if (input.tenantAutoForward) {
    return { ok: true, paymentVerification: "auto_forward" };
  }
  return {
    ok: false,
    code: "payment_unverified",
    message:
      "The job has neither a verified payment reference nor an enabled auto-forward tenant",
  };
}

export function normalizePrintcomBaseUrl(
  value: unknown,
  allowedOrigins: ReadonlySet<string> = PRINTCOM_API_ORIGINS,
): string {
  const raw = readText(value);
  if (!raw) throw new Error("Print.com base URL is missing");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Print.com base URL is invalid");
  }

  if (parsed.protocol !== "https:" || !allowedOrigins.has(parsed.origin)) {
    throw new Error("Print.com base URL is not allowed");
  }
  return parsed.origin;
}

export function buildPrintcomUrl(baseUrl: string, path: unknown): URL {
  const normalizedBaseUrl = normalizePrintcomBaseUrl(
    baseUrl,
    PRINTCOM_EXPLORER_ORIGINS,
  );
  const normalizedPath = readText(path) || "/";
  if (!normalizedPath.startsWith("/") || normalizedPath.startsWith("//")) {
    throw new Error("Print.com path must be relative to the configured API");
  }

  const url = new URL(normalizedPath, `${normalizedBaseUrl}/`);
  if (url.origin !== normalizedBaseUrl) {
    throw new Error("Print.com URL escaped the configured API");
  }
  return url;
}

export function validateSubmissionPayload(input: {
  payload: unknown;
  expectedJobId: string;
  warnings?: unknown;
}): string[] {
  const errors: string[] = [];
  const payload = asRecord(input.payload);
  const warnings = Array.isArray(input.warnings)
    ? input.warnings.map(readText).filter(Boolean)
    : [];
  if (warnings.length) errors.push("Supplier option mapping contains warnings");
  if (payload.customerReference !== `wp-${input.expectedJobId}`) {
    errors.push("Customer reference does not match the job");
  }
  if (payload.paymentMethod !== "invoice" && payload.paymentMethod !== "psp") {
    errors.push("Supplier payment method is invalid");
  }

  const billing = asRecord(payload.billingAddress);
  requireText(errors, billing.companyName, "Billing company is missing");
  requireText(errors, billing.firstName, "Billing first name is missing");
  requireText(errors, billing.lastName, "Billing last name is missing");
  requireText(errors, billing.fullstreet, "Billing street is missing");
  requireText(errors, billing.houseNumber, "Billing house number is missing");
  requireText(errors, billing.postcode, "Billing postcode is missing");
  requireText(errors, billing.city, "Billing city is missing");
  requireCountry(errors, billing.country, "Billing country is invalid");
  requireEmail(errors, billing.email, "Billing email is invalid");

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length !== 1) {
    errors.push("Exactly one Print.com order item is required");
  }

  const item = asRecord(items[0]);
  requireText(errors, item.sku, "Supplier SKU is missing");
  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    errors.push("Item quantity must be a positive integer");
  }
  const options = asRecord(item.options);
  if (!Object.keys(options).length) errors.push("Supplier options are missing");
  if (!isPublicHttpsUrl(item.fileUrl)) {
    errors.push("Print file URL must be a public HTTPS URL");
  }
  if (item.stickySlipImageUrl && !isPublicHttpsUrl(item.stickySlipImageUrl)) {
    errors.push("Sender logo URL must be a public HTTPS URL");
  }

  const shipments = Array.isArray(item.shipments) ? item.shipments : [];
  if (shipments.length !== 1) errors.push("Exactly one shipment is required");
  const shipment = asRecord(shipments[0]);
  if (Number(shipment.quantity) !== quantity) {
    errors.push("Shipment quantity must match item quantity");
  }
  const address = asRecord(shipment.address);
  if (!readText(address.companyName) && !readText(address.firstName)) {
    errors.push("Recipient name or company is missing");
  }
  requireText(errors, address.fullstreet, "Recipient street is missing");
  requireText(errors, address.houseNumber, "Recipient house number is missing");
  requireText(errors, address.postcode, "Recipient postcode is missing");
  requireText(errors, address.city, "Recipient city is missing");
  requireCountry(errors, address.country, "Recipient country is invalid");
  requireEmail(errors, address.email, "Recipient email is invalid");

  return [...new Set(errors)];
}

export async function fingerprintSubmissionPayload(
  value: unknown,
): Promise<string> {
  const bytes = new TextEncoder().encode(stableSerialize(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function normalizeJobIds(
  value: unknown,
  maxItems = 50,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("jobIds must be an array");
  const ids = [...new Set(value.map(readText).filter(Boolean))];
  if (ids.length > maxItems) {
    throw new Error(`At most ${maxItems} jobIds are allowed`);
  }
  if (ids.some((id) => !UUID_PATTERN.test(id))) {
    throw new Error("jobIds contains an invalid UUID");
  }
  return ids;
}

export function isSafeSupplierStatusTransition(
  current: string,
  next: string,
): boolean {
  if (current === next) return true;
  if (current === "completed" || current === "failed") return false;
  if (current === "processing" && next === "submitted") return false;
  if (current === "submitted") {
    return ["processing", "completed", "failed"].includes(next);
  }
  if (current === "processing") return ["completed", "failed"].includes(next);
  return false;
}

export function shouldReleaseSubmissionClaim(httpStatus: number): boolean {
  return [400, 401, 403, 404, 405, 422].includes(httpStatus);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }
  return mismatch === 0;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${
    Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${stableSerialize(record[key])}`
    ).join(",")
  }}`;
}

function isPublicHttpsUrl(value: unknown): boolean {
  const raw = readText(value);
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      !hostname || hostname === "localhost" || hostname === "::1" ||
      hostname.endsWith(".local")
    ) return false;
    const octets = hostname.split(".").map(Number);
    if (
      octets.length === 4 &&
      octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ) {
      if (octets[0] === 10 || octets[0] === 127 || octets[0] === 0) {
        return false;
      }
      if (octets[0] === 169 && octets[1] === 254) return false;
      if (octets[0] === 192 && octets[1] === 168) return false;
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function requireText(errors: string[], value: unknown, message: string) {
  if (!readText(value)) errors.push(message);
}

function requireEmail(errors: string[], value: unknown, message: string) {
  const email = readText(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(message);
}

function requireCountry(errors: string[], value: unknown, message: string) {
  if (!/^[A-Z]{2}$/.test(readText(value).toUpperCase())) errors.push(message);
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
