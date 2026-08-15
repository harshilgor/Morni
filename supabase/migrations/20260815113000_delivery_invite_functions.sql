-- Keep delivery onboarding on the authenticated Supabase connection. This avoids
-- exposing or depending on a service-role key in the web application.

create or replace function public.create_delivery_partner(
  p_name text,
  p_support_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_support_email text := nullif(lower(trim(coalesce(p_support_email, ''))), '');
  v_slug_base text;
  v_partner public.delivery_partners;
begin
  if not public.is_morni_admin() then
    raise exception 'Founder access is required.';
  end if;

  if char_length(v_name) not between 2 and 120 then
    raise exception 'Enter a delivery company name between 2 and 120 characters.';
  end if;
  if v_support_email is not null and v_support_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'Enter a valid support email.';
  end if;

  v_slug_base := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
  v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');
  if v_slug_base = '' then
    raise exception 'Enter a valid delivery company name.';
  end if;

  insert into public.delivery_partners (name, slug, support_email)
  values (
    v_name,
    left(v_slug_base, 35) || '-' || gen_random_uuid()::text,
    v_support_email
  )
  returning * into v_partner;

  return jsonb_build_object('id', v_partner.id, 'name', v_partner.name, 'slug', v_partner.slug);
end;
$$;

create or replace function public.create_delivery_partner_invite(
  p_partner_id uuid,
  p_email text,
  p_role public.delivery_invite_role
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_partner public.delivery_partners;
  v_token text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before creating a delivery invite.';
  end if;
  if v_email !~ '^\S+@\S+\.\S+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if not public.is_morni_admin() and not exists (
    select 1
    from public.delivery_partner_members member
    where member.partner_id = p_partner_id
      and member.user_id = auth.uid()
  ) then
    raise exception 'Partner dispatcher access is required.';
  end if;

  select * into v_partner
  from public.delivery_partners
  where id = p_partner_id;
  if not found then
    raise exception 'Delivery partner not found.';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.delivery_partner_invites (
    partner_id,
    email,
    role,
    token_hash,
    created_by
  )
  values (
    p_partner_id,
    v_email,
    p_role,
    encode(digest(v_token, 'sha256'), 'hex'),
    auth.uid()
  );

  return jsonb_build_object('token', v_token, 'partner_name', v_partner.name);
end;
$$;

revoke all on function public.create_delivery_partner(text, text) from public, anon;
revoke all on function public.create_delivery_partner_invite(uuid, text, public.delivery_invite_role) from public, anon;
grant execute on function public.create_delivery_partner(text, text) to authenticated;
grant execute on function public.create_delivery_partner_invite(uuid, text, public.delivery_invite_role) to authenticated;
