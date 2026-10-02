-- Claim at most two payment reminders per shopper and unpaid card order. The first is due
-- six hours after checkout and the second 24 hours after the first is sent.
alter table public.orders
  add column if not exists payment_reminder_claimed_at timestamptz;

create index if not exists orders_unpaid_reminder_due_idx
  on public.orders (placed_at)
  where payment_method = 'card' and payment_status in ('pending', 'failed') and status = 'placed';

alter table public.email_notifications
  drop constraint if exists email_notifications_event_type_check;

alter table public.email_notifications
  add constraint email_notifications_event_type_check
  check (event_type in (
    'welcome', 'order_confirmation', 'order_status', 'store_new_order',
    'delivery_invite', 'payment_failed', 'delivery_failed', 'review_request',
    'store_payment_failed', 'store_order_cancelled', 'store_delivery_failed',
    'store_order_delivered', 'cart_reminder', 'unpaid_order_reminder'
  ));

create or replace function public.claim_unpaid_order_reminders(p_limit integer default 100)
returns table (
  order_id uuid,
  shopper_id uuid,
  order_number text,
  reminder_number integer,
  claimed_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  with eligible as (
    select o.id,
      case when first_reminder.sent_at is null then 1 else 2 end as reminder_number
    from public.orders o
    left join public.email_notifications first_reminder
      on first_reminder.event_type = 'unpaid_order_reminder'
      and first_reminder.entity_id = o.id::text || ':1'
      and first_reminder.status = 'sent'
    left join public.email_notifications second_reminder
      on second_reminder.event_type = 'unpaid_order_reminder'
      and second_reminder.entity_id = o.id::text || ':2'
      and second_reminder.status = 'sent'
    where o.payment_method = 'card'
      and o.payment_status in ('pending', 'failed')
      and o.status = 'placed'
      and o.placed_at <= now() - interval '6 hours'
      and not exists (
        select 1 from public.orders newer
        where newer.shopper_id = o.shopper_id
          and newer.id <> o.id
          and (newer.placed_at > o.placed_at
            or (newer.placed_at = o.placed_at and newer.id > o.id))
          and newer.status <> 'cancelled'
          and (newer.payment_status = 'paid'
            or (newer.payment_method = 'card' and newer.payment_status in ('pending', 'failed')))
      )
      and (select count(*) from public.email_notifications sent
        where sent.event_type = 'unpaid_order_reminder'
          and sent.recipient_id = o.shopper_id
          and sent.status = 'sent') < 2
      and not exists (
        select 1 from public.email_notifications recent
        where recent.event_type = 'unpaid_order_reminder'
          and recent.recipient_id = o.shopper_id
          and recent.status = 'sent'
          and recent.sent_at > now() - interval '24 hours'
      )
      and (o.payment_reminder_claimed_at is null
        or o.payment_reminder_claimed_at < now() - interval '30 minutes')
      and second_reminder.id is null
      and (first_reminder.sent_at is null
        or first_reminder.sent_at <= now() - interval '24 hours')
    order by o.placed_at asc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update of o skip locked
  ), claimed as (
    update public.orders o
    set payment_reminder_claimed_at = now()
    from eligible e
    where o.id = e.id
    returning o.id, o.shopper_id, o.order_number,
      e.reminder_number, o.payment_reminder_claimed_at
  )
  select claimed.id, claimed.shopper_id, claimed.order_number,
    claimed.reminder_number, claimed.payment_reminder_claimed_at
  from claimed;
$$;

revoke all on function public.claim_unpaid_order_reminders(integer)
  from public, anon, authenticated;
grant execute on function public.claim_unpaid_order_reminders(integer) to service_role;
