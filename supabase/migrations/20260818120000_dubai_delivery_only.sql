-- Morni currently delivers in Dubai only. Keep existing out-of-zone
-- addresses readable, but block new non-Dubai addresses and orders.

create or replace function public.enforce_dubai_delivery_address()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.emirate is distinct from 'dubai'::public.uae_emirate then
    if tg_op = 'INSERT' then
      raise exception 'Morni currently delivers in Dubai only.';
    end if;
    if tg_op = 'UPDATE' and old.emirate is distinct from new.emirate then
      raise exception 'Morni currently delivers in Dubai only.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists addresses_dubai_delivery_only on public.addresses;
create trigger addresses_dubai_delivery_only
before insert or update on public.addresses
for each row execute function public.enforce_dubai_delivery_address();

create or replace function public.enforce_dubai_delivery_order()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.delivery_emirate is distinct from 'dubai'::public.uae_emirate then
    raise exception 'Morni currently delivers in Dubai only.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_dubai_delivery_only on public.orders;
create trigger orders_dubai_delivery_only
before insert on public.orders
for each row execute function public.enforce_dubai_delivery_order();
