import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { assertCheckoutIdentity, CheckoutError, sha256 } from "../_shared/storefrontCheckout.ts";
import { bindCheckoutPayment, checkoutCors, checkoutFailure, checkoutJson, finalizeCheckoutPayment, getAttempt } from "../_shared/storefrontCheckoutRuntime.ts";

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: checkoutCors});
  if (req.method !== "POST") return checkoutJson({error: "method_not_allowed"}, 405);
  const limited = checkRateLimit(req, {keyPrefix: "stripe-finalize-checkout",limit: 30,windowMs: 60_000});
  if (limited) return limited;
  try {
    const body = await req.json();
    assertCheckoutIdentity(body.checkout_attempt_id,body.checkout_access_token);
    const client = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let attempt = await getAttempt(client,body.checkout_attempt_id);
    const tokenHash = await sha256(body.checkout_access_token);
    if (!attempt && body.action === "cancel") {
      const {data: cancelled,error} = await client.rpc("cancel_unstarted_storefront_checkout", {
        p_attempt_id: body.checkout_attempt_id,p_access_token_hash: tokenHash,
      });
      if (error) throw new CheckoutError("checkout_cancellation_pending", 503);
      if (cancelled === true) return checkoutJson({contract_version: 2,cancelled: true,checkout_attempt_id: body.checkout_attempt_id});
      // Creation won the lock: reconcile the now-existing attempt instead.
      attempt = await getAttempt(client,body.checkout_attempt_id);
    }
    if (!attempt || attempt.access_token_hash !== tokenHash) {
      throw new CheckoutError("checkout_access_denied", 403);
    }
    // A signed-in checkout also requires its original account. Guest recovery uses
    // the unguessable per-attempt token; never authorize using an email address.
    if (attempt.user_id) {
      const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
      const {data} = await client.auth.getUser(bearer);
      if (data.user?.id !== attempt.user_id) throw new CheckoutError("checkout_access_denied", 403);
    }
    if (body.payment_intent_id && attempt.payment_intent_id && body.payment_intent_id !== attempt.payment_intent_id) {
      throw new CheckoutError("checkout_payment_mismatch", 409);
    }
    const paymentId = attempt.payment_intent_id || body.payment_intent_id;
    if (!/^pi_[A-Za-z0-9]+$/.test(String(paymentId || ""))) throw new CheckoutError("checkout_reconciliation_required", 409);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any});
    let payment = await stripe.paymentIntents.retrieve(paymentId);
    attempt = await bindCheckoutPayment(client,attempt,payment);
    if (body.action === "cancel" && payment.status !== "succeeded") {
      if (payment.status === "processing") throw new CheckoutError("checkout_payment_processing", 409);
      if (payment.status !== "canceled") {
        try { payment = await stripe.paymentIntents.cancel(payment.id, {}, {idempotencyKey: `storefront-checkout-cancel:${attempt.id}`}); }
        catch { payment = await stripe.paymentIntents.retrieve(payment.id); }
      }
      if (payment.status === "canceled") {
        const {error} = await client.from("storefront_checkout_attempts").update({state: "cancelled"})
          .eq("id",attempt.id).is("order_id",null);
        if (error) throw new CheckoutError("checkout_cancellation_pending", 503);
        const cancelled = await getAttempt(client,attempt.id);
        if (cancelled?.state !== "cancelled") throw new CheckoutError("checkout_cancellation_pending", 503);
        return checkoutJson({contract_version: 2,cancelled: true,checkout_attempt_id: attempt.id});
      }
      if (payment.status !== "succeeded") throw new CheckoutError("checkout_cancellation_pending", 409);
    }
    const order = await finalizeCheckoutPayment(client,attempt,payment);
    return checkoutJson({contract_version: 2,success: true,order});
  } catch (error) { return checkoutFailure(error); }
});
