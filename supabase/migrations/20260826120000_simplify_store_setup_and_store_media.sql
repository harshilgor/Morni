-- Simplify seller onboarding: a logo is the only branding asset required and
-- a store description is optional. Existing cover URLs are retained as data
-- but are no longer required or displayed by the application.
create or replace function public.launch_owned_store(p_store_id uuid)
returns public.stores
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_store public.stores;
  v_ready boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_store_member(p_store_id) then
    raise exception 'You do not have permission to launch this store.';
  end if;

  select * into v_store from public.stores where id = p_store_id;
  if not found then
    raise exception 'Store not found.';
  end if;

  select
    v_store.logo_url is not null
    and nullif(trim(v_store.area), '') is not null
    and nullif(trim(v_store.address), '') is not null
    and v_store.opens_at is not null
    and v_store.closes_at is not null
    and exists (
      select 1
      from public.products p
      where p.store_id = p_store_id
        and nullif(trim(p.title), '') is not null
        and nullif(trim(coalesce(p.description, '')), '') is not null
        and p.price_aed > 0
        and coalesce(cardinality(p.image_urls), 0) > 0
        and coalesce(cardinality(p.sizes), 0) > 0
    )
  into v_ready;

  if not coalesce(v_ready, false) then
    raise exception 'Finish your logo, delivery details, and one complete product before launching.';
  end if;

  update public.stores
  set
    is_active = true,
    onboarding_step = 5,
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    pause_note = null
  where id = p_store_id
  returning * into v_store;

  return v_store;
end;
$$;

-- Recreate storage policies using the security-definer membership helper.
-- This avoids the storage RLS insert failure that blocked logo uploads.
drop policy if exists "product_images_owner_upload" on storage.objects;
drop policy if exists "store_logos_owner_upload" on storage.objects;
drop policy if exists "product_images_owner_update" on storage.objects;
drop policy if exists "store_logos_owner_update" on storage.objects;
drop policy if exists "product_images_owner_delete" on storage.objects;
drop policy if exists "store_logos_owner_delete" on storage.objects;
drop policy if exists "product_images_member_upload" on storage.objects;
drop policy if exists "store_logos_member_upload" on storage.objects;
drop policy if exists "product_images_member_update" on storage.objects;
drop policy if exists "store_logos_member_update" on storage.objects;
drop policy if exists "product_images_member_delete" on storage.objects;
drop policy if exists "store_logos_member_delete" on storage.objects;

create policy "product_images_member_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "store_logos_member_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'store-logos'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "product_images_member_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'product-images'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "store_logos_member_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'store-logos'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'store-logos'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "product_images_member_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);

create policy "store_logos_member_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'store-logos'
  and public.is_store_member(((storage.foldername(name))[1])::uuid)
);
