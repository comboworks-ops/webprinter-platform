-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill emails from auth.users (requires superuser/postgres role)
-- Note: This might fail in some environments if not run as superuser, 
-- but we'll include it for completeness.
UPDATE public.profiles
SET email = au.email
FROM auth.users au
WHERE au.id = public.profiles.id;

-- Create a trigger function to sync email on updates to auth.users
CREATE OR REPLACE FUNCTION public.handle_user_email_sync()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_email_sync();

-- Update the handle_new_user function to include email if it exists
-- usually there is a handle_new_user trigger in Supabase setups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, avatar_url, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
