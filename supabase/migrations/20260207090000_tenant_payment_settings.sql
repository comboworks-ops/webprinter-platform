-- Tenant payment settings (Stripe Connect + platform fee)

CREATE TABLE IF NOT EXISTS public.tenant_payment_settings (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider text NOT NULL DEFAULT 'stripe',
    stripe_account_id text NULL,
    status text NOT NULL DEFAULT 'not_connected', -- not_connected | pending | connected | restricted | disabled
    charges_enabled boolean NOT NULL DEFAULT false,
    payouts_enabled boolean NOT NULL DEFAULT false,
    details_submitted boolean NOT NULL DEFAULT false,
    country text NULL,
    currency text NULL,
    platform_fee_percent numeric NULL,
    platform_fee_flat_ore integer NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_payment_settings ENABLE ROW LEVEL SECURITY;

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_tenant_payment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_payment_settings_updated_at ON public.tenant_payment_settings;
CREATE TRIGGER trigger_tenant_payment_settings_updated_at
    BEFORE UPDATE ON public.tenant_payment_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tenant_payment_settings_updated_at();

-- RLS policies
DROP POLICY IF EXISTS "Select tenant payment settings" ON public.tenant_payment_settings;
CREATE POLICY "Select tenant payment settings" ON public.tenant_payment_settings
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
              AND ur.tenant_id = tenant_payment_settings.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_payment_settings.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Insert tenant payment settings" ON public.tenant_payment_settings;
CREATE POLICY "Insert tenant payment settings" ON public.tenant_payment_settings
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
              AND ur.tenant_id = tenant_payment_settings.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_payment_settings.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Update tenant payment settings" ON public.tenant_payment_settings;
CREATE POLICY "Update tenant payment settings" ON public.tenant_payment_settings
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
              AND ur.tenant_id = tenant_payment_settings.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_payment_settings.tenant_id
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
              AND ur.tenant_id = tenant_payment_settings.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_payment_settings.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.tenant_payment_settings TO authenticated;
GRANT ALL ON public.tenant_payment_settings TO service_role;
