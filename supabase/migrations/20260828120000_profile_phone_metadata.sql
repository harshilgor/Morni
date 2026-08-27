-- Preserve the phone entered during email sign-up in the application profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), 'Morni shopper'),
    nullif(trim(coalesce(new.raw_user_meta_data->>'phone', new.phone)), ''),
    'shopper'::public.user_role
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone);
  return new;
end;
$$;

update public.profiles p
set phone = nullif(trim(u.raw_user_meta_data->>'phone'), '')
from auth.users u
where p.id = u.id and p.phone is null and nullif(trim(u.raw_user_meta_data->>'phone'), '') is not null;

revoke all on function public.handle_new_user() from public, anon, authenticated;
