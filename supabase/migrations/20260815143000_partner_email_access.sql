-- Let the email entered by a founder securely claim the delivery-partner owner
-- account after authenticating. The JWT email must exactly match the partner.

create unique index delivery_partners_support_email_unique
on public.delivery_partners (lower(support_email))
where support_email is not null;

create or replace function public.claim_delivery_partner_owner_access()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_partner public.delivery_partners;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Sign in with the partner email address.';
  end if;

  select *
  into v_partner
  from public.delivery_partners
  where lower(support_email) = v_email
    and is_active
  limit 1;

  if not found then
    raise exception 'No active delivery partner is linked to this email address.';
  end if;

  insert into public.delivery_partner_members (partner_id, user_id, role)
  values (v_partner.id, auth.uid(), 'owner')
  on conflict (partner_id, user_id)
  do update set role = 'owner';

  return jsonb_build_object(
    'partner_id', v_partner.id,
    'partner_name', v_partner.name,
    'role', 'owner'
  );
end;
$$;

revoke all on function public.claim_delivery_partner_owner_access() from public, anon;
grant execute on function public.claim_delivery_partner_owner_access() to authenticated;
