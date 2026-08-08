-- Let an authenticated order customer read only the carrier evidence attached
-- to that exact order without depending on visibility through orders RLS.
-- The baseline orders policy is tenant-admin-only, so a policy subquery running
-- as the customer cannot otherwise see the ownership row it needs to verify.
--
-- Ordered rollback:
-- 1. Disable the customer carrier-evidence UI/read path.
-- 2. Drop carrier_tracking_events_v1_tenant_order_read and recreate the prior
--    exact master branch plus tenant-authorized exact order/tenant subquery.
-- 3. Revoke authenticated execution of
--    can_read_carrier_tracking_order(uuid, uuid), then drop the function.
-- Retained carrier evidence and order/workflow fields are not mutated.

CREATE FUNCTION public.can_read_carrier_tracking_order(
  _order_id uuid,
  _tenant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $customer_order$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders AS customer_order
      WHERE customer_order.id = _order_id
        AND customer_order.tenant_id = _tenant_id
        AND (
          public.can_access_tenant(_tenant_id)
          OR customer_order.user_id = auth.uid()
        )
    );
$customer_order$;

REVOKE ALL ON FUNCTION public.can_read_carrier_tracking_order(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_carrier_tracking_order(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.can_read_carrier_tracking_order(uuid, uuid)
IS 'Checks an exact order/tenant match and current tenant or customer authority for carrier-event RLS without inheriting orders RLS.';

DROP POLICY IF EXISTS carrier_tracking_events_v1_tenant_order_read
  ON public.carrier_tracking_events_v1;

CREATE POLICY carrier_tracking_events_v1_tenant_order_read
ON public.carrier_tracking_events_v1
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'master_admin')
  OR public.can_read_carrier_tracking_order(
    carrier_tracking_events_v1.order_id,
    carrier_tracking_events_v1.tenant_id
  )
);
