-- Rename a specific material label across copied/live products.
--
-- Why:
-- The supplier-facing label "0,40 mm starker Chromokarton 255g für 5mm"
-- should display as "Chromo mappekarton" wherever it appears in product data.
--
-- Rollback note:
-- Replace "Chromo mappekarton" back to the original label in
-- product_attribute_values.name and price_list_templates.spec.

UPDATE public.product_attribute_values
SET name = 'Chromo mappekarton'
WHERE name = '0,40 mm starker Chromokarton 255g für 5mm';

UPDATE public.price_list_templates
SET spec = replace(
    spec::text,
    '0,40 mm starker Chromokarton 255g für 5mm',
    'Chromo mappekarton'
)::jsonb
WHERE spec::text LIKE '%0,40 mm starker Chromokarton 255g für 5mm%';
