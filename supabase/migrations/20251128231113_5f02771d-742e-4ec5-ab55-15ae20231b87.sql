-- Create tiered pricing table for banners with discount support
CREATE TABLE IF NOT EXISTS public.banner_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material text NOT NULL,
  from_sqm numeric NOT NULL DEFAULT 0,
  to_sqm numeric NOT NULL,
  price_per_sqm numeric NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT banner_prices_valid_range CHECK (to_sqm > from_sqm),
  CONSTRAINT banner_prices_valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Create tiered pricing table for signs with discount support
CREATE TABLE IF NOT EXISTS public.sign_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material text NOT NULL,
  from_sqm numeric NOT NULL DEFAULT 0,
  to_sqm numeric NOT NULL,
  price_per_sqm numeric NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT sign_prices_valid_range CHECK (to_sqm > from_sqm),
  CONSTRAINT sign_prices_valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Create tiered pricing table for foil with discount support
CREATE TABLE IF NOT EXISTS public.foil_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material text NOT NULL,
  from_sqm numeric NOT NULL DEFAULT 0,
  to_sqm numeric NOT NULL,
  price_per_sqm numeric NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT foil_prices_valid_range CHECK (to_sqm > from_sqm),
  CONSTRAINT foil_prices_valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
);

-- Enable Row Level Security
ALTER TABLE public.banner_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sign_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foil_prices ENABLE ROW LEVEL SECURITY;

-- Create policies for banner_prices
CREATE POLICY "Anyone can view banner prices"
  ON public.banner_prices FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage banner prices"
  ON public.banner_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for sign_prices
CREATE POLICY "Anyone can view sign prices"
  ON public.sign_prices FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage sign prices"
  ON public.sign_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for foil_prices
CREATE POLICY "Anyone can view foil prices"
  ON public.foil_prices FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage foil prices"
  ON public.foil_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));