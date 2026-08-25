-- Keep store media writes scoped to a member's store folder.
-- The previous policy cast the first path segment to uuid and delegated to a
-- helper. Storage uploads are more reliable when the policy compares the
-- folder text directly to the member row and explicitly targets authenticated
-- users.

drop policy if exists "product_images_member_upload" on storage.objects;
drop policy if exists "store_logos_member_upload" on storage.objects;
drop policy if exists "product_images_member_update" on storage.objects;
drop policy if exists "store_logos_member_update" on storage.objects;
drop policy if exists "product_images_member_delete" on storage.objects;
drop policy if exists "store_logos_member_delete" on storage.objects;

create policy "product_images_member_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (
    exists (
      select 1
      from public.store_members sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

create policy "store_logos_member_upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'store-logos'
  and (
    exists (
      select 1
      from public.store_members sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

create policy "product_images_member_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and (
    exists (
      select 1
      from public.store_members sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
)
with check (
  bucket_id = 'product-images'
  and (
    exists (
      select 1
      from public.store_members sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

create policy "store_logos_member_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'store-logos'
  and (
    exists (
      select 1
      from public.store_members sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
)
with check (
  bucket_id = 'store-logos'
  and (
    exists (
      select 1
      from public.store_members sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

create policy "product_images_member_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (
    exists (
      select 1
      from public.store_members sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);

create policy "store_logos_member_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'store-logos'
  and (
    exists (
      select 1
      from public.store_members sm
      where sm.store_id::text = (storage.foldername(name))[1]
        and sm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
);
