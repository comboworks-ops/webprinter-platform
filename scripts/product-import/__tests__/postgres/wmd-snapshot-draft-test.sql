\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public.test_wmd_payload(
  _product_name text,
  _material_name text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $test_payload$
  SELECT jsonb_build_object(
    'product', jsonb_build_object(
      'name', _product_name,
      'slug', 'wmd-roll-labels-test',
      'icon_text', _product_name,
      'description', 'Atomic WMD snapshot test',
      'category', 'storformat',
      'pricing_type', 'STORFORMAT',
      'preset_key', 'custom',
      'technical_specs', jsonb_build_object(
        'source', 'wmd',
        'import_type', 'fetch2-roll-labels',
        'import_script', 'fetch2-wmd-roll-labels.mjs',
        'delivery_mode', 'both',
        'net_price_source', 'response.price',
        'fx_snapshot_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'fx_provider', 'frankfurter_ecb',
        'fx_rate', 7.460123,
        'fx_rate_date', '2026-07-31',
        'fx_fetched_at', '2026-08-01T08:00:00.000Z',
        'fx_source_payload_sha256', repeat('a', 64),
        'pricing_buffer_pct', 2.5,
        'markup_low_pct', 70,
        'markup_high_pct', 60,
        'threshold_dkk', 3000,
        'max_size_cm', 20
      )
    ),
    'materials', jsonb_build_array(jsonb_build_object(
      'id', '11111111-1111-4111-8111-111111111111',
      'name', _material_name,
      'group_label', 'Material',
      'bleed_mm', 3,
      'safe_area_mm', 3,
      'max_width_mm', 200,
      'max_height_mm', 200,
      'allow_split', false,
      'interpolation_enabled', true,
      'markup_pct', 0,
      'sort_order', 0
    )),
    'material_price_tiers', jsonb_build_array(jsonb_build_object(
      'id', '11111111-1111-4111-8111-111111111112',
      'material_id', '11111111-1111-4111-8111-111111111111',
      'from_m2', 0.01,
      'to_m2', 1,
      'price_per_m2', 1515.09,
      'is_anchor', true,
      'markup_pct', 0,
      'sort_order', 0
    )),
    'material_m2_prices', jsonb_build_array(jsonb_build_object(
      'id', '11111111-1111-4111-8111-111111111113',
      'material_id', '11111111-1111-4111-8111-111111111111',
      'from_m2', 0.01,
      'to_m2', 1,
      'price_per_m2', 1515.09,
      'is_anchor', true
    )),
    'variants', jsonb_build_array(jsonb_build_object(
      'id', '22222222-2222-4222-8222-222222222221',
      'name', 'Fast production',
      'group_label', 'Delivery',
      'pricing_mode', 'per_m2',
      'initial_price', 0,
      'interpolation_enabled', true,
      'markup_pct', 0,
      'sort_order', 0,
      'pricing_type', 'm2',
      'percentage_markup', 0,
      'min_price', 0
    )),
    'variant_price_tiers', jsonb_build_array(jsonb_build_object(
      'id', '22222222-2222-4222-8222-222222222222',
      'variant_id', '22222222-2222-4222-8222-222222222221',
      'from_m2', 0.01,
      'to_m2', 1,
      'price_per_m2', 50.25,
      'is_anchor', true,
      'markup_pct', 0,
      'sort_order', 0
    )),
    'variant_m2_prices', jsonb_build_array(jsonb_build_object(
      'id', '22222222-2222-4222-8222-222222222223',
      'variant_id', '22222222-2222-4222-8222-222222222221',
      'from_m2', 0.01,
      'to_m2', 1,
      'price_per_m2', 50.25,
      'is_anchor', true
    )),
    'config', jsonb_build_object(
      'rounding_step', 1,
      'quantities', jsonb_build_array(100, 500),
      'layout_rows', jsonb_build_array(),
      'vertical_axis', jsonb_build_object(
        'id', 'vertical-axis',
        'sectionType', 'materials',
        'valueIds', jsonb_build_array('11111111-1111-4111-8111-111111111111'),
        'valueSettings', jsonb_build_object()
      )
    )
  );
$test_payload$;

CREATE OR REPLACE FUNCTION public.test_assert(_condition boolean, _message text)
RETURNS void
LANGUAGE plpgsql
AS $test_assert$
BEGIN
  IF NOT COALESCE(_condition, false) THEN
    RAISE EXCEPTION 'assertion failed: %', _message;
  END IF;
END;
$test_assert$;

INSERT INTO public.tenants (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', 'PG17 test tenant');

SELECT public.test_assert(
  NOT has_function_privilege(
    'anon',
    'public.apply_wmd_roll_label_snapshot_draft_import(uuid,jsonb)',
    'EXECUTE'
  ),
  'anon must not execute the import RPC'
);
SELECT public.test_assert(
  NOT has_function_privilege(
    'authenticated',
    'public.apply_wmd_roll_label_snapshot_draft_import(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated must not execute the import RPC'
);
SELECT public.test_assert(
  has_function_privilege(
    'service_role',
    'public.apply_wmd_roll_label_snapshot_draft_import(uuid,jsonb)',
    'EXECUTE'
  ),
  'service_role must execute the import RPC'
);

SET ROLE anon;
DO $anon_denied$
BEGIN
  PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
    '00000000-0000-4000-8000-000000000001',
    public.test_wmd_payload('Anon must fail', 'Anon must fail')
  );
  RAISE EXCEPTION 'anon import unexpectedly succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END;
$anon_denied$;
RESET ROLE;

SET ROLE service_role;
SELECT public.apply_wmd_roll_label_snapshot_draft_import(
  '00000000-0000-4000-8000-000000000001',
  public.test_wmd_payload('Initial snapshot', 'Initial material')
);
RESET ROLE;

SELECT public.test_assert(
  (SELECT NOT is_published FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'new snapshot product must remain a draft'
);
SELECT public.test_assert(
  (SELECT NOT is_published FROM public.storformat_configs),
  'new snapshot config must remain a draft'
);
SELECT public.test_assert(
  (SELECT count(*) = 1 FROM public.storformat_materials),
  'material replacement must be complete'
);
SELECT public.test_assert(
  (SELECT price_per_m2 = 1515.09 FROM public.storformat_material_price_tiers),
  'decimal final price must be stored exactly'
);
SELECT public.test_assert(
  (SELECT count(*) = 1 FROM public.storformat_product_m2_prices),
  'variant m2 pricing must be inserted'
);

DO $published_key_denied$
DECLARE
  bad_payload jsonb := public.test_wmd_payload(
    'Must reject publication key',
    'Must reject publication key'
  );
BEGIN
  bad_payload := jsonb_set(
    bad_payload,
    '{product,is_published}',
    'true'::jsonb
  );
  BEGIN
    PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
      '00000000-0000-4000-8000-000000000001',
      bad_payload
    );
    RAISE EXCEPTION 'publication key unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END;
$published_key_denied$;

DO $overprecision_denied$
DECLARE
  bad_payload jsonb := public.test_wmd_payload(
    'Must reject overprecision',
    'Must reject overprecision'
  );
BEGIN
  bad_payload := jsonb_set(
    bad_payload,
    '{product,technical_specs,fx_rate}',
    '7.4601234'::jsonb
  );
  BEGIN
    PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
      '00000000-0000-4000-8000-000000000001',
      bad_payload
    );
    RAISE EXCEPTION 'overprecision rate unexpectedly succeeded';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;
END;
$overprecision_denied$;

SELECT public.test_assert(
  (SELECT name = 'Initial snapshot' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'invalid payloads must not mutate the product'
);

UPDATE public.products
SET is_published = true
WHERE slug = 'wmd-roll-labels-test';

DO $published_product$
BEGIN
  PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
    '00000000-0000-4000-8000-000000000001',
    public.test_wmd_payload('Must not replace live', 'Must not replace live')
  );
  RAISE EXCEPTION 'published product import unexpectedly succeeded';
EXCEPTION WHEN SQLSTATE '55000' THEN
  NULL;
END;
$published_product$;

SELECT public.test_assert(
  (SELECT name = 'Initial snapshot' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'published product must not be mutated'
);
SELECT public.test_assert(
  (SELECT name = 'Initial material' FROM public.storformat_materials),
  'published product pricing must not be mutated'
);

UPDATE public.products
SET is_published = false
WHERE slug = 'wmd-roll-labels-test';
UPDATE public.storformat_configs SET is_published = true;

DO $published_config$
BEGIN
  PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
    '00000000-0000-4000-8000-000000000001',
    public.test_wmd_payload('Must not unpublish config', 'Must not replace config')
  );
  RAISE EXCEPTION 'published config import unexpectedly succeeded';
EXCEPTION WHEN SQLSTATE '55000' THEN
  NULL;
END;
$published_config$;

SELECT public.test_assert(
  (SELECT is_published FROM public.storformat_configs),
  'published config must not be unpublished'
);
UPDATE public.storformat_configs SET is_published = false;

DO $rollback$
DECLARE
  bad_payload jsonb := public.test_wmd_payload(
    'Must roll back',
    'Must roll back'
  );
BEGIN
  bad_payload := jsonb_set(
    bad_payload,
    '{materials}',
    (bad_payload -> 'materials') || jsonb_build_array(bad_payload -> 'materials' -> 0)
  );
  BEGIN
    PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
      '00000000-0000-4000-8000-000000000001',
      bad_payload
    );
    RAISE EXCEPTION 'invalid replacement unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END;
$rollback$;

SELECT public.test_assert(
  (SELECT name = 'Initial snapshot' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'failed replacement must roll the product update back'
);
SELECT public.test_assert(
  (SELECT name = 'Initial material' FROM public.storformat_materials),
  'failed replacement must roll destructive deletes back'
);

SELECT 'wmd snapshot draft PG17 transaction checks passed' AS result;
