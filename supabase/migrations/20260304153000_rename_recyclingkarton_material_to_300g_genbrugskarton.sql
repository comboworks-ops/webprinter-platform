-- Rename a specific material label across live products.
--
-- Why:
-- The supplier-facing label "0,36 mm starker Recyclingkarton 300g weiß"
-- should display as "300g Genbrugskarton" wherever it appears in product data.
--
-- Rollback note:
-- Replace "300g Genbrugskarton" back to the original label in
-- product_attribute_values.name.

UPDATE public.product_attribute_values
SET name = '300g Genbrugskarton'
WHERE name = '0,36 mm starker Recyclingkarton 300g weiß';
