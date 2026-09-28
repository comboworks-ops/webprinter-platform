import {hashArtifactResponse} from './streamedArtifact.ts';
import { CheckoutError, verifyCheckoutPayment, type CheckoutOrderInput } from "./storefrontCheckout.ts";
import { readCheckoutTax } from './storefrontTax.ts';
import {PRIVATE_UPLOAD_PATH,requireUploadCapability} from './storefrontFileAccess.ts';

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

async function verifyStoredArtifact(client: any, path: string, supabaseUrl: string) {
  const {data, error} = await client.storage.from('order-files').createSignedUrl(path, 900);
  if (error || !data?.signedUrl || new URL(data.signedUrl).origin !== new URL(supabaseUrl).origin) {
    throw new CheckoutError('checkout_artifact_unavailable', 409);
  }
  try {
    return await hashArtifactResponse(await fetch(data.signedUrl, {redirect:'error', signal:AbortSignal.timeout(120000)}));
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (['checkout_artifact_too_large','checkout_artifact_empty','checkout_artifact_unavailable'].includes(code)) {
      throw new CheckoutError(code, code === 'checkout_artifact_too_large' ? 413 : 409);
    }
    throw new CheckoutError('checkout_artifact_unavailable', 503);
  }
}

export async function prepareCheckoutArtifacts(client: any, supabaseUrl: string, attempt: any, order: CheckoutOrderInput, privateFiles = false) {
  if (attempt.state !== "prepared") return attempt;
  const files = [];
  for (const [index, file] of order.files.entries()) {
    let expectedSize: number | undefined;
    const privateId=file.storage_path.match(PRIVATE_UPLOAD_PATH)?.[1];
    if(privateId){
      const claim=await requireUploadCapability(client,{id:privateId,access_token:file.access_token!,tenant_id:attempt.tenant_id,user_id:attempt.user_id});
      if(claim.storage_path!==file.storage_path||claim.sha256!==file.sha256||claim.file_name!==file.file_name)throw new CheckoutError('checkout_approved_artifact_changed',409);
      expectedSize = claim.file_size;
    }else if(privateFiles){
      throw new CheckoutError('checkout_file_reupload_required',409);
    }
    const extension = file.file_name.split('.').pop()!.toLowerCase();
    const path = `checkout-finalized/${attempt.id}/${index}-${file.sha256}.${extension}`;
    // Storage performs the copy; the edge function never buffers/reuploads 1 GB.
    // An interrupted or racing copy is accepted ONLY after hashing the exact destination.
    await client.storage.from('order-files').copy(file.storage_path, path);
    const verified = await verifyStoredArtifact(client, path, supabaseUrl);
    if (verified.sha256 !== file.sha256 || (expectedSize !== undefined && expectedSize !== verified.size)) {
      throw new CheckoutError('checkout_approved_artifact_changed',409);
    }
    const {data: publicData} = client.storage.from("order-files").getPublicUrl(path);
    files.push({file_name: file.file_name,storage_path: path,file_url: publicData.publicUrl,
      file_type: extension,file_size: verified.size,sha256: file.sha256});
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
  const tax = readCheckoutTax(attempt.quote_snapshot?.tax, attempt.amount_ore);
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
      ...(attempt.quote_snapshot?.productionConfiguration ? {
        format: attempt.quote_snapshot.productionConfiguration.format || undefined,
        variant: attempt.quote_snapshot.productionConfiguration.variant || undefined,
      } : {}),
      quantity: data.quantity,
      fileName: attempt.files_snapshot?.[0]?.file_name || null,
      subtotal: (Number(attempt.quote_snapshot?.productPriceOre || 0) + Number(attempt.quote_snapshot?.optionExtraOre || 0)) / 100,
      shipping: Number(attempt.quote_snapshot?.shippingOre || 0) / 100,
      total: attempt.amount_ore / 100,
      ...(tax ? {tax} : {}),
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
