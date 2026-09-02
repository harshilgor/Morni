-- Store staff access: every store has one or more memberships, with the
-- earliest existing member preserved as owner and later members as staff.
alter table public.store_members add column if not exists role text;

with ranked_members as (
  select id, row_number() over (partition by store_id order by created_at, id) as position
  from public.store_members
)
update public.store_members members
set role = case when ranked_members.position = 1 then 'owner' else 'staff' end
from ranked_members
where members.id = ranked_members.id and members.role is null;

alter table public.store_members alter column role set default 'staff';
alter table public.store_members alter column role set not null;
alter table public.store_members drop constraint if exists store_members_role_check;
alter table public.store_members add constraint store_members_role_check check (role in ('owner', 'manager', 'staff'));
create index if not exists store_members_store_role_idx on public.store_members(store_id, role);

create table if not exists public.store_team_invites (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'staff')),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists store_team_invites_store_pending_idx
  on public.store_team_invites(store_id, created_at desc)
  where accepted_at is null and revoked_at is null;
create index if not exists store_team_invites_email_pending_idx
  on public.store_team_invites(lower(email), expires_at)
  where accepted_at is null and revoked_at is null;

alter table public.store_team_invites enable row level security;

create or replace function public.is_store_owner(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id and user_id = auth.uid() and role = 'owner'
  ) or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.can_manage_store(p_store_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id and user_id = auth.uid() and role in ('owner', 'manager', 'staff')
  ) or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Store settings and irreversible deletion remain owner-only. Day-to-day
-- portal policies continue to use the existing membership predicate so staff
-- can work with products and orders.
drop policy if exists "stores_owner_update" on public.stores;
create policy "stores_owner_update" on public.stores for update to authenticated
  using (public.is_store_owner(id)) with check (public.is_store_owner(id));

drop policy if exists "store_team_invites_owner_read" on public.store_team_invites;
create policy "store_team_invites_owner_read" on public.store_team_invites for select to authenticated
  using (public.is_store_owner(store_id));

create or replace function public.delete_owned_store(p_store_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_store_owner(p_store_id) then raise exception 'Only a store owner can delete this store.' using errcode = '42501'; end if;
  delete from public.stores where id = p_store_id;
end;
$$;

revoke all on function public.is_store_owner(uuid) from public;
revoke all on function public.can_manage_store(uuid) from public;
grant execute on function public.is_store_owner(uuid), public.can_manage_store(uuid) to authenticated, service_role;
