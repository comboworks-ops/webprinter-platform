-- Create table for business card (visitkort) prices
CREATE TABLE IF NOT EXISTS public.visitkort_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_dkk NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  UNIQUE(paper, quantity)
);

-- Create table for poster (plakater) rates
CREATE TABLE IF NOT EXISTS public.poster_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper TEXT NOT NULL UNIQUE,
  price_per_sqm NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Create table for sticker (klistermærker) rates
CREATE TABLE IF NOT EXISTS public.sticker_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL UNIQUE,
  price_per_sqm NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Create table for sign (skilte) rates
CREATE TABLE IF NOT EXISTS public.sign_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL UNIQUE,
  price_per_sqm NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Create table for banner rates
CREATE TABLE IF NOT EXISTS public.banner_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material TEXT NOT NULL UNIQUE,
  price_per_sqm NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID
);

-- Create table for beach flag prices
CREATE TABLE IF NOT EXISTS public.beachflag_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  size TEXT NOT NULL,
  system TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  UNIQUE(size, system)
);

-- Create table for booklet (hæfter) configuration
CREATE TABLE IF NOT EXISTS public.booklet_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  paper TEXT NOT NULL,
  pages TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  UNIQUE(format, paper, pages)
);

-- Create table for sales folder (salgsmapper) configuration
CREATE TABLE IF NOT EXISTS public.salesfolder_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format TEXT NOT NULL,
  paper TEXT NOT NULL,
  side_type TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID,
  UNIQUE(format, paper, side_type)
);

-- Enable RLS on all tables
ALTER TABLE public.visitkort_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poster_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sign_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banner_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beachflag_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booklet_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesfolder_rates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public read access
CREATE POLICY "Anyone can view visitkort prices" ON public.visitkort_prices FOR SELECT USING (true);
CREATE POLICY "Anyone can view poster rates" ON public.poster_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view sticker rates" ON public.sticker_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view sign rates" ON public.sign_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view banner rates" ON public.banner_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view beachflag prices" ON public.beachflag_prices FOR SELECT USING (true);
CREATE POLICY "Anyone can view booklet rates" ON public.booklet_rates FOR SELECT USING (true);
CREATE POLICY "Anyone can view salesfolder rates" ON public.salesfolder_rates FOR SELECT USING (true);

-- Create RLS policies for admin management
CREATE POLICY "Only admins can manage visitkort prices" ON public.visitkort_prices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage poster rates" ON public.poster_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage sticker rates" ON public.sticker_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage sign rates" ON public.sign_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage banner rates" ON public.banner_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage beachflag prices" ON public.beachflag_prices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage booklet rates" ON public.booklet_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Only admins can manage salesfolder rates" ON public.salesfolder_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for timestamp updates
CREATE TRIGGER update_visitkort_prices_timestamp BEFORE UPDATE ON public.visitkort_prices FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_poster_rates_timestamp BEFORE UPDATE ON public.poster_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_sticker_rates_timestamp BEFORE UPDATE ON public.sticker_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_sign_rates_timestamp BEFORE UPDATE ON public.sign_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_banner_rates_timestamp BEFORE UPDATE ON public.banner_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_beachflag_prices_timestamp BEFORE UPDATE ON public.beachflag_prices FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_booklet_rates_timestamp BEFORE UPDATE ON public.booklet_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();
CREATE TRIGGER update_salesfolder_rates_timestamp BEFORE UPDATE ON public.salesfolder_rates FOR EACH ROW EXECUTE FUNCTION update_folder_price_timestamp();