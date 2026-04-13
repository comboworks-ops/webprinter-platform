-- Template library v2
-- Adds native starter templates, Canva-linked templates, and master-to-tenant visibility.

ALTER TABLE public.designer_templates
    ADD COLUMN IF NOT EXISTS template_pdf_url TEXT,
    ADD COLUMN IF NOT EXISTS editor_json JSONB,
    ADD COLUMN IF NOT EXISTS library_kind TEXT NOT NULL DEFAULT 'blank',
    ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'native',
    ADD COLUMN IF NOT EXISTS external_launch_url TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'designer_templates_library_kind_check'
    ) THEN
        ALTER TABLE public.designer_templates
            ADD CONSTRAINT designer_templates_library_kind_check
            CHECK (library_kind IN ('blank', 'starter', 'canva'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'designer_templates_source_kind_check'
    ) THEN
        ALTER TABLE public.designer_templates
            ADD CONSTRAINT designer_templates_source_kind_check
            CHECK (source_kind IN ('native', 'canva'));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_manage_template_library(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.can_access_tenant(_tenant_id) THEN
        RETURN true;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'master_admin')
          AND (ur.tenant_id = _tenant_id OR ur.role = 'master_admin')
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_template_library(_tenant_id UUID, _is_public BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF _tenant_id = '00000000-0000-0000-0000-000000000000' AND _is_public THEN
        RETURN true;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.tenant_id = _tenant_id
    ) THEN
        RETURN true;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = _tenant_id
          AND t.owner_id = auth.uid()
    ) THEN
        RETURN true;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'master_admin'
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

DROP POLICY IF EXISTS "Templates are publicly readable" ON public.designer_templates;
DROP POLICY IF EXISTS "Admins can manage templates" ON public.designer_templates;
DROP POLICY IF EXISTS "Templates visible to tenant library" ON public.designer_templates;
DROP POLICY IF EXISTS "Admins can manage template library" ON public.designer_templates;

CREATE POLICY "Templates visible to tenant library"
    ON public.designer_templates
    FOR SELECT
    USING (
        is_active = true
        AND public.can_view_template_library(tenant_id, is_public)
    );

CREATE POLICY "Admins can manage template library"
    ON public.designer_templates
    FOR ALL
    USING (public.can_manage_template_library(tenant_id))
    WITH CHECK (public.can_manage_template_library(tenant_id));

CREATE OR REPLACE FUNCTION public.set_designer_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_designer_templates_updated_at ON public.designer_templates;
CREATE TRIGGER trigger_designer_templates_updated_at
    BEFORE UPDATE ON public.designer_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.set_designer_templates_updated_at();

CREATE INDEX IF NOT EXISTS idx_designer_templates_library_kind
    ON public.designer_templates(library_kind);

CREATE INDEX IF NOT EXISTS idx_designer_templates_sort_order
    ON public.designer_templates(sort_order);
