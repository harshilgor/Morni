create table if not exists public.launch_customer_assignments (
  campaign_key text not null,
  visitor_key text not null,
  customer_number integer not null check (customer_number >= 100),
  created_at timestamptz not null default now(),
  primary key (campaign_key, visitor_key)
);

alter table public.launch_customer_assignments enable row level security;
revoke all on table public.launch_customer_assignments from anon, authenticated;
grant select, insert, update on table public.launch_customer_assignments to service_role;

create sequence if not exists public.launch_customer_number_seq start with 100 increment by 1;

create or replace function public.assign_launch_customer_number(p_campaign_key text, p_visitor_key text)
returns integer language plpgsql security definer set search_path = public as $$
declare assigned integer;
begin
  if length(trim(p_campaign_key)) = 0 or length(trim(p_visitor_key)) = 0 then raise exception 'invalid launch assignment key'; end if;
  select customer_number into assigned from public.launch_customer_assignments where campaign_key = p_campaign_key and visitor_key = p_visitor_key;
  if assigned is not null then return assigned; end if;
  insert into public.launch_customer_assignments(campaign_key, visitor_key, customer_number)
  values (p_campaign_key, p_visitor_key, nextval('public.launch_customer_number_seq'))
  on conflict (campaign_key, visitor_key) do nothing returning customer_number into assigned;
  if assigned is null then select customer_number into assigned from public.launch_customer_assignments where campaign_key = p_campaign_key and visitor_key = p_visitor_key; end if;
  return assigned;
end; $$;
revoke all on function public.assign_launch_customer_number(text, text) from public;
revoke all on function public.assign_launch_customer_number(text, text) from anon, authenticated;
grant execute on function public.assign_launch_customer_number(text, text) to service_role;
