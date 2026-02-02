-- Insert standard materials into designer_templates
-- These are used in the Design Library -> Materialer section

INSERT INTO designer_templates (name, category, template_type, width_mm, height_mm, is_active, is_public, description)
VALUES
  -- Standard Papir
  ('90g Mat Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Standard mat papir finish'),
  ('90g Gloss Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Standard blank papir finish'),
  ('135g Matsilk Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Medium tykkelse matsilk'),
  ('135g Gloss Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Medium tykkelse gloss'),
  ('170g Matsilk Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Kraftigt papir, matsilk overflade'),
  ('170g Gloss Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Kraftigt papir, gloss overflade'),
  ('250g Matsilk Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Meget kraftigt papir, velegnet til kort'),
  ('250g Gloss Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Meget kraftigt papir, velegnet til kort'),
  ('350g Matsilk Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Premium tykt papir, visitkort kvalitet'),
  ('350g Gloss Papir', 'Standard Papir', 'material', 0, 0, true, true, 'Premium tykt papir, visitkort kvalitet'),

  -- Genbrugspapir
  ('80g Genbrugspapir', 'Genbrugspapir', 'material', 0, 0, true, true, 'Let genbrugspapir'),
  ('135g Genbrugspapir', 'Genbrugspapir', 'material', 0, 0, true, true, 'Medium genbrugspapir'),
  ('170g Genbrugspapir', 'Genbrugspapir', 'material', 0, 0, true, true, 'Kraftigt genbrugspapir'),
  ('300g Genbrugspapir', 'Genbrugspapir', 'material', 0, 0, true, true, 'Ekstra kraftigt genbrugspapir');
