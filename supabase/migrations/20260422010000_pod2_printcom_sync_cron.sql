-- POD v2: schedule automatic Print.com status polling every 20 minutes.
--
-- Print.com does not publish webhooks, so we sync by calling
-- pod2-printcom-sync-status on a schedule. The edge function accepts
-- a shared-secret header (X-Pod2-Cron-Secret) to bypass user-JWT auth
-- on cron-invoked calls. See `isCronCall` in
-- supabase/functions/pod2-printcom-sync-status/index.ts.
--
-- Why a dedicated cron secret (and not the service role key)?
--   Supabase is mid-rollout of a new API key format (sb_secret_*).
--   The value injected into edge-function env vars doesn't always
--   match what the dashboard shows, so comparing against
--   SUPABASE_SERVICE_ROLE_KEY is unreliable right now. A dedicated
--   shared secret removes the ambiguity and avoids exposing the
--   service role key at all.
--
-- Two secrets are read from Vault at call time:
--   * `project_url`      — the full https URL of the Supabase project
--   * `pod2_cron_secret` — arbitrary random string; must exactly match
--                          the POD2_CRON_SECRET env var set on the
--                          edge function in the Supabase dashboard
--
-- These must be created ONCE, out-of-band, before this cron does
-- anything useful. The migration is idempotent: it creates placeholder
-- Vault rows with empty values if they don't exist, so the schedule
-- installs cleanly even on a brand new environment — the edge function
-- will return 401 until the values are populated.

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
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'pod2_cron_secret') THEN
    PERFORM vault.create_secret('', 'pod2_cron_secret');
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
-- shared cron secret header; the function scans all `submitted` /
-- `processing` jobs, polls Print.com, and updates status in place.
SELECT cron.schedule(
  'pod2-printcom-sync-status',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/pod2-printcom-sync-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Pod2-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pod2_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- How to finish setup (run in Supabase SQL editor after this migration lands):
--
--   -- 1. Populate the project URL:
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'project_url'),
--     'https://ziattmsmiirfweiuunfo.supabase.co'
--   );
--
--   -- 2. Generate a random cron secret (copy the output):
--   SELECT encode(gen_random_bytes(32), 'hex');
--
--   -- 3. Paste the same value in two places:
--   --    a) Supabase Dashboard -> Edge Functions -> pod2-printcom-sync-status
--   --       -> Secrets -> add POD2_CRON_SECRET = <the hex string>
--   --    b) Vault:
--   SELECT vault.update_secret(
--     (SELECT id FROM vault.secrets WHERE name = 'pod2_cron_secret'),
--     '<paste the same hex string>'
--   );
--
-- Once both are set the cron starts working on the next 20-minute
-- boundary. Confirm by running:
--
--   SELECT * FROM cron.job WHERE jobname = 'pod2-printcom-sync-status';
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
--
-- Or test it manually (should return status_code = 200):
--
--   SELECT net.http_post(
--     url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/pod2-printcom-sync-status',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'X-Pod2-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'pod2_cron_secret')
--     ),
--     body := '{}'::jsonb
--   );
--   -- then a moment later:
--   SELECT status_code, content FROM net._http_response ORDER BY id DESC LIMIT 1;
