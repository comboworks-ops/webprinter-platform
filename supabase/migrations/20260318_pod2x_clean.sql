create table if not exists pod2x_products (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid default '00000000-0000-0000-0000-000000000000',
    printcom_product_id varchar,
    printcom_product_url varchar,
    printcom_raw_data jsonb,
    name varchar not null,
    slug varchar not null unique,
    description text,
    category varchar default 'brevpapir',
    quantity_min int default 50,
    quantity_max int default 10000,
    quantity_step int default 1,
    design_min int default 1,
    design_max int default 5,
    print_method varchar default 'Offset',
    is_active boolean default true,
    is_imported boolean default false,
    local_product_id uuid,
    created_at timestamp default now(),
    updated_at timestamp default now(),
    created_by uuid
);

create table if not exists pod2x_delivery_tiers (
    id uuid primary key default gen_random_uuid(),
    pod2x_product_id uuid references pod2x_products(id) on delete cascade,
    tier_key varchar not null,
    tier_name varchar not null,
    tier_description varchar,
    printcom_delivery_ids jsonb,
    sort_order int default 0,
    created_at timestamp default now()
);

create table if not exists pod2x_finish_addons (
    id uuid primary key default gen_random_uuid(),
    pod2x_product_id uuid references pod2x_products(id) on delete cascade,
    name varchar not null,
    description varchar,
    price_dkk decimal(10,2) not null,
    price_type varchar default 'per_order',
    printcom_finish_id varchar,
    printcom_raw_data jsonb,
    is_active boolean default true,
    sort_order int default 0,
    created_at timestamp default now()
);

create table if not exists pod2x_price_cache (
    id uuid primary key default gen_random_uuid(),
    pod2x_product_id uuid references pod2x_products(id) on delete cascade,
    quantity int not null,
    design_count int default 1,
    delivery_tier varchar not null,
    printcom_delivery_id varchar,
    printcom_price_eur decimal(10,2),
    printcom_price_dkk decimal(10,2),
    markup_percent decimal(5,2) default 30.00,
    final_price_dkk decimal(10,2),
    cached_at timestamp default now(),
    expires_at timestamp default now() + interval '24 hours',
    unique(pod2x_product_id, quantity, design_count, delivery_tier)
);

create table if not exists pod2x_orders (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid,
    pod2x_product_id uuid references pod2x_products(id),
    local_order_id uuid,
    quantity int not null,
    design_count int default 1,
    delivery_tier varchar not null,
    selected_finish_ids jsonb default '[]',
    base_price_dkk decimal(10,2),
    finishes_price_dkk decimal(10,2) default 0,
    total_price_dkk decimal(10,2),
    printcom_order_id varchar,
    printcom_order_status varchar default 'pending',
    status varchar default 'draft',
    created_at timestamp default now(),
    updated_at timestamp default now(),
    submitted_at timestamp,
    print_data_urls jsonb default '[]'
);

alter table pod2x_products enable row level security;
alter table pod2x_delivery_tiers enable row level security;
alter table pod2x_finish_addons enable row level security;
alter table pod2x_price_cache enable row level security;
alter table pod2x_orders enable row level security;

create index idx_pod2x_products_slug on pod2x_products(slug);
create index idx_pod2x_products_printcom_id on pod2x_products(printcom_product_id);
create index idx_pod2x_products_is_active on pod2x_products(is_active);
create index idx_pod2x_delivery_tiers_product on pod2x_delivery_tiers(pod2x_product_id);
create index idx_pod2x_finish_addons_product on pod2x_finish_addons(pod2x_product_id);
create index idx_pod2x_price_cache_lookup on pod2x_price_cache(pod2x_product_id, quantity, design_count, delivery_tier);
create index idx_pod2x_price_cache_expires on pod2x_price_cache(expires_at);
create index idx_pod2x_orders_tenant on pod2x_orders(tenant_id);
create index idx_pod2x_orders_status on pod2x_orders(status);
create index idx_pod2x_orders_printcom on pod2x_orders(printcom_order_id);
