-- Opt-in Pixart piece-area/count quote pricing. Existing products retain total-area pricing.
-- Additive only: no prices, selections, tenant ownership, RLS policies or grants are changed.
ALTER TABLE public.storformat_configs
  ADD COLUMN IF NOT EXISTS area_pricing_basis text NOT NULL DEFAULT 'total_area',
  ADD COLUMN IF NOT EXISTS source_quote_model jsonb;

ALTER TABLE public.storformat_configs
  ADD CONSTRAINT storformat_configs_source_quote_model_pair_check CHECK (
    (
      (area_pricing_basis = 'total_area' AND source_quote_model IS NULL)
      OR
      (
        area_pricing_basis = 'per_piece_quotes'
        AND jsonb_typeof(source_quote_model) = 'object'
        AND source_quote_model -> 'version' = '1'::jsonb
        AND source_quote_model ->> 'currency' = 'DKK'
        AND source_quote_model ->> 'price_basis' = 'regular'
        AND jsonb_typeof(source_quote_model -> 'base_product_ids') = 'array'
        AND CASE WHEN jsonb_typeof(source_quote_model -> 'combinations') = 'array'
          THEN jsonb_array_length(source_quote_model -> 'combinations') > 0 ELSE false END
      )
    ) IS TRUE
  );

COMMENT ON COLUMN public.storformat_configs.area_pricing_basis IS
  'total_area retains existing m2 tiers. per_piece_quotes uses exact quantity and interpolated piece-area retail order quotes.';
COMMENT ON COLUMN public.storformat_configs.source_quote_model IS
  'Versioned public DKK regular retail order totals only. Never include supplier costs, credentials or local extraction paths. Runtime/import validation checks all points and option combinations.';

-- No new Data API object is created; existing storformat_configs grants and tenant RLS remain unchanged.
-- Rollback: first restore reviewed legacy pricing for any opted-in product and set
-- (area_pricing_basis, source_quote_model) = ('total_area', NULL) together.
-- After all clients/functions are reverted, the constraint and these two columns can be removed.
-- Do not revert the checkout function independently of its matched frontend release packet.
