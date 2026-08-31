-- Size-level inventory. New products use this JSON object; the existing
-- products.stock column remains the aggregate for backwards compatibility.
alter table public.products
  add column if not exists size_stock jsonb not null default '{}'::jsonb;

alter table public.bulk_import_items
  add column if not exists size_stock jsonb not null default '{}'::jsonb;

create table if not exists public.store_inventory_notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  kind text not null check (kind in ('legacy_size_inventory','restored_inventory')),
  title text not null,
  detail text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);
create index if not exists store_inventory_notifications_store_idx on public.store_inventory_notifications(store_id, status, created_at desc);
alter table public.store_inventory_notifications enable row level security;
drop policy if exists "store_inventory_notifications_owner_read" on public.store_inventory_notifications;
create policy "store_inventory_notifications_owner_read" on public.store_inventory_notifications for select using (public.is_store_member(store_id));
drop policy if exists "store_inventory_notifications_owner_update" on public.store_inventory_notifications;
create policy "store_inventory_notifications_owner_update" on public.store_inventory_notifications for update using (public.is_store_member(store_id));

alter table public.products
  add constraint products_size_stock_object
  check (jsonb_typeof(size_stock) = 'object');

create or replace function public.sync_product_size_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.size_stock is not null and jsonb_typeof(new.size_stock) = 'object'
     and new.size_stock <> '{}'::jsonb then
    new.stock := coalesce((select sum(value::integer) from jsonb_each_text(new.size_stock)), 0);
    new.sizes := coalesce((select array_agg(key order by key) from jsonb_each(new.size_stock)), '{}'::text[]);
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_size_stock on public.products;
create trigger products_sync_size_stock
  before insert or update of size_stock on public.products
  for each row execute function public.sync_product_size_stock();

notify pgrst, 'reload schema';

create or replace function public.publish_bulk_import(p_import_id uuid)
returns table(item_id uuid, product_id uuid, ok boolean, error_message text)
language plpgsql security definer set search_path = public as $$
declare item record; category_id uuid; created_id uuid;
begin
  for item in select * from public.bulk_import_items where import_id=p_import_id and status in ('pending','failed') order by created_at loop
    begin
      select c.id into category_id from public.categories c join public.bulk_imports i on i.store_id=c.store_id where i.id=p_import_id and c.slug=item.category_slug limit 1;
      if category_id is null then raise exception 'Category is not available for this store.'; end if;
      insert into public.products(store_id,category_id,title,product_tag,description,fabric,price_aed,stock,sizes,size_stock,image_urls,is_available)
        select i.store_id,category_id,item.title,nullif(item.product_tag,''),item.description,item.fabric,item.price_aed,
          case when item.size_stock <> '{}'::jsonb then coalesce((select sum(value::integer) from jsonb_each_text(item.size_stock)),0) else item.stock end,
          case when item.category_slug in ('gifting','hamper','hampers') then '{}'::text[] else item.sizes end,
          case when item.category_slug in ('gifting','hamper','hampers') then '{}'::jsonb else item.size_stock end,
          item.image_urls,true from public.bulk_imports i where i.id=p_import_id returning id into created_id;
      update public.bulk_import_items set status='published',product_id=created_id,error_message=null,attempt_count=attempt_count+1,updated_at=now() where id=item.id;
      item_id:=item.id; product_id:=created_id; ok:=true; error_message:=null; return next;
    exception when others then
      update public.bulk_import_items set status='failed',error_message=left(sqlerrm,500),attempt_count=attempt_count+1,updated_at=now() where id=item.id;
      item_id:=item.id; product_id:=null; ok:=false; error_message:=left(sqlerrm,500); return next;
    end;
  end loop;
  update public.bulk_imports i set successful_items=(select count(*) from public.bulk_import_items x where x.import_id=i.id and x.status='published'), failed_items=(select count(*) from public.bulk_import_items x where x.import_id=i.id and x.status='failed'), status=case when exists(select 1 from public.bulk_import_items x where x.import_id=i.id and x.status='failed') then 'completed_with_errors' else 'completed' end, completed_at=now() where i.id=p_import_id;
end; $$;
revoke all on function public.publish_bulk_import(uuid) from public, anon, authenticated;

create or replace function public.cancel_order_and_restore_inventory(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = public as $$
declare v_order public.orders; item record; current_qty integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.status not in ('placed','accepted','picking','out_for_delivery') then raise exception 'Order cannot be cancelled.'; end if;
  for item in select * from public.order_items where order_id = p_order_id loop
    if item.variant_id is not null then
      update public.product_variants set stock = stock + item.quantity where id = item.variant_id;
    elsif item.size is not null and exists (select 1 from public.products where id = item.product_id and size_stock <> '{}'::jsonb) then
      select coalesce((size_stock->>item.size)::integer, 0) into current_qty from public.products where id = item.product_id for update;
      update public.products set size_stock = jsonb_set(size_stock, array[item.size], to_jsonb(current_qty + item.quantity), true) where id = item.product_id;
    else
      update public.products set stock = stock + item.quantity where id = item.product_id;
    end if;
    insert into public.store_inventory_notifications(store_id, product_id, order_id, kind, title, detail, payload)
    values (v_order.store_id, item.product_id, p_order_id, 'restored_inventory', 'Inventory restored after cancellation',
      format('%s × %s returned to inventory.', item.quantity, coalesce(item.size, 'standard')),
      jsonb_build_object('product_id', item.product_id, 'size', item.size, 'quantity', item.quantity, 'variant_id', item.variant_id));
  end loop;
  update public.orders set status = 'cancelled' where id = p_order_id returning * into v_order;
  return v_order;
end; $$;
revoke all on function public.cancel_order_and_restore_inventory(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order_and_restore_inventory(uuid) to service_role;

create or replace function public.restore_inventory_after_failed_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'failed' and old.status is distinct from new.status then
    perform public.cancel_order_and_restore_inventory(new.order_id);
  end if;
  return new;
end; $$;
drop trigger if exists delivery_failed_restore_inventory on public.delivery_jobs;
create trigger delivery_failed_restore_inventory
  after update of status on public.delivery_jobs
  for each row execute function public.restore_inventory_after_failed_delivery();

create or replace function public.resolve_inventory_notification(p_notification_id uuid, p_decision text)
returns public.store_inventory_notifications
language plpgsql security definer set search_path = public as $$
declare n public.store_inventory_notifications; item_size text; item_qty integer; p public.products; current_qty integer;
begin
  select * into n from public.store_inventory_notifications where id = p_notification_id for update;
  if not found or not public.is_store_member(n.store_id) then raise exception 'Notification not found.'; end if;
  if n.status <> 'pending' then return n; end if;
  if p_decision not in ('accepted','rejected') then raise exception 'Invalid notification decision.'; end if;
  if p_decision = 'rejected' and n.kind = 'restored_inventory' then
    item_size := nullif(n.payload->>'size',''); item_qty := (n.payload->>'quantity')::integer;
    select * into p from public.products where id = n.product_id for update;
    if item_size is not null and p.size_stock <> '{}'::jsonb then
      current_qty := coalesce((p.size_stock->>item_size)::integer, 0);
      if current_qty < item_qty then raise exception 'The restored stock has already been sold; adjust inventory manually.'; end if;
      update public.products set size_stock = jsonb_set(size_stock, array[item_size], to_jsonb(current_qty - item_qty), false) where id = p.id;
    else
      if p.stock < item_qty then raise exception 'The restored stock has already been sold; adjust inventory manually.'; end if;
      update public.products set stock = stock - item_qty where id = p.id;
    end if;
  end if;
  update public.store_inventory_notifications set status=p_decision, resolved_at=now(), resolved_by=auth.uid() where id=n.id returning * into n;
  return n;
end; $$;
revoke all on function public.resolve_inventory_notification(uuid,text) from public, anon, authenticated;
grant execute on function public.resolve_inventory_notification(uuid,text) to authenticated, service_role;

-- Surface existing products that have sizes but no size-level quantities. The
-- owner can edit each product in the portal; no stock is guessed or split.
insert into public.store_inventory_notifications(store_id, product_id, kind, title, detail, payload)
select p.store_id, p.id, 'legacy_size_inventory', 'Add size quantities',
  format('%s needs quantities for %s.', p.title, array_to_string(p.sizes, ', ')),
  jsonb_build_object('sizes', p.sizes)
from public.products p
where cardinality(coalesce(p.sizes, '{}'::text[])) > 0
  and coalesce(p.size_stock, '{}'::jsonb) = '{}'::jsonb
  and not exists (select 1 from public.store_inventory_notifications n where n.product_id=p.id and n.kind='legacy_size_inventory');

-- Size inventory is enforced by the checkout RPC and the product trigger keeps
-- aggregate stock accurate for all existing callers.
