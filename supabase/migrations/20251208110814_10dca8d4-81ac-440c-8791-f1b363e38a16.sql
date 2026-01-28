-- Add quantity column to beachflag_prices for quantity-based pricing
ALTER TABLE public.beachflag_prices 
ADD COLUMN quantity integer NOT NULL DEFAULT 1;

-- Update existing records to have quantity = 1 (base price is for 1 unit)
UPDATE public.beachflag_prices SET quantity = 1 WHERE quantity IS NULL;

-- Create index for efficient queries
CREATE INDEX idx_beachflag_prices_size_system_quantity ON public.beachflag_prices(size, system, quantity);