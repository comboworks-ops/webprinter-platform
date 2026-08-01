\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $roles$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$roles$;

DO $roles$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$roles$;

DO $roles$
BEGIN
  CREATE ROLE service_role NOLOGIN;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END
$roles$;

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  name text NOT NULL,
  slug text NOT NULL,
  icon_text text,
  description text NOT NULL,
  category text NOT NULL,
  pricing_type text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  preset_key text NOT NULL DEFAULT 'custom',
  technical_specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE public.storformat_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  pricing_mode text NOT NULL DEFAULT 'legacy',
  rounding_step integer NOT NULL DEFAULT 1,
  global_markup_pct numeric NOT NULL DEFAULT 0,
  quantities integer[] NOT NULL,
  layout_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  vertical_axis jsonb,
  is_published boolean NOT NULL DEFAULT false
);

CREATE TABLE public.storformat_materials (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_label text,
  bleed_mm integer NOT NULL,
  safe_area_mm integer NOT NULL,
  max_width_mm numeric,
  max_height_mm numeric,
  allow_split boolean NOT NULL,
  interpolation_enabled boolean NOT NULL,
  markup_pct numeric NOT NULL,
  sort_order integer NOT NULL
);

CREATE TABLE public.storformat_material_price_tiers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.storformat_materials(id) ON DELETE CASCADE,
  from_m2 numeric NOT NULL,
  to_m2 numeric,
  price_per_m2 numeric NOT NULL,
  is_anchor boolean NOT NULL,
  markup_pct numeric NOT NULL,
  sort_order integer NOT NULL
);

CREATE TABLE public.storformat_m2_prices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.storformat_materials(id) ON DELETE CASCADE,
  from_m2 numeric NOT NULL,
  to_m2 numeric,
  price_per_m2 numeric NOT NULL,
  is_anchor boolean NOT NULL,
  UNIQUE (product_id, material_id, from_m2)
);

CREATE TABLE public.storformat_products (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_label text,
  pricing_mode text NOT NULL CHECK (pricing_mode IN ('fixed', 'per_m2')),
  initial_price numeric NOT NULL,
  interpolation_enabled boolean NOT NULL,
  markup_pct numeric NOT NULL,
  sort_order integer NOT NULL,
  pricing_type text NOT NULL CHECK (pricing_type IN ('fixed', 'm2')),
  percentage_markup numeric NOT NULL,
  min_price numeric NOT NULL
);

CREATE TABLE public.storformat_product_price_tiers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_item_id uuid NOT NULL REFERENCES public.storformat_products(id) ON DELETE CASCADE,
  from_m2 numeric NOT NULL,
  to_m2 numeric,
  price_per_m2 numeric NOT NULL,
  is_anchor boolean NOT NULL,
  markup_pct numeric NOT NULL,
  sort_order integer NOT NULL
);

CREATE TABLE public.storformat_product_m2_prices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storformat_product_id uuid NOT NULL REFERENCES public.storformat_products(id) ON DELETE CASCADE,
  from_m2 numeric NOT NULL,
  to_m2 numeric,
  price_per_m2 numeric NOT NULL,
  is_anchor boolean NOT NULL,
  UNIQUE (storformat_product_id, from_m2)
);

CREATE TABLE public.storformat_finishes (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE
);

CREATE TABLE public.storformat_finish_price_tiers (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE
);

CREATE TABLE public.storformat_finish_prices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE
);

CREATE TABLE public.storformat_product_fixed_prices (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE
);
