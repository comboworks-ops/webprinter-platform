-- ============================================================
-- POD v2 (Print.com Buyer API) - Database Schema
-- Master-only curated catalog with tenant import capability
-- Date: 2026-01-28
-- ============================================================

-- ============================================================
-- 1. CREATE TABLES
-- ============================================================

-- A) pod2_supplier_connections (MASTER only)
-- Stores encrypted API credentials for POD v2 suppliers
CREATE TABLE IF NOT EXISTS pod2_supplier_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  provider_key TEXT NOT NULL DEFAULT 'printcom',
  base_url TEXT NOT NULL DEFAULT 'https://api.print.com',
  auth_header_mode TEXT NOT NULL DEFAULT 'custom' CHECK (auth_header_mode IN ('authorization_bearer', 'x_api_key', 'custom')),
  auth_header_name TEXT,
  auth_header_prefix TEXT,
  api_key_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pod2_supplier_master_only CHECK (tenant_id = '00000000-0000-0000-0000-000000000000')
);

-- B) pod2_api_presets (MASTER only)
-- Saved API request presets for explorer
CREATE TABLE IF NOT EXISTS pod2_api_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  path TEXT NOT NULL,
  query JSONB DEFAULT '{}'::jsonb,
  body JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pod2_presets_master_only CHECK (tenant_id = '00000000-0000-0000-0000-000000000000')
);

-- C) pod2_catalog_products (MASTER only)
-- Curated POD v2 products with public aliases
CREATE TABLE IF NOT EXISTS pod2_catalog_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  public_title JSONB NOT NULL DEFAULT '{"da": "", "en": ""}'::jsonb,
  public_description JSONB DEFAULT '{"da": "", "en": ""}'::jsonb,
  public_images JSONB DEFAULT '[]'::jsonb,
  supplier_product_ref TEXT NOT NULL,
  supplier_product_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pod2_catalog_master_only CHECK (tenant_id = '00000000-0000-0000-0000-000000000000')
);

-- D) pod2_catalog_attributes (MASTER only)
-- Attribute groups for curated products (e.g., "Paper", "Finish")
CREATE TABLE IF NOT EXISTS pod2_catalog_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  catalog_product_id UUID NOT NULL REFERENCES pod2_catalog_products(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  group_label JSONB NOT NULL DEFAULT '{"da": "", "en": ""}'::jsonb,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pod2_attrs_master_only CHECK (tenant_id = '00000000-0000-0000-0000-000000000000')
);

-- E) pod2_catalog_attribute_values (MASTER only)
-- Values for each attribute (e.g., "Silk 170g", "Matt Lamination")
CREATE TABLE IF NOT EXISTS pod2_catalog_attribute_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  attribute_id UUID NOT NULL REFERENCES pod2_catalog_attributes(id) ON DELETE CASCADE,
  value_key TEXT NOT NULL,
  value_label JSONB NOT NULL DEFAULT '{"da": "", "en": ""}'::jsonb,
  supplier_value_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pod2_vals_master_only CHECK (tenant_id = '00000000-0000-0000-0000-000000000000')
);

-- F) pod2_catalog_price_matrix (MASTER only)
-- Pricing for each variant combination
CREATE TABLE IF NOT EXISTS pod2_catalog_price_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  catalog_product_id UUID NOT NULL REFERENCES pod2_catalog_products(id) ON DELETE CASCADE,
  variant_signature TEXT NOT NULL,
  quantities INT[] NOT NULL DEFAULT ARRAY[10, 25, 50, 100, 250, 500, 1000],
  base_costs NUMERIC[] NOT NULL DEFAULT ARRAY[]::NUMERIC[],
  recommended_retail NUMERIC[] NOT NULL DEFAULT ARRAY[]::NUMERIC[],
  currency TEXT DEFAULT 'DKK',
  needs_quote BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT pod2_matrix_master_only CHECK (tenant_id = '00000000-0000-0000-0000-000000000000'),
  UNIQUE (catalog_product_id, variant_signature)
);

-- G) pod2_tenant_imports (TENANT rows)
-- Links tenant products to POD v2 catalog
CREATE TABLE IF NOT EXISTS pod2_tenant_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  catalog_product_id UUID NOT NULL REFERENCES pod2_catalog_products(id),
  product_id UUID NOT NULL,
  variant_mapping JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- H) pod2_tenant_billing (TENANT rows)
-- Stripe payment setup for off-session charging (future use)
CREATE TABLE IF NOT EXISTS pod2_tenant_billing (
  tenant_id UUID PRIMARY KEY,
  stripe_customer_id TEXT NOT NULL,
  default_payment_method_id TEXT,
  is_ready BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- I) pod2_fulfillment_jobs (TENANT rows)
-- POD v2 jobs awaiting approval/payment/fulfillment (future use)
CREATE TABLE IF NOT EXISTS pod2_fulfillment_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  order_id UUID NOT NULL,
  order_item_id UUID NOT NULL,
  catalog_product_id UUID NOT NULL REFERENCES pod2_catalog_products(id),
  variant_signature TEXT NOT NULL,
  qty INT NOT NULL,
  tenant_cost NUMERIC NOT NULL,
  currency TEXT DEFAULT 'DKK',
  status TEXT NOT NULL DEFAULT 'awaiting_approval' CHECK (status IN ('awaiting_approval', 'payment_pending', 'paid', 'submitted', 'failed', 'completed')),
  stripe_payment_intent_id TEXT,
  provider_job_ref TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. CREATE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pod2_catalog_status ON pod2_catalog_products(status);
CREATE INDEX IF NOT EXISTS idx_pod2_tenant_imports_tenant ON pod2_tenant_imports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pod2_jobs_tenant_status ON pod2_fulfillment_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pod2_jobs_order ON pod2_fulfillment_jobs(order_id);

-- ============================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE pod2_supplier_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod2_api_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod2_catalog_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod2_catalog_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod2_catalog_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod2_catalog_price_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod2_tenant_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod2_tenant_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod2_fulfillment_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. HELPER FUNCTION FOR MASTER ADMIN CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION is_pod2_master_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = '00000000-0000-0000-0000-000000000000'
    AND role IN ('admin', 'master_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. RLS POLICIES - MASTER ONLY TABLES
-- ============================================================

DROP POLICY IF EXISTS "pod2_supplier_master_only" ON pod2_supplier_connections;
CREATE POLICY "pod2_supplier_master_only" ON pod2_supplier_connections
  FOR ALL USING (is_pod2_master_admin());

DROP POLICY IF EXISTS "pod2_presets_master_only" ON pod2_api_presets;
CREATE POLICY "pod2_presets_master_only" ON pod2_api_presets
  FOR ALL USING (is_pod2_master_admin());

DROP POLICY IF EXISTS "pod2_catalog_master_write" ON pod2_catalog_products;
CREATE POLICY "pod2_catalog_master_write" ON pod2_catalog_products
  FOR ALL USING (is_pod2_master_admin());

DROP POLICY IF EXISTS "pod2_attrs_master_only" ON pod2_catalog_attributes;
CREATE POLICY "pod2_attrs_master_only" ON pod2_catalog_attributes
  FOR ALL USING (is_pod2_master_admin());

DROP POLICY IF EXISTS "pod2_vals_master_only" ON pod2_catalog_attribute_values;
CREATE POLICY "pod2_vals_master_only" ON pod2_catalog_attribute_values
  FOR ALL USING (is_pod2_master_admin());

DROP POLICY IF EXISTS "pod2_matrix_master_only" ON pod2_catalog_price_matrix;
CREATE POLICY "pod2_matrix_master_only" ON pod2_catalog_price_matrix
  FOR ALL USING (is_pod2_master_admin());

-- Public view for catalog browsing (authenticated)
DROP VIEW IF EXISTS pod2_catalog_public;
CREATE VIEW pod2_catalog_public AS
SELECT
  id,
  public_title,
  public_description,
  public_images,
  status,
  created_at,
  updated_at
FROM pod2_catalog_products
WHERE status = 'published';

GRANT SELECT ON pod2_catalog_public TO authenticated;

-- ============================================================
-- 6. RLS POLICIES - TENANT TABLES
-- ============================================================

DROP POLICY IF EXISTS "pod2_imports_tenant" ON pod2_tenant_imports;
CREATE POLICY "pod2_imports_tenant" ON pod2_tenant_imports
  FOR ALL USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_pod2_master_admin());

DROP POLICY IF EXISTS "pod2_billing_tenant" ON pod2_tenant_billing;
CREATE POLICY "pod2_billing_tenant" ON pod2_tenant_billing
  FOR ALL USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_pod2_master_admin());

DROP POLICY IF EXISTS "pod2_jobs_tenant" ON pod2_fulfillment_jobs;
CREATE POLICY "pod2_jobs_tenant" ON pod2_fulfillment_jobs
  FOR ALL USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id) OR is_pod2_master_admin());

-- ============================================================
-- 7. UPDATED AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_pod2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pod2_supplier_updated ON pod2_supplier_connections;
CREATE TRIGGER pod2_supplier_updated BEFORE UPDATE ON pod2_supplier_connections
  FOR EACH ROW EXECUTE FUNCTION update_pod2_updated_at();

DROP TRIGGER IF EXISTS pod2_catalog_updated ON pod2_catalog_products;
CREATE TRIGGER pod2_catalog_updated BEFORE UPDATE ON pod2_catalog_products
  FOR EACH ROW EXECUTE FUNCTION update_pod2_updated_at();

DROP TRIGGER IF EXISTS pod2_matrix_updated ON pod2_catalog_price_matrix;
CREATE TRIGGER pod2_matrix_updated BEFORE UPDATE ON pod2_catalog_price_matrix
  FOR EACH ROW EXECUTE FUNCTION update_pod2_updated_at();

DROP TRIGGER IF EXISTS pod2_billing_updated ON pod2_tenant_billing;
CREATE TRIGGER pod2_billing_updated BEFORE UPDATE ON pod2_tenant_billing
  FOR EACH ROW EXECUTE FUNCTION update_pod2_updated_at();

DROP TRIGGER IF EXISTS pod2_jobs_updated ON pod2_fulfillment_jobs;
CREATE TRIGGER pod2_jobs_updated BEFORE UPDATE ON pod2_fulfillment_jobs
  FOR EACH ROW EXECUTE FUNCTION update_pod2_updated_at();

-- ============================================================
-- DONE! POD v2 system tables created.
-- ============================================================
