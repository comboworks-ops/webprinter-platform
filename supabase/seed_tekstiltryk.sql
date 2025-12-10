-- Seed prices for Tekstiltryk
DO $$
DECLARE
  p_id uuid;
BEGIN
  -- Get the product ID for 'tekstiltryk'
  SELECT id INTO p_id FROM products WHERE slug = 'tekstiltryk';

  IF p_id IS NULL THEN
    RAISE NOTICE 'Product tekstiltryk not found. Skipping seed.';
    RETURN;
  END IF;

  -- Delete existing prices for this product to avoid duplicates during re-seed
  DELETE FROM generic_product_prices WHERE product_id = p_id;

  -- Insert new prices
  INSERT INTO generic_product_prices (product_id, variant_name, variant_value, quantity, price_dkk)
  VALUES
    (p_id, 'Model', 'T-Shirt Basic', 10, 450),
    (p_id, 'Model', 'T-Shirt Basic', 25, 1125),
    (p_id, 'Model', 'T-Shirt Basic', 50, 2050),
    (p_id, 'Model', 'T-Shirt Basic', 100, 3600),
    (p_id, 'Model', 'T-Shirt Basic', 200, 7200),
    (p_id, 'Model', 'T-Shirt Premium', 10, 650),
    (p_id, 'Model', 'T-Shirt Premium', 25, 1625),
    (p_id, 'Model', 'T-Shirt Premium', 50, 2950),
    (p_id, 'Model', 'T-Shirt Premium', 100, 5200),
    (p_id, 'Model', 'T-Shirt Premium', 200, 10400),
    (p_id, 'Model', 'Polo Shirt', 10, 850),
    (p_id, 'Model', 'Polo Shirt', 25, 2125),
    (p_id, 'Model', 'Polo Shirt', 50, 3850),
    (p_id, 'Model', 'Polo Shirt', 100, 6800),
    (p_id, 'Model', 'Polo Shirt', 200, 13600),
    (p_id, 'Model', 'Hættetrøje', 10, 1250),
    (p_id, 'Model', 'Hættetrøje', 25, 3125),
    (p_id, 'Model', 'Hættetrøje', 50, 5650),
    (p_id, 'Model', 'Hættetrøje', 100, 10000),
    (p_id, 'Model', 'Hættetrøje', 200, 20000);
END $$;
