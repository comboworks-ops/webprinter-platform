-- Atomic, draft-only replacement for snapshot-priced WMD roll-label imports.
-- PostgreSQL rolls the complete function call back if any validation, delete,
-- insert, or constraint fails. The product row lock serializes publication
-- against the import so this function can never rewrite a live product.
--
-- Ordered rollback (only through a separately reviewed forward migration):
-- 1. Revoke service_role execution of
--    apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb) to stop writes.
-- 2. Drop the wmd_guard_* INSERT/UPDATE/DELETE policies from the eleven
--    storformat tables listed in the policy loop at the end of this file.
-- 3. Revoke and drop get_wmd_snapshot_draft_revision(uuid, uuid), then revoke
--    and drop apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb).
-- 4. Retain wmd_snapshot_draft_import_state for audit until retention approval;
--    only then drop it (its explicit index drops with the table).
-- 5. Drop storformat_configs.rounding_mode only after every reader is migrated
--    and retained snapshot drafts no longer depend on ceil_v1 provenance.
-- Do not drop the shared extensions schema or pgcrypto extension here.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.storformat_configs
  ADD COLUMN IF NOT EXISTS rounding_mode text NOT NULL DEFAULT 'nearest_v1'
  CHECK (rounding_mode IN ('nearest_v1', 'ceil_v1'));

CREATE TABLE public.wmd_snapshot_draft_import_state (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  revision bigint NOT NULL CHECK (revision >= 1),
  mode text NOT NULL CHECK (mode IN ('create', 'replace')),
  expected_revision bigint NOT NULL CHECK (expected_revision >= 0),
  import_id uuid NOT NULL,
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  payload_fingerprint text NOT NULL
    CHECK (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, import_id),
  UNIQUE (tenant_id, product_id, revision)
);

CREATE INDEX wmd_snapshot_draft_import_state_product_revision_idx
  ON public.wmd_snapshot_draft_import_state (
    tenant_id,
    product_id,
    revision DESC
  );

ALTER TABLE public.wmd_snapshot_draft_import_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.wmd_snapshot_draft_import_state
  FROM public, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.wmd_snapshot_draft_import_state TO service_role;

CREATE FUNCTION public.apply_wmd_roll_label_snapshot_draft_import(
  _tenant_id uuid,
  _payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  target_product_id uuid;
  target_is_published boolean;
  target_config_is_published boolean;
  target_input record;
  target_state record;
  existing_import_state record;
  authoritative_payload_fingerprint text;
  next_revision bigint;
  product_input record;
  config_input record;
BEGIN
  IF _tenant_id IS NULL
    OR _payload IS NULL
    OR jsonb_typeof(_payload) <> 'object'
    OR pg_column_size(_payload) > 16777216
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft import payload'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (_payload ?& ARRAY[
      'target',
      'product',
      'materials',
      'material_price_tiers',
      'material_m2_prices',
      'variants',
      'variant_price_tiers',
      'variant_m2_prices',
      'config'
    ]::text[])
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(_payload) AS payload_key(key)
      WHERE payload_key.key <> ALL (ARRAY[
        'target',
        'product',
        'materials',
        'material_price_tiers',
        'material_m2_prices',
        'variants',
        'variant_price_tiers',
        'variant_m2_prices',
        'config'
      ]::text[])
    )
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft import shape'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(_payload -> 'target') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_payload -> 'product') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_payload -> 'config') IS DISTINCT FROM 'object'
    OR jsonb_typeof(_payload -> 'materials') IS DISTINCT FROM 'array'
    OR jsonb_typeof(_payload -> 'material_price_tiers') IS DISTINCT FROM 'array'
    OR jsonb_typeof(_payload -> 'material_m2_prices') IS DISTINCT FROM 'array'
    OR jsonb_typeof(_payload -> 'variants') IS DISTINCT FROM 'array'
    OR jsonb_typeof(_payload -> 'variant_price_tiers') IS DISTINCT FROM 'array'
    OR jsonb_typeof(_payload -> 'variant_m2_prices') IS DISTINCT FROM 'array'
    OR jsonb_array_length(_payload -> 'materials') NOT BETWEEN 1 AND 500
    OR jsonb_array_length(_payload -> 'material_price_tiers') > 10000
    OR jsonb_array_length(_payload -> 'material_m2_prices') > 10000
    OR jsonb_array_length(_payload -> 'variants') NOT BETWEEN 1 AND 500
    OR jsonb_array_length(_payload -> 'variant_price_tiers') > 10000
    OR jsonb_array_length(_payload -> 'variant_m2_prices') > 10000
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft import collections'
      USING ERRCODE = '22023';
  END IF;

  IF NOT ((_payload -> 'target') ?& ARRAY[
      'mode',
      'product_id',
      'expected_revision',
      'import_id',
      'payload_digest'
    ]::text[])
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(_payload -> 'target') AS target_key(key)
      WHERE target_key.key <> ALL (ARRAY[
        'mode',
        'product_id',
        'expected_revision',
        'import_id',
        'payload_digest'
      ]::text[])
    )
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft target shape'
      USING ERRCODE = '22023';
  END IF;

  SELECT target_row.*
  INTO target_input
  FROM jsonb_to_record(_payload -> 'target') AS target_row(
    mode text,
    product_id uuid,
    expected_revision bigint,
    import_id uuid,
    payload_digest text
  );

  IF target_input.mode NOT IN ('create', 'replace')
    OR target_input.import_id IS NULL
    OR COALESCE(target_input.payload_digest, '') !~ '^[a-f0-9]{64}$'
    OR (
      target_input.mode = 'create'
      AND (
        target_input.product_id IS NOT NULL
        OR target_input.expected_revision IS DISTINCT FROM 0
      )
    )
    OR (
      target_input.mode = 'replace'
      AND (
        target_input.product_id IS NULL
        OR target_input.expected_revision IS NULL
        OR target_input.expected_revision < 1
      )
    )
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft target values'
      USING ERRCODE = '22023';
  END IF;

  IF NOT ((_payload -> 'product') ?& ARRAY[
      'name',
      'slug',
      'icon_text',
      'description',
      'category',
      'pricing_type',
      'preset_key',
      'technical_specs'
    ]::text[])
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(_payload -> 'product') AS product_key(key)
      WHERE product_key.key <> ALL (ARRAY[
        'name',
        'slug',
        'icon_text',
        'description',
        'category',
        'pricing_type',
        'preset_key',
        'technical_specs'
      ]::text[])
    )
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft product shape'
      USING ERRCODE = '22023';
  END IF;

  -- JSONB text is canonical for object key order. The server fingerprints the
  -- complete accepted payload while excluding only the caller-claimed digest
  -- field, so a reused import ID cannot replay a mutated body as a false no-op.
  authoritative_payload_fingerprint := encode(
    extensions.digest(
      (_payload #- '{target,payload_digest}'::text[])::text,
      'sha256'
    ),
    'hex'
  );

  SELECT product_row.*
  INTO product_input
  FROM jsonb_to_record(_payload -> 'product') AS product_row(
    name text,
    slug text,
    icon_text text,
    description text,
    category text,
    pricing_type text,
    preset_key text,
    technical_specs jsonb
  );

  IF length(btrim(COALESCE(product_input.name, ''))) NOT BETWEEN 1 AND 200
    OR length(COALESCE(product_input.slug, '')) NOT BETWEEN 1 AND 200
    OR product_input.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    OR length(COALESCE(product_input.icon_text, '')) > 200
    OR length(COALESCE(product_input.description, '')) > 10000
    OR length(btrim(COALESCE(product_input.category, ''))) NOT BETWEEN 1 AND 100
    OR product_input.pricing_type IS DISTINCT FROM 'STORFORMAT'
    OR product_input.preset_key IS DISTINCT FROM 'custom'
    OR jsonb_typeof(product_input.technical_specs) IS DISTINCT FROM 'object'
    OR NOT (product_input.technical_specs ?& ARRAY[
      'source',
      'import_type',
      'import_script',
      'fx_snapshot_id',
      'fx_provider',
      'fx_rate',
      'fx_rate_date',
      'fx_fetched_at',
      'fx_source_payload_sha256',
      'pricing_buffer_pct'
    ]::text[])
    OR product_input.technical_specs ->> 'source' IS DISTINCT FROM 'wmd'
    OR product_input.technical_specs ->> 'import_type' IS DISTINCT FROM 'fetch2-roll-labels'
    OR product_input.technical_specs ->> 'import_script' IS DISTINCT FROM 'fetch2-wmd-roll-labels.mjs'
    OR length(COALESCE(product_input.technical_specs ->> 'fx_snapshot_id', ''))
      NOT BETWEEN 1 AND 128
    OR product_input.technical_specs ->> 'fx_provider' IS DISTINCT FROM 'frankfurter_ecb'
    OR COALESCE(product_input.technical_specs ->> 'fx_rate', '')
      !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'
    OR (product_input.technical_specs ->> 'fx_rate')::numeric <= 0
    OR (product_input.technical_specs ->> 'fx_rate')::numeric > 100
    OR COALESCE(product_input.technical_specs ->> 'fx_rate_date', '')
      !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR COALESCE(product_input.technical_specs ->> 'fx_fetched_at', '')
      !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
    OR COALESCE(product_input.technical_specs ->> 'fx_source_payload_sha256', '')
      !~ '^[a-f0-9]{64}$'
    OR COALESCE(product_input.technical_specs ->> 'pricing_buffer_pct', '')
      !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$'
    OR (product_input.technical_specs ->> 'pricing_buffer_pct')::numeric > 100
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft product evidence'
      USING ERRCODE = '22023';
  END IF;

  IF NOT ((_payload -> 'config') ?& ARRAY[
      'rounding_step',
      'rounding_mode',
      'quantities',
      'layout_rows',
      'vertical_axis'
    ]::text[])
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(_payload -> 'config') AS config_key(key)
      WHERE config_key.key <> ALL (ARRAY[
        'rounding_step',
        'rounding_mode',
        'quantities',
        'layout_rows',
        'vertical_axis'
      ]::text[])
    )
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft config shape'
      USING ERRCODE = '22023';
  END IF;

  SELECT config_row.*
  INTO config_input
  FROM jsonb_to_record(_payload -> 'config') AS config_row(
    rounding_step integer,
    rounding_mode text,
    quantities integer[],
    layout_rows jsonb,
    vertical_axis jsonb
  );

  IF config_input.rounding_step NOT BETWEEN 1 AND 1000
    OR config_input.rounding_mode IS DISTINCT FROM 'ceil_v1'
    OR COALESCE(array_length(config_input.quantities, 1), 0) NOT BETWEEN 1 AND 1000
    OR EXISTS (
      SELECT 1
      FROM unnest(config_input.quantities) AS quantity(value)
      WHERE quantity.value NOT BETWEEN 1 AND 100000000
    )
    OR jsonb_typeof(config_input.layout_rows) IS DISTINCT FROM 'array'
    OR jsonb_array_length(config_input.layout_rows) > 20
    OR jsonb_typeof(config_input.vertical_axis) IS DISTINCT FROM 'object'
  THEN
    RAISE EXCEPTION 'Invalid snapshot draft config values'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_payload -> 'materials') AS element(item)
    WHERE jsonb_typeof(element.item) <> 'object'
      OR NOT (element.item ?& ARRAY[
        'id', 'name', 'group_label', 'bleed_mm', 'safe_area_mm',
        'max_width_mm', 'max_height_mm', 'allow_split',
        'interpolation_enabled', 'markup_pct', 'sort_order'
      ]::text[])
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(element.item) AS item_key(key)
        WHERE item_key.key <> ALL (ARRAY[
          'id', 'name', 'group_label', 'bleed_mm', 'safe_area_mm',
          'max_width_mm', 'max_height_mm', 'allow_split',
          'interpolation_enabled', 'markup_pct', 'sort_order'
        ]::text[])
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_payload -> 'materials') AS material(
      id uuid, name text, group_label text, bleed_mm integer,
      safe_area_mm integer, max_width_mm numeric, max_height_mm numeric,
      allow_split boolean, interpolation_enabled boolean,
      markup_pct numeric, sort_order integer
    )
    WHERE material.id IS NULL
      OR length(btrim(COALESCE(material.name, ''))) NOT BETWEEN 1 AND 500
      OR length(COALESCE(material.group_label, '')) > 500
      OR material.bleed_mm NOT BETWEEN 0 AND 1000
      OR material.safe_area_mm NOT BETWEEN 0 AND 1000
      OR (material.max_width_mm IS NOT NULL AND material.max_width_mm <= 0)
      OR (material.max_height_mm IS NOT NULL AND material.max_height_mm <= 0)
      OR material.allow_split IS NULL
      OR material.interpolation_enabled IS NULL
      OR material.markup_pct <> 0
      OR material.sort_order NOT BETWEEN 0 AND 10000
  ) THEN
    RAISE EXCEPTION 'Invalid snapshot draft materials'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_payload -> 'material_price_tiers') AS element(item)
    WHERE jsonb_typeof(element.item) <> 'object'
      OR NOT (element.item ?& ARRAY[
        'id', 'material_id', 'from_m2', 'to_m2', 'price_per_m2',
        'is_anchor', 'markup_pct', 'sort_order'
      ]::text[])
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(element.item) AS item_key(key)
        WHERE item_key.key <> ALL (ARRAY[
          'id', 'material_id', 'from_m2', 'to_m2', 'price_per_m2',
          'is_anchor', 'markup_pct', 'sort_order'
        ]::text[])
      )
      OR jsonb_typeof(element.item -> 'price_per_m2') IS DISTINCT FROM 'number'
      OR COALESCE(element.item ->> 'price_per_m2', '') !~
        '^(0|[1-9][0-9]{0,9})([.][0-9]{0,23}[1-9])?$'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_payload -> 'material_price_tiers') AS tier(
      id uuid, material_id uuid, from_m2 numeric, to_m2 numeric,
      price_per_m2 numeric, is_anchor boolean, markup_pct numeric,
      sort_order integer
    )
    WHERE tier.id IS NULL OR tier.material_id IS NULL
      OR tier.from_m2 < 0
      OR (tier.to_m2 IS NOT NULL AND tier.to_m2 <= tier.from_m2)
      OR tier.price_per_m2 <= 0
      OR tier.price_per_m2 > 1000000000
      OR scale(tier.price_per_m2) > 24
      OR tier.is_anchor IS NULL
      OR tier.markup_pct <> 0
      OR tier.sort_order NOT BETWEEN 0 AND 10000
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_payload -> 'materials') AS material(item)
        WHERE material.item ->> 'id' = tier.material_id::text
      )
  ) THEN
    RAISE EXCEPTION 'Invalid snapshot draft material tiers'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_payload -> 'material_m2_prices') AS element(item)
    WHERE jsonb_typeof(element.item) <> 'object'
      OR NOT (element.item ?& ARRAY[
        'id', 'material_id', 'from_m2', 'to_m2', 'price_per_m2', 'is_anchor'
      ]::text[])
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(element.item) AS item_key(key)
        WHERE item_key.key <> ALL (ARRAY[
          'id', 'material_id', 'from_m2', 'to_m2', 'price_per_m2', 'is_anchor'
        ]::text[])
      )
      OR jsonb_typeof(element.item -> 'price_per_m2') IS DISTINCT FROM 'number'
      OR COALESCE(element.item ->> 'price_per_m2', '') !~
        '^(0|[1-9][0-9]{0,9})([.][0-9]{0,23}[1-9])?$'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_payload -> 'material_m2_prices') AS tier(
      id uuid, material_id uuid, from_m2 numeric, to_m2 numeric,
      price_per_m2 numeric, is_anchor boolean
    )
    WHERE tier.id IS NULL OR tier.material_id IS NULL
      OR tier.from_m2 < 0
      OR (tier.to_m2 IS NOT NULL AND tier.to_m2 <= tier.from_m2)
      OR tier.price_per_m2 <= 0
      OR tier.price_per_m2 > 1000000000
      OR scale(tier.price_per_m2) > 24
      OR tier.is_anchor IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_payload -> 'materials') AS material(item)
        WHERE material.item ->> 'id' = tier.material_id::text
      )
  ) THEN
    RAISE EXCEPTION 'Invalid snapshot draft material m2 prices'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_payload -> 'variants') AS element(item)
    WHERE jsonb_typeof(element.item) <> 'object'
      OR NOT (element.item ?& ARRAY[
        'id', 'name', 'group_label', 'pricing_mode', 'initial_price',
        'interpolation_enabled', 'markup_pct', 'sort_order', 'pricing_type',
        'percentage_markup', 'min_price'
      ]::text[])
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(element.item) AS item_key(key)
        WHERE item_key.key <> ALL (ARRAY[
          'id', 'name', 'group_label', 'pricing_mode', 'initial_price',
          'interpolation_enabled', 'markup_pct', 'sort_order', 'pricing_type',
          'percentage_markup', 'min_price'
        ]::text[])
      )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_payload -> 'variants') AS variant(
      id uuid, name text, group_label text, pricing_mode text,
      initial_price numeric, interpolation_enabled boolean,
      markup_pct numeric, sort_order integer, pricing_type text,
      percentage_markup numeric, min_price numeric
    )
    WHERE variant.id IS NULL
      OR length(btrim(COALESCE(variant.name, ''))) NOT BETWEEN 1 AND 500
      OR length(COALESCE(variant.group_label, '')) > 500
      OR variant.pricing_mode NOT IN ('fixed', 'per_m2')
      OR variant.initial_price < 0
      OR variant.interpolation_enabled IS NULL
      OR variant.markup_pct <> 0
      OR variant.sort_order NOT BETWEEN 0 AND 10000
      OR variant.pricing_type NOT IN ('fixed', 'm2')
      OR (variant.pricing_mode = 'per_m2' AND variant.pricing_type <> 'm2')
      OR (variant.pricing_mode = 'fixed' AND variant.pricing_type <> 'fixed')
      OR variant.percentage_markup <> 0
      OR variant.min_price < 0
  ) THEN
    RAISE EXCEPTION 'Invalid snapshot draft variants'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_payload -> 'variant_price_tiers') AS element(item)
    WHERE jsonb_typeof(element.item) <> 'object'
      OR NOT (element.item ?& ARRAY[
        'id', 'variant_id', 'from_m2', 'to_m2', 'price_per_m2',
        'is_anchor', 'markup_pct', 'sort_order'
      ]::text[])
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(element.item) AS item_key(key)
        WHERE item_key.key <> ALL (ARRAY[
          'id', 'variant_id', 'from_m2', 'to_m2', 'price_per_m2',
          'is_anchor', 'markup_pct', 'sort_order'
        ]::text[])
      )
      OR jsonb_typeof(element.item -> 'price_per_m2') IS DISTINCT FROM 'number'
      OR COALESCE(element.item ->> 'price_per_m2', '') !~
        '^(0|[1-9][0-9]{0,9})([.][0-9]{0,23}[1-9])?$'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_payload -> 'variant_price_tiers') AS tier(
      id uuid, variant_id uuid, from_m2 numeric, to_m2 numeric,
      price_per_m2 numeric, is_anchor boolean, markup_pct numeric,
      sort_order integer
    )
    WHERE tier.id IS NULL OR tier.variant_id IS NULL
      OR tier.from_m2 < 0
      OR (tier.to_m2 IS NOT NULL AND tier.to_m2 <= tier.from_m2)
      OR tier.price_per_m2 <= 0
      OR tier.price_per_m2 > 1000000000
      OR scale(tier.price_per_m2) > 24
      OR tier.is_anchor IS NULL
      OR tier.markup_pct <> 0
      OR tier.sort_order NOT BETWEEN 0 AND 10000
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_payload -> 'variants') AS variant(item)
        WHERE variant.item ->> 'id' = tier.variant_id::text
      )
  ) THEN
    RAISE EXCEPTION 'Invalid snapshot draft variant tiers'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_payload -> 'variant_m2_prices') AS element(item)
    WHERE jsonb_typeof(element.item) <> 'object'
      OR NOT (element.item ?& ARRAY[
        'id', 'variant_id', 'from_m2', 'to_m2', 'price_per_m2', 'is_anchor'
      ]::text[])
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(element.item) AS item_key(key)
        WHERE item_key.key <> ALL (ARRAY[
          'id', 'variant_id', 'from_m2', 'to_m2', 'price_per_m2', 'is_anchor'
        ]::text[])
      )
      OR jsonb_typeof(element.item -> 'price_per_m2') IS DISTINCT FROM 'number'
      OR COALESCE(element.item ->> 'price_per_m2', '') !~
        '^(0|[1-9][0-9]{0,9})([.][0-9]{0,23}[1-9])?$'
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_payload -> 'variant_m2_prices') AS tier(
      id uuid, variant_id uuid, from_m2 numeric, to_m2 numeric,
      price_per_m2 numeric, is_anchor boolean
    )
    WHERE tier.id IS NULL OR tier.variant_id IS NULL
      OR tier.from_m2 < 0
      OR (tier.to_m2 IS NOT NULL AND tier.to_m2 <= tier.from_m2)
      OR tier.price_per_m2 <= 0
      OR tier.price_per_m2 > 1000000000
      OR scale(tier.price_per_m2) > 24
      OR tier.is_anchor IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(_payload -> 'variants') AS variant(item)
        WHERE variant.item ->> 'id' = tier.variant_id::text
      )
  ) THEN
    RAISE EXCEPTION 'Invalid snapshot draft variant m2 prices'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'wmd-snapshot-draft:' || _tenant_id::text || ':' ||
      CASE
        WHEN target_input.mode = 'create' THEN 'slug:' || product_input.slug
        ELSE 'product:' || target_input.product_id::text
      END,
      0
    )
  );

  SELECT
    import_state.product_id,
    import_state.revision,
    import_state.mode,
    import_state.expected_revision,
    import_state.import_id,
    import_state.payload_digest,
    import_state.payload_fingerprint,
    products.slug
  INTO existing_import_state
  FROM public.wmd_snapshot_draft_import_state AS import_state
  JOIN public.products
    ON products.id = import_state.product_id
   AND products.tenant_id = import_state.tenant_id
  WHERE import_state.tenant_id = _tenant_id
    AND import_state.import_id = target_input.import_id
  FOR UPDATE OF import_state, products;

  IF FOUND THEN
    IF existing_import_state.payload_digest IS DISTINCT FROM target_input.payload_digest
      OR existing_import_state.payload_fingerprint
        IS DISTINCT FROM authoritative_payload_fingerprint
    THEN
      RAISE EXCEPTION 'Snapshot import id was reused with different payload'
        USING ERRCODE = '22023';
    END IF;

    IF existing_import_state.mode IS DISTINCT FROM target_input.mode
      OR existing_import_state.expected_revision IS DISTINCT FROM target_input.expected_revision
      OR existing_import_state.slug IS DISTINCT FROM product_input.slug
      OR (
        target_input.mode = 'replace'
        AND existing_import_state.product_id IS DISTINCT FROM target_input.product_id
      )
    THEN
      RAISE EXCEPTION 'Snapshot import id does not match the requested target'
        USING ERRCODE = '22023';
    END IF;

    RETURN existing_import_state.product_id;
  END IF;

  IF target_input.mode = 'create' THEN
    SELECT products.id
    INTO target_product_id
    FROM public.products
    WHERE products.tenant_id = _tenant_id
      AND products.slug = product_input.slug
    FOR UPDATE;

    IF FOUND THEN
      RAISE EXCEPTION 'Snapshot draft create target already exists'
        USING ERRCODE = '23505';
    END IF;

    target_product_id := pg_catalog.gen_random_uuid();
    INSERT INTO public.products (
      id,
      tenant_id,
      name,
      slug,
      icon_text,
      description,
      category,
      pricing_type,
      is_published,
      preset_key,
      technical_specs
    ) VALUES (
      target_product_id,
      _tenant_id,
      product_input.name,
      product_input.slug,
      product_input.icon_text,
      product_input.description,
      product_input.category,
      product_input.pricing_type,
      false,
      product_input.preset_key,
      product_input.technical_specs
    );
    next_revision := 1;
  ELSE
    SELECT products.id, products.is_published
    INTO target_product_id, target_is_published
    FROM public.products
    WHERE products.tenant_id = _tenant_id
      AND products.id = target_input.product_id
    FOR UPDATE;

    IF NOT FOUND OR target_product_id IS NULL THEN
      RAISE EXCEPTION 'Snapshot draft replacement target does not exist'
        USING ERRCODE = 'P0002';
    END IF;

    IF product_input.slug IS DISTINCT FROM (
      SELECT products.slug
      FROM public.products
      WHERE products.id = target_product_id
    ) THEN
      RAISE EXCEPTION 'Snapshot draft replacement may not change the target slug'
        USING ERRCODE = '22023';
    END IF;

    IF target_is_published THEN
      RAISE EXCEPTION 'Snapshot pricing may write only to an unpublished draft'
        USING ERRCODE = '55000';
    END IF;

    SELECT configs.is_published
    INTO target_config_is_published
    FROM public.storformat_configs AS configs
    WHERE configs.product_id = target_product_id
    FOR UPDATE;

    IF target_config_is_published THEN
      RAISE EXCEPTION 'Snapshot pricing may write only to an unpublished draft'
        USING ERRCODE = '55000';
    END IF;

    SELECT import_state.*
    INTO target_state
    FROM public.wmd_snapshot_draft_import_state AS import_state
    WHERE import_state.tenant_id = _tenant_id
      AND import_state.product_id = target_product_id
    ORDER BY import_state.revision DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Snapshot draft replacement target has no import state'
        USING ERRCODE = '55000';
    END IF;

    IF target_state.revision IS DISTINCT FROM target_input.expected_revision THEN
      RAISE EXCEPTION 'Stale snapshot draft revision'
        USING ERRCODE = '40001';
    END IF;

    next_revision := target_state.revision + 1;

    UPDATE public.products
    SET name = product_input.name,
        icon_text = product_input.icon_text,
        description = product_input.description,
        category = product_input.category,
        pricing_type = product_input.pricing_type,
        preset_key = product_input.preset_key,
        technical_specs = product_input.technical_specs
    WHERE id = target_product_id;
  END IF;

  DELETE FROM public.storformat_product_m2_prices
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_product_price_tiers
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_product_fixed_prices
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_m2_prices
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_finish_prices
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_material_price_tiers
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_finish_price_tiers
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_products
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_finishes
  WHERE product_id = target_product_id;
  DELETE FROM public.storformat_materials
  WHERE product_id = target_product_id;

  INSERT INTO public.storformat_materials (
    id, tenant_id, product_id, name, group_label, bleed_mm, safe_area_mm,
    max_width_mm, max_height_mm, allow_split, interpolation_enabled,
    markup_pct, sort_order
  )
  SELECT
    material.id, _tenant_id, target_product_id, material.name,
    material.group_label, material.bleed_mm, material.safe_area_mm,
    material.max_width_mm, material.max_height_mm, material.allow_split,
    material.interpolation_enabled, material.markup_pct, material.sort_order
  FROM jsonb_to_recordset(_payload -> 'materials') AS material(
    id uuid, name text, group_label text, bleed_mm integer,
    safe_area_mm integer, max_width_mm numeric, max_height_mm numeric,
    allow_split boolean, interpolation_enabled boolean,
    markup_pct numeric, sort_order integer
  );

  INSERT INTO public.storformat_material_price_tiers (
    id, tenant_id, product_id, material_id, from_m2, to_m2,
    price_per_m2, is_anchor, markup_pct, sort_order
  )
  SELECT
    tier.id, _tenant_id, target_product_id, tier.material_id, tier.from_m2,
    tier.to_m2, tier.price_per_m2, tier.is_anchor, tier.markup_pct,
    tier.sort_order
  FROM jsonb_to_recordset(_payload -> 'material_price_tiers') AS tier(
    id uuid, material_id uuid, from_m2 numeric, to_m2 numeric,
    price_per_m2 numeric, is_anchor boolean, markup_pct numeric,
    sort_order integer
  );

  INSERT INTO public.storformat_m2_prices (
    id, tenant_id, product_id, material_id, from_m2, to_m2,
    price_per_m2, is_anchor
  )
  SELECT
    tier.id, _tenant_id, target_product_id, tier.material_id, tier.from_m2,
    tier.to_m2, tier.price_per_m2, tier.is_anchor
  FROM jsonb_to_recordset(_payload -> 'material_m2_prices') AS tier(
    id uuid, material_id uuid, from_m2 numeric, to_m2 numeric,
    price_per_m2 numeric, is_anchor boolean
  );

  INSERT INTO public.storformat_products (
    id, tenant_id, product_id, name, group_label, pricing_mode,
    initial_price, interpolation_enabled, markup_pct, sort_order,
    pricing_type, percentage_markup, min_price
  )
  SELECT
    variant.id, _tenant_id, target_product_id, variant.name,
    variant.group_label, variant.pricing_mode, variant.initial_price,
    variant.interpolation_enabled, variant.markup_pct, variant.sort_order,
    variant.pricing_type, variant.percentage_markup, variant.min_price
  FROM jsonb_to_recordset(_payload -> 'variants') AS variant(
    id uuid, name text, group_label text, pricing_mode text,
    initial_price numeric, interpolation_enabled boolean,
    markup_pct numeric, sort_order integer, pricing_type text,
    percentage_markup numeric, min_price numeric
  );

  INSERT INTO public.storformat_product_price_tiers (
    id, tenant_id, product_id, product_item_id, from_m2, to_m2,
    price_per_m2, is_anchor, markup_pct, sort_order
  )
  SELECT
    tier.id, _tenant_id, target_product_id, tier.variant_id, tier.from_m2,
    tier.to_m2, tier.price_per_m2, tier.is_anchor, tier.markup_pct,
    tier.sort_order
  FROM jsonb_to_recordset(_payload -> 'variant_price_tiers') AS tier(
    id uuid, variant_id uuid, from_m2 numeric, to_m2 numeric,
    price_per_m2 numeric, is_anchor boolean, markup_pct numeric,
    sort_order integer
  );

  INSERT INTO public.storformat_product_m2_prices (
    id, tenant_id, product_id, storformat_product_id, from_m2, to_m2,
    price_per_m2, is_anchor
  )
  SELECT
    tier.id, _tenant_id, target_product_id, tier.variant_id, tier.from_m2,
    tier.to_m2, tier.price_per_m2, tier.is_anchor
  FROM jsonb_to_recordset(_payload -> 'variant_m2_prices') AS tier(
    id uuid, variant_id uuid, from_m2 numeric, to_m2 numeric,
    price_per_m2 numeric, is_anchor boolean
  );

  INSERT INTO public.storformat_configs (
    tenant_id,
    product_id,
    pricing_mode,
    rounding_step,
    rounding_mode,
    global_markup_pct,
    quantities,
    layout_rows,
    vertical_axis,
    is_published
  ) VALUES (
    _tenant_id,
    target_product_id,
    'm2_rates',
    config_input.rounding_step,
    config_input.rounding_mode,
    0,
    config_input.quantities,
    config_input.layout_rows,
    config_input.vertical_axis,
    false
  )
  ON CONFLICT (product_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      pricing_mode = EXCLUDED.pricing_mode,
      rounding_step = EXCLUDED.rounding_step,
      rounding_mode = EXCLUDED.rounding_mode,
      global_markup_pct = EXCLUDED.global_markup_pct,
      quantities = EXCLUDED.quantities,
      layout_rows = EXCLUDED.layout_rows,
      vertical_axis = EXCLUDED.vertical_axis;

  INSERT INTO public.wmd_snapshot_draft_import_state (
    tenant_id,
    product_id,
    revision,
    mode,
    expected_revision,
    import_id,
    payload_digest,
    payload_fingerprint
  ) VALUES (
    _tenant_id,
    target_product_id,
    next_revision,
    target_input.mode,
    target_input.expected_revision,
    target_input.import_id,
    target_input.payload_digest,
    authoritative_payload_fingerprint
  );

  RETURN target_product_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb)
IS 'Service-role-only atomic replacement of an unpublished WMD roll-label snapshot draft.';

CREATE FUNCTION public.get_wmd_snapshot_draft_revision(
  _tenant_id uuid,
  _product_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $revision$
  SELECT max(import_state.revision)
  FROM public.wmd_snapshot_draft_import_state AS import_state
  WHERE import_state.tenant_id = _tenant_id
    AND import_state.product_id = _product_id
    AND public.can_access_tenant(_tenant_id);
$revision$;

-- data-api: authenticated tenant editors may read only the current revision;
-- the private import ledger remains inaccessible.
REVOKE ALL ON FUNCTION public.get_wmd_snapshot_draft_revision(uuid, uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_wmd_snapshot_draft_revision(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.get_wmd_snapshot_draft_revision(uuid, uuid)
IS 'Returns the authorized tenant product WMD snapshot revision, or null when unmanaged or inaccessible.';

-- WMD snapshot drafts have one writer: the service-only atomic import RPC.
-- Existing authenticated editor policies remain in force for every unmanaged
-- storformat product, while these restrictive policies fence all direct
-- editor mutations for managed products without hiding their readable rows.
DO $wmd_editor_fence$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'storformat_configs',
    'storformat_materials',
    'storformat_material_price_tiers',
    'storformat_m2_prices',
    'storformat_products',
    'storformat_product_price_tiers',
    'storformat_product_m2_prices',
    'storformat_finishes',
    'storformat_finish_price_tiers',
    'storformat_finish_prices',
    'storformat_product_fixed_prices'
  ]
  LOOP
    EXECUTE pg_catalog.format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.get_wmd_snapshot_draft_revision(tenant_id, product_id) IS NULL)',
      'wmd_guard_' || table_name || '_ins',
      table_name
    );
    EXECUTE pg_catalog.format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.get_wmd_snapshot_draft_revision(tenant_id, product_id) IS NULL) WITH CHECK (public.get_wmd_snapshot_draft_revision(tenant_id, product_id) IS NULL)',
      'wmd_guard_' || table_name || '_upd',
      table_name
    );
    EXECUTE pg_catalog.format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.get_wmd_snapshot_draft_revision(tenant_id, product_id) IS NULL)',
      'wmd_guard_' || table_name || '_del',
      table_name
    );
  END LOOP;
END;
$wmd_editor_fence$;
