create or replace function public.restore_default_address_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update public.addresses
    set is_default = true
    where id = (
      select id
      from public.addresses
      where user_id = old.user_id
      order by created_at
      limit 1
    );
  end if;

  return old;
end;
$$;

drop trigger if exists addresses_restore_default_after_delete on public.addresses;
create trigger addresses_restore_default_after_delete
after delete on public.addresses
for each row execute function public.restore_default_address_after_delete();
