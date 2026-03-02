// Stripe Billing webhook for tenant subscriptions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

type PlanInfo = { plan_id: string; billing_cycle: string };

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toIsoOrNull(value: number | null | undefined): string | null {
  if (!value || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function inferPlanFromPriceId(priceId: string | null): PlanInfo | null {
  if (!priceId) return null;

  const options: PlanInfo[] = [
    { plan_id: "starter", billing_cycle: "monthly" },
    { plan_id: "starter", billing_cycle: "yearly" },
    { plan_id: "professional", billing_cycle: "monthly" },
    { plan_id: "professional", billing_cycle: "yearly" },
    { plan_id: "enterprise", billing_cycle: "monthly" },
    { plan_id: "enterprise", billing_cycle: "yearly" },
  ];

  for (const option of options) {
    const envKey = `STRIPE_SUBSCRIPTION_PRICE_${option.plan_id.toUpperCase()}_${option.billing_cycle.toUpperCase()}`;
    if (Deno.env.get(envKey) === priceId) {
      return option;
    }
  }

  return null;
}

async function resolveTenantId(
  serviceClient: ReturnType<typeof createClient>,
  explicitTenantId: string | null,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
): Promise<string | null> {
  if (explicitTenantId) return explicitTenantId;

  if (stripeSubscriptionId) {
    const { data } = await serviceClient
      .from("tenant_subscriptions")
      .select("tenant_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .maybeSingle();
    if (data?.tenant_id) return data.tenant_id;
  }

  if (stripeCustomerId) {
    const { data } = await serviceClient
      .from("tenant_subscriptions")
      .select("tenant_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (data?.tenant_id) return data.tenant_id;
  }

  return null;
}

async function upsertFromSubscription(
  serviceClient: ReturnType<typeof createClient>,
  tenantId: string,
  subscription: Stripe.Subscription,
  extra?: Partial<{ plan_id: string; billing_cycle: string }>,
) {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id || null;
  const interval = firstItem?.price?.recurring?.interval || null;
  const inferred = inferPlanFromPriceId(priceId);

  const planId =
    (subscription.metadata?.plan_id || "").toLowerCase() ||
    extra?.plan_id ||
    inferred?.plan_id ||
    "free";

  const billingCycle =
    (subscription.metadata?.billing_cycle || "").toLowerCase() ||
    extra?.billing_cycle ||
    inferred?.billing_cycle ||
    (interval === "year" ? "yearly" : "monthly");

  const payload = {
    tenant_id: tenantId,
    provider: "stripe",
    stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan_id: planId,
    billing_cycle: billingCycle,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end || false,
    current_period_start: toIsoOrNull(subscription.current_period_start),
    current_period_end: toIsoOrNull(subscription.current_period_end),
    trial_end: toIsoOrNull(subscription.trial_end),
    metadata: {
      stripe_metadata: subscription.metadata || {},
      latest_invoice: typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id || null,
    },
  };

  const { error } = await serviceClient
    .from("tenant_subscriptions")
    .upsert(payload, { onConflict: "tenant_id" });

  if (error) throw error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSignature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET");

    if (!stripeSignature || !webhookSecret) {
      return jsonResponse({ error: "Missing webhook signature/secret" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: (Deno.env.get("STRIPE_API_VERSION") ?? "2023-10-16") as any,
    });

    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, stripeSignature, webhookSecret);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const tenantId = await resolveTenantId(
          serviceClient,
          session.metadata?.tenant_id || null,
          typeof session.customer === "string" ? session.customer : session.customer?.id || null,
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
        );
        if (!tenantId) break;

        const planId = (session.metadata?.plan_id || "").toLowerCase() || undefined;
        const billingCycle = (session.metadata?.billing_cycle || "").toLowerCase() || undefined;

        if (typeof session.subscription === "string") {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await upsertFromSubscription(serviceClient, tenantId, subscription, {
            plan_id: planId,
            billing_cycle: billingCycle,
          });
        } else {
          const { error } = await serviceClient
            .from("tenant_subscriptions")
            .upsert({
              tenant_id: tenantId,
              provider: "stripe",
              stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
              plan_id: planId || "free",
              billing_cycle: billingCycle || "monthly",
              metadata: {
                checkout_session_id: session.id,
              },
            }, { onConflict: "tenant_id" });
          if (error) throw error;
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = await resolveTenantId(
          serviceClient,
          subscription.metadata?.tenant_id || null,
          typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null,
          subscription.id,
        );
        if (!tenantId) break;

        await upsertFromSubscription(serviceClient, tenantId, subscription);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null;
        if (!customerId) break;

        const { data: sub } = await serviceClient
          .from("tenant_subscriptions")
          .select("tenant_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (!sub?.tenant_id) break;

        const patch: Record<string, any> = {
          last_invoice_id: invoice.id,
          last_invoice_status: invoice.status || null,
        };
        if (event.type === "invoice.payment_failed") {
          patch.status = "past_due";
        }

        const { error } = await serviceClient
          .from("tenant_subscriptions")
          .update(patch)
          .eq("tenant_id", sub.tenant_id);
        if (error) throw error;
        break;
      }
      default:
        break;
    }

    return jsonResponse({ received: true });
  } catch (error: any) {
    console.error("stripe-subscription-webhook error:", error);
    return jsonResponse({ error: error?.message || "Unknown error" }, 400);
  }
});
