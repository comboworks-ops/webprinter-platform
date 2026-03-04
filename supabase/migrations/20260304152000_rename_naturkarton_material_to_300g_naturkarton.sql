-- Rename a specific material label across live products.
--
-- Why:
-- The supplier-facing label "0,36 mm starker Naturkarton 300g hochweiß für 5mm"
-- should display as "300g Naturkarton" wherever it appears in product data.
--
-- Rollback note:
-- Replace "300g Naturkarton" back to the original label in
-- product_attribute_values.name.

UPDATE public.product_attribute_values
SET name = '300g Naturkarton'
WHERE name = '0,36 mm starker Naturkarton 300g hochweiß für 5mm';
