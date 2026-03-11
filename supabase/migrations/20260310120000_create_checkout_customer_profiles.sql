-- Additive checkout feature: reusable customer profiles for storefront checkout.
-- Rollback: drop policies on public.checkout_customer_profiles, then drop the table.

create table if not exists public.checkout_customer_profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    label text not null,
    customer_email text,
    customer_name text,
    customer_phone text,
    customer_company text,
    delivery_recipient_name text,
    delivery_company text,
    delivery_address text,
    delivery_zip text,
    delivery_city text,
    use_separate_billing_address boolean not null default false,
    billing_name text,
    billing_company text,
    billing_address text,
    billing_zip text,
    billing_city text,
    sender_mode text not null default 'standard' check (sender_mode in ('standard', 'blind', 'custom')),
    sender_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_checkout_customer_profiles_user_updated
    on public.checkout_customer_profiles (user_id, updated_at desc);

create or replace function public.set_checkout_customer_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_checkout_customer_profiles_updated_at on public.checkout_customer_profiles;
create trigger trg_checkout_customer_profiles_updated_at
before update on public.checkout_customer_profiles
for each row
execute function public.set_checkout_customer_profiles_updated_at();

alter table public.checkout_customer_profiles enable row level security;

drop policy if exists "checkout_customer_profiles_select_own" on public.checkout_customer_profiles;
create policy "checkout_customer_profiles_select_own"
on public.checkout_customer_profiles
for select
using (auth.uid() = user_id);

drop policy if exists "checkout_customer_profiles_insert_own" on public.checkout_customer_profiles;
create policy "checkout_customer_profiles_insert_own"
on public.checkout_customer_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "checkout_customer_profiles_update_own" on public.checkout_customer_profiles;
create policy "checkout_customer_profiles_update_own"
on public.checkout_customer_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "checkout_customer_profiles_delete_own" on public.checkout_customer_profiles;
create policy "checkout_customer_profiles_delete_own"
on public.checkout_customer_profiles
for delete
using (auth.uid() = user_id);
