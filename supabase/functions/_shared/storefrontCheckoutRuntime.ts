import { CheckoutError, sha256, verifyCheckoutPayment, type CheckoutOrderInput } from "./storefrontCheckout.ts";

export const checkoutCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
export function checkoutJson(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {status, headers: {...checkoutCors, "Content-Type": "application/json", "Cache-Control": "no-store"}});
}
export function checkoutFailure(error: unknown) {
  // Never leak database details, storage paths, client secrets or customer details.
  return checkoutJson({contract_version: 2, error: error instanceof CheckoutError ? error.code : "checkout_temporarily_unavailable"},
    error instanceof CheckoutError ? error.status : 503);
}
export async function getAttempt(client: any, id: string) {
  const {data, error} = await client.from("storefront_checkout_attempts").select("*").eq("id", id).maybeSingle();
  if (error) throw new CheckoutError("checkout_backend_not_ready", 503);
  return data;
}

async function boundedDownload(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, {redirect: "error"});
  if (!response.ok || !response.body) throw new CheckoutError("checkout_artifact_unavailable", 409);
  const maxBytes = 25 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel(); throw new CheckoutError("checkout_artifact_too_large", 413);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new CheckoutError("checkout_artifact_too_large", 413); }
    chunks.push(value);
  }
  if (!size) throw new CheckoutError("checkout_artifact_empty");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

export async function prepareCheckoutArtifacts(client: any, supabaseUrl: string, attempt: any, order: CheckoutOrderInput) {
  if (attempt.state !== "prepared") return attempt;
  const files = [];
  for (const [index, file] of order.files.entries()) {
    // Public read only: possession of an approved public upload is required.
    // Never pass service credentials to a browser-supplied path or follow redirects.
    const sourceUrl = `${supabaseUrl}/storage/v1/object/public/order-files/${file.storage_path.split("/").map(encodeURIComponent).join("/")}`;
    const bytes = await boundedDownload(sourceUrl);
    if (await sha256(bytes) !== file.sha256) throw new CheckoutError("checkout_approved_artifact_changed", 409);
    const extension = file.file_name.split(".").pop()!.toLowerCase();
    const path = `checkout-finalized/${attempt.id}/${index}-${file.sha256}.${extension}`;
    const {error} = await client.storage.from("order-files").upload(path, bytes, {
      upsert: false, contentType: extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : "application/octet-stream",
    });
    if (error) {
      // Duplicate/racing or lost upload response: accept only byte-identical existing object.
      const {data: existing, error: downloadError} = await client.storage.from("order-files").download(path);
      if (downloadError || !existing || await sha256(await existing.arrayBuffer()) !== file.sha256) {
        throw new CheckoutError("checkout_artifact_copy_failed", 503);
      }
    }
    const {data: publicData} = client.storage.from("order-files").getPublicUrl(path);
    files.push({file_name: file.file_name,storage_path: path,file_url: publicData.publicUrl,
      file_type: extension,file_size: bytes.byteLength,sha256: file.sha256});
  }
  const {error} = await client.from("storefront_checkout_attempts").update({files_snapshot: files,state: "ready"})
    .eq("id", attempt.id).eq("state", "prepared");
  if (error) throw new CheckoutError("checkout_artifact_commit_failed", 503);
  const ready = await getAttempt(client, attempt.id);
  if (!ready || !["ready", "completed"].includes(ready.state)) throw new CheckoutError("checkout_artifact_commit_failed", 503);
  return ready;
}

export async function bindCheckoutPayment(client: any, attempt: any, payment: any) {
  // Metadata is produced only by the creator. Signed webhook or Stripe retrieval
  // can recover a PI created just before the database binding response was lost.
  if (payment.metadata?.checkout_attempt_id !== attempt.id || payment.metadata?.request_hash !== attempt.request_hash
    || payment.metadata?.tenant_id !== attempt.tenant_id || payment.metadata?.contract_version !== "2"
    || payment.amount !== attempt.amount_ore || payment.currency !== "dkk"
    || Boolean(payment.livemode) !== Boolean(attempt.livemode)
    || (payment.transfer_data?.destination || null) !== (attempt.stripe_destination || null)) {
    throw new CheckoutError("checkout_payment_mismatch", 409);
  }
  if (attempt.payment_intent_id && attempt.payment_intent_id !== payment.id) throw new CheckoutError("checkout_payment_mismatch", 409);
  if (!attempt.payment_intent_id) {
    const {error} = await client.from("storefront_checkout_attempts").update({payment_intent_id: payment.id})
      .eq("id", attempt.id).is("payment_intent_id", null);
    if (error) throw new CheckoutError("checkout_payment_binding_pending", 503);
    attempt = await getAttempt(client, attempt.id);
    if (attempt?.payment_intent_id !== payment.id) throw new CheckoutError("checkout_payment_mismatch", 409);
  }
  return attempt;
}

export async function finalizeCheckoutPayment(client: any, attempt: any, payment: any) {
  attempt = await bindCheckoutPayment(client, attempt, payment);
  verifyCheckoutPayment(attempt, payment);
  const {data, error} = await client.rpc("finalize_storefront_checkout", {
    p_attempt_id: attempt.id,p_payment_intent_id: payment.id,p_amount_ore: payment.amount_received,
    p_currency: payment.currency,p_livemode: payment.livemode,
  });
  if (error || !data?.id || !data?.order_number) throw new CheckoutError("checkout_finalization_pending", 503);
  return {
    ...data,
    checkout_notification: await readCheckoutNotification(client, attempt, data.id),
    checkout_context: {productId: attempt.quote_snapshot?.product?.id || null,podV2: attempt.quote_snapshot?.product?.podV2 === true},
    checkout_receipt: {
      productName: data.product_name,
      quantity: data.quantity,
      fileName: attempt.files_snapshot?.[0]?.file_name || null,
      subtotal: (Number(attempt.quote_snapshot?.productPriceOre || 0) + Number(attempt.quote_snapshot?.optionExtraOre || 0)) / 100,
      shipping: Number(attempt.quote_snapshot?.shippingOre || 0) / 100,
      total: attempt.amount_ore / 100,
    },
  };
}

export async function readCheckoutNotification(client: any, attempt: any, orderId: string) {
  try {
    const {data, error} = await client.from("storefront_order_email_outbox")
      .select("status,accepted_at,provider_message_id")
      .eq("attempt_id", attempt.id).eq("order_id", orderId).eq("tenant_id", attempt.tenant_id)
      .eq("notification_type", "customer_confirmation")
      .maybeSingle().abortSignal(AbortSignal.timeout(1500));
    if (error || !data) return {status: "unavailable"};
    if (data.status === "sent" && data.accepted_at && data.provider_message_id) return {status: "accepted"};
    if (["pending", "processing", "needs_review", "failed"].includes(data.status)) return {status: data.status};
  } catch {
    // The paid order remains valid when notification status cannot be read.
  }
  return {status: "unavailable"};
}
