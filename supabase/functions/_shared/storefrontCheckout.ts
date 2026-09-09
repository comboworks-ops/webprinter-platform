// Pure boundary checks shared by the payment creator, finalizer and tests.
export const CHECKOUT_CONTRACT_VERSION = 2;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class CheckoutError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) { super(code); this.code = code; this.status = status; }
}

export type CheckoutFileInput = {
  file_name: string; storage_path: string; bucket: "order-files"; sha256: string;
};
export type CheckoutOrderInput = {
  customer_email: string; customer_name: string; customer_phone: string | null;
  delivery_type: string | null; delivery_address: string; delivery_address2: string | null;
  delivery_zip: string; delivery_city: string; delivery_country: string;
  product_configuration: string | null; status_note: string | null;
  files: CheckoutFileInput[];
};

function text(value: unknown, max: number, required = false): string | null {
  if (value == null && !required) return null;
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new CheckoutError("checkout_invalid_details");
  }
  const result = value.trim();
  if (required && !result) throw new CheckoutError("checkout_missing_details");
  return result || null;
}

export function validateCheckoutOrder(value: unknown): CheckoutOrderInput {
  const input = value as Record<string, unknown>;
  if (!input || typeof input !== "object") throw new CheckoutError("checkout_order_required");
  const email = text(input.customer_email, 254, true)!;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CheckoutError("checkout_invalid_email");
  const country = text(input.delivery_country, 2, true)!.toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new CheckoutError("checkout_invalid_country");
  if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > 8) {
    throw new CheckoutError("checkout_production_file_required");
  }
  const files = input.files.map((raw: unknown) => {
    const file = raw as Record<string, unknown>;
    const name = text(file?.file_name, 255, true)!;
    const path = text(file?.storage_path, 1024, true)!;
    const hash = text(file?.sha256, 64, true)!;
    // Source is an existing public upload, never a privileged fetch of a URL.
    if (file?.bucket !== "order-files" || !/^(order-files|designer-production)\/[A-Za-z0-9_.-]+$/.test(path)
      || path.includes("..") || !/\.(pdf|png|jpe?g|ai|eps)$/i.test(name)
      || !/^[a-f0-9]{64}$/.test(hash)) throw new CheckoutError("checkout_invalid_artifact");
    return { file_name: name, storage_path: path, bucket: "order-files" as const, sha256: hash };
  });
  if (new Set(files.map(file => file.storage_path)).size !== files.length) throw new CheckoutError("checkout_duplicate_artifact");
  return {
    customer_email: email, customer_name: text(input.customer_name, 250, true)!,
    customer_phone: text(input.customer_phone, 80), delivery_type: text(input.delivery_type, 160),
    delivery_address: text(input.delivery_address, 500, true)!, delivery_address2: text(input.delivery_address2, 500),
    delivery_zip: text(input.delivery_zip, 40, true)!, delivery_city: text(input.delivery_city, 160, true)!,
    delivery_country: country, product_configuration: text(input.product_configuration, 6000),
    status_note: text(input.status_note, 10000), files,
  };
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export async function sha256(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), v => v.toString(16).padStart(2, "0")).join("");
}

export function assertCheckoutIdentity(attemptId: unknown, accessToken: unknown): asserts attemptId is string {
  if (!UUID.test(String(attemptId || "")) || !UUID.test(String(accessToken || ""))) {
    throw new CheckoutError("checkout_identity_required");
  }
}

export function verifyCheckoutPayment(attempt: any, payment: any): void {
  if (payment.id !== attempt.payment_intent_id || payment.metadata?.checkout_attempt_id !== attempt.id
    || payment.metadata?.tenant_id !== attempt.tenant_id || payment.metadata?.contract_version !== "2"
    || payment.amount !== attempt.amount_ore || payment.currency !== "dkk"
    || Boolean(payment.livemode) !== Boolean(attempt.livemode)
    || (payment.transfer_data?.destination || null) !== (attempt.stripe_destination || null)) {
    throw new CheckoutError("checkout_payment_mismatch", 409);
  }
  if (payment.status !== "succeeded" || payment.amount_received !== attempt.amount_ore) {
    throw new CheckoutError("checkout_payment_not_completed", 409);
  }
}
