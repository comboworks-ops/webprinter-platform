-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tryksager', 'storformat')),
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('matrix', 'rate', 'formula', 'fixed', 'custom-dimensions')),
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Anyone can view published products
CREATE POLICY "Anyone can view published products"
ON public.products
FOR SELECT
USING (is_published = true);

-- Admins can view all products
CREATE POLICY "Admins can view all products"
ON public.products
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage products
CREATE POLICY "Only admins can manage products"
ON public.products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_product_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_product_timestamp();

-- Seed existing products from productMetadata
INSERT INTO public.products (name, slug, description, category, pricing_type, image_url, is_published) VALUES
('Flyers', 'flyers', 'Professionelle flyers i høj kvalitet til markedsføring og information.', 'tryksager', 'matrix', '/src/assets/products/flyers.png', true),
('Foldere', 'foldere', 'Foldere med forskellige falsetyper og formater.', 'tryksager', 'matrix', '/src/assets/products/foldere.png', true),
('Plakater', 'plakater', 'Plakater i forskellige størrelser og papirkvaliteter.', 'tryksager', 'rate', '/src/assets/products/plakater.png', true),
('Klistermærker', 'klistermærker', 'Klistermærker i vinyl, plast eller papir.', 'tryksager', 'rate', '/src/assets/products/klistermaerker.png', true),
('Hæfter', 'haefter', 'Hæfter med varierende sidetal og formater.', 'tryksager', 'formula', '/src/assets/products/haefter.png', true),
('Salgsmapper', 'salgsmapper', 'Professionelle salgsmapper til præsentationer.', 'tryksager', 'formula', '/src/assets/products/salgsmapper.png', true),
('Visitkort', 'visitkort', 'Visitkort i standard størrelse med forskellige papirkvaliteter.', 'tryksager', 'matrix', '/src/assets/products/visitkort.png', true),
('Bannere', 'bannere', 'Bannere i PVC, mesh eller tekstil til indendørs og udendørs brug.', 'storformat', 'custom-dimensions', '/src/assets/products/bannere.png', true),
('Beachflag', 'beachflag', 'Beachflag i forskellige størrelser med komplet system.', 'storformat', 'fixed', '/src/assets/products/beachflag.png', true),
('Skilte', 'skilte', 'Skilte i forskellige materialer og størrelser.', 'storformat', 'rate', '/src/assets/products/skilte.png', true),
('Folie', 'folie', 'Folie til vinduer og vægge i mat eller glans.', 'storformat', 'fixed', '/src/assets/products/folie.png', true),
('Messeudstyr', 'messeudstyr', 'Roll-ups, diske og messevægge til events.', 'storformat', 'fixed', '/src/assets/products/messeudstyr.png', true),
('Displayplakater', 'displayplakater', 'Store displayplakater til messestande og udstillinger.', 'storformat', 'fixed', '/src/assets/products/displayplakater.png', true);