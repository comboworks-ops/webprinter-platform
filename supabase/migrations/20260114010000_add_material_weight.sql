-- Add weight_gsm column for materials
-- GSM = grams per square meter, used for calculating paper weight

ALTER TABLE designer_templates 
ADD COLUMN IF NOT EXISTS weight_gsm NUMERIC DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN designer_templates.weight_gsm IS 'Paper weight in grams per square meter (GSM). Used for materials to calculate total product weight.';
