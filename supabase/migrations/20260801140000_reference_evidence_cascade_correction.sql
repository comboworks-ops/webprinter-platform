-- Preserve append-only reference evidence without blocking authoritative parent
-- deletion through the foreign keys declared by the evidence schema.
--
-- Rollback order:
-- 1. Disable all evidence writers and authoritative tenant/order deletion paths.
-- 2. Drop the update-only tenant_business_evidence_immutable and
--    carrier_tracking_events_v1_immutable triggers below.
-- 3. Recreate both triggers as BEFORE UPDATE OR DELETE only if deliberately
--    restoring the prior behavior that also blocks declared parent cascades.
-- 4. Grant DELETE back to service_role only if the prior direct-delete surface
--    is intentionally restored; public, anon, and authenticated stay revoked.
-- Existing evidence, tenants, orders, products, prices, checkout, invoices,
-- POD, supplier state, and ERP shadow data are untouched by this correction.

-- data-api: direct evidence deletion is private for every application role;
-- declared tenant/order foreign-key cascades remain the only application deletion path.
revoke delete on table public.tenant_business_evidence
  from public, anon, authenticated, service_role;
revoke delete on table public.carrier_tracking_events_v1
  from public, anon, authenticated, service_role;

drop trigger tenant_business_evidence_immutable
  on public.tenant_business_evidence;
create trigger tenant_business_evidence_immutable
before update on public.tenant_business_evidence
for each row execute function public.reject_reference_evidence_mutation();

drop trigger carrier_tracking_events_v1_immutable
  on public.carrier_tracking_events_v1;
create trigger carrier_tracking_events_v1_immutable
before update on public.carrier_tracking_events_v1
for each row execute function public.reject_reference_evidence_mutation();

comment on table public.tenant_business_evidence is
  'Append-only tenant evidence: direct application DELETE is revoked, UPDATE is rejected, and tenant deletion follows the declared foreign-key cascade.';
comment on table public.carrier_tracking_events_v1 is
  'Append-only display-only PostNord evidence: direct application DELETE is revoked, UPDATE is rejected, and tenant/order deletion follows declared foreign-key cascades.';
