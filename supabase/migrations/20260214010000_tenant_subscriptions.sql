-- Tenant subscriptions (Stripe Billing)

CREATE TABLE IF NOT EXISTS public.tenant_subscriptions (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'stripe',
    stripe_customer_id text NULL,
    stripe_subscription_id text NULL,
    stripe_price_id text NULL,
    plan_id text NOT NULL DEFAULT 'free', -- free | starter | professional | enterprise
    billing_cycle text NOT NULL DEFAULT 'monthly', -- monthly | yearly
    status text NOT NULL DEFAULT 'inactive', -- inactive | trialing | active | past_due | canceled | unpaid | incomplete | incomplete_expired | paused
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    current_period_start timestamptz NULL,
    current_period_end timestamptz NULL,
    trial_end timestamptz NULL,
    last_invoice_id text NULL,
    last_invoice_status text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenant_subscriptions_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'yearly')),
    CONSTRAINT tenant_subscriptions_plan_id_check CHECK (plan_id IN ('free', 'starter', 'professional', 'enterprise'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON public.tenant_subscriptions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_customer_id ON public.tenant_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe_subscription_id ON public.tenant_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_tenant_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_subscriptions_updated_at ON public.tenant_subscriptions;
CREATE TRIGGER trigger_tenant_subscriptions_updated_at
    BEFORE UPDATE ON public.tenant_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tenant_subscriptions_updated_at();

DROP POLICY IF EXISTS "Select tenant subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Select tenant subscriptions" ON public.tenant_subscriptions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text = 'master_admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text IN ('admin', 'staff')
              AND ur.tenant_id = tenant_subscriptions.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_subscriptions.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Insert tenant subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Insert tenant subscriptions" ON public.tenant_subscriptions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text = 'master_admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text IN ('admin', 'staff')
              AND ur.tenant_id = tenant_subscriptions.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_subscriptions.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Update tenant subscriptions" ON public.tenant_subscriptions;
CREATE POLICY "Update tenant subscriptions" ON public.tenant_subscriptions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text = 'master_admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text IN ('admin', 'staff')
              AND ur.tenant_id = tenant_subscriptions.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_subscriptions.tenant_id
              AND t.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text = 'master_admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text IN ('admin', 'staff')
              AND ur.tenant_id = tenant_subscriptions.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_subscriptions.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;
