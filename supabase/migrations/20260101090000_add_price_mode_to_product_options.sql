-- Add price_mode to product_options to support fixed vs per-quantity option pricing
alter table public.product_options
add column if not exists price_mode text not null default 'fixed';

-- Backfill existing rows to default fixed
update public.product_options
set price_mode = 'fixed'
where price_mode is null;
