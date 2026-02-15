-- Add min_price column to storformat_materials table
ALTER TABLE storformat_materials
ADD COLUMN IF NOT EXISTS min_price numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN storformat_materials.min_price IS 'Minimum price for this material regardless of size - ensures profitability on small orders';
