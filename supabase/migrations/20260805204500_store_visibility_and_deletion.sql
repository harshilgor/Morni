alter table public.stores
add column if not exists deleted_at timestamptz;

create index if not exists stores_deleted_at_idx
on public.stores (deleted_at)
where deleted_at is not null;

create or replace function public.delete_owned_store(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not exists (
    select 1
    from public.store_members
    where store_id = p_store_id
      and user_id = auth.uid()
  ) then
    raise exception 'You do not have permission to delete this store.';
  end if;

  if exists (
    select 1
    from public.orders
    where store_id = p_store_id
      and status in ('placed', 'accepted', 'picking', 'out_for_delivery')
  ) then
    raise exception 'Complete or cancel all active orders before deleting this store.';
  end if;

  -- Keep the store row and completed orders as an immutable transaction record.
  -- The catalog and owner access are removed, so the store behaves as deleted.
  update public.stores
  set
    is_active = false,
    deleted_at = now(),
    pause_note = 'Deleted by store owner'
  where id = p_store_id;

  delete from public.store_promotions where store_id = p_store_id;
  delete from public.products where store_id = p_store_id;
  delete from public.categories where store_id = p_store_id;
  delete from public.store_members where store_id = p_store_id;
end;
$$;

revoke all on function public.delete_owned_store(uuid) from public;
grant execute on function public.delete_owned_store(uuid) to authenticated;
