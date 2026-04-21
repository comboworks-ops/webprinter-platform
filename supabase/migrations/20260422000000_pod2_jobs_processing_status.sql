-- Add `processing` to pod2_fulfillment_jobs.status allowed values.
--
-- Needed by pod2-printcom-sync-status: Print.com signals a job is
-- mid-production ("accepted" / "in_production" / "printing" etc.), which
-- we collapse to `processing` so the UI can distinguish "just submitted"
-- from "print-house is actually working on it". Prior to this, the
-- CHECK constraint only allowed: awaiting_approval, payment_pending,
-- paid, submitted, failed, completed.
ALTER TABLE public.pod2_fulfillment_jobs
  DROP CONSTRAINT IF EXISTS pod2_fulfillment_jobs_status_check;

ALTER TABLE public.pod2_fulfillment_jobs
  ADD CONSTRAINT pod2_fulfillment_jobs_status_check
  CHECK (status IN (
    'awaiting_approval',
    'payment_pending',
    'paid',
    'submitted',
    'processing',
    'failed',
    'completed'
  ));
