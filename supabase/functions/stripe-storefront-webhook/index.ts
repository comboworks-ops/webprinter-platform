import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";
import { CheckoutError, UUID } from "../_shared/storefrontCheckout.ts";
import { checkoutFailure, checkoutJson, finalizeCheckoutPayment, getAttempt } from "../_shared/storefrontCheckoutRuntime.ts";

serve(async req => {
  if (req.method !== "POST") return checkoutJson({error: "method_not_allowed"}, 405);
  const secret = Deno.env.get("STOREFRONT_CHECKOUT_WEBHOOK_SECRET");
  if (!secret) return checkoutJson({error: "webhook_not_configured"}, 503);
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any});
  let event: Stripe.Event;
  try {
    // Raw body and Stripe signature required; JWT gateway is deliberately off.
    event = await stripe.webhooks.constructEventAsync(await req.text(),req.headers.get("stripe-signature") || "",secret,
      undefined,Stripe.createSubtleCryptoProvider());
  } catch { return checkoutJson({error: "invalid_webhook_signature"}, 400); }
  if (event.type !== "payment_intent.succeeded") return checkoutJson({received: true});
  const payment = event.data.object as Stripe.PaymentIntent;
  // Ignore subscription/POD/legacy intents sharing this platform account.
  if (payment.metadata?.contract_version !== "2") return checkoutJson({received: true,ignored: true});
  try {
    const id = payment.metadata.checkout_attempt_id;
    if (!UUID.test(id || "")) throw new CheckoutError("checkout_webhook_metadata_invalid", 409);
    const client = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const attempt = await getAttempt(client,id);
    if (!attempt) throw new CheckoutError("checkout_webhook_attempt_missing", 503);
    await finalizeCheckoutPayment(client,attempt,payment);
    return checkoutJson({received: true});
  } catch (error) {
    // Non-2xx keeps Stripe retries active after a DB outage or failed file insert.
    return checkoutFailure(error);
  }
});
