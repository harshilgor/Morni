alter table public.bulk_import_items add column if not exists ai_confidence numeric(5,4) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1));
alter table public.bulk_import_items add column if not exists attempt_count integer not null default 0;
alter table public.bulk_import_items add column if not exists updated_at timestamptz not null default now();

create or replace function public.mark_bulk_import_item_attempt(p_item_id uuid, p_status text, p_product_id uuid default null, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bulk_import_items
  set status = p_status, product_id = coalesce(p_product_id, product_id), error_message = p_error,
      attempt_count = attempt_count + 1, updated_at = now()
  where id = p_item_id;
end;
$$;
revoke all on function public.mark_bulk_import_item_attempt(uuid,text,uuid,text) from public, anon, authenticated;
