-- Rename a specific material label across copied/live products.
--
-- Why:
-- The supplier-facing label "0,36 mm starker Bilderdruckkarton 350g matt für 5mm"
-- should display as "350g Matsilk papir" wherever it appears in product data.
--
-- Rollback note:
-- Replace "350g Matsilk papir" back to the original label in
-- product_attribute_values.name and price_list_templates.spec.

UPDATE public.product_attribute_values
SET name = '350g Matsilk papir'
WHERE name = '0,36 mm starker Bilderdruckkarton 350g matt für 5mm';

UPDATE public.price_list_templates
SET spec = replace(
    spec::text,
    '0,36 mm starker Bilderdruckkarton 350g matt für 5mm',
    '350g Matsilk papir'
)::jsonb
WHERE spec::text LIKE '%0,36 mm starker Bilderdruckkarton 350g matt für 5mm%';
