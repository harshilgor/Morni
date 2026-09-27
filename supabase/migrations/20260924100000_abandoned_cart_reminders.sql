-- Idempotent first abandoned-cart reminder after six hours.
alter table public.cart_snapshots
  add column if not exists reminder_claimed_at timestamptz;

alter table public.cart_snapshots
  add column if not exists reminder_sent_at timestamptz;

create index if not exists cart_snapshots_reminder_eligible_idx
  on public.cart_snapshots (updated_at)
  where item_count > 0 and shopper_id is not null;

alter table public.email_notifications
  drop constraint if exists email_notifications_event_type_check;

alter table public.email_notifications
  add constraint email_notifications_event_type_check
  check (event_type in (
    'welcome', 'order_confirmation', 'order_status', 'store_new_order',
    'delivery_invite', 'payment_failed', 'delivery_failed', 'review_request',
    'store_payment_failed', 'store_order_cancelled', 'store_delivery_failed',
    'store_order_delivered', 'cart_reminder'
  ));

create or replace function public.claim_abandoned_cart_reminders(p_limit integer default 100)
returns table (
  cart_id uuid,
  shopper_id uuid,
  updated_at timestamptz,
  claimed_at timestamptz,
  item_count integer,
  items jsonb
)
language sql
security invoker
set search_path = public
as $$
  with eligible as (
    select cs.id
    from public.cart_snapshots cs
    where cs.shopper_id is not null
      and cs.item_count > 0
      and cs.updated_at <= now() - interval '6 hours'
      and cs.reminder_sent_at is null
      and (cs.reminder_claimed_at is null or cs.reminder_claimed_at < now() - interval '30 minutes')
      and exists (select 1 from public.profiles p where p.id = cs.shopper_id)
      and not exists (
        select 1
        from public.orders o
        where o.shopper_id = cs.shopper_id
          and o.status <> 'cancelled'
          and o.placed_at >= cs.updated_at
      )
    order by cs.updated_at asc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
    for update of cs skip locked
  ), claimed as (
    update public.cart_snapshots cs
    set reminder_claimed_at = now()
    from eligible e
    where cs.id = e.id
    returning cs.id, cs.shopper_id, cs.updated_at, cs.reminder_claimed_at, cs.item_count, cs.items
  )
  select claimed.id, claimed.shopper_id, claimed.updated_at, claimed.reminder_claimed_at, claimed.item_count, claimed.items
  from claimed;
$$;

revoke all on function public.claim_abandoned_cart_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_abandoned_cart_reminders(integer) to service_role;
