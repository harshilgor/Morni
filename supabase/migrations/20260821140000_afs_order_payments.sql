-- AFS COPYandPAY payment audit + idempotent mark-paid helpers.

create table if not exists public.order_payments (
  order_id uuid primary key references public.orders (id) on delete cascade,
  provider text not null default 'afs' check (provider = 'afs'),
  afs_checkout_id text,
  afs_payment_id text,
  merchant_transaction_id text not null,
  result_code text,
  result_description text,
  amount_aed numeric(10, 2) not null,
  currency text not null default 'AED' check (currency = 'AED'),
  raw_status jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_payments_merchant_tx_unique unique (merchant_transaction_id),
  constraint order_payments_afs_payment_id_unique unique (afs_payment_id)
);

create index if not exists order_payments_checkout_idx
  on public.order_payments (afs_checkout_id)
  where afs_checkout_id is not null;

alter table public.order_payments enable row level security;

-- Payment rows are server-managed only (service role). No browser policies.

create or replace function public.touch_order_payments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists order_payments_set_updated_at on public.order_payments;
create trigger order_payments_set_updated_at
  before update on public.order_payments
  for each row
  execute function public.touch_order_payments_updated_at();

create or replace function public.mark_order_paid_from_afs(
  p_order_id uuid,
  p_afs_checkout_id text,
  p_afs_payment_id text,
  p_result_code text,
  p_result_description text,
  p_amount_aed numeric,
  p_raw_status jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_first_paid boolean := false;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;

  if p_order_id is null or nullif(trim(p_afs_payment_id), '') is null then
    raise exception 'Order and payment id are required.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.payment_method is distinct from 'card' then
    raise exception 'Order is not a card payment.';
  end if;

  if round(p_amount_aed::numeric, 2) is distinct from round(v_order.total_aed::numeric, 2) then
    raise exception 'Payment amount does not match order total.';
  end if;

  insert into public.order_payments (
    order_id,
    provider,
    afs_checkout_id,
    afs_payment_id,
    merchant_transaction_id,
    result_code,
    result_description,
    amount_aed,
    currency,
    raw_status,
    paid_at
  )
  values (
    p_order_id,
    'afs',
    nullif(trim(p_afs_checkout_id), ''),
    trim(p_afs_payment_id),
    p_order_id::text,
    nullif(trim(p_result_code), ''),
    nullif(trim(p_result_description), ''),
    round(p_amount_aed::numeric, 2),
    'AED',
    p_raw_status,
    now()
  )
  on conflict (order_id) do update
    set
      afs_checkout_id = coalesce(excluded.afs_checkout_id, public.order_payments.afs_checkout_id),
      afs_payment_id = coalesce(excluded.afs_payment_id, public.order_payments.afs_payment_id),
      result_code = excluded.result_code,
      result_description = excluded.result_description,
      amount_aed = excluded.amount_aed,
      raw_status = excluded.raw_status,
      paid_at = coalesce(public.order_payments.paid_at, excluded.paid_at),
      updated_at = now()
  where public.order_payments.afs_payment_id is null
     or public.order_payments.afs_payment_id = excluded.afs_payment_id;

  if v_order.payment_status is distinct from 'paid' then
    update public.orders
    set payment_status = 'paid'
    where id = p_order_id
      and payment_status is distinct from 'paid';
    v_first_paid := found;
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'payment_status', 'paid',
    'first_paid', v_first_paid
  );
end;
$$;

create or replace function public.mark_order_payment_failed_from_afs(
  p_order_id uuid,
  p_afs_checkout_id text,
  p_result_code text,
  p_result_description text,
  p_raw_status jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.payment_status = 'paid' then
    return jsonb_build_object(
      'order_id', p_order_id,
      'payment_status', 'paid',
      'updated', false
    );
  end if;

  insert into public.order_payments (
    order_id,
    provider,
    afs_checkout_id,
    merchant_transaction_id,
    result_code,
    result_description,
    amount_aed,
    currency,
    raw_status
  )
  values (
    p_order_id,
    'afs',
    nullif(trim(p_afs_checkout_id), ''),
    p_order_id::text,
    nullif(trim(p_result_code), ''),
    nullif(trim(p_result_description), ''),
    v_order.total_aed,
    'AED',
    p_raw_status
  )
  on conflict (order_id) do update
    set
      afs_checkout_id = coalesce(excluded.afs_checkout_id, public.order_payments.afs_checkout_id),
      result_code = excluded.result_code,
      result_description = excluded.result_description,
      raw_status = excluded.raw_status,
      updated_at = now()
  where public.order_payments.paid_at is null;

  update public.orders
  set payment_status = 'failed'
  where id = p_order_id
    and payment_status is distinct from 'paid';

  return jsonb_build_object(
    'order_id', p_order_id,
    'payment_status', 'failed',
    'updated', true
  );
end;
$$;

create or replace function public.upsert_afs_checkout_session(
  p_order_id uuid,
  p_afs_checkout_id text,
  p_amount_aed numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Forbidden';
  end if;

  if nullif(trim(p_afs_checkout_id), '') is null then
    raise exception 'Checkout id is required.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.payment_method is distinct from 'card' then
    raise exception 'Order is not a card payment.';
  end if;

  if v_order.payment_status = 'paid' then
    raise exception 'Order is already paid.';
  end if;

  if round(p_amount_aed::numeric, 2) is distinct from round(v_order.total_aed::numeric, 2) then
    raise exception 'Checkout amount does not match order total.';
  end if;

  insert into public.order_payments (
    order_id,
    provider,
    afs_checkout_id,
    merchant_transaction_id,
    amount_aed,
    currency
  )
  values (
    p_order_id,
    'afs',
    trim(p_afs_checkout_id),
    p_order_id::text,
    round(p_amount_aed::numeric, 2),
    'AED'
  )
  on conflict (order_id) do update
    set
      afs_checkout_id = excluded.afs_checkout_id,
      amount_aed = excluded.amount_aed,
      result_code = null,
      result_description = null,
      raw_status = null,
      updated_at = now()
  where public.order_payments.paid_at is null;

  update public.orders
  set payment_status = 'pending'
  where id = p_order_id
    and payment_status = 'failed';
end;
$$;

revoke all on function public.mark_order_paid_from_afs(uuid, text, text, text, text, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.mark_order_payment_failed_from_afs(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.upsert_afs_checkout_session(uuid, text, numeric) from public, anon, authenticated;

grant execute on function public.mark_order_paid_from_afs(uuid, text, text, text, text, numeric, jsonb) to service_role;
grant execute on function public.mark_order_payment_failed_from_afs(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.upsert_afs_checkout_session(uuid, text, numeric) to service_role;
