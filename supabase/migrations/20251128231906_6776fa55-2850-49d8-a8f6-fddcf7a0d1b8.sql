-- Create table for poster formats with unit pricing
CREATE TABLE IF NOT EXISTS public.poster_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  format text NOT NULL,
  paper text NOT NULL,
  quantity integer NOT NULL,
  price_dkk numeric NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid,
  CONSTRAINT poster_prices_unique_combination UNIQUE (format, paper, quantity)
);

-- Enable Row Level Security
ALTER TABLE public.poster_prices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view poster prices"
  ON public.poster_prices FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage poster prices"
  ON public.poster_prices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for better performance
CREATE INDEX idx_poster_prices_format_paper ON public.poster_prices(format, paper);