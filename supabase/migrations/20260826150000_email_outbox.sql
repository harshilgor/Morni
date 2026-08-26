-- Durable email events for transitions that happen inside database functions.
alter table public.email_notifications drop constraint if exists email_notifications_event_type_check;
alter table public.email_notifications add constraint email_notifications_event_type_check
  check (event_type in ('welcome', 'order_confirmation', 'order_status', 'store_new_order', 'delivery_invite', 'payment_failed', 'delivery_failed', 'review_request', 'store_payment_failed', 'store_order_cancelled', 'store_delivery_failed', 'store_order_delivered'));

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('order_status', 'payment_failed', 'delivery_failed', 'review_request', 'store_payment_failed', 'store_order_cancelled', 'store_delivery_failed', 'store_order_delivered')),
  order_id uuid not null references public.orders(id) on delete cascade,
  detail text,
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(event_type, order_id, detail)
);

alter table public.email_outbox enable row level security;

create or replace function public.enqueue_order_email_events()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status in ('accepted', 'picking', 'out_for_delivery', 'delivered', 'cancelled') then
    insert into public.email_outbox(event_type, order_id, detail)
    values ('order_status', new.id, new.status::text) on conflict (event_type, order_id, detail) do nothing;
  end if;
  if new.payment_status is distinct from old.payment_status and new.payment_status = 'failed' then
    insert into public.email_outbox(event_type, order_id, detail)
    values ('payment_failed', new.id, 'payment_failed') on conflict (event_type, order_id, detail) do nothing;
    insert into public.email_outbox(event_type, order_id, detail)
    values ('store_payment_failed', new.id, 'store_payment_failed') on conflict (event_type, order_id, detail) do nothing;
  end if;
  if new.status is distinct from old.status and new.status = 'cancelled' then
    insert into public.email_outbox(event_type, order_id, detail)
    values ('store_order_cancelled', new.id, 'store_order_cancelled') on conflict (event_type, order_id, detail) do nothing;
  end if;
  if new.status = 'delivered' and old.status is distinct from new.status then
    insert into public.email_outbox(event_type, order_id, detail)
    values ('review_request', new.id, 'review_request') on conflict (event_type, order_id, detail) do nothing;
    insert into public.email_outbox(event_type, order_id, detail)
    values ('store_order_delivered', new.id, 'store_order_delivered') on conflict (event_type, order_id, detail) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists orders_enqueue_email_events on public.orders;
create trigger orders_enqueue_email_events after update on public.orders
for each row execute function public.enqueue_order_email_events();

create or replace function public.enqueue_delivery_failure_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'failed' and old.status is distinct from new.status then
    insert into public.email_outbox(event_type, order_id, detail)
    values ('delivery_failed', new.order_id, coalesce(new.failure_reason, 'delivery_failed'))
    on conflict (event_type, order_id, detail) do nothing;
    insert into public.email_outbox(event_type, order_id, detail)
    values ('store_delivery_failed', new.order_id, coalesce(new.failure_reason, 'delivery_failed'))
    on conflict (event_type, order_id, detail) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists delivery_jobs_enqueue_email_events on public.delivery_jobs;
create trigger delivery_jobs_enqueue_email_events after update on public.delivery_jobs
for each row execute function public.enqueue_delivery_failure_email();
