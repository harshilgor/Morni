-- Persist checkout fees and provide an authoritative refund quote. The client
-- may preview these values, but refund processors must use this function.

alter table public.orders
  add column if not exists small_order_fee_aed numeric(10, 2) not null default 0,
  add column if not exists service_fee_aed numeric(10, 2) not null default 0;

alter table public.orders
  drop constraint if exists orders_small_order_fee_aed_check,
  drop constraint if exists orders_service_fee_aed_check;

alter table public.orders
  add constraint orders_small_order_fee_aed_check
    check (small_order_fee_aed in (0, 15)),
  add constraint orders_service_fee_aed_check
    check (service_fee_aed >= 0);

create or replace function public.quote_order_refund(
  p_order_id uuid,
  p_return_items jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
  v_return_item jsonb;
  v_order_item public.order_items;
  v_seen_item_ids uuid[] := '{}';
  v_quantity integer;
  v_total_quantity integer;
  v_returned_quantity integer := 0;
  v_returned_item_price numeric(10, 2) := 0;
  v_small_order_fee_refund numeric(10, 2) := 0;
  v_convenience_fee numeric(10, 2) := 0;
  v_refund_amount numeric(10, 2);
  v_is_full_return boolean := false;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to calculate a refund.';
  end if;

  select o.* into v_order
  from public.orders o
  where o.id = p_order_id
    and (
      o.shopper_id = auth.uid()
      or public.is_store_member(o.store_id)
    );

  if not found then
    raise exception 'Order not found.';
  end if;

  if p_return_items is null
     or jsonb_typeof(p_return_items) <> 'array'
     or jsonb_array_length(p_return_items) = 0 then
    raise exception 'Choose at least one item to return.';
  end if;

  for v_return_item in select * from jsonb_array_elements(p_return_items)
  loop
    select oi.* into v_order_item
    from public.order_items oi
    where oi.id = (v_return_item->>'order_item_id')::uuid
      and oi.order_id = p_order_id;

    if not found then
      raise exception 'A selected item does not belong to this order.';
    end if;

    if v_order_item.id = any(v_seen_item_ids) then
      raise exception 'Each returned item can only be included once.';
    end if;
    v_seen_item_ids := array_append(v_seen_item_ids, v_order_item.id);

    v_quantity := coalesce((v_return_item->>'quantity')::integer, 0);
    if v_quantity <= 0 or v_quantity > v_order_item.quantity then
      raise exception 'Invalid return quantity for %.', v_order_item.title;
    end if;

    v_returned_quantity := v_returned_quantity + v_quantity;
    v_returned_item_price :=
      v_returned_item_price + (v_order_item.unit_price_aed * v_quantity);
  end loop;

  select coalesce(sum(oi.quantity), 0)::integer into v_total_quantity
  from public.order_items oi
  where oi.order_id = p_order_id;

  v_is_full_return := v_total_quantity > 0
    and v_returned_quantity = v_total_quantity;
  v_small_order_fee_refund := case
    when v_is_full_return then v_order.small_order_fee_aed
    else 0
  end;
  v_convenience_fee := case when v_is_full_return then 10 else 0 end;
  v_refund_amount := greatest(
    0,
    v_returned_item_price + v_small_order_fee_refund - v_convenience_fee
  );

  return jsonb_build_object(
    'returned_item_price_aed', v_returned_item_price,
    'delivery_fee_refund_aed', 0,
    'small_order_fee_refund_aed', v_small_order_fee_refund,
    'service_fee_refund_aed', 0,
    'convenience_fee_deduction_aed', v_convenience_fee,
    'is_full_return', v_is_full_return,
    'refund_amount_aed', v_refund_amount,
    'options', jsonb_build_array(
      jsonb_build_object(
        'method', 'wallet',
        'amount_aed', v_refund_amount,
        'availability', 'immediately'
      ),
      jsonb_build_object(
        'method', 'original_payment_method',
        'amount_aed', v_refund_amount,
        'availability', '7–9 working days'
      )
    )
  );
end;
$$;

revoke all on function public.quote_order_refund(uuid, jsonb)
  from public, anon;
grant execute on function public.quote_order_refund(uuid, jsonb)
  to authenticated;
