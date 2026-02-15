# Stripe Subscriptions Setup (Platform)

Last updated: 2026-02-10

This document covers the subscription stack for tenant plans in Webprinter.

## What Is Included

- DB table: `public.tenant_subscriptions`
- Edge functions:
- `stripe-subscription-create-checkout`
- `stripe-subscription-create-portal`
- `stripe-subscription-webhook`
- Admin UI:
- `src/components/admin/SubscriptionSettings.tsx`

## Required Stripe Environment Variables

Set these in Supabase Edge Functions environment:

- `STRIPE_SECRET_KEY`
- `STRIPE_API_VERSION` (optional, default `2023-10-16`)
- `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`
- `STRIPE_SUBSCRIPTION_PRICE_STARTER_MONTHLY`
- `STRIPE_SUBSCRIPTION_PRICE_STARTER_YEARLY`
- `STRIPE_SUBSCRIPTION_PRICE_PROFESSIONAL_MONTHLY`
- `STRIPE_SUBSCRIPTION_PRICE_PROFESSIONAL_YEARLY`
- `STRIPE_SUBSCRIPTION_PRICE_ENTERPRISE_MONTHLY`
- `STRIPE_SUBSCRIPTION_PRICE_ENTERPRISE_YEARLY`
- `STRIPE_SUBSCRIPTION_TRIAL_DAYS` (optional, default `14`)

Frontend env:

- `VITE_STRIPE_PUBLISHABLE_KEY`

## Stripe Dashboard Setup

1. Create recurring Stripe products/prices for:
- Starter Monthly/Yearly
- Professional Monthly/Yearly
- Enterprise Monthly/Yearly
2. Copy each Price ID into the matching env var above.
3. Configure webhook endpoint to:
- URL: `https://<project-ref>.supabase.co/functions/v1/stripe-subscription-webhook`
- Events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`.

## Deploy Order

1. Run SQL migration for `tenant_subscriptions`.
2. Deploy edge functions:
- `stripe-subscription-create-checkout`
- `stripe-subscription-create-portal`
- `stripe-subscription-webhook`
3. Confirm env vars are set for all three functions.
4. Open `Admin > Abonnement` and test with Stripe test cards.

## Runtime Flow

1. Admin chooses plan in `Admin > Abonnement`.
2. Frontend invokes `stripe-subscription-create-checkout`.
3. User completes Stripe Checkout.
4. Webhook updates `tenant_subscriptions` with status/period/price.
5. Admin can open Stripe Billing Portal via `stripe-subscription-create-portal`.

## Notes

- Plan status in UI depends on webhook updates.
- Billing portal is available after first checkout when `stripe_customer_id` exists.
- If webhook is not configured, checkout can complete in Stripe but admin status will not auto-update.
