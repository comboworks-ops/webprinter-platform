-- Add ISO Standard Formats if they don't exist
INSERT INTO designer_templates (name, width_mm, height_mm, category, is_active, template_type, is_public, description, icon_name)
SELECT 
    t.name, 
    t.width_mm, 
    t.height_mm, 
    t.category, 
    true, 
    'format', 
    true, 
    t.name || ' Format',
    'FileText'
FROM (VALUES
    ('A0', 841, 1189, 'ISO Standard'),
    ('A1', 594, 841, 'ISO Standard'),
    ('A2', 420, 594, 'ISO Standard'),
    ('A3', 297, 420, 'ISO Standard'),
    ('A4', 210, 297, 'ISO Standard'),
    ('A5', 148, 210, 'ISO Standard'),
    ('A6', 105, 148, 'ISO Standard'),
    ('A7', 74, 105, 'ISO Standard'),
    ('A8', 52, 74, 'ISO Standard'),
    ('B0', 1000, 1414, 'ISO Standard'),
    ('B1', 707, 1000, 'ISO Standard'),
    ('B2', 500, 707, 'ISO Standard'),
    ('C4', 229, 324, 'ISO Standard'),
    ('C5', 162, 229, 'ISO Standard'),
    ('C6', 114, 162, 'ISO Standard'),
    ('C7', 81, 114, 'ISO Standard')
) AS t (name, width_mm, height_mm, category)
WHERE NOT EXISTS (
    SELECT 1 FROM designer_templates dt 
    WHERE dt.name = t.name AND dt.category = t.category
);
