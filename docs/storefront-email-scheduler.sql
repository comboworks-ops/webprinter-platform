-- Run as a database administrator after the matched email backend is deployed.
-- Prerequisites: pg_cron, pg_net, and Supabase Vault extensions.
-- Configure these two Vault entries through protected account tooling:
-- storefront_order_email_project_url: this backend's HTTPS Supabase origin
-- storefront_order_email_cron_secret: same dedicated bearer as the Edge secret
-- STOREFRONT_ORDER_EMAIL_CRON_SECRET. Never put its value in this file.
-- This script installs the one-minute job INACTIVE. It sends no email.
-- No public tables/functions or browser grants are created.

BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM vault.secrets
      WHERE name IN ('storefront_order_email_project_url', 'storefront_order_email_cron_secret')) <> 2 THEN
    RAISE EXCEPTION 'Configure the two dedicated email scheduler Vault entries first';
  END IF;
END;
$$;

SELECT cron.schedule(
  'storefront-order-email-dispatch',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets
              WHERE name = 'storefront_order_email_project_url')
              || '/functions/v1/storefront-order-email-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets
                                     WHERE name = 'storefront_order_email_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 90000
    ) AS request_id;
  $job$
);

SELECT cron.alter_job(jobid, active := false)
FROM cron.job WHERE jobname = 'storefront-order-email-dispatch';

COMMIT;

-- Enable only after verified sender/recipient/mode configuration and acceptance:
-- SELECT cron.alter_job(jobid, active := true)
-- FROM cron.job WHERE jobname = 'storefront-order-email-dispatch';
-- Inspect cron.job_run_details AND net._http_response. A succeeded cron SQL
-- submission alone is not proof that the HTTP worker succeeded or email arrived.
-- Rollback: deactivate this same job and set email mode to disabled. Preserve
-- queue rows, provider IDs, Vault entries, and shared extensions for recovery.
