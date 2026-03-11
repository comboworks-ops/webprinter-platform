-- Product category frontend cards
-- Adds an optional representative product per category for storefront category-card presentation.
-- Rollback:
--   alter table public.product_categories drop constraint if exists product_categories_frontend_product_id_fkey;
--   drop index if exists idx_product_categories_frontend_product_id;
--   alter table public.product_categories drop column if exists frontend_product_id;

alter table public.product_categories
  add column if not exists frontend_product_id uuid references public.products(id) on delete set null;

create index if not exists idx_product_categories_frontend_product_id
  on public.product_categories(frontend_product_id);
