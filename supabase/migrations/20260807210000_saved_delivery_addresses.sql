alter table public.addresses
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.prepare_saved_address()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and not exists (
    select 1
    from public.addresses
    where user_id = new.user_id and is_default
  ) then
    new.is_default := true;
  end if;

  if new.is_default then
    update public.addresses
    set is_default = false
    where user_id = new.user_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and is_default;
  end if;

  return new;
end;
$$;

drop trigger if exists addresses_prepare_saved_address on public.addresses;
create trigger addresses_prepare_saved_address
before insert or update on public.addresses
for each row execute function public.prepare_saved_address();

drop trigger if exists addresses_updated_at on public.addresses;
create trigger addresses_updated_at
before update on public.addresses
for each row execute function public.set_updated_at();

create unique index if not exists addresses_one_default_per_user_idx
  on public.addresses (user_id)
  where is_default;
