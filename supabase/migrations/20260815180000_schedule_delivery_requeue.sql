-- Vercel Hobby cron cannot run every minute, so expired rider assignments are
-- requeued from Postgres instead. The /api/cron/delivery-dispatch route stays
-- available for manual or external triggers.
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'requeue-expired-delivery-assignments';

select cron.schedule(
  'requeue-expired-delivery-assignments',
  '* * * * *',
  $$select public.requeue_expired_delivery_assignments();$$
);
