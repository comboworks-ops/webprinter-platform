-- Create enum for custom field types
CREATE TYPE public.custom_field_type AS ENUM ('number', 'boolean');

-- Create table for custom field definitions
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type custom_field_type NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  default_value jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT custom_fields_unique_per_product UNIQUE (product_id, field_name)
);

-- Create table for custom field values (polymorphic association)
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  custom_field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT custom_field_values_unique_per_record UNIQUE (custom_field_id, table_name, record_id)
);

-- Enable Row Level Security
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

-- Policies for custom_fields
CREATE POLICY "Anyone can view custom fields"
  ON public.custom_fields FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage custom fields"
  ON public.custom_fields FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policies for custom_field_values
CREATE POLICY "Anyone can view custom field values"
  ON public.custom_field_values FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage custom field values"
  ON public.custom_field_values FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_custom_fields_product_id ON public.custom_fields(product_id);
CREATE INDEX idx_custom_field_values_custom_field_id ON public.custom_field_values(custom_field_id);
CREATE INDEX idx_custom_field_values_record ON public.custom_field_values(table_name, record_id);