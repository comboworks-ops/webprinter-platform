-- Add tooltip columns to products table
ALTER TABLE public.products 
ADD COLUMN tooltip_product text,
ADD COLUMN tooltip_price text,
ADD COLUMN tooltip_quick_tilbud text;