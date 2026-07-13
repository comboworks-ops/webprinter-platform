-- Company Hub V2 foundation
-- Additive only: does not modify product pricing, orders, POD v1, or POD v2.

-- ---------------------------------------------------------------------------
-- Existing Company Hub compatibility extensions
-- ---------------------------------------------------------------------------

ALTER TABLE public.company_accounts
    ADD COLUMN IF NOT EXISTS slug text,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS industry_key text,
    ADD COLUMN IF NOT EXISTS contact_email text,
    ADD COLUMN IF NOT EXISTS contact_phone text,
    ADD COLUMN IF NOT EXISTS billing_email text,
    ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.company_members
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS is_all_offices boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.company_hub_items
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS short_description text,
    ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS office_scope text NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
    ALTER TABLE public.company_accounts
        ADD CONSTRAINT company_accounts_v2_status_check
        CHECK (status IN ('draft', 'active', 'paused', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.company_members
        ADD CONSTRAINT company_members_v2_status_check
        CHECK (status IN ('active', 'disabled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.company_members
        ADD CONSTRAINT company_members_v2_role_check
        CHECK (role IN (
            'company_owner',
            'company_admin',
            'company_approver',
            'company_buyer',
            'company_viewer',
            'company_user'
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.company_hub_items
        ADD CONSTRAINT company_hub_items_v2_status_check
        CHECK (status IN ('draft', 'active', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE public.company_hub_items
        ADD CONSTRAINT company_hub_items_v2_office_scope_check
        CHECK (office_scope IN ('all', 'selected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS company_accounts_tenant_company_key
    ON public.company_accounts (id, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS company_accounts_tenant_slug_key
    ON public.company_accounts (tenant_id, slug)
    WHERE slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS company_hub_items_company_tenant_item_key
    ON public.company_hub_items (id, company_id, tenant_id);

-- ---------------------------------------------------------------------------
-- Offices, addresses, member scope, and catalogue structure
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_offices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    email text,
    phone text,
    website text,
    is_default boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled', 'archived')),
    profile_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_offices_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS company_offices_company_code_key
    ON public.company_offices (company_id, code)
    WHERE code IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS company_offices_one_default_per_company
    ON public.company_offices (company_id)
    WHERE is_default = true AND status = 'active';

CREATE INDEX IF NOT EXISTS company_offices_tenant_company_name_idx
    ON public.company_offices (tenant_id, company_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS company_offices_company_tenant_office_key
    ON public.company_offices (id, company_id, tenant_id);

CREATE TABLE IF NOT EXISTS public.company_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    office_id uuid,
    type text NOT NULL DEFAULT 'delivery'
        CHECK (type IN ('delivery', 'billing', 'both')),
    label text NOT NULL,
    recipient_name text NOT NULL,
    company_name text,
    street_address text NOT NULL,
    street_address_2 text,
    postal_code text NOT NULL,
    city text NOT NULL,
    country_code text NOT NULL DEFAULT 'DK',
    phone text,
    is_default boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'disabled', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_addresses_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_addresses_office_fk
        FOREIGN KEY (office_id, company_id, tenant_id)
        REFERENCES public.company_offices (id, company_id, tenant_id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS company_addresses_company_default_key
    ON public.company_addresses (company_id, type)
    WHERE office_id IS NULL AND is_default = true AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS company_addresses_office_default_key
    ON public.company_addresses (office_id, type)
    WHERE office_id IS NOT NULL AND is_default = true AND status = 'active';

CREATE INDEX IF NOT EXISTS company_addresses_tenant_company_office_idx
    ON public.company_addresses (tenant_id, company_id, office_id);

CREATE TABLE IF NOT EXISTS public.company_member_offices (
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    user_id uuid NOT NULL,
    office_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, user_id, office_id),
    CONSTRAINT company_member_offices_member_fk
        FOREIGN KEY (company_id, user_id)
        REFERENCES public.company_members (company_id, user_id)
        ON DELETE CASCADE,
    CONSTRAINT company_member_offices_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_member_offices_office_fk
        FOREIGN KEY (office_id, company_id, tenant_id)
        REFERENCES public.company_offices (id, company_id, tenant_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS company_member_offices_user_idx
    ON public.company_member_offices (tenant_id, user_id, company_id);

CREATE TABLE IF NOT EXISTS public.company_catalog_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon_name text,
    image_url text,
    sort_order integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('draft', 'active', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_catalog_categories_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    UNIQUE (company_id, slug)
);

CREATE INDEX IF NOT EXISTS company_catalog_categories_company_sort_idx
    ON public.company_catalog_categories (tenant_id, company_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS company_catalog_categories_company_tenant_category_key
    ON public.company_catalog_categories (id, company_id, tenant_id);

ALTER TABLE public.company_hub_items
    ADD COLUMN IF NOT EXISTS category_id uuid;

DO $$
BEGIN
    ALTER TABLE public.company_hub_items
        ADD CONSTRAINT company_hub_items_category_fk
        FOREIGN KEY (category_id, company_id, tenant_id)
        REFERENCES public.company_catalog_categories (id, company_id, tenant_id)
        ON DELETE SET NULL (category_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.company_catalog_item_offices (
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    item_id uuid NOT NULL,
    office_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (item_id, office_id),
    CONSTRAINT company_catalog_item_offices_item_fk
        FOREIGN KEY (item_id, company_id, tenant_id)
        REFERENCES public.company_hub_items (id, company_id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_catalog_item_offices_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_catalog_item_offices_office_fk
        FOREIGN KEY (office_id, company_id, tenant_id)
        REFERENCES public.company_offices (id, company_id, tenant_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS company_catalog_item_offices_company_office_idx
    ON public.company_catalog_item_offices (tenant_id, company_id, office_id);

-- ---------------------------------------------------------------------------
-- Controlled templates and private asset metadata
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_template_bindings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    item_id uuid NOT NULL,
    design_id uuid REFERENCES public.designer_saved_designs(id) ON DELETE RESTRICT,
    template_id uuid REFERENCES public.designer_templates(id) ON DELETE RESTRICT,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'retired')),
    name text NOT NULL,
    preview_url text,
    output_mode text NOT NULL DEFAULT 'designer_pdf'
        CHECK (output_mode IN ('vector_pdf', 'designer_pdf', 'upload_only')),
    source_fingerprint text,
    approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_template_bindings_source_check
        CHECK (num_nonnulls(design_id, template_id) = 1),
    CONSTRAINT company_template_bindings_item_fk
        FOREIGN KEY (item_id, company_id, tenant_id)
        REFERENCES public.company_hub_items (id, company_id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_template_bindings_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    UNIQUE (item_id, version)
);

CREATE INDEX IF NOT EXISTS company_template_bindings_company_status_idx
    ON public.company_template_bindings (tenant_id, company_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS company_template_bindings_company_tenant_binding_key
    ON public.company_template_bindings (id, company_id, tenant_id);

ALTER TABLE public.company_hub_items
    ADD COLUMN IF NOT EXISTS template_binding_id uuid;

DO $$
BEGIN
    ALTER TABLE public.company_hub_items
        ADD CONSTRAINT company_hub_items_template_binding_fk
        FOREIGN KEY (template_binding_id, company_id, tenant_id)
        REFERENCES public.company_template_bindings (id, company_id, tenant_id)
        ON DELETE SET NULL (template_binding_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.company_template_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    binding_id uuid NOT NULL,
    field_key text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL
        CHECK (field_type IN ('text', 'textarea', 'email', 'phone', 'url', 'image', 'select')),
    fabric_object_id text NOT NULL,
    is_required boolean NOT NULL DEFAULT false,
    default_source text,
    default_value jsonb,
    validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
    allowed_values jsonb NOT NULL DEFAULT '[]'::jsonb,
    max_length integer CHECK (max_length IS NULL OR max_length > 0),
    allow_position boolean NOT NULL DEFAULT false,
    allow_size boolean NOT NULL DEFAULT false,
    allow_style boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_template_fields_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_template_fields_binding_fk
        FOREIGN KEY (binding_id, company_id, tenant_id)
        REFERENCES public.company_template_bindings (id, company_id, tenant_id)
        ON DELETE CASCADE,
    UNIQUE (binding_id, field_key),
    UNIQUE (binding_id, fabric_object_id)
);

CREATE INDEX IF NOT EXISTS company_template_fields_binding_sort_idx
    ON public.company_template_fields (binding_id, sort_order);

CREATE TABLE IF NOT EXISTS public.company_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    office_id uuid,
    asset_type text NOT NULL
        CHECK (asset_type IN ('logo', 'image', 'source_pdf', 'approved_artwork', 'supporting_document')),
    name text NOT NULL,
    storage_path text NOT NULL,
    mime_type text NOT NULL,
    file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('processing', 'active', 'rejected', 'archived')),
    uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_assets_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_assets_office_fk
        FOREIGN KEY (office_id, company_id, tenant_id)
        REFERENCES public.company_offices (id, company_id, tenant_id)
        ON DELETE SET NULL (office_id),
    UNIQUE (tenant_id, company_id, storage_path)
);

CREATE INDEX IF NOT EXISTS company_assets_company_type_idx
    ON public.company_assets (tenant_id, company_id, asset_type, status);

CREATE UNIQUE INDEX IF NOT EXISTS company_assets_company_tenant_asset_key
    ON public.company_assets (id, company_id, tenant_id);

-- ---------------------------------------------------------------------------
-- Request, consultant, and audit records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.company_order_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    office_id uuid,
    item_id uuid NOT NULL,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    template_binding_id uuid,
    template_version integer,
    requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    quantity integer NOT NULL CHECK (quantity > 0),
    field_values jsonb NOT NULL DEFAULT '{}'::jsonb,
    product_configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
    quote_snapshot jsonb,
    quoted_total numeric CHECK (quoted_total IS NULL OR quoted_total > 0),
    address_snapshot jsonb,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft',
            'pending_approval',
            'approved',
            'rejected',
            'checkout_started',
            'ordered',
            'cancelled',
            'expired'
        )),
    approval_reason text,
    decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    decided_at timestamptz,
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_order_requests_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_order_requests_office_fk
        FOREIGN KEY (office_id, company_id, tenant_id)
        REFERENCES public.company_offices (id, company_id, tenant_id)
        ON DELETE SET NULL (office_id),
    CONSTRAINT company_order_requests_item_fk
        FOREIGN KEY (item_id, company_id, tenant_id)
        REFERENCES public.company_hub_items (id, company_id, tenant_id)
        ON DELETE RESTRICT,
    CONSTRAINT company_order_requests_binding_fk
        FOREIGN KEY (template_binding_id, company_id, tenant_id)
        REFERENCES public.company_template_bindings (id, company_id, tenant_id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS company_order_requests_company_status_idx
    ON public.company_order_requests (tenant_id, company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS company_order_requests_requested_by_idx
    ON public.company_order_requests (requested_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.company_consultant_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    office_id uuid,
    item_id uuid,
    asset_id uuid,
    request_type text NOT NULL
        CHECK (request_type IN ('portal_setup', 'new_product', 'template_setup', 'file_help', 'general_advice')),
    subject text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'in_progress', 'waiting_for_customer', 'resolved', 'closed')),
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_consultant_requests_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_consultant_requests_office_fk
        FOREIGN KEY (office_id, company_id, tenant_id)
        REFERENCES public.company_offices (id, company_id, tenant_id)
        ON DELETE SET NULL (office_id),
    CONSTRAINT company_consultant_requests_item_fk
        FOREIGN KEY (item_id, company_id, tenant_id)
        REFERENCES public.company_hub_items (id, company_id, tenant_id)
        ON DELETE SET NULL (item_id),
    CONSTRAINT company_consultant_requests_asset_fk
        FOREIGN KEY (asset_id, company_id, tenant_id)
        REFERENCES public.company_assets (id, company_id, tenant_id)
        ON DELETE SET NULL (asset_id)
);

CREATE INDEX IF NOT EXISTS company_consultant_requests_company_status_idx
    ON public.company_consultant_requests (tenant_id, company_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.company_activity_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid NOT NULL,
    office_id uuid,
    actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT company_activity_events_company_fk
        FOREIGN KEY (company_id, tenant_id)
        REFERENCES public.company_accounts (id, tenant_id)
        ON DELETE CASCADE,
    CONSTRAINT company_activity_events_office_fk
        FOREIGN KEY (office_id, company_id, tenant_id)
        REFERENCES public.company_offices (id, company_id, tenant_id)
        ON DELETE SET NULL (office_id)
);

CREATE INDEX IF NOT EXISTS company_activity_events_company_created_idx
    ON public.company_activity_events (tenant_id, company_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Shared membership helpers for non-recursive RLS policies
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.company_hub_has_role(
    _company_id uuid,
    _roles text[] DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_members member
        WHERE member.company_id = _company_id
          AND member.user_id = auth.uid()
          AND COALESCE(member.status, 'active') = 'active'
          AND (
              _roles IS NULL
              OR (
                  CASE member.role
                      WHEN 'company_user' THEN 'company_buyer'
                      ELSE member.role
                  END
              ) = ANY (_roles)
          )
    );
$$;

REVOKE ALL ON FUNCTION public.company_hub_has_role(uuid, text[]) FROM public;
REVOKE ALL ON FUNCTION public.company_hub_has_role(uuid, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.company_hub_has_role(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_has_role(uuid, text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.company_hub_is_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.company_hub_has_role(_company_id, NULL);
$$;

REVOKE ALL ON FUNCTION public.company_hub_is_member(uuid) FROM public;
REVOKE ALL ON FUNCTION public.company_hub_is_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.company_hub_is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_is_member(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.company_hub_can_access_office(
    _company_id uuid,
    _office_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.company_members member
        JOIN public.company_offices office
          ON office.company_id = member.company_id
         AND office.id = _office_id
         AND office.status = 'active'
        WHERE member.company_id = _company_id
          AND member.user_id = auth.uid()
          AND COALESCE(member.status, 'active') = 'active'
          AND (
              COALESCE(member.is_all_offices, true)
              OR EXISTS (
                  SELECT 1
                  FROM public.company_member_offices member_office
                  WHERE member_office.company_id = member.company_id
                    AND member_office.user_id = member.user_id
                    AND member_office.office_id = office.id
              )
          )
    );
$$;

REVOKE ALL ON FUNCTION public.company_hub_can_access_office(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.company_hub_can_access_office(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.company_hub_can_access_office(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_can_access_office(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.company_hub_can_manage(
    _tenant_id uuid,
    _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT public.can_access_tenant(_tenant_id)
        OR public.company_hub_has_role(
            _company_id,
            ARRAY['company_owner', 'company_admin']::text[]
        );
$$;

REVOKE ALL ON FUNCTION public.company_hub_can_manage(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.company_hub_can_manage(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.company_hub_can_manage(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_can_manage(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.company_hub_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.company_hub_touch_updated_at() FROM public;
REVOKE ALL ON FUNCTION public.company_hub_touch_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.company_hub_touch_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_touch_updated_at() TO service_role;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'company_accounts',
        'company_members',
        'company_hub_items',
        'company_offices',
        'company_addresses',
        'company_catalog_categories',
        'company_template_bindings',
        'company_template_fields',
        'company_assets',
        'company_order_requests',
        'company_consultant_requests'
    ]
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS company_hub_touch_updated_at ON public.%I',
            table_name
        );
        EXECUTE format(
            'CREATE TRIGGER company_hub_touch_updated_at BEFORE UPDATE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.company_hub_touch_updated_at()',
            table_name
        );
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Data API grants and RLS
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.company_offices FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_offices TO authenticated;
GRANT ALL ON TABLE public.company_offices TO service_role;

REVOKE ALL ON TABLE public.company_addresses FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_addresses TO authenticated;
GRANT ALL ON TABLE public.company_addresses TO service_role;

REVOKE ALL ON TABLE public.company_member_offices FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_member_offices TO authenticated;
GRANT ALL ON TABLE public.company_member_offices TO service_role;

REVOKE ALL ON TABLE public.company_catalog_categories FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_catalog_categories TO authenticated;
GRANT ALL ON TABLE public.company_catalog_categories TO service_role;

REVOKE ALL ON TABLE public.company_catalog_item_offices FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_catalog_item_offices TO authenticated;
GRANT ALL ON TABLE public.company_catalog_item_offices TO service_role;

REVOKE ALL ON TABLE public.company_template_bindings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_template_bindings TO authenticated;
GRANT ALL ON TABLE public.company_template_bindings TO service_role;

REVOKE ALL ON TABLE public.company_template_fields FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_template_fields TO authenticated;
GRANT ALL ON TABLE public.company_template_fields TO service_role;

REVOKE ALL ON TABLE public.company_assets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_assets TO authenticated;
GRANT ALL ON TABLE public.company_assets TO service_role;

REVOKE ALL ON TABLE public.company_order_requests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_order_requests TO authenticated;
GRANT ALL ON TABLE public.company_order_requests TO service_role;

REVOKE ALL ON TABLE public.company_consultant_requests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_consultant_requests TO authenticated;
GRANT ALL ON TABLE public.company_consultant_requests TO service_role;

REVOKE ALL ON TABLE public.company_activity_events FROM anon;
GRANT SELECT ON TABLE public.company_activity_events TO authenticated;
GRANT ALL ON TABLE public.company_activity_events TO service_role;

ALTER TABLE public.company_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_member_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_catalog_item_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_template_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_order_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_consultant_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_activity_events ENABLE ROW LEVEL SECURITY;

-- Tenant operators retain full control through the existing tenant helper.
CREATE POLICY company_offices_tenant_manage ON public.company_offices
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_addresses_tenant_manage ON public.company_addresses
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_member_offices_tenant_manage ON public.company_member_offices
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_catalog_categories_tenant_manage ON public.company_catalog_categories
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_catalog_item_offices_tenant_manage ON public.company_catalog_item_offices
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_template_bindings_tenant_manage ON public.company_template_bindings
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_template_fields_tenant_manage ON public.company_template_fields
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_assets_tenant_manage ON public.company_assets
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_order_requests_tenant_manage ON public.company_order_requests
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_consultant_requests_tenant_manage ON public.company_consultant_requests
    FOR ALL TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
CREATE POLICY company_activity_events_tenant_read ON public.company_activity_events
    FOR SELECT TO authenticated
    USING (public.can_access_tenant(tenant_id));

-- Company members can read their own workspace records.
CREATE POLICY company_offices_member_read ON public.company_offices
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_addresses_member_read ON public.company_addresses
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_member_offices_member_read ON public.company_member_offices
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_catalog_categories_member_read ON public.company_catalog_categories
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_catalog_item_offices_member_read ON public.company_catalog_item_offices
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_template_bindings_member_read ON public.company_template_bindings
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_template_fields_member_read ON public.company_template_fields
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_assets_member_read ON public.company_assets
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_order_requests_member_read ON public.company_order_requests
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_consultant_requests_member_read ON public.company_consultant_requests
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));
CREATE POLICY company_activity_events_member_read ON public.company_activity_events
    FOR SELECT TO authenticated
    USING (public.company_hub_is_member(company_id));

-- Company owners/admins may manage shared workspace configuration.
CREATE POLICY company_offices_company_manage ON public.company_offices
    FOR ALL TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));
CREATE POLICY company_addresses_company_manage ON public.company_addresses
    FOR ALL TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));
CREATE POLICY company_member_offices_company_manage ON public.company_member_offices
    FOR ALL TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));
CREATE POLICY company_catalog_categories_company_manage ON public.company_catalog_categories
    FOR ALL TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));
CREATE POLICY company_catalog_item_offices_company_manage ON public.company_catalog_item_offices
    FOR ALL TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));
CREATE POLICY company_template_bindings_company_manage ON public.company_template_bindings
    FOR ALL TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));
CREATE POLICY company_template_fields_company_manage ON public.company_template_fields
    FOR ALL TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));
CREATE POLICY company_assets_company_manage ON public.company_assets
    FOR ALL TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));

-- Members create immutable request records; later state transitions use a
-- controlled RPC/service boundary instead of direct customer UPDATE grants.
CREATE POLICY company_order_requests_member_insert ON public.company_order_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        requested_by = auth.uid()
        AND public.company_hub_is_member(company_id)
        AND (
            office_id IS NULL
            OR public.company_hub_can_access_office(company_id, office_id)
        )
    );

CREATE POLICY company_consultant_requests_member_insert ON public.company_consultant_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND public.company_hub_is_member(company_id)
        AND (
            office_id IS NULL
            OR public.company_hub_can_access_office(company_id, office_id)
        )
    );

CREATE POLICY company_consultant_requests_company_update ON public.company_consultant_requests
    FOR UPDATE TO authenticated
    USING (public.company_hub_can_manage(tenant_id, company_id))
    WITH CHECK (public.company_hub_can_manage(tenant_id, company_id));

-- Rollback note: disable the Company Hub V2 UI/module path and leave these
-- additive tables and columns in place so template versions, assets, requests,
-- and order references remain auditable. No automatic DROP rollback is safe.
