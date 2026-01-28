
-- Enable Realtime for Notifications and Messages
BEGIN;
  -- Check if checking publication exists, if not created by Supabase default, create it (usually it exists)
  -- But usually we just add tables.
  
  -- We use DO block to avoid errors if table is already in publication
  DO $$
  BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_notifications';
  EXCEPTION WHEN duplicate_object THEN NULL; -- table already in publication
  WHEN OTHERS THEN NULL; -- publication might not exist or other error, ignore for now
  END;
  $$;

  DO $$
  BEGIN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages';
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
  END;
  $$;
COMMIT;

