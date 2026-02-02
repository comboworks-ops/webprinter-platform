-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create table for folder prices
CREATE TABLE public.folder_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format TEXT NOT NULL,
    paper TEXT NOT NULL,
    fold_type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_dkk NUMERIC NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id),
    UNIQUE (format, paper, fold_type, quantity)
);

-- Enable RLS on folder_prices
ALTER TABLE public.folder_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for folder_prices
CREATE POLICY "Anyone can view folder prices"
ON public.folder_prices
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Only admins can update folder prices"
ON public.folder_prices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create function to update price timestamp
CREATE OR REPLACE FUNCTION public.update_folder_price_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_folder_prices_timestamp
BEFORE UPDATE ON public.folder_prices
FOR EACH ROW
EXECUTE FUNCTION public.update_folder_price_timestamp();