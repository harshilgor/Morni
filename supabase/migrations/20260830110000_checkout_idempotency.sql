create table if not exists public.checkout_requests (
  id uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (shopper_id, idempotency_key)
);

create index if not exists checkout_requests_created_idx on public.checkout_requests(created_at);
alter table public.checkout_requests enable row level security;
revoke all on public.checkout_requests from anon, authenticated;

-- Founder settlements: store-level payable balances and an auditable payment ledger.
create table if not exists public.merchant_payouts (
  id uuid primary key default gen_random_uuid(), store_id uuid not null references public.stores(id) on delete restrict,
  period_start date not null, period_end date not null, order_count integer not null check (order_count >= 0),
  gross_sales numeric(12,2) not null check (gross_sales >= 0), commission numeric(12,2) not null check (commission >= 0),
  net_payout numeric(12,2) not null check (net_payout >= 0), status text not null default 'paid' check (status in ('paid', 'voided')),
  payment_method text not null default 'bank_transfer', payment_reference text, note text, paid_at timestamptz not null default now(),
  paid_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique (store_id, period_start, period_end)
);
alter table public.merchant_payouts enable row level security;
create policy "merchant_payouts_admin_read" on public.merchant_payouts for select using (public.is_morni_admin());
create policy "merchant_payouts_admin_insert" on public.merchant_payouts for insert with check (public.is_morni_admin() and paid_by = auth.uid());

create or replace function public.founder_settlement_data(p_range_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_end date := (now() at time zone 'Asia/Dubai')::date; v_start date := v_end - (greatest(7, least(coalesce(p_range_days, 7), 30)) - 1);
begin
  if not public.is_morni_admin() then raise exception 'Founder workspace access is restricted to Morni administrators.'; end if;
  return jsonb_build_object('period_start', v_start, 'period_end', v_end, 'commission_rate', 0.15,
    'stores', coalesce((select jsonb_agg(row_to_json(rows) order by rows.net_payout desc, rows.store_name) from (select s.id as store_id, s.name as store_name, count(o.id)::integer as order_count, coalesce(sum(o.subtotal_aed), 0)::numeric as gross_sales, round(coalesce(sum(o.subtotal_aed), 0) * 0.15, 2)::numeric as commission, round(coalesce(sum(o.subtotal_aed), 0) * 0.85, 2)::numeric as net_payout, coalesce((select sum(p.net_payout) from merchant_payouts p where p.store_id = s.id and p.period_start = v_start and p.period_end = v_end and p.status = 'paid'), 0)::numeric as paid_amount from stores s left join orders o on o.store_id = s.id and o.status = 'delivered' and (o.placed_at at time zone 'Asia/Dubai')::date between v_start and v_end group by s.id, s.name) rows), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(row_to_json(rows) order by rows.paid_at desc) from (select p.id, p.store_id, s.name as store_name, p.period_start, p.period_end, p.order_count, p.gross_sales, p.commission, p.net_payout, p.payment_method, p.payment_reference, p.note, p.paid_at from merchant_payouts p join stores s on s.id = p.store_id where p.status = 'paid' order by p.paid_at desc limit 100) rows), '[]'::jsonb));
end; $$;

create or replace function public.record_merchant_payout(p_store_id uuid, p_period_start date, p_period_end date, p_payment_method text, p_payment_reference text, p_note text)
returns public.merchant_payouts language plpgsql security definer set search_path = public, pg_temp as $$
declare v_result public.merchant_payouts;
begin
  if not public.is_morni_admin() then raise exception 'Founder access is required.'; end if;
  insert into merchant_payouts (store_id, period_start, period_end, order_count, gross_sales, commission, net_payout, payment_method, payment_reference, note, paid_by)
  select p_store_id, p_period_start, p_period_end, count(*)::integer, coalesce(sum(subtotal_aed), 0), round(coalesce(sum(subtotal_aed), 0) * 0.15, 2), round(coalesce(sum(subtotal_aed), 0) * 0.85, 2), coalesce(nullif(trim(p_payment_method), ''), 'bank_transfer'), nullif(trim(p_payment_reference), ''), nullif(trim(p_note), ''), auth.uid() from orders where store_id = p_store_id and status = 'delivered' and (placed_at at time zone 'Asia/Dubai')::date between p_period_start and p_period_end on conflict (store_id, period_start, period_end) do update set payment_method = excluded.payment_method, payment_reference = excluded.payment_reference, note = excluded.note, paid_at = now(), paid_by = auth.uid() returning * into v_result;
  return v_result;
end; $$;
revoke all on function public.founder_settlement_data(integer) from public, anon;
revoke all on function public.record_merchant_payout(uuid, date, date, text, text, text) from public, anon;
grant execute on function public.founder_settlement_data(integer) to authenticated, service_role;
grant execute on function public.record_merchant_payout(uuid, date, date, text, text, text) to authenticated, service_role;
