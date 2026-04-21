-- POD v2: schedule automatic Print.com status polling every 20 minutes.
--
-- Print.com does not publish webhooks, so we sync by calling
-- pod2-printcom-sync-status on a schedule. The edge function is already
-- hardened to accept service-role-bearer calls without a user JWT (see
-- `isCronCall` in supabase/functions/pod2-printcom-sync-status/index.ts).
--
-- Two secrets are read from Vault at call time:
--   * `project_url`           — the full https URL of the Supabase project
--   * `service_role_key`      — the service role key (used as Bearer auth)
--
-- These must be created ONCE, out-of-band, before this cron does anything
-- useful. The migration is idempotent: it creates placeholder vault rows
-- with empty values if they don't exist, so the schedule installs cleanly
-- even on a brand new environment — and then falls back to logging rather
-- than crashing if the values are blank.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Make sure Vault rows exist so we never throw on missing-secret lookups.
-- Populating the actual values is a manual one-time step (see below) since
-- the migration file must not contain real credentials.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'project_url') THEN
    PERFORM vault.create_secret('', 'project_url');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'service_role_key') THEN
    PERFORM vault.create_secret('', 'service_role_key');
  END IF;
END $$;

-- Drop the prior schedule if it exists so re-running this migration is
-- safe (pg_cron.schedule errors on duplicate jobname).
DO $$
BEGIN
  PERFORM cron.unschedule('pod2-printcom-sync-status');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Schedule the cron. `*/20 * * * *` runs every 20 minutes on the hour
-- boundary (00, 20, 40). Each run POSTs to the edge function with the
-- service role key; the function scans all `submitted` / `processing`
-- jobs, polls Print.com, and updates status in place.
SELECT cron.schedule(
  'pod2-printcom-sync-status',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/pod2-printcom-sync-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- How to finish setup (run in Supabase SQL editor after this migration lands):
--
--   -- 1. Populate the project URL:
--   UPDATE vault.secrets
--     SET secret = 'https://ziattmsmiirfweiuunfo.supabase.co'
--     WHERE name = 'project_url';
--
--   -- 2. Populate the service role key. Get it from
--   --    Supabase Dashboard -> Project Settings -> API -> service_role.
--   --    Never commit the value anywhere.
--   UPDATE vault.secrets
--     SET secret = 'eyJhbGciOi...'  -- paste the service role JWT
--     WHERE name = 'service_role_key';
--
-- Once both are set the cron starts working on the next 20-minute boundary.
-- Confirm by running:
--
--   SELECT * FROM cron.job WHERE jobname = 'pod2-printcom-sync-status';
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
