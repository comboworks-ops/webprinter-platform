-- Add is_platform_owned flag to tenants table
-- This allows platform owners to mark their own shops and hide payment warnings

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS is_platform_owned boolean DEFAULT false;

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_tenants_is_platform_owned 
ON public.tenants(is_platform_owned) 
WHERE is_platform_owned = true;

COMMENT ON COLUMN public.tenants.is_platform_owned IS 
'True if tenant is owned by the platform operator. Platform-owned shops share Stripe accounts and hide payment setup warnings.';
