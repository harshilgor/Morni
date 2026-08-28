-- Keep proof capture available while the rider is physically at the store.
-- This is intentionally idempotent so it repairs environments where the
-- earlier handoff migration was applied before pickup proof was introduced.
drop policy if exists "delivery_proofs_driver_insert" on public.delivery_proofs;
create policy "delivery_proofs_driver_insert" on public.delivery_proofs
for insert with check (
  captured_by = auth.uid()
  and exists (
    select 1
    from public.delivery_jobs job
    where job.id = delivery_proofs.delivery_job_id
      and job.driver_id = public.current_delivery_driver_id()
      and job.status in ('at_pickup', 'collected')
  )
);

drop policy if exists "delivery_proofs_storage_driver_upload" on storage.objects;
create policy "delivery_proofs_storage_driver_upload" on storage.objects
for insert with check (
  bucket_id = 'delivery-proofs'
  and auth.role() = 'authenticated'
  and (storage.foldername(storage.objects.name))[1] is not null
  and exists (
    select 1
    from public.delivery_jobs job
    where job.id = nullif((storage.foldername(storage.objects.name))[1], '')::uuid
      and job.driver_id = public.current_delivery_driver_id()
      and job.status in ('at_pickup', 'collected')
  )
);
