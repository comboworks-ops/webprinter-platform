\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public.test_wmd_payload(
  _product_name text,
  _material_name text,
  _mode text DEFAULT 'create',
  _product_id uuid DEFAULT NULL,
  _expected_revision bigint DEFAULT 0,
  _import_id uuid DEFAULT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  _payload_digest text DEFAULT repeat('b', 64)
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $test_payload$
  SELECT jsonb_build_object(
    'target', jsonb_build_object(
      'mode', _mode,
      'product_id', _product_id,
      'expected_revision', _expected_revision,
      'import_id', _import_id,
      'payload_digest', _payload_digest
    ),
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
      'rounding_mode', 'ceil_v1',
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

CREATE OR REPLACE FUNCTION public.test_wmd_replace_payload(
  _product_name text,
  _material_name text,
  _import_id uuid,
  _payload_digest text,
  _expected_revision bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $test_replace_payload$
  SELECT public.test_wmd_payload(
    _product_name,
    _material_name,
    'replace',
    import_state.product_id,
    COALESCE(_expected_revision, import_state.revision),
    _import_id,
    _payload_digest
  )
  FROM public.wmd_snapshot_draft_import_state AS import_state
  JOIN public.products
    ON products.id = import_state.product_id
   AND products.tenant_id = import_state.tenant_id
  WHERE import_state.tenant_id = '00000000-0000-4000-8000-000000000001'
    AND products.slug = 'wmd-roll-labels-test'
  ORDER BY import_state.revision DESC
  LIMIT 1;
$test_replace_payload$;

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
SELECT public.test_assert(
  NOT has_table_privilege('service_role', 'public.wmd_snapshot_draft_import_state', 'INSERT')
  AND NOT has_table_privilege('service_role', 'public.wmd_snapshot_draft_import_state', 'UPDATE')
  AND NOT has_table_privilege('service_role', 'public.wmd_snapshot_draft_import_state', 'DELETE'),
  'service_role must not mutate snapshot revision state directly'
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

DO $reject_zero_tiers$
DECLARE
  price_path text[];
BEGIN
  FOR price_path IN
    SELECT candidate.path
    FROM (
      VALUES
        (ARRAY['material_price_tiers', '0', 'price_per_m2']::text[]),
        (ARRAY['material_m2_prices', '0', 'price_per_m2']::text[]),
        (ARRAY['variant_price_tiers', '0', 'price_per_m2']::text[]),
        (ARRAY['variant_m2_prices', '0', 'price_per_m2']::text[])
    ) AS candidate(path)
  LOOP
    BEGIN
      PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
        '00000000-0000-4000-8000-000000000001',
        jsonb_set(
          public.test_wmd_payload('Zero price must fail', 'Zero price must fail'),
          price_path,
          '0'::jsonb
        )
      );
      RAISE EXCEPTION 'zero snapshot tier unexpectedly succeeded at %', price_path;
    EXCEPTION WHEN SQLSTATE '22023' THEN
      NULL;
    END;
  END LOOP;
END;
$reject_zero_tiers$;

DO $reject_noncanonical_tiers$
DECLARE
  price_path text[];
  invalid_price jsonb;
BEGIN
  FOR price_path IN
    SELECT candidate.path
    FROM (
      VALUES
        (ARRAY['material_price_tiers', '0', 'price_per_m2']::text[]),
        (ARRAY['material_m2_prices', '0', 'price_per_m2']::text[]),
        (ARRAY['variant_price_tiers', '0', 'price_per_m2']::text[]),
        (ARRAY['variant_m2_prices', '0', 'price_per_m2']::text[])
    ) AS candidate(path)
  LOOP
    FOR invalid_price IN
      SELECT candidate.value
      FROM (
        VALUES
          (to_jsonb('NaN'::text)),
          (to_jsonb('Infinity'::text)),
          (to_jsonb('NaN'::numeric)),
          (to_jsonb('Infinity'::numeric)),
          (to_jsonb('-Infinity'::numeric)),
          (to_jsonb('12.34'::text)),
          (to_jsonb(1000000000.1::numeric)),
          (to_jsonb(0.1234567890123456789012345::numeric))
      ) AS candidate(value)
    LOOP
      BEGIN
        PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
          '00000000-0000-4000-8000-000000000001',
          jsonb_set(
            public.test_wmd_payload(
              'Noncanonical price must fail',
              'Noncanonical price must fail'
            ),
            price_path,
            invalid_price
          )
        );
        RAISE EXCEPTION 'noncanonical snapshot tier unexpectedly succeeded at % with %',
          price_path,
          invalid_price;
      EXCEPTION WHEN SQLSTATE '22023' THEN
        NULL;
      END;
    END LOOP;
  END LOOP;
END;
$reject_noncanonical_tiers$;

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
SELECT public.test_assert(
  (SELECT max(revision) = 1 FROM public.wmd_snapshot_draft_import_state),
  'a new snapshot target must start at revision one'
);
SELECT public.test_assert(
  (SELECT rounding_mode = 'ceil_v1' FROM public.storformat_configs),
  'snapshot rounding mode must be persisted with its step'
);

INSERT INTO public.products (
  id, tenant_id, name, slug, icon_text, description, category,
  pricing_type, is_published, preset_key, technical_specs
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  '00000000-0000-4000-8000-000000000001',
  'Manual storformat product',
  'manual-storformat-test',
  'Manual',
  'Non-WMD editor control',
  'storformat',
  'STORFORMAT',
  false,
  'custom',
  '{}'::jsonb
);

SET ROLE authenticated;
SELECT public.test_assert(
  public.get_wmd_snapshot_draft_revision(
    '00000000-0000-4000-8000-000000000001',
    (SELECT id FROM public.products WHERE slug = 'wmd-roll-labels-test')
  ) = 1,
  'authorized editor reads the authoritative WMD revision'
);
DO $managed_editor_denied$
BEGIN
  INSERT INTO public.storformat_configs (
    tenant_id, product_id, rounding_step, global_markup_pct, quantities
  )
  SELECT tenant_id, id, 99, 0, ARRAY[1]
  FROM public.products
  WHERE slug = 'wmd-roll-labels-test'
  ON CONFLICT (product_id) DO UPDATE
  SET rounding_step = excluded.rounding_step;
  RAISE EXCEPTION 'managed WMD editor upsert unexpectedly succeeded';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END;
$managed_editor_denied$;

INSERT INTO public.storformat_configs (
  tenant_id, product_id, rounding_step, global_markup_pct, quantities
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  '33333333-3333-4333-8333-333333333333',
  5,
  0,
  ARRAY[1]
);
RESET ROLE;

SELECT public.test_assert(
  (
    SELECT rounding_step = 1
    FROM public.storformat_configs
    WHERE product_id = (
      SELECT id FROM public.products WHERE slug = 'wmd-roll-labels-test'
    )
  ),
  'managed editor rejection must leave snapshot config unchanged'
);
SELECT public.test_assert(
  (
    SELECT rounding_step = 5
    FROM public.storformat_configs
    WHERE product_id = '33333333-3333-4333-8333-333333333333'
  ),
  'non-WMD products must remain editable through existing tenant RLS'
);
DELETE FROM public.storformat_configs
WHERE product_id = '33333333-3333-4333-8333-333333333333';
DELETE FROM public.products
WHERE id = '33333333-3333-4333-8333-333333333333';

UPDATE public.products
SET technical_specs = technical_specs || jsonb_build_object(
  'wmd_import_revision', 999,
  'wmd_import_id', 'ffffffff-ffff-4fff-8fff-ffffffffffff'
)
WHERE slug = 'wmd-roll-labels-test';

DO $technical_specs_not_authority$
BEGIN
  PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
    '00000000-0000-4000-8000-000000000001',
    public.test_wmd_replace_payload(
      'Must reject fake revision',
      'Must reject fake revision',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      repeat('c', 64),
      999
    )
  );
  RAISE EXCEPTION 'technical_specs unexpectedly controlled the revision';
EXCEPTION WHEN SQLSTATE '40001' THEN
  NULL;
END;
$technical_specs_not_authority$;

SET ROLE service_role;
SELECT public.apply_wmd_roll_label_snapshot_draft_import(
  '00000000-0000-4000-8000-000000000001',
  public.test_wmd_replace_payload(
    'Revision two snapshot',
    'Revision two material',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    repeat('d', 64)
  )
);
-- Exact replay is a no-op and must not advance the private revision state.
SELECT public.apply_wmd_roll_label_snapshot_draft_import(
  '00000000-0000-4000-8000-000000000001',
  public.test_wmd_replace_payload(
    'Revision two snapshot',
    'Revision two material',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    repeat('d', 64),
    1
  )
);
RESET ROLE;

SELECT public.test_assert(
  (
    SELECT max(revision) = 2 AND count(*) = 2
    FROM public.wmd_snapshot_draft_import_state
  ),
  'successful replacement advances revision exactly once despite replay'
);
SELECT public.test_assert(
  (SELECT name = 'Revision two snapshot' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'the exact product target must be replaced'
);

DO $import_id_digest_mismatch$
BEGIN
  PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
    '00000000-0000-4000-8000-000000000001',
    public.test_wmd_replace_payload(
      'Must reject changed replay',
      'Must reject changed replay',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      repeat('e', 64)
    )
  );
  RAISE EXCEPTION 'changed import replay unexpectedly succeeded';
EXCEPTION WHEN SQLSTATE '22023' THEN
  NULL;
END;
$import_id_digest_mismatch$;

DO $import_id_mutated_body_same_claimed_digest$
BEGIN
  PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
    '00000000-0000-4000-8000-000000000001',
    public.test_wmd_replace_payload(
      'Must reject mutated body with reused claim',
      'Must reject mutated body with reused claim',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      repeat('d', 64),
      1
    )
  );
  RAISE EXCEPTION 'mutated body with reused claimed digest unexpectedly replayed';
EXCEPTION WHEN SQLSTATE '22023' THEN
  NULL;
END;
$import_id_mutated_body_same_claimed_digest$;

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
  (SELECT name = 'Revision two snapshot' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'invalid payloads must not mutate the product'
);

UPDATE public.products
SET is_published = true
WHERE slug = 'wmd-roll-labels-test';

DO $published_product$
BEGIN
  PERFORM public.apply_wmd_roll_label_snapshot_draft_import(
    '00000000-0000-4000-8000-000000000001',
    public.test_wmd_replace_payload(
      'Must not replace live',
      'Must not replace live',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
      repeat('f', 64)
    )
  );
  RAISE EXCEPTION 'published product import unexpectedly succeeded';
EXCEPTION WHEN SQLSTATE '55000' THEN
  NULL;
END;
$published_product$;

SELECT public.test_assert(
  (SELECT name = 'Revision two snapshot' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'published product must not be mutated'
);
SELECT public.test_assert(
  (SELECT name = 'Revision two material' FROM public.storformat_materials),
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
    public.test_wmd_replace_payload(
      'Must not unpublish config',
      'Must not replace config',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
      repeat('1', 64)
    )
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
    'Must roll back',
    'replace',
    (SELECT product_id
     FROM public.wmd_snapshot_draft_import_state
     ORDER BY revision DESC
     LIMIT 1),
    2,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',
    repeat('2', 64)
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
  (SELECT name = 'Revision two snapshot' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'failed replacement must roll the product update back'
);
SELECT public.test_assert(
  (SELECT name = 'Revision two material' FROM public.storformat_materials),
  'failed replacement must roll destructive deletes back'
);

SELECT 'wmd snapshot draft PG17 transaction checks passed' AS result;
