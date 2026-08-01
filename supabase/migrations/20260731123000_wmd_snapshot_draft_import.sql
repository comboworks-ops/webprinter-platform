-- Atomic, draft-only replacement for snapshot-priced WMD roll-label imports.
-- PostgreSQL rolls the complete function call back if any validation, delete,
-- insert, or constraint fails. The product row lock serializes publication
-- against the import so this function can never rewrite a live product.

CREATE FUNCTION public.apply_wmd_roll_label_snapshot_draft_import(
  _tenant_id uuid,
  _payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  target_product_id uuid;
  target_is_published boolean;
  target_config_is_published boolean;
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

  IF jsonb_typeof(_payload -> 'product') IS DISTINCT FROM 'object'
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
      'quantities',
      'layout_rows',
      'vertical_axis'
    ]::text[])
    OR EXISTS (
      SELECT 1
      FROM jsonb_object_keys(_payload -> 'config') AS config_key(key)
      WHERE config_key.key <> ALL (ARRAY[
        'rounding_step',
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
    quantities integer[],
    layout_rows jsonb,
    vertical_axis jsonb
  );

  IF config_input.rounding_step NOT BETWEEN 1 AND 1000
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
      OR tier.price_per_m2 < 0
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
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_payload -> 'material_m2_prices') AS tier(
      id uuid, material_id uuid, from_m2 numeric, to_m2 numeric,
      price_per_m2 numeric, is_anchor boolean
    )
    WHERE tier.id IS NULL OR tier.material_id IS NULL
      OR tier.from_m2 < 0
      OR (tier.to_m2 IS NOT NULL AND tier.to_m2 <= tier.from_m2)
      OR tier.price_per_m2 < 0
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
      OR tier.price_per_m2 < 0
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
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_payload -> 'variant_m2_prices') AS tier(
      id uuid, variant_id uuid, from_m2 numeric, to_m2 numeric,
      price_per_m2 numeric, is_anchor boolean
    )
    WHERE tier.id IS NULL OR tier.variant_id IS NULL
      OR tier.from_m2 < 0
      OR (tier.to_m2 IS NOT NULL AND tier.to_m2 <= tier.from_m2)
      OR tier.price_per_m2 < 0
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

  SELECT products.id, products.is_published
  INTO target_product_id, target_is_published
  FROM public.products
  WHERE products.tenant_id = _tenant_id
    AND products.slug = product_input.slug
  FOR UPDATE;

  IF FOUND THEN
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

    UPDATE public.products
    SET name = product_input.name,
        icon_text = product_input.icon_text,
        description = product_input.description,
        category = product_input.category,
        pricing_type = product_input.pricing_type,
        preset_key = product_input.preset_key,
        technical_specs = product_input.technical_specs
    WHERE id = target_product_id;
  ELSE
    target_product_id := gen_random_uuid();
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
      global_markup_pct = EXCLUDED.global_markup_pct,
      quantities = EXCLUDED.quantities,
      layout_rows = EXCLUDED.layout_rows,
      vertical_axis = EXCLUDED.vertical_axis;

  RETURN target_product_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb)
  TO service_role;

COMMENT ON FUNCTION public.apply_wmd_roll_label_snapshot_draft_import(uuid, jsonb)
IS 'Service-role-only atomic replacement of an unpublished WMD roll-label snapshot draft.';
