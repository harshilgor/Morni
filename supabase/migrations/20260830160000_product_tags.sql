alter table public.products add column if not exists product_tag text;
alter table public.products add constraint products_product_tag_format check (product_tag is null or product_tag ~ '^[A-Za-z][A-Za-z0-9-]{0,39}$');
create unique index if not exists products_store_product_tag_unique on public.products(store_id, lower(product_tag)) where product_tag is not null;
alter table public.bulk_import_items add column if not exists product_tag text;
create or replace function public.publish_bulk_import(p_import_id uuid)
returns table(item_id uuid, product_id uuid, ok boolean, error_message text)
language plpgsql security definer set search_path = public
as $$
declare item record; category_id uuid; created_id uuid;
begin
  for item in select * from public.bulk_import_items where import_id=p_import_id and status in ('pending','failed') order by created_at loop
    begin
      select c.id into category_id from public.categories c join public.bulk_imports i on i.store_id=c.store_id where i.id=p_import_id and c.slug=item.category_slug limit 1;
      if category_id is null then raise exception 'Category not found'; end if;
      insert into public.products(store_id,category_id,title,product_tag,description,price_aed,stock,sizes,image_urls,is_available)
        select i.store_id,category_id,item.title,nullif(item.product_tag,''),item.description,item.price_aed,item.stock,item.sizes,item.image_urls,true from public.bulk_imports i where i.id=p_import_id returning id into created_id;
      update public.bulk_import_items set status='published',product_id=created_id,error_message=null,attempt_count=attempt_count+1,updated_at=now() where id=item.id;
      item_id:=item.id; product_id:=created_id; ok:=true; error_message:=null; return next;
    exception when others then
      update public.bulk_import_items set status='failed',error_message=left(sqlerrm,500),attempt_count=attempt_count+1,updated_at=now() where id=item.id;
      item_id:=item.id; product_id:=null; ok:=false; error_message:=left(sqlerrm,500); return next;
    end;
  end loop;
  update public.bulk_imports i set successful_items=(select count(*) from public.bulk_import_items x where x.import_id=i.id and x.status='published'), failed_items=(select count(*) from public.bulk_import_items x where x.import_id=i.id and x.status='failed'), status=case when exists(select 1 from public.bulk_import_items x where x.import_id=i.id and x.status='failed') then 'completed_with_errors' else 'completed' end, completed_at=now() where i.id=p_import_id;
end; $$;
revoke all on function public.publish_bulk_import(uuid) from public, anon, authenticated;
